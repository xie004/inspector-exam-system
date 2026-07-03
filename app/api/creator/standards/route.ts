import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { pathToFileURL } from 'url';
import mammoth from 'mammoth';
import { pdfToPng } from 'pdf-to-png-converter';

// 使用 pdfjs-dist 直接提取 PDF 文本（版本通过 package.json overrides 统一为 6.0.227）
async function extractTextFromPdfBuffer(buffer: Buffer): Promise<{ text: string; numPages: number; width: number }> {
  const pdfjsPath = join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs');
  const pdfjs = await import(/* webpackIgnore: true */ pathToFileURL(pdfjsPath).href);
  
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdfDocument = await loadingTask.promise;
  
  let fullText = '';
  const numPages = pdfDocument.numPages;
  let firstPageWidth = 595; // 默认 A4 宽度
  
  if (numPages > 0) {
    try {
      const page = await pdfDocument.getPage(1);
      const viewport = page.getViewport({ scale: 1.0 });
      firstPageWidth = viewport.width;
    } catch (e) {
      console.warn('获取 PDF 第一页宽度失败:', e);
    }
  }
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }
  
  await loadingTask.destroy();
  
  return { text: fullText, numPages, width: firstPageWidth };
}

// 校验角色权限 (仅允许 CREATOR 和 ADMIN)
function checkAuth(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload || (payload.role !== 'CREATOR' && payload.role !== 'ADMIN')) {
    return null;
  }
  return payload;
}

// 并发控制辅助函数
async function runWithConcurrencyLimit<T, R>(
  limit: number,
  items: T[],
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      results[index] = await fn(item, index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function GET(req: NextRequest) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可执行此操作' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterDeptId = searchParams.get('departmentId');

    // 构造条件：如果是出题员，强制只能看自己部门的标准；如果是管理员，可以看全部或按参数筛选
    const whereClause: any = {};
    if (authPayload.role === 'CREATOR') {
      whereClause.departmentId = authPayload.departmentId;
    } else if (authPayload.role === 'ADMIN' && filterDeptId) {
      whereClause.departmentId = filterDeptId;
    }

    const standards = await db.standard.findMany({
      where: whereClause,
      include: {
        department: {
          select: { name: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      standards: standards.map(s => ({
        id: s.id,
        title: s.title,
        fileType: s.fileType,
        filePath: s.filePath,
        extractedTextLen: s.extractedText?.length || 0,
        departmentName: s.department.name,
        departmentId: s.departmentId,
        status: s.status,
        progress: s.progress,
        errorMsg: s.errorMsg,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error('获取标准文献列表失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取标准列表失败' }, { status: 500 });
  }
}

// 异步后台解析引擎
async function runBackgroundParser(standardId: string, buffer: Buffer, fileExt: string, fileType: string) {
  try {
    let extractedText = '';

    // 获取当前 AI 配置，选用多模态模型或默认文本模型
    const aiConfig = await db.aiConfig.findUnique({ where: { id: 'default' } });
    const useVisionConfig = aiConfig?.visionBaseUrl && aiConfig?.visionApiKey && aiConfig?.visionModelName;
    const finalBaseUrl = useVisionConfig ? aiConfig.visionBaseUrl : aiConfig?.baseUrl;
    const finalApiKey = useVisionConfig ? aiConfig.visionApiKey : aiConfig?.apiKey;
    const finalModelName = useVisionConfig ? aiConfig.visionModelName : aiConfig?.modelName;

    if (fileExt === '.pdf') {
      const pdfData = await extractTextFromPdfBuffer(buffer);
      extractedText = pdfData.text || '';
      
      const charCount = extractedText.replace(/\s+/g, '').length;
      const pageCount = pdfData.numPages || 1;

      // 检测是否为扫描件
      if (charCount < 100 || (charCount / pageCount) < 150) {
        if (!finalApiKey) {
          throw new Error('检测到扫描版 PDF，需要大模型 Vision OCR，但系统尚未配置多模态模型 API Key，请联系管理员完善配置。');
        }

        await db.standard.update({
          where: { id: standardId },
          data: { progress: '正在转换 PDF 页面为高分辨率图片...' }
        });

        const targetWidth = 750; 
        const pdfWidth = pdfData.width || 595;
        const scale = Math.max(0.3, Math.min(2.0, targetWidth / pdfWidth));

        const pngPages = await pdfToPng(buffer, {
          viewportScale: scale,
          processPagesInParallel: true,
          concurrencyLimit: 4,
        });

        const batchSize = 1;
        const totalPages = pngPages.length;
        const batches: any[][] = [];
        for (let i = 0; i < totalPages; i += batchSize) {
          batches.push(pngPages.slice(i, i + batchSize));
        }

        const fetchWithRetry = async (batchPages: any[], batchIdx: number, attempt = 1): Promise<string> => {
          const startPage = batchIdx * batchSize + 1;
          const endPage = Math.min(totalPages, (batchIdx + 1) * batchSize);
          try {
            const contentArray: any[] = [
              {
                type: 'text',
                text: '你是一个高精度的 OCR 文字识别系统 and 专业检测员。请精确提取这一组图片（属于同一个产品标准文献 PDF 的连续页面）中展示的标准文献内的所有文字。请严格按照页面顺序提取，保留原有的段落层次、技术参数、指标数据以及条款编号。不要添加任何你自己的说明、分析、注释、引言、前缀或后缀，只输出提取出的标准纯文本内容。'
              }
            ];
            
            for (const page of batchPages) {
              const base64 = page.content.toString('base64');
              contentArray.push({
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64}`
                }
              });
            }

            const completionsUrl = `${finalBaseUrl!.replace(/\/+$/, '')}/chat/completions`;
            const ocrPayload = {
              model: finalModelName,
              messages: [
                { role: 'user', content: contentArray }
              ],
              temperature: 0.1,
            };

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 300000); // 300秒

            const ocrRes = await fetch(completionsUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${finalApiKey}`
              },
              body: JSON.stringify(ocrPayload),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!ocrRes.ok) {
              const errBody = await ocrRes.json().catch(() => ({}));
              throw new Error(errBody.error?.message || `HTTP ${ocrRes.status}`);
            }

            const ocrData = await ocrRes.json();
            return ocrData.choices[0]?.message?.content?.trim() || '';
          } catch (error: any) {
            console.error(`[PDF OCR] 批次 页 ${startPage} - 页 ${endPage} 第 ${attempt} 次尝试失败:`, error?.message || error);
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              return fetchWithRetry(batchPages, batchIdx, attempt + 1);
            }
            throw error;
          }
        };

        const batchResults = await runWithConcurrencyLimit(3, batches, async (batchPages, index) => {
          const startPage = index * batchSize + 1;
          const endPage = Math.min(totalPages, (index + 1) * batchSize);
          
          const batchText = await fetchWithRetry(batchPages, index);
          
          // 写入实时进度
          await db.standard.update({
            where: { id: standardId },
            data: { progress: `正在识别 ${endPage}/${totalPages} 页...` }
          });

          return batchText;
        });

        extractedText = batchResults.filter(Boolean).join('\n\n').trim();
        if (!extractedText) {
          throw new Error('大模型 Vision OCR 未能识别出任何标准文字内容');
        }
      }
    } else if (fileExt === '.docx') {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value || '';
    } else if (['.png', '.jpg', '.jpeg'].includes(fileExt)) {
      if (!finalApiKey) {
        throw new Error('检测到图片格式标准，需要大模型 Vision OCR，但系统尚未配置多模态模型 API Key，请联系管理员配置。');
      }

      await db.standard.update({
        where: { id: standardId },
        data: { progress: '正在通过 Vision 模型解析图片中...' }
      });

      const base64Image = buffer.toString('base64');
      const mimeType = `image/${fileExt.substring(1)}`;
      const completionsUrl = `${finalBaseUrl!.replace(/\/+$/, '')}/chat/completions`;
      
      const ocrPayload = {
        model: finalModelName,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: '你是一个高精度的 OCR 文字识别系统和专业检测员。请精确提取图片中展示的产品标准文献内的所有文字。不要添加任何你自己的说明、分析、引言、前缀或后缀，保留原有的段落层次、技术参数、指标数据以及条款编号。只输出识别到的标准文本。'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 180秒

      const ocrRes = await fetch(completionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${finalApiKey}`
        },
        body: JSON.stringify(ocrPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!ocrRes.ok) {
        const errBody = await ocrRes.json().catch(() => ({}));
        throw new Error(errBody.error?.message || `HTTP ${ocrRes.status}`);
      }

      const ocrData = await ocrRes.json();
      extractedText = ocrData.choices[0]?.message?.content?.trim() || '';
      if (!extractedText) {
        throw new Error('大模型未能从图片中识别出任何文本内容');
      }
    }

    // 更新标准状态为可用，写入文本，清空进度与错误信息
    await db.standard.update({
      where: { id: standardId },
      data: {
        extractedText: extractedText.trim(),
        status: 'AVAILABLE',
        progress: '',
        errorMsg: null
      }
    });

    console.log(`[PDF OCR] 异步解析标准文献成功: [ID: ${standardId}], 字数: ${extractedText.length}`);
  } catch (error: any) {
    console.error(`[PDF OCR] 异步解析标准文献失败: [ID: ${standardId}], 错误:`, error);
    await db.standard.update({
      where: { id: standardId },
      data: {
        status: 'FAILED',
        errorMsg: error.message || '未知解析错误',
        progress: ''
      }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可上传标准' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const customTitle = formData.get('title') as string | null;
    let targetDeptId = formData.get('departmentId') as string | null;

    if (!file) {
      return NextResponse.json({ error: '请选择要上传的文件' }, { status: 400 });
    }

    // 部门绑定逻辑安全性校验
    if (authPayload.role === 'CREATOR') {
      // 出题员强制绑定自己的部门，不允许越权指定其他部门
      targetDeptId = authPayload.departmentId;
    } else if (authPayload.role === 'ADMIN' && !targetDeptId) {
      return NextResponse.json({ error: '管理员上传标准必须指定所属部门' }, { status: 400 });
    }

    if (!targetDeptId) {
      return NextResponse.json({ error: '所属部门配置错误' }, { status: 400 });
    }

    const fileTitle = customTitle || file.name.replace(/\.[^/.]+$/, "");
    const fileExt = extname(file.name).toLowerCase();
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 本地归档存储
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${fileExt}`;
    const filePath = join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);
    
    const dbFilePath = `/uploads/${uniqueName}`;

    let fileType = '';
    if (fileExt === '.pdf') {
      fileType = 'pdf';
    } else if (fileExt === '.docx') {
      fileType = 'docx';
    } else if (['.png', '.jpg', '.jpeg'].includes(fileExt)) {
      fileType = 'image';
    } else {
      return NextResponse.json({ error: '不支持的文件类型！仅支持上传 PDF (.pdf)、Word (.docx) 以及图片 (.png/.jpg/.jpeg) 格式的标准。' }, { status: 400 });
    }

    // 数据库创建标准草稿
    const newStandard = await db.standard.create({
      data: {
        title: fileTitle.trim(),
        fileType,
        filePath: dbFilePath,
        extractedText: '',
        departmentId: targetDeptId,
        status: 'PROCESSING',
        progress: '正在初始化异步解析引擎...'
      },
    });

    // 触发异步解析，不阻塞当前 HTTP 请求
    runBackgroundParser(newStandard.id, buffer, fileExt, fileType);

    return NextResponse.json({
      success: true,
      message: '标准文献已成功上传，后台解析线程已启动！请稍后刷新列表查看。',
      standard: {
        id: newStandard.id,
        title: newStandard.title,
        fileType: newStandard.fileType,
        status: 'PROCESSING',
      },
    });
  } catch (error) {
    console.error('上传标准失败:', error);
    return NextResponse.json({ error: '服务器内部错误，标准文件处理失败' }, { status: 500 });
  }
}
