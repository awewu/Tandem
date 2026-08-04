'use client';

/**
 * /im · Tandem 内置 IM — 对标企业微信"消息"板块
 *
 * 两栏布局: 会话列表 (左 280px) + 消息流 (右)
 * 差异化: hover 消息 → 开议事室 / 沉淀 Memory / @AI分身 / 已读回执
 */

import { Suspense, memo, useCallback, useState, useEffect, useMemo, useRef, type ComponentType, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import officePreset from '@file-viewer/preset-office';
import { CreateChannelDialog } from '@/components/im/create-channel-dialog';
import { ChannelDetailPanel } from '@/components/im/channel-detail-panel';
import { ImSidebar } from '@/components/im/im-sidebar';
import { ImVoiceComposerButton } from '@/components/im/im-voice-composer-button';
import { ImVoiceMessageButton } from '@/components/im/ImVoiceMessageButton';
import { MemberProfileCard, type ImProfileUser } from '@/components/im/member-profile-card';
import ImSearchOverlay from '@/components/im/ImSearchOverlay';
import ImForwardOverlay from '@/components/im/ImForwardOverlay';
import { AgentModeToggle } from '@/components/im/agent-mode-toggle';
import { AiTraceButton } from '@/components/im/ai-trace-button';
import { CompanyBrainFeedbackButtons } from '@/components/im/company-brain-feedback';
import { cn } from '@/lib/utils';
import { MessageReactions } from '@/components/im/message-reactions';
import { extractPreview, type ImAttachment, type ImChannel, type ImMembership, type ImMessage } from '@/lib/types/im';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { usePersonNameResolver } from '@/lib/org/people-source';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useHandoffPrefill } from '@/hooks/useHandoffPrefill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  buildPersonMentionDisplay,
  encodePendingPersonMentionsForSend,
  insertTextAtSelection,
  messageBodyForSend,
  reconcilePendingPersonMentionRanges,
  type PendingPersonMention,
} from '@/lib/im/composer-text';
import { displayImChannelName, displayImChannelTopic, getDmPeerId } from '@/lib/im/channel-name';
import { chooseImPopupDirection, formatImMessageTimestamp, formatImDateDivider, shouldShowImDateDivider, getImReadReceiptSummary, type ImPopupDirection } from '@/lib/im/message-display';
import {
  Hash,
  Megaphone,
  Send,
  Users,
  Sparkles,
  Bot,
  Building2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Brain,
  Info,
  Search,
  Pin,
  Forward,
  Quote,
  Trash2,
  Settings,
  Smile,
  Image,
  Paperclip,
  FileText,
  Eye,
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Download,
  UsersRound,
} from 'lucide-react';

// Day 4-7: 升级 Channel/Message 类型 以含撤回 + 公告 + pinned
type Channel = ImChannel & { unread?: number };
type Message = ImMessage;

interface HrDeptLite {
  id: string;
  name: string;
  parentId: string | null;
}

const OfficeFileViewer = dynamic(() => import('@file-viewer/react'), { ssr: false }) as ComponentType<{
  url: string;
  buffer?: ArrayBuffer;
  name?: string;
  filename?: string;
  type?: string;
  size?: number;
  options?: Record<string, unknown>;
  className?: string;
  style?: CSSProperties;
}>;

function shortUserId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

function initialsOf(value: string): string {
  const chars = Array.from(value.trim().replace(/\s+/g, ''));
  return (chars.slice(0, 2).join('') || '?').toUpperCase();
}

function messageQuotePreview(message: Message): string {
  if (message.deletedAt) return '引用的消息已撤回';
  const text = extractPreview(message.body, 72);
  if (text) return text;
  const attachmentCount = message.attachments?.length ?? 0;
  if (attachmentCount > 0) return attachmentCount === 1 ? '[附件]' : `[附件] ${attachmentCount} 个文件`;
  return '引用的消息';
}

// §#1 perf: 客户端图片压缩/缩放 helpers — 大图上传/内联前先降采样, 大幅削减 base64 负载与 DOM 字节。
function readImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(String(e.target?.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    // 注意: 本文件 lucide-react 导出了 Image 图标, 会遮蔽 DOM 构造器 → 用 createElement。
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片解码失败'));
    img.src = src;
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * 压缩单张图片: 最长边缩到 maxDimension, 重编码 (透明→webp, 其余→jpeg)。
 * GIF(动图)/已足够小/压缩后反而更大 → 原样返回。任何异常 fail-soft 回退原图。
 */
async function compressImageFile(
  file: File,
  opts: { maxDimension?: number; quality?: number; minBytes?: number } = {},
): Promise<{ file: File; dataUrl: string }> {
  const maxDimension = opts.maxDimension ?? 1600;
  const quality = opts.quality ?? 0.82;
  const minBytes = opts.minBytes ?? 256 * 1024;
  const original = await readImageToDataUrl(file);
  if (file.type === 'image/gif' || file.size <= minBytes) {
    return { file, dataUrl: original };
  }
  try {
    const img = await loadHtmlImage(original);
    const longest = Math.max(img.width, img.height) || 1;
    const scale = Math.min(1, maxDimension / longest);
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, dataUrl: original };
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
    const outType = hasAlpha ? 'image/webp' : 'image/jpeg';
    const compressedDataUrl = canvas.toDataURL(outType, quality);
    if (!compressedDataUrl.startsWith('data:image/') || compressedDataUrl.length >= original.length) {
      return { file, dataUrl: original };
    }
    const blob = dataUrlToBlob(compressedDataUrl);
    const ext = outType === 'image/webp' ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    const compressedFile = new File([blob], `${baseName}.${ext}`, { type: outType });
    return { file: compressedFile, dataUrl: compressedDataUrl };
  } catch {
    return { file, dataUrl: original };
  }
}

type ComposerAttachment = {
  id: string;
  name: string;
  size: number;
  dataUrl?: string;
  file: File;
  uploadProgress?: number;
  uploadStatus?: 'queued' | 'uploading' | 'done' | 'error';
};

/**
 * 决议型已读语义 (符合 MANIFESTO 附录 C 反例清单):
 *   - 默认: 不暴露未读数, 仅"有新消息"灰点 (反焦虑型已读)
 *   - 红色未读: 仅当频道含定向需关注内容
 *     · system 消息 (议事室结果回 push)
 *     · @assign 提及我 (指派型)
 *     · @consult 提及我 (咨询型)
 *
 * V1 简化: channels 未读计数 unread 仍保留 (服务端用于排序),
 * 客户端仅根据"是否含定向"决定渲染颜色和是否露数字.
 */
function unreadStyle(channel: Channel): {
  show: 'none' | 'subtle' | 'urgent';
  count?: number;
} {
  if (!channel.unread || channel.unread <= 0) return { show: 'none' };
  // 启发式: 频道 lastMessagePreview 是否含 @assign / @consult / 系统回链
  const preview = channel.lastMessagePreview ?? '';
  const isUrgent =
    preview.includes('🏛️') || // 议事室回链系统消息标识
    /\(assign\)|\(consult\)/.test(preview) ||
    /^@/.test(preview); // 简单兜底: 以 @ 开头视为定向
  if (isUrgent) {
    return { show: 'urgent', count: channel.unread };
  }
  return { show: 'subtle' };
}

// useSearchParams() (?new=1 / ?dm=new deep-link) must live inside <Suspense>
// so Next can prerender the surrounding shell statically.
export default function ImPage() {
  return (
    <Suspense fallback={null}>
      <ImInner />
    </Suspense>
  );
}

function ImInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams?.get('ch') ?? null;
  const msgParam = searchParams?.get('msg') ?? null;

  const [showSearch, setShowSearch] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [forwardMessageIds, setForwardMessageIds] = useState<string[] | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [quotedMessage, setQuotedMessage] = useState<Message | null>(null);
  const [input, setInput] = useState('');
  const [pendingMentions, setPendingMentions] = useState<PendingPersonMention[]>([]);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<ImMembership[]>([]);
  const [orgUsers, setOrgUsers] = useState<Map<string, ImProfileUser>>(new Map());
  const [departmentNames, setDepartmentNames] = useState<Map<string, string>>(new Map());
  const [selectedProfileUser, setSelectedProfileUser] = useState<ImProfileUser | null>(null);
  const [sendAsAgent, setSendAsAgent] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showIdentityPicker, setShowIdentityPicker] = useState(false);
  const identityPickerRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [recallingIds, setRecallingIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragDepthRef = useRef(0);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const typingLastSentRef = useRef(0);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [typingIds, setTypingIds] = useState<string[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  // §#5 perf: 已读回执节流状态 (按频道: 上次发送时间 + trailing 定时器)。
  const readMarkLastRef = useRef<Map<string, number>>(new Map());
  const readMarkTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // §B5 回到最新: 追踪是否贴底 + 上方堆积的新消息数。
  const [atBottom, setAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle('im-chat-open', Boolean(activeId));
    return () => document.documentElement.classList.remove('im-chat-open');
  }, [activeId]);

  useEffect(() => {
    setQuotedMessage(null);
  }, [activeId]);

  // §#5 perf: 卸载时清理已读回执 trailing 定时器, 避免泄漏。
  useEffect(() => {
    const timers = readMarkTimerRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const { user } = useCurrentUser();
  const { toast } = useToast();
  const ME = user?.id ?? '';
  const nameOf = usePersonNameResolver();
  const activeChannelDisplayName = useMemo(() => {
    if (!activeChannel) return '';
    if (activeChannel.type !== 'dm') return displayImChannelName(activeChannel);
    const peerId = getDmPeerId(activeChannel, ME);
    return peerId ? nameOf(peerId) : '私聊';
  }, [activeChannel, ME, nameOf]);
  const myDisplayName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name;
    const email = user?.email?.trim();
    if (email) return email.split('@')[0] || email;
    return ME ? shortUserId(ME) : '';
  }, [ME, user?.email, user?.name]);
  const myAvatarText = useMemo(() => initialsOf(myDisplayName), [myDisplayName]);
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;
  // §#2 perf: 用 ref 镜像可变 guard, 让下方 useCallback 保持稳定引用 (memo 生效的前提)。
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const recallingIdsRef = useRef(recallingIds);
  recallingIdsRef.current = recallingIds;
  // §B1 typing: 节流广播"正在输入" (最多 2.5s 一次), 服务端 transient 不落库。
  const broadcastTyping = useCallback(() => {
    const chId = activeIdRef.current;
    if (!chId) return;
    const now = Date.now();
    if (now - typingLastSentRef.current < 2500) return;
    typingLastSentRef.current = now;
    void fetch(`/api/im/channels/${chId}/typing`, { method: 'POST' }).catch(() => {});
  }, []);
  const handleComposerTextChange = useCallback((previous: string, next: string) => {
    setPendingMentions((current) => reconcilePendingPersonMentionRanges(previous, next, current));
    if (next.trim() && next !== previous) broadcastTyping();
  }, [broadcastTyping]);
  const handlePersonMentionInserted = useCallback((mention: PendingPersonMention) => {
    setPendingMentions((current) => [...current, mention]);
  }, []);
  useEffect(() => {
    let alive = true;
    void Promise.all([
      fetch('/api/org/users', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { users: [] })).catch(() => ({ users: [] })),
      fetch('/api/org/departments', { cache: 'no-store' }).then((res) => (res.ok ? res.json() : { depts: [] })).catch(() => ({ depts: [] })),
    ]).then(([usersData, deptData]) => {
      if (!alive) return;
      const users = new Map<string, ImProfileUser>();
      for (const userItem of (usersData.users ?? []) as ImProfileUser[]) users.set(userItem.id, userItem);
      setOrgUsers(users);

      const depts = (deptData.depts ?? []) as HrDeptLite[];
      const byId = new Map(depts.map((dept) => [dept.id, dept]));
      const names = new Map<string, string>();
      for (const dept of depts) {
        const parent = dept.parentId ? byId.get(dept.parentId) : null;
        names.set(dept.id, parent ? `${parent.name} / ${dept.name}` : dept.name);
      }
      setDepartmentNames(names);
    });
    return () => { alive = false; };
  }, []);

  const openMemberProfile = useCallback((userId: string) => {
    const user = orgUsers.get(userId) ?? {
      id: userId,
      name: nameOf(userId) || shortUserId(userId),
    };
    setSelectedProfileUser(user);
  }, [nameOf, orgUsers]);
  const insertVoiceText = useCallback((text: string) => {
    const spoken = text.trim();
    if (!spoken) return;
    const el = composerRef.current;
    const current = input;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const needsLeadingSpace = start > 0 && current[start - 1] && !/\s/.test(current[start - 1]);
    const needsTrailingSpace = end < current.length && current[end] && !/\s/.test(current[end]);
    const insert = `${needsLeadingSpace ? ' ' : ''}${spoken}${needsTrailingSpace ? ' ' : ''}`;
    const next = current.slice(0, start) + insert + current.slice(end);
    setInput(next);
    handleComposerTextChange(current, next);
    queueMicrotask(() => {
      const target = composerRef.current;
      if (!target) return;
      const caret = start + insert.length;
      target.focus();
      target.setSelectionRange(caret, caret);
    });
  }, [handleComposerTextChange, input]);
  const hasActiveUploads = sending && attachments.some((a) => a.uploadStatus === 'queued' || a.uploadStatus === 'uploading');
  const quotedMessagesById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  function isTempMessage(message: Message): boolean {
    return message.id.startsWith('temp-');
  }

  function isSameOutgoingMessage(a: Message, b: Message): boolean {
    const aAttachments = a.attachments ?? [];
    const bAttachments = b.attachments ?? [];
    return (
      a.channelId === b.channelId &&
      a.senderId === b.senderId &&
      (a.senderKind ?? 'user') === (b.senderKind ?? 'user') &&
      (a.parentMessageId ?? null) === (b.parentMessageId ?? null) &&
      a.body === b.body &&
      aAttachments.length === bAttachments.length &&
      aAttachments.every((att, index) => (
        att.kind === bAttachments[index]?.kind &&
        att.name === bAttachments[index]?.name &&
        att.size === bAttachments[index]?.size
      ))
    );
  }

  function confirmLeaveDuringUpload(): boolean {
    if (!hasActiveUploads) return true;
    return window.confirm('还有文件传输中，返回会导致传输失败。确定要返回吗？');
  }

  function notifyChannelsRefresh() {
    window.dispatchEvent(new Event('tandem:im-channels-refresh'));
  }

  const refreshMembers = useCallback((chId: string) => {
    void fetch(`/api/im/channels/${chId}/members`)
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []));
  }, []);

  async function sendChannelRead(chId: string) {
    readMarkLastRef.current.set(chId, Date.now());
    await fetch(`/api/im/channels/${chId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    notifyChannelsRefresh();
  }

  // §#5 perf: 已读回执节流 (每频道最多 1.5s 一次) — 高频消息流下不再每条 POST /read + 全局刷频道列。
  // 首次/间隔已过 → 立即发; 否则复用/新建 trailing 定时器在窗口边界补发一次 (保证最终一致)。
  function markActiveChannelRead(chId: string) {
    const MIN_INTERVAL = 1500;
    const last = readMarkLastRef.current.get(chId) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed >= MIN_INTERVAL) {
      void sendChannelRead(chId);
      return;
    }
    if (readMarkTimerRef.current.has(chId)) return;
    const timer = setTimeout(() => {
      readMarkTimerRef.current.delete(chId);
      void sendChannelRead(chId);
    }, MIN_INTERVAL - elapsed);
    readMarkTimerRef.current.set(chId, timer);
  }

  function closeActiveChat() {
    if (!confirmLeaveDuringUpload()) return;
    setShowSettings(false);
    setShowEmojiPicker(false);
    setShowIdentityPicker(false);
    setActiveChannel(null);
    setMessages([]);
    router.replace('/im', { scroll: false });
  }

  useEffect(() => {
    if (!hasActiveUploads) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '还有文件传输中，离开会导致传输失败。';
    };

    const onPopState = () => {
      const shouldLeave = window.confirm('还有文件传输中，返回会导致传输失败。确定要返回吗？');
      if (shouldLeave) {
        window.setTimeout(() => window.history.back(), 0);
        return;
      }
      window.history.pushState({ __tandemImUploadGuard: true }, '', window.location.href);
    };

    window.history.pushState({ __tandemImUploadGuard: true }, '', window.location.href);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [hasActiveUploads]);

  // 监听 ChannelDetailPanel 个人名片"发消息"触发的 im:startDm 事件
  useEffect(() => {
    const handler = (e: Event) => {
      const userId = (e as CustomEvent<string>).detail;
      if (userId) void startDmWith(userId);
    };
    window.addEventListener('im:startDm', handler);
    return () => window.removeEventListener('im:startDm', handler);
  // startDmWith 在函数体后定义, eslint 无法识别依赖, 这里 ignore 是正确的
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 拉取当前频道元数据
  useEffect(() => {
    if (!activeId) { setActiveChannel(null); return; }
    if (!ME) { setActiveChannel(null); return; }
    void fetch(`/api/im/channels?userId=${ME}`)
      .then((r) => r.json())
      .then((data) => {
        const ch = (data.channels ?? []).find((c: Channel) => c.id === activeId) ?? null;
        setActiveChannel(ch);
      });
  }, [activeId, ME]);

  // §Sprint1 搜索定位: 带 ?msg= 进入频道时, 滚动到该消息并高亮闪烁, 随后清理 msg 参数.
  useEffect(() => {
    if (!msgParam || messages.length === 0) return;
    if (!messages.some((m) => m.id === msgParam)) return;
    const el = document.getElementById(`im-msg-${msgParam}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(msgParam);
    const clearHl = setTimeout(() => setHighlightId(null), 2600);
    // 去掉 msg 参数避免刷新/重渲染重复触发 (保留 ch).
    router.replace(`/im?ch=${activeId}`, { scroll: false });
    return () => clearTimeout(clearHl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgParam, messages]);

  // -- messages --
  // §#4 perf: 初始批量从 200 降到 50 — 首屏 DOM/负载更轻, 更早历史靠向上翻页 (B2) 按需加载。
  const INITIAL_PAGE = 50;
  const OLDER_PAGE = 50;
  const REFRESH_PAGE = 80;
  async function loadMessages(chId: string) {
    const res = await fetch(`/api/im/channels/${chId}/messages?limit=${INITIAL_PAGE}`, { cache: 'no-store' });
    const data = await res.json();
    const msgs = (data.messages ?? []) as Message[];
    setMessages(msgs);
    setHasMoreOlder(msgs.length >= INITIAL_PAGE);
    setLoadingOlder(false);
    loadingOlderRef.current = false;
    // §B5 切频道回到贴底态, 清零新消息计数
    setNewMsgCount(0);
    setAtBottom(true);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 30);
    void markActiveChannelRead(chId);
  }

  // §B5 平滑滚到底部并清零新消息计数
  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNewMsgCount(0);
    setAtBottom(true);
  }

  // §B2 向上翻页拉历史: before=<当前最早消息 createdAt> (排他游标), 预取后回补滚动锚点避免跳动。
  async function loadOlderMessages() {
    const chId = activeIdRef.current;
    const el = scrollRef.current;
    if (!chId || !el || loadingOlderRef.current || !hasMoreOlder) return;
    const oldest = messages[0];
    if (!oldest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;
    try {
      const res = await fetch(
        `/api/im/channels/${chId}/messages?limit=${OLDER_PAGE}&before=${encodeURIComponent(oldest.createdAt)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const data = await res.json();
      const older = (data.messages ?? []) as Message[];
      if (older.length === 0) { setHasMoreOlder(false); return; }
      setHasMoreOlder(older.length >= OLDER_PAGE);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !existing.has(m.id)), ...prev];
      });
      // 保持锚点: 新内容插到顶部, 回补 scrollTop = prevTop + (newHeight - prevHeight)
      requestAnimationFrame(() => {
        const el2 = scrollRef.current;
        if (el2) el2.scrollTop = prevTop + (el2.scrollHeight - prevHeight);
      });
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  async function refreshMessages(chId: string) {
    const el = scrollRef.current;
    const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    const res = await fetch(`/api/im/channels/${chId}/messages?limit=${REFRESH_PAGE}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const serverMessages = (data.messages ?? []) as Message[];

    // §B2 merge (不再整列替换): 否则每次轮询会抹掉向上加载的历史页。
    // 以最新 N 条覆盖更新/新增, 保留已加载的更早历史, 按 createdAt 升序重排, 末尾接未确认乐观消息。
    setMessages((prev) => {
      const optimisticMessages = prev.filter(
        (m) => isTempMessage(m) && !serverMessages.some((serverMsg) => isSameOutgoingMessage(m, serverMsg))
      );
      const byId = new Map<string, Message>();
      for (const m of prev) if (!isTempMessage(m)) byId.set(m.id, m);
      for (const sm of serverMessages) byId.set(sm.id, sm);
      const nonTemp = Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return [...nonTemp, ...optimisticMessages];
    });

    if (nearBottom) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 30);
    }

    void markActiveChannelRead(chId);
  }

  // -- SSE subscribe --
  useEffect(() => {
    if (!activeId || !ME) return;
    void loadMessages(activeId);

    const es = new EventSource(
      `/api/im/channels/${activeId}/stream?userId=${ME}`
    );
    // §A2 SSE 自愈: 原生自动重连; 重连成功 (onopen 第二次+) 立即对账补洞
    // (服务端无 seq-log, 用 merge 拉最新 N 条回填, 对齐 Last-Event-ID 之前的缺口)。
    let sseHealthy = false;
    let sseOpenedOnce = false;
    es.onopen = () => {
      sseHealthy = true;
      if (sseOpenedOnce) void refreshMessages(activeId);
      sseOpenedOnce = true;
    };
    es.onerror = () => { sseHealthy = false; }; // 不 close, 交给浏览器自动重试
    es.addEventListener('message', (e) => {
      try {
        sseHealthy = true;
        // 追加前先判断用户是否本就贴近底部; 若在上方翻历史则不打扰
        const el = scrollRef.current;
        const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 150;
        const msg = JSON.parse((e as MessageEvent).data) as Message;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev.filter((m) => !(isTempMessage(m) && isSameOutgoingMessage(m, msg))), msg];
        });
        if (nearBottom) {
          setTimeout(() => {
            scrollRef.current?.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: 'smooth',
            });
          }, 30);
        } else if (msg.senderId !== ME) {
          // §B5 用户在上方翻历史 → 不打扰, 累积"N 条新消息"
          setNewMsgCount((n) => n + 1);
        }
        // 保持已读
        void markActiveChannelRead(activeId);
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('unread', notifyChannelsRefresh);
    es.addEventListener('read_receipt', () => refreshMembers(activeId));
    // §B1 typing: 收到他人"正在输入" → 4s TTL 自动清除 (服务端已排除自己)。
    es.addEventListener('typing', (e) => {
      try {
        const { userId: who } = JSON.parse((e as MessageEvent).data) as { userId: string };
        if (!who || who === ME) return;
        const timers = typingTimersRef.current;
        const existing = timers.get(who);
        if (existing) clearTimeout(existing);
        setTypingIds((prev) => (prev.includes(who) ? prev : [...prev, who]));
        timers.set(who, setTimeout(() => {
          timers.delete(who);
          setTypingIds((prev) => prev.filter((id) => id !== who));
        }, 4000));
      } catch { /* ignore */ }
    });
    // Day 4: 撤回事件 — 替换本地设置 deletedAt
    es.addEventListener('message_updated', (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data) as Message;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      } catch { /* ignore */ }
    });
    es.addEventListener('channel', notifyChannelsRefresh);

    // §B6 去掉常态 30s 轮询: 仅在 SSE 断线降级时快速对账 (健康时 no-op, 消除滚动抖动/冗余请求)。
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (!sseHealthy) void refreshMessages(activeId);
    }, 5_000);

    return () => {
      window.clearInterval(poll);
      es.close();
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      setTypingIds([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ME]);

  // 拉取当前频道成员 (为已读人数计算 + 设置对话框复用)
  useEffect(() => {
    if (!activeId || !ME) { setMembers([]); return; }
    refreshMembers(activeId);
  }, [activeId, ME, refreshMembers]);

  /** Day 4: 撤回消息 */
  const recallMessageHandler = useCallback(async (messageId: string) => {
    if (recallingIdsRef.current.has(messageId)) return;
    if (!confirm('确认撤回这条消息?')) return;
    setRecallingIds((prev) => new Set(prev).add(messageId));
    try {
      const res = await fetch(`/api/im/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recall', userId: ME }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: 'destructive', title: '撤回失败', description: String(data.error ?? res.statusText) });
        return;
      }
      if (data.message) {
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data.message : m)));
      }
    } finally {
      setRecallingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [ME, toast]);

  /** Day 7: pin/unpin 消息 */
  const togglePinHandler = useCallback(async (messageId: string) => {
    const chId = activeIdRef.current;
    if (!chId) return;
    const res = await fetch(`/api/im/channels/${chId}/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, operatorId: ME }),
    });
    if (!res.ok) {
      const data = await res.json();
      toast({ variant: 'destructive', title: '置顶失败', description: String(data.error ?? res.statusText) });
    }
  }, [ME, toast]);

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event.target?.result ?? ''));
      reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
      reader.readAsDataURL(file);
    });
  }

  // §#1 perf: 统一图片入队 — 先压缩再入 attachments (压缩内部 fail-soft 回退原图)。
  async function addImageAttachment(rawFile: File, displayName?: string) {
    const { file, dataUrl } = await compressImageFile(rawFile);
    setAttachments((prev) => [
      ...prev,
      { id: makeAttachmentId(file), name: displayName ?? file.name, size: file.size, dataUrl, file },
    ]);
  }

  function isImageAttachment(file: File, dataUrl?: string): boolean {
    return (
      file.type.startsWith('image/') ||
      dataUrl?.startsWith('data:image/') ||
      /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(file.name)
    );
  }

  function makeAttachmentId(file: File): string {
    return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
  }

  function updateAttachmentProgress(id: string, progress: number, status: ComposerAttachment['uploadStatus']) {
    setAttachments((prev) => prev.map((item) => (
      item.id === id ? { ...item, uploadProgress: progress, uploadStatus: status } : item
    )));
  }

  function putFileWithProgress(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      if (file.type) xhr.setRequestHeader('Content-Type', file.type);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`上传失败 (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('上传失败: 网络连接异常'));
      xhr.onabort = () => reject(new Error('上传已取消'));
      xhr.send(file);
    });
  }

  /**
   * 上传单个附件到对象存储 (走 IM 专用预签名端点), 返回 ImAttachment.
   * 失败抛错, 由 sendMessage 捕获统一提示.
   */
  async function uploadAttachment(
    chId: string,
    attachment: ComposerAttachment,
    onProgress?: (id: string, progress: number, status: ComposerAttachment['uploadStatus']) => void,
  ): Promise<ImAttachment> {
    const { file, dataUrl } = attachment;
    if (isImageAttachment(file, dataUrl)) {
      onProgress?.(attachment.id, 100, 'done');
      return {
        kind: 'image',
        name: file.name,
        size: file.size,
        mimeType: file.type,
        url: dataUrl ?? await readFileAsDataUrl(file),
      };
    }

    const presignRes = await fetch(`/api/im/channels/${chId}/attachments/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'upload', fileName: file.name, contentType: file.type }),
    });
    if (!presignRes.ok) {
      const err = await presignRes.json().catch(() => ({}));
      const errorMessage = String(err.error ?? '');
      if (errorMessage.includes('object storage not configured') && isImageAttachment(file, dataUrl)) {
        const inlineUrl = dataUrl ?? await readFileAsDataUrl(file);
        return {
          kind: 'image',
          name: file.name,
          size: file.size,
          mimeType: file.type,
          url: inlineUrl,
        };
      }
      throw new Error(err.error ?? `预签名失败 (${presignRes.status})`);
    }
    const { uploadUrl, storageKey } = await presignRes.json();
    onProgress?.(attachment.id, 1, 'uploading');
    await putFileWithProgress(uploadUrl, file, (progress) => {
      onProgress?.(attachment.id, progress, progress >= 100 ? 'done' : 'uploading');
    });
    return {
      kind: file.type.startsWith('image/') ? 'image' : 'file',
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      refId: storageKey,
    };
  }

  async function updateMessageAttachments(messageId: string, nextAttachments: ImAttachment[]): Promise<Message | null> {
    const res = await fetch(`/api/im/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_attachments', attachments: nextAttachments }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    return data.message as Message | null;
  }

  async function sendMessage() {
    const displayText = messageBodyForSend(input);
    const mentionsForSend = pendingMentions;
    const text = encodePendingPersonMentionsForSend(displayText, mentionsForSend);
    if ((!displayText && attachments.length === 0) || !activeId || !ME || sending) return;

    const quotedForSend = quotedMessage;
    const queuedAttachments = attachments;
    const placeholderAttachments: ImAttachment[] = queuedAttachments.length > 0
      ? queuedAttachments.map((a) => ({
        kind: isImageAttachment(a.file, a.dataUrl) ? 'image' : 'file',
        name: a.name,
        size: a.size,
        mimeType: a.file.type || 'application/octet-stream',
        url: a.dataUrl,
        uploadStatus: 'uploading',
        uploadProgress: 0,
      }))
      : [];
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage: Message = {
      id: tempId,
      channelId: activeId,
      senderId: ME,
      senderKind: sendAsAgent ? 'persona' : 'user',
      body: text,
      mentions: [],
      parentMessageId: quotedForSend?.id,
      attachments: placeholderAttachments.length > 0 ? placeholderAttachments : undefined,
      createdAt: new Date().toISOString(),
    };

    setSending(true);
    setInput('');
    setPendingMentions([]);
    setQuotedMessage(null);
    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 30);

    let serverMessage: Message | null = null;
    try {
      const res = await fetch(`/api/im/channels/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: ME,
          body: text,
          parentMessageId: quotedForSend?.id,
          attachments: placeholderAttachments.length > 0 ? placeholderAttachments : undefined,
          senderKind: sendAsAgent ? 'persona' : 'user',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setInput(displayText);
        setPendingMentions(mentionsForSend);
        setQuotedMessage(quotedForSend);
        toast({ variant: 'destructive', title: '发送失败', description: String(err.error ?? res.statusText) });
        return;
      }

      const data = await res.json().catch(() => ({}));
      serverMessage = data.message as Message | null;
      if (serverMessage) {
        const confirmedMessage = serverMessage;
        setMessages((prev) => {
          if (prev.some((m) => m.id === confirmedMessage.id)) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? confirmedMessage : m));
        });
        notifyChannelsRefresh();
      }

      if (queuedAttachments.length === 0 || !serverMessage) {
        setAttachments([]);
        return;
      }

      try {
        queuedAttachments.forEach((a) => updateAttachmentProgress(a.id, 0, 'queued'));
        const uploaded = await Promise.all(queuedAttachments.map((a) => uploadAttachment(activeId, a, updateAttachmentProgress)));
        const doneAttachments = uploaded.map((att) => ({ ...att, uploadStatus: 'done' as const, uploadProgress: 100 }));
        const updated = await updateMessageAttachments(serverMessage.id, doneAttachments);
        if (updated) setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setAttachments([]);
      } catch (e) {
        queuedAttachments.forEach((a) => updateAttachmentProgress(a.id, a.uploadProgress ?? 0, 'error'));
        const failedAttachments = placeholderAttachments.map((att) => ({
          ...att,
          uploadStatus: 'error' as const,
          uploadError: (e as Error).message,
        }));
        const updated = await updateMessageAttachments(serverMessage.id, failedAttachments);
        if (updated) setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        toast({ variant: 'destructive', title: '附件上传失败', description: (e as Error).message });
      }
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  const spawnRoom = useCallback(async (messageId: string) => {
    if (busyRef.current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/im/messages/${messageId}/spawn-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: ME }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: '开议事室失败', description: String(data.error ?? res.statusText) });
        return;
      }
      // 跳到新议事室
      window.open(`/convergence?id=${data.cardId}`, '_blank');
    } finally {
      setBusy(false);
    }
  }, [ME, toast]);

  const promoteToMemory = useCallback(async (messageId: string) => {
    if (busyRef.current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/im/messages/${messageId}/promote-to-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: ME, level: 'team', proposedType: 'lesson' }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: 'destructive', title: '沉淀 Memory 失败', description: String(data.error ?? res.statusText) });
        return;
      }
      toast({
        title: '已发起 Memory 升级提议',
        description: 'level: team · type: lesson — 去 /memories 查看签批',
      });
    } finally {
      setBusy(false);
    }
  }, [ME, toast]);

  const summonPersona = useCallback((targetId: string) => {
    // 在 composer 插入 mention 语法
    const tag = `@[${targetId}](${targetId}:persona) `;
    setInput((cur) => (cur ? `${cur} ${tag}` : tag));
    composerRef.current?.focus();
  }, []);

  // §#2 perf: 稳定回调 (按 id 参数化), 供 memo 化的 MessageRow 使用。
  const handleReactionChange = useCallback((messageId: string, reactions: Record<string, string[]>) => {
    setMessages((prev) => prev.map((x) => (x.id === messageId ? { ...x, reactions } : x)));
  }, []);
  const handleForward = useCallback((messageId: string) => {
    setForwardMessageIds([messageId]);
  }, []);
  const handleQuote = useCallback((messageId: string) => {
    const message = messages.find((item) => item.id === messageId);
    if (!message || message.deletedAt) return;
    setQuotedMessage(message);
    composerRef.current?.focus();
  }, [messages]);

  /** Q2 Day 2: 点通讯录中人员 → 建/找 dm 并切过去 */
  async function startDmWith(otherId: string) {
    if (!ME || otherId === ME) return;
    setBusy(true);
    try {
      const res = await fetch('/api/im/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meId: ME, otherId }),
      });
      const data = await res.json();
      if (res.ok && data.channel?.id) {
        router.push(`/im?ch=${data.channel.id}`);
      }
    } finally {
      setBusy(false);
    }
  }

  /** 粘贴: 将剪贴板文件入队 (图片走预览压缩, 其他文件走附件上传闭环). */
  function queuePastedFiles(files: File[]) {
    const normalized = files.map((file) => {
      if (!file.type.startsWith('image/')) return file;
      const ext = (file.type.split('/')[1] || 'png').split('+')[0];
      // 剪贴板图片常为统一名 'image.png', 重命名避免多张重名
      return file.name && file.name !== 'image.png'
        ? file
        : new File([file], `pasted-${Date.now()}.${ext}`, { type: file.type });
    });
    enqueueComposerFiles(normalized, { previewImages: true });
  }

  function enqueueComposerFiles(files: File[], options: { previewImages?: boolean } = {}) {
    if (!files.length) return;
    files.forEach((file) => {
      if (options.previewImages && file.type.startsWith('image/')) {
        void addImageAttachment(file);
      } else {
        setAttachments((prev) => [...prev, { id: makeAttachmentId(file), name: file.name, size: file.size, file }]);
      }
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'file') {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    enqueueComposerFiles(
      kind === 'image' ? files.filter((file) => file.type.startsWith('image/')) : files,
      { previewImages: kind === 'image' },
    );
    e.target.value = '';
  }

  function isFileDrag(event: React.DragEvent<HTMLElement>): boolean {
    return Array.from(event.dataTransfer.types ?? []).includes('Files');
  }

  function handleComposerDragEnter(event: React.DragEvent<HTMLElement>) {
    if (!activeId || sending || !isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setDraggingFiles(true);
  }

  function handleComposerDragOver(event: React.DragEvent<HTMLElement>) {
    if (!activeId || sending || !isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleComposerDragLeave(event: React.DragEvent<HTMLElement>) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDraggingFiles(false);
  }

  function handleComposerDrop(event: React.DragEvent<HTMLElement>) {
    if (!activeId || sending || !isFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setDraggingFiles(false);
    enqueueComposerFiles(Array.from(event.dataTransfer.files ?? []), { previewImages: true });
  }

  return (
    <div className="im-page-root flex h-full min-h-0 w-full min-w-0 overflow-hidden bg-surface-1">

      {/* §Sprint1 搜索浮层 */}
      {showSearch && (
        <ImSearchOverlay
          channelId={activeId ?? undefined}
          nameOf={nameOf}
          onClose={() => setShowSearch(false)}
          onSelect={(chId, messageId) => {
            setShowSearch(false);
            router.push(`/im?ch=${chId}&msg=${messageId}`);
          }}
        />
      )}

      {/* §Sprint2 转发浮层 */}
      {forwardMessageIds && (
        <ImForwardOverlay
          meId={ME}
          messageIds={forwardMessageIds}
          onForwarded={(toChannelId) => {
            toast({ title: '已转发', description: '消息已转发到目标会话。' });
            if (toChannelId === activeId) refreshMessages(activeId);
          }}
          onClose={() => setForwardMessageIds(null)}
        />
      )}

      {selectedProfileUser && (
        <MemberProfileCard
          user={selectedProfileUser}
          departmentName={selectedProfileUser.departmentId ? departmentNames.get(selectedProfileUser.departmentId) : undefined}
          onClose={() => setSelectedProfileUser(null)}
          onStartDm={(userId) => {
            setSelectedProfileUser(null);
            void startDmWith(userId);
          }}
        />
      )}

      {/* 消息流 + 右侧详情面板 并排容器 */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* 移动端: 未选中会话时全屏"消息选择页" (桌面端会话列表在 SubSidebar) */}
      {!activeId && (
        <div className="flex h-full w-full flex-col bg-surface-1 md:hidden">
          <Suspense fallback={null}>
            <ImSidebar />
          </Suspense>
        </div>
      )}
      <main
        onDragEnter={handleComposerDragEnter}
        onDragOver={handleComposerDragOver}
        onDragLeave={handleComposerDragLeave}
        onDrop={handleComposerDrop}
        className={cn(
          'relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-surface-1',
          // 移动端未选会话时让位给上面的会话列表
          !activeId && 'hidden md:flex',
        )}
      >
        {draggingFiles && activeChannel && (
          <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/80 text-[13px] font-medium text-brand-700 shadow-soft-sm backdrop-blur-sm">
            松开添加附件
          </div>
        )}
        {activeChannel ? (
          <>
            {/* 顶部栏 */}
            <header className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-hairline bg-surface-1 px-3 py-2.5 sm:px-4 sm:py-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={closeActiveChat}
                  className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-3 md:hidden"
                  aria-label="返回消息列表"
                  title="返回消息列表"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <ConvAvatar
                  channel={activeChannel}
                  name={activeChannelDisplayName}
                />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink-primary">
                    {activeChannelDisplayName}
                  </div>
                  {displayImChannelTopic(activeChannel) && (
                    <div className="truncate text-[12px] text-ink-secondary">{displayImChannelTopic(activeChannel)}</div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AgentModeToggle
                  channelId={activeChannel.id}
                  initialMode={members.find((m) => m.userId === ME)?.agentMode ?? 'manual'}
                />
                <button
                  type="button"
                  onClick={() => setShowSearch(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-3"
                  title="搜索消息"
                >
                  <Search className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary hover:bg-surface-3"
                  title="频道设置"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* 公告条 */}
            {activeChannel.announcement && (
              <div className="flex shrink-0 items-center gap-2 border-b border-hairline bg-brand-50 px-4 py-2 text-[12px]">
                <Megaphone className="h-3.5 w-3.5 shrink-0 text-warning" />
                <span className="flex-1 truncate text-ink-primary">{activeChannel.announcement}</span>
              </div>
            )}

            {/* 置顶条 */}
            {(activeChannel.pinnedMessageIds ?? []).length > 0 && (
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="flex shrink-0 items-center gap-1.5 border-b border-hairline bg-surface-3 px-4 py-1.5 text-[12px] text-ink-secondary hover:bg-surface-3"
              >
                <Pin className="h-3 w-3 text-warning" />
                {(activeChannel.pinnedMessageIds ?? []).length} 条置顶消息
              </button>
            )}

            {/* 消息流 */}
            <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop < 60 && hasMoreOlder && !loadingOlderRef.current) {
                  void loadOlderMessages();
                }
                // §B5 追踪贴底态, 贴底则清零新消息计数
                const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
                setAtBottom((prev) => (prev === nearBottom ? prev : nearBottom));
                if (nearBottom) setNewMsgCount((n) => (n === 0 ? n : 0));
              }}
              className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
            >
              {/* §B2 历史加载提示 */}
              {loadingOlder && (
                <div className="flex items-center justify-center py-2 text-[11px] text-ink-tertiary">加载更早消息…</div>
              )}
              {!hasMoreOlder && messages.length >= INITIAL_PAGE && (
                <div className="flex items-center justify-center py-2 text-[11px] text-ink-tertiary">已到最早</div>
              )}
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-tertiary">
                  <div className="text-[32px]">💬</div>
                  <p className="text-[13px]">还没有消息，发一条试试</p>
                  <p className="text-[11px] text-ink-tertiary">hover 消息可<span className="text-warning font-medium mx-0.5">开议事室</span>或<span className="text-brand-600 font-medium mx-0.5">沉淀 Memory</span></p>
                </div>
              )}
              {messages.map((m, idx) => {
                const prevMsg = messages[idx - 1] ?? null;
                const showDateDivider = shouldShowImDateDivider(prevMsg?.createdAt, m.createdAt);
                return (
                <div key={m.id}>
                  {/* §B4 跨天日期分割线 */}
                  {showDateDivider && (
                    <div className="my-3 flex items-center justify-center">
                      <span className="rounded-full bg-surface-3 px-3 py-0.5 text-[11px] text-ink-tertiary">
                        {formatImDateDivider(m.createdAt)}
                      </span>
                    </div>
                  )}
                  <div
                    id={`im-msg-${m.id}`}
                    className={cn(
                      'scroll-mt-4 rounded-lg transition-colors',
                      highlightId === m.id && 'bg-warning/10 ring-1 ring-warning/40',
                    )}
                  >
                  <MessageRowMemo
                    msg={m}
                    prev={prevMsg}
                    quotedMessage={m.parentMessageId ? quotedMessagesById.get(m.parentMessageId) ?? null : null}
                    members={members}
                    meId={ME}
                    nameOf={nameOf}
                    isPinned={(activeChannel.pinnedMessageIds ?? []).includes(m.id)}
                    onSpawnRoom={spawnRoom}
                    onPromote={promoteToMemory}
                    onRecall={recallMessageHandler}
                    recalling={recallingIds.has(m.id)}
                    onForward={handleForward}
                    onQuote={handleQuote}
                    onPin={togglePinHandler}
                    onMentionPersona={summonPersona}
                    onOpenMemberProfile={openMemberProfile}
                    onReactionChange={handleReactionChange}
                  />
                  </div>
                </div>
                );
              })}
            </div>
            {/* §B5 回到最新 · N 条新消息 悬浮按钮 (仅未贴底时显示) */}
            {!atBottom && (
              <button
                type="button"
                onClick={() => scrollToBottom()}
                className="absolute bottom-3 right-4 z-10 flex items-center gap-1 rounded-full border border-hairline bg-surface-1 px-3 py-1.5 text-[12px] font-medium text-ink-secondary shadow-soft-lg transition hover:bg-surface-2"
                title="回到最新消息"
              >
                {newMsgCount > 0 ? `${newMsgCount} 条新消息` : '回到最新'}
                <span aria-hidden className="text-brand-600">↓</span>
              </button>
            )}
            </div>

            {/* §B1 正在输入指示 */}
            {typingIds.length > 0 && (
              <div className="shrink-0 px-4 pb-1 text-[11px] text-ink-tertiary">
                {typingIds.map((id) => nameOf(id) || shortUserId(id)).join('、')} 正在输入…
              </div>
            )}

            {/* 输入区 */}
            <footer className="im-composer-bar shrink-0 border-t border-hairline bg-surface-1 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] md:shadow-none">
              {/* 引用预览条 */}
              {quotedMessage && (
                <div className="px-4 pt-2">
                  <div className="flex min-w-0 items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2">
                    <Quote className="h-3.5 w-3.5 shrink-0 text-ink-tertiary" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-ink-secondary">
                        引用 {nameOf(quotedMessage.senderId)}
                      </div>
                      <div className="truncate text-[12px] text-ink-tertiary">
                        {messageQuotePreview(quotedMessage)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuotedMessage(null)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-tertiary transition hover:bg-surface-3 hover:text-ink-primary"
                      title="取消引用"
                      aria-label="取消引用"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* 附件预览条 */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-2">
                  {attachments.map((a) => {
                    const progress = a.uploadProgress ?? 0;
                    const isUploading = a.uploadStatus === 'queued' || a.uploadStatus === 'uploading';
                    const isError = a.uploadStatus === 'error';
                    return (
                      <div key={a.id} className="group relative overflow-hidden rounded-lg border border-hairline bg-surface-3 px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded">
                            {a.dataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.dataUrl} alt={a.name} className="h-8 w-8 object-cover" />
                            ) : (
                              <Paperclip className="h-4 w-4 text-ink-tertiary" />
                            )}
                            {isUploading && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/35 text-[10px] font-semibold text-white">
                                {progress}%
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="max-w-[120px] truncate text-[11px] text-ink-primary">{a.name}</div>
                            {(isUploading || isError) && (
                              <div className={cn('text-[10px]', isError ? 'text-danger' : 'text-ink-tertiary')}>
                                {isError ? '上传失败' : `上传中 ${progress}%`}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== a.id))}
                            className="ml-0.5 text-ink-tertiary hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {isUploading && (
                          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-surface-4">
                            <div className="h-full bg-brand-500 transition-[width] duration-150" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 工具条 */}
              <div className="flex min-w-0 items-center gap-0.5 overflow-visible px-3 pt-2">
                {/* 表情 */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
                    title="表情"
                  >
                    <Smile className="h-4 w-4" />
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onPick={(emoji) => {
                        setInput((cur) => cur + emoji);
                        setShowEmojiPicker(false);
                        composerRef.current?.focus();
                      }}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>

                {/* 图片 */}
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
                  title="图片"
                >
                  <Image className="h-4 w-4" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, 'image')}
                />

                {/* 文件 */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
                  title="文件"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, 'file')}
                />

                {/* 语音转文字 */}
                <ImVoiceComposerButton
                  onText={insertVoiceText}
                  disabled={sending}
                  className="h-8 w-8 rounded-md"
                />

                {/* §Sprint2 语音消息 (发送语音条) */}
                {activeId && (
                  <ImVoiceMessageButton
                    channelId={activeId}
                    disabled={sending}
                    onSent={() => refreshMessages(activeId)}
                  />
                )}

              </div>

              {/* 身份选择器 + 输入框 + 发送 */}
              <div className="flex min-w-0 items-end gap-2 px-3 pb-[calc(10px+var(--capacitor-safe-area-bottom,env(safe-area-inset-bottom,0px)))] pt-1.5 md:pb-3">

                {/* 身份切换器 */}
                <div ref={identityPickerRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowIdentityPicker((v) => !v)}
                    className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition ${
                      sendAsAgent
                        ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
                        : 'border-hairline bg-surface-3 text-ink-primary hover:bg-surface-3'
                    }`}
                  >
                    {sendAsAgent
                      ? <Bot className="h-3.5 w-3.5 shrink-0" />
                      : <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white bg-gradient-to-br from-warning/30 to-warning`}>{myAvatarText}</span>
                    }
                    <span className="hidden sm:inline">{sendAsAgent ? 'AI 分身' : '真人'}</span>
                    <svg className="h-3 w-3 shrink-0 text-current opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                  </button>

                  {showIdentityPicker && (
                    <IdentityPickerDropdown
                      meId={ME}
                      meName={myDisplayName}
                      meEmail={user?.email ?? undefined}
                      meAvatarText={myAvatarText}
                      sendAsAgent={sendAsAgent}
                      onSelect={(asAgent) => { setSendAsAgent(asAgent); setShowIdentityPicker(false); composerRef.current?.focus(); }}
                      onClose={() => setShowIdentityPicker(false)}
                      containerRef={identityPickerRef}
                    />
                  )}
                </div>

                <div className="flex min-h-9 max-h-[132px] min-w-0 flex-1 items-end rounded-lg border border-hairline bg-surface-1 px-3 py-1 transition focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-100">
                  <ImComposerInput
                    composerRef={composerRef}
                    value={input}
                    setValue={setInput}
                    members={members}
                    meId={ME}
                    nameOf={nameOf}
                    onEnter={() => void sendMessage()}
                    onTextChange={handleComposerTextChange}
                    onMentionInserted={handlePersonMentionInserted}
                    onPasteFiles={queuePastedFiles}
                    disabled={sending || !ME}
                    placeholder={sendAsAgent ? '以 AI 分身身份发言...' : '发送消息，输入 @ 选择人员（可直接粘贴图片/文件）...'}
                  />
                </div>
                <Button
                  onClick={sendMessage}
                  disabled={sending || !ME || (!input.trim() && attachments.length === 0)}
                  className="h-9 shrink-0 gap-1 rounded-lg bg-brand-600 px-3 text-[13px] text-white transition hover:bg-brand-700 disabled:!bg-brand-600 disabled:!text-white disabled:!opacity-100 sm:px-4"
                >
                  <Send className="h-3.5 w-3.5" />
                  发送
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-tertiary">
            <div className="text-[40px]">💬</div>
            <p className="text-[14px] font-medium text-ink-secondary">选一个会话开始聊天</p>
            <p className="text-[12px] text-ink-tertiary">左侧选择会话，或点 + 新建</p>
          </div>
        )}
      </main>

      {/* 右侧详情面板 */}
      {showSettings && activeChannel && (
        <ChannelDetailPanel
          channel={activeChannel}
          currentUserId={ME}
          onClose={() => setShowSettings(false)}
          onDissolve={closeActiveChat}
          onLeft={closeActiveChat}
          onChanged={() => {
            if (!activeId) return;
            void fetch(`/api/im/channels?userId=${ME}`)
              .then((r) => r.json())
              .then((data) => {
                const ch = (data.channels ?? []).find((c: Channel) => c.id === activeId) ?? null;
                setActiveChannel(ch);
              });
          }}
        />
      )}
      </div>
    </div>
  );
}

function ConvAvatar({ channel, name }: { channel: Channel; name: string }) {
  const palette = [
    'from-warning/30 to-warning',
    'from-success/30 to-success',
    'from-info/30 to-info',
    'from-brand-400 to-brand-500',
    'from-brand-300 to-danger',
  ];
  if (channel.type === 'announcement') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-danger/30 to-danger text-white">
        <Megaphone className="h-5 w-5" />
      </div>
    );
  }
  if (channel.type === 'dm') {
    const idx = name.charCodeAt(0) % palette.length;
    return (
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${palette[idx]} text-[13px] font-semibold uppercase text-white`}>
        {name.slice(0, 2)}
      </div>
    );
  }
  if (channel.type === 'team') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-info/40 to-brand-500 text-white">
        <UsersRound className="h-5 w-5" />
      </div>
    );
  }
  if (channel.type === 'department') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-info/30 to-info text-white">
        <Building2 className="h-5 w-5" />
      </div>
    );
  }
  const idx = channel.id.charCodeAt(0) % palette.length;
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${palette[idx]} text-white`}>
      <Hash className="h-5 w-5" />
    </div>
  );
}

function IdentityPickerDropdown({
  meId,
  meName,
  meEmail,
  meAvatarText,
  sendAsAgent,
  onSelect,
  onClose,
  containerRef,
}: {
  meId: string;
  meName: string;
  meEmail?: string;
  meAvatarText: string;
  sendAsAgent: boolean;
  onSelect: (asAgent: boolean) => void;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, containerRef]);

  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-2xl border border-hairline bg-surface-2 shadow-soft-lg">
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary border-b border-hairline">
        以哪个身份发言
      </div>
      <button
        type="button"
        onClick={() => onSelect(false)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-surface-3 ${!sendAsAgent ? 'bg-surface-3' : ''}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-warning/30 to-warning text-[11px] font-bold text-white">
          {meAvatarText}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink-primary truncate" title={meName}>{meName}</div>
          <div className="text-[11px] text-ink-secondary truncate" title={meEmail ?? meId}>
            真人 · {meEmail ?? '以我自己的身份发言'}
          </div>
        </div>
        {!sendAsAgent && <span className="h-2 w-2 shrink-0 rounded-full bg-success/30" />}
      </button>
      <button
        type="button"
        onClick={() => onSelect(true)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-brand-50 ${sendAsAgent ? 'bg-brand-50' : ''}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-500 text-white">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-brand-700">AI 分身</div>
          <div className="text-[11px] text-brand-700">让我的分身代我在群里发言</div>
        </div>
        {sendAsAgent && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-400" />}
      </button>
    </div>
  );
}

const EMOJI_LIST = [
  '😀','😂','🤣','😊','😍','🥰','😎','🤔','😅','😭',
  '😱','🙄','😏','😢','😡','🥳','🤩','😴','🤗','🤭',
  '👍','👎','👏','🙌','🤝','✌️','💪','🫡','🙏','👋',
  '❤️','🧡','💛','💚','💙','💜','🖤','💯','🔥','✨',
  '🎉','🎊','🎁','🏆','⭐','🌟','💡','📌','✅','❌',
];

function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="absolute bottom-10 left-0 z-[70] w-64 max-w-[calc(100vw-24px)] rounded-2xl border border-hairline bg-surface-2 p-2 shadow-soft-lg"
    >
      <div className="grid grid-cols-10 gap-0.5">
        {EMOJI_LIST.map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => onPick(em)}
            className="flex h-7 w-7 items-center justify-center rounded text-[16px] hover:bg-surface-3"
          >
            {em}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentExt(name?: string): string {
  return (name?.split('.').pop() ?? '').toLowerCase();
}

/** §Sprint2 语音条时长 mm:ss */
function formatAudioDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function isMarkdownPreview(name?: string, mimeType?: string): boolean {
  const ext = attachmentExt(name);
  const mime = (mimeType ?? '').toLowerCase();
  return ext === 'md' || ext === 'markdown' || mime.includes('markdown');
}

function isTextPreview(name?: string, mimeType?: string): boolean {
  const ext = attachmentExt(name);
  const mime = (mimeType ?? '').toLowerCase();
  return (
    mime.startsWith('text/') ||
    mime.includes('json') ||
    ['txt', 'md', 'markdown', 'json', 'csv', 'log', 'yaml', 'yml', 'xml'].includes(ext)
  );
}

function isPdfPreview(name?: string, mimeType?: string): boolean {
  return attachmentExt(name) === 'pdf' || (mimeType ?? '').toLowerCase().includes('pdf');
}

function isOfficeFile(name?: string, mimeType?: string): boolean {
  const ext = attachmentExt(name);
  const mime = (mimeType ?? '').toLowerCase();
  return (
    ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext) ||
    mime.includes('officedocument') ||
    mime.includes('msword') ||
    mime.includes('powerpoint') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet')
  );
}

function isOfficePreviewable(name?: string, mimeType?: string): boolean {
  const ext = attachmentExt(name);
  const mime = (mimeType ?? '').toLowerCase();
  return (
    ['docx', 'pptx', 'xlsx'].includes(ext) ||
    mime.includes('officedocument.wordprocessingml') ||
    mime.includes('officedocument.presentationml') ||
    mime.includes('officedocument.spreadsheetml')
  );
}

function previewContentType(name?: string, mimeType?: string): string | undefined {
  if (isMarkdownPreview(name, mimeType)) return 'text/markdown; charset=utf-8';
  if (isTextPreview(name, mimeType)) return 'text/plain; charset=utf-8';
  if (isPdfPreview(name, mimeType)) return 'application/pdf';
  return mimeType || undefined;
}

function fileViewerType(name?: string, mimeType?: string): string | undefined {
  const ext = attachmentExt(name);
  if (ext) return ext;
  return mimeType || undefined;
}

function FilePreviewModal({
  url,
  downloadUrl,
  name,
  mimeType,
  fileViewerPreview,
  size,
  onClose,
}: {
  url: string;
  downloadUrl?: string | null;
  name?: string;
  mimeType?: string;
  fileViewerPreview?: boolean;
  size?: number;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [officeBuffer, setOfficeBuffer] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textLike = isTextPreview(name, mimeType);
  const markdown = isMarkdownPreview(name, mimeType);
  const pdf = isPdfPreview(name, mimeType);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    if (!textLike) return;
    const controller = new AbortController();
    setText(null);
    setError(null);
    void fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`预览失败 (${res.status})`);
        const buffer = await res.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
      })
      .then(setText)
      .catch((err) => {
        if (!controller.signal.aborted) setError((err as Error).message || '预览失败');
      });
    return () => controller.abort();
  }, [textLike, url]);

  useEffect(() => {
    if (!fileViewerPreview) return;
    const controller = new AbortController();
    setOfficeBuffer(null);
    setError(null);
    void fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('当前本地服务无法读取该附件，请确认对象存储配置后再预览');
          }
          throw new Error(`预览失败 (${res.status})`);
        }
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (!controller.signal.aborted) setOfficeBuffer(buffer);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError((err as Error).message || '预览失败');
      });
    return () => controller.abort();
  }, [fileViewerPreview, url]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/70 p-3 backdrop-blur-sm md:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-surface-1 shadow-2xl" onClick={stop}>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-hairline px-3">
          <FileText className="h-4 w-4 shrink-0 text-ink-tertiary" />
          <div className="min-w-0 flex-1 truncate text-caption font-semibold text-ink-primary">{name ?? '附件预览'}</div>
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download={name}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition hover:bg-surface-3 hover:text-ink-primary"
              title="下载"
            >
              <Download className="h-4 w-4" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary transition hover:bg-surface-3 hover:text-ink-primary"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {fileViewerPreview ? (
            error ? (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 p-6 text-center">
                <FileText className="h-8 w-8 text-ink-tertiary" />
                <div className="text-caption font-medium text-danger">{error}</div>
                <div className="text-footnote text-ink-tertiary">如果部署环境可以查看，请同步本地对象存储配置后再测试 localhost。</div>
              </div>
            ) : officeBuffer === null ? (
              <div className="p-6 text-caption text-ink-tertiary">正在加载预览...</div>
            ) : (
              <OfficeFileViewer
                url={url}
                buffer={officeBuffer}
                name={name}
                filename={name}
                type={fileViewerType(name, mimeType)}
                size={size}
                className="h-full min-h-[70vh] w-full"
                style={{ height: '100%' }}
                options={{
                  preset: officePreset,
                  rendererMode: 'replace',
                  theme: 'light',
                  toolbar: { position: 'top' },
                  download: false,
                }}
              />
            )
          ) : textLike ? (
            error ? (
              <div className="p-6 text-caption text-danger">{error}</div>
            ) : text === null ? (
              <div className="p-6 text-caption text-ink-tertiary">正在加载预览...</div>
            ) : markdown ? (
              <article className="prose prose-slate max-w-none p-6 prose-sm prose-headings:text-ink-primary prose-p:text-ink-secondary prose-table:block prose-table:max-w-full prose-table:overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
              </article>
            ) : (
              <pre className="min-h-full whitespace-pre-wrap break-words p-6 font-mono text-[12px] leading-relaxed text-ink-primary">{text}</pre>
            )
          ) : pdf ? (
            <iframe src={url} title={name ?? '附件预览'} className="h-full min-h-[70vh] w-full" />
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-8 w-8 text-ink-tertiary" />
              <div className="text-caption font-medium text-ink-primary">此类型暂不支持内嵌预览</div>
              <div className="text-footnote text-ink-tertiary">可以先下载到本地查看。</div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 图片灯箱. 通过 portal 挂到 document.body, 避免被带 transform/backdrop-filter
 * 的祖先约束导致 fixed 不铺满视口. 支持滚轮/按钮缩放、复位、下载、打开原图.
 */
function ImageLightbox({ url, name, onClose }: { url: string; name?: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const clamp = (v: number) => Math.min(6, Math.max(0.2, +v.toFixed(2)));
  const zoomIn = () => setScale((s) => clamp(s + 0.25));
  const zoomOut = () => setScale((s) => clamp(s - 0.25));
  const reset = () => setScale(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === '+' || e.key === '=') zoomIn();
      else if (e.key === '-') zoomOut();
      else if (e.key === '0') reset();
    };
    window.addEventListener('keydown', onKey);
    // 打开时锁滚动
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* 关闭 */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="关闭预览 (Esc)"
        title="关闭 (Esc)"
      >
        <X className="h-5 w-5" />
      </button>

      {/* 图片区: 滚轮缩放 */}
      <div
        className="flex flex-1 items-center justify-center overflow-auto p-8"
        onClick={onClose}
        onWheel={(e) => (e.deltaY < 0 ? zoomIn() : zoomOut())}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={name ?? '图片'}
          onClick={stop}
          style={{ transform: `scale(${scale})` }}
          className="max-h-[85vh] max-w-[90vw] origin-center rounded-lg object-contain shadow-2xl transition-transform duration-fast"
        />
      </div>

      {/* 底部功能条 */}
      <div
        className="flex shrink-0 items-center justify-center gap-1.5 pb-6"
        onClick={stop}
      >
        <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1.5 text-white backdrop-blur">
          <button type="button" onClick={zoomOut} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/20" title="缩小 ( - )">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={reset} className="min-w-[52px] rounded-full px-2 text-[12px] tabular-nums transition hover:bg-white/20" title="复位 ( 0 )">
            {Math.round(scale * 100)}%
          </button>
          <button type="button" onClick={zoomIn} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/20" title="放大 ( + )">
            <ZoomIn className="h-4 w-4" />
          </button>
          <span className="mx-1 h-4 w-px bg-white/20" />
          <button type="button" onClick={reset} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/20" title="复位">
            <RefreshCw className="h-4 w-4" />
          </button>
          <a href={url} download={name} onClick={stop} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-white/20" title="下载原图">
            <Download className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 渲染单个附件. 图片/文件的实际字节存在对象存储, 这里通过 IM 预签名端点
 * (mode: download) 按需换取短期 GET URL. 无 refId 时降级为文件名标签.
 */
function AttachmentView({ channelId, att }: { channelId: string; att: ImAttachment }) {
  const [url, setUrl] = useState<string | null>(att.url ?? null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(att.url ?? null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const contentType = previewContentType(att.name, att.mimeType);
  const officePreviewable = isOfficePreviewable(att.name, att.mimeType);

  useEffect(() => {
    if (att.url || !att.refId) return;
    let cancelled = false;
    setStatus('loading');
    setAttachmentError(null);
    void fetch(`/api/im/channels/${channelId}/attachments/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'download',
        storageKey: att.refId,
        fileName: att.name,
        contentType,
      }),
    })
      .then(async (r) => {
        if (r.ok) return r.json();
        const data = await r.json().catch(() => ({}));
        throw new Error(data.error ?? `附件加载失败 (${r.status})`);
      })
      .then((data) => {
        if (!cancelled) {
          setUrl(data.previewUrl ?? data.url);
          setDownloadUrl(data.downloadUrl ?? data.url);
          setStatus('idle');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAttachmentError((err as Error).message || '附件加载失败');
          setStatus('error');
        }
      });
    return () => { cancelled = true; };
  }, [channelId, att.url, att.refId, att.name, contentType]);

  if (att.uploadStatus === 'pending' || att.uploadStatus === 'uploading') {
    return (
      <div className="flex min-w-[160px] items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-[12px] text-ink-secondary">
        <Paperclip className="h-4 w-4 shrink-0 text-ink-tertiary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-ink-primary">{att.name ?? '附件'}</div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-4">
            <div className="h-full bg-brand-500" style={{ width: `${att.uploadProgress ?? 0}%` }} />
          </div>
          <div className="mt-0.5 text-[10px] text-ink-tertiary">上传中 {att.uploadProgress ?? 0}%</div>
        </div>
      </div>
    );
  }

  if (att.uploadStatus === 'error') {
    return (
      <div className="flex min-w-[160px] items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12px] text-danger">
        <Paperclip className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <div className="truncate">{att.name ?? '附件'}</div>
          <div className="text-[10px]">上传失败{att.uploadError ? `: ${att.uploadError}` : ''}</div>
        </div>
      </div>
    );
  }

  if (att.kind === 'image') {
    if (status === 'error') {
      return (
        <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-hairline bg-surface-3 text-[11px] text-ink-tertiary">
          {attachmentError ?? '图片加载失败'}
        </div>
      );
    }
    if (!url) {
      return <div className="h-24 w-24 animate-pulse rounded-lg bg-surface-3" />;
    }
    return (
      <>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className="block cursor-zoom-in overflow-hidden rounded-lg border border-hairline transition hover:opacity-90"
          title="点击查看大图"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={att.name ?? '图片'}
            loading="lazy"
            decoding="async"
            className="max-h-56 max-w-[220px] object-cover"
          />
        </button>
        {preview && (
          <ImageLightbox url={url} name={att.name} onClose={() => setPreview(false)} />
        )}
      </>
    );
  }

  // §Sprint2 语音条: 走 refId → presign download 拿短期 URL, 原生 <audio> 播放。
  if (att.kind === 'audio') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2">
        {url ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls src={url} className="h-8 max-w-[240px]" />
        ) : (
          <div className="h-8 w-40 animate-pulse rounded-md bg-surface-3" />
        )}
        {att.durationSec ? (
          <span className="shrink-0 text-[11px] text-ink-tertiary">
            {formatAudioDuration(att.durationSec)}
          </span>
        ) : null}
      </div>
    );
  }

  // §Sprint2 合并转发: 只读快照卡片。
  if (att.kind === 'forward') {
    const items = att.forwardedItems ?? [];
    return (
      <div className="max-w-[280px] rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-[12px]">
        <div className="mb-1 text-[11px] font-medium text-ink-tertiary">
          合并转发 · {items.length} 条消息
        </div>
        <div className="space-y-1">
          {items.slice(0, 4).map((it) => (
            <div key={it.messageId} className="flex gap-1.5">
              <span className="shrink-0 text-ink-secondary">{it.senderName ?? it.senderId}:</span>
              <span className="truncate text-ink-primary">{it.body || '[非文本消息]'}</span>
            </div>
          ))}
          {items.length > 4 && (
            <div className="text-[11px] text-ink-tertiary">…等 {items.length} 条</div>
          )}
        </div>
      </div>
    );
  }

  const canPreview = isTextPreview(att.name, att.mimeType) || isPdfPreview(att.name, att.mimeType) || officePreviewable;
  const officeFile = isOfficeFile(att.name, att.mimeType);
  const disabled = !url || status === 'loading' || status === 'error';
  const previewDisabled = disabled || !canPreview;
  const secondaryLabel = status === 'loading'
    ? '加载中'
    : status === 'error'
    ? attachmentError ?? '加载失败'
    : officePreviewable
    ? 'Office 文件 · 可预览'
    : officeFile
    ? 'Office 文件 · 下载查看'
    : canPreview
    ? formatSize(att.size) || '可预览'
    : '下载查看';
  return (
    <>
      <div
        className={`flex min-w-[220px] max-w-[280px] items-center gap-2 rounded-lg border border-hairline bg-surface-2 px-3 py-2 text-[12px] transition hover:bg-surface-3 ${
          disabled ? 'opacity-70' : ''
        }`}
      >
        <FileText className="h-4 w-4 shrink-0 text-ink-tertiary" />
        <button
          type="button"
          onClick={() => {
            if (canPreview && !disabled) setPreview(true);
          }}
          disabled={disabled}
          className="min-w-0 flex-1 text-left disabled:cursor-default"
          title={canPreview ? '预览' : '此类型需下载查看'}
        >
          <div className="truncate text-ink-primary">{att.name ?? '附件'}</div>
          <div className="text-[10px] text-ink-tertiary">{secondaryLabel}</div>
        </button>
        <button
          type="button"
          onClick={() => { if (!previewDisabled) setPreview(true); }}
          disabled={previewDisabled}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-secondary transition hover:bg-surface-4 hover:text-ink-primary disabled:pointer-events-none disabled:opacity-35"
          title={canPreview ? '预览' : '此类型需配置 Office 转 PDF 服务后才能预览'}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <a
          href={downloadUrl ?? url ?? undefined}
          download={att.name}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-secondary transition hover:bg-surface-4 hover:text-ink-primary ${
            downloadUrl || url ? '' : 'pointer-events-none opacity-40'
          }`}
          title="下载"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>
      {preview && url ? (
        <FilePreviewModal
          url={url}
          downloadUrl={downloadUrl}
          name={att.name}
          mimeType={att.mimeType}
          size={att.size}
          fileViewerPreview={officePreviewable}
          onClose={() => setPreview(false)}
        />
      ) : null}
    </>
  );
}

// §#2 perf: memo 化行组件 — 只在自身 data props 变化时重渲染。
// 配合上方稳定 useCallback 回调, 打字/typing/降级轮询等父重渲染不再连带刷全列 200 行。
const MessageRowMemo = memo(MessageRow);

function MessageRow({
  msg,
  prev,
  quotedMessage,
  members,
  isPinned,
  meId,
  nameOf,
  onSpawnRoom,
  onPromote,
  onRecall,
  recalling,
  onForward,
  onQuote,
  onPin,
  onMentionPersona,
  onOpenMemberProfile,
  onReactionChange,
}: {
  msg: Message;
  prev: Message | null;
  quotedMessage: Message | null;
  members: ImMembership[];
  isPinned: boolean;
  meId: string;
  nameOf: (id: string | null | undefined) => string;
  onSpawnRoom: (id: string) => void;
  onPromote: (id: string) => void;
  onRecall: (id: string) => void;
  recalling: boolean;
  onForward: (id: string) => void;
  onQuote: (id: string) => void;
  onPin: (id: string) => void;
  onMentionPersona: (userId: string) => void;
  onOpenMemberProfile: (userId: string) => void;
  onReactionChange: (id: string, reactions: Record<string, string[]>) => void;
}) {
  // Day 4: 已读人数 (除发送者外, lastReadAt >= msg.createdAt 的成员)
  const readReceipt = getImReadReceiptSummary(msg, members);
  const { readers, unreadMembers, readerCount, totalReaders } = readReceipt;
  const readReceiptLabel = readerCount === totalReaders
    ? '全部已读'
    : `${readerCount}/${totalReaders} 已读`;
  const readReceiptSummaryRef = useRef<HTMLButtonElement>(null);
  const readReceiptContainerRef = useRef<HTMLDivElement>(null);
  const [readReceiptOpen, setReadReceiptOpen] = useState(false);
  const [readReceiptDirection, setReadReceiptDirection] = useState<ImPopupDirection>('up');
  const updateReadReceiptDirection = useCallback(() => {
    const trigger = readReceiptSummaryRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setReadReceiptDirection(chooseImPopupDirection({
      triggerTop: rect.top,
      triggerBottom: rect.bottom,
      viewportHeight: window.innerHeight,
      panelHeight: 184,
    }));
  }, []);
  useEffect(() => {
    setReadReceiptOpen(false);
  }, [msg.id]);
  useEffect(() => {
    if (!readReceiptOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const container = readReceiptContainerRef.current;
      if (!container || container.contains(event.target as Node)) return;
      setReadReceiptOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setReadReceiptOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [readReceiptOpen]);
  // Day 4: recallable 用 Date.now(), SSR 和 CSR 时间不同会 hydration mismatch
  // → useState + useEffect 只在客户端 mount 后计算
  const [recallable, setRecallable] = useState(false);
  const [reactionOpen, setReactionOpen] = useState(false);
  const [reactionHover, setReactionHover] = useState(false);
  useEffect(() => {
    if (msg.deletedAt || msg.senderId !== meId) { setRecallable(false); return; }
    const ageMs = Date.now() - new Date(msg.createdAt).getTime();
    const remaining = 2 * 60 * 1000 - ageMs;
    setRecallable(remaining > 0);
    if (remaining > 0) {
      const t = setTimeout(() => setRecallable(false), remaining);
      return () => clearTimeout(t);
    }
  }, [msg.id, msg.deletedAt, msg.senderId, msg.createdAt, meId]);
  const showSender =
    !prev ||
    prev.senderId !== msg.senderId ||
    prev.senderKind !== msg.senderKind ||
    new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() >
      5 * 60 * 1000;

  // Day 4: 撤回后显示占位
  if (msg.deletedAt) {
    return (
      <div className="my-2 flex justify-center text-[11px]">
        <div className="rounded-full border border-hairline bg-surface-3 px-3 py-1 text-ink-tertiary italic">
          {msg.senderId === meId ? '你' : nameOf(msg.senderId)} 撤回了一条消息
        </div>
      </div>
    );
  }

  if (msg.senderKind === 'system') {
    return (
      <div className="my-3 flex justify-center text-[11px]">
        <div className="im-mobile-break-anywhere max-w-full flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-3 py-1 text-ink-secondary shadow-soft-sm">
          <Info className="h-3 w-3 text-ink-tertiary" />
          {renderInline(msg.body, onMentionPersona)}
        </div>
      </div>
    );
  }

  const isPersona = msg.senderKind === 'persona';
  const isMe = msg.senderId === meId;
  const quotePreview = msg.parentMessageId
    ? quotedMessage
      ? messageQuotePreview(quotedMessage)
      : '引用的消息'
    : null;
  // 流式占位/正文任一存在才渲染气泡; 纯图片消息 (空正文 + 附件) 不显示空气泡
  const isStreamingBubble = isPersona && !!msg.aiTraceId?.startsWith('imtrace_cb_') && !msg.body.includes('— 🏛️ CompanyBrain');
  const showBubble = msg.body.trim().length > 0 || isStreamingBubble || !!quotePreview;

  return (
    <div className={`group flex w-full min-w-0 items-start gap-2 ${showSender ? 'mt-2 mb-0.5' : 'mb-0.5'} ${isMe ? 'flex-row-reverse' : ''}`}>
      {/* §B4 同人 5 分钟内分组: 续条隐藏头像, 用等宽占位保持对齐 */}
      {showSender ? (
        isPersona ? (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-500 text-[10px] font-semibold text-white shadow-soft-sm"
            title={nameOf(msg.senderId)}
          >
            <Bot className="h-4 w-4" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenMemberProfile(msg.senderId)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold shadow-soft-sm transition hover:ring-2 hover:ring-brand-400 hover:ring-offset-1 ${
              isMe
                ? 'bg-gradient-to-br from-warning/30 to-warning text-white'
                : 'bg-gradient-to-br from-surface-3 to-ink-tertiary text-white'
            }`}
            title={`${nameOf(msg.senderId)} · 查看资料`}
            aria-label={`查看 ${nameOf(msg.senderId)} 的资料`}
          >
            {nameOf(msg.senderId).slice(0, 2).toUpperCase()}
          </button>
        )
      ) : (
        <div className="h-1 w-8 shrink-0" aria-hidden />
      )}
      <div className={`flex max-w-[78%] min-w-0 flex-col sm:max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
        {showSender && (
          <div
            className={`mb-1 flex items-center gap-1.5 text-[10.5px] text-ink-secondary ${
              isMe ? 'justify-end' : ''
            }`}
          >
            <span className="font-medium text-ink-primary">{nameOf(msg.senderId)}</span>
            {isPersona && (
              <Badge
                variant="outline"
                className="h-4 border-brand-300 bg-brand-50 px-1 text-[9px] font-medium text-brand-700"
              >
                AI 分身
              </Badge>
            )}
            <span className="text-ink-tertiary">·</span>
            <span className="text-ink-tertiary">
              {formatImMessageTimestamp(msg.createdAt)}
            </span>
          </div>
        )}
        <div className={`relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
          {showBubble && (
          <div
            className={`im-mobile-break-anywhere inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-soft-sm ${
              isMe
                ? 'bg-gradient-to-br from-warning to-warning text-white'
                : isPersona
                ? 'border border-brand-200/80 bg-gradient-to-br from-brand-50 to-brand-50/40 text-brand-700'
                : 'bg-surface-2 text-ink-primary ring-1 ring-hairline'
            }`}
          >
            {quotePreview && (
              <div
                className={cn(
                  'mb-1.5 flex max-w-full items-start gap-1.5 rounded-md border-l-2 px-2 py-1.5 text-[11px] leading-snug',
                  isMe
                    ? 'border-white/60 bg-white/20 text-white/85'
                    : 'border-brand-300 bg-surface-1/80 text-ink-secondary',
                )}
              >
                <Quote className="mt-0.5 h-3 w-3 shrink-0 opacity-80" />
                <div className="min-w-0">
                  {quotedMessage && (
                    <div className={cn('truncate font-medium', isMe ? 'text-white' : 'text-ink-primary')}>
                      {nameOf(quotedMessage.senderId)}
                    </div>
                  )}
                  <div className="line-clamp-2 break-words">{quotePreview}</div>
                </div>
              </div>
            )}
            {(() => {
              /* §P1 流式打字气泡: CompanyBrain 消息在 footer marker 出现前显示闪烁光标 */
              const isCompanyBrain = isPersona && msg.aiTraceId?.startsWith('imtrace_cb_');
              const hasFooter = msg.body.includes('— 🏛️ CompanyBrain');
              const isStreaming = !!isCompanyBrain && !hasFooter;
              const bodyEmpty = msg.body.trim().length === 0;
              if (bodyEmpty && isStreaming) {
                // §SSE-UX: 优先显示后端分阶段进度文案 (statusText), 无则回退通用 "思考中"
                const statusLabel = msg.statusText?.trim() || 'CompanyBrain 思考中';
                return (
                  <span className="inline-flex items-center gap-1.5 text-brand-700/80">
                    <span className="text-[11px]">{statusLabel}</span>
                    <span className="inline-flex gap-0.5">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-brand-400" />
                    </span>
                  </span>
                );
              }
              return (
                <>
                  {renderInline(msg.body, onMentionPersona)}
                  {isStreaming && !bodyEmpty && (
                    <span className="ml-0.5 inline-block w-[6px] animate-pulse text-brand-700/70">▍</span>
                  )}
                </>
              );
            })()}
          </div>
          )}

          {/* 附件: 图片缩略图 / 文件卡片 (通过预签名端点按需换取 GET URL) */}
          {(msg.attachments ?? []).length > 0 && (
            <div className={`mt-1.5 flex flex-wrap gap-2 ${isMe ? 'justify-end' : ''}`}>
              {(msg.attachments ?? []).map((att, i) => (
                <AttachmentView key={i} channelId={msg.channelId} att={att} />
              ))}
            </div>
          )}

          {/* 差异化操作条: 保持浮层, 贴在气泡下方, 不参与消息排版 */}
          <div
            className={`pointer-events-none absolute top-full z-10 mt-1 hidden w-max max-w-none flex-nowrap items-center gap-1 whitespace-nowrap opacity-0 transition-all group-hover:pointer-events-auto group-hover:opacity-100 md:flex ${
              isMe ? 'right-0' : 'left-0'
            } ${
              reactionOpen || reactionHover ? 'invisible' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onSpawnRoom(msg.id)}
              disabled={!!msg.spawnedDecisionCardId}
              className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[11px] font-semibold leading-none text-warning shadow-soft ring-1 ring-warning/30 transition hover:bg-warning/10 hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-40"
              title="把这条消息变成议事室议题 (Tandem 差异化 — 普通 IM 没有)"
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>开议事室</span>
            </button>
            <button
              type="button"
              onClick={() => onPromote(msg.id)}
              disabled={!!msg.spawnedPromotionId}
              className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-700 shadow-soft ring-1 ring-brand-300/80 transition hover:bg-brand-50 hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-40"
              title="沉淀为 Memory 升级提议 (三级签批) — 差异化 §2.2 第 3 条"
            >
              <Brain className="h-3 w-3" />
              沉淀
            </button>
            {/* Day 7: pin/unpin */}
            <button
              type="button"
              onClick={() => onPin(msg.id)}
              className={`flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold shadow-soft transition hover:shadow-soft-lg ${
                isPinned ? 'text-warning ring-1 ring-warning/30 hover:bg-warning/10' : 'text-ink-secondary ring-1 ring-hairline hover:bg-surface-3'
              }`}
              title={isPinned ? '取消置顶' : '置顶 (最多 5 条)'}
            >
              <Pin className="h-3 w-3" />
              {isPinned ? '已顶' : '置顶'}
            </button>
            {/* §Sprint2 转发 */}
            {!msg.deletedAt && (
              <button
                type="button"
                onClick={() => onQuote(msg.id)}
                className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-secondary shadow-soft ring-1 ring-hairline transition hover:bg-surface-3 hover:shadow-soft-lg"
                title="引用这条消息"
              >
                <Quote className="h-3 w-3" />
                引用
              </button>
            )}
            {!msg.deletedAt && (
              <button
                type="button"
                onClick={() => onForward(msg.id)}
                className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-secondary shadow-soft ring-1 ring-hairline transition hover:bg-surface-3 hover:shadow-soft-lg"
                title="转发到其他会话"
              >
                <Forward className="h-3 w-3" />
                转发
              </button>
            )}
            {/* §IM-7: AI 回复透明化 trace 按钮 (仅 persona 消息) */}
            {isPersona && <AiTraceButton messageId={msg.id} />}
            {/* §CA-13: CompanyBrain Decision 反馈按钮 (仅 CompanyBrain 消息, 通过 aiTraceId 前缀判断) */}
            {isPersona && msg.aiTraceId?.startsWith('imtrace_cb_') && (
              <CompanyBrainFeedbackButtons messageId={msg.id} />
            )}
            {/* Day 4: 撤回 (仅本人 + 2 分钟内) */}
            {recallable && (
              <button
                type="button"
                onClick={() => onRecall(msg.id)}
                disabled={recalling}
                className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-danger shadow-soft ring-1 ring-danger/40 transition hover:bg-danger/5 hover:shadow-soft-lg"
                title="撤回 (2 分钟内 有效)"
              >
                <Trash2 className="h-3 w-3" />
                {recalling ? '撤回中' : '撤回'}
              </button>
            )}
          </div>
        </div>
        {/* 表情回应 (真闭环: /api/im/messages/:id/reactions 切换持久化到 ImMessage.reactions) */}
        <div
          className={isMe ? 'flex justify-end' : ''}
          onMouseEnter={() => setReactionHover(true)}
          onMouseLeave={() => setReactionHover(false)}
        >
          <MessageReactions
            messageId={msg.id}
            reactions={msg.reactions}
            currentUserId={meId}
            onChanged={(reactions) => onReactionChange(msg.id, reactions)}
            align={isMe ? 'right' : 'left'}
            onOpenChange={setReactionOpen}
          />
        </div>
        {/* Day 4: 已读人数 (仅我发的消息显示) */}
        {msg.senderId === meId && totalReaders > 0 && (
          <div ref={readReceiptContainerRef} className={`relative mt-1 text-[10px] text-ink-tertiary ${isMe ? 'self-end text-right' : ''}`}>
            <button
              type="button"
              ref={readReceiptSummaryRef}
              onClick={() => {
                updateReadReceiptDirection();
                setReadReceiptOpen((open) => !open);
              }}
              className={`inline-flex cursor-pointer list-none items-center gap-1 rounded-full px-1.5 py-0.5 transition hover:bg-surface-3 focus:outline-none focus:ring-1 focus:ring-brand-200 [&::-webkit-details-marker]:hidden ${isMe ? 'justify-end' : ''}`}
              aria-label={`${readReceiptLabel}，展开查看已读和未读人员`}
              aria-expanded={readReceiptOpen}
            >
              <UsersRound className="h-3 w-3" />
              {readReceiptLabel}
            </button>
            {readReceiptOpen && (
              <div
                data-im-read-receipt-panel="true"
                className={`absolute z-30 w-56 rounded-lg border border-hairline bg-surface-1 p-2 text-left shadow-soft-lg ${
                  readReceiptDirection === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
                } ${isMe ? 'right-0' : 'left-0'}`}
              >
                <ReadReceiptPeopleList title={`已读 ${readers.length}`} people={readers} nameOf={nameOf} emptyText="暂无已读" />
                <div className="my-1.5 h-px bg-hairline" />
                <ReadReceiptPeopleList title={`未读 ${unreadMembers.length}`} people={unreadMembers} nameOf={nameOf} emptyText="全部已读" />
              </div>
            )}
          </div>
        )}
        {/* spawned 状态 chip — 永久可见, 移到气泡下方独立行 (不再嵌进气泡). 比 inline link 更克制 */}
        {(msg.spawnedDecisionCardId || msg.spawnedPromotionId) && (
          <div
            className={`mt-1.5 flex flex-wrap gap-1 ${isMe ? 'justify-end' : ''}`}
          >
            {msg.spawnedDecisionCardId && (
              <Link
                href={`/convergence?id=${msg.spawnedDecisionCardId}`}
                className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/5 px-2 py-0.5 text-[10px] font-medium text-warning transition hover:bg-warning/10"
              >
                <Sparkles className="h-2.5 w-2.5" />
                议事室进行中
                <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            )}
            {msg.spawnedPromotionId && (
              <Link
                href={`/memories?promotionId=${msg.spawnedPromotionId}`}
                className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 transition hover:bg-brand-100"
              >
                <Brain className="h-2.5 w-2.5" />
                Memory 升级提议中
                <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadReceiptPeopleList({
  title,
  people,
  nameOf,
  emptyText,
}: {
  title: string;
  people: ImMembership[];
  nameOf: (id: string | null | undefined) => string;
  emptyText: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-ink-secondary">{title}</div>
      {people.length > 0 ? (
        <div className="max-h-28 space-y-1 overflow-auto pr-1">
          {people.map((m) => (
            <div key={m.userId} className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-primary">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[8px] font-semibold text-ink-secondary">
                {nameOf(m.userId).slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate">{nameOf(m.userId)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-ink-tertiary">{emptyText}</div>
      )}
    </div>
  );
}

/** 渲染消息体: 解析 @[name](userId:kind) 为高亮可点击 */
function renderInline(
  body: string,
  onMention: (userId: string) => void
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIdx) {
      parts.push(body.slice(lastIdx, m.index));
    }
    const [name, ref] = [m[1], m[2]];
    const [userId, kind = 'notify'] = ref.split(':');
    const cls =
      kind === 'persona'
        ? 'bg-brand-100 text-brand-700'
        : kind === 'assign'
        ? 'bg-danger/10 text-danger'
        : kind === 'consult'
        ? 'bg-info/10 text-info'
        : 'bg-surface-3 text-ink-primary';
    parts.push(
      <button
        key={key++}
        type="button"
        onClick={() => onMention(userId)}
        className={`mx-0.5 rounded px-1 text-[12px] font-medium hover:underline ${cls}`}
        title={kind === 'persona' ? '召唤 AI 分身' : `@${kind}: ${userId}`}
      >
        @{name}
        {kind !== 'notify' && (
          <sup className="ml-0.5 text-[8px] opacity-70">{kind}</sup>
        )}
      </button>
    );
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < body.length) parts.push(body.slice(lastIdx));
  return parts.length ? parts : body;
}

function ImComposerInput(props: {
  composerRef: React.RefObject<HTMLTextAreaElement>;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  members: ImMembership[];
  meId: string;
  nameOf: (id: string | null | undefined) => string;
  onEnter: () => void;
  onTextChange?: (previous: string, next: string) => void;
  onMentionInserted?: (mention: PendingPersonMention) => void;
  onPasteFiles?: (files: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const {
    composerRef,
    value,
    setValue,
    members,
    meId,
    nameOf,
    onEnter,
    onTextChange,
    onMentionInserted,
    onPasteFiles,
    disabled,
    placeholder,
  } = props;
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(-1);
  const [mentionActive, setMentionActive] = useState(0);
  const [mentionAnchor, setMentionAnchor] = useState<{ x: number; top: number; bottom: number } | undefined>();

  const closeMentionPicker = useCallback(() => {
    setMentionOpen(false);
    setMentionStart(-1);
    setMentionQuery('');
  }, []);

  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    return members
      .map((m) => ({ userId: m.userId, name: nameOf(m.userId) }))
      .filter((m) => m.userId !== meId)
      .filter((m) => (
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q)
      ))
      .slice(0, 8);
  }, [members, mentionQuery, meId, nameOf]);

  useEffect(() => {
    setMentionActive(0);
  }, [mentionQuery, mentionCandidates.length]);

  useEffect(() => {
    if (!value) closeMentionPicker();
  }, [closeMentionPicker, value]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = '0px';
    const nextHeight = Math.max(28, Math.min(el.scrollHeight, 120));
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden';
  }, [composerRef, value]);

  function updateMentionState(next: string, caret: number, target: HTMLTextAreaElement) {
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(next[i])) {
      if (next[i] === '@') {
        const query = next.slice(i + 1, caret);
        if (/^[A-Za-z0-9_\-\.\u4e00-\u9fff\u3040-\u30ff]*$/.test(query)) {
          const rect = target.getBoundingClientRect();
          setMentionStart(i);
          setMentionQuery(query);
          setMentionOpen(true);
          setMentionAnchor({ x: rect.left + 8, top: rect.top, bottom: rect.bottom });
          return;
        }
        break;
      }
      i--;
    }
    closeMentionPicker();
  }

  function insertPersonMention(person: { userId: string; name: string }) {
    if (mentionStart < 0) return;
    const caret = composerRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);
    const visibleMention = buildPersonMentionDisplay(person);
    const mentionText = visibleMention.trimEnd();
    const next = before + visibleMention + after;
    setValue(next);
    onTextChange?.(value, next);
    onMentionInserted?.({
      ...person,
      kind: 'notify',
      start: before.length,
      end: before.length + mentionText.length,
      text: mentionText,
    });
    closeMentionPicker();
    queueMicrotask(() => {
      const el = composerRef.current;
      if (!el) return;
      const pos = before.length + visibleMention.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <>
      <Textarea
        ref={composerRef}
        rows={1}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          onTextChange?.(value, next);
          updateMentionState(next, e.target.selectionStart ?? next.length, e.currentTarget);
        }}
        onPaste={(e) => {
          const items = e.clipboardData?.items;
          const fromFiles = Array.from(e.clipboardData?.files ?? []);
          const fromItems: File[] = [];
          if (items) {
            for (const it of Array.from(items)) {
              if (it.kind !== 'file') continue;
              const f = it.getAsFile();
              if (f) fromItems.push(f);
            }
          }
          const seen = new Set<string>();
          const files = [...fromFiles, ...fromItems].filter((file) => {
            const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          if (files.length > 0) {
            const pastedText = e.clipboardData.getData('text/plain');
            e.preventDefault();
            onPasteFiles?.(files);
            if (pastedText && files.every((file) => file.type.startsWith('image/'))) {
              const result = insertTextAtSelection(
                value,
                pastedText,
                e.currentTarget.selectionStart,
                e.currentTarget.selectionEnd,
              );
              setValue(result.value);
              onTextChange?.(value, result.value);
              queueMicrotask(() => {
                const el = composerRef.current;
                if (!el) return;
                el.focus();
                el.setSelectionRange(result.caret, result.caret);
              });
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (mentionOpen && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setMentionActive((idx) => Math.min(idx + 1, Math.max(mentionCandidates.length - 1, 0)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setMentionActive((idx) => Math.max(idx - 1, 0));
            } else if (e.key === 'Enter' || e.key === 'Tab') {
              const selected = mentionCandidates[mentionActive] ?? mentionCandidates[0];
              if (selected) {
                e.preventDefault();
                insertPersonMention(selected);
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                closeMentionPicker();
                onEnter();
              }
            } else if (e.key === 'Escape') {
              e.preventDefault();
              closeMentionPicker();
            }
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="max-h-[120px] min-h-7 min-w-0 resize-none overflow-y-hidden border-0 bg-transparent px-0 py-1 text-[13px] leading-5 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <PersonMentionPicker
        open={mentionOpen}
        query={mentionQuery}
        anchor={mentionAnchor}
        candidates={mentionCandidates}
        activeIndex={mentionActive}
        onActiveIndexChange={setMentionActive}
        onSelect={insertPersonMention}
      />
    </>
  );
}

function PersonMentionPicker({
  open,
  query,
  anchor,
  candidates,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}: {
  open: boolean;
  query: string;
  anchor?: { x: number; top: number; bottom: number };
  candidates: Array<{ userId: string; name: string }>;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (person: { userId: string; name: string }) => void;
}) {
  if (!open) return null;
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight;
  const pickerWidth = 288;
  const pickerMaxHeight = 288;
  const gap = 8;
  const pos = anchor
    ? (() => {
      const spaceBelow = viewportHeight - anchor.bottom - gap;
      const spaceAbove = anchor.top - gap;
      const openAbove = spaceBelow < Math.min(pickerMaxHeight, candidates.length * 44 + 44) && spaceAbove > spaceBelow;
      return {
        left: Math.max(12, Math.min(anchor.x, viewportWidth - pickerWidth - 12)),
        maxHeight: Math.max(120, Math.min(pickerMaxHeight, openAbove ? spaceAbove - 8 : spaceBelow - 8)),
        ...(openAbove
          ? { bottom: viewportHeight - anchor.top + gap }
          : { top: anchor.bottom + gap }),
      };
    })()
    : { left: 16, bottom: 16 };
  return (
    <div
      className="fixed z-50 w-72 max-h-72 overflow-auto rounded-lg border border-hairline bg-surface-2 shadow-soft-lg"
      style={pos}
      role="listbox"
      aria-label="@人员选择"
    >
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2 text-caption text-ink-tertiary">
        <UsersRound size={12} />
        <span>@ 人员{query ? <span className="font-medium text-ink-secondary"> · {query}</span> : null}</span>
        <span className="ml-auto text-footnote">↑↓ 选择 · Enter 插入</span>
      </div>
      {candidates.length === 0 ? (
        <div className="px-3 py-4 text-center text-caption text-ink-tertiary">
          当前会话没有匹配成员
        </div>
      ) : (
        <ul>
          {candidates.map((person, index) => (
            <li key={person.userId}>
              <button
                type="button"
                onMouseEnter={() => onActiveIndexChange(index)}
                onClick={() => onSelect(person)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-caption transition-colors ${
                  index === activeIndex
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-secondary hover:bg-surface-3'
                }`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-ink-secondary">
                  {person.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{person.name}</span>
                  <span className="block truncate text-footnote text-ink-tertiary">{person.userId}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
