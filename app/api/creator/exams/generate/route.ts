import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// 校验是否为出题员或管理员
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

// 异步后台试卷生成器
async function runBackgroundExamGeneration(examId: string, standardId: string, config: any) {
  try {
    const standard = await db.standard.findUnique({
      where: { id: standardId },
    });

    if (!standard || !standard.extractedText) {
      throw new Error('未找到选定的标准文献或该文献无有效解析文本');
    }

    const aiConfig = await db.aiConfig.findUnique({
      where: { id: 'default' },
    });

    if (!aiConfig || !aiConfig.apiKey) {
      throw new Error('大模型 API 密钥尚未配置，无法出题。请联系管理员配置。');
    }

    const enabledTypes = Object.keys(config).filter(type => config[type].count > 0);
    const totalTypes = enabledTypes.length;

    console.log(`[AI 出题] 开始后台试卷生成, 试卷ID: ${examId}, 总题型数: ${totalTypes}`);

    let currentIdx = 0;
    const questionsList: any[] = [];

    for (const type of enabledTypes) {
      currentIdx++;
      const { count, score } = config[type];
      
      let typeName = '';
      let typeSpecificRule = '';
      let optionsTemplate = '';
      let correctAnswerTemplate = '';

      if (type === 'SINGLE') {
        typeName = '单选题';
        typeSpecificRule = '必须包含 4 个选项（标记为 A. xxx, B. xxx, C. xxx, D. xxx），"correctAnswer" 必须是选项字母 A/B/C/D 之一。';
        optionsTemplate = '["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"]';
        correctAnswerTemplate = 'A';
      } else if (type === 'MULTIPLE') {
        typeName = '多选题';
        typeSpecificRule = '必须包含 4 或 5 个选项，"correctAnswer" 是包含所有正确字母且用逗号分隔的字符串（例: "A,B" 或 "A,C,D"）。';
        optionsTemplate = '["A. 选项一", "B. 选项二", "C. 选项三", "D. 选项四"]';
        correctAnswerTemplate = 'A,B';
      } else if (type === 'JUDGE') {
        typeName = '判断题';
        typeSpecificRule = '"correctAnswer" 必须且只能是 "正确" 或 "错误"。options 必须为 null。';
        optionsTemplate = 'null';
        correctAnswerTemplate = '正确';
      } else if (type === 'FILL') {
        typeName = '填空题';
        typeSpecificRule = '题干中用括号【】或下划线___表示填空位置，"correctAnswer" 填写正确答案文本。options 必须为 null。';
        optionsTemplate = 'null';
        correctAnswerTemplate = '答案文本';
      } else if (type === 'SHORT') {
        typeName = '简答题';
        typeSpecificRule = '题干为分析或说明题，"correctAnswer" 必须是标准参考答案，且必须在答案首部明确列出核心得分点 (得分关键词，如“核心得分点：1.xxx; 2.xxx”)。options 必须为 null。';
        optionsTemplate = 'null';
        correctAnswerTemplate = '核心得分点：1.xxx; 2.xxx。参考答案：详细文本';
      }

      // 更新试卷进度
      await db.exam.update({
        where: { id: examId },
        data: { progress: `正在研读标准并生成${typeName} (${currentIdx}/${totalTypes})...` }
      });

      const prompt = `你是一位严谨的国家产品质量检验检测专家与命题组组长。
请你仔细研读以下给出的产品技术标准文献内容，并严格根据该文献中的技术要求，为检验检测人员生成 ${count} 道【${typeName}】考评题目。

=== 产品标准文献内容 ===
${standard.extractedText}
========================

=== 命题要求 ===
- 题型：${typeName} (${type})
- 题目数量：${count} 道
- 单题分值：${score} 分
- 题型规则：${typeSpecificRule}

=== 命题科学性原则 ===
1. **科学与严谨性**：题目必须100%符合标准文献的技术指标，不得凭空捏造或包含与文献冲突的内容。
2. **章节条款追溯**：必须在每道题的 "knowledgePoint" 字段中，精确标明该题所对应的标准条款编号与章节名称（例如: "5.2条 采样规则" 或 "6.4.1.2条 物理拉伸强度判定"），不得填写笼统的"标准原文"或留空，这是后续用于评估考生对各个条款掌握情况的关键元数据！
3. **解析详尽性**：在 "explanation" 字段中详细写明题目解析与标准依据。

=== 思考长度限制 ===
请保持极度简短的内部推理过程，尽快输出 JSON。

=== 输出格式限制 ===
你必须输出一个严格符合以下 JSON 结构的格式，不要包含任何 markdown 标记（如 \`\`\`json 包装），不要包含任何前后废话，只输出 JSON 字符串：
{
  "questions": [
    {
      "type": "${type}",
      "content": "题干文本",
      "options": ${optionsTemplate},
      "correctAnswer": "${correctAnswerTemplate}",
      "score": ${score},
      "explanation": "依据标准第x条关于xxx的规定...",
      "knowledgePoint": "具体章节条款名称"
    }
  ]
}
`;

      const completionsUrl = `${aiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      
      const response = await fetch(completionsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: aiConfig.modelName,
          messages: [
            { role: 'system', content: '你是一个严格输出 JSON 且思考过程极度简炼的产品质检命题专家。' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error?.message || `HTTP ${response.status}`);
      }

      const responseData = await response.json();
      const rawContent = responseData.choices[0]?.message?.content?.trim() || '';

      if (!rawContent) {
        throw new Error(`大模型未能返回任何${typeName}的生成内容`);
      }

      let parsedData;
      try {
        parsedData = JSON.parse(rawContent);
      } catch (parseErr) {
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error(`大模型返回的${typeName} JSON 结构损坏，系统无法解析`);
        }
      }

      if (!parsedData || !Array.isArray(parsedData.questions)) {
        throw new Error(`大模型返回的${typeName} JSON 中缺少 questions 题目数组`);
      }

      questionsList.push(...parsedData.questions);
    }

    // 题目生成完成，批量存入 Question 表并更新试卷状态
    console.log(`[AI 出题] 所有题型生成完毕，准备落库。共生成 ${questionsList.length} 道题目`);
    
    await db.$transaction(async (tx) => {
      // 写入所有 Question 记录
      await tx.question.createMany({
        data: questionsList.map((q: any) => ({
          examId,
          standardId,
          type: q.type,
          content: q.content.trim(),
          options: q.options ? JSON.stringify(q.options) : null,
          correctAnswer: q.correctAnswer.toString().trim(),
          score: parseFloat(q.score.toString()) || 2.0,
          explanation: q.explanation ? q.explanation.trim() : null,
          knowledgePoint: (q.knowledgePoint || '未分类条款').trim(),
        }))
      });

      // 更新试卷状态为已完成
      await tx.exam.update({
        where: { id: examId },
        data: {
          status: 'COMPLETED',
          progress: '',
          errorMsg: null
        }
      });
    });

    console.log(`[AI 出题] 后台试卷及题目生成成功: [Exam ID: ${examId}]`);

  } catch (error: any) {
    console.error(`[AI 出题] 后台生成试卷失败: [Exam ID: ${examId}], 错误:`, error);
    await db.exam.update({
      where: { id: examId },
      data: {
        status: 'FAILED',
        errorMsg: error.message || '未知智能出题错误',
        progress: ''
      }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可使用智能出题功能' }, { status: 403 });
    }

    const { standardId, title, timeLimit, config } = await req.json();

    if (!standardId) {
      return NextResponse.json({ error: '请选择用作出题依据的产品标准文献' }, { status: 400 });
    }
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: '请配置试卷的考核标题名称' }, { status: 400 });
    }

    const duplicateExam = await db.exam.findFirst({
      where: {
        title: title.trim(),
      },
    });
    if (duplicateExam) {
      return NextResponse.json({ error: '试卷标题已存在，请使用其他名称' }, { status: 400 });
    }
    if (!timeLimit || timeLimit <= 0) {
      return NextResponse.json({ error: '请配置有效的答题时长限制(分钟)' }, { status: 400 });
    }
    if (!config || Object.keys(config).length === 0) {
      return NextResponse.json({ error: '请配置要生成的题型及数量' }, { status: 400 });
    }

    // 检查标准是否存在
    const standard = await db.standard.findUnique({
      where: { id: standardId },
    });
    if (!standard) {
      return NextResponse.json({ error: '关联的标准文献不存在' }, { status: 400 });
    }

    // 检查 AI 配置
    const aiConfig = await db.aiConfig.findUnique({
      where: { id: 'default' },
    });
    if (!aiConfig || !aiConfig.apiKey) {
      return NextResponse.json({
        error: '大模型 API 密钥尚未配置，无法出题。请联系管理员配置。'
      }, { status: 400 });
    }

    // 在数据库创建 status="GENERATING" 的 Exam 记录
    const departmentId = authPayload.departmentId || '';
    const newExam = await db.exam.create({
      data: {
        title: title.trim(),
        departmentId,
        standardId,
        timeLimit: parseInt(timeLimit.toString(), 10),
        status: 'GENERATING',
        progress: '正在分析标准文献并初始化命题小组...'
      }
    });

    // 触发异步后台生成，不阻塞当前 HTTP 请求
    runBackgroundExamGeneration(newExam.id, standardId, config);

    return NextResponse.json({
      success: true,
      message: '试卷后台智能命题线程已成功启动！请稍后刷新试卷列表查看生成进度。',
      examId: newExam.id
    });

  } catch (error) {
    console.error('智能出题处理错误:', error);
    return NextResponse.json({ error: '服务器内部错误，智能出题服务故障' }, { status: 500 });
  }
}
