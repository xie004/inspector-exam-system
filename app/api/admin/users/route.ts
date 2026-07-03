import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import * as bcrypt from 'bcryptjs';

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

    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get('role');
    const deptFilter = searchParams.get('departmentId');

    // 构造查询条件
    const whereClause: any = {};
    if (roleFilter) whereClause.role = roleFilter;
    if (deptFilter) whereClause.departmentId = deptFilter;

    const users = await db.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        role: true,
        realName: true,
        employeeId: true,
        sectionName: true,
        departmentId: true,
        status: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取用户列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const { username, password, role, realName, employeeId, departmentId, sectionName, status } = await req.json();

    // 1. 必填参数校验
    if (!username || !password || !role || !realName || !employeeId) {
      return NextResponse.json(
        { error: '请填写用户名、密码、角色、真实姓名和工号' },
        { status: 400 }
      );
    }

    // 2. 校验角色合法性
    if (!['ADMIN', 'CREATOR', 'EXAMINEE'].includes(role)) {
      return NextResponse.json({ error: '无效的用户角色类型' }, { status: 400 });
    }

    // 3. 校验出题员和考生是否绑定了部门
    if ((role === 'CREATOR' || role === 'EXAMINEE') && !departmentId) {
      return NextResponse.json({ error: '部门出题员或考生必须绑定一个所属部门' }, { status: 400 });
    }

    // 4. 校验用户名唯一性
    const existingUser = await db.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }

    // 5. 校验工号唯一性
    const existingEmployee = await db.user.findUnique({
      where: { employeeId },
    });
    if (existingEmployee) {
      return NextResponse.json({ error: `工号 [${employeeId}] 已被注册使用` }, { status: 400 });
    }

    // 6. 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 7. 创建用户
    const newUser = await db.user.create({
      data: {
        username,
        passwordHash,
        role,
        realName,
        employeeId,
        departmentId: role === 'ADMIN' ? null : departmentId, // 管理员无需绑定部门
        sectionName: role === 'ADMIN' ? null : sectionName,
        status: status || 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: '用户创建成功',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        realName: newUser.realName,
        employeeId: newUser.employeeId,
      },
    });
  } catch (error) {
    console.error('管理员创建用户失败:', error);
    return NextResponse.json({ error: '服务器内部错误，创建用户失败' }, { status: 500 });
  }
}
