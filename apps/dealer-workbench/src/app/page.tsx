'use client';
import { useState } from 'react';
import { auth } from '../lib/api';
import { setToken } from '@rhautt/shared-auth';

const HUB_BRAND = process.env.NEXT_PUBLIC_TENANT_BRAND || 'Rhautt Comfort';
const PLATFORM_TAG = process.env.NEXT_PUBLIC_PLATFORM_TAG || 'Powered by Rysnova AI';

// 品牌价值支柱（呼应「水与空气 · 低碳可持续」使命愿景）
const PILLARS = [
  { icon: '💧', label: '水', desc: '净水 · 中央热水' },
  { icon: '🌿', label: '空气', desc: '空调 · 新风 · 采暖' },
  { icon: '♻️', label: '低碳', desc: '高效节能技术' },
  { icon: '🧠', label: '数字化', desc: 'AI 问诊 → 设计 → 交付' },
];

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    if (typeof window === 'undefined') return '';
    const code = new URLSearchParams(window.location.search).get('ssoError');
    if (!code) return '';
    const messages: Record<string, string> = {
      missing_session: '登录状态已失效，请重新登录。',
      sso_unavailable: '单点登录暂不可用，请联系支持或使用账号密码登录。',
      sso_callback_failed: '单点登录未完成，请重试或联系支持。',
      unauthorized: '当前账号尚未获得 Nexus 访问授权，请联系管理员。',
    };
    return messages[code] || '单点登录未完成，请联系支持。';
  });
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await auth.login(phone, password);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setToken(res.token);
      await fetch('/api/session/bridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: res.token }),
      }).catch(() => {});
      // returnUrl 在提交时从 URL 读取，避免 useSearchParams 需 Suspense 边界导致的客户端水合中断。
      const returnUrl = (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('returnUrl')
        : null) || '/brand';
      window.location.href = decodeURIComponent(returnUrl);
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败');
    } finally { setLoading(false); }
  }

  function handleSsoLogin() {
    window.location.href = '/api/v2/auth/sso/login?redirect=/brand';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font)' }}>

      {/* ── 左栏：品牌可持续底板（Mission / Vision · 水与空气 · 低碳）──── */}
      <div className="login-brand-panel" style={{
        flex: '0 0 52%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', padding: '52px 56px',
        background: 'linear-gradient(168deg, #08301A 0%, #0E3F22 42%, #16542C 78%, #1C6634 100%)',
      }}>
        {/* 顶部晨雾光 + 右上生态光晕 */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 60% at 50% -10%, rgba(190,230,180,0.18) 0%, transparent 55%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: -90, right: -70, width: 380, height: 380, background: 'radial-gradient(circle, rgba(140,210,120,0.28) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* 水滴意象（VISION：水与空气）*/}
        <svg viewBox="0 0 200 260" width="300" style={{ position: 'absolute', top: 70, right: 24, opacity: 0.16, pointerEvents: 'none' }} aria-hidden>
          <path d="M100 8 C100 8 30 110 30 168 a70 70 0 0 0 140 0 C170 110 100 8 100 8 Z" fill="none" stroke="#EAF7E4" strokeWidth="2" />
          <path d="M100 60 C100 60 60 128 60 168 a40 40 0 0 0 80 0 C140 128 100 60 100 60 Z" fill="rgba(234,247,228,0.06)" stroke="rgba(234,247,228,0.35)" strokeWidth="1" />
        </svg>

        {/* 底部森林 / 云海剪影 */}
        <svg viewBox="0 0 600 220" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 240, opacity: 0.9, pointerEvents: 'none' }} aria-hidden>
          <path d="M0 150 Q80 110 150 140 T300 130 T450 145 T600 120 V220 H0 Z" fill="#0A3A1E" />
          <path d="M0 178 Q100 150 200 172 T400 168 T600 158 V220 H0 Z" fill="#072C16" />
          <path d="M0 200 Q120 186 260 198 T600 190 V220 H0 Z" fill="rgba(220,240,215,0.10)" />
        </svg>

        {/* Logo：Rhautt 红字标 + 生态徽章 */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
              <span style={{ color: '#E23B36' }}>Rh</span><span style={{ color: '#fff' }}>autt.</span>
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.18)' }}>{PLATFORM_TAG}</span>
          </div>
          <span style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid rgba(234,247,228,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 700, color: 'rgba(234,247,228,0.75)', lineHeight: 1.3, textAlign: 'center', letterSpacing: 0.3 }}>EARTH<br />COMFORT</span>
        </div>

        {/* MISSION */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#E23B36', letterSpacing: '0.08em' }}>MISSION</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>我们的使命</span>
          </div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, margin: 0 }}>
            以创新高效低碳技术与数字化服务为核心，<br />为每一个空间赋予更舒适、高效、可持续的生活环境。
          </p>
        </div>

        {/* VISION */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#E23B36', letterSpacing: '0.08em' }}>VISION</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>我们的愿景</span>
          </div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, margin: 0 }}>
            成为受人尊重的水和空气产品及解决方案、<br />可持续发展的引领者。
          </p>
        </div>

        {/* 价值支柱 */}
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 420 }}>
          {PILLARS.map(f => (
            <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(2px)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{f.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 底部水印 */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto', paddingTop: 30 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', letterSpacing: '0.05em' }}>
            © 2026 瑞合瑞德暖通科技集团 · {HUB_BRAND} · 一次登录，按角色进入所有应用
          </div>
        </div>
      </div>

      {/* ── 右栏：登录表单 ──────────────────────────────────── */}
      <div style={{
        flex: 1, background: 'var(--surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: 360 }} className="animate-fade-in">

          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t-strong)', letterSpacing: '-0.015em', marginBottom: 6 }}>
              欢迎回来
            </h2>
            <p style={{ fontSize: 14, color: 'var(--t-tertiary)' }}>登录 {HUB_BRAND} 统一入口</p>
          </div>

          {error && (
            <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 20 }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleSsoLogin}
            className="btn"
            style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginBottom: 14, borderRadius: 'var(--r)', background: '#111827', color: '#fff' }}>
            SSO 登录
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, color: 'var(--t-tertiary)', fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span>或使用账号密码</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--t-secondary)', marginBottom: 6 }}>账号 / 手机号</label>
              <input
                className="input"
                value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="邮箱 / 手机号"
                type="text" required autoFocus
                style={{ fontSize: 15, padding: '11px 14px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--t-secondary)', marginBottom: 6 }}>密码</label>
              <input
                className="input"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码"
                type="password" required
                style={{ fontSize: 15, padding: '11px 14px' }}
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="btn btn-brand"
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 4, borderRadius: 'var(--r)', boxShadow: loading ? 'none' : '0 2px 8px rgba(78,154,61,0.28)' }}>
              {loading ? '登录中…' : '登录'}
            </button>
          </form>

        </div>
      </div>

      {/* 移动端隐藏左栏 */}
      <style>{`
        @media (max-width: 768px) {
          .login-brand-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
