'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

/**
 * /settings/security — 账号安全
 *
 * 初期仅开放普通用户自助修改密码. MFA 后端能力保留, 但暂不在普通账号安全页露出.
 */

function SecurityPageInner() {
  return (
    <div className="page-container section-y md:py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <header>
          <h1 className="text-title-2 text-ink-primary">账号安全</h1>
          <p className="mt-2 text-body text-ink-secondary">
            修改登录密码. 修改成功后, 所有会话会退出并要求重新登录.
          </p>
        </header>

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
  const [visible, setVisible] = useState({
    old: false,
    next: false,
    confirm: false,
  });

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
            至少 7 位, 含大小写字母 + 数字, 可包含特殊字符. 不可与最近 5 次重复. 修改后需重新登录.
          </p>
          <form onSubmit={submit} className="mt-4 space-y-3 max-w-sm">
            <PasswordField
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="当前密码"
              autoComplete="current-password"
              visible={visible.old}
              onToggle={() => setVisible((state) => ({ ...state, old: !state.old }))}
            />
            <PasswordField
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新密码"
              autoComplete="new-password"
              visible={visible.next}
              onToggle={() => setVisible((state) => ({ ...state, next: !state.next }))}
            />
            <PasswordField
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="确认新密码"
              autoComplete="new-password"
              visible={visible.confirm}
              onToggle={() => setVisible((state) => ({ ...state, confirm: !state.confirm }))}
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

function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  visible,
  onToggle,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  visible: boolean;
  onToggle: () => void;
}) {
  const Icon = visible ? Eye : EyeOff;

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 pr-10 text-caption text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? `${placeholder}当前可见，点击隐藏` : `${placeholder}当前隐藏，点击显示`}
        title={visible ? '当前可见，点击隐藏' : '当前隐藏，点击显示'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-ink-tertiary hover:text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <Icon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function SecurityPage() {
  return <SecurityPageInner />;
}
