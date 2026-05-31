'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Lock, User, Ticket } from 'lucide-react';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}

function RegisterInner() {
  const router = useRouter();
  const search = useSearchParams();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [strength, setStrength] = useState(0);
  const [strengthHint, setStrengthHint] = useState<string[]>([]);
  const [consented, setConsented] = useState(false);

  // Privacy policy version (must match docs/PRIVACY-POLICY.md heading)
  const PRIVACY_POLICY_VERSION = 'v1.0';

  // 从 URL 提取邀请码
  useEffect(() => {
    const code = search.get('invite');
    if (code) setInviteCode(code);
  }, [search]);

  // 简易客户端密码强度提示
  useEffect(() => {
    let s = 0;
    const hints: string[] = [];
    if (password.length >= 10) s++;
    else hints.push('至少 10 字符');
    if (password.length >= 14) s++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s++;
    else hints.push('需要大小写字母');
    if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) s++;
    else hints.push('需要数字 + 特殊字符');
    setStrength(s);
    setStrengthHint(hints);
  }, [password]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          name,
          inviteCode,
          privacyConsent: {
            version: PRIVACY_POLICY_VERSION,
            consentedAt: new Date().toISOString(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '注册失败');
        return;
      }
      router.push(data.requiresMfa ? '/account/mfa/setup' : '/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>使用邀请码注册 Tandem</CardTitle>
          <p className="mt-1 text-caption text-muted-foreground">
            Tandem 默认关闭公开注册. 请向管理员索要邀请码.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Field label="邀请码" icon={<Ticket className="h-4 w-4" />}>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="flex-1 bg-transparent uppercase tracking-[0.2em] outline-none"
                placeholder="XXXX-XXXX-XXXX-XXXX"
              />
            </Field>
            <Field label="邮箱" icon={<Mail className="h-4 w-4" />}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                placeholder="you@company.com"
              />
            </Field>
            <Field label="姓名" icon={<User className="h-4 w-4" />}>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                placeholder="张三"
              />
            </Field>
            <Field label="密码" icon={<Lock className="h-4 w-4" />}>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 bg-transparent outline-none"
                placeholder="至少 10 字符, 含大小写+数字+符号"
              />
            </Field>

            {/* 强度条 */}
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded ${
                    i <= strength
                      ? strength >= 3
                        ? 'bg-emerald-500'
                        : strength === 2
                        ? 'bg-warning/50'
                        : 'bg-rose-400'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            {strengthHint.length > 0 && (
              <p className="text-footnote text-muted-foreground">
                提示: {strengthHint.join(' · ')}
              </p>
            )}

            {error && <p className="text-caption text-rose-600">{error}</p>}

            {/* PIPL/GDPR consent */}
            <label className="flex items-start gap-2 rounded border bg-slate-50 p-2.5 text-footnote leading-relaxed text-slate-700 cursor-pointer hover:bg-slate-100 transition">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-emerald-600"
                required
              />
              <span>
                我已阅读并同意{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 underline"
                >
                  《Tandem 隐私政策》 ({PRIVACY_POLICY_VERSION})
                </a>{' '}·
                了解我的数据如何被收集、存储与使用.
              </span>
            </label>

            <Button type="submit" disabled={busy || strength < 3 || !consented} className="w-full">
              {busy ? '注册中...' : '注册账号'}
            </Button>

            <p className="pt-2 text-center text-footnote text-muted-foreground">
              已有账号? {' '}
              <Link href="/login" className="text-warning underline">
                登录
              </Link>
            </p>

            <div className="rounded border bg-emerald-50 p-2 text-footnote text-emerald-800">
              💚 Tandem 私有化: 注册数据 100% 在你公司内, 离开网络也能用. 自研身份系统, 不依赖任何第三方.
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function Field({
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
      <p className="mb-1 text-footnote text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded border bg-white px-2 py-1.5">
        <span className="text-muted-foreground">{icon}</span>
        {children}
      </div>
    </div>
  );
}
