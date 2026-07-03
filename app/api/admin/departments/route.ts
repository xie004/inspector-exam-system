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

export async function GET(req: NextRequest) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    // 查询部门列表，并统计各表关联数量
    const departments = await db.department.findMany({
      include: {
        _count: {
          select: {
            users: true,
            standards: true,
            exams: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 格式化输出，将 _count 扁平化便于前端处理
    const formatted = departments.map((dep) => ({
      id: dep.id,
      name: dep.name,
      userCount: dep._count.users,
      standardCount: dep._count.standards,
      examCount: dep._count.exams,
      createdAt: dep.createdAt,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('获取部门管理列表失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取部门列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const { name } = await req.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: '部门名称不能为空' }, { status: 400 });
    }

    // 校验重名
    const existing = await db.department.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: '该部门名称已存在' }, { status: 400 });
    }

    const newDepartment = await db.department.create({
      data: { name: name.trim() },
    });

    return NextResponse.json({
      success: true,
      message: '部门创建成功',
      department: newDepartment,
    });
  } catch (error) {
    console.error('创建部门失败:', error);
    return NextResponse.json({ error: '服务器内部错误，创建部门失败' }, { status: 500 });
  }
}
