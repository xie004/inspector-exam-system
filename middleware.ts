import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 纯 JS 解析 JWT 载荷 (Edge Runtime 安全版，无需 Node 原生依赖)
function decodeJwt(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Base64url 转换为 Base64 格式
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = atob(base64);
    return JSON.parse(jsonStr);
  } catch (e) {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  let payload = null;
  if (token) {
    payload = decodeJwt(token);
    // 如果 token 已过期，视为未登录
    if (payload && payload.exp && Date.now() >= payload.exp * 1000) {
      payload = null;
    }
  }

  // 路由判定
  const isAdminRoute = pathname.startsWith('/admin');
  const isCreatorRoute = pathname.startsWith('/creator');
  const isExamineeRoute = pathname.startsWith('/examinee');
  const isAuthRoute = pathname === '/login' || pathname === '/register' || pathname === '/';

  if (pathname === '/' && !payload) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 1. 未登录拦截：访问受保护路由直接重定向到登录页
  if (isAdminRoute || isCreatorRoute || isExamineeRoute) {
    if (!payload) {
      const loginUrl = new URL('/login', request.url);
      // 如果不是访问根路由或登录页，可以通过 next 参数保留原目标，以便登录后跳转 (可选)
      return NextResponse.redirect(loginUrl);
    }

    const { role } = payload;

    // 2. 越权隔离与重定向
    // 管理员专用页面只能 ADMIN 访问
    if (isAdminRoute && role !== 'ADMIN') {
      return NextResponse.redirect(new URL(getDashboardPath(role), request.url));
    }
    // 出题员页面允许 CREATOR 访问，同时允许 ADMIN 访问 (代表管理员可代为管理内容)
    if (isCreatorRoute && role !== 'CREATOR' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL(getDashboardPath(role), request.url));
    }
    // 考生页面只允许 EXAMINEE 访问
    if (isExamineeRoute && role !== 'EXAMINEE') {
      return NextResponse.redirect(new URL(getDashboardPath(role), request.url));
    }
  }

  // 3. 已登录重定向：已登录用户访问登录、注册或根目录时，自动跳转到其控制台
  if (isAuthRoute && payload) {
    const { role } = payload;
    return NextResponse.redirect(new URL(getDashboardPath(role), request.url));
  }

  return NextResponse.next();
}

// 根据角色获取主控制台路径
function getDashboardPath(role: string): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'CREATOR') return '/creator';
  return '/examinee';
}

// 拦截器匹配配置：匹配除了 API、静态静态文件、图片、favicon 之外的所有路由
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
