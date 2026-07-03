import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { runAiPreGrading } from '@/lib/ai-grader';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authPayload = getUserFromRequest(req);
    if (!authPayload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    const { userId } = authPayload;
    const { id } = await params;
    const { answers, submit } = await req.json(); // answers: Array of { questionId, answerContent }

    // 1. 检查答卷记录是否存在并属于当前考生
    const record = await db.examRecord.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            exam: true,
          },
        },
      },
    });

    if (!record || record.examineeId !== userId) {
      return NextResponse.json({ error: '答卷记录不存在或无权操作' }, { status: 404 });
    }

    if (record.status !== 'ONGOING') {
      return NextResponse.json({ error: '该考卷已提交或已阅卷，无法修改答案' }, { status: 400 });
    }

    const now = new Date();
    
    // 2. 超时安全防护机制
    const elapsedMs = now.getTime() - new Date(record.startedAt).getTime();
    const limitMs = record.task.timeLimit * 60 * 1000;
    
    // 给予 2 分钟的合理网络波动和系统延迟宽限期，超过宽限期则强制执行交卷
    const isTimeExpired = elapsedMs > (limitMs + 120 * 1000);
    const finalSubmit = (submit || isTimeExpired) ? true : false;

    // 3. 循环保存作答内容 (自动暂存流程)
    if (answers && Array.isArray(answers)) {
      for (const item of answers) {
        const existingAns = await db.answer.findFirst({
          where: {
            recordId: id,
            questionId: item.questionId,
          },
        });

        const cleanAnswer = item.answerContent ? item.answerContent.toString() : '';

        if (existingAns) {
          await db.answer.update({
            where: { id: existingAns.id },
            data: {
              answerContent: cleanAnswer,
            },
          });
        } else {
          await db.answer.create({
            data: {
              recordId: id,
              questionId: item.questionId,
              answerContent: cleanAnswer,
              score: 0,
              isCorrect: false,
            },
          });
        }
      }
    }

    // 4. 如果仅是暂存，直接返回成功，不进行判分
    if (!finalSubmit) {
      return NextResponse.json({
        success: true,
        message: '作答已自动安全暂存至系统云端。',
      });
    }

    // =========================================================================
    // ======================== 开启正式收卷与评分流程 ========================
    // =========================================================================
    console.log(`[交卷系统] 正在为答卷 [${id}] 进行收卷评分...`);

    // 获取试卷的所有题目
    const questions = await db.question.findMany({
      where: { examId: record.task.exam.id },
    });

    let objectiveScore = 0;
    let hasSubjective = false;

    // 逐题判定客观题得分
    for (const q of questions) {
      // 获取考生的这道题作答
      const ans = await db.answer.findFirst({
        where: {
          recordId: id,
          questionId: q.id,
        },
      });

      const ansContent = ans ? ans.answerContent.trim() : '';
      const isObjective = ['SINGLE', 'MULTIPLE', 'JUDGE'].includes(q.type);

      if (isObjective) {
        let isCorrect = false;
        
        if (q.type === 'SINGLE' || q.type === 'JUDGE') {
          // 单选和判断忽略大小写匹配
          isCorrect = ansContent.toUpperCase() === q.correctAnswer.trim().toUpperCase();
        } else if (q.type === 'MULTIPLE') {
          // 多选题字母排序归一化比对算法 (兼容乱序选择)
          const normAns = ansContent.split(',')
            .map(s => s.trim().toUpperCase())
            .filter(s => s !== '')
            .sort()
            .join(',');

          const normCorrect = q.correctAnswer.split(',')
            .map(s => s.trim().toUpperCase())
            .filter(s => s !== '')
            .sort()
            .join(',');

          isCorrect = (normAns === normCorrect) && normAns !== '';
        }

        const score = isCorrect ? q.score : 0;
        objectiveScore += score;

        // 更新这道客观题的判定分数和对错状态
        if (ans) {
          await db.answer.update({
            where: { id: ans.id },
            data: { score, isCorrect },
          });
        } else {
          // 如果考生没做这道题，自动补齐一条 0 分记录
          await db.answer.create({
            data: {
              recordId: id,
              questionId: q.id,
              answerContent: '',
              score: 0,
              isCorrect: false,
            },
          });
        }
      } else {
        // 发现主观题，标记为待阅卷
        hasSubjective = true;
        
        // 保证主观题在 Answer 表中一定存在记录，方便后续 AI 和人工批阅
        if (!ans) {
          await db.answer.create({
            data: {
              recordId: id,
              questionId: q.id,
              answerContent: '',
              score: 0,
              isCorrect: false,
            },
          });
        }
      }
    }

    // 5. 更新答卷记录的最终状态与客观题得分
    const updatedStatus = hasSubjective ? 'SUBMITTED' : 'GRADED';
    
    const updatedRecord = await db.examRecord.update({
      where: { id },
      data: {
        score: objectiveScore, // 初始分数为客观题得分之和
        status: updatedStatus,
        submittedAt: now,
        gradedAt: hasSubjective ? null : now, // 若无主观题，直接发布成绩
      },
    });

    // 6. 核心高阶设计：如果存在主观题，立即触发后台异步 AI 智能阅卷 (非阻塞，极速返回前端)
    if (hasSubjective) {
      // 触发后台异步 promise，不加 await，大模型网络请求由后台静默完成
      runAiPreGrading(id).then((success) => {
        console.log(`[AI 自动阅卷] 答卷 [${id}] 后台评分流程执行完毕，结果: ${success}`);
      });
    }

    return NextResponse.json({
      success: true,
      submitted: true,
      status: updatedStatus,
      score: objectiveScore,
      hasSubjective,
      message: hasSubjective
        ? '交卷成功！客观题已由系统自动判分。由于本卷包含简答/填空主观题，系统已启动 AI 智能判卷，稍后将由出题员复核后发布最终成绩。'
        : `交卷成功！系统已自动完成全卷判分，您的最终考核成绩为: [${objectiveScore}] 分。`,
    });

  } catch (error) {
    console.error('交卷或暂存失败:', error);
    return NextResponse.json({ error: '服务器内部错误，交卷处理失败' }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authPayload = getUserFromRequest(req);
    if (!authPayload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    const { userId } = authPayload;
    const { id } = await params;

    // 获取答卷记录，包含题目、答案以及标准信息
    const record = await db.examRecord.findUnique({
      where: { id },
      include: {
        task: {
          include: {
            exam: {
              include: {
                questions: {
                  orderBy: { createdAt: 'asc' },
                  include: {
                    standard: {
                      select: { title: true }
                    }
                  }
                }
              }
            }
          }
        },
        answers: true
      }
    });

    if (!record || record.examineeId !== userId) {
      return NextResponse.json({ error: '答卷记录不存在或无权查看' }, { status: 404 });
    }

    // 格式化输出数据
    const questions = record.task.exam.questions.map((q) => {
      const ans = record.answers.find((a) => a.questionId === q.id);
      let parsedOptions = null;
      if (q.options) {
        try {
          parsedOptions = JSON.parse(q.options);
        } catch (e) {
          parsedOptions = q.options;
        }
      }

      // 如果仍在进行中，进行防作弊脱敏
      const isOngoing = record.status === 'ONGOING';

      return {
        id: q.id,
        type: q.type,
        content: q.content,
        options: parsedOptions,
        score: q.score,
        knowledgePoint: q.knowledgePoint,
        standardTitle: q.standard?.title || '自主命题',
        // 考生作答
        userAnswer: ans ? ans.answerContent : '',
        userScore: ans ? ans.score : 0,
        isCorrect: ans ? ans.isCorrect : false,
        aiScore: isOngoing ? null : (ans ? ans.aiScore : null),
        aiComment: isOngoing ? null : (ans ? ans.aiComment : null),
        reviewerComment: isOngoing ? null : (ans ? ans.reviewerComment : null),
        // 参考答案和解析 (进行中则屏蔽)
        correctAnswer: isOngoing ? undefined : q.correctAnswer,
        explanation: isOngoing ? undefined : q.explanation,
      };
    });

    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        taskId: record.taskId,
        taskTitle: record.task.title,
        examTitle: record.task.exam.title,
        status: record.status,
        score: record.score,
        startedAt: record.startedAt,
        submittedAt: record.submittedAt,
        gradedAt: record.gradedAt,
        questions,
      }
    });

  } catch (error) {
    console.error('获取答卷详情失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取答卷详情失败' }, { status: 500 });
  }
}
