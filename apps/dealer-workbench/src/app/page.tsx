'use client';
import { useEffect, useState } from 'react';
import { BrainCircuit, Briefcase, Droplet, Leaf, UserRound, Wind } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { auth } from '../lib/api';
import { setToken } from '@rhautt/shared-auth';

const HUB_BRAND = process.env.NEXT_PUBLIC_TENANT_BRAND || 'Rhautt Comfort';
const PLATFORM_TAG = process.env.NEXT_PUBLIC_PLATFORM_TAG || 'Powered by Rysnova AI';

// 品牌价值支柱（呼应「水与空气 · 低碳可持续」使命愿景）— 用 lucide 图标（DESIGN.md：禁 emoji）
const PILLARS: { Icon: LucideIcon; label: string; desc: string }[] = [
  { Icon: Droplet, label: '水', desc: '净水 · 中央热水' },
  { Icon: Wind, label: '空气', desc: '空调 · 新风 · 采暖' },
  { Icon: Leaf, label: '低碳', desc: '高效节能技术' },
  { Icon: BrainCircuit, label: '数字化', desc: 'AI 问诊 → 设计 → 交付' },
];

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  // SSO 错误提示在客户端挂载后读取（避免在 useState 初始化里读 window 造成 SSR/水合不一致）。
  const [error, setError] = useState('');
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ssoError');
    if (!code) return;
    const messages: Record<string, string> = {
      missing_session: '登录状态已失效，请重新登录。',
      sso_unavailable: '单点登录暂不可用，请联系支持或使用账号密码登录。',
      sso_callback_failed: '单点登录未完成，请重试或联系支持。',
      unauthorized: '当前账号尚未获得 Nexus 访问授权，请联系管理员。',
    };
    setError(messages[code] || '单点登录未完成，请联系支持。');
  }, []);
  const [loading, setLoading] = useState(false);
  // 两道门：choose 选择入口 · staff 员工(牛马搭子SSO/内部账号) · customer 客户(手机验证码)
  const [mode, setMode] = useState<'choose' | 'staff' | 'customer'>('choose');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsSent, setSmsSent] = useState(false);

  async function handleSendSms() {
    setError('');
    try { await auth.sendSms(phone); setSmsSent(true); }
    catch (err: unknown) { setError((err as Error).message || '验证码发送失败'); }
  }

  async function handleCustomerLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await auth.loginSms(phone, smsCode);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      setToken(res.token);
      window.location.href = '/brand';
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败');
    } finally { setLoading(false); }
  }

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

  // 仅开发环境：访客直进，跳过登录直接看工作台 UI（设临时超管态，不接真实后端数据）。
  function handleDevGuest() {
    localStorage.setItem('token', 'dev-guest');
    localStorage.setItem('user', JSON.stringify({ id: 'dev-guest', name: '访客(dev)', role: 'platform_admin', roles: ['platform_admin'], permissions: ['*'] }));
    setToken('dev-guest');
    window.location.href = '/cmo';
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font)' }}>

      {/* ── 左栏：品牌可持续底板（Mission / Vision · 水与空气 · 低碳）──── */}
      <div className="login-brand-panel" style={{
        flex: '0 0 48%', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', padding: 48,
        background: 'var(--sidebar, #111827)', color: '#fff',
      }}>
        {/* DESIGN.md：禁渐变主色块 / 禁装饰过度 —— 纯深色底 + 一条品牌红顶栏点缀 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--brand, #C8102E)' }} />

        {/* Logo：Rhautt 红字标 + 生态徽章 */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>
              <span style={{ color: 'var(--brand, #C8102E)' }}>Rh</span><span style={{ color: '#fff' }}>autt.</span>
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.18)' }}>{PLATFORM_TAG}</span>
          </div>
          <span style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 700, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3, textAlign: 'center', letterSpacing: 0.3 }}>EARTH<br />COMFORT</span>
        </div>

        {/* MISSION */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand, #C8102E)', letterSpacing: '0.08em' }}>MISSION</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>我们的使命</span>
          </div>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, margin: 0 }}>
            以创新高效低碳技术与数字化服务为核心，<br />为每一个空间赋予更舒适、高效、可持续的生活环境。
          </p>
        </div>

        {/* VISION */}
        <div style={{ position: 'relative', zIndex: 1, marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--brand, #C8102E)', letterSpacing: '0.08em' }}>VISION</span>
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
              <f.Icon size={18} strokeWidth={1.75} style={{ flexShrink: 0, color: 'rgba(255,255,255,0.85)' }} />
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
        <div style={{ width: '100%', maxWidth: 380 }} className="animate-fade-in">

          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t-strong)', letterSpacing: '-0.015em', marginBottom: 6 }}>
              {mode === 'customer' ? '客户入口' : mode === 'staff' ? '员工入口' : '选择入口'}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--t-tertiary)' }}>AI GTM Nexus · 瑞合数智枢纽营销中枢</p>
          </div>

          {error && (
            <div role="alert" style={{ background: 'var(--danger-bg)', border: '1px solid #FCA5A5', borderRadius: 'var(--r-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 20 }}>
              {error}
            </div>
          )}

          {/* 两道门：员工 / 客户 */}
          {mode === 'choose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button type="button" onClick={() => { setError(''); setMode('staff'); }}
                className="btn" style={{ width: '100%', justifyContent: 'flex-start', gap: 14, padding: '18px', borderRadius: 'var(--r)', background: 'var(--sidebar, #111827)', color: '#fff', textAlign: 'left' }}>
                <Briefcase size={22} strokeWidth={1.75} style={{ flexShrink: 0 }} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>员工入口</span>
                  <span style={{ fontSize: 12, opacity: 0.7 }}>从 Tandem 账户单点登录</span>
                </span>
              </button>
              <button type="button" onClick={() => { setError(''); setSmsSent(false); setMode('customer'); }}
                className="btn btn-outline" style={{ width: '100%', justifyContent: 'flex-start', gap: 14, padding: '18px', borderRadius: 'var(--r)', textAlign: 'left' }}>
                <UserRound size={22} strokeWidth={1.75} style={{ flexShrink: 0, color: 'var(--t-secondary)' }} />
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>客户入口</span>
                  <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>手机号验证码登录</span>
                </span>
              </button>
              {process.env.NODE_ENV !== 'production' && (
                <button type="button" onClick={handleDevGuest}
                  className="btn btn-outline" style={{ width: '100%', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 'var(--r)', fontSize: 13, borderStyle: 'dashed', color: 'var(--t-tertiary)' }}>
                  访客直进（仅开发 · 看 UI，不接真实数据）
                </button>
              )}
            </div>
          )}

          {/* 员工入口：Tandem SSO 直通（+ 内部账号密码备用） */}
          {mode === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <button type="button" onClick={handleSsoLogin}
                className="btn" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, borderRadius: 'var(--r)', background: 'var(--sidebar, #111827)', color: '#fff' }}>
                从 Tandem 单点登录
              </button>
              <p style={{ fontSize: 12, color: 'var(--t-tertiary)', textAlign: 'center', margin: 0 }}>已登录 Tandem？一键进入，无需重新登录。</p>

              {!showStaffPassword ? (
                <button type="button" onClick={() => setShowStaffPassword(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--t-tertiary)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  内部账号密码登录（备用）
                </button>
              ) : (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
                  <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="邮箱 / 手机号" type="text" required autoFocus style={{ fontSize: 15, padding: '11px 14px' }} />
                  <input className="input" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" type="password" required style={{ fontSize: 15, padding: '11px 14px' }} />
                  <button type="submit" disabled={loading} className="btn btn-brand" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, borderRadius: 'var(--r)' }}>{loading ? '登录中…' : '登录'}</button>
                </form>
              )}
              <button type="button" onClick={() => { setError(''); setMode('choose'); }} style={{ background: 'none', border: 'none', color: 'var(--t-tertiary)', fontSize: 13, cursor: 'pointer' }}>← 返回选择入口</button>
            </div>
          )}

          {/* 客户入口：手机验证码 */}
          {mode === 'customer' && (
            <form onSubmit={handleCustomerLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="手机号" type="tel" required autoFocus style={{ fontSize: 15, padding: '11px 14px' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input" value={smsCode} onChange={e => setSmsCode(e.target.value)} placeholder="验证码" type="text" required style={{ flex: 1, fontSize: 15, padding: '11px 14px' }} />
                <button type="button" onClick={handleSendSms} disabled={!phone} className="btn btn-outline" style={{ whiteSpace: 'nowrap', padding: '11px 14px' }}>{smsSent ? '重新发送' : '获取验证码'}</button>
              </div>
              <button type="submit" disabled={loading} className="btn btn-brand" style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, borderRadius: 'var(--r)' }}>{loading ? '登录中…' : '登录'}</button>
              <button type="button" onClick={() => { setError(''); setMode('choose'); }} style={{ background: 'none', border: 'none', color: 'var(--t-tertiary)', fontSize: 13, cursor: 'pointer' }}>← 返回选择入口</button>
            </form>
          )}

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
