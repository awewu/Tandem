'use client';

import { useEffect, useState } from 'react';
import { getToken } from '@rhautt/shared-auth';

/**
 * 单一登录入口守卫（与 designer / bim 端一致的体验）。
 *
 * 说明：brand-console 的后端访问全部在服务端完成（route handlers + JWT_SECRET 铸服务令牌），
 * 客户端不直连 :3300，也没有 /api/v2/* 代理。因此这里做「本地令牌校验」：
 *   1. 读共享 nx_token cookie（localhost 跨端口天然共享）。
 *   2. 解码 JWT payload，检查存在且未过期 → 免登进入。
 *   3. 缺失/过期 → 跳显式配置的统一登录入口，带 returnUrl 回跳本端。
 * 真正的接口鉴权仍由后端在每次请求时强制，这里仅做进入态的 UX 门禁。
 *
 * 独立部署模式（默认，或 NEXT_PUBLIC_AUTH_STANDALONE=true）：不跳统一登录入口，
 * 直接放行到本端账号密码登录（page.tsx → Login → /api/session）。用于 4012
 * 单机运行、无统一身份网关的场景。
 */
const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || '/';
const STANDALONE = process.env.NEXT_PUBLIC_AUTH_STANDALONE !== 'false';

function tokenValid(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && payload.exp < Date.now() / 1000) return false;
    return true;
  } catch {
    return false;
  }
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'authed'>(STANDALONE ? 'authed' : 'checking');

  useEffect(() => {
    // 独立部署：跳过统一登录入口跳转，交给服务端 page.tsx + 本地账号密码登录把关。
    if (STANDALONE) return;
    const token = getToken() || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (tokenValid(token)) { setState('authed'); return; }
    if (typeof window === 'undefined') return;
    const back = encodeURIComponent(window.location.href);
    window.location.href = `${LOGIN_URL}/?returnUrl=${back}`;
  }, []);

  if (state === 'authed') return <>{children}</>;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#241F1B', color: '#fff' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#4E9A3D', animation: 'ryspin 0.8s linear infinite' }} />
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>正在跳转统一登录入口…</div>
      <style>{`@keyframes ryspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
