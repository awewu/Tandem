'use client';

/**
 * 外部协作者注册申请页 (公开)
 *
 * 流程: 填写邮箱/姓名/组织/理由 → 提交 → 等待 Owner/Admin 审批 →
 *        审批通过后通过邮件 (或带外通道) 收到邀请码 → 用 /register?invite=XXX 完成注册
 *
 * 与 /register/employee 的区别: 这条路径**没有域名白名单要求**, 任何人都可申请,
 * 但需人工审批. 适合客户/承包商/合作伙伴接入「拿捏」「搭子」板块, 不进「事半」.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mail, User, Building, MessageSquareQuote, CheckCircle2, ShieldCheck } from 'lucide-react';

const REASON_MIN = 20;
const REASON_MAX = 1000;

export default function ApplyToJoinPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [reason, setReason] = useState('');
  const [scopeNaba, setScopeNaba] = useState(true);
  const [scopeDazi, setScopeDazi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reasonLen = reason.trim().length;
  const reasonOk = reasonLen >= REASON_MIN && reasonLen <= REASON_MAX;
  const formValid = email.includes('@') && name.trim().length >= 2 && reasonOk;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid || busy) return;
    setError('');
    setBusy(true);
    try {
      const requestedScopes: ('naba' | 'dazi')[] = [];
      if (scopeNaba) requestedScopes.push('naba');
      if (scopeDazi) requestedScopes.push('dazi');
      const res = await fetch('/api/auth/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          organization: organization.trim() || undefined,
          reason: reason.trim(),
          requestedScopes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? '提交失败');
        return;
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center surface-1 px-4 py-10 md:py-16">
      <Card className="w-full max-w-md md:max-w-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <CardTitle className="text-headline">外部协作申请</CardTitle>
            <Badge variant="secondary" className="text-footnote">需 Owner 审批</Badge>
          </div>
          <p className="text-caption text-secondary leading-relaxed">
            适合客户 / 合作伙伴 / 承包商等外部人员申请协作通道。
            <br />
            通过后默认获得「拿捏 (个人 AI)」+「搭子 (IM/文档/日历)」访问权限,
            <strong className="text-primary"> 不含「事半」OKR 板块</strong>。
            <br />
            如果你是公司内部员工, 请使用{' '}
            <Link href="/register/employee" className="text-brand-600 hover:underline">
              企业邮箱直接注册 →
            </Link>
          </p>
        </CardHeader>

        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-success" />
              <h3 className="font-medium">申请已提交</h3>
              <p className="text-caption text-secondary max-w-sm">
                我们已通知 Owner 审批。审批通过后, 你会收到一封带 <strong>单次邀请码</strong> 的邮件,
                凭该邀请码在 <code>/register</code> 完成注册。
              </p>
              <p className="text-footnote text-secondary">通常处理时长: 1 个工作日内</p>
              <Button variant="outline" onClick={() => router.push('/login')} className="mt-2">
                返回登录页
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-footnote font-medium text-secondary flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5" /> 邮箱 <span className="text-danger">*</span>
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@partner-company.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="text-footnote font-medium text-secondary flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5" /> 姓名 <span className="text-danger">*</span>
                </label>
                <Input
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="真实姓名"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-footnote font-medium text-secondary flex items-center gap-1.5 mb-1">
                  <Building className="w-3.5 h-3.5" /> 所在组织
                </label>
                <Input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="所在公司 / 团队 (选填)"
                  autoComplete="organization"
                />
              </div>

              <div>
                <label className="text-footnote font-medium text-secondary flex items-center gap-1.5 mb-1">
                  <MessageSquareQuote className="w-3.5 h-3.5" /> 申请理由 <span className="text-danger">*</span>
                  <span className={`ml-auto text-footnote ${reasonOk ? 'text-success' : 'text-secondary'}`}>
                    {reasonLen} / {REASON_MIN}-{REASON_MAX}
                  </span>
                </label>
                <Textarea
                  required
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`请说明: 你是谁, 因何项目接入, 预期使用哪些功能。\n至少 ${REASON_MIN} 字, 帮助我们快速审批。`}
                />
              </div>

              <div>
                <label className="text-footnote font-medium text-secondary mb-1 block">
                  希望访问的板块
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-caption cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopeNaba}
                      onChange={(e) => setScopeNaba(e.target.checked)}
                      className="rounded"
                    />
                    <span>拿捏 · 个人 AI / Persona / Agent</span>
                  </label>
                  <label className="flex items-center gap-2 text-caption cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopeDazi}
                      onChange={(e) => setScopeDazi(e.target.checked)}
                      className="rounded"
                    />
                    <span>搭子 · IM / 文档 / 日历 / 学院</span>
                  </label>
                  <label className="flex items-center gap-2 text-footnote text-secondary cursor-not-allowed">
                    <input type="checkbox" disabled className="rounded" />
                    <span>事半 · OKR / 绩效 (外部协作者不开放)</span>
                  </label>
                </div>
              </div>

              {error && (
                <div className="text-caption text-danger bg-danger/5 px-3 py-2 rounded-lg">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={!formValid || busy} className="w-full">
                {busy ? '提交中…' : '提交申请'}
              </Button>

              <p className="text-center text-footnote text-secondary">
                已经是 Tandem 用户?{' '}
                <Link href="/login" className="text-brand-600 hover:underline">
                  直接登录 →
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
