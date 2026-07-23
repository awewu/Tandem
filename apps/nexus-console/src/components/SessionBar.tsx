'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  userId?: string;
  role?: string;
  tenantId?: string;
}

function readDevCookie(): User | null {
  try {
    const match = document.cookie.match(/(?:^|; )nx_token=([^;]*)/);
    if (!match) return null;
    const token = decodeURIComponent(match[1]);
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    // 兼容 Hub(:5000 经 :3300 签发)的 JWT：其 payload 不含 env 字段，
    // 早期只认 env==='dev' 会导致从 Hub 免登进入时仍要求二次登录。
    // 这里放宽为「只要未过期即认可共享登录态」。
    if (payload.env && payload.env !== 'dev') return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return { userId: payload.sub || payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export default function SessionBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    // Try server session first, fall back to shared dev cookie (hub SSO)
    fetch('/api/session')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.user) {
          setUser(d.user);
        } else {
          // Fallback: read dev JWT from shared cookie (set by hub page)
          const devUser = readDevCookie();
          if (devUser) setUser(devUser);
        }
      })
      .catch(() => {
        if (!alive) return;
        const devUser = readDevCookie();
        if (devUser) setUser(devUser);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d?.error || '登录失败');
        return;
      }
      setUser(d.user ?? { role: 'user' });
      setOpen(false);
      setPhone('');
      setPassword('');
      window.dispatchEvent(new Event('nexus-session-changed'));
      router.refresh(); // re-render server components → real KPIs light up
    } catch {
      setErr('网络错误');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' }).catch(() => {});
    // Also clear the shared dev cookie
    document.cookie = 'nx_token=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax';
    setUser(null);
    window.dispatchEvent(new Event('nexus-session-changed'));
    router.refresh();
  }

  if (user) {
    return (
      <div className="user">
        <span className="av">{(user.role || '管').slice(0, 1).toUpperCase()}</span>
        {user.role || '已登录'}
        <button className="btn ghost" style={{ marginLeft: 8, padding: '4px 10px' }} onClick={logout}>
          退出
        </button>
      </div>
    );
  }

  return (
    <div className="user" style={{ position: 'relative' }}>
      <button className="btn ghost" style={{ padding: '6px 12px' }} onClick={() => setOpen((v) => !v)}>
        登录
      </button>
      {open && (
        <form
          onSubmit={login}
          style={{
            position: 'absolute',
            top: 38,
            right: 0,
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 14,
            width: 240,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 20,
          }}
        >
          <input
            placeholder="手机号"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={inputStyle}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete="current-password"
          />
          {err && <span style={{ color: '#ff7a8a', fontSize: 12 }}>{err}</span>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? '登录中…' : '登录'}
          </button>
          <span style={{ color: 'var(--dim)', fontSize: 11 }}>连接 NestJS（/api/v2/auth/login）</span>
        </form>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--panel2)',
  border: '1px solid var(--line)',
  borderRadius: 8,
  padding: '8px 10px',
  color: 'var(--ink)',
  fontSize: 13,
};
