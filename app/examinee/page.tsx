'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  BookOpen,
  AlertCircle,
  CheckCircle,
  XCircle,
  ChevronRight,
  LogOut,
  Sparkles,
  Award,
  BookMarked,
  BarChart3,
  HelpCircle,
  Calendar,
  Layers,
  Search,
  FileText,
  BookmarkMinus,
  BrainCircuit,
  Save,
  Send,
  ClipboardCheck,
  RefreshCw
} from 'lucide-react';

// 引入 Recharts 图表 (带客户端挂载水合防护)
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface Task {
  id: string;
  title: string;
  examTitle: string;
  questionCount: number;
  startTime: string;
  endTime: string;
  timeLimit: number;
  userStatus: 'UPCOMING' | 'NOT_STARTED' | 'ONGOING' | 'SUBMITTED' | 'GRADED' | 'MISSED';
  recordId: string | null;
  score: number;
  type?: 'EXAM' | 'TRAINING';
  aiProgress?: string | null;
}

interface Question {
  id: string;
  type: 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'FILL' | 'SHORT';
  content: string;
  options: string[] | null;
  score: number;
  knowledgePoint: string;
  standardTitle: string;
  userAnswer?: string;
  userScore?: number;
  isCorrect?: boolean;
  correctAnswer?: string;
  explanation?: string;
  aiScore?: number | null;
  aiComment?: string | null;
  reviewerComment?: string | null;
}

interface ExamDetail {
  id: string;
  taskId: string;
  taskTitle: string;
  examTitle: string;
  status: 'ONGOING' | 'SUBMITTED' | 'GRADED';
  score: number;
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  questions: Question[];
}

interface Mistake {
  id: string;
  questionId: string;
  type: 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'FILL' | 'SHORT';
  content: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  knowledgePoint: string;
  examTitle: string;
  standardTitle: string;
  userAnswer: string;
  userScore: number;
  questionScore: number;
  aiComment: string | null;
  reviewerComment: string | null;
  answeredAt: string;
}

export default function ExamineeDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'mistakes'>('overview');
  const [mounted, setMounted] = useState(false);

  // 考生身份信息
  const [examineeInfo, setExamineeInfo] = useState({
    realName: '',
    employeeId: '',
    departmentName: '',
    sectionName: '',
  });

  // 全局数据状态
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [selectedStandard, setSelectedStandard] = useState<string>('ALL');

  // 统计数据
  const [statsSummary, setStatsSummary] = useState({
    averageScore: 0,
    passRate: 0,
    maxScore: 0,
    minScore: 0,
    totalExams: 0,
  });
  const [statsTrend, setStatsTrend] = useState<any[]>([]);
  const [statsMastery, setStatsMastery] = useState<any[]>([]);

  // 交互状态控制
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; text: string } | null>(null);

  // 沉浸式答题室状态
  const [activeExam, setActiveExam] = useState<{
    recordId: string;
    examTitle: string;
    questions: Question[];
  } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [tempAnswers, setTempAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // 查看考核报告 Modal 状态
  const [reportDetail, setReportDetail] = useState<ExamDetail | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // 主题与字体大小状态
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg'>('sm');

  const applyTheme = (t: 'dark' | 'light' | 'system') => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    
    if (t === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (t === 'light') {
      root.classList.add('light');
      root.style.colorScheme = 'light';
    } else {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }
    }
  };

  const applyFontSize = (sz: 'sm' | 'md' | 'lg') => {
    const root = document.documentElement;
    root.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
    root.classList.add(`font-size-${sz}`);
  };

  const handleThemeChange = (t: 'dark' | 'light' | 'system') => {
    setTheme(t);
    localStorage.setItem('ias-theme', t);
    applyTheme(t);
  };

  const handleFontSizeChange = (sz: 'sm' | 'md' | 'lg') => {
    setFontSize(sz);
    localStorage.setItem('ias-font-size', sz);
    applyFontSize(sz);
  };

  // 1. 初始化，检查登录，加载数据
  useEffect(() => {
    setMounted(true);
    // 初始化加载 localStorage 缓存
    const savedTheme = localStorage.getItem('ias-theme') as 'dark' | 'light' | 'system' || 'dark';
    const savedFontSize = localStorage.getItem('ias-font-size') as 'sm' | 'md' | 'lg' || 'sm';
    setTheme(savedTheme);
    setFontSize(savedFontSize);
    applyTheme(savedTheme);
    applyFontSize(savedFontSize);
    const checkExamineeProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.success) {
          if (data.user.role !== 'EXAMINEE') {
            // 角色防越权
            router.push('/login');
            return;
          }
          setExamineeInfo({
            realName: data.user.realName,
            employeeId: data.user.employeeId,
            departmentName: data.user.department?.name || '未指定部门',
            sectionName: data.user.sectionName || '未分配科室',
          });
        }
      } catch (err) {
        console.error(err);
        router.push('/login');
      }
    };
    checkExamineeProfile();
  }, [router]);

  // 加载考生数据
  const loadData = async () => {
    try {
      setLoading(true);
      // 1. 加载考核任务列表
      const tasksRes = await fetch('/api/examinee/tasks');
      if (tasksRes.ok) {
        const d = await tasksRes.json();
        setTasks(d.tasks || []);
      }

      // 2. 加载个人数据统计 (折线图、雷达图)
      const statsRes = await fetch('/api/examinee/stats');
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStatsSummary(d.summary || { averageScore: 0, passRate: 0, maxScore: 0, minScore: 0, totalExams: 0 });
        setStatsTrend(d.trend || []);
        setStatsMastery(d.mastery || []);
      }

      // 3. 加载错题本
      const mistakesRes = await fetch('/api/examinee/mistakes');
      if (mistakesRes.ok) {
        const d = await mistakesRes.json();
        setMistakes(d.mistakes || []);
      }
    } catch (err) {
      console.error(err);
      showToastMessage('error', '加载考务数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (examineeInfo.employeeId) {
      loadData();
    }
  }, [examineeInfo.employeeId]);

  // 轮询后台 AI 阅卷进度，只在有 SUBMITTED (阅卷中) 任务时触发
  useEffect(() => {
    if (!examineeInfo.employeeId) return;

    const hasActiveGrading = tasks.some(t => t.userStatus === 'SUBMITTED');
    if (!hasActiveGrading) return;

    const interval = setInterval(async () => {
      try {
        const tasksRes = await fetch('/api/examinee/tasks');
        if (tasksRes.ok) {
          const d = await tasksRes.json();
          setTasks(d.tasks || []);
          
          const hasSubmittedNow = (d.tasks || []).some((t: any) => t.userStatus === 'SUBMITTED');
          if (!hasSubmittedNow) {
            const statsRes = await fetch('/api/examinee/stats');
            if (statsRes.ok) {
              const statsD = await statsRes.json();
              setStatsSummary(statsD.summary || { averageScore: 0, passRate: 0, maxScore: 0, minScore: 0, totalExams: 0 });
              setStatsTrend(statsD.trend || []);
              setStatsMastery(statsD.mastery || []);
            }
            const mistakesRes = await fetch('/api/examinee/mistakes');
            if (mistakesRes.ok) {
              const mistakesD = await mistakesRes.json();
              setMistakes(mistakesD.mistakes || []);
            }
          }
        }
      } catch (err) {
        console.error('轮询阅卷进度异常:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [tasks, examineeInfo.employeeId]);

  // Toast 消息函数
  const showToastMessage = (type: 'success' | 'error' | 'info' | 'warning', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // 退出登录
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error(err);
      router.push('/login');
    }
  };

  // 2. 考务操作: 进入考场 (开考/续考)
  const handleStartExam = async (taskId: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/examinee/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToastMessage('error', data.error || '开考失败');
        return;
      }

      // 进入答题室
      setActiveExam({
        recordId: data.recordId,
        examTitle: data.examTitle,
        questions: data.questions,
      });

      // 初始化倒计时和临时答案
      setTimeLeft(data.remainingSeconds);
      setCurrentQuestionIndex(0);

      // 整理已填写的暂存答案 (断电续考逻辑)
      const answersMap: Record<string, string> = {};
      if (data.savedAnswers && Array.isArray(data.savedAnswers)) {
        data.savedAnswers.forEach((ans: any) => {
          answersMap[ans.questionId] = ans.answerContent;
        });
      }
      setTempAnswers(answersMap);

      showToastMessage('success', data.message || '考试正式开始');
    } catch (err) {
      console.error(err);
      showToastMessage('error', '开考网络请求异常');
    } finally {
      setLoading(false);
    }
  };

  // 3. 答题室内答题与暂存机制
  const handleSingleAnswer = (qId: string, val: string) => {
    setTempAnswers((prev) => ({ ...prev, [qId]: val }));
    if (activeExam) {
      const currentQ = activeExam.questions[currentQuestionIndex];
      if (currentQ && currentQ.id === qId && currentQ.type === 'SINGLE') {
        if (currentQuestionIndex < activeExam.questions.length - 1) {
          setCurrentQuestionIndex((prev) => prev + 1);
        }
      }
    }
  };

  const handleMultipleAnswer = (qId: string, letter: string, checked: boolean) => {
    const currentVal = tempAnswers[qId] || '';
    let selected = currentVal ? currentVal.split(',').map((s) => s.trim()) : [];
    if (checked) {
      if (!selected.includes(letter)) {
        selected.push(letter);
      }
    } else {
      selected = selected.filter((x) => x !== letter);
    }
    selected.sort();
    setTempAnswers((prev) => ({ ...prev, [qId]: selected.join(',') }));
  };

  // 统一的云端保存与交卷函数
  const saveExamProgress = async (isSubmit = false) => {
    if (!activeExam) return false;
    setSaveStatus('saving');

    const answersPayload = Object.keys(tempAnswers).map((qId) => ({
      questionId: qId,
      answerContent: tempAnswers[qId] || '',
    }));

    try {
      const res = await fetch(`/api/examinee/records/${activeExam.recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: answersPayload,
          submit: isSubmit,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToastMessage('error', data.error || '云端答案同步失败');
        setSaveStatus('idle');
        return false;
      }

      if (isSubmit) {
        showToastMessage('success', data.message || '交卷成功');
        setActiveExam(null);
        setTimeLeft(null);
        setTempAnswers({});
        // 刷新列表和统计图表
        loadData();
      } else {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
      }
      return true;
    } catch (err) {
      console.error(err);
      showToastMessage('error', '同步异常，请检查网络');
      setSaveStatus('idle');
      return false;
    }
  };

  // 自动暂存定时器 (30秒)
  useEffect(() => {
    if (!activeExam) return;
    const interval = setInterval(() => {
      saveExamProgress(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [activeExam, tempAnswers]);

  // 倒计时递减时钟
  useEffect(() => {
    if (!activeExam || timeLeft === null) return;

    if (timeLeft <= 0) {
      // 倒计时归零，强制交卷
      showToastMessage('warning', '考核时间已到，系统正在自动为您封卷提交...');
      saveExamProgress(true);
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [activeExam, timeLeft]);

  // 4. 查看考核报告 (获取已完结考试的详情)
  const handleViewReport = async (recordId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/examinee/records/${recordId}`);
      const data = await res.json();
      if (!res.ok) {
        showToastMessage('error', data.error || '无法加载考核报告');
        return;
      }
      setReportDetail(data.record);
      setShowReportModal(true);
    } catch (err) {
      console.error(err);
      showToastMessage('error', '获取考核报告请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化倒计时时间显示
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 错题筛选：获取所有标准文献选项
  const standardList = Array.from(new Set(mistakes.map((m) => m.standardTitle)));

  const filteredMistakes = selectedStandard === 'ALL'
    ? mistakes
    : mistakes.filter((m) => m.standardTitle === selectedStandard);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 font-sans bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.06),rgba(255,255,255,0))] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.15),rgba(255,255,255,0))] flex flex-col relative overflow-hidden transition-colors duration-300">
      {/* 科技背景光效 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600/5 dark:bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Toast 提示框 */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl border backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 bg-slate-900/90 border-slate-800">
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
          {toast.type === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
          {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
          {toast.type === 'info' && <Sparkles className="w-5 h-5 text-cyan-400" />}
          <span className="text-sm font-medium text-slate-200">{toast.text}</span>
        </div>
      )}

      {/* 头部加载条 */}
      {loading && (
        <div className="fixed top-0 left-0 w-full h-[3px] bg-cyan-500 z-50 overflow-hidden">
          <div className="w-full h-full bg-cyan-400 animate-pulse origin-left" style={{ transform: 'scaleX(0.6)' }} />
        </div>
      )}

      {/* 主框架：非答题状态显示主面板 */}
      {!activeExam ? (
        <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
          {/* 左侧控制台栏 (侧边栏) */}
          <aside className="w-full lg:w-80 bg-slate-100/60 dark:bg-slate-900/45 backdrop-blur-md border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800/60 p-6 flex flex-col justify-between transition-colors duration-300">
            <div className="flex flex-col gap-6">
              {/* 考生个人资料卡 (玻璃拟态) */}
              <div className="p-4 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-300 dark:border-white/10 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold text-lg">
                    {examineeInfo.realName ? examineeInfo.realName[0] : '考'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{examineeInfo.realName || '正在载入...'}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">{examineeInfo.employeeId || '工号加载中'}</p>
                  </div>
                </div>
                <div className="border-t border-slate-300 dark:border-slate-800/60 pt-2.5 flex flex-col gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>科室：</span>
                    <span className="text-slate-800 dark:text-slate-300 font-medium">{examineeInfo.sectionName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>部门：</span>
                    <span className="text-slate-800 dark:text-slate-300 font-medium">{examineeInfo.departmentName}</span>
                  </div>
                </div>
              </div>

              {/* 导航 Tabs */}
              <nav className="flex flex-col gap-1.5">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'overview'
                      ? 'bg-gradient-to-r from-cyan-500/15 to-cyan-500/5 text-cyan-650 dark:text-cyan-400 border-l-4 border-cyan-500 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200 hover:bg-slate-200/50 hover:dark:bg-white/5'
                  }`}
                >
                  <LayoutDashboard className="w-4.5 h-4.5" />
                  <span>考核大厅</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'history'
                      ? 'bg-gradient-to-r from-cyan-500/15 to-cyan-500/5 text-cyan-650 dark:text-cyan-400 border-l-4 border-cyan-500 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200 hover:bg-slate-200/50 hover:dark:bg-white/5'
                  }`}
                >
                  <BarChart3 className="w-4.5 h-4.5" />
                  <span>历史考核与分析</span>
                </button>
                <button
                  onClick={() => setActiveTab('mistakes')}
                  className={`flex items-center gap-3.5 px-4.5 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === 'mistakes'
                      ? 'bg-gradient-to-r from-cyan-500/15 to-cyan-500/5 text-cyan-650 dark:text-cyan-400 border-l-4 border-cyan-500 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200 hover:bg-slate-200/50 hover:dark:bg-white/5'
                  }`}
                >
                  <BookOpen className="w-4.5 h-4.5" />
                  <span>个人错题本</span>
                  {mistakes.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-[10px] font-bold text-rose-400">
                      {mistakes.length}
                    </span>
                  )}
                </button>
              </nav>

              {/* 个性化设置小卡片 */}
              <div className="p-4 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-300/60 dark:border-white/10 flex flex-col gap-3 text-xs transition-all">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">个性化设置</div>
                
                {/* 配色主题切换 */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 text-[9px]">配色主题</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-300/60 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-300 dark:border-slate-800/85">
                    {(['dark', 'light', 'system'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => handleThemeChange(t)}
                        className={`py-1 rounded-md text-[9px] font-medium transition-all ${
                          theme === t
                            ? 'bg-white dark:bg-cyan-500/10 border border-slate-300 dark:border-cyan-500/35 text-cyan-650 dark:text-cyan-400 font-semibold shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200 hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        {t === 'dark' && '暗色'}
                        {t === 'light' && '亮色'}
                        {t === 'system' && '跟随'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 字体大小三档调整 */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 text-[9px]">系统字体大小</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-300/60 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-300 dark:border-slate-800/85">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        onClick={() => handleFontSizeChange(sz)}
                        className={`py-1 rounded-md text-[9px] font-medium transition-all ${
                          fontSize === sz
                            ? 'bg-white dark:bg-cyan-500/10 border border-slate-300 dark:border-cyan-500/35 text-cyan-650 dark:text-cyan-400 font-semibold shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200 hover:bg-white/10 border border-transparent'
                        }`}
                      >
                        {sz === 'sm' && '默认'}
                        {sz === 'md' && '中等'}
                        {sz === 'lg' && '超大'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 底部退出按钮 */}
            <div className="border-t border-slate-350 dark:border-slate-800/60 pt-4 mt-6 lg:mt-0">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-850 hover:bg-rose-50 hover:dark:bg-rose-950/20 hover:border-rose-300 hover:dark:border-rose-900/40 text-slate-750 dark:text-slate-400 hover:text-rose-600 hover:dark:text-rose-400 transition-all duration-300 text-sm font-medium shadow-sm dark:shadow-none"
              >
                <LogOut className="w-4.5 h-4.5" />
                <span>安全退出系统</span>
              </button>
            </div>
          </aside>

          {/* 右侧主工作区 */}
          <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-7xl">
            {/* Tab 1: 考核大厅 */}
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-8 animate-in fade-in duration-300">
                {/* 页头标题 */}
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">考核大厅</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">研读标准、自我考评。参与本部门近期发布的产品标准检验能力考核。</p>
                </div>

                {/* 待考科目卡片流 */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <Layers className="w-4.5 h-4.5 text-cyan-650 dark:text-cyan-400" />
                    <span>我的考核列表 ({tasks.length})</span>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="py-16 text-center rounded-2xl bg-white dark:bg-slate-900/25 border border-slate-200 dark:border-slate-900/60 flex flex-col items-center gap-4 shadow-sm dark:shadow-none">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-450 dark:text-slate-500">
                        <Calendar className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-slate-650 dark:text-slate-400 font-medium">当前暂无发布的考核任务</p>
                        <p className="text-xs text-slate-450 dark:text-slate-500">部门出题员发布新考核后，将实时推送至此处</p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {tasks.map((task) => {
                        return (
                          <div
                            key={task.id}
                            className="group relative rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 p-6 hover:border-cyan-500/25 transition-all duration-300 flex flex-col justify-between shadow-sm dark:shadow-none"
                          >
                            <div className="flex flex-col gap-4">
                              {/* 状态徽章与分值 */}
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5">
                                  {task.type === 'TRAINING' ? (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/25 text-emerald-650 dark:text-emerald-400">
                                      自主训练
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 border border-blue-500/25 text-blue-650 dark:text-blue-405">
                                      正式考试
                                    </span>
                                  )}

                                  {task.userStatus === 'UPCOMING' && (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 text-[9px] font-semibold">
                                      未开始
                                    </span>
                                  )}
                                  {task.userStatus === 'NOT_STARTED' && (
                                    <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 text-cyan-650 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 text-[9px] font-semibold">
                                      可开考
                                    </span>
                                  )}
                                  {task.userStatus === 'ONGOING' && (
                                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-655 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 text-[9px] font-semibold animate-pulse">
                                      继续作答
                                    </span>
                                  )}
                                  {task.userStatus === 'SUBMITTED' && (
                                    <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20 text-[9px] font-semibold flex items-center gap-1">
                                      <RefreshCw className="w-2.5 h-2.5 animate-spin text-purple-650 dark:text-purple-400" />
                                      AI阅卷中 {task.aiProgress ? `(${task.aiProgress})` : ''}
                                    </span>
                                  )}
                                  {task.userStatus === 'GRADED' && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-655 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[9px] font-semibold">
                                      已出分
                                    </span>
                                  )}
                                  {task.userStatus === 'MISSED' && (
                                    <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-650 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-[9px] font-semibold">
                                      已截止
                                    </span>
                                  )}
                                </div>

                                <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  {task.timeLimit}分钟 / {task.questionCount}题
                                </span>
                              </div>

                              {/* 考核标题与依据标准 */}
                              <div className="flex flex-col gap-1.5">
                                <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-cyan-650 group-hover:dark:text-cyan-400 transition-colors duration-200 line-clamp-1">
                                  {task.title}
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                                  <BookMarked className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                                  <span className="line-clamp-1">{task.examTitle}</span>
                                </p>
                              </div>

                              {/* 有效期时间段 */}
                              <div className="text-[10px] text-slate-500 font-mono flex flex-col gap-1 border-t border-slate-200 dark:border-slate-800/40 pt-3">
                                <div className="flex justify-between">
                                  <span>开考时间：</span>
                                  <span>{new Date(task.startTime).toLocaleString('zh-CN')}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>截止时间：</span>
                                  <span>{new Date(task.endTime).toLocaleString('zh-CN')}</span>
                                </div>
                              </div>
                            </div>

                            {/* 交互按钮 */}
                            <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800/40 flex items-center justify-between">
                              {task.userStatus === 'GRADED' || task.userStatus === 'SUBMITTED' ? (
                                <div className="text-slate-800 dark:text-slate-300 flex items-center gap-1">
                                  <span className="text-xs text-slate-500">得分：</span>
                                  <span className="text-lg font-extrabold text-cyan-650 dark:text-cyan-400 font-mono">{task.score}</span>
                                  <span className="text-xs text-slate-500">分</span>
                                  {task.userStatus === 'SUBMITTED' && (
                                    <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium">（仅客观题）</span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-500">
                                  {task.userStatus === 'UPCOMING' && '未到开考时间'}
                                  {task.userStatus === 'MISSED' && '已错过考试'}
                                  {task.userStatus === 'NOT_STARTED' && '等待作答'}
                                  {task.userStatus === 'ONGOING' && '有未交卷的进度'}
                                </div>
                              )}

                              {/* 操作按钮 */}
                              {task.userStatus === 'NOT_STARTED' && (
                                <button
                                  onClick={() => handleStartExam(task.id)}
                                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white text-xs font-semibold shadow-md shadow-cyan-500/10 transition-all flex items-center gap-1"
                                >
                                  <span>进入考场</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {task.userStatus === 'ONGOING' && (
                                <button
                                  onClick={() => handleStartExam(task.id)}
                                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/10 transition-all flex items-center gap-1"
                                >
                                  <span>继续答题</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                               {(task.userStatus === 'GRADED' || task.userStatus === 'SUBMITTED') && task.recordId && (
                                 <button
                                   onClick={() => handleViewReport(task.recordId!)}
                                   className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-cyan-400 border border-slate-800 hover:border-cyan-500/30 text-xs font-semibold transition-all flex items-center gap-1"
                                 >
                                   <span>考核报告</span>
                                   {task.userStatus === 'SUBMITTED' && (
                                     <span className="px-1 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold">评阅中</span>
                                   )}
                                 </button>
                               )}
                               {(task.userStatus === 'UPCOMING' || task.userStatus === 'MISSED') && (
                                 <button
                                   disabled
                                   className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-850 text-slate-500 text-xs font-medium cursor-not-allowed"
                                 >
                                   不可进入
                                 </button>
                               )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: 历史考核与数据分析 */}
            {activeTab === 'history' && (
              <div className="flex flex-col gap-8 animate-in fade-in duration-300">
                {/* 页头标题 */}
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">成绩分析</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">分析您在历次检测标准考核中的表现，精准掌握各产品条款的技术要求。</p>
                </div>

                {/* 指标面板 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex flex-col gap-2 relative overflow-hidden shadow-sm dark:shadow-none transition-colors">
                    <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center">
                      <ClipboardCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">已完结考核</span>
                    <span className="text-2xl font-extrabold font-mono text-slate-900 dark:text-slate-100">{statsSummary.totalExams} <span className="text-xs text-slate-400 font-normal">场</span></span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex flex-col gap-2 relative overflow-hidden shadow-sm dark:shadow-none transition-colors">
                    <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">个人平均分</span>
                    <span className="text-2xl font-extrabold font-mono text-cyan-600 dark:text-cyan-400">{statsSummary.averageScore} <span className="text-xs text-slate-400 font-normal">分</span></span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex flex-col gap-2 relative overflow-hidden shadow-sm dark:shadow-none transition-colors">
                    <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                      <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">个人最高分</span>
                    <span className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">{statsSummary.maxScore} <span className="text-xs text-slate-400 font-normal">分</span></span>
                  </div>
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex flex-col gap-2 relative overflow-hidden shadow-sm dark:shadow-none transition-colors">
                    <div className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-violet-500/10 dark:bg-violet-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">及格率</span>
                    <span className="text-2xl font-extrabold font-mono text-violet-600 dark:text-violet-400">{statsSummary.passRate}%</span>
                  </div>
                </div>

                {/* 图表展示 (带水合判断以防水合冲突) */}
                {mounted && statsSummary.totalExams > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 左侧：成绩走势折线图 */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex flex-col gap-4 shadow-sm dark:shadow-none transition-colors">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <div className="w-1.5 h-3 bg-cyan-500 rounded" />
                        <span>历次考核成绩走势</span>
                      </h3>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={statsTrend} margin={{ top: 10, right: 15, left: -15, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.15)" />
                            <XAxis dataKey="examTitle" stroke="#64748b" tick={{ fontSize: 10 }} />
                            <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(100, 116, 139, 0.2)', borderRadius: '8px', fontSize: '12px' }}
                              labelClassName="text-slate-500 dark:text-slate-400 font-semibold"
                            />
                            <Line type="monotone" dataKey="score" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="得分" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 右侧：产品标准条款雷达图 */}
                    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 flex flex-col gap-4 shadow-sm dark:shadow-none transition-colors">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <div className="w-1.5 h-3 bg-violet-500 rounded" />
                        <span>产品标准条款掌握度雷达 (基于错题)</span>
                      </h3>
                      <div className="h-72 w-full flex items-center justify-center">
                        {statsMastery.length === 0 ? (
                          <span className="text-xs text-slate-500">数据不足，暂未生成雷达图</span>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={statsMastery}>
                              <PolarGrid stroke="rgba(100, 116, 139, 0.2)" />
                              <PolarAngleAxis dataKey="subject" stroke="#64748b" tick={{ fontSize: 9 }} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="rgba(100, 116, 139, 0.3)" tick={{ fontSize: 9 }} />
                              <Radar name="个人掌握率 (%)" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.25} />
                              <Tooltip contentStyle={{ backgroundColor: 'var(--background)', color: 'var(--foreground)', borderColor: 'rgba(100, 116, 139, 0.2)', borderRadius: '8px', fontSize: '12px' }} />
                            </RadarChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 历史记录列表 */}
                <div className="flex flex-col gap-4">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <span>历史考核档案</span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/20 shadow-sm dark:shadow-none">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-850 bg-slate-50 dark:bg-slate-900/40 text-[10px] font-bold text-slate-600 dark:text-slate-400 tracking-wider">
                          <th className="p-4">考核任务 / 试卷</th>
                          <th className="p-4">交卷时间</th>
                          <th className="p-4">状态</th>
                          <th className="p-4">得分</th>
                          <th className="p-4 text-center">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-850/60 text-xs">
                        {tasks
                          .filter((t) => t.userStatus === 'GRADED')
                          .map((task) => (
                            <tr key={task.id} className="hover:bg-slate-55 dark:hover:bg-white/5 transition-all text-slate-700 dark:text-slate-300">
                              <td className="p-4">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-semibold text-slate-900 dark:text-slate-200">{task.title}</span>
                                  <span className="text-[10px] text-slate-500">{task.examTitle}</span>
                                </div>
                              </td>
                              <td className="p-4 font-mono text-slate-600 dark:text-slate-400">
                                {task.recordId ? new Date().toLocaleDateString('zh-CN') : '--'}
                              </td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-semibold">
                                  阅卷完成
                                </span>
                              </td>
                              <td className="p-4">
                                <span className="text-base font-extrabold text-cyan-650 dark:text-cyan-400 font-mono">{task.score}</span>
                                <span className="text-[10px] text-slate-500 ml-0.5">分</span>
                              </td>
                              <td className="p-4 text-center">
                                {task.recordId && (
                                  <button
                                    onClick={() => handleViewReport(task.recordId!)}
                                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-855 hover:bg-slate-200 hover:dark:bg-slate-800 text-cyan-655 dark:text-cyan-400 border border-slate-200 dark:border-slate-800 hover:border-cyan-300 hover:dark:border-cyan-500/30 transition-all text-2xs font-semibold"
                                  >
                                    查看报告
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        {tasks.filter((t) => t.userStatus === 'GRADED').length === 0 && (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                              暂无已完结并发布成绩的考核记录
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: 个人错题本 */}
            {activeTab === 'mistakes' && (
              <div className="flex flex-col gap-8 animate-in fade-in duration-300">
                {/* 页头标题 */}
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">个人错题本</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">聚合您在各项标准考核中未得满分的题目，配合 AI 智能强化解析开展复习。</p>
                </div>

                {/* 过滤器 */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-300">
                    <BookMarked className="w-4.5 h-4.5 text-rose-500 dark:text-rose-400" />
                    <span>错题库列表 ({filteredMistakes.length} 道)</span>
                  </div>

                  <div className="flex items-center gap-3.5 w-full sm:w-auto">
                    <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">筛选依据标准：</span>
                    <select
                      value={selectedStandard}
                      onChange={(e) => setSelectedStandard(e.target.value)}
                      className="w-full sm:w-60 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:border-cyan-500 focus:outline-none transition-colors"
                    >
                      <option value="ALL">全部标准文献 ({mistakes.length})</option>
                      {standardList.map((title) => (
                        <option key={title} value={title}>
                          {title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 错题瀑布流 */}
                {filteredMistakes.length === 0 ? (
                  <div className="py-20 text-center rounded-2xl bg-white dark:bg-slate-900/25 border border-slate-200 dark:border-slate-900/60 flex flex-col items-center gap-4 shadow-sm dark:shadow-none">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-450 dark:text-slate-500">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm text-slate-650 dark:text-slate-400 font-medium">当前无筛选的错题记录</p>
                      <p className="text-xs text-slate-450 dark:text-slate-500">只有已发布成绩中未得满分的题目才会沉淀至此，说明您掌握良好！</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {filteredMistakes.map((mis, idx) => (
                      <div
                        key={mis.id}
                        className="rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60 p-6 flex flex-col gap-5 relative overflow-hidden shadow-sm dark:shadow-none transition-colors"
                      >
                        {/* 装饰边线 */}
                        <div className="absolute top-0 left-0 w-[4px] h-full bg-rose-500" />

                        {/* 头部条款信息与出处 */}
                        <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 dark:border-slate-800/40 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-400 text-[10px] font-bold">
                              {mis.type === 'SINGLE' && '单选'}
                              {mis.type === 'MULTIPLE' && '多选'}
                              {mis.type === 'JUDGE' && '判断'}
                              {mis.type === 'FILL' && '填空'}
                              {mis.type === 'SHORT' && '简答'}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-300">
                              依据条款：{mis.knowledgePoint}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            出处：{mis.examTitle} ({mis.standardTitle})
                          </span>
                        </div>

                        {/* 题干文本 */}
                        <div className="text-sm text-slate-900 dark:text-slate-200 font-semibold leading-relaxed">
                          {idx + 1}. {mis.content}
                        </div>

                        {/* 选择题的选项 */}
                        {mis.options && Array.isArray(mis.options) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-4">
                            {mis.options.map((opt) => (
                              <div
                                key={opt}
                                className="px-4.5 py-3 rounded-lg border border-slate-200 dark:border-slate-850/80 bg-slate-50 dark:bg-slate-900/15 text-xs text-slate-700 dark:text-slate-300"
                              >
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 作答状态比对 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-200 dark:border-slate-900/80 text-xs text-slate-700 dark:text-slate-300">
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-550 dark:text-slate-500">我的答案：</span>
                            <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono break-words">
                              {mis.userAnswer || '[未作答]'}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-550 dark:text-slate-500">标准答案：</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono break-words">
                              {mis.correctAnswer}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className="text-slate-550 dark:text-slate-500">实得分 / 满分：</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                              {mis.userScore}分 / {mis.questionScore}分
                            </span>
                          </div>
                        </div>
                        {/* 标准条款文字解析 */}
                        {mis.explanation && (
                          <div className="pl-3.5 border-l-2 border-slate-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            <strong className="text-slate-800 dark:text-slate-300 font-semibold">标准条文依据：</strong>
                            {mis.explanation}
                          </div>
                        )}

                        {/* AI 智能强化解析 (核心高端设计) */}
                        {(mis.aiComment || mis.reviewerComment) && (
                          <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/15 bg-gradient-to-r from-indigo-50/50 dark:from-indigo-950/20 to-indigo-50/10 dark:to-indigo-950/5 p-4.5 flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                              <BrainCircuit className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              <span>AI 智能强化解析与阅卷意见</span>
                            </div>
                            <div className="flex flex-col gap-2 text-xs">
                              {mis.aiComment && (
                                <div className="text-slate-750 dark:text-slate-300 leading-relaxed">
                                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold">[AI 指导] </span>
                                  {mis.aiComment}
                                </div>
                              )}
                              {mis.reviewerComment && (
                                <div className="text-slate-750 dark:text-slate-300 leading-relaxed pt-1.5 border-t border-indigo-100 dark:border-indigo-900/30">
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">[考官补充] </span>
                                  {mis.reviewerComment}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      ) : (
        /* ========================================================================= */
        /* ==================== 沉浸式全屏答题室 (Online Exam UI) ==================== */
        /* ========================================================================= */
        <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-50 flex flex-col animate-in fade-in zoom-in-95 duration-300 select-none text-slate-900 dark:text-slate-100">
          {/* 答题室头部栏 */}
          <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-650 dark:text-cyan-400 text-[10px] font-bold">
                在线考核
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 line-clamp-1 max-w-xs md:max-w-md">
                {activeExam.examTitle}
              </h2>
            </div>

            {/* 定时暂存和倒计时显示 */}
            <div className="flex items-center gap-6">
              {/* 云端暂存状态 */}
              <div className="flex items-center gap-1.5 text-[10px]">
                {saveStatus === 'saving' && (
                  <span className="text-slate-550 dark:text-slate-500 animate-pulse flex items-center gap-1">
                    <Save className="w-3.5 h-3.5 animate-spin" />
                    云端同步中...
                  </span>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold animate-bounce">
                    <CheckCircle className="w-3.5 h-3.5" />
                    进度已自动云端同步
                  </span>
                )}
                {saveStatus === 'idle' && (
                  <span className="text-slate-450 dark:text-slate-600 flex items-center gap-1">
                    <Save className="w-3.5 h-3.5" />
                    30秒自动云端备份
                  </span>
                )}
              </div>

              {/* 大倒计时钟 */}
              {timeLeft !== null && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-950/80 border border-slate-250 dark:border-slate-800">
                  <Clock className="w-4 h-4 text-cyan-650 dark:text-cyan-400 animate-pulse" />
                  <span className={`text-base font-mono font-bold ${timeLeft < 180 ? 'text-rose-600 dark:text-rose-400 animate-pulse' : 'text-cyan-655 dark:text-cyan-400'}`}>
                    {formatTime(timeLeft)}
                  </span>
                </div>
              )}

              {/* 暂退按钮 */}
              <button
                onClick={() => setShowExitConfirm(true)}
                className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-slate-100 hover:dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200 transition-all text-xs font-semibold"
              >
                暂存退出
              </button>
            </div>
          </header>

          {/* 答题室主体结构 */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧答题区 */}
            <main className="flex-1 p-6 md:p-12 overflow-y-auto flex flex-col justify-between">
              {/* 当前题目卡片 */}
              {activeExam.questions.length > 0 && (
                <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
                  {activeExam.questions[currentQuestionIndex].type === 'MULTIPLE' && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs md:text-sm font-semibold shadow-sm">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </span>
                      <span>提示：多选题有一个或多个答案</span>
                    </div>
                  )}
                  {/* 题目属性头 */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs font-mono text-slate-500">
                      第 {currentQuestionIndex + 1} / {activeExam.questions.length} 题
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-650 dark:text-cyan-400 text-[10px] font-bold">
                      {activeExam.questions[currentQuestionIndex].type === 'SINGLE' && '单选'}
                      {activeExam.questions[currentQuestionIndex].type === 'MULTIPLE' && '多选'}
                      {activeExam.questions[currentQuestionIndex].type === 'JUDGE' && '判断'}
                      {activeExam.questions[currentQuestionIndex].type === 'FILL' && '填空'}
                      {activeExam.questions[currentQuestionIndex].type === 'SHORT' && '简答'}
                    </span>
                    <span className="text-xs text-slate-550 dark:text-slate-500">
                      分值：{activeExam.questions[currentQuestionIndex].score}分
                    </span>
                    <span className="text-xs text-slate-550 dark:text-slate-500 hidden sm:inline">
                      依据条款：{activeExam.questions[currentQuestionIndex].knowledgePoint}
                    </span>
                  </div>

                  {/* 题干 */}
                  <h3 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 leading-relaxed pt-2">
                    {activeExam.questions[currentQuestionIndex].content}
                  </h3>

                  {/* 作答输入控件区 */}
                  <div className="mt-4 flex flex-col gap-4">
                    {/* 1. 单选题 (SINGLE) */}
                    {activeExam.questions[currentQuestionIndex].type === 'SINGLE' &&
                      activeExam.questions[currentQuestionIndex].options && (
                        <div className="flex flex-col gap-3">
                          {activeExam.questions[currentQuestionIndex].options!.map((opt) => {
                            const letter = opt.trim()[0]; // 获取 A, B, C, D
                            const isSelected = tempAnswers[activeExam.questions[currentQuestionIndex].id] === letter;

                            return (
                              <button
                                key={opt}
                                onClick={() => handleSingleAnswer(activeExam.questions[currentQuestionIndex].id, letter)}
                                className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 flex items-center gap-3.5 ${
                                  isSelected
                                    ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-500 text-cyan-650 dark:text-cyan-400 shadow-md shadow-cyan-500/5'
                                    : 'bg-white dark:bg-slate-900/40 border border-slate-250 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-900 hover:border-slate-350 hover:dark:border-slate-705'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold font-mono transition-all ${
                                  isSelected
                                    ? 'bg-cyan-500 border-cyan-500 text-white dark:text-slate-950'
                                    : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {letter}
                                </div>
                                <span className="text-sm font-medium">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                    {/* 2. 多选题 (MULTIPLE) */}
                    {activeExam.questions[currentQuestionIndex].type === 'MULTIPLE' &&
                      activeExam.questions[currentQuestionIndex].options && (
                        <div className="flex flex-col gap-3">
                          {activeExam.questions[currentQuestionIndex].options!.map((opt) => {
                            const letter = opt.trim()[0];
                            const currentVal = tempAnswers[activeExam.questions[currentQuestionIndex].id] || '';
                            const isSelected = currentVal.split(',').map(x => x.trim()).includes(letter);

                            return (
                              <button
                                key={opt}
                                onClick={() => handleMultipleAnswer(activeExam.questions[currentQuestionIndex].id, letter, !isSelected)}
                                className={`w-full text-left px-5 py-4 rounded-xl border transition-all duration-200 flex items-center gap-3.5 ${
                                  isSelected
                                    ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-500 text-cyan-650 dark:text-cyan-400 shadow-md shadow-cyan-500/5'
                                    : 'bg-white dark:bg-slate-900/40 border border-slate-250 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-900 hover:border-slate-350 hover:dark:border-slate-705'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded border flex items-center justify-center text-xs font-bold font-mono transition-all ${
                                  isSelected
                                    ? 'bg-cyan-500 border-cyan-500 text-white dark:text-slate-950'
                                    : 'border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {letter}
                                </div>
                                <span className="text-sm font-medium">{opt}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                    {/* 3. 判断题 (JUDGE) */}
                    {activeExam.questions[currentQuestionIndex].type === 'JUDGE' && (
                      <div className="grid grid-cols-2 gap-4">
                        {['正确', '错误'].map((val) => {
                          const isSelected = tempAnswers[activeExam.questions[currentQuestionIndex].id] === val;

                          return (
                            <button
                              key={val}
                              onClick={() => handleSingleAnswer(activeExam.questions[currentQuestionIndex].id, val)}
                              className={`py-6 rounded-xl border transition-all duration-200 text-sm font-bold flex flex-col items-center gap-3 ${
                                isSelected
                                  ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-500 text-cyan-650 dark:text-cyan-400 shadow-md shadow-cyan-500/5'
                                  : 'bg-white dark:bg-slate-900/40 border border-slate-250 dark:border-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 hover:dark:bg-slate-900 hover:border-slate-350 hover:dark:border-slate-705'
                              }`}
                            >
                              <span className="text-base">{val}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 4. 填空题 (FILL) */}
                    {activeExam.questions[currentQuestionIndex].type === 'FILL' && (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">请在此输入答案（若有多个空，请用分号分隔）：</label>
                        <input
                          type="text"
                          value={tempAnswers[activeExam.questions[currentQuestionIndex].id] || ''}
                          onChange={(e) => handleSingleAnswer(activeExam.questions[currentQuestionIndex].id, e.target.value)}
                          placeholder="请输入您的填空作答内容"
                          className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:border-cyan-500 focus:outline-none transition-colors"
                        />
                      </div>
                    )}

                    {/* 5. 简答题 (SHORT) */}
                    {activeExam.questions[currentQuestionIndex].type === 'SHORT' && (
                      <div className="flex flex-col gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400 font-medium">请详细说明并写下您的作答（支持长篇输入）：</label>
                        <textarea
                          rows={8}
                          value={tempAnswers[activeExam.questions[currentQuestionIndex].id] || ''}
                          onChange={(e) => handleSingleAnswer(activeExam.questions[currentQuestionIndex].id, e.target.value)}
                          placeholder="此处填写简答题描述，请尽量贴合产品标准条款要求..."
                          className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-100 text-sm focus:border-cyan-500 focus:outline-none transition-colors resize-none leading-relaxed"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 底部前后导航按钮 */}
              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/40 w-full max-w-3xl mx-auto flex justify-between items-center">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-800 text-slate-750 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 hover:dark:bg-slate-900 hover:text-slate-900 hover:dark:text-slate-100 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                >
                  上一题
                </button>

                <div className="text-xs font-mono text-slate-500">
                  当前作答状态：{tempAnswers[activeExam.questions[currentQuestionIndex].id] ? '已填写' : '未作答'}
                </div>

                {currentQuestionIndex === activeExam.questions.length - 1 ? (
                  <button
                    onClick={() => setShowSubmitConfirm(true)}
                    className="px-5 py-2.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-md shadow-rose-500/10 transition-all flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>交卷</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                    className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-855 hover:bg-slate-200 hover:dark:bg-slate-800 text-cyan-655 dark:text-cyan-400 border border-slate-200 dark:border-slate-850 hover:border-cyan-300 hover:dark:border-cyan-500/30 text-xs font-semibold transition-all"
                  >
                    下一题
                  </button>
                )}
              </div>
            </main>

            {/* 右侧悬浮答题卡栏 */}
            <aside className="w-80 border-l border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/30 p-6 flex flex-col justify-between hidden lg:flex">
              <div className="flex flex-col gap-6">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">答题卡网格</h4>

                {/* 题号网格 */}
                <div className="grid grid-cols-5 gap-2.5">
                  {activeExam.questions.map((q, idx) => {
                    const hasAnswer = !!tempAnswers[q.id];
                    const isCurrent = idx === currentQuestionIndex;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQuestionIndex(idx)}
                        className={`h-10 rounded-lg text-xs font-mono font-bold border transition-all flex items-center justify-center ${
                          isCurrent
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-md shadow-cyan-500/20 scale-105'
                            : hasAnswer
                            ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-250 dark:border-slate-800'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 答题卡底部提交按钮 */}
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-600 hover:to-indigo-700 text-white text-xs font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all flex items-center justify-center gap-1.5 mt-6"
              >
                <Send className="w-4 h-4" />
                <span>立即提交试卷</span>
              </button>
            </aside>
          </div>

          {/* 暂退确认弹窗 (Modal) */}
          {showExitConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 text-amber-500">
                  <AlertCircle className="w-6 h-6" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">确认暂存退出？</h4>
                </div>
                <p className="text-xs text-slate-655 dark:text-slate-400 leading-relaxed">
                  您的当前答题进度将被云端同步保存。在考核截止时间前，您随时可以重新进入继续作答。
                </p>
                <div className="flex justify-end gap-3 text-xs pt-2">
                  <button
                    onClick={() => setShowExitConfirm(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    继续作答
                  </button>
                  <button
                    onClick={async () => {
                      await saveExamProgress(false);
                      setActiveExam(null);
                      setTimeLeft(null);
                      setTempAnswers({});
                      setShowExitConfirm(false);
                      loadData();
                    }}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors"
                  >
                    同步退出
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 交卷确认弹窗 (Modal) */}
          {showSubmitConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500">
                  <AlertCircle className="w-6 h-6" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">确认提交试卷？</h4>
                </div>
                <p className="text-xs text-slate-655 dark:text-slate-400 leading-relaxed">
                  提交后，考卷将进入阅卷锁定状态，无法再次进入修改。系统将自动打分，若包含主观题则将异步唤醒 AI 判卷。
                </p>
                <div className="flex justify-end gap-3 text-xs pt-2">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      setShowSubmitConfirm(false);
                      await saveExamProgress(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold transition-colors"
                  >
                    确定交卷
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ==================== 考核报告查看详情 Modal ==================== */}
      {/* ========================================================================= */}
      {showReportModal && reportDetail && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[85vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal 头 */}
            <header className="px-6 py-4 border-b border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Award className="w-5.5 h-5.5 text-cyan-600 dark:text-cyan-400" />
                <div className="flex flex-col">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{reportDetail.taskTitle}</h3>
                  <span className="text-[10px] text-slate-500 font-mono">试卷名称：{reportDetail.examTitle}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportDetail(null);
                }}
                className="w-7.5 h-7.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 hover:dark:bg-slate-750 text-slate-600 dark:text-slate-400 hover:text-slate-800 hover:dark:text-slate-200 flex items-center justify-center transition-colors text-xs"
              >
                ✕
              </button>
            </header>

            {/* Modal 内容 */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto flex flex-col gap-6">
              {/* 得分卡片 */}
              <div className="rounded-xl border border-cyan-200 dark:border-cyan-500/20 bg-gradient-to-r from-cyan-50 dark:from-cyan-950/15 to-indigo-50/10 dark:to-indigo-950/10 p-5 flex justify-between items-center">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">考生成绩结果</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-2xl font-black text-cyan-650 dark:text-cyan-400 font-mono">{reportDetail.score}</span>
                    <span className="text-xs text-slate-500">/ 满分</span>
                    {reportDetail.status === 'SUBMITTED' && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold font-sans">
                        （仅含客观题得分，主观题评阅中）
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 font-mono text-right flex flex-col gap-1">
                  <span>交卷时间：{reportDetail.submittedAt ? new Date(reportDetail.submittedAt).toLocaleString('zh-CN') : '--'}</span>
                  <span>评阅时间：{reportDetail.gradedAt ? new Date(reportDetail.gradedAt).toLocaleString('zh-CN') : '阅卷审核中'}</span>
                </div>
              </div>

              {/* 题目报告列表 */}
              <div className="flex flex-col gap-5">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-400 tracking-wider border-b border-slate-250 dark:border-slate-800 pb-2">试题批阅详情</h4>

                {reportDetail.questions.map((q, idx) => (
                  <div key={q.id} className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-850 flex flex-col gap-4">
                    {/* 题号类型和得分 */}
                    <div className="flex justify-between items-center gap-3 border-b border-slate-200 dark:border-slate-900/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">第 {idx + 1} 题</span>
                        <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-650 dark:text-cyan-400 text-[10px] font-bold">
                          {q.type === 'SINGLE' && '单选'}
                          {q.type === 'MULTIPLE' && '多选'}
                          {q.type === 'JUDGE' && '判断'}
                          {q.type === 'FILL' && '填空'}
                          {q.type === 'SHORT' && '简答'}
                        </span>
                        <span className="text-xs text-slate-500">（依据条款：{q.knowledgePoint}）</span>
                      </div>

                      {/* 得分与对错徽章 */}
                      <div className="flex items-center gap-2 text-xs">
                        {['FILL', 'SHORT'].includes(q.type) && reportDetail.status === 'SUBMITTED' ? (
                          <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 font-sans">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span>主观题评阅中</span>
                          </span>
                        ) : q.isCorrect ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 font-mono">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {q.userScore}分 (满分)
                          </span>
                        ) : (
                          <span className="text-slate-800 dark:text-slate-300 font-semibold flex items-center gap-1 font-mono">
                            得分：
                            <span className={q.userScore && q.userScore > 0 ? 'text-cyan-650 dark:text-cyan-400' : 'text-rose-600 dark:text-rose-400'}>
                              {q.userScore}分
                            </span>
                            / {q.score}分
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 题干 */}
                    <p className="text-sm text-slate-900 dark:text-slate-200 font-semibold">{q.content}</p>

                    {/* 选项 */}
                    {q.options && Array.isArray(q.options) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pl-3">
                        {q.options.map((opt) => (
                          <div
                            key={opt}
                            className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-900/60 bg-white dark:bg-slate-900/10 text-xs text-slate-600 dark:text-slate-400"
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 答案比对 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-white dark:bg-slate-950/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-900 text-xs font-mono text-slate-700 dark:text-slate-300">
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500">我的答案：</span>
                        <span className={`font-semibold ${q.isCorrect ? 'text-emerald-600' : 'text-rose-600 dark:text-rose-400'} break-words`}>
                          {q.userAnswer || '[未填]'}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-slate-500">标准答案：</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-300 break-words">
                          {q.correctAnswer}
                        </span>
                      </div>
                    </div>

                    {/* 标准解析与依据 */}
                    {q.explanation && (
                      <div className="pl-3.5 border-l-2 border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-455 leading-relaxed">
                        <strong className="text-slate-800 dark:text-slate-400 font-semibold">标准参考解析：</strong>
                        {q.explanation}
                      </div>
                    )}

                    {/* AI 预评阅与复核批改描述 */}
                    {(q.aiComment || q.reviewerComment) && (
                      <div className="rounded-lg border border-indigo-200 dark:border-indigo-500/10 bg-indigo-50/50 dark:bg-indigo-950/15 p-3.5 text-xs flex flex-col gap-2">
                        {q.aiComment && (
                          <div className="text-slate-750 dark:text-slate-300 leading-relaxed">
                            <span className="text-indigo-650 dark:text-indigo-400 font-bold">[AI评阅预判]：</span>
                            (推荐{q.aiScore}分) {q.aiComment}
                          </div>
                        )}
                        {q.reviewerComment && (
                          <div className="text-slate-750 dark:text-slate-300 leading-relaxed border-t border-indigo-100 dark:border-indigo-900/25 pt-1.5">
                            <span className="text-amber-600 dark:text-amber-400 font-bold">[出题员复核]：</span>
                            {q.reviewerComment}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal 底 */}
            <header className="px-6 py-4 border-t border-slate-250 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex justify-end">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportDetail(null);
                }}
                className="px-5 py-2 rounded-lg bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 hover:dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-250 dark:border-slate-855 transition-colors text-xs font-semibold"
              >
                关闭报告
              </button>
            </header>
          </div>
        </div>
      )}
    </div>
  );
}
