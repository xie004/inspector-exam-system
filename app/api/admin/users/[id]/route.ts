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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminPayload = checkAdmin(req);
    if (!adminPayload) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const { id } = await params;
    const data = await req.json();
    const { username, password, role, realName, employeeId, departmentId, sectionName, status } = data;

    // 1. 检查用户是否存在
    const user = await db.user.findUnique({
      where: { id },
    });
    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 2. 防止管理员把自己禁用或修改自己的角色
    if (user.id === adminPayload.userId && (status === 'DISABLED' || role !== 'ADMIN')) {
      return NextResponse.json({ error: '您无法禁用自己或修改自己的管理员角色' }, { status: 400 });
    }

    // 3. 构造更新数据对象
    const updateData: any = {};
    if (realName) updateData.realName = realName;
    if (status) updateData.status = status;
    if (sectionName !== undefined) updateData.sectionName = sectionName;

    // 如果修改了用户名，校验冲突
    if (username && username !== user.username) {
      const exist = await db.user.findUnique({ where: { username } });
      if (exist) return NextResponse.json({ error: '用户名已被占用' }, { status: 400 });
      updateData.username = username;
    }

    // 如果修改了工号，校验冲突
    if (employeeId && employeeId !== user.employeeId) {
      const exist = await db.user.findUnique({ where: { employeeId } });
      if (exist) return NextResponse.json({ error: '工号已被占用' }, { status: 400 });
      updateData.employeeId = employeeId;
    }

    // 如果修改了密码
    if (password && password.trim() !== '') {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    // 如果修改了角色
    if (role) {
      if (!['ADMIN', 'CREATOR', 'EXAMINEE'].includes(role)) {
        return NextResponse.json({ error: '无效的用户角色类型' }, { status: 400 });
      }
      updateData.role = role;
      
      // 如果角色变更为 ADMIN，清空部门绑定，否则绑定传入的部门
      if (role === 'ADMIN') {
        updateData.departmentId = null;
        updateData.sectionName = null;
      } else {
        if (!departmentId) {
          return NextResponse.json({ error: '出题员或考生必须绑定一个所属部门' }, { status: 400 });
        }
        updateData.departmentId = departmentId;
      }
    } else if (departmentId && role !== 'ADMIN') {
      // 仅更新部门
      updateData.departmentId = departmentId;
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        realName: true,
        employeeId: true,
        sectionName: true,
        departmentId: true,
        status: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: '用户信息更新成功',
      user: updatedUser,
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return NextResponse.json({ error: '服务器内部错误，更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminPayload = checkAdmin(req);
    if (!adminPayload) {
      return NextResponse.json({ error: '权限不足，仅系统管理员可执行此操作' }, { status: 403 });
    }

    const { id } = await params;

    // 1. 检查目标用户是否存在
    const user = await db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            examRecords: true,
            reviewedRecords: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: '目标用户不存在' }, { status: 404 });
    }

    // 2. 防止管理员删除自己
    if (user.id === adminPayload.userId) {
      return NextResponse.json({ error: '安全拦截：您无法删除当前登录的管理员账号' }, { status: 400 });
    }

    // 3. 考务合规审计安全线：如果用户有考试/阅卷记录，拒绝物理删除，转为禁用
    const hasHistory = user._count.examRecords > 0 || user._count.reviewedRecords > 0;
    if (hasHistory) {
      // 自动将其标记为禁用状态
      await db.user.update({
        where: { id },
        data: { status: 'DISABLED' },
      });
      return NextResponse.json({
        success: true,
        auditArchived: true,
        message: '合规提示：由于该用户存在历史考试成绩或阅卷记录，系统已安全保留其档案并自动将其账号设为『禁用』状态，防止其继续登入。',
      });
    }

    // 4. 若无任何关联数据，执行物理删除
    await db.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: '用户删除成功',
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ error: '服务器内部错误，删除用户失败' }, { status: 500 });
  }
}
