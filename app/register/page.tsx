'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, FileText, BadgeCheck, Network, ChevronLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface Department {
  id: string;
  name: string;
}

export default function RegisterPage() {
  const router = useRouter();
  
  // 表单状态
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [realName, setRealName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [sectionName, setSectionName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  
  // 部门数据与加载状态
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingDeps, setFetchingDeps] = useState(true);

  // 页面载入时自动初始化系统界面偏好配置 (主题、字体大小)
  useEffect(() => {
    const savedTheme = localStorage.getItem('ias-theme') || 'system';
    const savedFontSize = localStorage.getItem('ias-font-size') || 'sm';
    
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    
    if (savedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (savedTheme === 'light') {
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
    
    root.classList.remove('font-size-sm', 'font-size-md', 'font-size-lg');
    root.classList.add(`font-size-${savedFontSize}`);
  }, []);

  // 1. 获取部门列表
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await fetch('/api/auth/departments');
        if (!res.ok) throw new Error('获取部门列表失败');
        const data = await res.json();
        setDepartments(data);
      } catch (err: any) {
        console.error(err);
        setError('无法加载部门配置，请刷新页面或联系管理员。');
      } finally {
        setFetchingDeps(false);
      }
    };

    fetchDepartments();
  }, []);

  // 2. 提交注册表单
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!departmentId) {
      setError('请选择您所属的检测部门');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          realName,
          employeeId,
          departmentId,
          sectionName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '注册失败');
      }

      setSuccess(true);
      // 3秒后自动跳转至登录页面
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message || '连接服务器失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#030712] overflow-y-auto py-12 px-4 font-sans select-none transition-colors duration-300">
      {/* 科技发光背景光晕 */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-650/5 dark:bg-cyan-600/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/5 dark:bg-blue-500/10 blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />

      <div className="w-full max-w-[500px] z-10">
        {/* 返回登录按钮 */}
        <Link href="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition-colors mb-6 group">
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          返回账号登录
        </Link>

        {/* 注册卡片 (毛玻璃质感) */}
        <div className="backdrop-blur-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/40 relative overflow-hidden transition-all duration-300 hover:border-slate-300 dark:hover:border-white/[0.12]">
          
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">自主注册考生账号</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">请录入真实的检测人员信息，工号将作为系统唯一凭证</p>
          </div>

          {/* 注册成功状态展示 */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-scale-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 dark:text-emerald-400 mb-4 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-medium text-slate-900 dark:text-white">注册成功！</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-[280px]">
                您的普通考试账号已成功激活，正在为您自动导航至登录页面...
              </p>
              <div className="w-32 h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden mt-6">
                <div className="h-full bg-emerald-550 dark:bg-emerald-550 animate-loading-bar" />
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs mb-5 animate-shake">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                {/* 账号密码分栏 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 用户名 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="username">登录账号</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-400">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        id="username"
                        type="text"
                        required
                        placeholder="英文/数字"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* 密码 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="password">登录密码</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-400">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        id="password"
                        type="password"
                        required
                        placeholder="请输入密码"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* 姓名工号分栏 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 真实姓名 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="realName">真实姓名</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-400">
                        <BadgeCheck className="w-4 h-4" />
                      </span>
                      <input
                        id="realName"
                        type="text"
                        required
                        placeholder="中文姓名"
                        value={realName}
                        onChange={(e) => setRealName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                      />
                    </div>
                  </div>

                  {/* 工号 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="employeeId">唯一工号</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-400">
                        <FileText className="w-4 h-4" />
                      </span>
                      <input
                        id="employeeId"
                        type="text"
                        required
                        placeholder="员工工号 (唯一)"
                        value={employeeId}
                        onChange={(e) => setEmployeeId(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* 部门科室分栏 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 所属部门 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="department">检测部门</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-400">
                        <Network className="w-4 h-4" />
                      </span>
                      <select
                        id="department"
                        required
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        disabled={fetchingDeps}
                        className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200 appearance-none cursor-pointer disabled:opacity-50"
                      >
                        <option value="" disabled className="bg-white dark:bg-[#0b0f19] text-slate-400 dark:text-slate-500">选择您所属部门</option>
                        {departments.map((dep) => (
                          <option key={dep.id} value={dep.id} className="bg-white dark:bg-[#0b0f19] text-slate-900 dark:text-white">
                            {dep.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 科室名称 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="sectionName">所属科室/班组</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-450 dark:text-slate-400">
                        <FileText className="w-4 h-4" />
                      </span>
                      <input
                        id="sectionName"
                        type="text"
                        placeholder="例: 色谱分析科 (选填)"
                        value={sectionName}
                        onChange={(e) => setSectionName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* 提交注册按钮 */}
                <button
                  type="submit"
                  disabled={loading || fetchingDeps}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 text-white rounded-xl text-sm font-medium tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all duration-200 mt-6"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    '同意协议并注册'
                  )}
                </button>
              </form>

              {/* 登录引导 */}
              <div className="text-center mt-6 pt-5 border-t border-slate-200 dark:border-white/[0.06]">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  已有账号？
                  <Link href="/login" className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 font-medium ml-1 transition-colors">
                    直接登录
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>

        {/* 底部版权 */}
        <div className="text-center mt-8 text-[10px] text-slate-450 dark:text-slate-600">
          © 2026 广东质检院. 版权所有.
        </div>
      </div>
    </div>
  );
}
