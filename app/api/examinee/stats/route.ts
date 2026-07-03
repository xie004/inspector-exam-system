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

    // 1. 获取该考生所有已阅卷 (GRADED) 的答卷记录，同时关联任务和试卷及其题目
    const records = await db.examRecord.findMany({
      where: {
        examineeId: userId,
        status: 'GRADED',
      },
      include: {
        task: {
          include: {
            exam: {
              include: {
                questions: { select: { score: true } },
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'asc', // 按交卷时间升序，方便绘制趋势折线图
      },
    });

    if (records.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { averageScore: 0, passRate: 0, maxScore: 0, minScore: 0, totalExams: 0 },
        trend: [],
        mastery: [],
      });
    }

    // 2. 统计计算基本指标
    let totalScore = 0;
    let passCount = 0;
    let maxScore = 0;
    let minScore = records[0]?.score || 0;

    const trend = records.map((r) => {
      const score = r.score;
      totalScore += score;
      if (score > maxScore) maxScore = score;
      if (score < minScore) minScore = score;

      // 计算试卷满分
      const examFullScore = r.task.exam.questions.reduce((sum, q) => sum + q.score, 0);
      const scoreRate = examFullScore > 0 ? score / examFullScore : 0;

      // 得分率 >= 60% 算及格
      if (scoreRate >= 0.6) {
        passCount++;
      }

      return {
        id: r.id,
        examTitle: r.task.exam.title,
        taskTitle: r.task.title,
        score: score,
        fullScore: examFullScore,
        submittedAt: r.submittedAt,
      };
    });

    const totalCount = records.length;
    const averageScore = parseFloat((totalScore / totalCount).toFixed(1));
    const passRate = parseFloat(((passCount / totalCount) * 100).toFixed(1));

    // 3. 计算个人标准条款/知识点掌握度 (聚合雷达图数据)
    const allAnswers = await db.answer.findMany({
      where: {
        record: {
          examineeId: userId,
          status: 'GRADED',
        },
      },
      include: {
        question: true,
      },
    });

    const knowledgeStats: Record<string, {
      knowledgePoint: string;
      totalFullScore: number;
      totalGotScore: number;
    }> = {};

    allAnswers.forEach((ans) => {
      const kp = ans.question.knowledgePoint || '未分类条款';
      const maxScore = ans.question.score;
      const gotScore = ans.score;

      if (!knowledgeStats[kp]) {
        knowledgeStats[kp] = {
          knowledgePoint: kp,
          totalFullScore: 0,
          totalGotScore: 0,
        };
      }

      const kStats = knowledgeStats[kp];
      kStats.totalFullScore += maxScore;
      kStats.totalGotScore += gotScore;
    });

    const mastery = Object.values(knowledgeStats)
      .map((ks) => ({
        subject: ks.knowledgePoint,
        A: parseFloat(((ks.totalGotScore / ks.totalFullScore) * 100).toFixed(1)),
        fullMark: 100,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));

    return NextResponse.json({
      success: true,
      summary: {
        averageScore,
        passRate,
        maxScore,
        minScore,
        totalExams: totalCount,
      },
      trend,
      mastery,
    });

  } catch (error) {
    console.error('获取个人成绩统计失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取个人成绩统计失败' }, { status: 500 });
  }
}
