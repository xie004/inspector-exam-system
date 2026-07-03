'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Cpu,
  Calendar,
  ClipboardCheck,
  BarChart3,
  Plus,
  Trash2,
  Upload,
  Eye,
  RefreshCw,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Info,
  LogOut,
  Save,
  BookOpen
} from 'lucide-react';

// 引入 Recharts 图表 (带客户端水合防护)
import {
  BarChart,
  Bar,
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

interface Standard {
  id: string;
  title: string;
  fileType: string;
  filePath: string;
  extractedTextLen: number;
  departmentName: string;
  status: string;
  progress: string;
  errorMsg: string | null;
  createdAt: string;
}

interface Exam {
  id: string;
  title: string;
  timeLimit: number;
  standardTitle: string;
  questionCount: number;
  status: string;
  progress: string;
  errorMsg: string | null;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  examId: string;
  examTitle: string;
  questionCount: number;
  startTime: string;
  endTime: string;
  timeLimit: number;
  recordCount: number;
  status: 'UPCOMING' | 'PUBLISHED' | 'ENDED';
  type: 'EXAM' | 'TRAINING';
}

interface RecordRow {
  id: string;
  taskTitle: string;
  examTitle: string;
  examineeName: string;
  examineeEmployeeId: string;
  examineeSection: string;
  score: number;
  status: 'ONGOING' | 'SUBMITTED' | 'GRADED';
  submittedAt: string | null;
  aiProgress?: string;
}

interface GeneratedQuestion {
  type: 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'FILL' | 'SHORT';
  content: string;
  options: string[] | null;
  correctAnswer: string;
  score: number;
  explanation: string;
  knowledgePoint: string;
}

interface GradingDetail {
  id: string;
  questionId: string;
  type: 'SINGLE' | 'MULTIPLE' | 'JUDGE' | 'FILL' | 'SHORT';
  content: string;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  knowledgePoint: string;
  maxScore: number;
  answerContent: string;
  score: number;
  isCorrect: boolean;
  aiScore: number | null;
  aiComment: string | null;
  reviewerComment: string | null;
}

export default function CreatorDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'standards' | 'generate' | 'tasks' | 'grading' | 'stats'>('overview');
  const [mounted, setMounted] = useState(false); // 解决 Recharts SSR 水合不匹配问题

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

  // 出题员个人信息
  const [creatorInfo, setCreatorInfo] = useState({
    realName: '',
    employeeId: '',
    departmentName: '',
    departmentId: '',
  });

  // 全局数据状态
  const [standards, setStandards] = useState<Standard[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [records, setRecords] = useState<RecordRow[]>([]);
  
  // 统计图表数据
  const [statsType, setStatsType] = useState<'EXAM' | 'TRAINING'>('EXAM');
  const [statsSummary, setStatsSummary] = useState({
    averageScore: 0,
    passRate: 0,
    maxScore: 0,
    minScore: 0,
    totalExams: 0,
  });
  const [statsDistribution, setStatsDistribution] = useState<any[]>([]);
  const [statsTopErrors, setStatsTopErrors] = useState<any[]>([]);
  const [statsMastery, setStatsMastery] = useState<any[]>([]);

  // 全局加载与提示
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. 获取登录者身份和初始数据
  useEffect(() => {
    setMounted(true);
    // 初始化加载 localStorage 缓存
    const savedTheme = localStorage.getItem('ias-theme') as 'dark' | 'light' | 'system' || 'dark';
    const savedFontSize = localStorage.getItem('ias-font-size') as 'sm' | 'md' | 'lg' || 'sm';
    setTheme(savedTheme);
    setFontSize(savedFontSize);
    applyTheme(savedTheme);
    applyFontSize(savedFontSize);
    const fetchCreatorProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.success) {
          setCreatorInfo({
            realName: data.user.realName,
            employeeId: data.user.employeeId,
            departmentName: data.user.department?.name || '未绑定部门',
            departmentId: data.user.departmentId || '',
          });
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchCreatorProfile();
  }, [router]);

  // 定期拉取核心数据
  const loadCoreData = async () => {
    if (!creatorInfo.departmentId) return;
    try {
      setLoading(true);
      // 标准
      const stdRes = await fetch('/api/creator/standards');
      if (stdRes.ok) {
        const d = await stdRes.json();
        setStandards(d.standards || []);
      }
      // 试卷
      const exRes = await fetch('/api/creator/exams');
      if (exRes.ok) {
        const d = await exRes.json();
        setExams(d.exams || []);
      }
      // 任务
      const tRes = await fetch('/api/creator/tasks');
      if (tRes.ok) {
        const d = await tRes.json();
        setTasks(d.tasks || []);
      }
      // 答卷记录
      const rRes = await fetch('/api/creator/records');
      if (rRes.ok) {
        const d = await rRes.json();
        setRecords(d.records || []);
      }
      // 统计分析
      const sRes = await fetch(`/api/creator/stats?type=${statsType}`);
      if (sRes.ok) {
        const d = await sRes.json();
        setStatsSummary(d.summary);
        setStatsDistribution(d.distribution);
        setStatsTopErrors(d.topErrors);
        setStatsMastery(d.mastery);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (creatorInfo.departmentId) {
      loadCoreData();
    }
  }, [creatorInfo.departmentId, activeTab, statsType]);

  // 实时轮询异步状态 (标准OCR、AI出题、AI阅卷)
  useEffect(() => {
    if (!creatorInfo.departmentId) return;

    const hasActiveTask = 
      standards.some(s => s.status === 'PROCESSING') ||
      exams.some(e => e.status === 'GENERATING') ||
      records.some(r => r.status === 'SUBMITTED');

    if (!hasActiveTask) return;

    const interval = setInterval(async () => {
      try {
        const stdRes = await fetch('/api/creator/standards');
        if (stdRes.ok) {
          const d = await stdRes.json();
          setStandards(d.standards || []);
        }
        const exRes = await fetch('/api/creator/exams');
        if (exRes.ok) {
          const d = await exRes.json();
          setExams(d.exams || []);
        }
        const rRes = await fetch('/api/creator/records');
        if (rRes.ok) {
          const d = await rRes.json();
          setRecords(d.records || []);
        }
      } catch (err) {
        console.error('轮询后台状态失败:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [standards, exams, records, creatorInfo.departmentId]);

  const triggerMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // 登出
  const handleLogout = async () => {
    if (confirm('确认退出出题员考务中心？')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    }
  };

  // =========================================================================
  // ============================ 标准文献库管理 ============================
  // =========================================================================
  const [uploading, setUploading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 文献预览
  const [previewStandard, setPreviewStandard] = useState<Standard | null>(null);
  const [previewText, setPreviewText] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', uploadTitle.trim());

    setUploading(true);
    setUploadWarning(null);
    try {
      const res = await fetch('/api/creator/standards', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isWarning) {
          // 扫描版 PDF 预警
          setUploadWarning(data.message);
          triggerMessage('error', '上传成功，但检测为扫描件');
        } else {
          triggerMessage('success', '产品标准文献上传并高精度文字提取成功！');
          setUploadTitle('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '解析标准文献失败');
      }
    } catch (err) {
      triggerMessage('error', '网络异常，上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStandard = async (id: string, title: string) => {
    if (!confirm(`警告：您确认要下架并删除标准 [${title}] 吗？\n删除标准后，服务器上的物理文件和解析文本将被彻底清空回收。`)) return;
    try {
      const res = await fetch(`/api/creator/standards/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '标准文献已成功下架并彻底清理物理空间！');
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '删除失败');
      }
    } catch (err) {
      triggerMessage('error', '连接网络失败');
    }
  };

  const handlePreviewText = async (std: Standard) => {
    setPreviewStandard(std);
    setLoadingPreview(true);
    setPreviewText('');
    try {
      const res = await fetch(`/api/creator/standards/${std.id}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewText(data.standard.extractedText || '该标准文献无提取到的纯文本。');
      } else {
        setPreviewText(data.error || '获取标准详情失败。');
      }
    } catch (err) {
      console.error(err);
      setPreviewText('连接服务器网络异常，请稍后再试。');
    } finally {
      setLoadingPreview(false);
    }
  };

  // =========================================================================
  // ========================= 智能出题 Wizard 控制 =========================
  // =========================================================================
  const [genStep, setGenStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedStdId, setSelectedStdId] = useState('');
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [examForm, setExamForm] = useState({
    title: '',
    timeLimit: 90,
  });

  // 题型配置状态
  const [questionConfigs, setQuestionConfigs] = useState<Record<string, { count: number; score: number; active: boolean }>>({
    SINGLE: { count: 5, score: 2, active: true },
    MULTIPLE: { count: 3, score: 4, active: true },
    JUDGE: { count: 5, score: 2, active: true },
    FILL: { count: 2, score: 3, active: false },
    SHORT: { count: 1, score: 10, active: false },
  });

  // 生成的题目列表供第四步微调
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);

  // 自动计算当前配置的满分分值
  const calculateTotalScore = () => {
    return Object.keys(questionConfigs).reduce((sum, type) => {
      const cfg = questionConfigs[type];
      return sum + (cfg.active ? cfg.count * cfg.score : 0);
    }, 0);
  };

  const handleToggleConfig = (type: string) => {
    setQuestionConfigs(prev => ({
      ...prev,
      [type]: { ...prev[type], active: !prev[type].active }
    }));
  };

  const handleConfigChange = (type: string, field: 'count' | 'score', val: number) => {
    setQuestionConfigs(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: val }
    }));
  };

  // 开始 AI 智能命题
  const handleStartAIGeneration = async () => {
    if (!selectedStdId) {
      triggerMessage('error', '请先选择出题命题所依据的标准文献！');
      return;
    }
    if (!examForm.title.trim()) {
      triggerMessage('error', '请填写拟定试卷的考核名称！');
      return;
    }
    const isDuplicate = exams.some(e => e.title === examForm.title.trim());
    if (isDuplicate) {
      triggerMessage('error', '考核试卷名称已存在，请使用其他名称！');
      return;
    }

    // 过滤出启用的题型
    const configPayload: any = {};
    Object.keys(questionConfigs).forEach(type => {
      const cfg = questionConfigs[type];
      if (cfg.active && cfg.count > 0) {
        configPayload[type] = { count: cfg.count, score: cfg.score };
      }
    });

    if (Object.keys(configPayload).length === 0) {
      triggerMessage('error', '请至少启用并配置一种题型的出题数量！');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/creator/exams/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standardId: selectedStdId,
          title: examForm.title.trim(),
          timeLimit: examForm.timeLimit,
          config: configPayload,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        triggerMessage('success', data.message || '大模型后台出题任务已启动！请在下方列表查看实时进度。');
        // 重置出题向导状态
        setGenStep(1);
        setSelectedStdId('');
        setEditingExamId(null);
        setExamForm({ title: '', timeLimit: 90 });
        setGeneratedQuestions([]);
        setActiveTab('tasks'); // 跳转到任务/试卷管理 Tab 方便看进度
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '启动大模型出题失败');
      }
    } catch (err) {
      triggerMessage('error', '智能出题服务连接异常');
    } finally {
      setLoading(false);
    }
  };

  // 调整题目数据
  const handleQuestionTextChange = (index: number, field: keyof GeneratedQuestion, value: any) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleOptionTextChange = (qIndex: number, optIndex: number, val: string) => {
    setGeneratedQuestions(prev => {
      const copy = [...prev];
      const q = copy[qIndex];
      if (q.options) {
        const optCopy = [...q.options];
        optCopy[optIndex] = val;
        copy[qIndex] = { ...q, options: optCopy };
      }
      return copy;
    });
  };

  const handleDeleteGeneratedQuestion = (index: number) => {
    if (!confirm('确认移除这道题目吗？此操作不可撤销。')) return;
    setGeneratedQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // 添加一道新题
  const handleAddNewQuestion = () => {
    const newQ: GeneratedQuestion = {
      type: 'SINGLE',
      content: '新命题题干描述',
      options: ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
      correctAnswer: 'A',
      score: 2,
      explanation: '标准原文解析依据说明',
      knowledgePoint: '关联标准条款'
    };
    setGeneratedQuestions(prev => [...prev, newQ]);
  };

  // 保存整套试卷落库
  const handleSaveExamPaper = async () => {
    if (generatedQuestions.length === 0) {
      triggerMessage('error', '试卷中不能包含 0 道题目！');
      return;
    }
    const isDuplicate = exams.some(e => e.title === examForm.title.trim() && e.id !== editingExamId);
    if (isDuplicate) {
      triggerMessage('error', '考核试卷名称已存在，请使用其他名称！');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/creator/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingExamId,
          title: examForm.title.trim(),
          standardId: selectedStdId,
          timeLimit: examForm.timeLimit,
          questions: generatedQuestions,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerMessage('success', '试卷及旗下题库已保存归档！');
        // 重置 Wizard 状态
        setGenStep(1);
        setSelectedStdId('');
        setEditingExamId(null);
        setExamForm({ title: '', timeLimit: 90 });
        setGeneratedQuestions([]);
        setActiveTab('tasks'); // 跳转回任务与试卷管理页
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '保存试卷失败');
      }
    } catch (err) {
      triggerMessage('error', '连接网络异常，保存失败');
    } finally {
      setLoading(false);
    }
  };

  // 载入已有试卷进入微调编辑状态
  const handleLoadExamToEdit = async (examId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/creator/exams/${examId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingExamId(data.exam.id);
        setExamForm({
          title: data.exam.title,
          timeLimit: data.exam.timeLimit,
        });
        setSelectedStdId(data.exam.standardId || '');
        setGeneratedQuestions(data.exam.questions || []);
        setGenStep(4); // 直接进入预览编辑步骤
        setActiveTab('generate'); // 切换到出题 Tab
      } else {
        triggerMessage('error', data.error || '获取试卷详情失败');
      }
    } catch (err) {
      triggerMessage('error', '获取试卷详情网络错误');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // ============================ 考务与推送管理 ============================
  // =========================================================================
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    startTime: '',
    endTime: '',
    timeLimit: 90,
    type: 'EXAM' as 'EXAM' | 'TRAINING',
  });

  const handlePublishTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/creator/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: selectedExamId,
          title: taskForm.title,
          startTime: taskForm.startTime,
          endTime: taskForm.endTime,
          timeLimit: taskForm.timeLimit,
          type: taskForm.type,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerMessage('success', '能力考核任务发布并推送成功！同部门考生已收到通知。');
        setShowPublishModal(false);
        setTaskForm({ title: '', startTime: '', endTime: '', timeLimit: 90, type: 'EXAM' });
        setSelectedExamId('');
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '发布任务失败');
      }
    } catch (err) {
      triggerMessage('error', '连接服务器网络失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (id: string, title: string) => {
    if (!confirm(`您确信要下架并删除考试任务 [${title}] 吗？`)) return;
    try {
      const res = await fetch(`/api/creator/tasks/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '考核任务删除成功！');
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '删除失败');
      }
    } catch (err) {
      triggerMessage('error', '连接网络失败');
    }
  };

  // 删除试卷
  const handleDeleteExam = async (id: string, title: string) => {
    if (!confirm(`确认要物理删除整套试卷 [${title}] 及旗下所有题目吗？`)) return;
    try {
      const res = await fetch(`/api/creator/exams/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '试卷及旗下关联题库已级联原子化物理清空！');
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '删除失败');
      }
    } catch (err) {
      triggerMessage('error', '网络失败');
    }
  };

  // =========================================================================
  // ============================ AI 辅助在线阅卷室 ============================
  // =========================================================================
  const [showGradingModal, setShowGradingModal] = useState(false);
  const [gradingRecord, setGradingRecord] = useState<any | null>(null);
  const [gradingAnswers, setGradingAnswers] = useState<GradingDetail[]>([]);
  const [loadingGradingDetail, setLoadingGradingDetail] = useState(false);

  // 打开阅卷
  const openGradingRoom = async (recordId: string) => {
    setShowGradingModal(true);
    setLoadingGradingDetail(true);
    setGradingRecord(null);
    setGradingAnswers([]);
    try {
      const res = await fetch(`/api/creator/records/${recordId}/grade`);
      const data = await res.json();
      if (res.ok && data.success) {
        setGradingRecord(data.record);
        
        // 智能自动铺设得分：如果该题目尚未人工阅卷，且有 AI 预判得分，默认预设为 AI 推荐分数，极速一键通过！
        const initializedAnswers = data.record.answers.map((ans: GradingDetail) => ({
          ...ans,
          // 若 score 还没批改过（即状态是 SUBMITTED 且分数为 0 且它是主观题），我们给它预设 AI 推荐分
          score: (data.record.status === 'SUBMITTED' && ans.aiScore !== null && ans.score === 0) 
            ? ans.aiScore 
            : ans.score
        }));
        
        setGradingAnswers(initializedAnswers);
      } else {
        triggerMessage('error', data.error || '拉取答卷详情失败');
        setShowGradingModal(false);
      }
    } catch (err) {
      triggerMessage('error', '网络异常，无法进入阅卷室');
      setShowGradingModal(false);
    } finally {
      setLoadingGradingDetail(false);
    }
  };

  // 修改阅卷分数
  const handleGradingScoreChange = (index: number, scoreVal: number) => {
    setGradingAnswers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], score: scoreVal };
      return copy;
    });
  };

  // 修改人工评语
  const handleGradingCommentChange = (index: number, val: string) => {
    setGradingAnswers(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], reviewerComment: val };
      return copy;
    });
  };

  // 计算当前阅卷总分
  const calculateCurrentGradingTotal = () => {
    return gradingAnswers.reduce((sum, ans) => sum + ans.score, 0);
  };

  // 提交批改结果
  const handleSubmitGrading = async () => {
    if (!gradingRecord) return;
    setLoading(true);
    
    // 构造载荷
    const payload = gradingAnswers.map(ans => ({
      answerId: ans.id,
      score: ans.score,
      reviewerComment: ans.reviewerComment || '',
    }));

    try {
      const res = await fetch(`/api/creator/records/${gradingRecord.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerMessage('success', '考卷阅卷评分提交并发布成功！');
        setShowGradingModal(false);
        setGradingRecord(null);
        setGradingAnswers([]);
        loadCoreData();
      } else {
        triggerMessage('error', data.error || '提交阅卷评分失败');
      }
    } catch (err) {
      triggerMessage('error', '连接网络异常');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#030712] dark:text-slate-100 flex font-sans transition-colors duration-300 relative overflow-hidden">
      {/* 顶部消息 */}
      {message && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border flex items-center gap-2 shadow-lg animate-slide-in-right ${
          message.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400' 
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span className="text-xs font-medium">{message.text}</span>
        </div>
      )}

      {/* 背景发光 */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-600/5 blur-[100px] pointer-events-none" />

      {/* 侧边栏 */}
      <aside className="w-64 border-r border-slate-200 dark:border-white/[0.06] bg-slate-100/60 dark:bg-[#090d16]/40 backdrop-blur-md flex flex-col justify-between shrink-0 z-10 transition-colors duration-300">
        <div>
          {/* Logo */}
          <div className="p-6 border-b border-slate-200 dark:border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-red-500 to-rose-650 p-[1px]">
                <div className="w-full h-full bg-slate-50 dark:bg-[#0b0f19] rounded-lg flex items-center justify-center">
                  <span className="text-xs font-black text-red-500 font-sans">GQI</span>
                </div>
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">考务与出题中心</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate max-w-[140px]">{creatorInfo.departmentName}</p>
              </div>
            </div>
          </div>

          {/* 导航 */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              看板概览
            </button>

            <button
              onClick={() => setActiveTab('standards')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'standards'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              标准文献库
            </button>

            <button
              onClick={() => {
                setGenStep(1);
                setActiveTab('generate');
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'generate'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <Cpu className="w-4 h-4" />
              AI 智能出题
            </button>

            <button
              onClick={() => setActiveTab('tasks')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'tasks'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <Calendar className="w-4 h-4" />
              考务发布
            </button>

            <button
              onClick={() => setActiveTab('grading')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'grading'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              AI 阅卷室
              {records.filter(r => r.status === 'SUBMITTED').length > 0 && (
                <span className="ml-auto w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-slate-900 dark:text-white flex items-center justify-center animate-bounce">
                  {records.filter(r => r.status === 'SUBMITTED').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'stats'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              部门数据分析
            </button>
          </nav>

          {/* 个性化设置卡片 */}
          <div className="mx-4 p-4 rounded-xl bg-slate-200/50 dark:bg-white/5 border border-slate-300/60 dark:border-white/10 flex flex-col gap-3 text-xs transition-all">
            <div className="text-[10px] text-slate-500 dark:text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">个性化设置</div>
            
            {/* 配色主题切换 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-slate-500 dark:text-slate-500 dark:text-slate-400 text-[9px]">配色主题</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-300/60 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-300 dark:border-slate-800/85">
                {(['dark', 'light', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleThemeChange(t)}
                    className={`py-1 rounded-md text-[9px] font-medium transition-all ${
                      theme === t
                        ? 'bg-white dark:bg-cyan-500/10 border border-slate-300 dark:border-cyan-500/35 text-cyan-600 dark:text-cyan-400 font-semibold shadow-sm'
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
              <span className="text-slate-500 dark:text-slate-500 dark:text-slate-400 text-[9px]">系统字体大小</span>
              <div className="grid grid-cols-3 gap-1 bg-slate-300/60 dark:bg-slate-950/50 p-1 rounded-lg border border-slate-300 dark:border-slate-800/85">
                {(['sm', 'md', 'lg'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => handleFontSizeChange(sz)}
                    className={`py-1 rounded-md text-[9px] font-medium transition-all ${
                      fontSize === sz
                        ? 'bg-white dark:bg-cyan-500/10 border border-slate-300 dark:border-cyan-500/35 text-cyan-600 dark:text-cyan-400 font-semibold shadow-sm'
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

        {/* 底部出题员资料 */}
        <div className="p-4 border-t border-slate-205 dark:border-white/[0.06] bg-slate-100/80 dark:bg-black/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-650 dark:text-blue-400">
                师
              </div>
              <div className="truncate max-w-[120px]">
                <p className="text-xs font-medium text-slate-900 dark:text-white">{creatorInfo.realName || '出题老师'}</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-500">工号: {creatorInfo.employeeId}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-600 dark:text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-200"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* 主面板内容 */}
      <main className="flex-1 overflow-y-auto p-8 z-10">
        {/* 顶部标题 */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">
              {activeTab === 'overview' && '考务综合看板'}
              {activeTab === 'standards' && '产品检验标准文献库'}
              {activeTab === 'generate' && 'AI 智能命题向导'}
              {activeTab === 'tasks' && '考核任务发布中心'}
              {activeTab === 'grading' && 'AI 智能辅助阅卷室'}
              {activeTab === 'stats' && '部门检验技能数据分析'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {activeTab === 'overview' && '在此监控本部门考试进度、待批试卷，并查看最新考生成绩反馈。'}
              {activeTab === 'standards' && '上传并归档文字版或扫描图片版产品标准，归档文件将被安全保存用作智能出题。'}
              {activeTab === 'generate' && '只需选择标准、指定题型，大模型将在几秒内研读规范并产出专业高标准的考题。'}
              {activeTab === 'tasks' && '将生成的试卷发布为考核任务，推送到考生端并设置截止时间和答卷限时。'}
              {activeTab === 'grading' && '主观题支持大模型自动预先打分、评估得分要点并生成评语。出题人一键确认。'}
              {activeTab === 'stats' && '基于全员考试得分，以图表直观分析错题率排行和对各项产品标准条款的掌握程度。'}
            </p>
          </div>

          <div className="flex gap-2">
            {activeTab === 'standards' && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="拟定标准简称 (例: GB/T 2828)"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-all duration-200 w-48"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 disabled:opacity-50 text-xs text-slate-900 dark:text-white font-medium rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/15 transition-all duration-200"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? '智能解析归档中...' : '归档新标准'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadFile}
                  accept=".pdf,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                />
              </div>
            )}
            {activeTab === 'tasks' && (
              <button
                onClick={() => {
                  if (exams.length === 0) {
                    alert('本部门暂无可用试卷，请先去“AI 智能出题”中生成一张试卷！');
                    return;
                  }
                  const now = new Date();
                  const oneYearLater = new Date();
                  oneYearLater.setFullYear(now.getFullYear() + 1);
                  const formatDatetime = (d: Date) => {
                    const tzoffset = d.getTimezoneOffset() * 60000;
                    return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
                  };
                  setTaskForm({
                    title: '',
                    startTime: formatDatetime(now),
                    endTime: formatDatetime(oneYearLater),
                    timeLimit: exams[0]?.timeLimit || 90,
                    type: 'EXAM',
                  });
                  setSelectedExamId(exams[0]?.id || '');
                  setShowPublishModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 text-xs text-slate-900 dark:text-white font-medium rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/15 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                发布新考试任务
              </button>
            )}
          </div>
        </header>

        {/* ==================== 标签页一：看板概览 ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* 三大指标磁贴 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="backdrop-blur-md bg-white dark:bg-white/[0.02] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 relative shadow-lg">
                <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium uppercase tracking-wider">待批改答卷</p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                  {records.filter(r => r.status === 'SUBMITTED').length}
                </p>
                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-amber-650 dark:text-amber-400" />
                  请进入“AI 阅卷室”进行一键确认评分
                </div>
              </div>

              <div className="backdrop-blur-md bg-white dark:bg-white/[0.02] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 relative shadow-lg">
                <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium uppercase tracking-wider">本部门考核均分</p>
                <p className="text-3xl font-bold text-blue-650 dark:text-blue-400 mt-2">{statsSummary.averageScore || 0} 分</p>
                <div className="mt-4 text-[10px] text-slate-600 dark:text-slate-400">
                  基于已评阅完的 {statsSummary.totalExams} 份答卷核算
                </div>
              </div>

              <div className="backdrop-blur-md bg-white dark:bg-white/[0.02] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 relative shadow-lg">
                <p className="text-[10px] text-slate-500 dark:text-slate-500 font-medium uppercase tracking-wider">考核合格率</p>
                <p className="text-3xl font-bold text-emerald-650 dark:text-emerald-400 mt-2">{statsSummary.passRate || 0}%</p>
                <div className="mt-4 text-[10px] text-slate-600 dark:text-slate-400 flex gap-2">
                  <span>最高: {statsSummary.maxScore}分</span>
                  <span>最低: {statsSummary.minScore}分</span>
                </div>
              </div>
            </div>

            {/* 核心排版：最近待阅试卷列表 */}
            <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <ClipboardCheck className="w-4.5 h-4.5 text-blue-650 dark:text-blue-400" />
                待评阅考卷队列
              </h3>
              {records.filter(r => r.status === 'SUBMITTED').length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-500">
                  目前暂无待批改的考卷。太棒了，考务工作已全部处理完毕！
                </div>
              ) : (
                <div className="space-y-3">
                  {records.filter(r => r.status === 'SUBMITTED').map((row) => (
                    <div key={row.id} className="flex justify-between items-center px-5 py-4 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none hover:border-white/[0.08] transition-all">
                      <div>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{row.examineeName}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-500 ml-2">工号: {row.examineeEmployeeId} | 科室: {row.examineeSection}</span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{row.taskTitle} ({row.examTitle})</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] text-slate-500 dark:text-slate-500">
                          交卷时间: {row.submittedAt ? new Date(row.submittedAt).toLocaleString('zh-CN') : '未知'}
                        </span>
                        <button
                          onClick={() => openGradingRoom(row.id)}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-xs font-medium text-slate-900 dark:text-white rounded-lg active:scale-95 transition-all shadow-md shadow-blue-600/10"
                        >
                          进入 AI 阅卷室
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== 标签页二：标准文献库 ==================== */}
        {activeTab === 'standards' && (
          <div className="space-y-6 animate-fade-in">
            {/* 上传预警横幅 */}
            {uploadWarning && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-650 dark:text-amber-400 text-xs flex gap-3 animate-shake">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold">扫描件预警提示</p>
                  <p className="mt-1 leading-relaxed text-[11px] opacity-90">{uploadWarning}</p>
                </div>
              </div>
            )}

            <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
              {loading ? (
                <div className="py-20 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  正在加载标准文献库...
                </div>
              ) : standards.length === 0 ? (
                <div className="py-20 text-center text-slate-500 dark:text-slate-500 space-y-3">
                  <HelpCircle className="w-10 h-10 mx-auto opacity-30 text-slate-600 dark:text-slate-400" />
                  <p className="text-xs">本部门文献库尚空空如也。</p>
                  <p className="text-[11px] text-slate-600">请使用右侧“归档新标准”按钮上传您的第一份 PDF/Word 或图片标准！</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-205 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">产品标准文献名称</th>
                        <th className="py-3 px-4">归档格式</th>
                        <th className="py-3 px-4">解析字符数</th>
                        <th className="py-3 px-4">上传时间</th>
                        <th className="py-3 px-4 text-right">管理操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/[0.04]">
                      {standards.map((std) => (
                        <tr key={std.id} className="text-xs text-slate-700 dark:text-slate-300 hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>{std.title}</span>
                              {std.status === 'FAILED' && (
                                <span className="text-[10px] text-red-500/80 mt-0.5">{std.errorMsg || '解析失败，请检查配置或重新上传'}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                              std.fileType === 'pdf' 
                                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                : std.fileType === 'docx' 
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-650 dark:text-blue-400'
                                  : 'bg-amber-500/10 border-amber-500/20 text-amber-650 dark:text-amber-400'
                            }`}>
                              {std.fileType.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-4 font-mono">
                            {std.status === 'PROCESSING' ? (
                              <span className="flex items-center gap-1.5 text-blue-650 dark:text-blue-400 font-semibold">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span className="animate-pulse">{std.progress || '正在解析...'}</span>
                              </span>
                            ) : std.status === 'FAILED' ? (
                              <span className="text-red-500 dark:text-red-400 font-semibold">
                                ❌ 归档失败
                              </span>
                            ) : (
                              `${std.extractedTextLen} 字`
                            )}
                          </td>
                          <td className="py-4 px-4 text-slate-500 dark:text-slate-500">
                            {new Date(std.createdAt).toLocaleString('zh-CN')}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handlePreviewText(std)}
                                disabled={std.status !== 'AVAILABLE'}
                                className={`p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none transition-all duration-150 ${
                                  std.status === 'AVAILABLE'
                                    ? 'text-slate-600 dark:text-slate-400 hover:text-blue-400 hover:border-blue-500/20 cursor-pointer'
                                    : 'text-slate-350 dark:text-slate-600 cursor-not-allowed opacity-50'
                                }`}
                                title={std.status === 'AVAILABLE' ? "预览标准提取出的纯文本" : "解析未完成，暂不可预览"}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteStandard(std.id, std.title)}
                                className="p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-600 dark:text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-all duration-150"
                                title="下架此标准"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== 标签页三：AI 智能出题 Wizard ==================== */}
        {activeTab === 'generate' && (
          <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-8 animate-fade-in relative min-h-[500px]">
            {/* 步骤条 */}
            <div className="flex items-center justify-center max-w-lg mx-auto mb-10">
              <div className="flex items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                  genStep >= 1 ? 'bg-blue-600 border-blue-500 text-slate-900 dark:text-white' : 'bg-transparent border-white/20 text-slate-600 dark:text-slate-400'
                }`}>1</div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 ml-2">选择标准文献</span>
              </div>
              <ChevronRight className="w-4 h-4 mx-4 text-slate-600" />
              
              <div className="flex items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                  genStep >= 2 ? 'bg-blue-600 border-blue-500 text-slate-900 dark:text-white' : 'bg-transparent border-white/20 text-slate-600 dark:text-slate-400'
                }`}>2</div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 ml-2">配置考核参数</span>
              </div>
              <ChevronRight className="w-4 h-4 mx-4 text-slate-600" />

              <div className="flex items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                  genStep >= 4 ? 'bg-blue-600 border-blue-500 text-slate-900 dark:text-white' : 'bg-transparent border-white/20 text-slate-600 dark:text-slate-400'
                }`}>3</div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 ml-2">试题微调与入库</span>
              </div>
            </div>

            {/* WIZARD STEP 1: 选择文献 */}
            {genStep === 1 && (
              <div className="max-w-md mx-auto space-y-6 text-center py-8 animate-scale-in">
                <BookOpen className="w-16 h-16 mx-auto text-blue-500 bg-blue-500/10 p-3.5 rounded-full" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">选择出题依据</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">大模型将对该标准进行深度研读，严格围绕其规范生成考核题型。</p>
                </div>
                
                {standards.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-xs text-slate-500 dark:text-slate-500">
                    文献库当前为空，请先在“标准文献库”标签页中上传归档一份产品标准。
                  </div>
                ) : (
                  <div className="space-y-4">
                    <select
                      value={selectedStdId}
                      onChange={(e) => {
                        const stdId = e.target.value;
                        setSelectedStdId(stdId);
                        const selectedStd = standards.find(s => s.id === stdId);
                        if (selectedStd) {
                          setExamForm(prev => ({ ...prev, title: selectedStd.title }));
                        }
                      }}
                      className="w-full pl-4 pr-10 py-3 bg-white dark:bg-[#090d16]/80 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
                    >
                      <option value="" disabled>-- 请选择作为出题依据的产品标准 --</option>
                      {standards.map(s => (
                        <option key={s.id} value={s.id} className="bg-slate-50 dark:bg-[#0b0f19]">{s.title}</option>
                      ))}
                    </select>

                    <button
                      disabled={!selectedStdId}
                      onClick={() => setGenStep(2)}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 disabled:opacity-50 disabled:active:scale-100 text-slate-900 dark:text-white font-medium rounded-xl text-xs tracking-wider flex items-center justify-center gap-1 shadow-lg shadow-blue-600/15 transition-all duration-200"
                    >
                      下一步，配置题型
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* WIZARD STEP 2: 参数配置 */}
            {genStep === 2 && (
              <div className="max-w-xl mx-auto space-y-6 animate-scale-in">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="examTitle">考核试卷名称</label>
                    <input
                      id="examTitle"
                      type="text"
                      required
                      placeholder="例: GB/T 2828.1 采样能力验证卷"
                      value={examForm.title}
                      onChange={(e) => setExamForm(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 bg-white dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="examTimeLimit">考试时长 (分钟)</label>
                    <input
                      id="examTimeLimit"
                      type="number"
                      required
                      value={examForm.timeLimit}
                      onChange={(e) => setExamForm(prev => ({ ...prev, timeLimit: parseInt(e.target.value, 10) || 90 }))}
                      className="w-full px-3 py-2 bg-white dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* 题型开关与参数调节 */}
                <div className="space-y-3 pt-3 border-t border-slate-205 dark:border-white/[0.05]">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex justify-between">
                    <span>题型与分值明细配置</span>
                    <span className="text-blue-650 dark:text-blue-400">当前计算满分：{calculateTotalScore()} 分</span>
                  </h4>

                  {Object.keys(questionConfigs).map((type) => {
                    const cfg = questionConfigs[type];
                    const labelMap: Record<string, string> = {
                      SINGLE: '单项选择题',
                      MULTIPLE: '多项选择题',
                      JUDGE: '技术判断题',
                      FILL: '标准填空题',
                      SHORT: '专业简答分析题',
                    };

                    return (
                      <div key={type} className={`p-4 rounded-xl border transition-all flex justify-between items-center ${
                        cfg.active 
                          ? 'bg-blue-50/30 dark:bg-white/[0.02] border-blue-500/25 dark:border-blue-500/25 text-slate-900 dark:text-white' 
                          : 'bg-transparent border-slate-200 dark:border-white/[0.04] text-slate-550 dark:text-slate-500'
                      }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={cfg.active}
                            onChange={() => handleToggleConfig(type)}
                            className="rounded border-slate-300 dark:border-white/10 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-xs font-medium">{labelMap[type]}</span>
                        </div>

                        {cfg.active && (
                          <div className="flex gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-600 dark:text-slate-400">数量:</span>
                              <input
                                type="number"
                                min="1"
                                value={cfg.count}
                                onChange={(e) => handleConfigChange(type, 'count', parseInt(e.target.value, 10) || 1)}
                                className="w-14 px-2 py-1 bg-slate-100 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded text-xs text-center focus:outline-none text-slate-900 dark:text-white font-semibold"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-slate-600 dark:text-slate-400">单题分值:</span>
                              <input
                                type="number"
                                min="0.5"
                                step="0.5"
                                value={cfg.score}
                                onChange={(e) => handleConfigChange(type, 'score', parseFloat(e.target.value) || 1)}
                                className="w-14 px-2 py-1 bg-slate-100 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded text-xs text-center focus:outline-none text-slate-900 dark:text-white font-semibold"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 操作行 */}
                <div className="flex justify-between pt-6 border-t border-slate-205 dark:border-white/[0.05] mt-6">
                  <button
                    onClick={() => setGenStep(1)}
                    className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-slate-205 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    返回上一步
                  </button>

                  <button
                    onClick={handleStartAIGeneration}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 text-xs text-slate-900 dark:text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/15 transition-all duration-200"
                  >
                    开始大模型智能命题
                    <Cpu className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* WIZARD STEP 3: 命题动画 */}
            {genStep === 3 && (
              <div className="absolute inset-0 z-30 bg-[#030712]/95 backdrop-blur-md flex flex-col items-center justify-center py-20 text-center animate-fade-in select-none">
                {/* 科技扫描球体 */}
                <div className="relative w-28 h-28 mb-8">
                  <div className="absolute inset-0 rounded-full bg-blue-500/10 border border-blue-500/30 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-cyan-500/5 border border-cyan-500/40 animate-pulse" />
                  <div className="absolute inset-4 rounded-full border border-dashed border-blue-500/40 animate-spin" style={{ animationDuration: '8s' }} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Cpu className="w-10 h-10 text-cyan-650 dark:text-cyan-400 animate-bounce" />
                  </div>
                </div>
                
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">AI 命题小组正在协同研制考卷...</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 max-w-[340px] leading-relaxed">
                  大模型正在研读提取的技术规范原文，抓取核心参数、检验法则，并针对不同题型进行科学命题校对。
                </p>

                {/* 滚动条 */}
                <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mt-8">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-loading-bar" />
                </div>
              </div>
            )}

            {/* WIZARD STEP 4: 题目微调预览 */}
            {genStep === 4 && (
              <div className="space-y-6 animate-scale-in">
                {/* 试卷顶部卡片 */}
                <div className="flex justify-between items-center p-4 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-900 dark:text-white">考核卷预览: {examForm.title}</h3>
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">题量: {generatedQuestions.length} 道 | 考试时长: {examForm.timeLimit} 分钟 | 实际总满分: {generatedQuestions.reduce((sum, q) => sum + q.score, 0)} 分</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddNewQuestion}
                      className="px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] border border-slate-250 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-300 font-medium rounded-lg active:scale-95 transition-all"
                    >
                      手动追加题目
                    </button>
                    <button
                      onClick={handleSaveExamPaper}
                      disabled={loading}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-xs text-slate-900 dark:text-white font-semibold rounded-lg flex items-center gap-1.5 shadow-lg shadow-emerald-600/10 active:scale-95 transition-all"
                    >
                      <Save className="w-4 h-4" />
                      确认并归档保存试卷
                    </button>
                  </div>
                </div>

                {/* 题目卡片流 */}
                <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
                  {generatedQuestions.map((q, index) => {
                    const badgeMap: Record<string, string> = {
                      SINGLE: '单选题',
                      MULTIPLE: '多选题',
                      JUDGE: '判断题',
                      FILL: '填空题',
                      SHORT: '简答题',
                    };

                    return (
                      <div key={index} className="backdrop-blur-md bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 relative transition-all hover:border-blue-500/20 dark:hover:border-white/[0.1] shadow-sm">
                        {/* 题目顶部徽标 */}
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{index + 1}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold border ${
                              q.type === 'SINGLE' 
                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' 
                                : q.type === 'MULTIPLE' 
                                  ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400'
                                  : q.type === 'JUDGE' 
                                    ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-650 dark:text-cyan-400'
                                    : 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400'
                            }`}>
                              {badgeMap[q.type]}
                            </span>
                            <input
                              type="text"
                              value={q.knowledgePoint}
                              onChange={(e) => handleQuestionTextChange(index, 'knowledgePoint', e.target.value)}
                              placeholder="关联标准条款，如: 第5条 采样"
                              className="px-2 py-1 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 font-medium w-56"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500 dark:text-slate-400">分值:</span>
                              <input
                                type="number"
                                step="0.5"
                                value={q.score}
                                onChange={(e) => handleQuestionTextChange(index, 'score', parseFloat(e.target.value) || 2)}
                                className="w-12 px-1.5 py-1 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded text-xs text-center text-slate-900 dark:text-white focus:outline-none font-semibold"
                              />
                            </div>

                            <button
                              onClick={() => handleDeleteGeneratedQuestion(index)}
                              className="p-1 rounded bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-500 dark:text-slate-500 hover:text-red-400 transition-colors"
                              title="移除此题"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 题目题干 */}
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <span className="text-xs text-slate-500 dark:text-slate-500">命题题干描述</span>
                            <textarea
                              value={q.content}
                              onChange={(e) => handleQuestionTextChange(index, 'content', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810]/80 border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/60 leading-relaxed resize-none h-16"
                            />
                          </div>

                          {/* 选项卡（单选、多选） */}
                          {q.options && Array.isArray(q.options) && (
                            <div className="space-y-2 pl-3 border-l-2 border-slate-200 dark:border-white/[0.06]">
                              <span className="text-xs text-slate-500 dark:text-slate-500">选项明细</span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {q.options.map((opt, optIdx) => (
                                  <input
                                    key={optIdx}
                                    type="text"
                                    value={opt}
                                    onChange={(e) => handleOptionTextChange(index, optIdx, e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-[#050810]/50 border border-slate-200 dark:border-white/[0.06] rounded-lg text-xs sm:text-sm text-slate-800 dark:text-slate-300 focus:outline-none focus:border-blue-500/50"
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 参考答案与解析 */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                            <div className="space-y-1">
                              <span className="text-xs text-slate-500 dark:text-slate-500">标准参考答案</span>
                              <input
                                type="text"
                                value={q.correctAnswer}
                                onChange={(e) => handleQuestionTextChange(index, 'correctAnswer', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810]/70 border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/60"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <span className="text-xs text-slate-500 dark:text-slate-500">标准依据解析</span>
                              <input
                                type="text"
                                value={q.explanation}
                                onChange={(e) => handleQuestionTextChange(index, 'explanation', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810]/70 border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/60"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 底部按钮 */}
                <div className="flex justify-between pt-4 border-t border-slate-205 dark:border-white/[0.05]">
                  <button
                    onClick={() => setGenStep(2)}
                    className="px-4 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] border border-slate-205 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-1 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    返回配置题型
                  </button>
                  
                  <span className="text-xs text-slate-500 dark:text-slate-500 flex items-center">
                    提示: 大模型生成的试题难免有细小笔误，请细致核对无误后点击右上方“确认并归档保存试卷”。
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 标签页四：考务与任务发布 ==================== */}
        {activeTab === 'tasks' && (
          <div className="space-y-8 animate-fade-in">
            {/* 已发布任务列表 */}
            <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">考核任务监控列表</h3>
              {loading ? (
                <div className="py-20 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  加载中...
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-500 dark:text-slate-500">
                  部门暂无任何已发布的考试考核任务。请点击右上角按钮发布一次能力考核！
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-205 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">考核任务名称</th>
                        <th className="py-3 px-4">关联试卷 (题量)</th>
                        <th className="py-3 px-4">作答时间窗口</th>
                        <th className="py-3 px-4">答卷时限</th>
                        <th className="py-3 px-4">已考人数</th>
                        <th className="py-3 px-4">考务状态</th>
                        <th className="py-3 px-4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/[0.04]">
                      {tasks.map((task) => (
                        <tr key={task.id} className="text-xs text-slate-700 dark:text-slate-300 hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">{task.title}</td>
                          <td className="py-4 px-4">
                            <p>{task.examTitle}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">({task.questionCount} 道题)</p>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-slate-850 dark:text-slate-200">自 {new Date(task.startTime).toLocaleString('zh-CN')}</p>
                            <p className="text-slate-600 dark:text-slate-400">至 {new Date(task.endTime).toLocaleString('zh-CN')}</p>
                          </td>
                          <td className="py-4 px-4 font-mono">{task.timeLimit} 分钟</td>
                          <td className="py-4 px-4">{task.recordCount} 人已提交</td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                              task.status === 'PUBLISHED'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400'
                                : task.status === 'UPCOMING'
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-650 dark:text-blue-400'
                                  : 'bg-slate-500/10 border-slate-250 dark:border-white/[0.08] text-slate-500 dark:text-slate-500'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${
                                task.status === 'PUBLISHED' ? 'bg-emerald-400 shadow-sm animate-ping' : task.status === 'UPCOMING' ? 'bg-blue-400' : 'bg-slate-500'
                              }`} />
                              {task.status === 'PUBLISHED' ? '进行中' : task.status === 'UPCOMING' ? '未开始' : '已截止'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleDeleteTask(task.id, task.title)}
                              className="p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-600 dark:text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-all duration-150"
                              title="删除此任务"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 本部门存档试卷列表 */}
            <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">部门已归档试卷库</h3>
              {loading ? (
                <div className="py-12 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">加载中...</div>
              ) : exams.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-500">
                  暂无归档试卷。
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {exams.map((ex) => {
                    const isGenerating = ex.status === 'GENERATING';
                    const isFailed = ex.status === 'FAILED';

                    return (
                      <div key={ex.id} className="backdrop-blur-md bg-white/[0.02] border border-slate-205 dark:border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-all flex flex-col justify-between h-44 relative overflow-hidden group">
                        {isGenerating && (
                          <div className="absolute inset-0 bg-blue-600/[0.01] animate-pulse pointer-events-none" />
                        )}
                        
                        <div>
                          <h4 className="text-xs font-semibold text-slate-900 dark:text-white tracking-wide line-clamp-2 leading-relaxed">{ex.title}</h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-2">依据规范: {ex.standardTitle}</p>
                        </div>
                        
                        {isGenerating ? (
                          <div className="flex flex-col gap-2 pt-3 border-t border-slate-205 dark:border-white/[0.04]">
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold text-[10px]">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span className="animate-pulse">{ex.progress || '正在出题中...'}</span>
                            </div>
                            <div className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-loading-bar" />
                            </div>
                          </div>
                        ) : isFailed ? (
                          <div className="flex flex-col gap-1 pt-3 border-t border-slate-205 dark:border-white/[0.04]">
                            <span className="text-red-500 dark:text-red-400 font-semibold text-[10px]">❌ 智能命题失败</span>
                            <span className="text-[9px] text-red-500/80 line-clamp-1" title={ex.errorMsg || ''}>{ex.errorMsg || '出题异常，请重试'}</span>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center pt-4 border-t border-slate-205 dark:border-white/[0.04] mt-4">
                            <div className="text-[10px] text-slate-600 dark:text-slate-400">
                              <span>{ex.questionCount} 道题</span>
                              <span className="mx-1">|</span>
                              <span>{ex.timeLimit} 分</span>
                            </div>
                            <div className="flex gap-1.5 items-center">
                              <button
                                onClick={() => handleLoadExamToEdit(ex.id)}
                                className="px-2 py-1 bg-white/[0.04] hover:bg-white/[0.08] border border-slate-250 dark:border-white/[0.08] text-[9px] text-slate-700 dark:text-slate-350 font-semibold rounded transition-all"
                                title="预览微调题目"
                              >
                                微调
                              </button>
                              <button
                                onClick={() => {
                                  const now = new Date();
                                  const oneYearLater = new Date();
                                  oneYearLater.setFullYear(now.getFullYear() + 1);
                                  const formatDatetime = (d: Date) => {
                                    const tzoffset = d.getTimezoneOffset() * 60000;
                                    return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
                                  };
                                  setSelectedExamId(ex.id);
                                  setTaskForm(prev => ({
                                    ...prev,
                                    title: `${ex.title} 考核`,
                                    startTime: formatDatetime(now),
                                    endTime: formatDatetime(oneYearLater),
                                    timeLimit: ex.timeLimit,
                                  }));
                                  setShowPublishModal(true);
                                }}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-semibold rounded text-[9px] transition-all"
                                title="直接发布为考试任务"
                              >
                                发布
                              </button>
                              
                              <a
                                href={`/api/creator/exams/${ex.id}/export?type=student`}
                                download
                                className="p-1 bg-white/[0.02] hover:bg-white/[0.05] border border-slate-250 dark:border-white/[0.08] text-[9px] text-slate-650 dark:text-slate-400 rounded font-semibold"
                                title="导出考生试卷（无答案）"
                              >
                                卷
                              </a>
                              <a
                                href={`/api/creator/exams/${ex.id}/export?type=teacher`}
                                download
                                className="p-1 bg-white/[0.02] hover:bg-white/[0.05] border border-slate-250 dark:border-white/[0.08] text-[9px] text-slate-650 dark:text-slate-400 rounded font-semibold"
                                title="导出教师参考卷（含答案）"
                              >
                                答
                              </a>
                              <button
                                onClick={() => handleDeleteExam(ex.id, ex.title)}
                                className="p-1 rounded text-slate-500 dark:text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="物理删除试卷及题库"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== 标签页五：AI 辅助阅卷中心 ==================== */}
        {activeTab === 'grading' && (
          <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">考生答卷批改中心</h3>
            
            {loading ? (
              <div className="py-20 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                拉取考生答卷队列中...
              </div>
            ) : records.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-500 dark:text-slate-500">
                本部门目前尚未有任何考生的答卷记录。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-205 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">考生姓名 / 工号</th>
                      <th className="py-3 px-4">考核任务 (试卷)</th>
                      <th className="py-3 px-4">所属科室</th>
                      <th className="py-3 px-4">最终得分</th>
                      <th className="py-3 px-4">提交交卷时间</th>
                      <th className="py-3 px-4">阅卷状态</th>
                      <th className="py-3 px-4 text-right">考务操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.04]">
                    {records.map((row) => (
                      <tr key={row.id} className="text-xs text-slate-700 dark:text-slate-300 hover:bg-white/[0.02] transition-colors duration-150">
                        <td className="py-4 px-4">
                          <p className="font-medium text-slate-900 dark:text-white">{row.examineeName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">工号: {row.examineeEmployeeId}</p>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium">{row.taskTitle}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">{row.examTitle}</p>
                        </td>
                        <td className="py-4 px-4">{row.examineeSection}</td>
                        <td className="py-4 px-4 font-mono font-bold text-slate-850 dark:text-slate-200">
                          {row.status === 'GRADED' ? `${row.score} 分` : '待评分'}
                        </td>
                        <td className="py-4 px-4 text-slate-500 dark:text-slate-500">
                          {row.submittedAt ? new Date(row.submittedAt).toLocaleString('zh-CN') : '进行中/未交卷'}
                        </td>
                        <td className="py-4 px-4">
                          {row.status === 'GRADED' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400">
                              已阅卷
                            </span>
                          ) : row.status === 'SUBMITTED' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border bg-amber-500/10 border-amber-500/20 text-amber-650 dark:text-amber-400">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin mr-0.5" />
                              AI阅卷中 ({row.aiProgress || '计算中...'})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border bg-blue-500/10 border-blue-500/20 text-blue-650 dark:text-blue-400">
                              答题中
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 text-right">
                          {row.status === 'ONGOING' ? (
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 italic">在线答题中</span>
                          ) : (
                            <button
                              onClick={() => openGradingRoom(row.id)}
                              className={`px-2.5 py-1 text-[10px] font-semibold rounded active:scale-95 transition-all ${
                                row.status === 'SUBMITTED'
                                  ? 'bg-amber-500 hover:bg-amber-400 text-[#030712] shadow-md shadow-amber-500/10'
                                  : 'bg-white/[0.03] hover:bg-white/[0.06] border border-slate-250 dark:border-white/[0.08] text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              {row.status === 'SUBMITTED' ? '在线批阅' : '重新核对'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== 标签页六：部门统计分析 (Recharts) ==================== */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-fade-in">
            {/* 切换正式考核/自主训练页签 */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/[0.02] border border-slate-205 dark:border-white/[0.05] rounded-xl w-fit">
              <button
                onClick={() => setStatsType('EXAM')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statsType === 'EXAM'
                    ? 'bg-blue-650 dark:bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                正式考试技能统计
              </button>
              <button
                onClick={() => setStatsType('TRAINING')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  statsType === 'TRAINING'
                    ? 'bg-blue-650 dark:bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                自主训练技能统计
              </button>
            </div>
            {/* 上部：及格率与直方图并排 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 直方图柱状图 */}
              <div className="lg:col-span-2 backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 h-[320px]">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-4">本部门考试成绩区间分布直方图</h3>
                {mounted && statsDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={statsDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                      <YAxis stroke="#64748b" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0c101a', borderColor: 'rgba(255,255,255,0.08)', borderRadius: '8px' }}
                        labelStyle={{ color: '#fff', fontSize: '10px' }}
                        itemStyle={{ color: '#60a5fa', fontSize: '10px' }}
                      />
                      <Bar dataKey="value" name="人数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">无图表数据</div>
                )}
              </div>

              {/* 掌握度雷达图 */}
              <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 h-[320px]">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white mb-4">本部门标准条款与知识点掌握度 (%)</h3>
                {mounted && statsMastery.length > 0 ? (
                  <ResponsiveContainer width="100%" height="90%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={statsMastery}>
                      <PolarGrid stroke="rgba(255,255,255,0.05)" />
                      <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={8} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#64748b" fontSize={8} />
                      <Radar name="得分率" dataKey="A" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 dark:text-slate-500 text-center px-4 leading-relaxed">
                    暂无足够数据形成知识点掌握雷达图。阅卷完成后将在此展示各个标准条款的平均得分率。
                  </div>
                )}
              </div>
            </div>

            {/* 下部：高频易错题列表 */}
            <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-650 dark:text-amber-400" />
                部门高频易错题排头名 (Top 10)
              </h3>
              {statsTopErrors.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-500">
                  目前无错题排行数据。考生阅卷完成后，系统会分析其错题并在此处列出失分率最高的题目以作教学针对性改进。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-205 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4 w-[40%]">题目题干</th>
                        <th className="py-3 px-4">关联标准条款</th>
                        <th className="py-3 px-4">所属试卷</th>
                        <th className="py-3 px-4">作答总人次</th>
                        <th className="py-3 px-4">错题人次</th>
                        <th className="py-3 px-4 text-right">错题率 (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/[0.04]">
                      {statsTopErrors.map((item) => (
                        <tr key={item.id} className="text-xs text-slate-700 dark:text-slate-300 hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="py-4 px-4">
                            <p className="font-medium text-slate-900 dark:text-white line-clamp-1">{item.content}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">参考答案: {item.correctAnswer}</p>
                          </td>
                          <td className="py-4 px-4 font-medium text-cyan-650 dark:text-cyan-400">{item.knowledgePoint}</td>
                          <td className="py-4 px-4 text-slate-600 dark:text-slate-400">{item.examTitle}</td>
                          <td className="py-4 px-4 font-mono">{item.totalCount} 次</td>
                          <td className="py-4 px-4 font-mono text-red-400">{item.errorCount} 次</td>
                          <td className="py-4 px-4 text-right font-mono font-bold text-red-400">
                            {item.errorRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* ============================== 各类弹窗模态框 ============================== */}
      {/* ========================================================================= */}

      {/* 弹窗一：发布考试任务 */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl animate-scale-in">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">发布本部门考核任务</h3>
            <form onSubmit={handlePublishTask} className="space-y-4">
              {/* 任务名称 */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="pubTaskTitle">考核任务名称</label>
                <input
                  id="pubTaskTitle"
                  type="text"
                  required
                  placeholder="例: 2026年第二季度物理拉伸规范能力考核"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 起止时间 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="pubTaskStart">开考允许时间</label>
                  <input
                    id="pubTaskStart"
                    type="datetime-local"
                    required
                    value={taskForm.startTime}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, startTime: e.target.value }))}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (err) {}
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="pubTaskEnd">截至允许时间</label>
                  <input
                    id="pubTaskEnd"
                    type="datetime-local"
                    required
                    value={taskForm.endTime}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, endTime: e.target.value }))}
                    onClick={(e) => {
                      try {
                        e.currentTarget.showPicker();
                      } catch (err) {}
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* 答卷限时 */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="pubTaskLimit">答题倒计时时长 (分钟)</label>
                <input
                  id="pubTaskLimit"
                  type="number"
                  required
                  value={taskForm.timeLimit}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, timeLimit: parseInt(e.target.value, 10) || 90 }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 发布类型 */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="pubTaskType">发布类型</label>
                <select
                  id="pubTaskType"
                  value={taskForm.type}
                  onChange={(e) => setTaskForm(prev => ({ ...prev, type: e.target.value as 'EXAM' | 'TRAINING' }))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="EXAM" className="text-slate-900 dark:text-white bg-slate-100 dark:bg-[#0c101a]">正式考试卷 (需要出题人人工核查主观题得分)</option>
                  <option value="TRAINING" className="text-slate-900 dark:text-white bg-slate-100 dark:bg-[#0c101a]">自主训练卷 (AI 阅卷后直接自动出分并发布成绩)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] border border-slate-200 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-xs text-white dark:text-slate-900 font-medium rounded-lg transition-all"
                >
                  {loading ? '发布中...' : '发布并推送'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 弹窗二：AI 阅卷工作台 (沉浸全屏式分栏) */}
      {showGradingModal && (
        <div className="fixed inset-0 z-50 bg-slate-50/98 dark:bg-[#030712]/95 backdrop-blur-md flex flex-col animate-fade-in font-sans">
          {/* 阅卷顶部状态栏 */}
          <header className="flex justify-between items-center px-8 py-5 border-b border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#090d16]/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI 辅助在线阅卷工作台</h3>
              {gradingRecord && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  考生: <span className="text-slate-950 dark:text-white font-medium">{gradingRecord.examinee.realName}</span> (工号: {gradingRecord.examinee.employeeId}) | 科室: {gradingRecord.examinee.sectionName} | 考试任务: {gradingRecord.taskTitle}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-6">
              {gradingRecord && (
                <div className="text-right">
                  <span className="text-xs text-slate-500 dark:text-slate-400">当前批改总得分:</span>
                  <span className="text-xl font-bold font-mono text-cyan-650 dark:text-cyan-400 ml-2">
                    {calculateCurrentGradingTotal()} 分
                  </span>
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowGradingModal(false);
                    setGradingRecord(null);
                    setGradingAnswers([]);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] border border-slate-200 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 rounded-lg active:scale-95 transition-all"
                >
                  退出阅卷
                </button>
                <button
                  onClick={handleSubmitGrading}
                  disabled={loading || loadingGradingDetail}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-xs text-white dark:text-slate-900 font-semibold rounded-lg shadow-md shadow-emerald-600/10 active:scale-95 transition-all"
                >
                  {loading ? '提交评分中...' : '提交批改并发布成绩'}
                </button>
              </div>
            </div>
          </header>

          {/* 阅卷列表区 */}
          <div className="flex-1 overflow-y-auto px-8 py-6 max-w-5xl mx-auto w-full space-y-6">
            {loadingGradingDetail ? (
              <div className="h-96 flex flex-col items-center justify-center text-xs text-slate-500 dark:text-slate-500 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                正在调取答卷与 AI 预阅卷 analysis，请稍候...
              </div>
            ) : gradingAnswers.length === 0 ? (
              <div className="text-center py-20 text-xs text-slate-500 dark:text-slate-500">无法拉取答卷详情。</div>
            ) : (
              gradingAnswers.map((ans, idx) => {
                const isSubjective = ans.type === 'SHORT' || ans.type === 'FILL';
                
                return (
                  <div key={ans.id} className="backdrop-blur-md bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] hover:border-blue-500/20 dark:hover:border-white/[0.08] rounded-xl p-6 relative transition-all shadow-sm">
                    {/* 单题头部 */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-450 dark:text-slate-500">Q#{idx + 1}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-semibold border ${
                          ans.type === 'SINGLE' ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' :
                          ans.type === 'MULTIPLE' ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400' :
                          ans.type === 'JUDGE' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-650 dark:text-cyan-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-600 dark:text-orange-400'
                        }`}>
                          {ans.type === 'SINGLE' ? '单选题' : ans.type === 'MULTIPLE' ? '多选题' : ans.type === 'JUDGE' ? '判断题' : '主观题'}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-450">关联条款: {ans.knowledgePoint}</span>
                      </div>
                      
                      {/* 单题满分分值 */}
                      <span className="text-xs text-slate-550 dark:text-slate-450">分值权重: {ans.maxScore} 分</span>
                    </div>

                    {/* 题干与选项 */}
                    <div className="space-y-4">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-relaxed bg-slate-50 dark:bg-[#050810]/40 p-3.5 rounded-lg border border-slate-200 dark:border-white/[0.02]">
                        {ans.content}
                      </div>

                      {ans.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-3 border-l border-slate-200 dark:border-white/[0.06] text-xs text-slate-600 dark:text-slate-400">
                          {ans.options.map((opt, oIdx) => (
                            <div key={oIdx} className={ans.correctAnswer.includes(opt.charAt(0)) ? "text-emerald-650 dark:text-emerald-400 font-medium" : ""}>
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 考生答案比对 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-white/[0.04]">
                        {/* 左侧：考生答案与标准答案对比 */}
                        <div className="space-y-2">
                          <div className="p-3 bg-slate-50 dark:bg-[#090d16]/70 border border-slate-200 dark:border-white/[0.04] rounded-lg">
                            <span className="text-xs text-slate-500 dark:text-slate-455">考生作答内容:</span>
                            <p className={`text-sm font-semibold mt-1.5 leading-relaxed ${
                              !isSubjective 
                                ? ans.score >= ans.maxScore 
                                  ? 'text-emerald-650 dark:text-emerald-400' 
                                  : 'text-red-500 dark:text-red-400'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}>
                              {ans.answerContent || '（未作答）'}
                            </p>
                          </div>

                          <div className="p-3 bg-white dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.03] rounded-lg">
                            <span className="text-xs text-slate-500 dark:text-slate-455">标准参考答案及考点依据:</span>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-300 mt-1.5 leading-relaxed">
                              {ans.correctAnswer}
                            </p>
                            {ans.explanation && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed bg-slate-100/80 dark:bg-black/10 p-2 rounded">
                                解析依据: {ans.explanation}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 右侧：AI 预判分值或客观题自动标记 */}
                        <div className="space-y-2 flex flex-col justify-between">
                          {!isSubjective ? (
                            <div className="p-4 rounded-lg bg-white dark:bg-white/[0.01] border border-slate-200 dark:border-white/[0.04] flex flex-col items-center justify-center flex-1">
                              <span className="text-xs text-slate-550 dark:text-slate-455 mb-2">系统客观题自动判定</span>
                              {ans.score >= ans.maxScore ? (
                                <div className="text-center">
                                  <CheckCircle2 className="w-8 h-8 text-emerald-650 dark:text-emerald-400 mx-auto mb-1 animate-pulse" />
                                  <span className="text-xs font-bold text-emerald-650 dark:text-emerald-400">作答正确 (满分 {ans.score}分)</span>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <XCircle className="w-8 h-8 text-red-550 dark:text-red-400 mx-auto mb-1" />
                                  <span className="text-xs font-bold text-red-550 dark:text-red-400">作答错误 (0分)</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            /* 主观题：AI 预评判 */
                            <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10 dark:border-blue-500/20 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Cpu className="w-4 h-4 text-blue-600 dark:text-cyan-400 animate-pulse" />
                                  <span className="text-xs font-bold text-blue-600 dark:text-cyan-300 uppercase tracking-wider">大模型 AI 阅卷评估</span>
                                  {ans.aiScore !== null && (
                                    <span className="ml-auto text-xs font-bold text-blue-600 dark:text-cyan-400 bg-blue-100 dark:bg-cyan-400/10 px-2 py-0.5 rounded">
                                      推荐得分: {ans.aiScore}分
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed bg-slate-100/50 dark:bg-[#0b0f19]/40 p-2.5 rounded border border-slate-200 dark:border-blue-500/5 whitespace-pre-wrap max-h-[110px] overflow-y-auto">
                                  {ans.aiComment || '正在调取 AI 分析评语...'}
                                </div>
                              </div>

                              {/* 最终得分调节与手动评语 */}
                              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-white/[0.04] space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">最终给出分值:</span>
                                  <div className="flex items-center gap-3">
                                    <input
                                      type="range"
                                      min="0"
                                      max={ans.maxScore}
                                      step="0.5"
                                      value={ans.score}
                                      onChange={(e) => handleGradingScoreChange(idx, parseFloat(e.target.value) || 0)}
                                      className="w-32 h-2 bg-slate-300 dark:bg-slate-750 border border-slate-400 dark:border-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-650 dark:accent-cyan-400 focus:outline-none transition-all duration-150"
                                    />
                                    <span className="text-xs font-extrabold font-mono px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-cyan-500/10 border border-blue-200 dark:border-cyan-500/30 text-blue-700 dark:text-cyan-400 min-w-[75px] text-center shadow-sm">
                                      {ans.score} / {ans.maxScore}分
                                    </span>
                                  </div>
                                </div>

                                <input
                                  type="text"
                                  placeholder="考官手记批语 (选填)"
                                  value={ans.reviewerComment || ''}
                                  onChange={(e) => handleGradingCommentChange(idx, e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#050810] border border-slate-200 dark:border-white/[0.06] rounded-lg text-xs text-slate-750 dark:text-slate-300 focus:outline-none focus:border-blue-500/40"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 弹窗五：标准文献提取文本预览 */}
      {previewStandard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl p-6 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl animate-scale-in max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-white/[0.05] mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">标准文献解析文本预览</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">标准名称: <span className="text-slate-900 dark:text-white font-medium">{previewStandard.title}</span> ({previewStandard.fileType.toUpperCase()})</p>
              </div>
              <button
                onClick={() => {
                  setPreviewStandard(null);
                  setPreviewText('');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.02] dark:hover:bg-white/[0.05] border border-slate-200 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 rounded-lg active:scale-95 transition-all"
              >
                关闭预览
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 min-h-[300px]">
              {loadingPreview ? (
                <div className="h-60 flex flex-col items-center justify-center text-xs text-slate-500 dark:text-slate-500 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500 animate-pulse" />
                  正在从服务器调取解析纯文本语料...
                </div>
              ) : (
                <div className="p-4 bg-slate-50 dark:bg-[#050810]/60 border border-slate-200 dark:border-white/[0.04] rounded-xl font-mono text-xs text-slate-800 dark:text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                  {previewText}
                </div>
              )}
            </div>
            
            <div className="text-[10px] text-slate-500 dark:text-slate-500 pt-4 border-t border-slate-200 dark:border-white/[0.04] mt-4 leading-relaxed flex justify-between items-center">
              <span>共计 {previewText.length} 字 | 大模型在出题时将完整消化以上全部语料文本</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(previewText);
                  triggerMessage('success', '提取的文本已复制到剪贴板！');
                }}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-[10px] text-slate-700 dark:text-slate-300 font-medium rounded transition-all"
              >
                一键复制纯文本
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
