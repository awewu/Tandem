'use client';
import { useState } from 'react';

export default function Login({ sso = false }: { sso?: boolean }) {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || '登录失败'); setBusy(false); return; }
      location.reload();
    } catch { setErr('网络错误'); setBusy(false); }
  }

  return (
    <div className="login-box card">
      <h1><span style={{ color: 'var(--red)' }}>Everhot</span> 品牌运营控制台</h1>
      <p className="muted">板块一 · 内部 admin（产品库 / 上下架 / 产品图 / 发布）</p>

      {sso && (
        <a className="btn btn-primary" href="/api/session/sso" style={{ width: '100%', display: 'block', textAlign: 'center', marginTop: 8 }}>
          使用统一身份（SSO）登录
        </a>
      )}
      {sso && <p className="muted" style={{ textAlign: 'center', margin: '12px 0' }}>本环境已启用共享身份认证，无需账号密码。</p>}

      {!sso && <form onSubmit={submit}>
        <div className="field">
          <label>账号</label>
          <input value={user} onChange={(e) => setUser(e.target.value)} autoFocus placeholder="admin" />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={busy}>
          {busy ? '登录中…' : '登录'}
        </button>
      </form>}
    </div>
  );
}
