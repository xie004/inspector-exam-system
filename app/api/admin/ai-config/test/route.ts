import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// 校验是否为管理员
function checkAdmin(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload || payload.role !== 'ADMIN') {
    return null;
  }
  return payload;
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    let { baseUrl, apiKey, modelName, modelType } = body; // modelType: 'text' | 'vision' | 'embedding'

    // 获取当前保存的配置，用作回退
    const dbConfig = await db.aiConfig.findUnique({
      where: { id: 'default' },
    });

    // 智能选择配置：如果前端没有传递，或者传递的是掩码，则回退到数据库已存配置
    const finalBaseUrl = (baseUrl && baseUrl.trim() !== '') ? baseUrl.trim() : (dbConfig?.baseUrl || '');
    let finalApiKey = (apiKey && apiKey.trim() !== '') ? apiKey.trim() : (dbConfig?.apiKey || '');
    const finalModelName = (modelName && modelName.trim() !== '') ? modelName.trim() : (dbConfig?.modelName || '');

    if (finalApiKey && (finalApiKey.includes('••') || finalApiKey === '••••••••')) {
      finalApiKey = dbConfig?.apiKey || '';
    }

    if (!finalBaseUrl) {
      return NextResponse.json({ error: '缺少 API Base URL 配置' }, { status: 400 });
    }
    if (!finalModelName) {
      return NextResponse.json({ error: '请选择或输入要测试的模型名称' }, { status: 400 });
    }

    // 格式化 Base URL
    let targetUrl = finalBaseUrl.replace(/\/+$/, '');
    
    let completionsUrl = `${targetUrl}/chat/completions`;
    let payload: any = {
      model: finalModelName,
      messages: [
        { role: 'user', content: '请回复 1' },
      ],
      max_tokens: 5,
      temperature: 0.1,
    };

    if (modelType === 'embedding') {
      completionsUrl = `${targetUrl}/embeddings`;
      payload = {
        model: finalModelName,
        input: 'test',
      };
    }

    console.log(`开始测试大模型连通性 [${modelType || 'text'}][${finalModelName}]:`, completionsUrl);

    // 构造请求头
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (finalApiKey) {
      headers['Authorization'] = `Bearer ${finalApiKey}`;
    }

    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 测试上限15秒

    try {
      const response = await fetch(completionsUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - start; // 计算延迟毫秒

      if (!response.ok) {
        let errorMsg = `HTTP Error ${response.status}`;
        try {
          const errData = await response.json();
          errorMsg = errData.error?.message || errData.message || errorMsg;
        } catch (e) {
          // 忽略解析错误
        }
        return NextResponse.json({
          success: false,
          error: `连接测试失败: ${errorMsg} (状态码: ${response.status})`,
          latency,
        }, { status: 400 });
      }

      const data = await response.json();
      
      // 解析大模型返回的文本或向量内容
      let content = '';
      if (modelType === 'embedding') {
        try {
          const emb = data.data[0].embedding;
          content = `成功生成向量嵌入，维度：${emb.length} 维`;
        } catch (e) {
          content = '获取向量返回格式不匹配，但接口联通成功';
        }
      } else {
        try {
          content = data.choices[0].message.content?.trim() || '';
        } catch (e) {
          content = '未匹配到返回内容，但接口联通成功';
        }
      }

      return NextResponse.json({
        success: true,
        latency,
        reply: content,
        message: '大模型测试连通成功！',
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      console.error('Test Model Connection Error:', fetchErr);

      let friendlyMessage = '网络请求失败';
      if (fetchErr.name === 'AbortError') {
        friendlyMessage = '连接大模型服务器超时（15秒限时），请核对 API 接口地址与网络。';
      } else {
        friendlyMessage = `连接失败: ${fetchErr.message || '未知网络错误'}`;
      }

      return NextResponse.json({
        success: false,
        error: friendlyMessage,
        latency,
      }, { status: 400 });
    }
  } catch (error) {
    console.error('测试大模型连通性内部错误:', error);
    return NextResponse.json({ error: '服务器内部错误，测试连通失败' }, { status: 500 });
  }
}
