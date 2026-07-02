'use client';

/**
 * /im · Tandem 内置 IM — 对标企业微信"消息"板块
 *
 * 两栏布局: 会话列表 (左 280px) + 消息流 (右)
 * 差异化: hover 消息 → 开议事室 / 沉淀 Memory / @AI分身 / 已读回执
 */

import { Suspense, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreateChannelDialog } from '@/components/im/create-channel-dialog';
import { ChannelDetailPanel } from '@/components/im/channel-detail-panel';
import { AgentModeToggle } from '@/components/im/agent-mode-toggle';
import { AiTraceButton } from '@/components/im/ai-trace-button';
import { CompanyBrainFeedbackButtons } from '@/components/im/company-brain-feedback';
import { VoiceInputButton } from '@/components/voice-input-button';
import {
  DocumentMentionPicker,
  useMentionTrigger,
} from '@/components/documents/mention-picker';
import { cn } from '@/lib/utils';
import { MessageReactions } from '@/components/im/message-reactions';
import type { ImChannel, ImMembership, ImMessage } from '@/lib/types/im';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { usePersonNameResolver } from '@/lib/org/people-source';
import Link from 'next/link';
import { useHandoffPrefill } from '@/hooks/useHandoffPrefill';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Hash,
  Megaphone,
  Send,
  Users,
  Sparkles,
  Bot,
  ArrowRight,
  ArrowLeft,
  Plus,
  Brain,
  Info,
  Search,
  Pin,
  Trash2,
  Settings,
  Smile,
  Image,
  Paperclip,
  AtSign,
  X,
} from 'lucide-react';

// Day 4-7: 升级 Channel/Message 类型 以含撤回 + 公告 + pinned
type Channel = ImChannel & { unread?: number };
type Message = ImMessage;

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

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [members, setMembers] = useState<ImMembership[]>([]);
  const [sendAsAgent, setSendAsAgent] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showIdentityPicker, setShowIdentityPicker] = useState(false);
  const identityPickerRef = useRef<HTMLDivElement>(null);
  const [attachments, setAttachments] = useState<{ name: string; size: number; dataUrl?: string }[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { user } = useCurrentUser();
  const ME = user?.id ?? 'demo-user';
  const nameOf = usePersonNameResolver();

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
    void fetch(`/api/im/channels?userId=${ME}`)
      .then((r) => r.json())
      .then((data) => {
        const ch = (data.channels ?? []).find((c: Channel) => c.id === activeId) ?? null;
        setActiveChannel(ch);
      });
  }, [activeId, ME]);

  // -- messages --
  async function loadMessages(chId: string) {
    const res = await fetch(`/api/im/channels/${chId}/messages?limit=200`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 30);
    void fetch(`/api/im/channels/${chId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: ME }),
    });
  }

  // -- SSE subscribe --
  useEffect(() => {
    if (!activeId) return;
    void loadMessages(activeId);

    const es = new EventSource(
      `/api/im/channels/${activeId}/stream?userId=${ME}`
    );
    es.addEventListener('message', (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data) as Message;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => {
          scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }, 30);
        // 保持已读
        void fetch(`/api/im/channels/${activeId}/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: ME }),
        });
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('unread', () => { /* ImSidebar 自行轮询 */ });
    // Day 4: 撤回事件 — 替换本地设置 deletedAt
    es.addEventListener('message_updated', (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data) as Message;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      } catch { /* ignore */ }
    });
    es.addEventListener('channel', () => { /* ImSidebar 自行轮询 */ });
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, ME]);

  // 拉取当前频道成员 (为已读人数计算 + 设置对话框复用)
  useEffect(() => {
    if (!activeId) { setMembers([]); return; }
    void fetch(`/api/im/channels/${activeId}/members`)
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []));
  }, [activeId]);

  /** Day 4: 撤回消息 */
  async function recallMessageHandler(messageId: string) {
    if (!confirm('确认撤回这条消息?')) return;
    const res = await fetch(`/api/im/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recall', userId: ME }),
    });
    if (!res.ok) {
      const data = await res.json();
      window.alert(`撤回失败: ${data.error ?? res.statusText}`);
    }
  }

  /** Day 7: pin/unpin 消息 */
  async function togglePinHandler(messageId: string) {
    if (!activeId) return;
    const res = await fetch(`/api/im/channels/${activeId}/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, operatorId: ME }),
    });
    if (!res.ok) {
      const data = await res.json();
      window.alert(`置顶失败: ${data.error ?? res.statusText}`);
    }
  }

  async function sendMessage() {
    if ((!input.trim() && attachments.length === 0) || !activeId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/im/channels/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: ME,
          body: attachments.length > 0
            ? `${input.trim()}${input.trim() ? '\n' : ''}${attachments.map((a) => `[附件: ${a.name}]`).join(' ')}`.trim()
            : input,
          senderKind: sendAsAgent ? 'persona' : 'user',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.alert(`发送失败: ${err.error ?? res.statusText}`);
      } else {
        setInput('');
        setAttachments([]);
      }
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }

  async function spawnRoom(messageId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/im/messages/${messageId}/spawn-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: ME }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(`开议事室失败: ${data.error ?? res.statusText}`);
        return;
      }
      // 跳到新议事室
      window.open(`/convergence?id=${data.cardId}`, '_blank');
    } finally {
      setBusy(false);
    }
  }

  async function promoteToMemory(messageId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/im/messages/${messageId}/promote-to-memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggeredBy: ME, level: 'team', proposedType: 'lesson' }),
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(`沉淀 Memory 失败: ${data.error ?? res.statusText}`);
        return;
      }
      window.alert(
        `✍️ 已发起 Memory 升级提议\n\nlevel: team · type: lesson\npromotionId: ${data.promotionId}\n\n→ /memories 查看签批`
      );
    } finally {
      setBusy(false);
    }
  }

  async function summonPersona(targetId: string) {
    // 在 composer 插入 mention 语法
    const tag = `@[${targetId}](${targetId}:persona) `;
    setInput((cur) => (cur ? `${cur} ${tag}` : tag));
    composerRef.current?.focus();
  }

  /** Q2 Day 2: 点通讯录中人员 → 建/找 dm 并切过去 */
  async function startDmWith(otherId: string) {
    if (otherId === ME) return;
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'file') {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    files.forEach((file) => {
      if (kind === 'image' && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setAttachments((prev) => [...prev, { name: file.name, size: file.size, dataUrl: ev.target?.result as string }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachments((prev) => [...prev, { name: file.name, size: file.size }]);
      }
    });
    e.target.value = '';
  }

  function newDmPrompt() {
    const otherId = window.prompt('与谁开始 1:1 对话? 输入 userId:');
    if (!otherId || otherId === ME) return;
    void fetch('/api/im/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meId: ME, otherId }),
    })
      .then((r) => r.json())
      .then(({ channel }) => { if (channel?.id) router.push(`/im?ch=${channel.id}`); });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-surface-1">

      {/* 消息流 + 右侧详情面板 并排容器 */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
      <main className="flex h-full min-w-0 flex-1 flex-col bg-surface-1">
        {activeChannel ? (
          <>
            {/* 顶部栏 */}
            <header className="flex shrink-0 items-center justify-between border-b border-hairline bg-surface-1 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <ConvAvatar
                  channel={activeChannel}
                  name={activeChannel.type === 'dm' ? nameOf(activeChannel.memberIds.find((m) => m !== ME)) ?? '私聊' : activeChannel.name}
                />
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold text-ink-primary">
                    {activeChannel.type === 'dm'
                      ? nameOf(activeChannel.memberIds.find((m) => m !== ME)) ?? '私聊'
                      : activeChannel.name}
                  </div>
                  {activeChannel.topic && (
                    <div className="truncate text-[12px] text-ink-secondary">{activeChannel.topic}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AgentModeToggle
                  channelId={activeChannel.id}
                  initialMode={members.find((m) => m.userId === ME)?.agentMode ?? 'manual'}
                />
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
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-tertiary">
                  <div className="text-[32px]">💬</div>
                  <p className="text-[13px]">还没有消息，发一条试试</p>
                  <p className="text-[11px] text-ink-tertiary">hover 消息可<span className="text-warning font-medium mx-0.5">开议事室</span>或<span className="text-brand-600 font-medium mx-0.5">沉淀 Memory</span></p>
                </div>
              )}
              {messages.map((m, idx) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  prev={messages[idx - 1] ?? null}
                  members={members}
                  meId={ME}
                  nameOf={nameOf}
                  isPinned={(activeChannel.pinnedMessageIds ?? []).includes(m.id)}
                  onSpawnRoom={() => spawnRoom(m.id)}
                  onPromote={() => promoteToMemory(m.id)}
                  onRecall={() => recallMessageHandler(m.id)}
                  onPin={() => togglePinHandler(m.id)}
                  onMentionPersona={(uid) => summonPersona(uid)}
                  onReactionChange={(reactions) =>
                    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reactions } : x)))
                  }
                />
              ))}
            </div>

            {/* 输入区 */}
            <footer className="shrink-0 border-t border-hairline bg-surface-1">
              {/* 附件预览条 */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="group relative flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-3 px-2.5 py-1.5">
                      {a.dataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.dataUrl} alt={a.name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <Paperclip className="h-4 w-4 shrink-0 text-ink-tertiary" />
                      )}
                      <span className="max-w-[120px] truncate text-[11px] text-ink-primary">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                        className="ml-0.5 text-ink-tertiary hover:text-ink-primary"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 工具条 */}
              <div className="flex items-center gap-0.5 px-3 pt-2">
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

                {/* @成员 */}
                <button
                  type="button"
                  onClick={() => {
                    setInput((cur) => cur + '@');
                    composerRef.current?.focus();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
                  title="@成员"
                >
                  <AtSign className="h-4 w-4" />
                </button>

                {/* 语音 */}
                <VoiceInputButton
                  onText={(text) => setInput((cur) => (cur ? `${cur} ${text}` : text))}
                  disabled={sending}
                />

              </div>

              {/* 身份选择器 + 输入框 + 发送 */}
              <div className="flex items-end gap-2 px-3 pb-3 pt-1.5">

                {/* 身份切换器 */}
                <div ref={identityPickerRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowIdentityPicker((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition ${
                      sendAsAgent
                        ? 'border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100'
                        : 'border-hairline bg-surface-3 text-ink-primary hover:bg-surface-3'
                    }`}
                  >
                    {sendAsAgent
                      ? <Bot className="h-3.5 w-3.5 shrink-0" />
                      : <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white bg-gradient-to-br from-amber-400 to-orange-500`}>{ME.slice(0, 1).toUpperCase()}</span>
                    }
                    <span className="hidden sm:inline">{sendAsAgent ? 'AI 分身' : '真人'}</span>
                    <svg className="h-3 w-3 shrink-0 text-current opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                  </button>

                  {showIdentityPicker && (
                    <IdentityPickerDropdown
                      meId={ME}
                      sendAsAgent={sendAsAgent}
                      onSelect={(asAgent) => { setSendAsAgent(asAgent); setShowIdentityPicker(false); composerRef.current?.focus(); }}
                      onClose={() => setShowIdentityPicker(false)}
                      containerRef={identityPickerRef}
                    />
                  )}
                </div>

                <div className="flex flex-1 items-center rounded-lg border border-hairline bg-surface-1 px-3 py-2 transition focus-within:border-brand-400 focus-within:ring-1 focus-within:ring-brand-100">
                  <ImComposerInput
                    composerRef={composerRef}
                    value={input}
                    setValue={setInput}
                    onEnter={() => void sendMessage()}
                    disabled={sending}
                    placeholder={sendAsAgent ? '以 AI 分身身份发言…' : '发送消息…'}
                  />
                </div>
                <Button
                  onClick={sendMessage}
                  disabled={sending || (!input.trim() && attachments.length === 0)}
                  className="h-9 gap-1 rounded-lg bg-brand-600 px-4 text-[13px] text-white transition hover:bg-brand-700 disabled:bg-surface-3 disabled:text-ink-tertiary"
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
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-blue-500',
    'from-violet-400 to-purple-500',
    'from-pink-400 to-rose-500',
  ];
  if (channel.type === 'announcement') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 to-rose-500 text-white">
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
  const idx = channel.id.charCodeAt(0) % palette.length;
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${palette[idx]} text-white`}>
      <Hash className="h-5 w-5" />
    </div>
  );
}

function IdentityPickerDropdown({
  meId,
  sendAsAgent,
  onSelect,
  onClose,
  containerRef,
}: {
  meId: string;
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
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-[11px] font-bold text-white">
          {meId.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-ink-primary truncate">{meId}</div>
          <div className="text-[11px] text-ink-secondary">真人 · 以我自己的身份发言</div>
        </div>
        {!sendAsAgent && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
      </button>
      <button
        type="button"
        onClick={() => onSelect(true)}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-violet-50 ${sendAsAgent ? 'bg-violet-50' : ''}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-violet-800">AI 分身</div>
          <div className="text-[11px] text-violet-500">让我的分身代我在群里发言</div>
        </div>
        {sendAsAgent && <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />}
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
      className="absolute bottom-10 left-0 z-50 w-64 rounded-2xl border border-hairline bg-surface-2 p-2 shadow-soft-lg"
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

function MessageRow({
  msg,
  prev,
  members,
  isPinned,
  meId,
  nameOf,
  onSpawnRoom,
  onPromote,
  onRecall,
  onPin,
  onMentionPersona,
  onReactionChange,
}: {
  msg: Message;
  prev: Message | null;
  members: ImMembership[];
  isPinned: boolean;
  meId: string;
  nameOf: (id: string | null | undefined) => string;
  onSpawnRoom: () => void;
  onPromote: () => void;
  onRecall: () => void;
  onPin: () => void;
  onMentionPersona: (userId: string) => void;
  onReactionChange: (reactions: Record<string, string[]>) => void;
}) {
  // Day 4: 已读人数 (除发送者外, lastReadAt > msg.createdAt 的成员)
  const readers = members.filter(
    (m) => m.userId !== msg.senderId && m.lastReadAt && new Date(m.lastReadAt) >= new Date(msg.createdAt)
  );
  const readerCount = readers.length;
  const totalReaders = Math.max(0, members.length - 1); // 除发送者
  // Day 4: recallable 用 Date.now(), SSR 和 CSR 时间不同会 hydration mismatch
  // → useState + useEffect 只在客户端 mount 后计算
  const [recallable, setRecallable] = useState(false);
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
        <div className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface-2 px-3 py-1 text-ink-secondary shadow-soft-sm">
          <Info className="h-3 w-3 text-ink-tertiary" />
          {renderInline(msg.body, onMentionPersona)}
        </div>
      </div>
    );
  }

  const isPersona = msg.senderKind === 'persona';
  const isMe = msg.senderId === meId;

  return (
    <div className={`cv-auto group mb-1 flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold shadow-soft-sm ${
          isPersona
            ? 'bg-gradient-to-br from-violet-400 to-purple-500 text-white'
            : isMe
            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
            : 'bg-gradient-to-br from-zinc-300 to-zinc-500 text-white'
        }`}
        title={nameOf(msg.senderId)}
      >
        {isPersona ? <Bot className="h-4 w-4" /> : nameOf(msg.senderId).slice(0, 2).toUpperCase()}
      </div>
      <div className={`max-w-[72%] min-w-0 ${isMe ? 'text-right' : ''}`}>
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
                className="h-4 border-violet-300 bg-violet-50 px-1 text-[9px] font-medium text-violet-700"
              >
                AI 分身
              </Badge>
            )}
            <span className="text-ink-tertiary">·</span>
            <span className="text-ink-tertiary">
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
        <div className={`relative inline-block ${isMe ? 'text-left' : ''}`}>
          <div
            className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-soft-sm ${
              isMe
                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                : isPersona
                ? 'border border-violet-200/80 bg-gradient-to-br from-violet-50 to-purple-50/40 text-violet-900'
                : 'bg-surface-2 text-ink-primary ring-1 ring-hairline'
            }`}
          >
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
                  <span className="inline-flex items-center gap-1.5 text-violet-500/80">
                    <span className="text-[11px]">{statusLabel}</span>
                    <span className="inline-flex gap-0.5">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.3s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.15s]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-violet-400" />
                    </span>
                  </span>
                );
              }
              return (
                <>
                  {renderInline(msg.body, onMentionPersona)}
                  {isStreaming && !bodyEmpty && (
                    <span className="ml-0.5 inline-block w-[6px] animate-pulse text-violet-500/70">▍</span>
                  )}
                </>
              );
            })()}
          </div>

          {/* 差异化浮条: 落在气泡右下/左下角. 默认隐藏, hover 浮起.
              比起绝对定位 -top-3 的旧方案, 不再遮挡 sender 名 */}
          <div
            className={`pointer-events-none absolute -bottom-3 ${
              isMe ? 'left-2' : 'right-2'
            } flex translate-y-1 gap-1 opacity-0 transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100`}
          >
            <button
              type="button"
              onClick={onSpawnRoom}
              disabled={!!msg.spawnedDecisionCardId}
              className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-warning shadow-soft ring-1 ring-warning/30 transition hover:bg-warning/5 hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-40"
              title="把这条消息变成议事室议题 (Tandem 差异化 — 普通 IM 没有)"
            >
              <Sparkles className="h-3 w-3" />
              开议事室
            </button>
            <button
              type="button"
              onClick={onPromote}
              disabled={!!msg.spawnedPromotionId}
              className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-violet-700 shadow-soft ring-1 ring-violet-300/80 transition hover:bg-violet-50 hover:shadow-soft-lg disabled:cursor-not-allowed disabled:opacity-40"
              title="沉淀为 Memory 升级提议 (三级签批) — 差异化 §2.2 第 3 条"
            >
              <Brain className="h-3 w-3" />
              沉淀
            </button>
            {/* Day 7: pin/unpin */}
            <button
              type="button"
              onClick={onPin}
              className={`flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold shadow-soft transition hover:shadow-soft-lg ${
                isPinned ? 'text-warning ring-1 ring-warning/30 hover:bg-warning/5' : 'text-ink-secondary ring-1 ring-hairline hover:bg-surface-3'
              }`}
              title={isPinned ? '取消置顶' : '置顶 (最多 5 条)'}
            >
              <Pin className="h-3 w-3" />
              {isPinned ? '已顶' : '置顶'}
            </button>
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
                onClick={onRecall}
                className="flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-rose-700 shadow-soft ring-1 ring-rose-300/80 transition hover:bg-rose-50 hover:shadow-soft-lg"
                title="撤回 (2 分钟内 有效)"
              >
                <Trash2 className="h-3 w-3" />
                撤回
              </button>
            )}
          </div>
        </div>
        {/* 表情回应 (真闭环: /api/im/messages/:id/reactions 切换持久化到 ImMessage.reactions) */}
        <div className={isMe ? 'flex justify-end' : ''}>
          <MessageReactions
            messageId={msg.id}
            reactions={msg.reactions}
            currentUserId={meId}
            onChanged={onReactionChange}
          />
        </div>
        {/* Day 4: 已读人数 (仅我发的消息显示) */}
        {msg.senderId === meId && totalReaders > 0 && (
          <div className={`mt-1 text-[10px] text-ink-tertiary ${isMe ? 'text-right' : ''}`}>
            {readerCount === 0
              ? '未读'
              : readerCount === totalReaders
              ? '全部已读'
              : `${readerCount}/${totalReaders} 已读`}
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
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 transition hover:bg-violet-100"
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
        ? 'bg-violet-100 text-violet-700'
        : kind === 'assign'
        ? 'bg-rose-100 text-rose-700'
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

/**
 * D-01: IM composer 输入框, 接 @ 文档引用 picker.
 *
 * 既不破坏现有 @[name](userId:persona) 召唤分身的语法 (那个是 @ 紧跟 `[`,
 * useMentionTrigger 的 regex 会立刻 fail → 收起 picker),
 * 也支持新的 @<文件名> 文档引用 (插入 [[doc:id|title]], 走 router preprocess).
 */
function ImComposerInput(props: {
  composerRef: React.RefObject<HTMLInputElement>;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  onEnter: () => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const { composerRef, value, setValue, onEnter, disabled, placeholder } = props;
  const mention = useMentionTrigger({
    value,
    setValue: (v) => setValue(v),
    inputRef: composerRef,
  });

  return (
    <>
      <Input
        ref={composerRef}
        value={value}
        onChange={mention.onChange}
        onKeyDown={(e) => {
          // picker 接管 ↑↓⏎Esc, 不让 Input 默认 Enter 触发发送
          if (mention.open && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab'].includes(e.key)) {
            return;
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="border-0 bg-transparent p-0 text-[13.5px] shadow-none focus-visible:ring-0"
      />
      <DocumentMentionPicker
        open={mention.open}
        query={mention.query}
        anchor={mention.anchor}
        onSelect={mention.insertMention}
        onClose={() => mention.setOpen(false)}
      />
    </>
  );
}
