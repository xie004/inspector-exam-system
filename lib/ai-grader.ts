import { db } from './db';

interface AiGradeResponse {
  score: number;
  comment: string;
}

/**
 * 后台异步对考生的主观题进行 AI 预判阅
 * @param recordId 答卷记录 ID
 */
export async function runAiPreGrading(recordId: string): Promise<boolean> {
  try {
    console.log(`[AI 阅卷引擎] 启动：正在为答卷 [${recordId}] 进行主观题智能评判...`);

    // 1. 获取答卷及所有未评分的主观题作答
    const record = await db.examRecord.findUnique({
      where: { id: recordId },
      include: {
        answers: {
          where: {
            question: {
              type: { in: ['FILL', 'SHORT'] }, // 仅填空和简答需要 AI
            },
          },
          include: {
            question: true,
          },
        },
      },
    });

    if (!record || record.answers.length === 0) {
      console.log(`[AI 阅卷引擎] 该答卷不存在或不包含任何主观题，无需进行 AI 阅卷。`);
      return true;
    }

    // 2. 获取全局 AI 配置
    const aiConfig = await db.aiConfig.findUnique({
      where: { id: 'default' },
    });

    if (!aiConfig || !aiConfig.apiKey) {
      console.warn(`[AI 阅卷引擎] 未配置全局 AI 密匙，已跳过自动阅卷。`);
      return false;
    }

    const completionsUrl = `${aiConfig.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    // 3. 循环对每道主观题进行大模型智能评估
    for (const ans of record.answers) {
      const q = ans.question;
      
      console.log(`[AI 阅卷引擎] 正在评判题目: [${q.content.substring(0, 15)}...]`);

      const prompt = `你是一位极具权威的产品质量检验检测考官。
请你根据给出的“产品检测问题”、“满分分值”、“考生作答内容”、“官方参考答案”以及“标准解析”，对考生的答题给出客观、公正的评分和评语。

=== 考核题目 ===
${q.content}

=== 分值权重 ===
满分：${q.score} 分

=== 考生作答内容 ===
${ans.answerContent || '（未作答，直接按 0 分处理）'}

=== 官方标准答案 ===
${q.correctAnswer}

=== 标准解析与依据 ===
${q.explanation || '暂无详细解析'}

=== 评分与评阅原则 ===
1. **公正严格**：对照官方标准答案的得分点（填空题要求核心词汇吻合；简答题要求核心步骤、技术参数和检验结论正确）。
2. **细粒度扣分**：如果考生回答正确但不够全面，请酌情扣分。支持 0.5 分的细粒度（例如给出 8.5 分，满分 10 分）。如果未作答，推荐分值直接为 0。
3. **富有建设性的评语**：评语中需明确指出考生答对的部分（得分点）、答错或遗漏的部分（扣分点），并给出如何符合标准的专业改进建议。

=== 输出格式限制 ===
你必须输出一个严格符合以下 JSON 结构的格式，不要包含任何 markdown 标记，不要包含任何多余前缀或后缀：
{
  "score": 推荐得分数值(不能超过满分 ${q.score}),
  "comment": "你的详细评语，标明得分点、扣分原因及指导建议"
}
`;

      try {
        const response = await fetch(completionsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: aiConfig.modelName,
            messages: [
              { role: 'system', content: '你是一个严格输出 JSON 的专业质检考官。' },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2, // 低温度保证评分稳定性
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content?.trim() || '';
        const parsed: AiGradeResponse = JSON.parse(content);

        // 限制打分边界安全
        const finalAiScore = Math.min(Math.max(0, parseFloat(parsed.score.toString()) || 0), q.score);

        // 4. 更新数据库中的 AI 推荐得分和评语
        await db.answer.update({
          where: { id: ans.id },
          data: {
            aiScore: finalAiScore,
            aiComment: parsed.comment ? parsed.comment.trim() : 'AI 评阅完成',
          },
        });

        console.log(`[AI 阅卷引擎] 题目 [${q.id.substring(0, 8)}] 评判完成，AI 推荐分: ${finalAiScore}`);
      } catch (err: any) {
        console.error(`[AI 阅卷引擎] 单题 [${q.id}] 评判失败:`, err);
        // 容错：即使单题失败，也更新为错误日志，防止阻塞其他题目
        await db.answer.update({
          where: { id: ans.id },
          data: {
            aiScore: 0,
            aiComment: `AI 智能评分服务连接失败: ${err.message || '超时'}。已转入待手动阅卷。`,
          },
        });
      }
    }

    console.log(`[AI 阅卷引擎] 答卷 [${recordId}] 所有主观题 AI 预评分已全部成功落库！`);

    // 检查并处理自主训练任务直接出分逻辑
    const recordWithTask = await db.examRecord.findUnique({
      where: { id: recordId },
      include: {
        task: {
          select: {
            type: true,
          },
        },
      },
    });

    if (recordWithTask?.task?.type === 'TRAINING') {
      console.log(`[AI 阅卷引擎] 检测到答卷 [${recordId}] 属于自主训练任务，正在执行自动出分...`);
      const subjectiveAnswers = await db.answer.findMany({
        where: {
          recordId,
          question: {
            type: { in: ['FILL', 'SHORT'] },
          },
        },
        include: {
          question: true,
        },
      });

      for (const ans of subjectiveAnswers) {
        const finalScore = ans.aiScore || 0;
        await db.answer.update({
          where: { id: ans.id },
          data: {
            score: finalScore,
            isCorrect: finalScore >= ans.question.score,
          },
        });
      }

      // 重算并更新整卷总得分与状态为 GRADED
      const allAnswers = await db.answer.findMany({
        where: { recordId },
      });
      const totalScore = allAnswers.reduce((sum, ans) => sum + ans.score, 0);

      await db.examRecord.update({
        where: { id: recordId },
        data: {
          score: totalScore,
          status: 'GRADED',
          gradedAt: new Date(),
        },
      });
      console.log(`[AI 阅卷引擎] 自主训练答卷 [${recordId}] 自动出分并发布成功！总分: ${totalScore}`);
    }

    return true;
  } catch (globalErr) {
    console.error(`[AI 阅卷引擎] 答卷 [${recordId}] 全局阅卷流程崩溃:`, globalErr);
    return false;
  }
}
