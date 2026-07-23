'use client';

import { useState, useEffect, useRef } from 'react';
import { setToken } from '@rhautt/shared-auth';

const css = `
.cl-page { max-width:420px; margin:0 auto; padding:56px 20px; min-height:100vh; }
.cl-header { text-align:center; margin-bottom:36px; }
.cl-logo { font-size:24px; font-weight:800; color:#E4002B; }
.cl-sub { font-size:13px; color:#697386; margin-top:8px; }
.cl-card { background:#fff; border-radius:14px; padding:28px 24px; box-shadow:0 2px 16px rgba(0,0,0,0.08); }
.cl-label { display:block; font-size:13px; font-weight:600; color:#1a1a2e; margin-bottom:8px; }
.cl-input { width:100%; border:1.5px solid #e3e8ee; border-radius:9px; padding:12px 14px; font-size:15px; outline:none; margin-bottom:16px; background:#fafafa; box-sizing:border-box; transition:border-color .2s; }
.cl-input:focus { border-color:#E4002B; background:#fff; }
.cl-row { display:flex; gap:10px; }
.cl-row .cl-input { flex:1; margin-bottom:16px; }
.cl-sms-btn { flex-shrink:0; height:47px; padding:0 14px; border:1.5px solid #E4002B; background:#fff; color:#E4002B; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
.cl-sms-btn:disabled { opacity:.5; cursor:not-allowed; border-color:#ccc; color:#999; }
.cl-btn { width:100%; background:#E4002B; color:#fff; border:none; border-radius:9px; padding:13px; font-size:15px; font-weight:700; cursor:pointer; transition:opacity .2s; }
.cl-btn:disabled { opacity:.55; cursor:not-allowed; }
.cl-error { color:#E4002B; font-size:13px; margin-top:12px; text-align:center; }
.cl-hint { font-size:12px; color:#9ca3af; margin-top:16px; text-align:center; line-height:1.6; }
`;

export default function CustomerLoginPage() {
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const returnUrl =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('returnUrl') || '/dashboard'
      : '/dashboard';

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const validPhone = /^1[3-9]\d{9}$/.test(phone.trim());

  async function sendCode() {
    if (!validPhone || countdown > 0) return;
    setSending(true); setError('');
    try {
      const res = await fetch('/api/v2/auth/send-sms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || '验证码发送失败');
      }
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1 && timerRef.current) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (e: any) {
      setError(e.message || '验证码发送失败');
    } finally {
      setSending(false);
    }
  }

  async function handleLogin() {
    if (!validPhone || !smsCode.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/v2/auth/login-sms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), smsCode: smsCode.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || '登录失败，请检查验证码');
      const token = json.data?.token ?? json.token;
      if (!token) throw new Error('登录响应缺少令牌');
      setToken(token);
      window.location.href = decodeURIComponent(returnUrl);
    } catch (e: any) {
      setError(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{css}</style>
      <div className="cl-page">
        <div className="cl-header">
          <div className="cl-logo">瑞诺瓦舒适家</div>
          <div className="cl-sub">客户登录 · 查看您的项目进度</div>
        </div>
        <div className="cl-card">
          <label className="cl-label">手机号</label>
          <input
            className="cl-input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="请输入注册手机号"
            autoFocus
          />
          <label className="cl-label">验证码</label>
          <div className="cl-row">
            <input
              className="cl-input"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
              placeholder="6 位短信验证码"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button className="cl-sms-btn" onClick={sendCode} disabled={!validPhone || countdown > 0 || sending}>
              {countdown > 0 ? `${countdown}s` : sending ? '发送中' : '获取验证码'}
            </button>
          </div>
          <button className="cl-btn" onClick={handleLogin} disabled={loading || !validPhone || !smsCode.trim()}>
            {loading ? '登录中…' : '登录'}
          </button>
          {error && <div className="cl-error">{error}</div>}
          <div className="cl-hint">
            无需登录也可用报价单号查询：<a href="/" style={{ color: '#E4002B' }}>返回查询入口</a>
          </div>
        </div>
      </div>
    </>
  );
}
