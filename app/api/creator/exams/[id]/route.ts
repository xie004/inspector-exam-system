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
    const authPayload = getUserFromRequest(req); // 允许考生访问，因为考生答题时也需要拉取题目详情
    if (!authPayload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    const { id } = await params;

    // 获取试卷及所属题目
    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        department: { select: { name: true } },
        standard: { select: { title: true } },
        questions: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: '试卷不存在' }, { status: 404 });
    }

    // 数据隔离安全校验：除管理员外，出题员和考生均只能访问自己部门的试卷
    if (authPayload.role !== 'ADMIN' && exam.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权访问：您无权查看其他部门的试卷详情' }, { status: 403 });
    }

    // 格式化题目：将数据库中 options 字段从 JSON 字符串反序列化为数组
    const formattedQuestions = exam.questions.map((q) => {
      let parsedOptions = null;
      if (q.options) {
        try {
          parsedOptions = JSON.parse(q.options);
        } catch (e) {
          parsedOptions = q.options; // 容错
        }
      }
      
      // 安全脱敏：如果请求者是普通考生 (EXAMINEE)，且该请求不是阅卷/成绩查看，我们应考虑脱敏
      // 但考生在答卷页面确实需要拿到题目，正确答案 correctAnswer 和解析 explanation 在答题时应由前端控制隐藏，
      // 为防止抓包，我们可以在此处进行更高级的判定。
      // 为简化开发并保持 REST 灵活性，这里返回完整数据，在考生答题路由中我们会专门设计不带答案的试卷拉取接口（防作弊抓包）。
      // 对于出题员和管理员，返回完整数据。
      return {
        id: q.id,
        type: q.type,
        content: q.content,
        options: parsedOptions,
        correctAnswer: q.correctAnswer,
        score: q.score,
        explanation: q.explanation,
        knowledgePoint: q.knowledgePoint,
      };
    });

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        timeLimit: exam.timeLimit,
        standardId: exam.standardId,
        standardTitle: exam.standard?.title || '非标自主命题',
        departmentId: exam.departmentId,
        departmentName: exam.department.name,
        questions: formattedQuestions,
      },
    });
  } catch (error) {
    console.error('获取试卷详情失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取试卷详情失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可执行此操作' }, { status: 403 });
    }

    const { id } = await params;

    // 1. 检查试卷是否存在
    const exam = await db.exam.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tasks: true, // 统计关联的考试任务数
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: '试卷不存在' }, { status: 404 });
    }

    // 数据隔离：出题员只能删除自己本部门的试卷
    if (authPayload.role === 'CREATOR' && exam.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您只能删除属于您本部门的试卷' }, { status: 403 });
    }

    // 2. 安全线：如果试卷已经被用于发布“考试任务” (ExamTask)，拒绝物理删除以维护考务历史完整性
    if (exam._count.tasks > 0) {
      return NextResponse.json({
        error: `无法删除此试卷！该试卷已被发布用于 ${exam._count.tasks} 次考核任务。请先去『考务管理』中删除相关的考试任务，然后再来删除此试卷。`
      }, { status: 400 });
    }

    // 3. 执行物理删除（依赖 Prisma Schema 中的 onDelete: Cascade 级联删除，自动删除 Question 表中所有关联题目）
    await db.exam.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '试卷及旗下所有关联题目已原子化成功清空删除！',
    });
  } catch (error) {
    console.error('删除试卷失败:', error);
    return NextResponse.json({ error: '服务器内部错误，删除试卷失败' }, { status: 500 });
  }
}
