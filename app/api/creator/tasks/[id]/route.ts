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

    // 1. 获取目标考试任务
    const task = await db.examTask.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            records: true, // 统计考生的答卷记录数
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: '指定的考试任务不存在' }, { status: 404 });
    }

    // 数据隔离保护
    if (authPayload.role === 'CREATOR' && task.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您无权删除其他部门的考试任务' }, { status: 403 });
    }

    // 2. 考务数据安全线：如果已经有考生参与（答卷记录数 > 0），强行拒绝删除，维护考试成绩安全
    if (task._count.records > 0) {
      return NextResponse.json({
        error: `安全拦截：此考试任务已有 ${task._count.records} 名考生参与并留存了考试答卷。为了保障考生成绩及答题历史的真实完整，系统已拒绝物理删除此任务。`
      }, { status: 400 });
    }

    // 3. 安全执行删除
    await db.examTask.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '考试任务已成功彻底删除！',
    });
  } catch (error) {
    console.error('删除考试任务失败:', error);
    return NextResponse.json({ error: '服务器内部错误，删除任务失败' }, { status: 500 });
  }
}
