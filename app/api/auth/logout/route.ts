import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = NextResponse.json({
      success: true,
      message: '退出登录成功',
    });

    // 强制清除 Cookie
    response.cookies.set({
      name: 'auth_token',
      value: '',
      httpOnly: true,
      path: '/',
      maxAge: 0, // 立即过期
    });

    return response;
  } catch (error) {
    console.error('退出登录失败:', error);
    return NextResponse.json({ error: '服务器内部错误，退出登录失败' }, { status: 500 });
  }
}
