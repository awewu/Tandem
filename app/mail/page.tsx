'use client';

/**
 * /mail · 邮箱模块
 *
 * V1 范围:
 *   - 收件箱 placeholder (IMAP 收件 V2 计划中)
 *   - 写邮件 composer  (走现有 /api/mail/send → SMTP 出站)
 *   - 邮箱状态 (configured / from / host:port)
 *
 * 两个 PageTabs:  收件箱 / 写邮件
 * 设置入口      :  右上角 → /settings/email
 */

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Inbox,
  Send,
  Settings,
  Mail,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import PageTabs from '@/components/page-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useHandoffPrefill } from '@/hooks/useHandoffPrefill';

interface MailStatus {
  configured: boolean;
  outbound: { host: string | null; port: number | null; fromAddress: string | null };
  inbound: { configured: boolean; note?: string };
}

export default function MailPage() {
  return (
    <Suspense fallback={null}>
      <MailInner />
    </Suspense>
  );
}

function MailInner() {
  const params = useSearchParams();
  const initialTab = params.get('tab') === 'compose' ? 'compose' : 'inbox';
  const [tab, setTab] = useState<'inbox' | 'compose'>(initialTab);
  const [status, setStatus] = useState<MailStatus | null>(null);
  /** Tandem 转交草稿: 仅在收到 handoff 时有值, 一次性预填给 ComposeView */
  const [handoffDraft, setHandoffDraft] = useState<{ subject: string; body: string } | null>(null);

  useEffect(() => {
    fetch('/api/mail/status', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useHandoffPrefill('mail', (p) => {
    setHandoffDraft({ subject: p.title, body: p.body });
    setTab('compose');
  });

  return (
    <div className="h-full flex flex-col md:px-8">
      {/* Header */}
      <header className="px-6 pt-6 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
              <Mail className="h-6 w-6 text-[rgb(var(--brand-600))]" />
              邮箱
            </h1>
            <p className="mt-1 text-caption text-ink-tertiary">
              对外沟通的正式通道 · 出站走 SMTP, 收件 V2 接入 IMAP
            </p>
          </div>
          <Link
            href="/settings/email"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-caption font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-2 surface-interactive"
          >
            <Settings className="h-3.5 w-3.5" />
            邮箱设置
          </Link>
        </div>

        {/* Status pill */}
        <div className="mt-3">
          {status === null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-footnote text-ink-tertiary">
              加载中...
            </span>
          ) : status.configured ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-footnote font-medium text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              SMTP 已就绪 · {status.outbound.fromAddress}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/5 px-3 py-1 text-footnote font-medium text-warning">
              <AlertCircle className="h-3.5 w-3.5" />
              SMTP 未配置 · 仅可写草稿, 不能发送
            </span>
          )}
        </div>
      </header>

      <PageTabs
        active={tab}
        onChange={(id) => setTab(id as 'inbox' | 'compose')}
        tabs={[
          { id: 'inbox', label: '收件箱', icon: Inbox },
          { id: 'compose', label: '写邮件', icon: Send },
        ]}
        className="px-6"
      />

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'inbox' ? <InboxView /> : <ComposeView canSend={status?.configured ?? false} initialDraft={handoffDraft} />}
      </div>
    </div>
  );
}

/* ─────────── Inbox (V1 placeholder) ─────────── */

function InboxView() {
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-8 text-center space-y-3">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-600))]">
          <Inbox className="h-6 w-6" />
        </div>
        <h2 className="text-headline text-ink-primary">收件箱 V2 计划中</h2>
        <p className="text-caption text-ink-secondary max-w-md mx-auto">
          通用 IMAP 收件 (Gmail / Outlook / 自建邮箱) 即将上线.
          届时支持: 邮件作为 ORIGIN 入档 · @ 触发分身回信草稿 · 议事室一键开会复盘.
        </p>
        <p className="text-footnote text-ink-tertiary">
          紧急沟通推荐使用 <Link href="/im" className="text-[rgb(var(--brand-600))] hover:underline">IM 议事室</Link>,
          17 分钟达成共识.
        </p>
      </CardContent>
    </Card>
  );
}

/* ─────────── Compose (V1 real SMTP send) ─────────── */

function ComposeView({ canSend, initialDraft }: { canSend: boolean; initialDraft?: { subject: string; body: string } | null }) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(initialDraft?.subject ?? '');
  const [body, setBody] = useState(initialDraft?.body ?? '');
  const [cc, setCc] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Tandem 转交后, 父组件可能在挂载后才填入 initialDraft (异步 sessionStorage 消费)
  // → 监听 initialDraft 变化, 仅在 subject/body 为空时回填, 避免覆盖用户已输入内容
  useEffect(() => {
    if (!initialDraft) return;
    setSubject((cur) => (cur ? cur : initialDraft.subject));
    setBody((cur) => (cur ? cur : initialDraft.body));
    setFeedback({ ok: true, msg: '已从 Tandem 工作台预填草稿, 补完收件人后即可发送.' });
  }, [initialDraft]);

  async function handleSend() {
    if (!canSend) {
      setFeedback({ ok: false, msg: 'SMTP 未配置, 无法发送. 联系管理员.' });
      return;
    }
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setFeedback({ ok: false, msg: '收件人 / 主题 / 正文均不可为空' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/mail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: to.split(/[,;\s]+/).filter(Boolean),
          cc: cc.trim() ? cc.split(/[,;\s]+/).filter(Boolean) : undefined,
          subject,
          text: body,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setFeedback({ ok: false, msg: json.error ?? `发送失败 (${res.status})` });
      } else {
        setFeedback({ ok: true, msg: `已发送 · messageId: ${json.messageId ?? '(unknown)'}` });
        setTo('');
        setSubject('');
        setBody('');
        setCc('');
      }
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="space-y-3 rounded-lg border border-border bg-[rgb(var(--surface-1))] p-5 shadow-soft-sm">
        <Field label="收件人" hint="支持多个, 用逗号或空格分隔">
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="alice@example.com, bob@example.com"
            autoComplete="off"
          />
        </Field>
        <Field label="抄送 (Cc)" hint="可选">
          <Input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            placeholder="(留空则无)"
            autoComplete="off"
          />
        </Field>
        <Field label="主题">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="一句话说清意图"
            autoComplete="off"
          />
        </Field>
        <Field label="正文" hint="纯文本, V2 接入富文本编辑器">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="写下你想说的..."
            className="w-full min-h-[200px] rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-500))/.25] focus:border-[rgb(var(--brand-500))] resize-y"
          />
        </Field>
      </div>

      {feedback && (
        <div
          className={
            feedback.ok
              ? 'rounded-md bg-emerald-50 px-3 py-2 text-caption text-emerald-700 flex items-start gap-2'
              : 'rounded-md bg-rose-50 px-3 py-2 text-caption text-rose-700 flex items-start gap-2'
          }
        >
          {feedback.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-footnote text-ink-tertiary inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI 起草草稿即将上线 — 现阶段需手写
        </p>
        <Button onClick={handleSend} disabled={busy || !canSend} className="rheem-btn-pill">
          <Send className="h-4 w-4 mr-1.5" />
          {busy ? '发送中...' : canSend ? '立即发送' : 'SMTP 未配置'}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-caption font-medium text-ink-primary">{label}</span>
        {hint && <span className="text-footnote text-ink-tertiary">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
