'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrainCircuit } from 'lucide-react';

export default function LoadingTransitionPage() {
  const router = useRouter();

  useEffect(() => {
    // 根路径主要依赖 middleware.ts 的强力重定向
    // 在此执行一个降级本地跳转，防范中间件意外漏过
    const checkRedirect = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        if (data.success && data.user) {
          const role = data.user.role;
          if (role === 'ADMIN') router.push('/admin');
          else if (role === 'CREATOR') router.push('/creator');
          else if (role === 'EXAMINEE') router.push('/examinee');
          else window.location.href = '/login';
        } else {
          window.location.href = '/login';
        }
      } catch (err) {
        console.error(err);
        window.location.href = '/login';
      }
    };
    
    // 给 600ms 的精致加载体验，然后再触发降级跳转
    const timer = setTimeout(() => {
      checkRedirect();
    }, 600);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(6,182,212,0.12),rgba(255,255,255,0))] flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* 背景科技光球 */}
      <div className="absolute w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* 居中加载框 */}
      <div className="flex flex-col items-center gap-6 z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* 发光 Logo */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20 animate-pulse">
          <BrainCircuit className="w-10 h-10 text-white" />
        </div>
        
        {/* 动态文字与科技加载圈 */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-lg font-bold tracking-widest text-slate-200">
            GQI 检验员考核系统
          </h1>
          <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">
            Securing Connection & Redirecting...
          </p>
        </div>

        {/* 极细循环科技进度条 */}
        <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden relative border border-slate-800/60">
          <div className="absolute top-0 left-0 h-full w-24 bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full animate-loading-bar-custom" />
        </div>
      </div>
    </div>
  );
}
