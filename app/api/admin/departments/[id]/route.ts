import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// 校验是否为管理员
function checkAdmin(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload || payload.role !== 'ADMIN') {
    return null;
  }
  return payload;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const { id } = await params;
    const { name } = await req.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: '部门名称不能为空' }, { status: 400 });
    }

    // 检查修改的目标部门是否存在
    const target = await db.department.findUnique({
      where: { id },
    });
    if (!target) {
      return NextResponse.json({ error: '目标部门不存在' }, { status: 404 });
    }

    // 校验命名冲突（排除自己）
    const existing = await db.department.findFirst({
      where: {
        name: name.trim(),
        NOT: { id },
      },
    });
    if (existing) {
      return NextResponse.json({ error: '该部门名称已被其他部门占用' }, { status: 400 });
    }

    const updated = await db.department.update({
      where: { id },
      data: { name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: '部门名称更新成功',
      department: updated,
    });
  } catch (error) {
    console.error('更新部门失败:', error);
    return NextResponse.json({ error: '服务器内部错误，更新部门失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const { id } = await params;

    // 1. 检查目标部门是否存在
    const target = await db.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            standards: true,
            exams: true,
          },
        },
      },
    });

    if (!target) {
      return NextResponse.json({ error: '目标部门不存在' }, { status: 404 });
    }

    // 2. 安全防线：如果部门下有资产，拒绝删除
    const { users, standards, exams } = target._count;
    if (users > 0 || standards > 0 || exams > 0) {
      const reasons = [];
      if (users > 0) reasons.push(`${users} 个用户`);
      if (standards > 0) reasons.push(`${standards} 个产品标准`);
      if (exams > 0) reasons.push(`${exams} 套试卷`);
      
      return NextResponse.json(
        { 
          error: `无法删除该部门！该部门下仍绑定有: ${reasons.join('、')}。请先将这些内容转移或删除后再行尝试。` 
        }, 
        { status: 400 }
      );
    }

    // 3. 执行物理删除
    await db.department.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '部门删除成功',
    });
  } catch (error) {
    console.error('删除部门失败:', error);
    return NextResponse.json({ error: '服务器内部错误，删除部门失败' }, { status: 500 });
  }
}
