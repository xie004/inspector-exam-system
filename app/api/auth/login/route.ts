import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signToken } from '@/lib/auth';
import * as bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    // 1. 参数校验
    if (!username || !password) {
      return NextResponse.json({ error: '请输入用户名和密码' }, { status: 400 });
    }

    // 2. 查询用户
    const user = await db.user.findUnique({
      where: { username },
      include: { department: true },
    });

    if (!user) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 3. 校验状态
    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: '该账号已被禁用，请联系管理员' }, { status: 403 });
    }

    // 4. 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    // 5. 构造 JWT 载荷并签发 Token
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      realName: user.realName,
      employeeId: user.employeeId,
      departmentId: user.departmentId,
    };

    const token = signToken(payload);

    // 6. 构造响应，并在 Cookie 中写入 Token
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        realName: user.realName,
        employeeId: user.employeeId,
        department: user.department ? { id: user.department.id, name: user.department.name } : null,
      },
    });

    // 写入安全 Cookie
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true, // 防 XSS 攻击，脚本无法读取
      secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIE !== 'false', // 支持局域网 HTTP 部署
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 天有效期
    });

    return response;
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json({ error: '服务器内部错误，登录失败' }, { status: 500 });
  }
}
