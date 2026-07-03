'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Lock, Eye, EyeOff, ShieldAlert, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 主题与字体设置 (默认为跟随系统)
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('system');
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

  useEffect(() => {
    const savedTheme = (localStorage.getItem('ias-theme') as 'dark' | 'light' | 'system') || 'system';
    const savedFontSize = (localStorage.getItem('ias-font-size') as 'sm' | 'md' | 'lg') || 'sm';
    setTheme(savedTheme);
    setFontSize(savedFontSize);
    applyTheme(savedTheme);
    applyFontSize(savedFontSize);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '登录失败');
      }

      // 登录成功，由于中间件会自动拦截根目录并重定向至对应控制台，我们直接导向根路径
      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message || '连接服务器失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#030712] overflow-y-auto pt-24 pb-12 px-4 font-sans select-none transition-colors duration-300">
      {/* 科技发光背景光晕 */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/10 blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/10 blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '6s' }} />

      {/* 右上角个性化设置浮窗卡片 */}
      <div className="absolute top-4 right-4 z-50 p-3 rounded-2xl bg-white/80 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-lg backdrop-blur-md flex flex-col gap-2 text-xs transition-all w-auto max-w-[340px]">
        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-center">系统界面偏好配置</div>
        
        <div className="grid grid-cols-2 gap-3">
          {/* 配色主题切换 */}
          <div className="flex flex-col gap-1">
            <span className="text-slate-600 dark:text-slate-400 text-[10px] font-medium text-center">配色主题</span>
            <div className="grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-300 dark:border-slate-800/85">
              {(['dark', 'light', 'system'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleThemeChange(t)}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    theme === t
                      ? 'bg-white dark:bg-cyan-500/10 border border-slate-300 dark:border-cyan-500/35 text-cyan-600 dark:text-cyan-400 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200'
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
          <div className="flex flex-col gap-1">
            <span className="text-slate-600 dark:text-slate-400 text-[10px] font-medium text-center">字体大小</span>
            <div className="grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-950/50 p-1 rounded-xl border border-slate-300 dark:border-slate-800/85">
              {(['sm', 'md', 'lg'] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleFontSizeChange(sz)}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-medium transition-all ${
                    fontSize === sz
                      ? 'bg-white dark:bg-cyan-500/10 border border-slate-300 dark:border-cyan-500/35 text-cyan-600 dark:text-cyan-400 font-bold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-slate-200'
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

      <div className="w-full max-w-[440px] px-2 z-10">
        {/* 系统标志 */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-[1px] shadow-lg shadow-blue-500/10 mb-4">
            <div className="w-full h-full bg-slate-50 dark:bg-[#0b0f19] rounded-xl flex items-center justify-center">
              <span className="text-xl font-black text-red-500 font-sans">GQI</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wider">检验员考核系统</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Inspector Assessment & Training System</p>
        </div>

        {/* 登录卡片 (毛玻璃质感) */}
        <div className="backdrop-blur-xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/10 dark:shadow-black/40 relative overflow-hidden transition-all duration-300 hover:border-slate-300 hover:dark:border-white/[0.12]">
          
          <h2 className="text-lg font-medium text-slate-900 dark:text-white mb-6">欢迎登录</h2>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-5 animate-shake">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* 用户名 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="username">用户名</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  id="username"
                  type="text"
                  required
                  placeholder="请输入您的账号"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300" htmlFor="password">密码</label>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-100 dark:bg-[#090d16]/60 border border-slate-250 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 hover:dark:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100 text-white rounded-xl text-sm font-medium tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 transition-all duration-200 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  安全登录
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* 注册引导 */}
          <div className="text-center mt-6 pt-5 border-t border-slate-200 dark:border-white/[0.06]">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              没有账号？
              <Link href="/register" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:dark:text-blue-300 font-medium ml-1 transition-colors">
                立即自主注册
              </Link>
            </p>
          </div>
        </div>

        {/* 预留企业对接 / SSO / OA 快捷跳转模块 */}
        <div className="mt-8 text-center animate-fade-in-slow">
          <p className="text-[11px] text-slate-500 uppercase tracking-widest mb-3">其他登录通道</p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={() => alert('已为后续单位统一登录门户接入预留接口')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-50 hover:dark:bg-white/[0.05] active:scale-95 transition-all duration-200 shadow-sm dark:shadow-none"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-ping" />
              统一门户单点登录 (SSO)
            </button>
            <button 
              onClick={() => alert('已为后续办公OA系统快捷跳转接入预留接口')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.04] text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:dark:text-white hover:bg-slate-50 hover:dark:bg-white/[0.05] active:scale-95 transition-all duration-200 shadow-sm dark:shadow-none"
            >
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50 animate-ping" />
              办公 OA 系统跳转
            </button>
          </div>
        </div>

        {/* 版权信息 */}
        <div className="text-center mt-12 text-[10px] text-slate-500 dark:text-slate-600">
          © 2026 广东质检院. 版权所有.
        </div>
      </div>
    </div>
  );
}
