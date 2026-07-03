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

    // 1. 获取目标答卷记录
    const record = await db.examRecord.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            departmentId: true,
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ error: '指定的答卷记录不存在' }, { status: 404 });
    }

    // 数据隔离保护：如果是出题员，只能删除属于其本部门任务的答卷
    if (authPayload.role === 'CREATOR' && record.task.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您无权删除其他部门的答卷记录' }, { status: 403 });
    }

    // 2. 执行物理删除
    // 由于 schema.prisma 中 Answer.recordId 关联有 onDelete: Cascade
    // 相应的考生单题作答记录 (Answer 表) 将被数据库级联自动删除，保障数据参照完整性
    await db.examRecord.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '该考生的答卷记录及全部单题作答详情已成功从系统清除！',
    });
  } catch (error) {
    console.error('删除答卷记录失败:', error);
    return NextResponse.json({ error: '服务器内部错误，删除答卷记录失败' }, { status: 500 });
  }
}
