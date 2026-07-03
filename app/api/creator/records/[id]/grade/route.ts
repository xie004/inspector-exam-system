import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

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
    const authPayload = getUserFromRequest(req); // 允许普通考生获取自己的答卷详情以查看成绩分析
    if (!authPayload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    const { id } = await params;

    // 查询答卷记录，包含考生详情、考试任务详情、以及所有的作答记录和题目详情
    const record = await db.examRecord.findUnique({
      where: { id },
      include: {
        examinee: {
          select: {
            realName: true,
            employeeId: true,
            sectionName: true,
            department: { select: { name: true } },
          },
        },
        task: {
          include: {
            exam: { select: { title: true, timeLimit: true } },
          },
        },
        answers: {
          include: {
            question: true,
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: '找不到指定的答卷记录' }, { status: 404 });
    }

    // 数据隔离保护：出题员和考生只能访问属于自己部门/自己本人的答卷
    if (authPayload.role === 'CREATOR' && record.task.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权访问：您无权查看其他部门考生的答卷详情' }, { status: 403 });
    }
    if (authPayload.role === 'EXAMINEE' && record.examineeId !== authPayload.userId) {
      return NextResponse.json({ error: '越权访问：您无权查看其他考生的答卷详情' }, { status: 403 });
    }

    // 格式化输出，对 choices 选项进行 JSON 反序列化
    const formattedAnswers = record.answers.map((ans) => {
      let parsedOptions = null;
      if (ans.question.options) {
        try {
          parsedOptions = JSON.parse(ans.question.options);
        } catch (e) {
          parsedOptions = ans.question.options;
        }
      }

      return {
        id: ans.id,
        questionId: ans.questionId,
        type: ans.question.type,
        content: ans.question.content,
        options: parsedOptions,
        correctAnswer: ans.question.correctAnswer,
        explanation: ans.question.explanation,
        knowledgePoint: ans.question.knowledgePoint,
        maxScore: ans.question.score,
        
        // 考生作答
        answerContent: ans.answerContent,
        score: ans.score,
        isCorrect: ans.isCorrect,
        
        // AI 预阅卷结果
        aiScore: ans.aiScore,
        aiComment: ans.aiComment,
        
        // 考务人员手动复核结果
        reviewerComment: ans.reviewerComment,
      };
    });

    return NextResponse.json({
      success: true,
      record: {
        id: record.id,
        taskId: record.taskId,
        taskTitle: record.task.title,
        examTitle: record.task.exam.title,
        timeLimit: record.task.exam.timeLimit,
        score: record.score,
        status: record.status,
        startedAt: record.startedAt,
        submittedAt: record.submittedAt,
        gradedAt: record.gradedAt,
        examinee: {
          id: record.examineeId,
          realName: record.examinee.realName,
          employeeId: record.examinee.employeeId,
          sectionName: record.examinee.sectionName || '未分配科室',
          departmentName: record.examinee.department?.name || '未知部门',
        },
        answers: formattedAnswers,
      },
    });
  } catch (error) {
    console.error('获取答卷详情失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取答卷详情失败' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可进行批改阅卷' }, { status: 403 });
    }

    const { id } = await params;
    const { answers } = await req.json(); // 格式: Array of { answerId, score, reviewerComment }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: '批改结果不能为空' }, { status: 400 });
    }

    // 1. 检查答卷是否存在
    const record = await db.examRecord.findUnique({
      where: { id },
      include: {
        task: { select: { departmentId: true } },
      },
    });

    if (!record) {
      return NextResponse.json({ error: '答卷记录不存在' }, { status: 404 });
    }

    // 数据隔离：出题员只能批改本部门发布的考核任务
    if (authPayload.role === 'CREATOR' && record.task.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您只能批改属于本部门的考卷' }, { status: 403 });
    }

    // 2. 事务更新：循环处理每个题目的得分更新
    // 使用 for 循环在单个请求中对每一条作答记录进行精确更新与校验
    for (const item of answers) {
      const dbAnswer = await db.answer.findUnique({
        where: { id: item.answerId },
        include: { question: true },
      });

      if (!dbAnswer || dbAnswer.recordId !== id) {
        return NextResponse.json({ error: `题目作答记录 [${item.answerId}] 不存在或与本试卷不匹配` }, { status: 400 });
      }

      const finalScore = parseFloat(item.score.toString());
      if (isNaN(finalScore) || finalScore < 0) {
        return NextResponse.json({ error: `题目 [${dbAnswer.question.content.substring(0, 10)}...] 的得分不合法` }, { status: 400 });
      }

      // 安全卡口：打分不能超过该题最大分值
      if (finalScore > dbAnswer.question.score) {
        return NextResponse.json({
          error: `越界警告：题目 [${dbAnswer.question.content.substring(0, 10)}...] 的打分 [${finalScore}] 超过了该题满分分值 [${dbAnswer.question.score}]！`
        }, { status: 400 });
      }

      // 更新单题作答记录
      await db.answer.update({
        where: { id: item.answerId },
        data: {
          score: finalScore,
          reviewerComment: item.reviewerComment ? item.reviewerComment.trim() : null,
          // 评分达到满分，逻辑上判定为 Correct
          isCorrect: finalScore >= dbAnswer.question.score,
        },
      });
    }

    // 3. 重算整张试卷的总分并更新答卷状态为已阅卷 (GRADED)
    const allAnswers = await db.answer.findMany({
      where: { recordId: id },
    });

    const totalScore = allAnswers.reduce((sum, ans) => sum + ans.score, 0);

    const updatedRecord = await db.examRecord.update({
      where: { id },
      data: {
        score: totalScore,
        status: 'GRADED',
        gradedAt: new Date(),
        reviewerId: authPayload.userId,
      },
    });

    return NextResponse.json({
      success: true,
      message: '试卷手工阅卷批改成功！成绩已成功对外发布。',
      record: {
        id: updatedRecord.id,
        score: updatedRecord.score,
        status: updatedRecord.status,
        gradedAt: updatedRecord.gradedAt,
      },
    });

  } catch (error) {
    console.error('保存阅卷结果失败:', error);
    return NextResponse.json({ error: '服务器内部错误，保存阅卷结果失败' }, { status: 500 });
  }
}
