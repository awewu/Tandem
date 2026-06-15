'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Copy,
  Check,
  Download,
  Loader2,
  Lock,
} from 'lucide-react';

/**
 * /settings/security — 账号安全 · MFA (TOTP) 启用
 *
 * 流程 (对应 POST /api/auth/mfa/setup 两阶段):
 *   1. 「启用」→ POST {} → 拿 otpauthUri + secretBase32 + recoveryCodes (一次性)
 *   2. 渲染二维码 (本地生成, secret 不出浏览器) + 展示恢复码
 *   3. 输入验证器 6 位码 → POST {secretBase32, totpCode, recoveryCodes} → 入库 + 重签 token
 *
 * 特权角色 (owner/admin/steward) 在 REQUIRE_MFA_FOR_PRIVILEGED=1 时被强制跳到这里 (?enrollMfa=1).
 */

interface MfaStatus {
  enrolled: boolean;
  recoveryCodesRemaining: number;
  sessionMfaVerified: boolean;
}

interface EnrollMaterial {
  otpauthUri: string;
  secretBase32: string;
  recoveryCodes: string[];
  qrDataUrl: string;
}

function SecurityPageInner() {
  const search = useSearchParams();
  const forced = search.get('enrollMfa') === '1';

  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [material, setMaterial] = useState<EnrollMaterial | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState<'secret' | 'codes' | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/auth/mfa/setup', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setStatus(data as MfaStatus);
    } catch {
      /* ignore — 显示启用入口即可 */
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function beginEnroll() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '生成 MFA 密钥失败');
        return;
      }
      const mat: EnrollMaterial = {
        otpauthUri: data.otpauthUri,
        secretBase32: data.secretBase32,
        recoveryCodes: data.recoveryCodes,
        qrDataUrl: data.qrDataUrl,
      };
      setMaterial(mat);
      setQrDataUrl(data.qrDataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!material) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/mfa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          secretBase32: material.secretBase32,
          totpCode: totpCode.trim(),
          recoveryCodes: material.recoveryCodes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'TOTP 验证失败, 请重新输入');
        return;
      }
      setDone(true);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, which: 'secret' | 'codes') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard 不可用时忽略 */
    }
  }

  function downloadCodes() {
    if (!material) return;
    const blob = new Blob([material.recoveryCodes.join('\n') + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tandem-mfa-recovery-codes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const alreadyEnrolled = status?.enrolled && !material;

  return (
    <div className="page-container section-y md:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-title-2 text-ink-primary">账号安全 · MFA</h1>
          <p className="mt-2 text-body text-ink-secondary">
            为账号启用双因素认证 (TOTP). 使用 Google Authenticator / 1Password / 微软 Authenticator 等扫码即可.
          </p>
        </header>

        {forced && !done && !alreadyEnrolled && (
          <div className="card-elevated p-4 border-l-4 border-warning bg-warning/5">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <p className="text-caption text-ink-secondary">
                你的角色 (owner / admin / steward) 被要求启用 MFA 后才能继续使用系统. 请完成下面的启用流程.
              </p>
            </div>
          </div>
        )}

        {/* 已启用状态 */}
        {alreadyEnrolled && (
          <div className="card-elevated p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-success/10 text-success p-3">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-headline text-ink-primary">MFA 已启用</h2>
                <p className="mt-1 text-caption text-ink-secondary">
                  剩余可用恢复码: <span className="font-medium text-ink-primary">{status?.recoveryCodesRemaining ?? 0}</span> 个.
                  本次会话 MFA 验证状态: {status?.sessionMfaVerified ? '已验证' : '未验证'}.
                </p>
                <p className="mt-3 text-footnote text-ink-tertiary">
                  如需重置 MFA 或恢复码, 请联系管理员.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 启用成功 */}
        {done && (
          <div className="card-elevated p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-success/10 text-success p-3">
                <Check className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-headline text-ink-primary">MFA 启用成功</h2>
                <p className="mt-1 text-caption text-ink-secondary">
                  下次登录将要求输入验证器 6 位码. 请妥善保存恢复码 (丢失验证器时使用).
                </p>
                <a
                  href="/"
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 text-caption font-medium shadow-soft-sm surface-interactive"
                >
                  返回首页 →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* 启用入口 */}
        {!loadingStatus && !alreadyEnrolled && !material && !done && (
          <div className="card-elevated p-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-brand-50 text-brand-600 p-3">
                <KeyRound className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h2 className="text-headline text-ink-primary">启用双因素认证</h2>
                <p className="mt-1 text-caption text-ink-secondary">
                  点击生成密钥后, 用验证器 App 扫码绑定, 再输入一次 6 位码完成启用.
                </p>
                <button
                  onClick={beginEnroll}
                  disabled={busy}
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 text-caption font-medium shadow-soft-sm surface-interactive disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  {busy ? '生成中...' : '启用 MFA'}
                </button>
                {error && <p className="mt-2 text-footnote text-danger">{error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* 绑定 + 验证 */}
        {material && !done && (
          <div className="card-elevated p-6 space-y-6">
            <div>
              <h2 className="text-headline text-ink-primary">1. 扫码绑定</h2>
              <p className="mt-1 text-caption text-ink-secondary">
                用验证器 App 扫描二维码; 无法扫码时可手动输入密钥.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-5 items-start">
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-border bg-white p-2 shrink-0">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="MFA 二维码" className="h-full w-full object-contain" />
                  ) : (
                    <Loader2 className="h-8 w-8 text-ink-tertiary animate-spin" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-footnote text-ink-tertiary">手动输入密钥 (Base32)</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded-md bg-[rgb(var(--surface-2))] px-3 py-2 text-caption text-ink-primary border border-border">
                      {material.secretBase32}
                    </code>
                    <button
                      onClick={() => copyText(material.secretBase32, 'secret')}
                      className="shrink-0 rounded-md border border-border p-2 text-ink-secondary hover:text-ink-primary surface-interactive"
                      title="复制密钥"
                    >
                      {copied === 'secret' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-headline text-ink-primary">2. 保存恢复码</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyText(material.recoveryCodes.join('\n'), 'codes')}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-footnote text-ink-secondary hover:text-ink-primary surface-interactive"
                  >
                    {copied === 'codes' ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    复制
                  </button>
                  <button
                    onClick={downloadCodes}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-footnote text-ink-secondary hover:text-ink-primary surface-interactive"
                  >
                    <Download className="h-3.5 w-3.5" />
                    下载
                  </button>
                </div>
              </div>
              <p className="mt-1 text-caption text-ink-secondary">
                丢失验证器时用恢复码登录. 每个仅可用一次, 请离线保存. <span className="text-danger">此页面关闭后不再显示.</span>
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {material.recoveryCodes.map((c) => (
                  <code
                    key={c}
                    className="rounded-md bg-[rgb(var(--surface-2))] px-3 py-2 text-caption text-ink-primary border border-border text-center tracking-wider"
                  >
                    {c}
                  </code>
                ))}
              </div>
            </div>

            <form onSubmit={confirmEnroll}>
              <h2 className="text-headline text-ink-primary">3. 输入验证码确认</h2>
              <p className="mt-1 text-caption text-ink-secondary">输入验证器当前显示的 6 位码完成启用.</p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="w-40 rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-title-3 tracking-[0.3em] text-center text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <button
                  type="submit"
                  disabled={busy || totpCode.length !== 6}
                  className="inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 text-caption font-medium shadow-soft-sm surface-interactive disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  {busy ? '验证中...' : '确认启用'}
                </button>
              </div>
              {error && <p className="mt-2 text-footnote text-danger">{error}</p>}
            </form>
          </div>
        )}

        {loadingStatus && (
          <div className="card-elevated p-6 flex items-center gap-3 text-ink-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-caption">加载安全设置...</span>
          </div>
        )}

        {/* 修改密码 (密码轮换体系入口) */}
        <ChangePasswordCard />
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '修改密码失败');
        return;
      }
      setDone(true);
      // 全部会话已撤销, 2s 后跳登录
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card-elevated p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-success/10 text-success p-3">
            <Check className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-headline text-ink-primary">密码已修改</h2>
            <p className="mt-1 text-caption text-ink-secondary">
              为安全起见, 所有会话已退出. 正在跳转到登录页...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-lg bg-brand-50 text-brand-600 p-3">
          <Lock className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-headline text-ink-primary">修改密码</h2>
          <p className="mt-1 text-caption text-ink-secondary">
            至少 10 位, 含大小写字母 + 数字 + 特殊字符, 不可与最近 5 次重复. 修改后需重新登录.
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3 max-w-sm">
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="当前密码"
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-caption text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码"
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-caption text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="确认新密码"
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-caption text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={busy || !oldPassword || !newPassword || !confirm}
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 text-caption font-medium shadow-soft-sm surface-interactive disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              {busy ? '提交中...' : '修改密码'}
            </button>
            {error && <p className="text-footnote text-danger">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SecurityPage() {
  return (
    <Suspense fallback={null}>
      <SecurityPageInner />
    </Suspense>
  );
}
