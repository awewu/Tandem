'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Ticket, Building2, Sparkles, Bot, MessageSquare, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Mode = 'choose' | 'invite' | 'apply' | 'done';

const PARTNER_FEATURES = [
  { icon: Bot, label: '智能体广场', desc: '调用公司预置的专业 AI Agent' },
  { icon: MessageSquare, label: 'AI 对话', desc: '直接与大模型对话，支持 Team Token' },
  { icon: Sparkles, label: 'AI 工具集', desc: '公司定制的行业垂直 AI 应用' },
];

export default function PartnerJoinPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 邀请码注册表单
  const [inviteCode, setInviteCode] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName] = useState('');
  const [invPassword, setInvPassword] = useState('');

  // 申请表单
  const [appName, setAppName] = useState('');
  const [appCompany, setAppCompany] = useState('');
  const [appEmail, setAppEmail] = useState('');
  const [appReason, setAppReason] = useState('');

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: invEmail,
          password: invPassword,
          name: invName,
          inviteCode,
          privacyConsent: { version: '1.0', consentedAt: new Date().toISOString() },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? '注册失败'); return; }
      router.push('/chat');
    } finally {
      setBusy(false);
    }
  }

  async function submitApply(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/partner/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: appName, company: appCompany, email: appEmail, reason: appReason }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? '提交失败'); return; }
      setMode('done');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 via-white to-slate-50 dark:from-violet-950/20 dark:via-background dark:to-background px-4 py-12">

      {/* Logo / 标题区 */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 text-white mb-4 shadow-lg">
          <Bot className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">合作伙伴入口</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          调用公司智能体 · 体验企业 AI 工具集
        </p>
      </div>

      {/* 功能预览 */}
      {mode === 'choose' && (
        <div className="w-full max-w-md space-y-5">
          <div className="grid grid-cols-3 gap-3 mb-6">
            {PARTNER_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex flex-col items-center text-center p-3 rounded-xl border bg-card gap-1.5">
                <Icon className="w-5 h-5 text-violet-500" />
                <span className="text-xs font-medium">{label}</span>
                <span className="text-[10px] text-muted-foreground">{desc}</span>
              </div>
            ))}
          </div>

          <Card className="border-violet-200 dark:border-violet-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-violet-500" />
                已有邀请码
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-[10px]">推荐</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">由公司业务或运营团队发放，直接开通账号</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => setMode('invite')}>
                使用邀请码注册 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                申请开通
              </CardTitle>
              <p className="text-xs text-muted-foreground">提交合作申请，审核通过后获得邀请码</p>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full" onClick={() => setMode('apply')}>
                提交合作申请 <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            内部员工？
            <a href="/register/employee" className="text-violet-600 hover:underline ml-1">使用企业邮箱直接注册 →</a>
          </p>
        </div>
      )}

      {/* 邀请码注册表单 */}
      {mode === 'invite' && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <button onClick={() => setMode('choose')} className="text-xs text-muted-foreground hover:text-foreground mb-1">← 返回</button>
            <CardTitle className="text-base">使用邀请码注册</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitInvite} className="space-y-3">
              <Field label="邀请码">
                <Input placeholder="XXXX-XXXX-XXXX-XXXX" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required className="font-mono uppercase" />
              </Field>
              <Field label="姓名">
                <Input placeholder="你的姓名" value={invName} onChange={e => setInvName(e.target.value)} required />
              </Field>
              <Field label="邮箱">
                <Input type="email" placeholder="work@company.com" value={invEmail} onChange={e => setInvEmail(e.target.value)} required />
              </Field>
              <Field label="密码">
                <Input type="password" placeholder="8位以上，含数字与字母" value={invPassword} onChange={e => setInvPassword(e.target.value)} required />
              </Field>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full bg-violet-600 hover:bg-violet-700" disabled={busy}>
                {busy ? '注册中...' : '注册并进入'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                注册即同意《服务协议》，你将获得「合作伙伴」权限，可访问 AI 搭子功能。
              </p>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 申请表单 */}
      {mode === 'apply' && (
        <Card className="w-full max-w-md">
          <CardHeader>
            <button onClick={() => setMode('choose')} className="text-xs text-muted-foreground hover:text-foreground mb-1">← 返回</button>
            <CardTitle className="text-base">提交合作申请</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitApply} className="space-y-3">
              <Field label="姓名">
                <Input placeholder="你的姓名" value={appName} onChange={e => setAppName(e.target.value)} required />
              </Field>
              <Field label="公司 / 机构">
                <Input placeholder="所在公司名称" value={appCompany} onChange={e => setAppCompany(e.target.value)} required />
              </Field>
              <Field label="联系邮箱">
                <Input type="email" placeholder="work@company.com" value={appEmail} onChange={e => setAppEmail(e.target.value)} required />
              </Field>
              <Field label="合作说明">
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="简述合作意向或使用场景..."
                  value={appReason}
                  onChange={e => setAppReason(e.target.value)}
                  required
                />
              </Field>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? '提交中...' : '提交申请'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 申请完成 */}
      {mode === 'done' && (
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div>
              <h2 className="text-lg font-semibold">申请已提交</h2>
              <p className="text-sm text-muted-foreground mt-1">
                我们将在 1-3 个工作日内审核并发送邀请码到你的邮箱。
              </p>
            </div>
            <Button variant="outline" onClick={() => setMode('choose')}>返回首页</Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
