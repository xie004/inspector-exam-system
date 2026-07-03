'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Network,
  Users as UsersIcon,
  Cpu,
  Plus,
  Edit2,
  Trash2,
  Power,
  RefreshCw,
  Key,
  Link2,
  AlertCircle,
  LogOut,
  UserPlus,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  userCount: number;
  standardCount: number;
  examCount: number;
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  role: string;
  realName: string;
  employeeId: string;
  sectionName: string | null;
  departmentId: string | null;
  status: string;
  department?: { id: string; name: string } | null;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'departments' | 'users' | 'ai'>('overview');

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

  // 个性化偏好初始化
  useEffect(() => {
    const savedTheme = localStorage.getItem('ias-theme') as 'dark' | 'light' | 'system' || 'dark';
    const savedFontSize = localStorage.getItem('ias-font-size') as 'sm' | 'md' | 'lg' || 'sm';
    setTheme(savedTheme);
    setFontSize(savedFontSize);
    applyTheme(savedTheme);
    applyFontSize(savedFontSize);
  }, []);
  
  // 全局数据状态
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [aiConfig, setAiConfig] = useState({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelName: 'gpt-4o',
    hasKey: false,
    visionBaseUrl: '',
    visionApiKey: '',
    visionModelName: '',
    hasVisionKey: false,
    embeddingBaseUrl: '',
    embeddingApiKey: '',
    embeddingModelName: '',
    hasEmbeddingKey: false,
  });

  // 加载状态
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingAi, setLoadingAi] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // 提示信息
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // AI 测试模型连通性与获取模型状态
  const [modelList, setModelList] = useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; reply?: string; error?: string } | null>(null);
  const [aiSubTab, setAiSubTab] = useState<'text' | 'vision' | 'embedding'>('text');

  useEffect(() => {
    setModelList([]);
    setTestResult(null);
  }, [aiSubTab]);

  // 各种弹窗控制
  const [showAddDepModal, setShowAddDepModal] = useState(false);
  const [showEditDepModal, setShowEditDepModal] = useState(false);
  const [selectedDep, setSelectedDep] = useState<Department | null>(null);
  const [depFormName, setDepFormName] = useState('');

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // 用户表单状态
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    role: 'EXAMINEE',
    realName: '',
    employeeId: '',
    departmentId: '',
    sectionName: '',
    status: 'ACTIVE',
  });

  // 用户与部门筛选条件
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');

  // 1. 初始化数据加载
  const loadDepartments = async () => {
    try {
      setLoadingDeps(true);
      const res = await fetch('/api/admin/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDeps(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadAiConfig = async () => {
    try {
      setLoadingAi(true);
      const res = await fetch('/api/admin/ai-config');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAiConfig({
            baseUrl: data.config.baseUrl,
            apiKey: data.config.apiKey,
            modelName: data.config.modelName,
            hasKey: data.config.hasKey,
            visionBaseUrl: data.config.visionBaseUrl || '',
            visionApiKey: data.config.visionApiKey || '',
            visionModelName: data.config.visionModelName || '',
            hasVisionKey: data.config.hasVisionKey || false,
            embeddingBaseUrl: data.config.embeddingBaseUrl || '',
            embeddingApiKey: data.config.embeddingApiKey || '',
            embeddingModelName: data.config.embeddingModelName || '',
            hasEmbeddingKey: data.config.hasEmbeddingKey || false,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAi(false);
    }
  };

  useEffect(() => {
    loadDepartments();
    loadUsers();
    loadAiConfig();
  }, []);

  // 定时关闭提示信息
  const triggerMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // 2. 退出登录
  const handleLogout = async () => {
    if (confirm('确认退出系统管理员控制台？')) {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    }
  };

  // 3. 部门相关操作
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depFormName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: depFormName }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '部门创建成功！');
        setShowAddDepModal(false);
        setDepFormName('');
        loadDepartments();
      } else {
        triggerMessage('error', data.error || '创建部门失败');
      }
    } catch (err) {
      triggerMessage('error', '连接服务器失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDep || !depFormName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/departments/${selectedDep.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: depFormName }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '部门修改成功！');
        setShowEditDepModal(false);
        setSelectedDep(null);
        setDepFormName('');
        loadDepartments();
        loadUsers(); // 刷新用户列表中的部门名称
      } else {
        triggerMessage('error', data.error || '修改部门失败');
      }
    } catch (err) {
      triggerMessage('error', '连接服务器失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDepartment = async (id: string, name: string) => {
    if (!confirm(`警告：您确认要删除部门 [${name}] 吗？`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/departments/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '部门删除成功！');
        loadDepartments();
      } else {
        triggerMessage('error', data.error || '删除部门失败');
      }
    } catch (err) {
      triggerMessage('error', '连接服务器失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 4. 用户相关操作
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '用户创建成功！');
        setShowAddUserModal(false);
        // 重置表单
        setUserForm({
          username: '',
          password: '',
          role: 'EXAMINEE',
          realName: '',
          employeeId: '',
          departmentId: '',
          sectionName: '',
          status: 'ACTIVE',
        });
        loadUsers();
        loadDepartments(); // 刷新部门下人数统计
      } else {
        triggerMessage('error', data.error || '创建用户失败');
      }
    } catch (err) {
      triggerMessage('error', '连接服务器失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', '用户信息更新成功！');
        setShowEditUserModal(false);
        setSelectedUser(null);
        loadUsers();
        loadDepartments();
      } else {
        triggerMessage('error', data.error || '更新失败');
      }
    } catch (err) {
      triggerMessage('error', '连接服务器失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, realName: string) => {
    if (!confirm(`确认要移除用户 [${realName}] 吗？\n如果该用户有历史考试记录，系统将出于审计合规保留档案并自动设为禁用状态。`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', data.message || '用户删除成功！');
        loadUsers();
        loadDepartments();
      } else {
        triggerMessage('error', data.error || '操作失败');
      }
    } catch (err) {
      triggerMessage('error', '连接服务器失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        triggerMessage('success', `已成功${newStatus === 'ACTIVE' ? '启用' : '禁用'}该用户！`);
        loadUsers();
      } else {
        const data = await res.json();
        triggerMessage('error', data.error || '操作失败');
      }
    } catch (err) {
      triggerMessage('error', '连接网络失败');
    } finally {
      setActionLoading(false);
    }
  };

  // 5. AI 配置与连通性测试
  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/ai-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: aiConfig.baseUrl,
          apiKey: aiConfig.apiKey,
          modelName: aiConfig.modelName,
          visionBaseUrl: aiConfig.visionBaseUrl,
          visionApiKey: aiConfig.visionApiKey,
          visionModelName: aiConfig.visionModelName,
          embeddingBaseUrl: aiConfig.embeddingBaseUrl,
          embeddingApiKey: aiConfig.embeddingApiKey,
          embeddingModelName: aiConfig.embeddingModelName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        triggerMessage('success', 'AI 参数配置已成功保存！');
        loadAiConfig();
      } else {
        triggerMessage('error', data.error || '保存配置失败');
      }
    } catch (err) {
      triggerMessage('error', '保存失败，网络异常');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFetchModelList = async () => {
    setFetchingModels(true);
    setMessage(null);
    try {
      let targetBaseUrl = '';
      let targetApiKey = '';
      if (aiSubTab === 'text') {
        targetBaseUrl = aiConfig.baseUrl;
        targetApiKey = aiConfig.apiKey;
      } else if (aiSubTab === 'vision') {
        targetBaseUrl = aiConfig.visionBaseUrl || aiConfig.baseUrl;
        targetApiKey = aiConfig.visionApiKey || aiConfig.apiKey;
      } else {
        targetBaseUrl = aiConfig.embeddingBaseUrl || aiConfig.baseUrl;
        targetApiKey = aiConfig.embeddingApiKey || aiConfig.apiKey;
      }

      const res = await fetch('/api/admin/ai-config/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: targetBaseUrl,
          apiKey: targetApiKey,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModelList(data.models);
        triggerMessage('success', `成功获取模型列表，共 ${data.models.length} 个模型！`);
        if (data.models.length > 0) {
          if (aiSubTab === 'text') {
            if (!data.models.includes(aiConfig.modelName)) {
              setAiConfig(prev => ({ ...prev, modelName: data.models[0] }));
            }
          } else if (aiSubTab === 'vision') {
            if (!data.models.includes(aiConfig.visionModelName)) {
              setAiConfig(prev => ({ ...prev, visionModelName: data.models[0] }));
            }
          } else {
            if (!data.models.includes(aiConfig.embeddingModelName)) {
              setAiConfig(prev => ({ ...prev, embeddingModelName: data.models[0] }));
            }
          }
        }
      } else {
        triggerMessage('error', data.error || '获取模型列表失败');
      }
    } catch (err) {
      triggerMessage('error', '请求失败，请检查 Base URL 能否连通');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      let targetBaseUrl = '';
      let targetApiKey = '';
      let targetModelName = '';
      if (aiSubTab === 'text') {
        targetBaseUrl = aiConfig.baseUrl;
        targetApiKey = aiConfig.apiKey;
        targetModelName = aiConfig.modelName;
      } else if (aiSubTab === 'vision') {
        targetBaseUrl = aiConfig.visionBaseUrl || aiConfig.baseUrl;
        targetApiKey = aiConfig.visionApiKey || aiConfig.apiKey;
        targetModelName = aiConfig.visionModelName || aiConfig.modelName;
      } else {
        targetBaseUrl = aiConfig.embeddingBaseUrl || aiConfig.baseUrl;
        targetApiKey = aiConfig.embeddingApiKey || aiConfig.apiKey;
        targetModelName = aiConfig.embeddingModelName || aiConfig.modelName;
      }

      const res = await fetch('/api/admin/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl: targetBaseUrl,
          apiKey: targetApiKey,
          modelName: targetModelName,
          modelType: aiSubTab,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          latency: data.latency,
          reply: data.reply,
        });
        triggerMessage('success', '模型连通测试成功！');
      } else {
        setTestResult({
          success: false,
          error: data.error || '大模型回复错误',
          latency: data.latency,
        });
        triggerMessage('error', '大模型连通性测试未通过！');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: '网络连接超时或解析失败',
      });
      triggerMessage('error', '网络联调测试异常');
    } finally {
      setTestingConnection(false);
    }
  };

  // 打开编辑用户弹窗
  const openEditUserModal = (user: User) => {
    setSelectedUser(user);
    setUserForm({
      username: user.username,
      password: '', // 密码置空，不输入则不修改
      role: user.role,
      realName: user.realName,
      employeeId: user.employeeId,
      departmentId: user.departmentId || '',
      sectionName: user.sectionName || '',
      status: user.status,
    });
    setShowEditUserModal(true);
  };

  // 过滤后的用户列表
  const filteredUsers = users.filter((u) => {
    const matchRole = filterRole ? u.role === filterRole : true;
    const matchDept = filterDept ? u.departmentId === filterDept : true;
    return matchRole && matchDept;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#030712] dark:text-slate-100 flex font-sans transition-colors duration-300 relative overflow-hidden">
      {/* 顶部漂浮消息 */}
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

      {/* 左侧大面积发光光晕 */}
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
                <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-wide">考核管理控制台</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-500">SYSTEM ADMIN</p>
              </div>
            </div>
          </div>

          {/* 导航菜单 */}
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
              系统概览
            </button>

            <button
              onClick={() => setActiveTab('departments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'departments'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <Network className="w-4 h-4" />
              部门管理
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'users'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <UsersIcon className="w-4 h-4" />
              用户管理
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-medium transition-all duration-200 ${
                activeTab === 'ai'
                  ? 'bg-blue-50 dark:bg-blue-600/10 text-blue-650 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-200/50 hover:dark:bg-white/[0.03] border border-transparent'
              }`}
            >
              <Cpu className="w-4 h-4" />
              大模型配置
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

        {/* 底部管理员资料与登出 */}
        <div className="p-4 border-t border-slate-205 dark:border-white/[0.06] bg-slate-100/80 dark:bg-black/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-650 dark:text-blue-400">
                管
              </div>
              <div className="truncate max-w-[120px]">
                <p className="text-xs font-medium text-slate-900 dark:text-white">系统管理员</p>
                <p className="text-[9px] text-slate-500 dark:text-slate-500">工号: ADMIN001</p>
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
        
        {/* 顶部面包屑与动作栏 */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">
              {activeTab === 'overview' && '系统综合概览'}
              {activeTab === 'departments' && '部门与组织机构管理'}
              {activeTab === 'users' && '检验员与出题员账号管理'}
              {activeTab === 'ai' && '大模型连接配置中心'}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {activeTab === 'overview' && '欢迎回到系统管理员控制台，此处汇集全院考务核心数据。'}
              {activeTab === 'departments' && '创建或修改部门，监控各科室绑定的设备标准及考务状态。'}
              {activeTab === 'users' && '开通或维护出题员、考生账号，执行重置密码与安全禁用。'}
              {activeTab === 'ai' && '设置 OpenAI 兼容接口，在线检索模型名称，保障出题与判卷的 API 顺畅连通。'}
            </p>
          </div>

          <div className="flex gap-2">
            {activeTab === 'departments' && (
              <button
                onClick={() => {
                  setDepFormName('');
                  setShowAddDepModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 text-xs text-slate-900 dark:text-white font-medium rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/15 transition-all duration-200"
              >
                <Plus className="w-4 h-4" />
                增加部门
              </button>
            )}
            {activeTab === 'users' && (
              <button
                onClick={() => {
                  setUserForm({
                    username: '',
                    password: '',
                    role: 'EXAMINEE',
                    realName: '',
                    employeeId: '',
                    departmentId: departments[0]?.id || '',
                    sectionName: '',
                    status: 'ACTIVE',
                  });
                  setShowAddUserModal(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 text-xs text-slate-900 dark:text-white font-medium rounded-xl flex items-center gap-1.5 shadow-lg shadow-blue-600/15 transition-all duration-200"
              >
                <UserPlus className="w-4 h-4" />
                新增内部账号
              </button>
            )}
          </div>
        </header>

        {/* ==================== 标签页一：系统概览 ==================== */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* 四张数据磁贴 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* 卡片 1: 部门数 */}
              <div className="backdrop-blur-md bg-white/[0.02] border border-slate-205 dark:border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-6 transition-all duration-300 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider">组织部门总数</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{departments.length}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-650 dark:text-blue-400">
                    <Network className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  各检测部门运转正常
                </div>
              </div>

              {/* 卡片 2: 内部成员 */}
              <div className="backdrop-blur-md bg-white/[0.02] border border-slate-205 dark:border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-6 transition-all duration-300 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider">系统内部用户</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{users.length}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <UsersIcon className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-[10px] text-slate-600 dark:text-slate-400 flex gap-3">
                  <span>出题员: {users.filter((u) => u.role === 'CREATOR').length} 名</span>
                  <span>考生: {users.filter((u) => u.role === 'EXAMINEE').length} 名</span>
                </div>
              </div>

              {/* 卡片 3: 标准文献 */}
              <div className="backdrop-blur-md bg-white/[0.02] border border-slate-205 dark:border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-6 transition-all duration-300 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider">标准库入库量</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">
                      {departments.reduce((sum, dep) => sum + dep.standardCount, 0)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-650 dark:text-cyan-400">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 text-[10px] text-slate-600 dark:text-slate-400">
                  支持文字 PDF/Word 及图片 OCR 智能解析
                </div>
              </div>

              {/* 卡片 4: 大模型配置状态 */}
              <div className="backdrop-blur-md bg-white/[0.02] border border-slate-205 dark:border-white/[0.05] hover:border-white/[0.1] rounded-2xl p-6 transition-all duration-300 shadow-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider">大模型 AI 引擎</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-3 truncate max-w-[140px]">{aiConfig.modelName}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    aiConfig.hasKey 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400' 
                      : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                    <Cpu className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400">
                  {aiConfig.hasKey ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" />
                      API 密钥已配置就绪
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-sm" />
                      未配置 API 密钥，大模型无法工作
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 功能快捷通道 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
              <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Network className="w-4 h-4 text-blue-650 dark:text-blue-400" />
                  最新增加的组织部门
                </h3>
                {loadingDeps ? (
                  <div className="h-40 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">加载中...</div>
                ) : departments.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">暂无部门，请点击右侧“部门管理”新增</div>
                ) : (
                  <div className="space-y-3">
                    {departments.slice(0, 4).map((dep) => (
                      <div key={dep.id} className="flex justify-between items-center px-4 py-3 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none">
                        <span className="text-xs font-medium text-slate-850 dark:text-slate-200">{dep.name}</span>
                        <div className="flex gap-4 text-[10px] text-slate-600 dark:text-slate-400">
                          <span>{dep.userCount} 成员</span>
                          <span>{dep.standardCount} 标准</span>
                          <span>{dep.examCount} 试卷</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-purple-400" />
                  最新录入的系统成员
                </h3>
                {loadingUsers ? (
                  <div className="h-40 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">加载中...</div>
                ) : users.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">暂无内部账号</div>
                ) : (
                  <div className="space-y-3">
                    {users.slice(0, 4).map((user) => (
                      <div key={user.id} className="flex justify-between items-center px-4 py-2.5 rounded-xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                          <div>
                            <span className="text-xs font-medium text-slate-850 dark:text-slate-200">{user.realName}</span>
                            <span className="text-[9px] text-slate-500 dark:text-slate-500 ml-2">工号: {user.employeeId}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-medium border ${
                            user.role === 'ADMIN' 
                              ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                              : user.role === 'CREATOR' 
                                ? 'bg-blue-500/10 border-blue-500/20 text-blue-650 dark:text-blue-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400'
                          }`}>
                            {user.role === 'ADMIN' ? '管理员' : user.role === 'CREATOR' ? '出题员' : '考生'}
                          </span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate max-w-[80px]">
                            {user.department?.name || '全院'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 标签页二：部门管理 ==================== */}
        {activeTab === 'departments' && (
          <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 animate-fade-in">
            {loadingDeps ? (
              <div className="py-20 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                正在加载组织架构列表...
              </div>
            ) : departments.length === 0 ? (
              <div className="py-20 text-center text-xs text-slate-500 dark:text-slate-500">
                暂无任何部门数据。请点击右上角按钮创建第一个检测部门。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-205 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">部门名称</th>
                      <th className="py-3 px-4">内部用户数</th>
                      <th className="py-3 px-4">标准归档数</th>
                      <th className="py-3 px-4">已出试卷数</th>
                      <th className="py-3 px-4">创建时间</th>
                      <th className="py-3 px-4 text-right">管理操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/[0.04]">
                    {departments.map((dep) => (
                      <tr key={dep.id} className="text-xs text-slate-700 dark:text-slate-300 hover:bg-white/[0.02] transition-colors duration-150">
                        <td className="py-4 px-4 font-medium text-slate-900 dark:text-white">{dep.name}</td>
                        <td className="py-4 px-4">{dep.userCount} 人</td>
                        <td className="py-4 px-4">{dep.standardCount} 份</td>
                        <td className="py-4 px-4">{dep.examCount} 套</td>
                        <td className="py-4 px-4 text-slate-500 dark:text-slate-500">
                          {new Date(dep.createdAt).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex justify-end gap-2.5">
                            <button
                              onClick={() => {
                                setSelectedDep(dep);
                                setDepFormName(dep.name);
                                setShowEditDepModal(true);
                              }}
                              className="p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-600 dark:text-slate-400 hover:text-blue-400 hover:border-blue-500/20 transition-all duration-150"
                              title="重命名部门"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDepartment(dep.id, dep.name)}
                              className="p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-600 dark:text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-all duration-150"
                              title="安全删除部门"
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
        )}

        {/* ==================== 标签页三：用户管理 ==================== */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-fade-in">
            {/* 筛选项 */}
            <div className="flex gap-4 p-4 rounded-xl bg-white/[0.01] border border-slate-205 dark:border-white/[0.04]">
              {/* 角色筛选 */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-500">用户类型:</span>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="bg-white dark:bg-[#090d16]/80 border border-slate-250 dark:border-white/[0.08] rounded-lg text-xs text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:border-blue-500/55 cursor-pointer"
                >
                  <option value="">全部类型</option>
                  <option value="ADMIN">系统管理员</option>
                  <option value="CREATOR">部门出题员</option>
                  <option value="EXAMINEE">普通考试用户</option>
                </select>
              </div>

              {/* 部门筛选 */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-500">检测部门:</span>
                <select
                  value={filterDept}
                  onChange={(e) => setFilterDept(e.target.value)}
                  className="bg-white dark:bg-[#090d16]/80 border border-slate-250 dark:border-white/[0.08] rounded-lg text-xs text-slate-900 dark:text-white px-3 py-1.5 focus:outline-none focus:border-blue-500/55 cursor-pointer"
                >
                  <option value="">全部部门</option>
                  {departments.map((dep) => (
                    <option key={dep.id} value={dep.id}>{dep.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 用户表格 */}
            <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
              {loadingUsers ? (
                <div className="py-20 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  正在拉取用户名单列表...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-20 text-center text-xs text-slate-500 dark:text-slate-500">
                  未筛选到匹配条件的内部账号。
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-205 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                        <th className="py-3 px-4">登录账号 / 工号</th>
                        <th className="py-3 px-4">真实姓名</th>
                        <th className="py-3 px-4">系统角色</th>
                        <th className="py-3 px-4">科室 / 部门</th>
                        <th className="py-3 px-4">当前状态</th>
                        <th className="py-3 px-4 text-right">账号管理操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-white/[0.04]">
                      {filteredUsers.map((user) => (
                        <tr key={user.id} className="text-xs text-slate-700 dark:text-slate-300 hover:bg-white/[0.02] transition-colors duration-150">
                          <td className="py-4 px-4">
                            <p className="font-medium text-slate-900 dark:text-white">{user.username}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">工号: {user.employeeId}</p>
                          </td>
                          <td className="py-4 px-4 text-slate-850 dark:text-slate-200 font-medium">{user.realName}</td>
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-medium border ${
                              user.role === 'ADMIN' 
                                ? 'bg-red-500/10 border-red-500/20 text-red-400' 
                                : user.role === 'CREATOR' 
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-650 dark:text-blue-400'
                                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400'
                            }`}>
                              {user.role === 'ADMIN' ? '管理员' : user.role === 'CREATOR' ? '出题员' : '考生'}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <p className="text-slate-850 dark:text-slate-200">{user.department?.name || '全院系统级'}</p>
                            {user.sectionName && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-500 mt-0.5">科室: {user.sectionName}</p>
                            )}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium border ${
                              user.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-650 dark:text-emerald-400'
                                : 'bg-slate-500/10 border-slate-250 dark:border-white/[0.08] text-slate-500 dark:text-slate-500'
                            }`}>
                              <span className={`w-1 h-1 rounded-full ${user.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                              {user.status === 'ACTIVE' ? '已启用' : '已禁用'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleToggleUserStatus(user)}
                                className={`p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none transition-all duration-150 ${
                                  user.status === 'ACTIVE' 
                                    ? 'text-amber-650 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20' 
                                    : 'text-emerald-650 dark:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                                }`}
                                title={user.status === 'ACTIVE' ? '禁用账号' : '启用账号'}
                              >
                                <Power className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openEditUserModal(user)}
                                className="p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-600 dark:text-slate-400 hover:text-blue-400 hover:border-blue-500/20 transition-all duration-150"
                                title="编辑详细资料"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id, user.realName)}
                                className="p-1.5 rounded bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] shadow-sm dark:shadow-none text-slate-600 dark:text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-all duration-150"
                                title="移除该用户"
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

        {/* ==================== 标签页四：大模型配置 ==================== */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            {/* 左侧配置面板 */}
            <div className="lg:col-span-2 space-y-6">
              <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <Key className="w-4 h-4 text-blue-650 dark:text-blue-400" />
                  大模型 API 凭证与端点
                </h3>
                
                {loadingAi ? (
                  <div className="py-20 flex items-center justify-center text-xs text-slate-500 dark:text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    正在读取 AI 大模型配置...
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* 子页签切换 */}
                    <div className="flex border-b border-slate-200 dark:border-white/[0.05] mb-5">
                      <button
                        type="button"
                        onClick={() => setAiSubTab('text')}
                        className={`px-4 py-2 border-b-2 text-xs font-semibold transition-all duration-200 ${
                          aiSubTab === 'text'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                        }`}
                      >
                        文本模型 (出题与判卷)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiSubTab('vision')}
                        className={`px-4 py-2 border-b-2 text-xs font-semibold transition-all duration-200 ${
                          aiSubTab === 'vision'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                        }`}
                      >
                        视觉模型 (PDF OCR)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiSubTab('embedding')}
                        className={`px-4 py-2 border-b-2 text-xs font-semibold transition-all duration-200 ${
                          aiSubTab === 'embedding'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                        }`}
                      >
                        向量模型 (标准检索)
                      </button>
                    </div>

                    <form onSubmit={handleSaveAiConfig} className="space-y-5">
                      {/* Base URL */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="baseUrl">
                          {aiSubTab === 'text' && 'API Base URL (接口基地址)'}
                          {aiSubTab === 'vision' && 'Vision API Base URL (可选视觉接口地址)'}
                          {aiSubTab === 'embedding' && 'Embedding API Base URL (可选嵌入接口地址)'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500">
                            <Link2 className="w-4 h-4" />
                          </span>
                          <input
                            id="baseUrl"
                            type="text"
                            required={aiSubTab === 'text'}
                            placeholder={
                              aiSubTab === 'text'
                                ? '例如: https://api.openai.com/v1 或兼容端点'
                                : '留空将默认继承并使用基础文本模型的接口基地址'
                            }
                            value={
                              aiSubTab === 'text'
                                ? aiConfig.baseUrl
                                : aiSubTab === 'vision'
                                ? aiConfig.visionBaseUrl
                                : aiConfig.embeddingBaseUrl
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              setAiConfig(prev => {
                                if (aiSubTab === 'text') return { ...prev, baseUrl: val };
                                if (aiSubTab === 'vision') return { ...prev, visionBaseUrl: val };
                                return { ...prev, embeddingBaseUrl: val };
                              });
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-500">
                          {aiSubTab === 'text' && '系统兼容 OpenAI 协议。支持私有化部署、DeepSeek、阿里千问等第三方服务。'}
                          {aiSubTab === 'vision' && '如果不填写，将默认继承基础文本模型的接口基地址。用于扫描版 PDF 的多模态 OCR 提取。'}
                          {aiSubTab === 'embedding' && '如果不填写，将默认继承基础文本模型的接口基地址。用于对产品标准条款进行向量检索。'}
                        </p>
                      </div>

                      {/* API Key */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="apiKey">
                          {aiSubTab === 'text' && 'API Key (密钥凭证)'}
                          {aiSubTab === 'vision' && 'Vision API Key (可选视觉密钥)'}
                          {aiSubTab === 'embedding' && 'Embedding API Key (可选嵌入密钥)'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500">
                            <Key className="w-4 h-4" />
                          </span>
                          <input
                            id="apiKey"
                            type="password"
                            placeholder={
                              aiSubTab === 'text'
                                ? (aiConfig.hasKey ? "••••••••已保存，若需更新请在此处重新输入" : "请输入大模型 API 授权密钥 (Key)")
                                : aiSubTab === 'vision'
                                ? (aiConfig.hasVisionKey ? "••••••••已保存，若需更新请在此处重新输入" : "留空将默认使用基础文本模型的 API 密钥")
                                : (aiConfig.hasEmbeddingKey ? "••••••••已保存，若需更新请在此处重新输入" : "留空将默认使用基础文本模型的 API 密钥")
                            }
                            value={
                              aiSubTab === 'text'
                                ? aiConfig.apiKey
                                : aiSubTab === 'vision'
                                ? aiConfig.visionApiKey
                                : aiConfig.embeddingApiKey
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              setAiConfig(prev => {
                                if (aiSubTab === 'text') return { ...prev, apiKey: val };
                                if (aiSubTab === 'vision') return { ...prev, visionApiKey: val };
                                return { ...prev, embeddingApiKey: val };
                              });
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                          />
                        </div>
                      </div>

                      {/* Model Name 和自动获取 */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="modelName">
                          {aiSubTab === 'text' && 'Model Name (默认解析与出题模型)'}
                          {aiSubTab === 'vision' && 'Vision Model Name (多模态图片识别模型)'}
                          {aiSubTab === 'embedding' && 'Embedding Model Name (向量维度计算模型)'}
                        </label>
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-500">
                              <Cpu className="w-4 h-4" />
                            </span>
                            {modelList.length > 0 ? (
                              <select
                                id="modelName"
                                value={
                                  aiSubTab === 'text'
                                    ? aiConfig.modelName
                                    : aiSubTab === 'vision'
                                    ? aiConfig.visionModelName
                                    : aiConfig.embeddingModelName
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAiConfig(prev => {
                                    if (aiSubTab === 'text') return { ...prev, modelName: val };
                                    if (aiSubTab === 'vision') return { ...prev, visionModelName: val };
                                    return { ...prev, embeddingModelName: val };
                                  });
                                }}
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/80 cursor-pointer appearance-none"
                              >
                                {modelList.map((m) => (
                                  <option key={m} value={m} className="bg-slate-50 dark:bg-[#0b0f19]">{m}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                id="modelName"
                                type="text"
                                required={aiSubTab === 'text'}
                                placeholder={
                                  aiSubTab === 'text'
                                    ? '例如: gpt-4o 或自定义模型 ID'
                                    : aiSubTab === 'vision'
                                    ? '例如: gpt-4o-mini 或 Qwen-VL 等，不填默认使用基础模型'
                                    : '例如: text-embedding-3-small 等，不填默认使用基础模型'
                                }
                                value={
                                  aiSubTab === 'text'
                                    ? aiConfig.modelName
                                    : aiSubTab === 'vision'
                                    ? aiConfig.visionModelName
                                    : aiConfig.embeddingModelName
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAiConfig(prev => {
                                    if (aiSubTab === 'text') return { ...prev, modelName: val };
                                    if (aiSubTab === 'vision') return { ...prev, visionModelName: val };
                                    return { ...prev, embeddingModelName: val };
                                  });
                                }}
                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={
                              fetchingModels ||
                              (aiSubTab === 'text' ? !aiConfig.baseUrl : false)
                            }
                            onClick={handleFetchModelList}
                            className="px-4 py-2.5 bg-white/[0.03] hover:bg-white/[0.06] active:scale-95 border border-slate-250 dark:border-white/[0.08] disabled:opacity-50 text-xs text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-1.5 transition-all duration-200"
                          >
                            {fetchingModels ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            自动获取模型
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-500">
                          点击“自动获取模型”将实时拉取该服务商下您可用的模型列表。
                        </p>
                      </div>

                      {/* 按钮行 */}
                      <div className="flex gap-3 pt-4 border-t border-slate-205 dark:border-white/[0.05]">
                        <button
                          type="submit"
                          disabled={actionLoading}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-95 text-xs text-slate-900 dark:text-white font-semibold rounded-xl shadow-lg shadow-blue-600/15 transition-all duration-200"
                        >
                          保存 AI 配置参数
                        </button>
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={
                            testingConnection ||
                            (aiSubTab === 'text' ? !aiConfig.baseUrl : false)
                          }
                          className="px-5 py-2.5 bg-white/[0.02] hover:bg-white/[0.05] active:scale-95 border border-slate-205 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 font-medium rounded-xl flex items-center gap-1.5 transition-all duration-200"
                        >
                          {testingConnection ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                          测试模型连通性
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧测试结果看板 */}
            <div className="space-y-6">
              <div className="backdrop-blur-md bg-white dark:bg-white/[0.01] border border-slate-250 dark:border-white/[0.05] rounded-2xl shadow-sm dark:shadow-none p-6 h-full flex flex-col justify-between min-h-[360px]">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-cyan-650 dark:text-cyan-400" />
                    连通性测试报告
                  </h3>

                  {!testResult ? (
                    <div className="text-center py-16 text-slate-500 dark:text-slate-500 space-y-3">
                      <HelpCircle className="w-10 h-10 mx-auto opacity-40 text-slate-600 dark:text-slate-400" />
                      <p className="text-xs">暂无测试数据，请在左侧填写配置后点击“测试模型连通性”进行联调。</p>
                    </div>
                  ) : (
                    <div className="space-y-5 animate-scale-in">
                      {/* 状态指示 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600 dark:text-slate-400">测试结果:</span>
                        {testResult.success ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-650 dark:text-emerald-400 shadow-sm shadow-emerald-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-ping" />
                            SUCCESS (联通成功)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-semibold text-red-400 shadow-sm shadow-red-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                            FAILED (测试失败)
                          </span>
                        )}
                      </div>

                      {/* 延迟 */}
                      {testResult.latency !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 dark:text-slate-400">接口延迟:</span>
                          <span className={`text-xs font-mono font-bold ${
                            testResult.latency < 1000 
                              ? 'text-emerald-650 dark:text-emerald-400' 
                              : testResult.latency < 4000 
                                ? 'text-amber-650 dark:text-amber-400' 
                                : 'text-red-400'
                          }`}>
                            {testResult.latency} ms
                          </span>
                        </div>
                      )}

                      {/* 模型实际回答 */}
                      {testResult.success ? (
                        <div className="space-y-1.5">
                          <span className="text-xs text-slate-600 dark:text-slate-400">模型 Ping-Pong 回答:</span>
                          <div className="p-3 bg-white dark:bg-[#090d16]/80 border border-slate-205 dark:border-white/[0.04] rounded-xl font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {testResult.reply}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <span className="text-xs text-slate-600 dark:text-slate-400">错误详情:</span>
                          <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl font-mono text-xs text-red-400 whitespace-pre-wrap leading-relaxed">
                            {testResult.error}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-500 dark:text-slate-500 pt-6 border-t border-slate-205 dark:border-white/[0.04] mt-6 leading-relaxed">
                  大模型配置将全局应用在**产品标准的智能解析出题**与考试过程中的**简答题主观题 AI 预阅卷分析**中。请务必保证连通成功以确保智能服务的可用性。
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* ============================== 各类弹窗模态框 ============================== */}
      {/* ========================================================================= */}

      {/* 弹窗一：新增部门 */}
      {showAddDepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl animate-scale-in">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">新增检测部门</h3>
            <form onSubmit={handleAddDepartment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="newDepName">部门名称</label>
                <input
                  id="newDepName"
                  type="text"
                  required
                  placeholder="请输入新增的部门名称，例如: 物理检测部"
                  value={depFormName}
                  onChange={(e) => setDepFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDepModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/[0.02] hover:bg-slate-200 hover:dark:bg-white/[0.05] border border-slate-205 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-xs text-white font-medium rounded-lg transition-all"
                >
                  {actionLoading ? '提交中...' : '确认创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 弹窗二：修改部门 */}
      {showEditDepModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl animate-scale-in">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">重命名部门</h3>
            <form onSubmit={handleEditDepartment} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editDepName">部门名称</label>
                <input
                  id="editDepName"
                  type="text"
                  required
                  value={depFormName}
                  onChange={(e) => setDepFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditDepModal(false);
                    setSelectedDep(null);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/[0.02] hover:bg-slate-200 hover:dark:bg-white/[0.05] border border-slate-205 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-xs text-white font-medium rounded-lg transition-all"
                >
                  {actionLoading ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 弹窗三：新增用户 */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg p-6 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-1.5">
              <UserPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              创建内部用户账号
            </h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              
              {/* 账号角色 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserRole">用户角色</label>
                  <select
                    id="addUserRole"
                    value={userForm.role}
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value, departmentId: e.target.value === 'ADMIN' ? '' : prev.departmentId || departments[0]?.id || '' }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="EXAMINEE">普通考试用户 (考生)</option>
                    <option value="CREATOR">部门出题员 (老师)</option>
                    <option value="ADMIN">系统管理员</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserStatus">账号状态</label>
                  <select
                    id="addUserStatus"
                    value={userForm.status}
                    onChange={(e) => setUserForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">激活 (启用)</option>
                    <option value="DISABLED">锁定 (禁用)</option>
                  </select>
                </div>
              </div>

              {/* 账号密码 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserUsername">登录账号 (英文/数字)</label>
                  <input
                    id="addUserUsername"
                    type="text"
                    required
                    placeholder="例: zhangsan"
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserPassword">初始密码</label>
                  <input
                    id="addUserPassword"
                    type="password"
                    required
                    placeholder="请输入初始登录密码"
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 实名工号 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserRealName">真实姓名</label>
                  <input
                    id="addUserRealName"
                    type="text"
                    required
                    placeholder="中文真实姓名"
                    value={userForm.realName}
                    onChange={(e) => setUserForm(prev => ({ ...prev, realName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserEmployeeId">唯一工号</label>
                  <input
                    id="addUserEmployeeId"
                    type="text"
                    required
                    placeholder="不可重复的唯一工号"
                    value={userForm.employeeId}
                    onChange={(e) => setUserForm(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 组织绑定 (管理员不显示) */}
              {userForm.role !== 'ADMIN' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserDept">所属检测部门</label>
                    <select
                      id="addUserDept"
                      required
                      value={userForm.departmentId}
                      onChange={(e) => setUserForm(prev => ({ ...prev, departmentId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      <option value="" disabled>请选择部门</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="addUserSection">具体科室/班组 (选填)</label>
                    <input
                      id="addUserSection"
                      type="text"
                      placeholder="例: 理化室"
                      value={userForm.sectionName}
                      onChange={(e) => setUserForm(prev => ({ ...prev, sectionName: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-205 dark:border-white/[0.05] mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/[0.02] hover:bg-slate-200 hover:dark:bg-white/[0.05] border border-slate-205 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-xs text-white font-medium rounded-lg transition-all"
                >
                  {actionLoading ? '创建中...' : '确认创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 弹窗四：编辑用户 */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg p-6 bg-white dark:bg-[#0c101a] border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-1.5">
              <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              编辑用户资料
            </h3>
            <form onSubmit={handleEditUser} className="space-y-4">
              
              {/* 角色与状态 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editUserRole">用户角色</label>
                  <select
                    id="editUserRole"
                    value={userForm.role}
                    disabled={selectedUser.username === 'admin'} // 保护初始超级管理员角色不被改
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value, departmentId: e.target.value === 'ADMIN' ? '' : prev.departmentId || departments[0]?.id || '' }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="EXAMINEE">普通考试用户 (考生)</option>
                    <option value="CREATOR">部门出题员 (老师)</option>
                    <option value="ADMIN">系统管理员</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editUserStatus">账号状态</label>
                  <select
                    id="editUserStatus"
                    value={userForm.status}
                    disabled={selectedUser.username === 'admin'} // 保护初始管理员不被禁用
                    onChange={(e) => setUserForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="ACTIVE">启用 (激活)</option>
                    <option value="DISABLED">禁用 (锁定)</option>
                  </select>
                </div>
              </div>

              {/* 账号与密码重置 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editUserUsername">登录账号</label>
                  <input
                    id="editUserUsername"
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1" htmlFor="editUserPassword">
                    <Key className="w-3 h-3 text-amber-650 dark:text-amber-400" />
                    重置密码 (留空则不改)
                  </label>
                  <input
                    id="editUserPassword"
                    type="password"
                    placeholder="重置密码请在此输入新密码"
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 实名与工号 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editUserRealName">真实姓名</label>
                  <input
                    id="editUserRealName"
                    type="text"
                    required
                    value={userForm.realName}
                    onChange={(e) => setUserForm(prev => ({ ...prev, realName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editUserEmployeeId">唯一工号</label>
                  <input
                    id="editUserEmployeeId"
                    type="text"
                    required
                    value={userForm.employeeId}
                    onChange={(e) => setUserForm(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 部门科室修改 (管理员不绑定) */}
              {userForm.role !== 'ADMIN' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editUserDept">所属检测部门</label>
                    <select
                      id="editUserDept"
                      required
                      value={userForm.departmentId}
                      onChange={(e) => setUserForm(prev => ({ ...prev, departmentId: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none cursor-pointer"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-600 dark:text-slate-400" htmlFor="editUserSection">具体科室/班组</label>
                    <input
                      id="editUserSection"
                      type="text"
                      placeholder="例: 液相分析室"
                      value={userForm.sectionName}
                      onChange={(e) => setUserForm(prev => ({ ...prev, sectionName: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-100 dark:bg-[#050810] border border-slate-250 dark:border-white/[0.08] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-205 dark:border-white/[0.05] mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 bg-slate-100 dark:bg-white/[0.02] hover:bg-slate-200 hover:dark:bg-white/[0.05] border border-slate-205 dark:border-white/[0.06] text-xs text-slate-700 dark:text-slate-300 rounded-lg transition-all"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-xs text-white font-medium rounded-lg transition-all"
                >
                  {actionLoading ? '保存中...' : '确认保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
