import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { username, password, realName, employeeId, departmentId, sectionName } = await req.json();

    // 1. 必填参数校验
    if (!username || !password || !realName || !employeeId || !departmentId) {
      return NextResponse.json(
        { error: '请填写所有必填字段（用户名、密码、姓名、工号、部门）' },
        { status: 400 }
      );
    }

    // 2. 校验用户名是否已存在
    const existingUser = await db.user.findUnique({
      where: { username },
    });
    if (existingUser) {
      return NextResponse.json({ error: '用户名已存在' }, { status: 400 });
    }

    // 3. 校验工号是否已存在 (工号唯一性约束)
    const existingEmployee = await db.user.findUnique({
      where: { employeeId },
    });
    if (existingEmployee) {
      return NextResponse.json(
        { error: `工号 [${employeeId}] 已被注册，请核对。如被冒用，请联系管理员。` },
        { status: 400 }
      );
    }

    // 4. 校验部门是否存在
    const department = await db.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      return NextResponse.json({ error: '所选部门不存在' }, { status: 400 });
    }

    // 5. 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 6. 创建普通考试用户
    const newUser = await db.user.create({
      data: {
        username,
        passwordHash,
        role: 'EXAMINEE', // 考生自主注册的角色统一为 EXAMINEE
        realName,
        employeeId,
        sectionName,
        departmentId,
        status: 'ACTIVE', // 根据用户要求，注册即激活，无需审核
      },
    });

    return NextResponse.json({
      success: true,
      message: '注册成功',
      user: {
        id: newUser.id,
        username: newUser.username,
        realName: newUser.realName,
        employeeId: newUser.employeeId,
      },
    });
  } catch (error) {
    console.error('用户注册失败:', error);
    return NextResponse.json({ error: '服务器内部错误，注册失败' }, { status: 500 });
  }
}
