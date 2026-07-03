import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const authPayload = getUserFromRequest(req);
    if (!authPayload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    const { userId, departmentId } = authPayload;

    if (!departmentId) {
      return NextResponse.json({ error: '您尚未绑定任何检测部门，请联系管理员分配' }, { status: 400 });
    }

    // 1. 获取本部门下所有的考核任务
    const tasks = await db.examTask.findMany({
      where: {
        departmentId: departmentId,
      },
      include: {
        exam: {
          select: {
            title: true,
            _count: { select: { questions: true } },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 2. 循环遍历，为该考生动态计算答题状态
    const formattedTasks = await Promise.all(
      tasks.map(async (task) => {
        // 查询该考生对该任务的答卷记录
        const record = await db.examRecord.findFirst({
          where: {
            taskId: task.id,
            examineeId: userId,
          },
        });

        const now = new Date();
        const start = new Date(task.startTime);
        const end = new Date(task.endTime);

        let userStatus = 'NOT_STARTED'; // 默认未开始
        let recordId = null;
        let score = 0;

        let aiProgress = null;

        if (record) {
          recordId = record.id;
          score = record.score;
          if (record.status === 'ONGOING') {
            userStatus = 'ONGOING';
          } else if (record.status === 'SUBMITTED') {
            userStatus = 'SUBMITTED';
            // 联表获取 AI 阅卷进度
            const answers = await db.answer.findMany({
              where: { recordId: record.id },
              select: {
                aiScore: true,
                question: {
                  select: {
                    type: true,
                  },
                },
              },
            });
            const subjectiveAnswers = answers.filter((ans) =>
              ['FILL', 'SHORT'].includes(ans.question.type)
            );
            const totalSubjective = subjectiveAnswers.length;
            const gradedSubjective = subjectiveAnswers.filter(
              (ans) => ans.aiScore !== null
            ).length;
            aiProgress = totalSubjective > 0 ? `${gradedSubjective}/${totalSubjective}` : '1/1';
          } else if (record.status === 'GRADED') {
            userStatus = 'GRADED';
          }
        } else {
          if (now < start) {
            userStatus = 'UPCOMING';
          } else if (now > end) {
            userStatus = 'MISSED';
          } else {
            userStatus = 'NOT_STARTED';
          }
        }

        return {
          id: task.id,
          title: task.title,
          examTitle: task.exam.title,
          questionCount: task.exam._count.questions,
          startTime: task.startTime,
          endTime: task.endTime,
          timeLimit: task.timeLimit,
          userStatus,
          recordId,
          score,
          type: task.type,
          aiProgress,
        };
      })
    );

    return NextResponse.json({
      success: true,
      tasks: formattedTasks,
    });
  } catch (error) {
    console.error('获取考生考核列表失败:', error);
    return NextResponse.json({ error: '服务器内部错误，获取考核任务失败' }, { status: 500 });
  }
}
