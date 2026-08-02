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

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePullToRefreshAction } from '@/components/pull-to-refresh';
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
  KeyRound,
  Search,
} from 'lucide-react';
import { Download, FolderInput, Paperclip, X } from 'lucide-react';
import { Reply, ReplyAll, Forward, Bold, Italic, Underline, List, ListOrdered, Link2 } from 'lucide-react';
import PageTabs from '@/components/page-tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useHandoffPrefill } from '@/hooks/useHandoffPrefill';
import { useCalendarStore } from '@/lib/store/calendar';
import { useContactStore } from '@/lib/store/contacts';
import { emailMatchesSearch, mergeMailSearchResults, normalizeMailSearchQuery } from '@/lib/mail/search-filter';
import { sanitizeMailHtml } from '@/lib/mail/sanitize-html';
import { categorizeEmail, priorityScore, CATEGORY_LABELS, type MailCategory } from '@/lib/mail/categorize';
import { CalendarPlus, UserCircle } from 'lucide-react';

interface MailStatus {
  configured: boolean;
  effective: { mode: 'personal' | 'global'; host: string; port: number; fromAddress: string } | null;
  personal: { host: string; port: number; user: string } | null;
  global: { host: string | null; port: number; fromAddress: string | null } | null;
  inbound: { configured: boolean; note?: string };
}

const MAIL_SETTINGS_HREF = '/settings/email?next=/mail&reason=mail-inbox';

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
  const [personalMailConfigured, setPersonalMailConfigured] = useState<boolean | null>(null);
  const [mailGuideOpen, setMailGuideOpen] = useState(false);
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

    fetch('/api/mail/credentials', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data) => setPersonalMailConfigured(data.configured === true))
      .catch(() => setPersonalMailConfigured(null));
  }, []);

  useEffect(() => {
    if (personalMailConfigured !== false) return;
    const key = 'tandem-mail-password-guide-seen';
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
    setMailGuideOpen(true);
  }, [personalMailConfigured]);

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
    <div className="h-full min-w-0 flex flex-col md:px-8">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
              <Mail className="h-6 w-6 text-[rgb(var(--brand-600))]" />
              邮箱
            </h1>
            <p className="mt-1 text-caption text-ink-tertiary break-words">
              对外沟通的正式通道 · 绑定个人邮箱后可收信、发信与同步日程
            </p>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={() => setMailGuideOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-caption font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-2 surface-interactive"
            >
              <KeyRound className="h-3.5 w-3.5" />
              配置引导
            </button>
            <Link
              href={MAIL_SETTINGS_HREF}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-caption font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-2 surface-interactive"
            >
              <Settings className="h-3.5 w-3.5" />
              邮箱设置
            </Link>
          </div>
        </div>

        {/* Status pill */}
        <div className="mt-3">
          {status === null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-footnote text-ink-tertiary">
              加载中...
            </span>
          ) : personalMailConfigured ? (
            <span className="inline-flex max-w-full items-start gap-1.5 rounded-full bg-success/10 px-3 py-1 text-footnote font-medium text-success im-mobile-break-anywhere">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              个人邮箱已绑定 · {status.personal?.user ?? status.effective?.fromAddress}
            </span>
          ) : status.configured ? (
            <span className="inline-flex max-w-full items-start gap-1.5 rounded-full bg-warning/5 px-3 py-1 text-footnote font-medium text-warning im-mobile-break-anywhere">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              发件已可用 · 收件需绑定个人邮箱账号和密码
            </span>
          ) : (
            <span className="inline-flex max-w-full items-start gap-1.5 rounded-full bg-warning/5 px-3 py-1 text-footnote font-medium text-warning im-mobile-break-anywhere">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              未绑定个人邮箱 · 收件前需要输入账号和密码
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="min-w-0 flex-1 overflow-auto px-4 py-4 sm:p-6">
        {tab === 'inbox' ? (
          <InboxView
            folder={params.get('folder') || 'INBOX'}
            onCompose={startCompose}
            personalMailConfigured={personalMailConfigured}
            onOpenGuide={() => setMailGuideOpen(true)}
          />
        ) : (
          <ComposeView
            canSend={status?.configured ?? false}
            initialDraft={handoffDraft}
            composeDraft={composeDraft}
            fromAddress={status?.effective?.fromAddress}
          />
        )}
      </div>

      <Dialog open={mailGuideOpen} onOpenChange={setMailGuideOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-title-3">
              <KeyRound className="h-5 w-5 text-[rgb(var(--brand-600))]" />
              输入邮箱账号和密码后才能收信
            </DialogTitle>
            <DialogDescription>
              系统需要你自己的公司邮箱地址和邮箱密码，才能读取收件箱，并把网易企业邮箱日程同步到系统日程。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-caption text-ink-secondary">
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="font-medium text-ink-primary">什么时候需要填写？</p>
              <p className="mt-1">第一次使用收件箱、发邮件、同步邮箱日程时都需要先绑定。绑定后不用每次重复输入。</p>
            </div>
            <div className="rounded-md border border-border bg-surface-2 p-3">
              <p className="font-medium text-ink-primary">填什么密码？</p>
              <p className="mt-1">按当前公司邮箱策略，先使用你平时登录网易企业邮箱的账号和密码；这里不强制要求客户端授权密码。</p>
            </div>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setMailGuideOpen(false)}>
                稍后再说
              </Button>
              <Button asChild>
                <Link href={MAIL_SETTINGS_HREF}>
                  <Settings className="mr-1.5 h-4 w-4" />
                  去绑定邮箱
                </Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* 回复 / 转发 / 撰写草稿 */
interface ComposeDraft {
  mode: 'reply' | 'replyAll' | 'forward' | 'new';
  to: string;
  cc: string;
  bcc?: string;
  subject: string;
  html: string;
  /** 用于 AI 回复 / 审校的纯文本上下文 */
  quotedText?: string;
  /** 从草稿箱回到撰写器时携带: 原草稿 UID/文件夹, 用于再次保存/发送时去重删除旧草稿 */
  draftUid?: number;
  draftFolder?: string;
}

/** 判断某文件夹是否为草稿箱 */
function isDraftsFolder(folder: string): boolean {
  return folder.toLowerCase() === 'drafts';
}

/** 本地自动保存的草稿快照 (localStorage, 断电/刷新不丢) */
interface LocalDraft {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  html: string;
  savedAt: number;
}

const MAIL_AUTOSAVE_KEY = 'tandem:mail:compose:autosave';

function loadLocalDraft(): LocalDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MAIL_AUTOSAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocalDraft(draft: LocalDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MAIL_AUTOSAVE_KEY, JSON.stringify(draft));
  } catch {
    /* 忽略配额/隐私模式错误 */
  }
}

function clearLocalDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(MAIL_AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

/* ─── 签名 / 模板 / 撤回发送 (本地偏好, 即时可用) ─── */
const MAIL_SIGNATURE_KEY = 'tandem:mail:signature';
const MAIL_TEMPLATES_KEY = 'tandem:mail:templates';
const MAIL_UNDO_DELAY_KEY = 'tandem:mail:undoDelaySec';

/** 签名块的稳定标记, 便于替换/去重, 避免重复插入 */
const SIGNATURE_MARKER = 'data-tandem-signature';

interface MailTemplate {
  id: string;
  name: string;
  subject: string;
  html: string;
}

function loadSignature(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(MAIL_SIGNATURE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveSignature(html: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (html.trim()) window.localStorage.setItem(MAIL_SIGNATURE_KEY, html);
    else window.localStorage.removeItem(MAIL_SIGNATURE_KEY);
  } catch {
    /* ignore */
  }
}

function loadTemplates(): MailTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MAIL_TEMPLATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: MailTemplate[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MAIL_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    /* ignore */
  }
}

function loadUndoDelay(): number {
  if (typeof window === 'undefined') return 5;
  try {
    const raw = Number(window.localStorage.getItem(MAIL_UNDO_DELAY_KEY));
    return Number.isFinite(raw) && raw >= 0 && raw <= 30 ? raw : 5;
  } catch {
    return 5;
  }
}

function saveUndoDelay(sec: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MAIL_UNDO_DELAY_KEY, String(sec));
  } catch {
    /* ignore */
  }
}

/** 生成带标记的签名 HTML 块 */
function signatureBlock(sigHtml: string): string {
  return `<br/><br/><div ${SIGNATURE_MARKER}="1" style="color:#666;border-top:1px solid #eee;padding-top:8px;margin-top:8px">${sigHtml}</div>`;
}

/** 附件是否可内嵌预览 (图片 / PDF) */
function isPreviewableAttachment(contentType: string, filename: string): boolean {
  const ct = (contentType || '').toLowerCase();
  if (ct.startsWith('image/') || ct === 'application/pdf') return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|pdf)$/i.test(filename || '');
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
  /** 搜索结果所在文件夹 (跨文件夹搜索时回溯打开) */
  folder?: string;
}

interface MailDirectoryUser {
  email: string;
  name?: string | null;
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

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function formatMailIdentity(
  person: { name?: string; address?: string } | undefined,
  nameByEmail: Map<string, string>,
): string {
  const address = person?.address?.trim() ?? '';
  if (!address) return person?.name?.trim() || '未知发件人';
  const rawName = person?.name?.trim();
  const normalizedAddress = normalizeEmail(address);
  const usableRawName = rawName && normalizeEmail(rawName) !== normalizedAddress ? rawName : '';
  const resolvedName = usableRawName || nameByEmail.get(normalizedAddress) || '';
  if (!resolvedName || normalizeEmail(resolvedName) === normalizedAddress) return address;
  return `${resolvedName}（${address}）`;
}

function formatMailInboxError(error: string): string {
  if (/^(未绑定|.*请先配置)/.test(error)) {
    return '收取邮件前需要先绑定个人邮箱账号和密码。';
  }
  return error;
}

function InboxView({
  folder = 'INBOX',
  onCompose,
  personalMailConfigured,
  onOpenGuide,
}: {
  folder?: string;
  onCompose: (d: ComposeDraft) => void;
  personalMailConfigured: boolean | null;
  onOpenGuide: () => void;
}) {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<InboxEmail[]>([]);
  const [searching, setSearching] = useState(false);
  /** 收件箱分类标签页: all/primary/social/promotions/updates */
  const [category, setCategory] = useState<'all' | MailCategory>('all');
  /** 优先级收件箱: 按重要度排序置顶 */
  const [priorityMode, setPriorityMode] = useState(false);
  const hadActiveSearchRef = useRef(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  /** 是否显示外部远程图片 (默认拦截, 防追踪像素; 每封邮件独立) */
  const [showRemoteImages, setShowRemoteImages] = useState(false);
  /** 当前打开详情所属文件夹 (跨文件夹搜索结果覆盖用) */
  const [detailFolder, setDetailFolder] = useState<string | null>(null);
  /** 附件预览 (图片/PDF 内嵌查看) */
  const [preview, setPreview] = useState<{ url: string; filename: string; contentType: string } | null>(null);
  const contacts = useContactStore((state) => state.contacts);
  const [directoryUsers, setDirectoryUsers] = useState<MailDirectoryUser[]>([]);

  // 每次打开新邮件默认重新拦截远程图片 (防追踪像素)
  useEffect(() => {
    setShowRemoteImages(false);
  }, [detail?.uid]);

  // 清洗正文 HTML (XSS + 远程图片拦截); 依赖正文与"显示图片"开关
  const sanitizedBody = useMemo(
    () => (detail?.htmlBody ? sanitizeMailHtml(detail.htmlBody, { blockRemoteImages: !showRemoteImages }) : null),
    [detail?.htmlBody, showRemoteImages],
  );

  const label = FOLDER_LABELS[folder] ?? { title: folder, icon: Inbox };
  const directoryNameByEmail = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of directoryUsers) {
      if (user.email && user.name) map.set(normalizeEmail(user.email), user.name);
    }
    for (const contact of contacts) {
      const email = normalizeEmail(contact.email);
      if (contact.email && contact.name && !map.has(email)) map.set(email, contact.name);
    }
    return map;
  }, [contacts, directoryUsers]);
  const normalizedSearchQuery = normalizeMailSearchQuery(searchQuery);
  const localSearchResults = useMemo(
    () =>
      normalizedSearchQuery
        ? emails.filter((email) =>
          emailMatchesSearch(email, normalizedSearchQuery, (address) =>
            directoryNameByEmail.get(normalizeEmail(address)),
          ),
        )
        : [],
    [directoryNameByEmail, emails, normalizedSearchQuery],
  );
  const visibleEmails = normalizedSearchQuery
    ? mergeMailSearchResults(searchResults, localSearchResults)
    : emails;

  // 分类标签页 / 优先级排序仅用于收件箱(INBOX)且非搜索态
  const isInboxFolder = folder.toLowerCase() === 'inbox';
  const showCategoryUi = isInboxFolder && !normalizedSearchQuery;
  const isKnownContact = useMemo(
    () => (address: string) => directoryNameByEmail.has(normalizeEmail(address)),
    [directoryNameByEmail],
  );
  const categoryCounts = useMemo(() => {
    const counts: Record<MailCategory, number> = { primary: 0, social: 0, promotions: 0, updates: 0 };
    if (!showCategoryUi) return counts;
    for (const e of visibleEmails) counts[categorizeEmail(e)] += 1;
    return counts;
  }, [showCategoryUi, visibleEmails]);
  const displayEmails = useMemo(() => {
    if (!showCategoryUi) return visibleEmails;
    let list = visibleEmails;
    if (category !== 'all') list = list.filter((e) => categorizeEmail(e) === category);
    if (priorityMode) {
      list = [...list].sort((a, b) => priorityScore(b, { isKnownContact }) - priorityScore(a, { isKnownContact }));
    }
    return list;
  }, [showCategoryUi, visibleEmails, category, priorityMode, isKnownContact]);

  // 键盘导航光标 (Gmail 风格 j/k/Enter/u)
  const [cursorIdx, setCursorIdx] = useState(-1);
  useEffect(() => {
    setCursorIdx(-1);
  }, [folder, normalizedSearchQuery, category, priorityMode]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // 详情视图: u / Esc 返回列表
      if (detail) {
        if (e.key === 'u' || e.key === 'Escape') {
          setDetail(null);
          setSelectedUid(null);
          e.preventDefault();
        }
        return;
      }
      if (displayEmails.length === 0) return;
      if (e.key === 'j') {
        setCursorIdx((i) => Math.min((i < 0 ? -1 : i) + 1, displayEmails.length - 1));
        e.preventDefault();
      } else if (e.key === 'k') {
        setCursorIdx((i) => Math.max((i < 0 ? 0 : i) - 1, 0));
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === 'o') {
        const em = displayEmails[cursorIdx];
        if (em) {
          openDetail(em.uid, em.folder);
          e.preventDefault();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, displayEmails, cursorIdx]);

  useEffect(() => {
    fetch('/api/calendar/attendees?limit=500', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setDirectoryUsers(Array.isArray(data.users) ? data.users : []))
      .catch(() => setDirectoryUsers([]));
  }, []);

  // 移动端下拉刷新 → 重新加载当前视图
  usePullToRefreshAction(() => {
    if (normalizedSearchQuery) return searchEmails(normalizedSearchQuery, 1, false);
    return loadEmails(1, false);
  });

  // folder 切换时自动重置并重新加载基础邮件列表
  useEffect(() => {
    setEmails([]);
    setSearchResults([]);
    setPage(1);
    setHasMore(false);
    setSelectedUid(null);
    setDetail(null);
    setError(null);
    setSelectedUids(new Set());
    if (personalMailConfigured !== true) {
      setLoading(false);
      return;
    }
    // 使用 setTimeout 避免与 React 批量更新冲突
    const timer = setTimeout(() => {
      void loadEmails(1, false);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, personalMailConfigured]);

  useEffect(() => {
    setSelectedUid(null);
    setDetail(null);
    setError(null);
    setSelectedUids(new Set());
    setSearchResults([]);
    if (personalMailConfigured !== true || !normalizedSearchQuery) {
      setSearching(false);
      if (personalMailConfigured === true && hadActiveSearchRef.current) {
        hadActiveSearchRef.current = false;
        setPage(1);
        setHasMore(false);
        void loadEmails(1, false);
      }
      return;
    }
    hadActiveSearchRef.current = true;
    setPage(1);
    setHasMore(false);
    const timer = setTimeout(() => {
      void searchEmails(normalizedSearchQuery, 1, false);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, normalizedSearchQuery, personalMailConfigured]);

  async function loadEmails(pageNum = 1, append = false) {
    if (personalMailConfigured !== true) {
      setLoading(false);
      setError(null);
      return;
    }
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

  async function searchEmails(query: string, pageNum = 1, append = false) {
    if (personalMailConfigured !== true) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/mail/search?q=${encodeURIComponent(query)}&folder=${encodeURIComponent(folder)}&page=${pageNum}&limit=30`,
        { credentials: 'include', cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : '搜索失败');
        return;
      }
      const normalized = Array.isArray(data.messages)
        ? data.messages.map((m: any) => ({
          uid: Number(m.uid) || 0,
          seq: Number(m.seq) || 0,
          from: Array.isArray(m.from) ? m.from : [],
          to: Array.isArray(m.to) ? m.to : [],
          subject: typeof m.subject === 'string' ? m.subject : '(无主题)',
          date: typeof m.date === 'string' ? m.date : new Date().toISOString(),
          seen: !!m.seen,
          flags: Array.isArray(m.flags) ? m.flags : [],
          attachments: Array.isArray(m.attachments) ? m.attachments : [],
          folder: typeof m.folder === 'string' ? m.folder : undefined,
        }))
        : [];
      if (append) {
        setSearchResults((prev) => mergeMailSearchResults(prev, normalized));
      } else {
        setSearchResults(normalized);
      }
      setHasMore(!!data.hasMore);
      setPage(Number(data.page) || pageNum);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setSearching(false);
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

  function updateMailLists(updater: (prev: InboxEmail[]) => InboxEmail[]) {
    setEmails(updater);
    setSearchResults(updater);
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
      updateMailLists((prev) =>
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
      // 已读状态变化 → 让导航角标尽快刷新
      if (typeof updates.seen === 'boolean' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tandem:mail:unread'));
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
      updateMailLists((prev) => prev.filter((e) => !uids.includes(e.uid)));
      setSelectedUids(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMoving(false);
    }
  }

  async function openDetail(uid: number, folderOverride?: string) {
    const effectiveFolder = folderOverride ?? folder;
    // 草稿箱: 点开直接回到撰写器 (可继续编辑), 而非只读详情
    if (isDraftsFolder(effectiveFolder)) {
      await openDraftInComposer(uid, effectiveFolder);
      return;
    }
    setSelectedUid(uid);
    setDetailLoading(true);
    setError(null);
    setDetailFolder(folderOverride ?? null);
    try {
      const isStarred = folder === 'starred';
      const apiFolder = folderOverride ?? (isStarred ? 'INBOX' : folder);
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

  /** 打开草稿箱中的一封草稿并载入撰写器 (可编辑, 保留收件人/抄送/HTML) */
  async function openDraftInComposer(uid: number, draftFolder: string) {
    setError(null);
    try {
      const res = await fetch(`/api/mail/inbox/${uid}?folder=${encodeURIComponent(draftFolder)}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '加载草稿失败');
        return;
      }
      const toStr = (data.to ?? []).map((t: { address: string }) => t.address).filter(Boolean).join(', ');
      const ccStr = (data.cc ?? []).map((c: { address: string }) => c.address).filter(Boolean).join(', ');
      const html = data.htmlBody || (data.textBody ? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(data.textBody)}</pre>` : '');
      onCompose({
        mode: 'new',
        to: toStr,
        cc: ccStr,
        subject: data.subject && data.subject !== '(无主题)' ? data.subject : '',
        html,
        quotedText: data.textBody || stripHtml(html),
        draftUid: uid,
        draftFolder,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** 构造引用块: Gmail 风格的 "On <date>, <from> wrote:" + 原文 HTML */
  function buildQuote(d: InboxEmail): string {
    const fromLabel = formatMailIdentity(d.from[0], directoryNameByEmail);
    const when = new Date(d.date).toLocaleString('zh-CN');
    const original = d.htmlBody
      ? sanitizeMailHtml(d.htmlBody, { blockRemoteImages: false }).html
      : (d.textBody ? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(d.textBody)}</pre>` : '');
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
    const fromLabel = formatMailIdentity(d.from[0], directoryNameByEmail);
    onCompose({
      mode: 'forward',
      to: '',
      cc: '',
      subject: /^fwd?:/i.test(d.subject) ? d.subject : `Fwd: ${d.subject}`,
      html: `<br/><br/>---------- 转发邮件 ----------<br/>发件人: ${escapeHtml(fromLabel)}<br/>日期: ${new Date(d.date).toLocaleString('zh-CN')}<br/>主题: ${escapeHtml(d.subject)}<br/><br/>${d.htmlBody ? sanitizeMailHtml(d.htmlBody, { blockRemoteImages: false }).html : escapeHtml(d.textBody || '')}`,
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
            <Star className={`h-3.5 w-3.5 mr-1 ${detail.flags.includes('\\Flagged') ? 'fill-yellow-400 text-warning' : ''}`} />
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
          <div className="rounded-md border border-info/30 bg-info/10/50 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-footnote font-medium text-info">
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
                  <div className="mt-1 text-caption text-ink-secondary break-words">
                    <span className="font-medium break-words">{formatMailIdentity(detail.from[0], directoryNameByEmail)}</span>
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
                  {detail.attachments.map((att) => {
                    const attFolder = detailFolder ?? (folder === 'starred' ? 'INBOX' : folder);
                    const base = `/api/mail/attachment?uid=${detail.uid}&filename=${encodeURIComponent(att.filename)}&folder=${encodeURIComponent(attFolder)}`;
                    const previewable = isPreviewableAttachment(att.contentType, att.filename);
                    return (
                      <div key={att.filename} className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-footnote text-ink-secondary">
                        {previewable ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 hover:text-ink-primary transition-colors"
                            onClick={() => setPreview({ url: `${base}&inline=1`, filename: att.filename, contentType: att.contentType })}
                            title="预览"
                          >
                            <Search className="h-3 w-3" />
                            {att.filename} ({(att.size / 1024).toFixed(1)} KB)
                          </button>
                        ) : (
                          <span>{att.filename} ({(att.size / 1024).toFixed(1)} KB)</span>
                        )}
                        <a href={base} download={att.filename} className="ml-1 text-ink-tertiary hover:text-ink-primary" title="下载">
                          <Download className="h-3 w-3" />
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
              <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle className="truncate">{preview?.filename}</DialogTitle>
                    <DialogDescription>附件预览</DialogDescription>
                  </DialogHeader>
                  {preview && (
                    <div className="max-h-[70vh] overflow-auto">
                      {preview.contentType.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={preview.url} alt={preview.filename} className="mx-auto max-h-[65vh] max-w-full object-contain" />
                      ) : (
                        <iframe src={preview.url} title={preview.filename} className="h-[65vh] w-full rounded border border-border" />
                      )}
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              <div className="border-t border-border pt-4">
                {detail.htmlBody && sanitizedBody ? (
                  <>
                    {sanitizedBody.hasBlockedRemoteImages && !showRemoteImages && (
                      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-footnote text-ink-secondary">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-warning" />
                        <span>已拦截外部图片以保护隐私（防追踪像素）。</span>
                        <button
                          className="ml-auto rounded bg-warning/20 px-2 py-0.5 text-[11px] font-medium text-warning hover:bg-warning/30"
                          onClick={() => setShowRemoteImages(true)}
                        >
                          显示图片
                        </button>
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none text-ink-primary" dangerouslySetInnerHTML={{ __html: sanitizedBody.html }} />
                  </>
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-headline text-ink-primary flex items-center gap-2">
          <label.icon className="h-4 w-4" />
          {label.title}
        </h2>
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:max-w-md sm:flex-row sm:justify-end">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface-1 px-3 py-1.5 text-caption text-ink-secondary focus-within:border-[rgb(var(--brand-300))] focus-within:ring-2 focus-within:ring-[rgb(var(--brand-100))]">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索 · 支持 from: has:attachment is:unread before: in:all"
              title="操作符: from: to: subject: has:attachment is:unread is:starred before:2026-01-31 after:2026-01-01 in:all/in:sent"
              className="min-w-0 flex-1 bg-transparent text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="shrink-0 text-footnote text-ink-tertiary hover:text-ink-primary"
              >
                清空
              </button>
            )}
          </label>
          <Button variant="outline" size="sm" onClick={() => normalizedSearchQuery ? searchEmails(normalizedSearchQuery, 1, false) : loadEmails()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {personalMailConfigured === false && (
        <div className="rounded-md border border-[rgb(var(--brand-500))]/25 bg-[rgb(var(--brand-50))]/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-caption font-semibold text-ink-primary">
                <KeyRound className="h-4 w-4 text-[rgb(var(--brand-600))]" />
                收取邮件前需要绑定个人邮箱
              </div>
              <p className="mt-1 text-caption leading-relaxed text-ink-secondary">
                为了从公司邮箱获取邮件，系统需要你的邮箱账号和密码来连接 IMAP 收件服务。绑定后也会用于发件和网易日程同步，不需要每次重复输入。
              </p>
            </div>
            <div className="flex shrink-0 gap-2 sm:flex-col">
              <Button variant="outline" size="sm" onClick={onOpenGuide}>
                查看说明
              </Button>
              <Button asChild size="sm">
                <Link href={MAIL_SETTINGS_HREF}>
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  去配置邮箱
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

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
              updateMailLists((prev) => prev.filter((e) => !selectedUids.has(e.uid)));
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
          <Button variant="ghost" size="sm" onClick={() => setSelectedUids(new Set(displayEmails.map((e) => e.uid)))}>全选</Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedUids(new Set())}>取消选择</Button>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-warning/5 px-3 py-2 text-caption text-warning flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{formatMailInboxError(error)}</span>
          {/^(未绑定|.*请先配置)/.test(error) && (
            <Link
              href={MAIL_SETTINGS_HREF}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 font-medium text-warning hover:bg-warning/20 surface-interactive"
            >
              <Settings className="h-3.5 w-3.5" /> 去配置邮箱
            </Link>
          )}
        </div>
      )}

      {showCategoryUi && visibleEmails.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
          {(['all', 'primary', 'social', 'updates', 'promotions'] as const).map((c) => {
            const active = category === c;
            const count = c === 'all' ? visibleEmails.length : categoryCounts[c];
            const name = c === 'all' ? '全部' : CATEGORY_LABELS[c];
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-footnote transition-colors ${
                  active
                    ? 'bg-[rgb(var(--brand-500))] text-white'
                    : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
                }`}
              >
                {name}{count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
          <button
            onClick={() => setPriorityMode((v) => !v)}
            title="按重要度排序: 星标 / 未读 / 已知联系人 / 紧急主题 / 时效"
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-footnote transition-colors ${
              priorityMode ? 'bg-warning/20 text-warning' : 'bg-surface-2 text-ink-secondary hover:bg-surface-3'
            }`}
          >
            <Star className={`h-3 w-3 ${priorityMode ? 'fill-current' : ''}`} />
            优先级
          </button>
        </div>
      )}

      {personalMailConfigured === false ? null : displayEmails.length === 0 && !loading ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Inbox className="h-8 w-8 text-ink-tertiary mx-auto" />
            <p className="text-caption text-ink-tertiary">
              {normalizedSearchQuery ? '没有找到匹配邮件' : showCategoryUi && category !== 'all' ? `“${CATEGORY_LABELS[category as MailCategory]}”分类下暂无邮件` : `${label.title}为空`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {displayEmails.map((email, idx) => (
            <div
              key={email.uid}
              onClick={() => openDetail(email.uid, email.folder)}
              className={`cv-auto rounded-md border p-3 cursor-pointer hover:bg-surface-2 transition-colors ${
                idx === cursorIdx ? 'ring-2 ring-[rgb(var(--brand-500))] ring-offset-1' : ''
              } ${
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
                      {formatMailIdentity(email.from[0], directoryNameByEmail)}
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
                    <Star className={`h-4 w-4 ${email.flags.includes('\\Flagged') ? 'fill-yellow-400 text-warning' : 'text-ink-tertiary'}`} />
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => normalizedSearchQuery ? searchEmails(normalizedSearchQuery, page + 1, true) : loadEmails(page + 1, true)}
                disabled={loading}
              >
                {loading ? '加载中...' : '加载更多'}
              </Button>
            </div>
          )}
          {searching && (
            <div className="text-center text-footnote text-ink-tertiary">正在搜索...</div>
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
  const [bcc, setBcc] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<{ name: string; size: number; type: string; content: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  /** 正在编辑的 IMAP 草稿 UID (再次保存/发送时删除旧副本, 避免草稿箱重复) */
  const [draftUid, setDraftUid] = useState<number | null>(null);
  /** 上次自动保存时间 (显示"已自动保存 hh:mm:ss") */
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  /** 可恢复的本地草稿 (页面刷新/误关后) */
  const [restorable, setRestorable] = useState<LocalDraft | null>(null);
  /** 签名 (HTML) + 编辑器开关 */
  const [signature, setSignature] = useState('');
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  /** 邮件模板 */
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  /** 撤回发送: 延迟秒数 + 倒计时 */
  const [undoDelay, setUndoDelay] = useState(5);
  const [undoRemaining, setUndoRemaining] = useState(0);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreCheckedRef = useRef(false);
  const signatureInsertedRef = useRef(false);
  /** 正文纯文本 (供校验 / AI / 草稿) */
  const bodyText = stripHtml(bodyHtml);

  // 外部联系人档案
  const { getContactByEmail, upsertContact } = useContactStore();
  const contactList = useContactStore((s) => s.contacts);
  // 收件人自动补全候选 (联系人邮箱); datalist 原生补全, 无障碍且低风险
  const recipientOptions = useMemo(
    () => contactList.filter((c) => c.email).map((c) => ({ email: c.email, label: c.name ? `${c.name} <${c.email}>` : c.email })),
    [contactList],
  );

  const totalAttachBytes = attachments.reduce((sum, a) => sum + a.size, 0);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const MAX = 25 * 1024 * 1024;
    const next = [...attachments];
    for (const file of Array.from(files)) {
      const already = next.reduce((sum, a) => sum + a.size, 0);
      if (already + file.size > MAX) {
        setFeedback({ ok: false, msg: `附件总大小超过 25MB, 已跳过 ${file.name}` });
        continue;
      }
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      }).catch(() => null);
      if (content == null) continue;
      next.push({ name: file.name, size: file.size, type: file.type || 'application/octet-stream', content });
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
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

  // 回复 / 全部回复 / 转发 / 编辑草稿: 预填收件人/抄送/主题, 并把引用块写入编辑器
  useEffect(() => {
    if (!composeDraft) return;
    restoreCheckedRef.current = true; // 有明确来源草稿时, 不再弹本地恢复
    setRestorable(null);
    setTo(composeDraft.to);
    setCc(composeDraft.cc);
    setBcc(composeDraft.bcc ?? '');
    if (composeDraft.cc || composeDraft.bcc) setShowCcBcc(true);
    setSubject(composeDraft.subject);
    setBodyHtml(composeDraft.html);
    setDraftUid(composeDraft.draftUid ?? null);
    if (editorRef.current) editorRef.current.innerHTML = composeDraft.html;
    const label =
      composeDraft.mode === 'forward' ? '转发'
        : composeDraft.mode === 'replyAll' ? '全部回复'
          : composeDraft.mode === 'reply' ? '回复'
            : composeDraft.draftUid ? '编辑草稿' : '撰写';
    setFeedback({ ok: true, msg: composeDraft.draftUid ? '已载入草稿, 可继续编辑后发送.' : `已进入${label}模式, 在引用上方输入内容即可.` });
    // 光标置顶, 方便在引用上方书写
    setTimeout(() => editorRef.current?.focus(), 0);
  }, [composeDraft]);

  // 挂载时检测本地未发送草稿 (仅在无明确来源草稿时提示恢复)
  useEffect(() => {
    if (restoreCheckedRef.current) return;
    restoreCheckedRef.current = true;
    if (composeDraft || initialDraft) return;
    const local = loadLocalDraft();
    if (local && (local.to || local.subject || stripHtml(local.html).trim())) {
      setRestorable(local);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动保存到本地 (防抖 1s), 任一字段变化即写入; 空内容不保存
  useEffect(() => {
    const hasContent = Boolean(to.trim() || cc.trim() || bcc.trim() || subject.trim() || bodyText.trim());
    if (!hasContent) return;
    const timer = setTimeout(() => {
      saveLocalDraft({ to, cc, bcc, subject, html: bodyHtml, savedAt: Date.now() });
      setAutoSavedAt(new Date().toLocaleTimeString('zh-CN'));
    }, 1000);
    return () => clearTimeout(timer);
  }, [to, cc, bcc, subject, bodyHtml, bodyText]);

  function restoreLocalDraft() {
    if (!restorable) return;
    setTo(restorable.to);
    setCc(restorable.cc);
    setBcc(restorable.bcc);
    if (restorable.cc || restorable.bcc) setShowCcBcc(true);
    setSubject(restorable.subject);
    setBodyHtml(restorable.html);
    if (editorRef.current) editorRef.current.innerHTML = restorable.html;
    setRestorable(null);
    setFeedback({ ok: true, msg: '已恢复上次未发送的草稿.' });
  }

  function discardLocalDraft() {
    clearLocalDraft();
    setRestorable(null);
  }

  // 载入签名 / 模板 / 撤回延迟偏好
  useEffect(() => {
    setSignature(loadSignature());
    setTemplates(loadTemplates());
    setUndoDelay(loadUndoDelay());
  }, []);

  // 新邮件(非回复/转发/草稿)自动追加签名, 每次挂载仅一次
  useEffect(() => {
    if (signatureInsertedRef.current) return;
    if (composeDraft || initialDraft) return; // 回复/转发/草稿由各自逻辑处理
    const sig = signature;
    if (!sig.trim()) return;
    signatureInsertedRef.current = true;
    setBodyHtml((cur) => {
      if (cur.includes(SIGNATURE_MARKER)) return cur;
      const next = cur + signatureBlock(sig);
      if (editorRef.current) editorRef.current.innerHTML = next;
      return next;
    });
  }, [signature, composeDraft, initialDraft]);

  function persistSignature() {
    saveSignature(signature);
    setShowSignatureEditor(false);
    setFeedback({ ok: true, msg: signature.trim() ? '签名已保存' : '签名已清除' });
  }

  function applyTemplate(tpl: MailTemplate) {
    if (tpl.subject) setSubject(tpl.subject);
    // 保留已存在的签名块: 模板正文在前, 签名在后
    const sigPart = signature.trim() && !tpl.html.includes(SIGNATURE_MARKER) ? signatureBlock(signature) : '';
    const next = tpl.html + sigPart;
    setBodyHtml(next);
    if (editorRef.current) editorRef.current.innerHTML = next;
    setShowTemplateMenu(false);
    setFeedback({ ok: true, msg: `已套用模板「${tpl.name}」` });
  }

  function saveCurrentAsTemplate() {
    const name = window.prompt('模板名称：', subject.trim() || '未命名模板');
    if (!name) return;
    // 保存时剥离签名块, 避免模板与签名重复
    const html = editorRef.current?.innerHTML ?? bodyHtml;
    const cleaned = html.replace(new RegExp(`<div ${SIGNATURE_MARKER}[\\s\\S]*?</div>`, 'g'), '');
    const tpl: MailTemplate = { id: `tpl_${Date.now()}`, name, subject, html: cleaned };
    const next = [...templates.filter((t) => t.name !== name), tpl];
    setTemplates(next);
    saveTemplates(next);
    setShowTemplateMenu(false);
    setFeedback({ ok: true, msg: `已保存为模板「${name}」` });
  }

  function deleteTemplate(id: string) {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    saveTemplates(next);
  }

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

  // 撤回窗口结束后真正执行发送
  async function doSend() {
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
          bcc: bcc.trim() ? bcc.split(/[,;\s]+/).filter(Boolean) : undefined,
          subject,
          html: bodyHtml,
          text: bodyText,
          attachments: attachments.length
            ? attachments.map((a) => ({ filename: a.name, content: a.content, contentType: a.type }))
            : undefined,
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
        setBcc('');
        setAttachments([]);
        clearLocalDraft();
        setAutoSavedAt(null);
        // 发送成功后删除对应的草稿箱副本 (若来自草稿)
        if (draftUid) {
          fetch(`/api/mail/inbox?uids=${draftUid}&folder=Drafts`, { method: 'DELETE', credentials: 'include' }).catch(() => {});
          setDraftUid(null);
        }
      }
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // 点击发送: 先进入撤回窗口 (可配置秒数), 到点再真正发送
  function handleSend() {
    if (!canSend) {
      setFeedback({ ok: false, msg: 'SMTP 未配置, 无法发送. 联系管理员.' });
      return;
    }
    if (!to.trim() || !subject.trim() || !bodyText.trim()) {
      setFeedback({ ok: false, msg: '收件人 / 主题 / 正文均不可为空' });
      return;
    }
    if (undoDelay <= 0) {
      void doSend();
      return;
    }
    setFeedback(null);
    setUndoRemaining(undoDelay);
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = setInterval(() => {
      setUndoRemaining((r) => {
        if (r <= 1) {
          if (undoTimerRef.current) clearInterval(undoTimerRef.current);
          undoTimerRef.current = null;
          void doSend();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function cancelSend() {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoRemaining(0);
    setFeedback({ ok: true, msg: '已撤销发送，可继续编辑。' });
  }

  // 卸载时清理撤回计时器
  useEffect(() => () => {
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
  }, []);

  const sending = undoRemaining > 0;

  return (
    <div className="w-full max-w-3xl min-w-0 space-y-4">
      {sending && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-footnote text-warning">
          <Send className="h-3.5 w-3.5 shrink-0" />
          <span>邮件将在 {undoRemaining} 秒后发送。</span>
          <button className="ml-auto rounded bg-warning/20 px-2.5 py-0.5 text-[11px] font-medium text-warning hover:bg-warning/30" onClick={cancelSend}>撤销发送</button>
        </div>
      )}
      {restorable && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-footnote text-ink-secondary">
          <FileText className="h-3.5 w-3.5 shrink-0 text-info" />
          <span>发现上次未发送的草稿（{new Date(restorable.savedAt).toLocaleString('zh-CN')}）。</span>
          <div className="ml-auto flex items-center gap-1.5">
            <button className="rounded bg-info/20 px-2 py-0.5 text-[11px] font-medium text-info hover:bg-info/30" onClick={restoreLocalDraft}>恢复</button>
            <button className="rounded px-2 py-0.5 text-[11px] text-ink-tertiary hover:text-danger" onClick={discardLocalDraft}>丢弃</button>
          </div>
        </div>
      )}
      <div className="space-y-3 rounded-lg border border-border bg-[rgb(var(--surface-1))] p-4 shadow-soft-sm sm:p-5">
        {/* 联系人自动补全候选 */}
        <datalist id="mail-recipient-suggestions">
          {recipientOptions.map((o) => (
            <option key={o.email} value={o.email}>{o.label}</option>
          ))}
        </datalist>
        <Field label="收件人" hint="支持多个, 用逗号或空格分隔">
          <div className="flex items-start gap-2">
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="alice@example.com, bob@example.com"
              autoComplete="off"
              list="mail-recipient-suggestions"
              className="flex-1"
            />
            {!showCcBcc && (
              <button
                type="button"
                className="shrink-0 mt-2 text-[11px] text-brand-500 hover:underline"
                onClick={() => setShowCcBcc(true)}
              >
                抄送/密送
              </button>
            )}
          </div>
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
        {showCcBcc && (
          <>
            <Field label="抄送 (Cc)" hint="可选">
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="(留空则无)"
                autoComplete="off"
                list="mail-recipient-suggestions"
              />
            </Field>
            <Field label="密送 (Bcc)" hint="收件人之间互不可见">
              <Input
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="(留空则无)"
                autoComplete="off"
                list="mail-recipient-suggestions"
              />
            </Field>
          </>
        )}
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
              <span className="mx-1 h-4 w-px bg-border" />
              <label className="inline-flex items-center gap-1 rounded px-1 text-[11px] text-ink-tertiary hover:text-ink-primary cursor-pointer" title="字体颜色">
                <span aria-hidden>A</span>
                <input
                  type="color"
                  className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                  onChange={(e) => exec('foreColor', e.target.value)}
                  aria-label="字体颜色"
                />
              </label>
              <select
                className="rounded border border-border bg-transparent px-1 py-0.5 text-[11px] text-ink-secondary"
                defaultValue="3"
                onChange={(e) => { exec('fontSize', e.target.value); e.target.selectedIndex = 0; }}
                aria-label="字号"
                title="字号"
              >
                <option value="3">字号</option>
                <option value="1">小</option>
                <option value="3">正常</option>
                <option value="5">大</option>
                <option value="7">特大</option>
              </select>
              <span className="mx-1 h-4 w-px bg-border" />
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-tertiary hover:bg-surface-2 hover:text-ink-primary"
                onClick={() => fileInputRef.current?.click()}
                title="添加附件"
              >
                <Paperclip className="h-3.5 w-3.5" />
                附件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <span className="mx-1 h-4 w-px bg-border" />
              <div className="relative">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-ink-tertiary hover:bg-surface-2 hover:text-ink-primary"
                  onClick={() => setShowTemplateMenu((v) => !v)}
                  title="邮件模板"
                >
                  <FileText className="h-3.5 w-3.5" />
                  模板
                </button>
                {showTemplateMenu && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-md border border-border bg-[rgb(var(--surface-1))] p-1 shadow-soft-md">
                    {templates.length === 0 && (
                      <p className="px-2 py-1.5 text-[11px] text-ink-tertiary">暂无模板</p>
                    )}
                    {templates.map((t) => (
                      <div key={t.id} className="flex items-center gap-1 rounded px-1 hover:bg-surface-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate px-1 py-1 text-left text-[11px] text-ink-secondary"
                          onClick={() => applyTemplate(t)}
                          title={t.subject || t.name}
                        >
                          {t.name}
                        </button>
                        <button type="button" className="shrink-0 px-1 text-ink-tertiary hover:text-danger" onClick={() => deleteTemplate(t.id)} title="删除模板">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="mt-1 border-t border-border pt-1">
                      <button type="button" className="w-full rounded px-2 py-1 text-left text-[11px] font-medium text-info hover:bg-info/10" onClick={saveCurrentAsTemplate}>
                        + 保存当前为模板
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-surface-2 ${showSignatureEditor ? 'text-info' : 'text-ink-tertiary hover:text-ink-primary'}`}
                onClick={() => setShowSignatureEditor((v) => !v)}
                title="邮件签名"
              >
                <Sparkles className="h-3.5 w-3.5" />
                签名
              </button>
            </div>
            {showSignatureEditor && (
              <div className="space-y-1.5 border-b border-border bg-surface-2/50 px-2 py-2">
                <p className="text-[11px] text-ink-tertiary">签名 (纯文本, 新邮件自动追加到正文末尾)</p>
                <textarea
                  value={stripHtml(signature)}
                  onChange={(e) => setSignature(escapeHtml(e.target.value).replace(/\n/g, '<br/>'))}
                  rows={3}
                  className="w-full rounded border border-border bg-[rgb(var(--surface-1))] px-2 py-1 text-caption"
                  placeholder="例如：\n张三 | 瑞合瑞德集团\n手机 138xxxx"
                />
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded bg-info/15 px-2.5 py-0.5 text-[11px] font-medium text-info hover:bg-info/25" onClick={persistSignature}>保存签名</button>
                  <label className="ml-auto flex items-center gap-1 text-[11px] text-ink-tertiary">
                    撤回窗口
                    <select
                      value={undoDelay}
                      onChange={(e) => { const v = Number(e.target.value); setUndoDelay(v); saveUndoDelay(v); }}
                      className="rounded border border-border bg-transparent px-1 py-0.5"
                    >
                      <option value={0}>关闭</option>
                      <option value={5}>5 秒</option>
                      <option value={10}>10 秒</option>
                      <option value={20}>20 秒</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
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

        {/* 附件列表 */}
        {attachments.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-footnote text-ink-tertiary">
              <span>附件 {attachments.length} 个</span>
              <span>{(totalAttachBytes / 1024 / 1024).toFixed(2)} MB / 25 MB</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div key={`${a.name}-${i}`} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-footnote text-ink-secondary">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="max-w-[180px] truncate" title={a.name}>{a.name}</span>
                  <span className="text-ink-tertiary">({(a.size / 1024).toFixed(0)} KB)</span>
                  <button
                    type="button"
                    className="ml-0.5 text-ink-tertiary hover:text-danger"
                    onClick={() => setAttachments((list) => list.filter((_, idx) => idx !== i))}
                    aria-label={`移除附件 ${a.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI 回复草稿 */}
        {aiReplyDraft && (
          <div className="rounded-md border border-info/30 bg-info/10/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-footnote font-medium text-info">
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
                <ShieldCheck className={`h-4 w-4 ${reviewResult.isSafe ? 'text-success' : 'text-warning'}`} />
                <span className="text-footnote font-medium">AI 审校 · {reviewResult.score}分</span>
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
                    issue.severity === 'warning' ? 'bg-warning/5 text-warning' :
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
              ? 'rounded-md bg-success/10 px-3 py-2 text-caption text-success flex items-start gap-2'
              : 'rounded-md bg-danger/5 px-3 py-2 text-caption text-danger flex items-start gap-2'
          }
        >
          {feedback.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      <div className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button variant="outline" size="sm" className="min-w-0 gap-1 text-footnote" onClick={handleAiReply} disabled={aiReplyLoading || !bodyText.trim()}>
            <Bot className="h-3.5 w-3.5" />
            {aiReplyLoading ? '生成中...' : 'AI 回复'}
          </Button>
          <Button variant="outline" size="sm" className="min-w-0 gap-1 text-footnote" onClick={handleAiReview} disabled={reviewLoading || !bodyText.trim()}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {reviewLoading ? '审校中...' : 'AI 审校'}
          </Button>
        </div>
        <Button variant="outline" className="w-full justify-center sm:w-auto" onClick={async () => {
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
                bcc: bcc.trim() ? bcc.split(/[,;\s]+/).filter(Boolean) : undefined,
                subject,
                text: bodyText,
                html: bodyHtml || undefined,
                replaceUid: draftUid ?? undefined,
              }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
              setFeedback({ ok: false, msg: json.error ?? `保存失败 (${res.status})` });
            } else {
              const newUid = Number(json.uid) || null;
              if (newUid) setDraftUid(newUid);
              setFeedback({ ok: true, msg: '草稿已保存到草稿箱' });
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
        <Button onClick={handleSend} disabled={busy || !canSend || sending} className="w-full justify-center sm:w-auto rheem-btn-pill">
          <Send className="h-4 w-4 mr-1.5" />
          {sending ? `${undoRemaining}s 后发送...` : busy ? '发送中...' : canSend ? '立即发送' : 'SMTP 未配置'}
        </Button>
        {autoSavedAt && (
          <span className="self-center text-[11px] text-ink-tertiary sm:ml-auto">已自动保存 {autoSavedAt}</span>
        )}
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
