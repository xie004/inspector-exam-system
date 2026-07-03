import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* 允许局域网及本地IP访问开发服务器资源，解除 Turbopack 安全策略拦截 */
  allowedDevOrigins: ['localhost', '127.0.0.1', '10.30.0.122'],
  /* 关闭 Next.js 默认的开发者调试悬浮球 */
  devIndicators: false,
};

export default nextConfig;
