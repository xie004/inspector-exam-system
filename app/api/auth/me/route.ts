import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const payload = getUserFromRequest(req);

    if (!payload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    // 从数据库重新获取最新信息，防止本地 Token 数据滞后
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        role: true,
        realName: true,
        employeeId: true,
        sectionName: true,
        departmentId: true,
        status: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('获取个人信息失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
