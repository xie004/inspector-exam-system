import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// 校验角色权限 (仅限 CREATOR 和 ADMIN)
function checkAuth(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload || (payload.role !== 'CREATOR' && payload.role !== 'ADMIN')) {
    return null;
  }
  return payload;
}

export async function GET(req: NextRequest) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可执行此操作' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterDeptId = searchParams.get('departmentId');

    // 数据隔离：出题员只能查看自己本部门的考试任务；管理员可以查看全部或按参数筛选
    const whereClause: any = {};
    if (authPayload.role === 'CREATOR') {
      whereClause.departmentId = authPayload.departmentId;
    } else if (authPayload.role === 'ADMIN' && filterDeptId) {
      whereClause.departmentId = filterDeptId;
    }

    // 查询考试任务，并包含试卷、部门以及已提交记录的数量
    const tasks = await db.examTask.findMany({
      where: whereClause,
      include: {
        exam: {
          select: {
            title: true,
            _count: { select: { questions: true } },
          },
        },
        department: { select: { name: true } },
        _count: {
          select: {
            records: true, // 统计参与考试的答卷记录数
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 格式化输出
    const formatted = tasks.map((task) => {
      const now = new Date();
      const start = new Date(task.startTime);
      const end = new Date(task.endTime);
      
      let status = task.status; // "PUBLISHED" | "ENDED"
      // 如果任务还是 PUBLISHED 状态，但时间已过，则在逻辑上视为已截止
      if (status === 'PUBLISHED' && now > end) {
        status = 'ENDED';
      } else if (status === 'PUBLISHED' && now < start) {
        status = 'UPCOMING'; // 未开始
      }

      return {
        id: task.id,
        title: task.title,
        examId: task.examId,
        examTitle: task.exam.title,
        questionCount: task.exam._count.questions,
        departmentId: task.departmentId,
        departmentName: task.department.name,
        startTime: task.startTime,
        endTime: task.endTime,
        timeLimit: task.timeLimit,
        recordCount: task._count.records,
        status,
        type: task.type,
        createdAt: task.createdAt,
      };
    });

    return NextResponse.json({
      success: true,
      tasks: formatted,
    });
  } catch (error) {
    console.error('获取考试任务列表失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取任务列表失败' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authPayload = checkAuth(req);
    if (!authPayload) {
      return NextResponse.json({ error: '权限不足，仅出题员或管理员可发布考试' }, { status: 403 });
    }

    const { examId, title, startTime, endTime, timeLimit, type } = await req.json();

    // 1. 参数校验
    if (!examId) return NextResponse.json({ error: '请选择要发布的试卷' }, { status: 400 });
    if (!title || title.trim() === '') return NextResponse.json({ error: '请填写考试任务名称' }, { status: 400 });
    if (!startTime || !endTime) return NextResponse.json({ error: '请设置考试起止时间' }, { status: 400 });
    
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: '时间格式不正确' }, { status: 400 });
    }
    if (start >= end) {
      return NextResponse.json({ error: '考试开始时间必须早于结束时间' }, { status: 400 });
    }

    // 2. 检查试卷合法性与权限
    const exam = await db.exam.findUnique({
      where: { id: examId },
    });

    if (!exam) return NextResponse.json({ error: '指定的试卷不存在' }, { status: 400 });

    // 跨部门安全校验
    if (authPayload.role === 'CREATOR' && exam.departmentId !== authPayload.departmentId) {
      return NextResponse.json({ error: '越权拦截：您只能发布属于您本部门的试卷' }, { status: 403 });
    }

    // 3. 决定部门归属 (出题员强制为自己的部门，管理员用试卷所在的部门)
    const departmentId = authPayload.role === 'CREATOR' ? authPayload.departmentId : exam.departmentId;

    if (!departmentId) {
      return NextResponse.json({ error: '无法定位所属部门，发布失败' }, { status: 400 });
    }

    // 继承时长：如果前端没传答题限时，则默认继承试卷上配置的时长
    const finalTimeLimit = timeLimit && parseInt(timeLimit.toString(), 10) > 0 
      ? parseInt(timeLimit.toString(), 10) 
      : exam.timeLimit;

    // 4. 创建考试任务记录
    const newTask = await db.examTask.create({
      data: {
        title: title.trim(),
        examId,
        departmentId,
        startTime: start,
        endTime: end,
        timeLimit: finalTimeLimit,
        status: 'PUBLISHED',
        type: type || 'EXAM',
      },
    });

    return NextResponse.json({
      success: true,
      message: '考试任务已成功发布并推送！同部门考生现在可在其控制面板中查看。',
      task: newTask,
    });
  } catch (error) {
    console.error('发布考试任务失败:', error);
    return NextResponse.json({ error: '服务器内部错误，发布考试任务失败' }, { status: 500 });
  }
}
