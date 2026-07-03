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
    const statusFilter = searchParams.get('status'); // "ONGOING" | "SUBMITTED" | "GRADED"
    const filterDeptId = searchParams.get('departmentId');

    // 数据隔离：出题员只能看自己部门考生的答卷；管理员可以看全部或筛选
    const whereClause: any = {};
    if (authPayload.role === 'CREATOR') {
      whereClause.task = {
        departmentId: authPayload.departmentId,
      };
    } else if (authPayload.role === 'ADMIN') {
      if (filterDeptId) {
        whereClause.task = { departmentId: filterDeptId };
      }
    }

    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    const records = await db.examRecord.findMany({
      where: whereClause,
      include: {
        examinee: {
          select: {
            realName: true,
            employeeId: true,
            sectionName: true,
          },
        },
        task: {
          select: {
            title: true,
            exam: { select: { title: true } },
          },
        },
        answers: {
          select: {
            aiScore: true,
            question: {
              select: {
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    const formatted = records.map((r) => {
      const subjectiveAnswers = r.answers.filter((ans) =>
        ['FILL', 'SHORT'].includes(ans.question.type)
      );
      const totalSubjective = subjectiveAnswers.length;
      const gradedSubjective = subjectiveAnswers.filter((ans) => ans.aiScore !== null).length;
      const aiProgress = totalSubjective > 0 ? `${gradedSubjective}/${totalSubjective}` : '1/1';

      return {
        id: r.id,
        taskId: r.taskId,
        taskTitle: r.task.title,
        examTitle: r.task.exam.title,
        examineeId: r.examineeId,
        examineeName: r.examinee.realName,
        examineeEmployeeId: r.examinee.employeeId,
        examineeSection: r.examinee.sectionName || '未分配科室',
        score: r.score,
        status: r.status, // "ONGOING" | "SUBMITTED" | "GRADED"
        startedAt: r.startedAt,
        submittedAt: r.submittedAt,
        gradedAt: r.gradedAt,
        aiProgress,
      };
    });

    return NextResponse.json({
      success: true,
      records: formatted,
    });
  } catch (error) {
    console.error('获取答卷列表失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取答卷列表失败' }, { status: 500 });
  }
}
