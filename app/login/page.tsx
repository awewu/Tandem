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

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, ShieldCheck, KeyRound, HandHeart, Smile, Phone, QrCode, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/hooks/use-current-user';

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
  const fetchMe = useAuthStore((s) => s.fetchMe);

  const [stage, setStage] = useState<'creds' | 'mfa'>('creds');
  const [method, setMethod] = useState<LoginMethod>('account');
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
    if (method !== 'account') return; // 手机/微信走各自面板, 不触发账户登录
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
      } else if (data.mfaEnrollmentRequired) {
        // P0-4 (LAUNCH-200): owner/admin/steward 未启用 MFA → 强跳启用页, 不放过业务路由
        router.push('/settings/security?enrollMfa=1&reason=privileged_role');
      } else {
        await fetchMe();
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
      await fetchMe();
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
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[rgb(var(--brand-500))] text-white text-headline font-extrabold">
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
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[rgb(var(--brand-500))] text-white text-body font-extrabold">
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

              {method === 'account' && (<>
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

              </>)}

              {method === 'phone' && <PhoneLoginPanel />}
              {method === 'wechat' && <WechatLoginPanel />}

              <div className="pt-2">
                <div className="my-3 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-footnote text-ink-tertiary">切换登录方式</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <LoginMethodTabs method={method} onChange={(m) => { setMethod(m); setError(''); }} />
              </div>
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
                className="text-center tracking-[0.5em] text-headline font-semibold"
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

type LoginMethod = 'account' | 'phone' | 'wechat';

function LoginMethodTabs({
  method,
  onChange,
}: {
  method: LoginMethod;
  onChange: (m: LoginMethod) => void;
}) {
  const tabs: { id: LoginMethod; label: string; Icon: typeof Phone }[] = [
    { id: 'account', label: '账号', Icon: UserRound },
    { id: 'phone', label: '电话号码', Icon: Phone },
    { id: 'wechat', label: '微信扫码', Icon: QrCode },
  ];
  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-[rgb(var(--surface-2))] p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-pressed={method === t.id}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-caption font-medium transition-colors',
            method === t.id
              ? 'bg-white text-ink-primary shadow-soft-xs'
              : 'text-ink-tertiary hover:text-ink-secondary',
          )}
        >
          <t.Icon className="h-3.5 w-3.5" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

function PhoneLoginPanel() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    if (busy || cooldown > 0) return;
    if (phone.length < 6) { setErr('请输入正确手机号'); return; }
    setErr(''); setNotice(''); setBusy(true);
    try {
      const res = await fetch('/api/auth/phone/send-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data.error ?? '发送失败'); return; }
      setCooldown(60);
      setNotice(data.devCode ? `验证码已发送 (dev: ${data.devCode})` : '验证码已发送');
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (busy) return;
    if (phone.length < 6 || code.length < 4) { setErr('请输入手机号和验证码'); return; }
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/auth/phone/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setErr(data.error ?? '登录失败'); return; }
      router.push(next);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <PillInput
        id="phone"
        type="tel"
        value={phone}
        onChange={(v) => setPhone(v.replace(/\D/g, ''))}
        placeholder="手机号"
        inputMode="numeric"
        maxLength={11}
        leading={<Phone className="h-4 w-4 text-ink-tertiary" />}
      />
      <div className="flex items-stretch gap-2">
        <div className="flex-1">
          <PillInput
            id="smscode"
            type="text"
            value={code}
            onChange={(v) => setCode(v.replace(/\D/g, ''))}
            placeholder="短信验证码"
            inputMode="numeric"
            maxLength={6}
          />
        </div>
        <button
          type="button"
          onClick={sendCode}
          disabled={busy || cooldown > 0}
          className="shrink-0 rounded-full border border-border px-4 text-caption text-ink-secondary hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed surface-interactive"
        >
          {cooldown > 0 ? `${cooldown}s` : '获取验证码'}
        </button>
      </div>
      {notice && <p className="text-center text-[10px] text-[rgb(var(--brand-600))]">{notice}</p>}
      {err && (
        <p className="rounded-md bg-[rgb(var(--brand-50))] px-3 py-2 text-caption text-[rgb(var(--brand-700))]">{err}</p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !phone || !code}
        className="rheem-btn-pill w-full disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {busy ? '处理中…' : '手机号登录'}
      </button>
      <p className="text-center text-[10px] text-ink-tertiary">
        * 未配置短信服务 (.env: SMS_PROVIDER) 时, 点「获取验证码」会提示待配置.
      </p>
    </div>
  );
}

function WechatLoginPanel() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') ?? '/';
  const [state, setState] = useState<'loading' | 'notconfigured' | 'ready' | 'error'>('loading');
  const [qrUrl, setQrUrl] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    void (async () => {
      try {
        const res = await fetch('/api/auth/wechat/qr');
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 501 || data.code === 'not_configured') { setState('notconfigured'); return; }
        if (!res.ok || !data.ok) { setState('error'); setHint(data.error ?? '加载失败'); return; }
        setQrUrl(data.qrUrl); setState('ready');
        timer = setInterval(async () => {
          const pr = await fetch(`/api/auth/wechat/poll?ticket=${encodeURIComponent(data.ticket)}`);
          const pd = await pr.json();
          if (pd.ok && pd.status === 'confirmed') { if (timer) clearInterval(timer); router.push(next); }
          if (pd.ok && pd.status === 'expired') { if (timer) clearInterval(timer); setState('error'); setHint('二维码已过期, 请刷新'); }
        }, 2000);
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [router, next]);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="flex h-44 w-44 items-center justify-center rounded-2xl border border-border bg-[rgb(var(--surface-2))]">
        {state === 'ready' && qrUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrUrl} alt="微信扫码登录" className="h-40 w-40 rounded-lg object-contain" />
        ) : (
          <QrCode className="h-16 w-16 text-ink-tertiary" strokeWidth={1.25} />
        )}
      </div>
      <p className="text-caption text-ink-secondary">
        {state === 'ready' ? '打开微信扫一扫登录' : state === 'loading' ? '加载中…' : '微信扫码登录'}
      </p>
      {state === 'notconfigured' && (
        <p className="max-w-xs text-center text-[10px] text-ink-tertiary">
          * 微信扫码登录需配置微信开放平台 (.env: WECHAT_APP_ID / WECHAT_APP_SECRET) 后启用.
        </p>
      )}
      {state === 'error' && <p className="text-[10px] text-[rgb(var(--brand-600))]">{hint}</p>}
    </div>
  );
}
