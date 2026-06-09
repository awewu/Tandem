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
  Bot,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import PageTabs from '@/components/page-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useHandoffPrefill } from '@/hooks/useHandoffPrefill';
import { useCalendarStore } from '@/lib/store/calendar';
import { useContactStore } from '@/lib/store/contacts';
import { CalendarPlus, UserCircle } from 'lucide-react';

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

/* ─────────── Inbox · AI 邮件归档 (真闭环: digest + 入库 + 自动签批) ─────────── */

interface IngestActionItem { task: string; deadline?: string; owner?: string }
interface IngestSuggestedEvent {
  title: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  isAllDay?: boolean;
  type: 'meeting' | 'deadline' | 'reminder';
  location?: string;
  description?: string;
}
interface IngestDigest {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'critical';
  keywords: string[];
  actionItems: IngestActionItem[];
  category: 'sop' | 'case' | 'lesson' | 'agreement' | 'operational';
  securityRiskDetected: boolean;
  riskDetails?: string;
  suggestedEvents?: IngestSuggestedEvent[];
}
interface IngestResult { digest: IngestDigest; originId: string; promotionId?: string }

const SENTIMENT_META: Record<string, { label: string; className: string }> = {
  positive: { label: '正面', className: 'bg-emerald-50 text-emerald-700' },
  neutral: { label: '中性', className: 'bg-surface-2 text-ink-secondary' },
  negative: { label: '负面', className: 'bg-warning/10 text-warning' },
  critical: { label: '严重', className: 'bg-danger/10 text-danger' },
};
const CATEGORY_LABEL: Record<string, string> = {
  sop: '流程规范', case: '历史案例', lesson: '教训反思', agreement: '协议共识', operational: '日常事务',
};

function InboxView() {
  const [from, setFrom] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const { addEvent, events } = useCalendarStore();

  // 邮件链摘要
  const [threadText, setThreadText] = useState('');
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadResult, setThreadResult] = useState<{
    timeline: Array<{ date: string; who: string; what: string }>;
    keyDecisions: string[];
    outstandingQuestions: string[];
    nextActions: string[];
  } | null>(null);

  async function handleThreadSummary() {
    if (!threadText.trim()) return;
    setThreadLoading(true);
    try {
      const emails = threadText.split(/\n-{3,}\n/).map((block) => {
        const lines = block.trim().split('\n');
        const subjectLine = lines.find((l) => l.toLowerCase().includes('subject:')) || '';
        const fromLine = lines.find((l) => l.toLowerCase().includes('from:')) || '';
        return {
          subject: subjectLine.replace(/subject:/i, '').trim() || '无主题',
          from: fromLine.replace(/from:/i, '').trim() || '未知',
          date: new Date().toISOString(),
          text: block.slice(0, 2000),
        };
      }).filter((e) => e.text.length > 20);

      const res = await fetch('/api/mail/thread-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ emails: emails.length > 0 ? emails : [{ subject: '邮件链', from: 'sender', date: new Date().toISOString(), text: threadText.slice(0, 2000) }] }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.summary) setThreadResult(json.summary);
    } catch { /* 静默失败 */ }
    finally { setThreadLoading(false); }
  }

  async function analyze() {
    if (!subject.trim() || !text.trim()) {
      setError('主题与正文均不可为空');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/mail/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ from, subject, text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error ?? `分析失败 (${res.status})`);
      } else {
        setResult({ digest: json.digest, originId: json.originId, promotionId: json.promotionId });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[rgb(var(--brand-600))]" />
            <h2 className="text-headline text-ink-primary">AI 邮件归档</h2>
          </div>
          <p className="text-caption text-ink-secondary">
            粘贴一封邮件, AI 自动摘要 / 情感与风险扫描 / 抽取 Action Items, 并写入企业 Origins 层;
            识别为高价值 (流程/案例/教训/共识) 时自动发起三级签批沉淀为中央 Memory.
            IMAP 自动收件为 V2, 当前为手动 / Webhook 入口.
          </p>
          <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="发件人 (可选, 默认你自己)" autoComplete="off" />
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="邮件主题" autoComplete="off" />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="粘贴邮件正文..."
            className="w-full min-h-[180px] rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-500))/.25] focus:border-[rgb(var(--brand-500))] resize-y"
          />
          {error && (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-caption text-rose-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={analyze} disabled={busy} className="rheem-btn-pill">
              <Sparkles className="h-4 w-4 mr-1.5" />
              {busy ? 'AI 分析中...' : 'AI 分析并归档'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-headline text-ink-primary flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                已归档
              </h3>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-footnote font-medium ${SENTIMENT_META[result.digest.sentiment]?.className ?? ''}`}>
                  {SENTIMENT_META[result.digest.sentiment]?.label ?? result.digest.sentiment}
                </span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-footnote text-ink-secondary">
                  {CATEGORY_LABEL[result.digest.category] ?? result.digest.category}
                </span>
              </div>
            </div>

            <div>
              <div className="text-footnote font-medium text-ink-tertiary mb-1">摘要</div>
              <p className="text-caption text-ink-primary whitespace-pre-wrap">{result.digest.summary}</p>
            </div>

            {result.digest.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {result.digest.keywords.map((k) => (
                  <span key={k} className="rounded-full bg-surface-2 px-2 py-0.5 text-footnote text-ink-secondary">{k}</span>
                ))}
              </div>
            )}

            {result.digest.actionItems.length > 0 && (
              <div>
                <div className="text-footnote font-medium text-ink-tertiary mb-1">提取的 Action Items</div>
                <ul className="space-y-1">
                  {result.digest.actionItems.map((a, i) => (
                    <li key={i} className="rounded border border-border p-2 text-caption text-ink-primary">
                      {a.task}
                      {(a.owner || a.deadline) && (
                        <span className="ml-2 text-footnote text-ink-tertiary">
                          {a.owner ? `负责人: ${a.owner}` : ''}{a.owner && a.deadline ? ' · ' : ''}{a.deadline ? `截止: ${a.deadline}` : ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* AI 建议的日历事件 (邮件 → 日程打通) */}
            {result.digest.suggestedEvents && result.digest.suggestedEvents.length > 0 && (
              <div>
                <div className="text-footnote font-medium text-ink-tertiary mb-1 flex items-center gap-1">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  AI 提取的日程建议
                </div>
                <ul className="space-y-1">
                  {result.digest.suggestedEvents.map((sev, i) => {
                    const startMs = sev.startDate
                      ? new Date(sev.startTime ? `${sev.startDate}T${sev.startTime}` : sev.startDate).getTime()
                      : Date.now();
                    const endMs = sev.endDate
                      ? new Date(sev.endTime ? `${sev.endDate}T${sev.endTime}` : sev.endDate).getTime()
                      : startMs + 60 * 60 * 1000;
                    return (
                      <li key={i} className="rounded border border-border p-2 flex items-center justify-between gap-2">
                        <div className="text-caption text-ink-primary min-w-0">
                          <span className="font-medium">{sev.title}</span>
                          <span className="text-footnote text-ink-tertiary ml-2">
                            {sev.startDate}{sev.startTime ? ` ${sev.startTime}` : ''}
                            {sev.type === 'deadline' ? ' · 截止' : sev.type === 'meeting' ? ' · 会议' : ' · 提醒'}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-[rgb(var(--brand-600))]"
                          onClick={() => {
                            addEvent({
                              calendarId: 'cal-personal',
                              title: sev.title,
                              startTime: startMs,
                              endTime: endMs,
                              isAllDay: sev.isAllDay || false,
                              type: sev.type === 'meeting' ? 'meeting' : sev.type === 'deadline' ? 'task' : 'reminder',
                              location: sev.location,
                              description: sev.description,
                              createdBy: 'me',
                              status: 'confirmed',
                              reminders: sev.type === 'meeting' ? [{ minutesBefore: 15 }] : [{ minutesBefore: 60 }],
                            });
                          }}
                        >
                          <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                          加入日程
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {result.digest.securityRiskDetected && (
              <div className="rounded-md bg-danger/5 px-3 py-2 text-caption text-danger flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>检测到风险: {result.digest.riskDetails ?? '(无细节)'} — 已写入审计</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1 text-footnote text-ink-tertiary">
              <span>Origins 物料: {result.originId}</span>
              {result.promotionId && (
                <Link href={`/memories?promotionId=${result.promotionId}`} className="text-[rgb(var(--brand-600))] hover:underline">
                  已发起签批 → 查看
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 邮件链智能摘要 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-caption font-medium text-ink-secondary">邮件链智能摘要</h3>
          <span className="text-[10px] text-ink-tertiary">粘贴多封邮件，用 --- 分隔</span>
        </div>
        <textarea
          value={threadText}
          onChange={(e) => setThreadText(e.target.value)}
          placeholder="粘贴多封邮件内容，用 --- 分隔各封..."
          className="w-full min-h-[100px] rounded-md border border-border bg-[rgb(var(--surface-1))] px-3 py-2 text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-500))/.25] resize-y"
        />
        <Button variant="outline" size="sm" className="gap-1 text-caption" onClick={handleThreadSummary} disabled={threadLoading || !threadText.trim()}>
          <RefreshCw className="h-3.5 w-3.5" />
          {threadLoading ? 'AI 分析中...' : '生成摘要'}
        </Button>

        {threadResult && (
          <Card className="border-border">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium text-ink-primary">邮件链时间线</span>
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setThreadResult(null)}>关闭</Button>
              </div>
              <ul className="space-y-1">
                {threadResult.timeline.map((t, i) => (
                  <li key={i} className="text-caption text-ink-secondary flex gap-2">
                    <span className="text-ink-tertiary shrink-0">{t.date}</span>
                    <span className="font-medium shrink-0">{t.who}</span>
                    <span>{t.what}</span>
                  </li>
                ))}
              </ul>
              {threadResult.keyDecisions.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-ink-tertiary uppercase mb-0.5">关键决策</div>
                  <ul className="list-disc list-inside text-caption text-ink-secondary">
                    {threadResult.keyDecisions.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {threadResult.nextActions.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium text-ink-tertiary uppercase mb-0.5">下一步行动</div>
                  <ul className="list-disc list-inside text-caption text-ink-secondary">
                    {threadResult.nextActions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <p className="text-footnote text-ink-tertiary">
        通用 IMAP 收件 (Gmail / Outlook / 自建邮箱) 为 V2. 紧急沟通推荐 <Link href="/im" className="text-[rgb(var(--brand-600))] hover:underline">IM 议事室</Link>.
      </p>
    </div>
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

  // 外部联系人档案
  const { getContactByEmail, upsertContact } = useContactStore();
  const firstEmail = to.split(/[,;\s]+/).filter(Boolean)[0];
  const contact = firstEmail ? getContactByEmail(firstEmail) : undefined;

  // AI 回复
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiReplyDraft, setAiReplyDraft] = useState<string | null>(null);

  // AI 审校
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ score: number; summary: string; issues: Array<{ severity: string; category: string; message: string; suggestion: string }>; isSafe: boolean } | null>(null);

  // Tandem 转交后, 父组件可能在挂载后才填入 initialDraft (异步 sessionStorage 消费)
  // → 监听 initialDraft 变化, 仅在 subject/body 为空时回填, 避免覆盖用户已输入内容
  useEffect(() => {
    if (!initialDraft) return;
    setSubject((cur) => (cur ? cur : initialDraft.subject));
    setBody((cur) => (cur ? cur : initialDraft.body));
    setFeedback({ ok: true, msg: '已从 Tandem 工作台预填草稿, 补完收件人后即可发送.' });
  }, [initialDraft]);

  async function handleAiReply() {
    if (!body.trim()) return;
    setAiReplyLoading(true);
    try {
      const res = await fetch('/api/mail/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ originalText: body, originalSubject: subject, tone: 'formal' }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.draft) {
        setAiReplyDraft(json.draft);
      }
    } catch {
      /* 静默失败 */
    } finally {
      setAiReplyLoading(false);
    }
  }

  async function handleAiReview() {
    if (!body.trim()) return;
    setReviewLoading(true);
    try {
      const res = await fetch('/api/mail/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject, body }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.review) {
        setReviewResult(json.review);
      }
    } catch {
      /* 静默失败 */
    } finally {
      setReviewLoading(false);
    }
  }

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
          {/* 外部联系人智能档案提示 */}
          {contact && (
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-ink-secondary bg-surface-2 rounded px-2 py-1">
              <UserCircle className="h-3.5 w-3.5 text-brand-500" />
              <span className="font-medium">{contact.name || contact.email}</span>
              {contact.company && <span className="text-ink-tertiary">· {contact.company}</span>}
              {contact.role && <span className="text-ink-tertiary">· {contact.role}</span>}
              <span className="text-ink-tertiary ml-auto">互动 {contact.interactionCount} 次</span>
            </div>
          )}
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

        {/* AI 回复草稿 */}
        {aiReplyDraft && (
          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-caption font-medium text-blue-700">
                <Bot className="h-3.5 w-3.5" />
                AI 回复草稿
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setBody(aiReplyDraft)}>
                  采用
                </Button>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setAiReplyDraft(null)}>
                  关闭
                </Button>
              </div>
            </div>
            <div className="text-caption text-ink-primary whitespace-pre-wrap">{aiReplyDraft}</div>
          </div>
        )}

        {/* AI 审校结果 */}
        {reviewResult && (
          <div className="rounded-md border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className={`h-4 w-4 ${reviewResult.isSafe ? 'text-emerald-500' : 'text-warning'}`} />
                <span className="text-caption font-medium">AI 审校 · {reviewResult.score}分</span>
                <span className="text-footnote text-ink-tertiary">{reviewResult.summary}</span>
              </div>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setReviewResult(null)}>
                关闭
              </Button>
            </div>
            {reviewResult.issues.length > 0 && (
              <ul className="space-y-1">
                {reviewResult.issues.map((issue, i) => (
                  <li key={i} className={`text-[11px] rounded px-2 py-1 ${
                    issue.severity === 'critical' ? 'bg-danger/5 text-danger' :
                    issue.severity === 'warning' ? 'bg-warning/5 border border-warning/10 text-warning' :
                    'bg-surface-2 text-ink-secondary'
                  }`}>
                    <span className="font-medium">[{issue.category}]</span> {issue.message}
                    {issue.suggestion && <span className="ml-1 text-ink-tertiary">→ {issue.suggestion}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1 text-caption" onClick={handleAiReply} disabled={aiReplyLoading || !body.trim()}>
            <Bot className="h-3.5 w-3.5" />
            {aiReplyLoading ? '生成中...' : 'AI 回复'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1 text-caption" onClick={handleAiReview} disabled={reviewLoading || !body.trim()}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {reviewLoading ? '审校中...' : 'AI 审校'}
          </Button>
        </div>
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
