import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'inspector-assessment-system-jwt-secret-key-2026-secured';

export interface JWTPayload {
  userId: string;
  username: string;
  role: string; // "ADMIN" | "CREATOR" | "EXAMINEE"
  realName: string;
  employeeId: string;
  departmentId: string | null;
}

// 签署 JWT
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// 验证 JWT
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// 从 HTTP 请求中提取并验证用户
export function getUserFromRequest(req: NextRequest): JWTPayload | null {
  const cookieToken = req.cookies.get('auth_token')?.value;
  if (!cookieToken) {
    // 兼容 Bearer Token 头部传输（为未来移动端或外部 API 做准备）
    const authHeader = req.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return verifyToken(token);
    }
    return null;
  }
  return verifyToken(cookieToken);
}
