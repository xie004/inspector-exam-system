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

export async function GET(req: NextRequest) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可查看统计分析' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterDeptId = searchParams.get('departmentId');

    // 数据隔离：出题员只看自己部门的统计；管理员可以看全部或筛选
    let targetDeptId = '';
    if (authPayload.role === 'CREATOR') {
      targetDeptId = authPayload.departmentId || '';
    } else if (authPayload.role === 'ADMIN') {
      targetDeptId = filterDeptId || '';
    }

    if (!targetDeptId) {
      // 如果管理员未指定部门，我们默认选择第一个部门以展示数据，避免空白
      const firstDept = await db.department.findFirst();
      targetDeptId = firstDept?.id || '';
    }

    if (!targetDeptId) {
      return NextResponse.json({
        success: true,
        summary: { averageScore: 0, passRate: 0, maxScore: 0, minScore: 0, totalExams: 0 },
        distribution: [],
        topErrors: [],
        mastery: [],
      });
    }

    const filterType = searchParams.get('type'); // "EXAM" | "TRAINING"

    // 1. 获取该部门所有已阅卷 (GRADED) 的答卷记录，同时关联任务和试卷
    const recordsWhereClause: any = {
      status: 'GRADED',
      task: { departmentId: targetDeptId },
    };
    if (filterType) {
      recordsWhereClause.task.type = filterType;
    }

    const records = await db.examRecord.findMany({
      where: recordsWhereClause,
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
    });

    // 如果没有任何阅卷记录，直接返回空模版，防止除以零的数学错误
    if (records.length === 0) {
      return NextResponse.json({
        success: true,
        summary: { averageScore: 0, passRate: 0, maxScore: 0, minScore: 0, totalExams: 0 },
        distribution: [
          { name: '不及格(<60%)', value: 0 },
          { name: '及格(60-70%)', value: 0 },
          { name: '中等(70-80%)', value: 0 },
          { name: '良好(80-90%)', value: 0 },
          { name: '优秀(90-100%)', value: 0 },
        ],
        topErrors: [],
        mastery: [],
      });
    }

    // 2. 统计计算基本指标（平均分、合格率、最高分、最低分）
    let totalScore = 0;
    let passCount = 0;
    let maxScore = 0;
    let minScore = records[0]?.score || 0;
    
    // 直方图五个区间的计数器
    let rangeFail = 0; // < 60%
    let rangePass = 0; // 60% - 70%
    let rangeMid = 0;  // 70% - 80%
    let rangeGood = 0; // 80% - 90%
    let rangeExcellent = 0; // 90% - 100%

    records.forEach((r) => {
      const score = r.score;
      totalScore += score;
      if (score > maxScore) maxScore = score;
      if (score < minScore) minScore = score;

      // 动态计算该试卷的总满分
      const examFullScore = r.task.exam.questions.reduce((sum, q) => sum + q.score, 0);
      const scoreRate = examFullScore > 0 ? score / examFullScore : 0;

      // 判定及格 (得分率 >= 60%)
      if (scoreRate >= 0.6) {
        passCount++;
      }

      // 归类区间直方图
      if (scoreRate < 0.6) rangeFail++;
      else if (scoreRate < 0.7) rangePass++;
      else if (scoreRate < 0.8) rangeMid++;
      else if (scoreRate < 0.9) rangeGood++;
      else rangeExcellent++;
    });

    const totalCount = records.length;
    const averageScore = parseFloat((totalScore / totalCount).toFixed(1));
    const passRate = parseFloat(((passCount / totalCount) * 100).toFixed(1));

    const distribution = [
      { name: '不及格(<60%)', value: rangeFail },
      { name: '及格(60-70%)', value: rangePass },
      { name: '中等(70-80%)', value: rangeMid },
      { name: '良好(80-90%)', value: rangeGood },
      { name: '优秀(90-100%)', value: rangeExcellent },
    ];

    // 3. 计算题目错题率排行榜
    const answersWhereClause: any = {
      record: {
        status: 'GRADED',
        task: { departmentId: targetDeptId },
      },
    };
    if (filterType) {
      answersWhereClause.record.task.type = filterType;
    }

    const allAnswers = await db.answer.findMany({
      where: answersWhereClause,
      include: {
        question: {
          include: {
            exam: { select: { title: true } },
            standard: { select: { title: true } },
          },
        },
      },
    });

    // 聚合统计：题目的错题率
    const questionStats: Record<string, {
      questionId: string;
      content: string;
      correctAnswer: string;
      examTitle: string;
      standardTitle: string;
      knowledgePoint: string;
      totalCount: number;
      errorCount: number;
    }> = {};

    allAnswers.forEach((ans) => {
      const q = ans.question;
      if (!questionStats[q.id]) {
        questionStats[q.id] = {
          questionId: q.id,
          content: q.content,
          correctAnswer: q.correctAnswer,
          examTitle: q.exam.title,
          standardTitle: q.standard?.title || '自主命题',
          knowledgePoint: q.knowledgePoint,
          totalCount: 0,
          errorCount: 0,
        };
      }
      
      const stats = questionStats[q.id];
      stats.totalCount++;
      // 如果单题得分小于满分，或者标记为错误，则计入错题统计
      if (!ans.isCorrect || ans.score < q.score) {
        stats.errorCount++;
      }
    });

    // 计算错题率并排序，取出前 10
    const topErrors = Object.values(questionStats)
      .map((qs) => ({
        id: qs.questionId,
        content: qs.content,
        correctAnswer: qs.correctAnswer,
        examTitle: qs.examTitle,
        standardTitle: qs.standardTitle,
        knowledgePoint: qs.knowledgePoint,
        errorRate: parseFloat(((qs.errorCount / qs.totalCount) * 100).toFixed(1)),
        totalCount: qs.totalCount,
        errorCount: qs.errorCount,
      }))
      .filter((qs) => qs.totalCount >= 1) // 至少有 1 人做过才算
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10);

    // 4. 计算标准条款/知识点整体掌握度 (聚合雷达图数据)
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

    // 计算掌握度 (实际得分 / 应得总分)
    const mastery = Object.values(knowledgeStats)
      .map((ks) => ({
        subject: ks.knowledgePoint, // Recharts Radar 默认使用 subject 字段
        A: parseFloat(((ks.totalGotScore / ks.totalFullScore) * 100).toFixed(1)), // A 字段表示百分比得分率
        fullMark: 100,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject)); // 按条款字母顺序排一下更美观

    return NextResponse.json({
      success: true,
      summary: {
        averageScore,
        passRate,
        maxScore,
        minScore,
        totalExams: records.length,
      },
      distribution,
      topErrors,
      mastery,
    });

  } catch (error) {
    console.error('计算考务统计失败:', error);
    return NextResponse.json({ error: '服务器内部错误，数据分析失败' }, { status: 500 });
  }
}
