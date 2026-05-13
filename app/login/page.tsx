'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Mail, ShieldCheck, KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const search = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const next = search.get('next') ?? '/';

  const [stage, setStage] = useState<'creds' | 'mfa'>('creds');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            登录 Tandem
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            自研身份系统 · 私有化部署 · 你的数据永远在你这里
          </p>
        </CardHeader>
        <CardContent>
          {stage === 'creds' ? (
            <form onSubmit={submitCreds} className="space-y-3">
              <FormField label="邮箱" icon={<Mail className="h-4 w-4" />}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent outline-none"
                  placeholder="you@company.com"
                />
              </FormField>
              <FormField label="密码" icon={<Lock className="h-4 w-4" />}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent outline-none"
                  placeholder="••••••••••"
                />
              </FormField>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? '登录中...' : '登录'}
              </Button>

              <p className="pt-2 text-center text-xs text-muted-foreground">
                还没有账号? {' '}
                <Link href="/register" className="text-amber-700 underline">
                  使用邀请码注册
                </Link>
              </p>

              <SsoFooter />
            </form>
          ) : (
            <form onSubmit={submitMfa} className="space-y-3">
              <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">
                <ShieldCheck className="mr-1 inline h-4 w-4" />
                你的账号启用了 MFA, 请输入验证器中的 6 位代码
              </p>

              <FormField label="6 位 TOTP 代码" icon={<KeyRound className="h-4 w-4" />}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 bg-transparent text-lg tracking-[0.4em] outline-none"
                  placeholder="000000"
                />
              </FormField>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  使用恢复码登录
                </summary>
                <FormField label="恢复码" icon={<KeyRound className="h-4 w-4" />}>
                  <input
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-transparent outline-none"
                    placeholder="XXXXX-XXXXX"
                  />
                </FormField>
              </details>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <Button type="submit" disabled={busy} className="w-full">
                {busy ? '验证中...' : '验证 MFA'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function FormField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded border bg-white px-2 py-1.5">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}

function SsoFooter() {
  return (
    <div className="pt-3 text-center text-xs text-muted-foreground">
      <div className="my-2 flex items-center gap-2">
        <div className="h-px flex-1 bg-slate-200" />
        <span>或使用第三方 SSO (可选)</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="flex justify-center gap-2">
        <SsoButton label="钉钉" provider="dingtalk" />
        <SsoButton label="企微" provider="wecom" />
        <SsoButton label="飞书" provider="feishu" />
      </div>
      <p className="mt-2 text-[10px]">
        * SSO 仅作为可选辅助登录方式. Tandem 默认使用自研账号系统, 不依赖任何外部平台.
      </p>
    </div>
  );
}

function SsoButton({ label, provider }: { label: string; provider: string }) {
  return (
    <a
      href={`/api/auth/sso/${provider}`}
      className="rounded border px-3 py-1 text-xs hover:bg-slate-50 inline-block"
    >
      {label}
    </a>
  );
}
