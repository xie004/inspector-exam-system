import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { unlink } from 'fs/promises';
import { join } from 'path';

// 校验角色权限 (仅限 CREATOR 和 ADMIN)
function checkAuth(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload || (payload.role !== 'CREATOR' && payload.role !== 'ADMIN')) {
    return null;
  }
  return payload;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可查看标准详情' }, { status: 403 });
    }

    const { id } = await params;

    const standard = await db.standard.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        fileType: true,
        filePath: true,
        extractedText: true,
        departmentId: true,
      },
    });

    if (!standard) {
      return NextResponse.json({ error: '标准文献不存在' }, { status: 404 });
    }

    // 数据隔离：出题员只能查看自己本部门的标准详情
    if (authPayload.role === 'CREATOR' && standard.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您只能查看属于本部门的产品标准详情' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      standard,
    });
  } catch (error) {
    console.error('获取标准文献详情失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取详情失败' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可执行此操作' }, { status: 403 });
    }

    const { id } = await params;

    // 1. 获取目标文献
    const standard = await db.standard.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            exams: true,
            questions: true,
          },
        },
      },
    });

    if (!standard) {
      return NextResponse.json({ error: '标准文献不存在' }, { status: 404 });
    }

    // 数据隔离边界检验：如果是出题员，只能删除自己本部门的标准文献
    if (authPayload.role === 'CREATOR' && standard.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您只能删除属于您本部门的产品标准' }, { status: 403 });
    }

    // 2. 磁盘物理文件清理 (避免磁盘文件堆积)
    if (standard.filePath) {
      try {
        const fullPath = join(process.cwd(), 'public', standard.filePath);
        await unlink(fullPath);
        console.log('磁盘物理文件删除成功:', fullPath);
      } catch (fileErr) {
        // 如果文件不存在（可能已经被手动删除或丢失），打印警告但不阻碍数据库删除
        console.warn('删除磁盘文件失败或文件已被删除:', standard.filePath, fileErr);
      }
    }

    // 3. 数据库原子化删除与安全解绑 (Prisma 事务)
    await db.$transaction([
      db.exam.updateMany({
        where: { standardId: id },
        data: { standardId: null }
      }),
      db.question.updateMany({
        where: { standardId: id },
        data: { standardId: null }
      }),
      db.standard.delete({
        where: { id }
      })
    ]);

    return NextResponse.json({
      success: true,
      message: '标准文献及磁盘物理文件已成功彻底删除，相关试卷及题目已安全解绑保留！',
    });
  } catch (error) {
    console.error('删除标准文献失败:', error);
    return NextResponse.json({ error: '服务器内部错误，删除失败' }, { status: 500 });
  }
}
