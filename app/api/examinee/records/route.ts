import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const authPayload = getUserFromRequest(req);
    if (!authPayload) {
      return NextResponse.json({ error: '未登录或登录已过期' }, { status: 401 });
    }

    const { userId } = authPayload;
    const { taskId } = await req.json();

    if (!taskId) {
      return NextResponse.json({ error: '缺少考试任务 ID' }, { status: 400 });
    }

    // 1. 检查考试任务是否存在及时间合法性
    const task = await db.examTask.findUnique({
      where: { id: taskId },
      include: {
        exam: {
          include: {
            questions: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!task) {
      return NextResponse.json({ error: '考核任务不存在' }, { status: 404 });
    }

    const now = new Date();
    const start = new Date(task.startTime);
    const end = new Date(task.endTime);

    // 2. 检测该考生是否已经有答卷记录 (支持断电续考)
    let record = await db.examRecord.findFirst({
      where: {
        taskId: taskId,
        examineeId: userId,
      },
      include: {
        answers: true,
      },
    });

    // 3. 已经有考试记录的逻辑判定
    if (record) {
      if (record.status !== 'ONGOING') {
        return NextResponse.json({ error: '您已参加过此场考试，且已交卷，无法重复进入。' }, { status: 400 });
      }
      
      // ONGOING 状态，允许其断电续考，重新计算剩余时间
      const elapsedMs = now.getTime() - new Date(record.startedAt).getTime();
      const limitMs = task.timeLimit * 60 * 1000;
      const remainingSeconds = Math.max(0, Math.floor((limitMs - elapsedMs) / 1000));

      // 脱敏清洗题目数据，强力剔除参考答案和解析，严防 F12 抓包作弊
      const sanitizedQuestions = task.exam.questions.map((q) => {
        let parsedOptions = null;
        if (q.options) {
          try {
            parsedOptions = JSON.parse(q.options);
          } catch (e) {
            parsedOptions = q.options;
          }
        }
        return {
          id: q.id,
          type: q.type,
          content: q.content,
          options: parsedOptions,
          score: q.score,
          knowledgePoint: q.knowledgePoint,
        };
      });

      // 整理已填写的暂存答案
      const savedAnswers = record.answers.map(ans => ({
        questionId: ans.questionId,
        answerContent: ans.answerContent,
      }));

      return NextResponse.json({
        success: true,
        isResume: true,
        message: '检测到您有进行中的考试，已为您成功恢复考场现场！',
        recordId: record.id,
        examTitle: task.exam.title,
        remainingSeconds,
        questions: sanitizedQuestions,
        savedAnswers,
      });
    }

    // 4. 新开考的逻辑判定 (检查考试时间窗口)
    if (now < start) {
      return NextResponse.json({ error: '考核尚未开始，无法进入考场。' }, { status: 400 });
    }
    if (now > end) {
      return NextResponse.json({ error: '考核时间已截止，无法再进入考场。' }, { status: 400 });
    }

    // 5. 创建全新的答卷记录
    const newRecord = await db.examRecord.create({
      data: {
        taskId: taskId,
        examineeId: userId,
        status: 'ONGOING',
        startedAt: now,
      },
    });

    // 脱敏清洗题目数据
    const sanitizedQuestions = task.exam.questions.map((q) => {
      let parsedOptions = null;
      if (q.options) {
        try {
          parsedOptions = JSON.parse(q.options);
        } catch (e) {
          parsedOptions = q.options;
        }
      }
      return {
        id: q.id,
        type: q.type,
        content: q.content,
        options: parsedOptions,
        score: q.score,
        knowledgePoint: q.knowledgePoint,
      };
    });

    return NextResponse.json({
      success: true,
      isResume: false,
      message: '成功进入考场，考试正式开始，限时倒计时已启动。',
      recordId: newRecord.id,
      examTitle: task.exam.title,
      remainingSeconds: task.timeLimit * 60,
      questions: sanitizedQuestions,
      savedAnswers: [], // 新考试，无暂存答案
    });

  } catch (error) {
    console.error('开考创建记录失败:', error);
    return NextResponse.json({ error: '服务器内部错误，开考失败' }, { status: 500 });
  }
}
