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
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可执行此操作' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterDeptId = searchParams.get('departmentId');

    // 数据隔离：出题员只能查看本部门的试卷；管理员可以看全部或筛选
    const whereClause: any = {};
    if (authPayload.role === 'CREATOR') {
      whereClause.departmentId = authPayload.departmentId;
    } else if (authPayload.role === 'ADMIN' && filterDeptId) {
      whereClause.departmentId = filterDeptId;
    }

    const exams = await db.exam.findMany({
      where: whereClause,
      include: {
        department: { select: { name: true } },
        standard: { select: { title: true } },
        _count: { select: { questions: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formatted = exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      timeLimit: exam.timeLimit,
      standardId: exam.standardId,
      standardTitle: exam.standard?.title || '非标自主命题',
      departmentId: exam.departmentId,
      departmentName: exam.department.name,
      questionCount: exam._count.questions,
      status: exam.status,
      progress: exam.progress,
      errorMsg: exam.errorMsg,
      createdAt: exam.createdAt,
    }));

    return NextResponse.json({
      success: true,
      exams: formatted,
    });
  } catch (error) {
    console.error('获取试卷列表失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取试卷列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可执行此操作' }, { status: 403 });
    }

    const { id: examId, title, standardId, timeLimit, questions } = await req.json();

    // 1. 参数校验
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: '请填写试卷标题' }, { status: 400 });
    }

    const duplicateExam = await db.exam.findFirst({
      where: {
        title: title.trim(),
        NOT: examId ? { id: examId } : undefined,
      },
    });
    if (duplicateExam) {
      return NextResponse.json({ error: '试卷标题已存在，请使用其他名称' }, { status: 400 });
    }
    if (!timeLimit || timeLimit <= 0) {
      return NextResponse.json({ error: '考试时长必须大于 0 分钟' }, { status: 400 });
    }
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: '试卷必须包含至少一道题目' }, { status: 400 });
    }

    // 2. 部门归属判定与防越权校验
    let departmentId = authPayload.departmentId;
    if (authPayload.role === 'ADMIN') {
      const firstDept = await db.department.findFirst();
      departmentId = formDataDeptId(questions, firstDept?.id);
    }

    // 提取自定义管理员所分配的部门 ID
    function formDataDeptId(qs: any[], defaultId?: string) {
      return qs[0]?.departmentId || defaultId || '';
    }

    if (!departmentId) {
      return NextResponse.json({ error: '所属部门配置错误，无法保存试卷' }, { status: 400 });
    }

    // 3. 校验标准关联合法性
    if (standardId) {
      const standard = await db.standard.findUnique({ where: { id: standardId } });
      if (!standard) return NextResponse.json({ error: '关联的产品标准文献不存在' }, { status: 400 });
    }

    let savedExam;

    if (examId) {
      // 原子事务：更新现有试卷并重建相关问题
      savedExam = await db.$transaction(async (tx) => {
        await tx.question.deleteMany({
          where: { examId },
        });

        const updated = await tx.exam.update({
          where: { id: examId },
          data: {
            title: title.trim(),
            timeLimit: parseInt(timeLimit.toString(), 10),
            standardId: standardId || null,
            status: 'COMPLETED',
            progress: '',
            errorMsg: null,
            questions: {
              create: questions.map((q: any) => ({
                type: q.type,
                content: q.content.trim(),
                options: q.options ? JSON.stringify(q.options) : null,
                correctAnswer: q.correctAnswer.toString().trim(),
                score: parseFloat(q.score.toString()) || 2.0,
                explanation: q.explanation ? q.explanation.trim() : null,
                knowledgePoint: (q.knowledgePoint || '未分类条款').trim(),
                standardId: standardId || null,
              })),
            },
          },
          include: {
            _count: { select: { questions: true } },
          },
        });
        return updated;
      });
    } else {
      // 创建全新的试卷
      savedExam = await db.exam.create({
        data: {
          title: title.trim(),
          departmentId,
          standardId: standardId || null,
          timeLimit: parseInt(timeLimit.toString(), 10),
          status: 'COMPLETED',
          progress: '',
          questions: {
            create: questions.map((q: any) => ({
              type: q.type,
              content: q.content.trim(),
              options: q.options ? JSON.stringify(q.options) : null,
              correctAnswer: q.correctAnswer.toString().trim(),
              score: parseFloat(q.score.toString()) || 2.0,
              explanation: q.explanation ? q.explanation.trim() : null,
              knowledgePoint: (q.knowledgePoint || '未分类条款').trim(),
              standardId: standardId || null,
            })),
          },
        },
        include: {
          _count: { select: { questions: true } },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: '试卷保存成功！已安全同步录入相关题库。',
      exam: {
        id: savedExam.id,
        title: savedExam.title,
        questionCount: savedExam._count.questions,
      },
    });
  } catch (error) {
    console.error('保存试卷失败:', error);
    return NextResponse.json({ error: '服务器内部错误，保存试卷失败' }, { status: 500 });
  }
}
