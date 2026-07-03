import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const departments = await db.department.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error('获取部门列表失败:', error);
    return NextResponse.json({ error: '获取部门列表失败' }, { status: 500 });
  }
}
