import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authPayload = getUserFromRequest(req);
    if (!authPayload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    const { userId } = authPayload;

    // 1. 获取该考生所有已阅卷答卷下的所有作答
    const answers = await db.answer.findMany({
      where: {
        record: {
          examineeId: userId,
          status: 'GRADED',
        },
      },
      include: {
        question: {
          include: {
            exam: { select: { title: true } },
            standard: { select: { title: true } },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // 2. 在内存中过滤出错题（实际得分小于题目满分，或者标记为不正确）
    const mistakes = answers
      .filter((ans) => {
        return !ans.isCorrect || ans.score < ans.question.score;
      })
      .map((ans) => {
        const q = ans.question;
        let parsedOptions = null;
        if (q.options) {
          try {
            parsedOptions = JSON.parse(q.options);
          } catch (e) {
            parsedOptions = q.options;
          }
        }

        return {
          id: ans.id,
          questionId: q.id,
          type: q.type,
          content: q.content,
          options: parsedOptions,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          knowledgePoint: q.knowledgePoint,
          examTitle: q.exam.title,
          standardTitle: q.standard?.title || '自主命题',
          // 考生当时作答和得分
          userAnswer: ans.answerContent,
          userScore: ans.score,
          questionScore: q.score,
          // AI 强化解析和教师批语
          aiComment: ans.aiComment,
          reviewerComment: ans.reviewerComment,
          answeredAt: ans.updatedAt,
        };
      });

    return NextResponse.json({
      success: true,
      mistakes,
    });

  } catch (error) {
    console.error('获取错题本失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取错题本失败' }, { status: 500 });
  }
}
