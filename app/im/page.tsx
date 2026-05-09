'use client';

/**
 * /im · Tandem 内置 IM 页面
 *
 * 三栏布局: 频道列表 (左) + 消息流 (中) + 频道详情 (右, 折叠)
 * 差异化按钮: 每条消息 hover 出现 [开议事室] [转 Memory(WIP)]
 * @ 触发: @[name](userId:persona) 形式可召唤对方 AI 分身
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Hash,
  Lock,
  Megaphone,
  Send,
  Users,
  Sparkles,
  Bot,
  Crown,
  ArrowRight,
  Plus,
} from 'lucide-react';

const ME = 'demo-user'; // V1: 单用户 demo, 后续接 auth session

interface Channel {
  id: string;
  type: 'group' | 'dm' | 'announcement';
  name: string;
  topic?: string;
  visibility: 'public' | 'private';
  memberIds: string[];
  unread: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
}

interface Message {
  id: string;
  channelId: string;
  senderId: string;
  senderKind: 'user' | 'system' | 'persona';
  body: string;
  parentMessageId?: string;
  createdAt: string;
  spawnedDecisionCardId?: string;
  spawnedPromotionId?: string;
  mentions?: { userId: string; kind: 'notify' | 'assign' | 'consult' | 'persona' }[];
}

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

export default function ImPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const composerRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // -- channels --
  async function loadChannels() {
    const res = await fetch(`/api/im/channels?userId=${ME}`);
    const data = await res.json();
    setChannels(data.channels ?? []);
    if (!activeId && data.channels?.length) {
      setActiveId(data.channels[0].id);
    }
  }
  useEffect(() => {
    void loadChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    es.addEventListener('unread', () => {
      void loadChannels();
    });
    return () => es.close();
  }, [activeId]);

  // 频道列表也每 10s 拉一次 (其他频道的未读)
  useEffect(() => {
    const id = setInterval(() => void loadChannels(), 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeId) ?? null,
    [channels, activeId]
  );

  async function sendMessage() {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/im/channels/${activeId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: ME, body: input }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        window.alert(`发送失败: ${err.error ?? res.statusText}`);
      } else {
        setInput('');
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

  function newDmPrompt() {
    const otherId = window.prompt(
      '与谁开始 1:1 对话? 输入 userId (例: colleague-li / colleague-wang):'
    );
    if (!otherId || otherId === ME) return;
    void fetch('/api/im/dm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meId: ME, otherId }),
    })
      .then((r) => r.json())
      .then(({ channel }) => {
        void loadChannels();
        if (channel?.id) setActiveId(channel.id);
      });
  }

  function newGroupPrompt() {
    const name = window.prompt('新群名称:');
    if (!name) return;
    const memberInput = window.prompt(
      '成员 userId (逗号分隔, 例: colleague-li,colleague-wang):',
      'colleague-li,colleague-wang'
    );
    const memberIds = (memberInput ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    void fetch('/api/im/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'group',
        name,
        memberIds,
        createdBy: ME,
      }),
    })
      .then((r) => r.json())
      .then(({ channel }) => {
        void loadChannels();
        if (channel?.id) setActiveId(channel.id);
      });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Staging banner: IM 自建在 Hermes runtime + PG, 已废弃 Rocket.Chat fork 路径 */}
      <div className="flex shrink-0 items-center justify-between border-b border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[11px]">
        <span className="text-emerald-800">
          🟢 <strong>自建 IM (V1 PoC)</strong> · 按
          <a
            href="/docs/MANIFESTO.md#%E7%AC%AC%E5%8D%81%E5%85%AB%E6%9D%A1"
            className="mx-1 underline"
          >
            宪章第十八条
          </a>
          复用 Hermes runtime + PG, 不引 Mongo/Rocket.Chat. 差异化: 一键开议事室 · @Persona 召唤 · 决议型已读
        </span>
        <span className="shrink-0 rounded bg-emerald-200 px-2 py-0.5 font-medium text-emerald-900">
          self-built
        </span>
      </div>
      <div className="grid flex-1 grid-cols-[280px_1fr_280px] overflow-hidden bg-slate-50">
      {/* ---- 左栏: 频道列表 ---- */}
      <aside className="flex flex-col border-r bg-white">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div>
            <div className="text-sm font-semibold">通讯</div>
            <div className="text-[10px] text-muted-foreground">
              {channels.length} 个频道 · 实时 SSE
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={newDmPrompt}
              title="新建 1:1"
            >
              <Users className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={newGroupPrompt}
              title="新建群"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 && (
            <div className="px-3 py-6 text-xs text-muted-foreground">
              暂无频道. 重启 dev server 加载 seed, 或点 ＋ 新建.
            </div>
          )}
          {channels.map((c) => {
            const u = unreadStyle(c);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`flex w-full items-start gap-2 border-b px-3 py-2 text-left transition hover:bg-slate-50 ${
                  activeId === c.id ? 'bg-amber-50/60' : ''
                }`}
              >
                <ChannelIcon channel={c} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-sm ${
                        u.show !== 'none' ? 'font-semibold' : 'font-medium'
                      }`}
                    >
                      {c.type === 'dm'
                        ? c.memberIds.find((m) => m !== ME) ?? '私聊'
                        : c.name}
                    </span>
                    {/* 决议型已读: 焦虑红点仅留给定向消息. 普通消息只灰点 */}
                    {u.show === 'urgent' && (
                      <Badge
                        className="h-4 min-w-4 bg-rose-500 px-1 text-[10px]"
                        title="含指派/咨询/议事室回执 — 需关注"
                      >
                        {u.count! > 99 ? '99+' : u.count}
                      </Badge>
                    )}
                    {u.show === 'subtle' && (
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-slate-400"
                        title="有新消息 (非定向)"
                      />
                    )}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {c.lastMessagePreview ?? '—'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ---- 中栏: 消息流 ---- */}
      <main className="flex h-full min-w-0 flex-col">
        {activeChannel ? (
          <>
            <header className="flex items-center justify-between border-b bg-white px-4 py-2">
              <div className="flex items-center gap-2">
                <ChannelIcon channel={activeChannel} />
                <div>
                  <div className="font-semibold">
                    {activeChannel.type === 'dm'
                      ? activeChannel.memberIds.find((m) => m !== ME) ??
                        '私聊'
                      : activeChannel.name}
                  </div>
                  {activeChannel.topic && (
                    <div className="text-[11px] text-muted-foreground">
                      {activeChannel.topic}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" />
                {activeChannel.memberIds.length}
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  还没有消息. 发条试试 — 每条消息右上角的 ✨ 开议事室 是 Tandem 独有, 普通 IM 没有.
                </div>
              )}
              {messages.map((m, idx) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  prev={messages[idx - 1] ?? null}
                  onSpawnRoom={() => spawnRoom(m.id)}
                  onPromote={() => promoteToMemory(m.id)}
                  onMentionPersona={(uid) => summonPersona(uid)}
                />
              ))}
            </div>

            <footer className="border-t bg-white p-3">
              <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-amber-500" />
                试试: 输入消息后 hover, 一键开议事室 / @[demo-user](demo-user:persona) 召唤 AI 分身
              </div>
              <div className="flex items-center gap-2">
                <Input
                  ref={composerRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder={`在 ${
                    activeChannel.type === 'dm' ? '私聊' : activeChannel.name
                  } 中说点什么…`}
                  disabled={sending}
                />
                <Button onClick={sendMessage} disabled={sending || !input.trim()}>
                  <Send className="mr-1 h-3.5 w-3.5" />
                  发送
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            选一个频道开始
          </div>
        )}
      </main>

      {/* ---- 右栏: 频道详情 + 差异化提示 ---- */}
      <aside className="border-l bg-white p-3 text-xs">
        {activeChannel ? (
          <div className="space-y-3">
            <div>
              <div className="font-semibold text-sm">频道详情</div>
              <div className="mt-1 text-muted-foreground">
                类型: {activeChannel.type} · 可见性: {activeChannel.visibility}
              </div>
            </div>
            <div>
              <div className="font-semibold">成员 ({activeChannel.memberIds.length})</div>
              <ul className="mt-1 space-y-1">
                {activeChannel.memberIds.map((uid) => (
                  <li key={uid} className="flex items-center justify-between">
                    <span className="font-mono text-[11px]">{uid}</span>
                    {uid !== ME && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => summonPersona(uid)}
                      >
                        <Bot className="mr-1 h-3 w-3" /> @分身
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="space-y-2 py-3">
                <div className="flex items-center gap-1 font-semibold text-amber-800">
                  <Crown className="h-3.5 w-3.5" />
                  打 WeCom 的差异化点
                </div>
                <ul className="space-y-1 text-amber-900">
                  <li>• 任意消息 hover 一键开议事室 ✅</li>
                  <li>• @[name](id:persona) 召唤 AI 分身回复 ✅</li>
                  <li>• 议事结果自动 push 回原频道 ✅</li>
                  <li className="opacity-60">• 选中消息 → Memory 升级签批门 (P1.1)</li>
                  <li className="opacity-60">• 群密度自动建议开议事室 (P1.2)</li>
                  <li className="opacity-60">• inline DeepSeek 中英翻译 (P1.3)</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-muted-foreground">未选择频道</div>
        )}
      </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ChannelIcon({ channel }: { channel: Channel }) {
  const Icon =
    channel.type === 'announcement'
      ? Megaphone
      : channel.type === 'dm'
      ? Lock
      : Hash;
  return <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />;
}

function MessageRow({
  msg,
  prev,
  onSpawnRoom,
  onPromote,
  onMentionPersona,
}: {
  msg: Message;
  prev: Message | null;
  onSpawnRoom: () => void;
  onPromote: () => void;
  onMentionPersona: (userId: string) => void;
}) {
  const showSender =
    !prev ||
    prev.senderId !== msg.senderId ||
    prev.senderKind !== msg.senderKind ||
    new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() >
      5 * 60 * 1000;

  if (msg.senderKind === 'system') {
    return (
      <div className="my-2 flex justify-center text-[11px] text-muted-foreground">
        <div className="rounded-full bg-slate-100 px-3 py-1">
          {renderInline(msg.body, onMentionPersona)}
        </div>
      </div>
    );
  }

  const isPersona = msg.senderKind === 'persona';
  const isMe = msg.senderId === ME;

  return (
    <div className={`group mb-1.5 flex items-start gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          isPersona
            ? 'bg-violet-100 text-violet-700'
            : isMe
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-200 text-slate-700'
        }`}
        title={msg.senderId}
      >
        {isPersona ? <Bot className="h-3.5 w-3.5" /> : msg.senderId.slice(0, 2)}
      </div>
      <div className={`max-w-[70%] ${isMe ? 'text-right' : ''}`}>
        {showSender && (
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-medium">{msg.senderId}</span>
            {isPersona && (
              <Badge
                variant="outline"
                className="h-4 border-violet-300 px-1 text-[9px] text-violet-700"
              >
                AI 分身
              </Badge>
            )}
            <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
          </div>
        )}
        <div className="relative">
          <div
            className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm ${
              isMe
                ? 'bg-amber-500 text-white'
                : isPersona
                ? 'border border-violet-200 bg-violet-50 text-violet-900'
                : 'bg-white text-slate-900 ring-1 ring-slate-200'
            }`}
          >
            {renderInline(msg.body, onMentionPersona)}
          </div>
          {/* 差异化按钮: 默认半透, hover 完整显示 (区别于普通 IM) */}
          <div
            className={`absolute -top-3 ${
              isMe ? 'left-2' : 'right-2'
            } flex gap-1 opacity-40 transition group-hover:opacity-100`}
          >
            <button
              type="button"
              onClick={onSpawnRoom}
              disabled={!!msg.spawnedDecisionCardId}
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-sm ring-1 ring-amber-300 transition hover:scale-105 hover:bg-amber-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-40"
              title="把这条消息变成议事室议题 (Tandem 差异化 — 普通 IM 没有)"
            >
              <Sparkles className="h-3 w-3" />
              开议事室
            </button>
            <button
              type="button"
              onClick={onPromote}
              disabled={!!msg.spawnedPromotionId}
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 shadow-sm ring-1 ring-violet-300 transition hover:scale-105 hover:bg-violet-50 hover:shadow disabled:cursor-not-allowed disabled:opacity-40"
              title="沉淀为 Memory 升级提议 (三级签批) — 差异化 §2.2 第 3 条"
            >
              <span className="text-sm">🧠</span>
              沉淀
            </button>
          </div>
          {msg.spawnedPromotionId && (
            <Link
              href={`/memories?promotionId=${msg.spawnedPromotionId}`}
              className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-violet-700 hover:underline"
            >
              <span className="text-[10px]">🧠</span>
              已发起升级提议
            </Link>
          )}
          {msg.spawnedDecisionCardId && (
            <Link
              href={`/convergence?id=${msg.spawnedDecisionCardId}`}
              className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-amber-700 hover:underline"
            >
              <ArrowRight className="h-2.5 w-2.5" />
              已开议事室
            </Link>
          )}
        </div>
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
        ? 'bg-blue-100 text-blue-700'
        : 'bg-slate-100 text-slate-700';
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
