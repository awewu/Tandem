'use client';

/**
 * /im · Tandem 内置 IM 页面
 *
 * 三栏布局: 频道列表 (左) + 消息流 (中) + 频道详情 (右, 折叠)
 * 差异化按钮: 每条消息 hover 出现 [开议事室] [转 Memory(WIP)]
 * @ 触发: @[name](userId:persona) 形式可召唤对方 AI 分身
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { CreateChannelDialog } from '@/components/im/create-channel-dialog';
import { ContactsTree } from '@/components/im/contacts-tree';
import { ChannelSettingsDialog } from '@/components/im/channel-settings-dialog';
import { SeedFromOrgDialog } from '@/components/im/seed-from-org-dialog';
import type { ImChannel, ImMembership, ImMessage } from '@/lib/types/im';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
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
  Plus,
  Check,
  Brain,
  Info,
  X,
  Pin,
  Trash2,
} from 'lucide-react';

const ME = 'demo-user'; // V1: 单用户 demo, 后续接 auth session

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

export default function ImPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Q2 (2026-05-10) 建群对话框 状态 */
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  /** Q2 Day 2: 左栏 tab 切换 [频道|通讯录] */
  const [leftTab, setLeftTab] = useState<'channels' | 'contacts'>('channels');
  /** Q2 Day 2: 点部门“建群”时预填数据 */
  const [prefillDept, setPrefillDept] = useState<{ id: string; name: string } | null>(null);
  /** Q2 Day 5-7: 频道设置对话框 */
  const [showSettings, setShowSettings] = useState(false);
  /** Q2 Day 4: 当前频道成员 (计算已读人数) */
  const [members, setMembers] = useState<ImMembership[]>([]);
  /** P1 (2026-05-10): 按组织架构一键建群 对话框 */
  const [showSeedDialog, setShowSeedDialog] = useState(false);
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
    // Day 4: 撤回事件 — 替换本地设置 deletedAt
    es.addEventListener('message_updated', (e) => {
      try {
        const msg = JSON.parse((e as MessageEvent).data) as Message;
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
      } catch { /* ignore */ }
    });
    // Day 5-7: channel 更新 (公告/成员/pin) — 重拉 channels
    es.addEventListener('channel', () => {
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

  // Day 4: 拉取当前频道成员 (为已读人数计算 + 设置对话框复用)
  useEffect(() => {
    if (!activeId) { setMembers([]); return; }
    void fetch(`/api/im/channels/${activeId}/members`)
      .then((r) => r.json())
      .then((data) => setMembers(data.members ?? []));
  }, [activeId, channels]);

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
        await loadChannels();
        setActiveId(data.channel.id);
        setLeftTab('channels');
      }
    } finally {
      setBusy(false);
    }
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
      <BannerChip />
      <div className="grid flex-1 grid-cols-[300px_1fr_300px] overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100/40">
      {/* ---- 左栏: 频道列表 ---- */}
      <aside className="flex flex-col border-r border-slate-200/70 bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-slate-800">通讯</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-slate-500">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {channels.length} 个频道 · 实时 SSE
            </div>
          </div>
          <div className="flex gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={newDmPrompt}
              title="新建 1:1"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setShowCreateDialog(true)}
              title="建群 (选类型: 普通/部门/团队/项目/跨部门/公告)"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-600 hover:bg-amber-50"
              onClick={() => setShowSeedDialog(true)}
              title="按组织架构一键建群 (HR/Admin)"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {/* Q2 Day 2: tab 切换 [频道|通讯录] */}
        <div className="flex border-b border-slate-200/70 bg-slate-50/50 px-2 py-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setLeftTab('channels')}
            className={`flex-1 rounded px-2 py-1 transition ${
              leftTab === 'channels'
                ? 'bg-white font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            频道
          </button>
          <button
            type="button"
            onClick={() => setLeftTab('contacts')}
            className={`flex-1 rounded px-2 py-1 transition ${
              leftTab === 'contacts'
                ? 'bg-white font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            通讯录
          </button>
        </div>

        {leftTab === 'contacts' ? (
          <ContactsTree
            currentUserId={ME}
            onSelectPerson={startDmWith}
            onCreateDeptChannel={(id, name) => {
              setPrefillDept({ id, name });
              setShowCreateDialog(true);
            }}
          />
        ) : (
        <div className="flex-1 overflow-y-auto px-1.5 py-2">
          {channels.length === 0 && (
            <div className="px-3 py-6 text-xs text-slate-500">
              暂无频道. 重启 dev server 加载 seed, 或点 ＋ 新建.
            </div>
          )}
          {channels.map((c) => {
            const u = unreadStyle(c);
            const displayName =
              c.type === 'dm' ? c.memberIds.find((m) => m !== ME) ?? '私聊' : c.name;
            const active = activeId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveId(c.id)}
                className={`mb-0.5 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                  active
                    ? 'bg-amber-50 ring-1 ring-amber-200'
                    : 'hover:bg-slate-50'
                }`}
              >
                <ChannelAvatar channel={c} name={displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-[13px] ${
                        u.show !== 'none' ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                      }`}
                    >
                      {displayName}
                    </span>
                    {c.lastMessageAt && (
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {formatRelative(c.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] text-slate-500">
                      {c.lastMessagePreview ?? '—'}
                    </span>
                    {u.show === 'urgent' && (
                      <Badge
                        className="h-4 min-w-4 shrink-0 bg-rose-500 px-1 text-[10px] hover:bg-rose-600"
                        title="含指派/咨询/议事室回执 — 需关注"
                      >
                        {u.count! > 99 ? '99+' : u.count}
                      </Badge>
                    )}
                    {u.show === 'subtle' && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400"
                        title="有新消息 (非定向)"
                      />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        )}
      </aside>

      {/* P1: 按组织一键建群 对话框 */}
      <SeedFromOrgDialog
        open={showSeedDialog}
        onOpenChange={setShowSeedDialog}
        currentUserId={ME}
        onSeeded={() => { void loadChannels(); }}
      />

      {/* Day 5-7: 频道设置对话框 */}
      <ChannelSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        channel={activeChannel}
        messages={messages}
        currentUserId={ME}
        onChanged={() => { void loadChannels(); }}
      />

      {/* Q2 建群对话框 (2026-05-10) · Day 2: 接受部门预填 */}
      <CreateChannelDialog
        open={showCreateDialog}
        onOpenChange={(v) => { setShowCreateDialog(v); if (!v) setPrefillDept(null); }}
        currentUserId={ME}
        prefillDepartment={prefillDept}
        onCreated={(channelId) => {
          void loadChannels();
          setActiveId(channelId);
          setPrefillDept(null);
        }}
      />

      {/* ---- 中栏: 消息流 ---- */}
      <main className="flex h-full min-w-0 flex-col">
        {activeChannel ? (
          <>
            <header className="flex items-center justify-between border-b border-slate-200/70 bg-white/95 px-5 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <ChannelAvatar
                  channel={activeChannel}
                  name={
                    activeChannel.type === 'dm'
                      ? activeChannel.memberIds.find((m) => m !== ME) ?? '私聊'
                      : activeChannel.name
                  }
                  size="md"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[15px] font-semibold tracking-tight text-slate-900">
                      {activeChannel.type === 'dm'
                        ? activeChannel.memberIds.find((m) => m !== ME) ?? '私聊'
                        : activeChannel.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="h-4 border-slate-300 px-1.5 text-[9.5px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      {activeChannel.type === 'announcement'
                        ? '公告'
                        : activeChannel.type === 'dm'
                        ? '私聊'
                        : activeChannel.visibility === 'private'
                        ? '私有'
                        : '公开'}
                    </Badge>
                  </div>
                  {activeChannel.topic && (
                    <div className="mt-0.5 text-[11.5px] text-slate-500">
                      {activeChannel.topic}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200"
                  title="频道设置 (信息/成员/公告/置顶)"
                >
                  <Users className="h-3 w-3" />
                  {activeChannel.memberIds.length}
                </button>
              </div>
            </header>

            {/* Day 7: 公告条 (如果有) */}
            {activeChannel.announcement && (
              <div className="flex items-start gap-2 border-b border-amber-200/70 bg-amber-50/60 px-5 py-2 text-[12px] text-amber-900">
                <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">公告:</span>{' '}
                  <span className="whitespace-pre-wrap break-words line-clamp-2">
                    {activeChannel.announcement}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="text-[10px] text-amber-700 hover:underline shrink-0"
                >
                  详情
                </button>
              </div>
            )}

            {/* Day 7: 置顶消息条 (如果有) */}
            {(activeChannel.pinnedMessageIds ?? []).length > 0 && (
              <div className="border-b border-slate-200/70 bg-slate-50/60 px-5 py-1.5">
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900"
                >
                  <Pin className="h-3 w-3 text-amber-500" />
                  {(activeChannel.pinnedMessageIds ?? []).length} 条置顶消息
                </button>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <EmptyState />
              )}
              {messages.map((m, idx) => (
                <MessageRow
                  key={m.id}
                  msg={m}
                  prev={messages[idx - 1] ?? null}
                  members={members}
                  isPinned={(activeChannel.pinnedMessageIds ?? []).includes(m.id)}
                  onSpawnRoom={() => spawnRoom(m.id)}
                  onPromote={() => promoteToMemory(m.id)}
                  onRecall={() => recallMessageHandler(m.id)}
                  onPin={() => togglePinHandler(m.id)}
                  onMentionPersona={(uid) => summonPersona(uid)}
                />
              ))}
            </div>

            <footer className="border-t border-slate-200/70 bg-white/95 px-5 py-3 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>hover 消息 → ✨ 开议事室 / 🧠 沉淀 · 输入 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-700">@[colleague-li](colleague-li:persona)</code> 召唤 AI 分身</span>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex flex-1 items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
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
                    } 中说点什么… (Enter 发送)`}
                    disabled={sending}
                    className="border-0 bg-transparent p-0 text-[13.5px] shadow-none focus-visible:ring-0"
                  />
                </div>
                <Button
                  onClick={sendMessage}
                  disabled={sending || !input.trim()}
                  className="h-10 gap-1.5 rounded-xl bg-amber-500 px-4 text-white shadow-sm hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  <Send className="h-3.5 w-3.5" />
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
      <aside className="flex flex-col gap-3 overflow-y-auto border-l border-slate-200/70 bg-white/95 p-4 backdrop-blur-sm">
        {activeChannel ? (
          <>
            <Card className="border-slate-200/70 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    频道详情
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11.5px]">
                    <div>
                      <div className="text-slate-400">类型</div>
                      <div className="font-medium text-slate-700">{activeChannel.type}</div>
                    </div>
                    <div>
                      <div className="text-slate-400">可见性</div>
                      <div className="font-medium text-slate-700">{activeChannel.visibility}</div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      成员 ({activeChannel.memberIds.length})
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {activeChannel.memberIds.map((uid) => (
                      <li
                        key={uid}
                        className="flex items-center justify-between rounded-md px-1 py-1 hover:bg-slate-50"
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar id={uid} />
                          <span className="text-[12px] text-slate-700">{uid}</span>
                          {uid === ME && (
                            <Badge
                              variant="outline"
                              className="h-4 border-amber-200 bg-amber-50 px-1 text-[9px] text-amber-700"
                            >
                              我
                            </Badge>
                          )}
                        </div>
                        {uid !== ME && (
                          <button
                            type="button"
                            onClick={() => summonPersona(uid)}
                            className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-violet-600 transition hover:bg-violet-50"
                            title="召唤此人 AI 分身"
                          >
                            <Bot className="h-3 w-3" /> @分身
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50/60 to-orange-50/40 shadow-sm">
              <CardContent className="space-y-2.5 p-4">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/90 text-[11px]">
                    👑
                  </span>
                  <span className="text-[12px] font-semibold tracking-tight text-amber-900">
                    Tandem 打 WeCom 差异化
                  </span>
                </div>
                <ul className="space-y-1.5 text-[11.5px]">
                  <Diff done text="任意消息 hover · 一键开议事室" />
                  <Diff done text="@[name](id:persona) 召唤 AI 分身回复" />
                  <Diff done text="议事结果自动 push 回原频道" />
                  <Diff done text="消息 → Memory 三级签批沉淀" />
                  <Diff text="群密度自动建议开议事室" badge="P1.2" />
                  <Diff text="inline DeepSeek 中英翻译" badge="P1.3" />
                </ul>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-slate-400">
            未选择频道
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 关闭式状态 banner (顶, 可一键收起 — 进入工作流后让位给消息流)
function BannerChip() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-200/70 bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-transparent px-4 py-1.5 text-[11px]">
      <div className="flex min-w-0 items-center gap-2 text-emerald-800">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/90 text-[9px] text-white">
          ✓
        </span>
        <span className="truncate">
          <strong className="font-semibold">自建 IM (V1 PoC)</strong> · 复用 Hermes runtime + PG · 差异化: 一键开议事室 · @Persona · 决议型已读
        </span>
        <a
          href="/docs/MANIFESTO.md#%E7%AC%AC%E5%8D%81%E5%85%AB%E6%9D%A1"
          className="shrink-0 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900"
        >
          宪章 §18
        </a>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-full bg-emerald-200/70 px-2 py-0.5 font-medium text-emerald-900">
          self-built
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="收起"
          className="flex h-5 w-5 items-center justify-center rounded text-emerald-700 hover:bg-emerald-100"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-violet-100 text-3xl">
        💬
      </div>
      <div className="max-w-xs text-center text-[12.5px]">
        还没有消息. 发条试试 — hover 任意消息可以
        <span className="mx-1 inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700">
          <Sparkles className="h-2.5 w-2.5" />开议事室
        </span>
        或
        <span className="mx-1 inline-flex items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-700">
          <Brain className="h-2.5 w-2.5" />沉淀 Memory
        </span>
        — 普通 IM 都没有.
      </div>
    </div>
  );
}

function Diff({ done, text, badge }: { done?: boolean; text: string; badge?: string }) {
  return (
    <li className="flex items-start gap-1.5">
      <span
        className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${
          done ? 'bg-emerald-500 text-white' : 'border border-slate-300 bg-white'
        }`}
      >
        {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      <span className={done ? 'text-amber-900' : 'text-slate-500'}>{text}</span>
      {badge && (
        <Badge
          variant="outline"
          className="ml-auto h-4 border-slate-300 px-1 text-[9px] font-mono text-slate-500"
        >
          {badge}
        </Badge>
      )}
    </li>
  );
}

// 频道左栏头像: 1:1 用对方姓名首字, 群/公告用类型 icon
function ChannelAvatar({
  channel,
  name,
  size = 'sm',
}: {
  channel: Channel;
  name: string;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'md' ? 'h-9 w-9 text-sm' : 'h-8 w-8 text-xs';
  if (channel.type === 'announcement') {
    return (
      <div
        className={`${dim} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-500 text-white shadow-sm`}
      >
        <Megaphone className="h-4 w-4" />
      </div>
    );
  }
  if (channel.type === 'dm') {
    return (
      <div
        className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-400 to-slate-600 font-semibold uppercase text-white shadow-sm`}
      >
        {name.slice(0, 2)}
      </div>
    );
  }
  // group: 颜色由 channelId 决定 (稳定)
  const palette = [
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-blue-500',
    'from-violet-400 to-purple-500',
    'from-pink-400 to-rose-500',
  ];
  const idx = channel.id.charCodeAt(0) % palette.length;
  return (
    <div
      className={`${dim} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${palette[idx]} text-white shadow-sm`}
    >
      <Hash className="h-4 w-4" />
    </div>
  );
}

function UserAvatar({ id }: { id: string }) {
  const palette = [
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-blue-500',
    'from-violet-400 to-purple-500',
    'from-pink-400 to-rose-500',
  ];
  const idx = id.charCodeAt(0) % palette.length;
  return (
    <div
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${palette[idx]} text-[9px] font-semibold uppercase text-white`}
    >
      {id.slice(0, 2)}
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
  onSpawnRoom,
  onPromote,
  onRecall,
  onPin,
  onMentionPersona,
}: {
  msg: Message;
  prev: Message | null;
  members: ImMembership[];
  isPinned: boolean;
  onSpawnRoom: () => void;
  onPromote: () => void;
  onRecall: () => void;
  onPin: () => void;
  onMentionPersona: (userId: string) => void;
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
    if (msg.deletedAt || msg.senderId !== ME) { setRecallable(false); return; }
    const ageMs = Date.now() - new Date(msg.createdAt).getTime();
    const remaining = 2 * 60 * 1000 - ageMs;
    setRecallable(remaining > 0);
    if (remaining > 0) {
      const t = setTimeout(() => setRecallable(false), remaining);
      return () => clearTimeout(t);
    }
  }, [msg.id, msg.deletedAt, msg.senderId, msg.createdAt]);
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
        <div className="rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 text-slate-400 italic">
          {msg.senderId === ME ? '你' : msg.senderId} 撤回了一条消息
        </div>
      </div>
    );
  }

  if (msg.senderKind === 'system') {
    return (
      <div className="my-3 flex justify-center text-[11px]">
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-white px-3 py-1 text-slate-500 shadow-sm">
          <Info className="h-3 w-3 text-slate-400" />
          {renderInline(msg.body, onMentionPersona)}
        </div>
      </div>
    );
  }

  const isPersona = msg.senderKind === 'persona';
  const isMe = msg.senderId === ME;

  return (
    <div className={`group mb-1 flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm ${
          isPersona
            ? 'bg-gradient-to-br from-violet-400 to-purple-500 text-white'
            : isMe
            ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
            : 'bg-gradient-to-br from-slate-300 to-slate-500 text-white'
        }`}
        title={msg.senderId}
      >
        {isPersona ? <Bot className="h-4 w-4" /> : msg.senderId.slice(0, 2).toUpperCase()}
      </div>
      <div className={`max-w-[72%] min-w-0 ${isMe ? 'text-right' : ''}`}>
        {showSender && (
          <div
            className={`mb-1 flex items-center gap-1.5 text-[10.5px] text-slate-500 ${
              isMe ? 'justify-end' : ''
            }`}
          >
            <span className="font-medium text-slate-700">{msg.senderId}</span>
            {isPersona && (
              <Badge
                variant="outline"
                className="h-4 border-violet-300 bg-violet-50 px-1 text-[9px] font-medium text-violet-700"
              >
                AI 分身
              </Badge>
            )}
            <span className="text-slate-400">·</span>
            <span className="text-slate-400">
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
        <div className={`relative inline-block ${isMe ? 'text-left' : ''}`}>
          <div
            className={`inline-block whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm ${
              isMe
                ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white'
                : isPersona
                ? 'border border-violet-200/80 bg-gradient-to-br from-violet-50 to-purple-50/40 text-violet-900'
                : 'bg-white text-slate-800 ring-1 ring-slate-200/80'
            }`}
          >
            {renderInline(msg.body, onMentionPersona)}
          </div>

          {/* 差异化浮条: 落在气泡右下/左下角. 默认隐藏, hover 浮起.
              比起绝对定位 -top-3 的旧方案, 不再遮挡 sender 名 */}
          <div
            className={`pointer-events-none absolute -bottom-3 ${
              isMe ? 'left-2' : 'right-2'
            } flex translate-y-1 gap-1 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100`}
          >
            <button
              type="button"
              onClick={onSpawnRoom}
              disabled={!!msg.spawnedDecisionCardId}
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-md ring-1 ring-amber-300/80 transition hover:bg-amber-50 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              title="把这条消息变成议事室议题 (Tandem 差异化 — 普通 IM 没有)"
            >
              <Sparkles className="h-3 w-3" />
              开议事室
            </button>
            <button
              type="button"
              onClick={onPromote}
              disabled={!!msg.spawnedPromotionId}
              className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-700 shadow-md ring-1 ring-violet-300/80 transition hover:bg-violet-50 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
              title="沉淀为 Memory 升级提议 (三级签批) — 差异化 §2.2 第 3 条"
            >
              <Brain className="h-3 w-3" />
              沉淀
            </button>
            {/* Day 7: pin/unpin */}
            <button
              type="button"
              onClick={onPin}
              className={`flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold shadow-md transition hover:shadow-lg ${
                isPinned ? 'text-amber-700 ring-1 ring-amber-300/80 hover:bg-amber-50' : 'text-slate-600 ring-1 ring-slate-300/80 hover:bg-slate-50'
              }`}
              title={isPinned ? '取消置顶' : '置顶 (最多 5 条)'}
            >
              <Pin className="h-3 w-3" />
              {isPinned ? '已顶' : '置顶'}
            </button>
            {/* Day 4: 撤回 (仅本人 + 2 分钟内) */}
            {recallable && (
              <button
                type="button"
                onClick={onRecall}
                className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 shadow-md ring-1 ring-rose-300/80 transition hover:bg-rose-50 hover:shadow-lg"
                title="撤回 (2 分钟内 有效)"
              >
                <Trash2 className="h-3 w-3" />
                撤回
              </button>
            )}
          </div>
        </div>
        {/* Day 4: 已读人数 (仅我发的消息显示) */}
        {msg.senderId === ME && totalReaders > 0 && (
          <div className={`mt-1 text-[10px] text-slate-400 ${isMe ? 'text-right' : ''}`}>
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
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 transition hover:bg-amber-100"
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
