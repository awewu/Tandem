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

import { Suspense, useEffect, useRef, useState } from 'react';
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
  ArrowLeft,
  FileText,
  Star,
} from 'lucide-react';
import { Download, FolderInput } from 'lucide-react';
import { Reply, ReplyAll, Forward, Bold, Italic, Underline, List, ListOrdered, Link2 } from 'lucide-react';
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
  effective: { mode: 'personal' | 'global'; host: string; port: number; fromAddress: string } | null;
  personal: { host: string; port: number; user: string } | null;
  global: { host: string | null; port: number; fromAddress: string | null } | null;
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
  const [tab, setTab] = useState<'inbox' | 'compose'>('inbox');
  const [status, setStatus] = useState<MailStatus | null>(null);
  /** Tandem 转交草稿: 仅在收到 handoff 时有值, 一次性预填给 ComposeView */
  const [handoffDraft, setHandoffDraft] = useState<{ subject: string; body: string } | null>(null);
  /** 回复 / 转发草稿: 由收件箱详情页触发, 预填 ComposeView (含收件人/抄送/HTML 引用) */
  const [composeDraft, setComposeDraft] = useState<ComposeDraft | null>(null);

  // 监听 URL tab 参数变化（左侧菜单切换）
  useEffect(() => {
    const t = params.get('tab') === 'compose' ? 'compose' : 'inbox';
    setTab(t);
  }, [params]);

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

  /** 收件箱详情页回调: 构造回复/转发草稿并切到撰写视图 */
  function startCompose(draft: ComposeDraft) {
    setComposeDraft(draft);
    setHandoffDraft(null);
    setTab('compose');
  }

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
              {status.effective?.mode === 'personal' ? '个人邮箱' : '全局 SMTP'} · {status.effective?.fromAddress}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/5 px-3 py-1 text-footnote font-medium text-warning">
              <AlertCircle className="h-3.5 w-3.5" />
              SMTP 未配置 · 请先绑定个人邮箱
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {tab === 'inbox' ? (
          <InboxView folder={params.get('folder') || 'INBOX'} onCompose={startCompose} />
        ) : (
          <ComposeView
            canSend={status?.configured ?? false}
            initialDraft={handoffDraft}
            composeDraft={composeDraft}
            fromAddress={status?.effective?.fromAddress}
          />
        )}
      </div>
    </div>
  );
}

/* 回复 / 转发 / 撰写草稿 */
interface ComposeDraft {
  mode: 'reply' | 'replyAll' | 'forward' | 'new';
  to: string;
  cc: string;
  subject: string;
  html: string;
  /** 用于 AI 回复 / 审校的纯文本上下文 */
  quotedText?: string;
}

/* ─────────── Inbox · IMAP 收件箱 ─────────── */

interface InboxEmail {
  uid: number;
  seq: number;
  from: { name?: string; address: string }[];
  to: { name?: string; address: string }[];
  subject: string;
  date: string;
  textBody?: string;
  htmlBody?: string;
  attachments: { filename: string; size: number; contentType: string }[];
  flags: string[];
  seen: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isThisYear) return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

const FOLDER_LABELS: Record<string, { title: string; icon: typeof Inbox }> = {
  INBOX: { title: '收件箱', icon: Inbox },
  Sent: { title: '已发送', icon: Send },
  'Sent Items': { title: '已发送', icon: Send },
  sent: { title: '已发送', icon: Send },
  Drafts: { title: '草稿箱', icon: FileText },
  drafts: { title: '草稿箱', icon: FileText },
  starred: { title: '星标邮件', icon: Star },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function InboxView({ folder = 'INBOX', onCompose }: { folder?: string; onCompose: (d: ComposeDraft) => void }) {
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [detail, setDetail] = useState<InboxEmail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
  const [marking, setMarking] = useState(false);
  const [moving, setMoving] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const label = FOLDER_LABELS[folder] ?? { title: folder, icon: Inbox };

  // folder 切换时自动重置并重新加载
  useEffect(() => {
    setEmails([]);
    setPage(1);
    setHasMore(false);
    setSelectedUid(null);
    setDetail(null);
    setError(null);
    setSelectedUids(new Set());
    // 使用 setTimeout 避免与 React 批量更新冲突
    const timer = setTimeout(() => {
      loadEmails(1, false);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  async function loadEmails(pageNum = 1, append = false) {
    setLoading(true);
    setError(null);
    try {
      const isStarred = folder === 'starred';
      const apiFolder = isStarred ? 'INBOX' : folder;
      const flaggedParam = isStarred ? '&flagged=true' : '';
      const res = await fetch(`/api/mail/inbox?page=${pageNum}&limit=20&folder=${encodeURIComponent(apiFolder)}${flaggedParam}`, { credentials: 'include' });
      const data = await res.json();
      console.log('[inbox frontend] response:', data);
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '加载失败');
        return;
      }
      if (!Array.isArray(data.messages)) {
        setError('返回数据格式错误: messages 不是数组');
        console.error('[inbox frontend] invalid data:', data);
        return;
      }
      const normalized = data.messages.map((m: any) => ({
        uid: Number(m.uid) || 0,
        seq: Number(m.seq) || 0,
        from: Array.isArray(m.from) ? m.from : [],
        to: Array.isArray(m.to) ? m.to : [],
        subject: typeof m.subject === 'string' ? m.subject : '(无主题)',
        date: typeof m.date === 'string' ? m.date : new Date().toISOString(),
        seen: !!m.seen,
        flags: Array.isArray(m.flags) ? m.flags : [],
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
      }));
      if (append) {
        setEmails((prev) => [...prev, ...normalized]);
      } else {
        setEmails(normalized);
      }
      setHasMore(!!data.hasMore);
      setPage(pageNum);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function applyFlags(prevFlags: string[], updates: { seen?: boolean; flagged?: boolean }) {
    const flags = [...prevFlags];
    if (updates.seen === true && !flags.includes('\\Seen')) flags.push('\\Seen');
    if (updates.seen === false) {
      const idx = flags.indexOf('\\Seen');
      if (idx >= 0) flags.splice(idx, 1);
    }
    if (updates.flagged === true && !flags.includes('\\Flagged')) flags.push('\\Flagged');
    if (updates.flagged === false) {
      const idx = flags.indexOf('\\Flagged');
      if (idx >= 0) flags.splice(idx, 1);
    }
    return flags;
  }

  async function batchMark(uids: number[], updates: { seen?: boolean; flagged?: boolean }) {
    if (uids.length === 0) return;
    setMarking(true);
    try {
      const isStarred = folder === 'starred';
      const apiFolder = isStarred ? 'INBOX' : folder;
      const res = await fetch('/api/mail/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uids, folder: apiFolder, ...updates }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('标记失败');
      setEmails((prev) =>
        prev.map((e) => {
          if (!uids.includes(e.uid)) return e;
          const newFlags = applyFlags(e.flags, updates);
          return { ...e, flags: newFlags, seen: newFlags.includes('\\Seen') };
        })
      );
      if (detail && uids.includes(detail.uid)) {
        const newFlags = applyFlags(detail.flags, updates);
        setDetail({ ...detail, flags: newFlags, seen: newFlags.includes('\\Seen') });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMarking(false);
    }
  }

  const MOVE_TARGETS = [
    { label: '垃圾箱', value: 'Trash' },
    { label: '草稿箱', value: 'Drafts' },
    { label: '已发送', value: 'Sent' },
    { label: '归档', value: 'Archive' },
  ].filter((t) => t.value.toLowerCase() !== folder.toLowerCase());

  async function batchMove(uids: number[], to: string) {
    if (!uids.length) return;
    setMoving(true);
    try {
      const apiFolder = folder === 'starred' ? 'INBOX' : folder;
      const res = await fetch('/api/mail/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uids, from: apiFolder, to }),
      });
      if (!res.ok) throw new Error('移动失败');
      setEmails((prev) => prev.filter((e) => !uids.includes(e.uid)));
      setSelectedUids(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMoving(false);
    }
  }

  async function openDetail(uid: number) {
    setSelectedUid(uid);
    setDetailLoading(true);
    setError(null);
    try {
      const isStarred = folder === 'starred';
      const apiFolder = isStarred ? 'INBOX' : folder;
      const res = await fetch(`/api/mail/inbox/${uid}?folder=${encodeURIComponent(apiFolder)}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setDetail(data);
        if (!data.seen) {
          batchMark([uid], { seen: true }).catch(() => {});
        }
      } else {
        setError(data.error || '加载详情失败');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadEmails();
  }, []);

  /** 构造引用块: Gmail 风格的 "On <date>, <from> wrote:" + 原文 HTML */
  function buildQuote(d: InboxEmail): string {
    const fromLabel = d.from[0]?.name || d.from[0]?.address || '';
    const when = new Date(d.date).toLocaleString('zh-CN');
    const original = d.htmlBody || (d.textBody ? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(d.textBody)}</pre>` : '');
    return `<br/><br/><div style="border-left:2px solid #ccc;padding-left:12px;color:#666">在 ${when}，${escapeHtml(fromLabel)} 写道：<br/>${original}</div>`;
  }

  function startReply(d: InboxEmail, all: boolean) {
    const me = d.to[0]?.address || '';
    const ccList = all
      ? [...d.to.slice(1).map((t) => t.address), ...(d.from.slice(1).map((f) => f.address))].filter((a) => a && a !== me)
      : [];
    onCompose({
      mode: all ? 'replyAll' : 'reply',
      to: d.from[0]?.address || '',
      cc: ccList.join(', '),
      subject: /^re:/i.test(d.subject) ? d.subject : `Re: ${d.subject}`,
      html: buildQuote(d),
      quotedText: d.textBody || stripHtml(d.htmlBody || ''),
    });
  }

  function startForward(d: InboxEmail) {
    onCompose({
      mode: 'forward',
      to: '',
      cc: '',
      subject: /^fwd?:/i.test(d.subject) ? d.subject : `Fwd: ${d.subject}`,
      html: `<br/><br/>---------- 转发邮件 ----------<br/>发件人: ${escapeHtml(d.from[0]?.address || '')}<br/>日期: ${new Date(d.date).toLocaleString('zh-CN')}<br/>主题: ${escapeHtml(d.subject)}<br/><br/>${d.htmlBody || escapeHtml(d.textBody || '')}`,
      quotedText: d.textBody || stripHtml(d.htmlBody || ''),
    });
  }

  async function summarizeThread(d: InboxEmail) {
    setSummaryLoading(true);
    setAiSummary(null);
    try {
      const res = await fetch('/api/mail/thread-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          emails: [{
            subject: d.subject,
            from: d.from[0]?.address || '',
            date: d.date,
            text: d.textBody || stripHtml(d.htmlBody || ''),
          }],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok && json.summary) {
        const s = json.summary;
        const parts: string[] = [];
        if (Array.isArray(s.timeline) && s.timeline.length) parts.push('时间线:\n' + s.timeline.map((t: any) => `· ${t.date} ${t.who}: ${t.what}`).join('\n'));
        if (Array.isArray(s.keyDecisions) && s.keyDecisions.length) parts.push('关键决策:\n' + s.keyDecisions.map((x: string) => `· ${x}`).join('\n'));
        if (Array.isArray(s.outstandingQuestions) && s.outstandingQuestions.length) parts.push('待解决:\n' + s.outstandingQuestions.map((x: string) => `· ${x}`).join('\n'));
        if (Array.isArray(s.nextActions) && s.nextActions.length) parts.push('下一步:\n' + s.nextActions.map((x: string) => `· ${x}`).join('\n'));
        setAiSummary(parts.join('\n\n') || '（无可摘要内容）');
      } else {
        setAiSummary('AI 摘要暂时不可用');
      }
    } catch {
      setAiSummary('AI 摘要请求失败');
    } finally {
      setSummaryLoading(false);
    }
  }

  if (selectedUid !== null) {
    return (
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedUid(null); setDetail(null); setError(null); }}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            返回列表
          </Button>
        {detail && (
          <>
            <Button variant="outline" size="sm" onClick={() => startReply(detail, false)}>
              <Reply className="h-3.5 w-3.5 mr-1" />
              回复
            </Button>
            <Button variant="outline" size="sm" onClick={() => startReply(detail, true)}>
              <ReplyAll className="h-3.5 w-3.5 mr-1" />
              全部回复
            </Button>
            <Button variant="outline" size="sm" onClick={() => startForward(detail)}>
              <Forward className="h-3.5 w-3.5 mr-1" />
              转发
            </Button>
            <Button variant="outline" size="sm" onClick={() => summarizeThread(detail)} disabled={summaryLoading}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {summaryLoading ? 'AI 摘要中...' : 'AI 摘要'}
            </Button>
          </>
        )}
        {detail && (
          <Button variant="outline" size="sm" onClick={() => batchMark([detail.uid], { flagged: !detail.flags.includes('\\Flagged') })} disabled={marking}>
            <Star className={`h-3.5 w-3.5 mr-1 ${detail.flags.includes('\\Flagged') ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            {detail.flags.includes('\\Flagged') ? '取消星标' : '标记星标'}
          </Button>
        )}
        {detail && MOVE_TARGETS.map((t) => (
          <Button key={t.value} variant="outline" size="sm" onClick={() => { batchMove([detail.uid], t.value); setSelectedUid(null); setDetail(null); }} disabled={moving}>
            <FolderInput className="h-3.5 w-3.5 mr-1" />
            移至{t.label}
          </Button>
        ))}
      </div>
        {aiSummary && (
          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Sparkles className="h-3.5 w-3.5" />
                AI 摘要
              </span>
              <button className="text-[10px] text-ink-tertiary hover:text-ink-primary" onClick={() => setAiSummary(null)}>关闭</button>
            </div>
            <pre className="whitespace-pre-wrap text-caption text-ink-primary font-sans">{aiSummary}</pre>
          </div>
        )}
        {detailLoading ? (
          <Card><CardContent className="p-8 text-center text-caption text-ink-tertiary">加载中...</CardContent></Card>
        ) : detail ? (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-headline text-ink-primary break-words">{detail.subject}</h2>
                  <div className="mt-1 text-caption text-ink-secondary">
                    <span className="font-medium">{detail.from[0]?.name || detail.from[0]?.address}</span>
                    <span className="text-ink-tertiary ml-1">&lt;{detail.from[0]?.address}&gt;</span>
                  </div>
                  <div className="text-footnote text-ink-tertiary mt-0.5">
                    收件人: {detail.to.map((t) => t.address).join(', ')}
                  </div>
                  <div className="text-footnote text-ink-tertiary">
                    {new Date(detail.date).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
              {detail.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {detail.attachments.map((att) => (
                    <a
                      key={att.filename}
                      href={`/api/mail/attachment?uid=${detail.uid}&filename=${encodeURIComponent(att.filename)}&folder=${encodeURIComponent(folder === 'starred' ? 'INBOX' : folder)}`}
                      download={att.filename}
                      className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-footnote text-ink-secondary hover:bg-surface-3 hover:text-ink-primary transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      {att.filename} ({(att.size / 1024).toFixed(1)} KB)
                    </a>
                  ))}
                </div>
              )}
              <div className="border-t border-border pt-4">
                {detail.htmlBody ? (
                  <div className="prose prose-sm max-w-none text-ink-primary" dangerouslySetInnerHTML={{ __html: detail.htmlBody }} />
                ) : detail.textBody ? (
                  <pre className="whitespace-pre-wrap text-caption text-ink-primary font-sans">{detail.textBody}</pre>
                ) : (
                  <p className="text-caption text-ink-tertiary">（无正文内容）</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="p-8 text-center text-caption text-ink-tertiary">邮件不存在</CardContent></Card>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-headline text-ink-primary flex items-center gap-2">
          <label.icon className="h-4 w-4" />
          {label.title}
        </h2>
        <Button variant="outline" size="sm" onClick={() => loadEmails()} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {selectedUids.size > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
          <span className="text-caption text-ink-secondary">已选 {selectedUids.size} 封</span>
          <Button variant="outline" size="sm" onClick={() => batchMark(Array.from(selectedUids), { seen: true })} disabled={marking}>标记已读</Button>
          <Button variant="outline" size="sm" onClick={() => batchMark(Array.from(selectedUids), { flagged: true })} disabled={marking}>标记星标</Button>
          <Button variant="outline" size="sm" onClick={() => batchMark(Array.from(selectedUids), { flagged: false })} disabled={marking}>取消星标</Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={async () => {
            if (!window.confirm(`确定删除 ${selectedUids.size} 封邮件？`)) return;
            setMarking(true);
            try {
              const isStarred = folder === 'starred';
              const apiFolder = isStarred ? 'INBOX' : folder;
              const res = await fetch(`/api/mail/inbox?uids=${Array.from(selectedUids).join(',')}&folder=${encodeURIComponent(apiFolder)}`, { method: 'DELETE', credentials: 'include' });
              if (!res.ok) throw new Error('删除失败');
              setEmails((prev) => prev.filter((e) => !selectedUids.has(e.uid)));
              setSelectedUids(new Set());
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setMarking(false);
            }
          }} disabled={marking}>删除</Button>
          <Button variant="outline" size="sm" onClick={() => batchMove(Array.from(selectedUids), 'Trash')} disabled={moving}>
            <FolderInput className="h-3.5 w-3.5 mr-1" />
            移至垃圾箱
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedUids(new Set(emails.map((e) => e.uid)))}>全选</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedUids(new Set())}>取消选择</Button>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-warning/5 px-3 py-2 text-caption text-warning flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          {/^(未绑定|.*请先配置)/.test(error) && (
            <Link
              href="/settings/email"
              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 font-medium text-warning hover:bg-warning/20 surface-interactive"
            >
              <Settings className="h-3.5 w-3.5" /> 去配置邮箱
            </Link>
          )}
        </div>
      )}

      {emails.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Inbox className="h-8 w-8 text-ink-tertiary mx-auto" />
            <p className="text-caption text-ink-tertiary">{label.title}为空</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.uid}
              onClick={() => openDetail(email.uid)}
              className={`rounded-md border p-3 cursor-pointer hover:bg-surface-2 transition-colors ${
                email.seen ? 'border-border bg-[rgb(var(--surface-1))]' : 'border-[rgb(var(--brand-500))]/30 bg-[rgb(var(--brand-50))]/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedUids.has(email.uid)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const next = new Set(selectedUids);
                    if (e.target.checked) next.add(email.uid);
                    else next.delete(email.uid);
                    setSelectedUids(next);
                  }}
                  className="mt-1 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!email.seen && <span className="h-2 w-2 rounded-full bg-[rgb(var(--brand-600))] shrink-0" />}
                    <span className="text-caption font-medium text-ink-primary truncate">
                      {email.from[0]?.name || email.from[0]?.address || '未知发件人'}
                    </span>
                  </div>
                  <div className={`mt-0.5 truncate ${email.seen ? 'text-caption text-ink-secondary' : 'text-caption font-medium text-ink-primary'}`}>
                    {email.subject}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); batchMark([email.uid], { flagged: !email.flags.includes('\\Flagged') }); }}
                    className="p-1 rounded hover:bg-surface-2"
                    disabled={marking}
                  >
                    <Star className={`h-4 w-4 ${email.flags.includes('\\Flagged') ? 'fill-yellow-400 text-yellow-400' : 'text-ink-tertiary'}`} />
                  </button>
                  <div className="text-footnote text-ink-tertiary">
                    {formatDate(email.date)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={() => loadEmails(page + 1, true)} disabled={loading}>
                {loading ? '加载中...' : '加载更多'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Compose (V1 real SMTP send) ─────────── */

function ComposeView({
  canSend,
  initialDraft,
  composeDraft,
  fromAddress,
}: {
  canSend: boolean;
  initialDraft?: { subject: string; body: string } | null;
  composeDraft?: ComposeDraft | null;
  fromAddress?: string;
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState(initialDraft?.subject ?? '');
  /** 正文 HTML (富文本编辑器内容) */
  const [bodyHtml, setBodyHtml] = useState(initialDraft?.body ? escapeHtml(initialDraft.body) : '');
  const [cc, setCc] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  /** 正文纯文本 (供校验 / AI / 草稿) */
  const bodyText = stripHtml(bodyHtml);

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
    setBodyHtml((cur) => (cur ? cur : escapeHtml(initialDraft.body)));
    if (editorRef.current && !editorRef.current.innerHTML) editorRef.current.innerHTML = escapeHtml(initialDraft.body);
    setFeedback({ ok: true, msg: '已从 Tandem 工作台预填草稿, 补完收件人后即可发送.' });
  }, [initialDraft]);

  // 回复 / 全部回复 / 转发: 预填收件人/抄送/主题, 并把引用块写入编辑器
  useEffect(() => {
    if (!composeDraft) return;
    setTo(composeDraft.to);
    setCc(composeDraft.cc);
    setSubject(composeDraft.subject);
    setBodyHtml(composeDraft.html);
    if (editorRef.current) editorRef.current.innerHTML = composeDraft.html;
    const label = composeDraft.mode === 'forward' ? '转发' : composeDraft.mode === 'replyAll' ? '全部回复' : '回复';
    setFeedback({ ok: true, msg: `已进入${label}模式, 在引用上方输入内容即可.` });
    // 光标置顶, 方便在引用上方书写
    setTimeout(() => editorRef.current?.focus(), 0);
  }, [composeDraft]);

  function syncBody() {
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  }

  function exec(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    syncBody();
  }

  async function handleAiReply() {
    if (!bodyText.trim()) return;
    setAiReplyLoading(true);
    try {
      const res = await fetch('/api/mail/ai-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ originalText: composeDraft?.quotedText || bodyText, originalSubject: subject, tone: 'formal' }),
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
    if (!bodyText.trim()) return;
    setReviewLoading(true);
    try {
      const res = await fetch('/api/mail/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ subject, body: bodyText }),
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
    if (!to.trim() || !subject.trim() || !bodyText.trim()) {
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
          html: bodyHtml,
          text: bodyText,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setFeedback({ ok: false, msg: json.error ?? `发送失败 (${res.status})` });
      } else {
        setFeedback({ ok: true, msg: `已发送 · messageId: ${json.messageId ?? '(unknown)'}` });
        setTo('');
        setSubject('');
        setBodyHtml('');
        if (editorRef.current) editorRef.current.innerHTML = '';
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
        <Field label="正文" hint="富文本 · 支持加粗/斜体/下划线/列表/链接">
          <div className="rounded-md border border-border bg-[rgb(var(--surface-1))] focus-within:ring-2 focus-within:ring-[rgb(var(--brand-500))/.25] focus-within:border-[rgb(var(--brand-500))]">
            {/* 工具栏 */}
            <div className="flex items-center gap-0.5 border-b border-border px-2 py-1">
              <ToolbarBtn label="加粗" onClick={() => exec('bold')}><Bold className="h-3.5 w-3.5" /></ToolbarBtn>
              <ToolbarBtn label="斜体" onClick={() => exec('italic')}><Italic className="h-3.5 w-3.5" /></ToolbarBtn>
              <ToolbarBtn label="下划线" onClick={() => exec('underline')}><Underline className="h-3.5 w-3.5" /></ToolbarBtn>
              <span className="mx-1 h-4 w-px bg-border" />
              <ToolbarBtn label="无序列表" onClick={() => exec('insertUnorderedList')}><List className="h-3.5 w-3.5" /></ToolbarBtn>
              <ToolbarBtn label="有序列表" onClick={() => exec('insertOrderedList')}><ListOrdered className="h-3.5 w-3.5" /></ToolbarBtn>
              <ToolbarBtn label="插入链接" onClick={() => {
                const url = window.prompt('输入链接地址 (含 https://)');
                if (url) exec('createLink', url);
              }}><Link2 className="h-3.5 w-3.5" /></ToolbarBtn>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={syncBody}
              data-placeholder="写下你想说的..."
              className="mail-editor min-h-[220px] max-h-[460px] overflow-auto px-3 py-2 text-body text-ink-primary focus:outline-none prose prose-sm max-w-none"
            />
          </div>
        </Field>

        {/* AI 回复草稿 */}
        {aiReplyDraft && (
          <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Bot className="h-3.5 w-3.5" />
                AI 回复草稿
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    const html = escapeHtml(aiReplyDraft);
                    setBodyHtml(html);
                    if (editorRef.current) editorRef.current.innerHTML = html;
                    setAiReplyDraft(null);
                  }}
                >
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
                <ShieldCheck className={`h-4 w-4 ${reviewResult.isSafe ? 'text-emerald-500' : 'text-amber-500'}`} />
                <span className="text-xs font-medium">AI 审校 · {reviewResult.score}分</span>
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
                    issue.severity === 'warning' ? 'bg-amber-50 text-amber-700' :
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
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleAiReply} disabled={aiReplyLoading || !bodyText.trim()}>
            <Bot className="h-3.5 w-3.5" />
            {aiReplyLoading ? '生成中...' : 'AI 回复'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleAiReview} disabled={reviewLoading || !bodyText.trim()}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {reviewLoading ? '审校中...' : 'AI 审校'}
          </Button>
        </div>
        <Button variant="outline" onClick={async () => {
          if (!subject.trim() && !bodyText.trim()) {
            setFeedback({ ok: false, msg: '主题或正文至少填一个' });
            return;
          }
          setBusy(true);
          setFeedback(null);
          try {
            const res = await fetch('/api/mail/inbox', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                to: to.split(/[,;\s]+/).filter(Boolean),
                cc: cc.trim() ? cc.split(/[,;\s]+/).filter(Boolean) : undefined,
                subject,
                text: bodyText,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
              setFeedback({ ok: false, msg: json.error ?? `保存失败 (${res.status})` });
            } else {
              setFeedback({ ok: true, msg: '草稿已保存' });
            }
          } catch (e) {
            setFeedback({ ok: false, msg: (e as Error).message });
          } finally {
            setBusy(false);
          }
        }} disabled={busy}>
          <FileText className="h-4 w-4 mr-1.5" />
          {busy ? '保存中...' : '存草稿'}
        </Button>
        <Button onClick={handleSend} disabled={busy || !canSend} className="rheem-btn-pill">
          <Send className="h-4 w-4 mr-1.5" />
          {busy ? '发送中...' : canSend ? '立即发送' : 'SMTP 未配置'}
        </Button>
      </div>
    </div>
  );
}

function ToolbarBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
    >
      {children}
    </button>
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
