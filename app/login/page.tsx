'use client';

/**
 * Login page — Rheem "hello." style.
 *
 * Two-pane fullscreen layout:
 *   Left  · Brand panel — large display "hello." with red dot, grid texture, slogan
 *   Right · Auth form  — pill-rounded inputs, Rheem-red pill CTA, MFA stage
 *
 * Renders without AppShell (Rail + SubSidebar return null on /login).
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, ShieldCheck, KeyRound, HandHeart, Smile } from 'lucide-react';

// useSearchParams() in a Client Component must be wrapped in <Suspense> for prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';

  const [stage, setStage] = useState<'creds' | 'mfa'>('creds');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [remember, setRemember] = useState(true);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitCreds(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '登录失败');
        return;
      }
      if (data.requiresMfa) {
        setPendingSessionId(data.pendingSessionId);
        setStage('mfa');
      } else {
        router.push(next);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitMfa(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingSessionId,
          totpCode: totpCode || undefined,
          recoveryCode: recoveryCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'MFA 验证失败');
        return;
      }
      router.push(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* ─────── Left · Brand panel ─────── */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 bg-[rgb(var(--surface-2))] overflow-hidden">
        {/* Subtle grid texture (Rheem login background vibe) */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35] pointer-events-none rheem-grid-bg"
        />

        {/* Top: brand mark */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[rgb(var(--brand-500))] text-white text-lg font-extrabold">
            T
          </span>
          <span className="text-callout font-semibold text-ink-primary">
            Tandem · 牛马搭子
          </span>
        </div>

        {/* Middle: "hello." display + slogan */}
        <div className="relative z-10">
          <h1 className="rheem-display leading-[0.9]">
            <span className="block text-[clamp(72px,10vw,140px)] tracking-[-0.05em]">
              hello<span className="text-[rgb(var(--brand-500))]">.</span>
            </span>
          </h1>
          <p className="mt-8 text-title-3 text-ink-primary max-w-lg leading-snug">
            <span className="rheem-display-accent font-extrabold">召唤搭子</span> ·
            <span className="rheem-display-accent font-extrabold"> 拿捏</span>老板 ·
            <span className="rheem-display-accent font-extrabold"> 事半</span>功倍
            <span className="text-[rgb(var(--brand-500))]">.</span>
          </p>
          <p className="mt-3 text-body text-ink-secondary max-w-lg">
            17 分钟达成共识 · AI-Navigator 助力高效工作
          </p>

          {/* Core Spirit — 三段产品精神 */}
          <div className="mt-10 max-w-lg">
            <div className="flex items-center gap-3 mb-4">
              <span className="h-px flex-1 bg-ink-tertiary/30" />
              <span className="text-[10px] tracking-[0.25em] uppercase text-ink-tertiary font-medium">
                Our Spirit · 产品精神
              </span>
              <span className="h-px flex-1 bg-ink-tertiary/30" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { Icon: HandHeart, title: '创造价值', en: 'Create Value' },
                { Icon: ShieldCheck, title: '赢得尊重', en: 'Earn Respect' },
                { Icon: Smile, title: '快乐工作', en: 'Work Happily' },
              ].map(({ Icon, title, en }) => (
                <div
                  key={title}
                  className="group flex flex-col items-start gap-1.5 rounded-lg border border-ink-tertiary/20 bg-white/50 backdrop-blur-sm px-3 py-3 transition-colors hover:border-[rgb(var(--brand-500))]/40 hover:bg-white/70"
                >
                  <Icon className="h-4 w-4 text-[rgb(var(--brand-500))]" strokeWidth={1.75} />
                  <div className="text-callout font-semibold text-ink-primary leading-tight">
                    {title}
                  </div>
                  <div className="text-[10px] tracking-wide text-ink-tertiary uppercase">
                    {en}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: legal */}
        <div className="relative z-10 text-footnote text-ink-tertiary">
          © Tandem · 自研身份系统 · 你的数据永远在你这里
        </div>
      </aside>

      {/* ─────── Right · Auth form ─────── */}
      <section className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          {stage === 'creds' ? (
            <form onSubmit={submitCreds} className="space-y-5">
              <header className="text-center mb-2">
                {/* Mobile-only inline brand */}
                <div className="lg:hidden mb-6 flex items-center justify-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[rgb(var(--brand-500))] text-white text-base font-extrabold">
                    T
                  </span>
                  <span className="text-callout font-semibold text-ink-primary">
                    Tandem
                  </span>
                </div>
                <h2 className="rheem-display text-title-1 leading-none">
                  欢迎回来<span className="text-[rgb(var(--brand-500))]">.</span>
                </h2>
                <p className="mt-2 text-caption text-ink-tertiary">
                  登录你的 Tandem 账号
                </p>
              </header>

              <PillInput
                id="email"
                type="email"
                required
                value={email}
                onChange={(v) => setEmail(v)}
                placeholder="邮箱 / 用户名"
                autoComplete="username"
              />

              <PillInput
                id="password"
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={(v) => setPassword(v)}
                placeholder="密码"
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-ink-tertiary hover:text-ink-secondary"
                    aria-label={showPwd ? '隐藏密码' : '显示密码'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <div className="flex items-center justify-between text-caption">
                <label className="flex items-center gap-2 cursor-pointer text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-[rgb(var(--brand-500))]"
                  />
                  记住我
                </label>
                <Link
                  href="#"
                  className="text-[rgb(var(--brand-600))] hover:text-[rgb(var(--brand-700))] font-medium"
                >
                  忘记密码？
                </Link>
              </div>

              {error && (
                <p className="rounded-md bg-[rgb(var(--brand-50))] px-3 py-2 text-caption text-[rgb(var(--brand-700))]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="rheem-btn-pill w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? '登录中…' : '登录'}
              </button>

              <p className="text-center text-caption text-ink-tertiary pt-2">
                还没有账号？{' '}
                <Link
                  href="/register"
                  className="text-[rgb(var(--brand-600))] hover:text-[rgb(var(--brand-700))] font-medium"
                >
                  使用邀请码注册
                </Link>
              </p>
              <p className="text-center text-footnote text-ink-tertiary -mt-3">
                <Link href="/register/employee" className="hover:text-ink-secondary">
                  公司邮箱直接注册
                </Link>
                {' · '}
                <Link href="/register/apply" className="hover:text-ink-secondary">
                  外部协作 申请加入
                </Link>
              </p>

              <SsoFooter />
            </form>
          ) : (
            <form onSubmit={submitMfa} className="space-y-5">
              <header className="text-center mb-2">
                <h2 className="rheem-display text-title-1 leading-none">
                  再确认一下<span className="text-[rgb(var(--brand-500))]">.</span>
                </h2>
                <p className="mt-2 text-caption text-ink-tertiary inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-[rgb(var(--brand-600))]" />
                  你的账号启用了 MFA, 请输入验证器中的 6 位代码
                </p>
              </header>

              <PillInput
                id="totp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={totpCode}
                onChange={(v) => setTotpCode(v.replace(/\D/g, ''))}
                placeholder="000000"
                className="text-center tracking-[0.5em] text-lg font-semibold"
              />

              <details className="text-caption">
                <summary className="cursor-pointer text-ink-tertiary hover:text-ink-secondary">
                  使用恢复码登录
                </summary>
                <div className="mt-2">
                  <PillInput
                    id="recovery"
                    type="text"
                    value={recoveryCode}
                    onChange={(v) => setRecoveryCode(v.toUpperCase())}
                    placeholder="XXXXX-XXXXX"
                    leading={<KeyRound className="h-4 w-4 text-ink-tertiary" />}
                  />
                </div>
              </details>

              {error && (
                <p className="rounded-md bg-[rgb(var(--brand-50))] px-3 py-2 text-caption text-[rgb(var(--brand-700))]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="rheem-btn-pill w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? '验证中…' : '验证 MFA'}
              </button>

              <p className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setStage('creds');
                    setTotpCode('');
                    setRecoveryCode('');
                    setError('');
                  }}
                  className="text-caption text-ink-tertiary hover:text-ink-secondary"
                >
                  ← 返回登录
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

/* ─────── components ─────── */

function PillInput({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  inputMode,
  pattern,
  maxLength,
  leading,
  trailing,
  className,
}: {
  id?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?:
    | 'on'
    | 'off'
    | 'username'
    | 'current-password'
    | 'new-password'
    | 'email'
    | 'one-time-code';
  inputMode?: 'numeric' | 'text' | 'email';
  pattern?: string;
  maxLength?: number;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
}) {
  // Build the input with one of a fixed, literal set of autoComplete tokens so
  // static analysers (axe / webhint) can verify validity. Falls through to no
  // attribute when the token is unknown / undefined.
  const inputClass =
    'flex-1 bg-transparent outline-none text-body text-ink-primary placeholder:text-ink-tertiary ' +
    (className ?? '');
  const commonProps = {
    id,
    type,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    placeholder,
    required,
    inputMode,
    pattern,
    maxLength,
    className: inputClass,
  };
  let inputEl: React.ReactElement;
  switch (autoComplete) {
    case 'username':
      inputEl = <input {...commonProps} autoComplete="username" />;
      break;
    case 'current-password':
      inputEl = <input {...commonProps} autoComplete="current-password" />;
      break;
    case 'new-password':
      inputEl = <input {...commonProps} autoComplete="new-password" />;
      break;
    case 'email':
      inputEl = <input {...commonProps} autoComplete="email" />;
      break;
    case 'one-time-code':
      inputEl = <input {...commonProps} autoComplete="one-time-code" />;
      break;
    case 'on':
      inputEl = <input {...commonProps} autoComplete="on" />;
      break;
    case 'off':
      inputEl = <input {...commonProps} autoComplete="off" />;
      break;
    default:
      inputEl = <input {...commonProps} />;
  }
  return (
    <div className="group flex items-center gap-2 rounded-full border border-border bg-[rgb(var(--surface-1))] px-4 py-2.5 focus-within:border-[rgb(var(--brand-500))] focus-within:ring-2 focus-within:ring-[rgb(var(--brand-500)/.15)] transition-all">
      {leading}
      {inputEl}
      {trailing}
    </div>
  );
}

function SsoFooter() {
  return (
    <div className="pt-2">
      <div className="my-3 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-footnote text-ink-tertiary">或使用第三方 SSO</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex justify-center gap-2">
        <SsoButton label="钉钉" disabled />
        <SsoButton label="企微" disabled />
        <SsoButton label="飞书" disabled />
      </div>
      <p className="mt-3 text-center text-[10px] text-ink-tertiary">
        * SSO 仅作为可选辅助登录方式. Tandem 默认使用自研账号系统, 不依赖任何外部平台.
      </p>
    </div>
  );
}

function SsoButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="rounded-full border border-border px-3.5 py-1.5 text-caption text-ink-secondary hover:bg-surface-2 hover:text-ink-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title={disabled ? '需在 .env 配置后启用' : undefined}
    >
      {label}
    </button>
  );
}
