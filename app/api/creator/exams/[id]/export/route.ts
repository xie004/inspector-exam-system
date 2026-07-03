import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType
} from 'docx';

// 校验角色权限 (仅限 CREATOR 和 ADMIN)
function checkAuth(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload || (payload.role !== 'CREATOR' && payload.role !== 'ADMIN')) {
    return null;
  }
  return payload;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可导出试卷' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const exportType = searchParams.get('type') || 'student'; // "student" (考生版) | "teacher" (教师版)

    // 1. 获取试卷及旗下所有题目详情
    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        department: { select: { name: true } },
        questions: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: '试卷不存在' }, { status: 404 });
    }

    // 数据隔离：出题员只能导出属于本部门的试卷
    if (authPayload.role === 'CREATOR' && exam.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您只能导出属于本部门的试卷' }, { status: 403 });
    }

    // 计算总满分
    const totalScore = exam.questions.reduce((sum, q) => sum + q.score, 0);

    // 2. 使用 docx 库构建结构化 Word 文档
    const docChildren: any[] = [];

    // --- 2.1 试卷主标题 ---
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 },
        children: [
          new TextRun({
            text: exam.title,
            bold: true,
            size: 36, // 18pt
            font: 'SimSun', // 宋体
          }),
        ],
      })
    );

    // --- 2.2 试卷副标题 (考务明细) ---
    const subtitleText = `部门科室: ${exam.department.name}  |  考试限时: ${exam.timeLimit} 分钟  |  试卷总分: ${totalScore} 分  |  版次: ${exportType === 'teacher' ? '教师参考版 (含标准答案与解析)' : '考生作答版 (无答案)'}`;
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 400 },
        children: [
          new TextRun({
            text: subtitleText,
            size: 20, // 10pt
            color: '666666',
            font: 'Microsoft YaHei', // 微软雅黑
          }),
        ],
      })
    );

    // --- 2.3 装饰分割线 ---
    docChildren.push(
      new Paragraph({
        spacing: { after: 300 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: 'cccccc',
            space: 1,
          },
        },
      })
    );

    // --- 2.4 按题型分组输出题目 ---
    // 为了使导出的试卷井然有序，我们按题型在逻辑上归类：单选、多选、判断、填空、简答
    const questionsByType: Record<string, any[]> = {
      SINGLE: [],
      MULTIPLE: [],
      JUDGE: [],
      FILL: [],
      SHORT: [],
    };

    exam.questions.forEach((q) => {
      if (questionsByType[q.type]) {
        questionsByType[q.type].push(q);
      } else {
        questionsByType[q.type] = [q];
      }
    });

    const typeNames: Record<string, string> = {
      SINGLE: '一、 单项选择题 (每题在给出的选项中只有一项是符合题目要求的)',
      MULTIPLE: '二、 多项选择题 (每题在给出的选项中有多项符合要求，漏选或多选均不得分)',
      JUDGE: '三、 技术判断题 (对给出的技术描述进行对错判断)',
      FILL: '四、 标准填空题 (请在括号【】或划线处填入合适的技术规范参数)',
      SHORT: '五、 专业简答分析题 (根据标准规范，对问题进行技术分析或简述说明)',
    };

    let globalIndex = 1;

    Object.keys(questionsByType).forEach((type) => {
      const qList = questionsByType[type];
      if (qList.length === 0) return;

      // 写入大题型标题
      docChildren.push(
        new Paragraph({
          spacing: { before: 200, after: 150 },
          children: [
            new TextRun({
              text: typeNames[type],
              bold: true,
              size: 24, // 12pt (小四)
              color: '1e3a8a', // 暗蓝色深色
              font: 'Microsoft YaHei',
            }),
          ],
        })
      );

      // 逐个写入大题型下的每道具体题目
      qList.forEach((q) => {
        // 1) 题干段落
        docChildren.push(
          new Paragraph({
            spacing: { before: 100, after: 100 },
            indent: { left: 360 }, // 悬挂缩进
            children: [
              new TextRun({
                text: `${globalIndex}. `,
                bold: true,
                size: 21, // 10.5pt (五号)
                font: 'SimSun',
              }),
              new TextRun({
                text: `${q.content} （本题 ${q.score} 分，关联条款: ${q.knowledgePoint}）`,
                size: 21,
                font: 'SimSun',
              }),
            ],
          })
        );

        // 2) 如果是选择题，输出选项
        if (q.options && (type === 'SINGLE' || type === 'MULTIPLE')) {
          let optsArray = [];
          try {
            optsArray = JSON.parse(q.options);
          } catch (e) {
            // 如果解析失败，尝试切分
            optsArray = typeof q.options === 'string' ? q.options.split(',') : [];
          }

          if (Array.isArray(optsArray)) {
            optsArray.forEach((opt) => {
              docChildren.push(
                new Paragraph({
                  spacing: { before: 50, after: 50 },
                  indent: { left: 720 }, // 进一步缩进显示选项
                  children: [
                    new TextRun({
                      text: opt,
                      size: 21,
                      font: 'SimSun',
                    }),
                  ],
                })
              );
            });
          }
        }

        // 3) 如果是考生版简答题，流出空白行供考生线下手写答题
        if (exportType === 'student' && type === 'SHORT') {
          for (let i = 0; i < 4; i++) {
            docChildren.push(
              new Paragraph({
                spacing: { before: 100, after: 100 },
                children: [new TextRun({ text: '' })], // 空白段落
              })
            );
          }
        }

        // 4) 如果是教师参考版，输出答案与解析
        if (exportType === 'teacher') {
          docChildren.push(
            new Paragraph({
              spacing: { before: 80, after: 80 },
              indent: { left: 540 },
              children: [
                new TextRun({
                  text: '【标准答案】: ',
                  bold: true,
                  size: 20,
                  color: '059669', // 绿色
                  font: 'Microsoft YaHei',
                }),
                new TextRun({
                  text: q.correctAnswer,
                  bold: true,
                  size: 20,
                  color: '0f172a',
                  font: 'SimSun',
                }),
              ],
            })
          );

          if (q.explanation) {
            docChildren.push(
              new Paragraph({
                spacing: { before: 80, after: 150 },
                indent: { left: 540 },
                children: [
                  new TextRun({
                    text: '【依据与深度解析】: ',
                    bold: true,
                    size: 19,
                    color: '6b7280', // 灰色
                    font: 'Microsoft YaHei',
                  }),
                  new TextRun({
                    text: q.explanation,
                    size: 19,
                    color: '4b5563',
                    font: 'SimSun',
                  }),
                ],
              })
            );
          }
        }

        globalIndex++; // 全局题号递增
      });
    });

    // 3. 将 docx 转换为二进制流 Buffer 并提供下载
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);

    // 设置下载头： application/vnd.openxmlformats-officedocument.wordprocessingml.document
    // 中文文件名需进行 RFC 5987 / UTF-8 格式转码以防乱码
    const editionTag = exportType === 'teacher' ? '教师版' : '学生版';
    const filename = `${exam.title}-${editionTag}.docx`;
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error('导出试卷 Word 失败:', error);
    return NextResponse.json({ error: '服务器内部错误，Word 导出失败' }, { status: 500 });
  }
}
