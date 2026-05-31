'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, CreditCard, CheckCircle2 } from 'lucide-react';

export default function EmployeeSsoRegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/sso-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, employeeId: employeeId || undefined, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '注册失败');
        return;
      }
      setDone(true);
      setTimeout(() => router.push('/'), 1200);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50 dark:from-background dark:to-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">内部员工注册</CardTitle>
            <Badge variant="secondary" className="text-[10px]">企业专属通道</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            使用公司邮箱（如 @company.com）直接注册，无需邀请码。<br />
            注册成功后自动获得员工权限，可使用牛马搭子 + 拿捏全套功能。
          </p>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-sm font-medium">注册成功，正在跳转...</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <Field label="企业邮箱">
                <Input
                  type="email"
                  placeholder="yourname@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="姓名">
                <Input
                  placeholder="你的真实姓名"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label={<span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> 工号（可选）</span>}>
                <Input
                  placeholder="如 EMP001"
                  value={employeeId}
                  onChange={e => setEmployeeId(e.target.value)}
                />
              </Field>
              <Field label="密码">
                <Input
                  type="password"
                  placeholder="8 位以上，含大小写与数字"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </Field>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? '注册中...' : '立即注册'}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                注册即表示同意《隐私政策》。
                <a href="/login" className="text-primary hover:underline ml-1">已有账号？登录</a>
              </p>
              <p className="text-[11px] text-center text-muted-foreground">
                合作伙伴？
                <a href="/partner/join" className="text-brand-600 hover:underline ml-1">使用邀请码注册 →</a>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
