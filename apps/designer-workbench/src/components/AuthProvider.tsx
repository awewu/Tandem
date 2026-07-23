'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@rhautt/shared-auth';

/**
 * 单一登录入口守卫（不再各端各弹表单）：
 *  1. 读共享 nx_token cookie（localhost 跨端口天然共享）→ 已登录直接免登进入。
 *  2. 未登录 → 跳转「统一登录入口」(:5000)，带 returnUrl 回跳本端。
 * 登录页与「按角色路由」的门户(/hub)统一由 dealer-workbench 承载。
 */
const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || 'http://localhost:5000';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'authed'>('checking');

  useEffect(() => {
    const token = getToken() || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) { gotoLogin(); return; }
    fetch('/api/v2/auth/me', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((r) => { if (r.ok) setState('authed'); else gotoLogin(); })
      .catch(() => gotoLogin());
  }, []);

  function gotoLogin() {
    if (typeof window === 'undefined') return;
    const back = encodeURIComponent(window.location.href);
    window.location.href = `${LOGIN_URL}/?returnUrl=${back}`;
  }

  if (state === 'authed') return <>{children}</>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f7f9fc', color: '#0f172a' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(15,23,42,0.12)', borderTopColor: '#4E9A3D', animation: 'ryspin 0.8s linear infinite' }} />
      <div style={{ fontSize: 14, color: '#64748b' }}>正在跳转统一登录入口…</div>
      <style>{`@keyframes ryspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
