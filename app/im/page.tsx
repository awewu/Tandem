'use client';

/**
 * /im · Tandem 内置 IM 页面
 *
 * 三栏布局: 频道列表 (左) + 消息流 (中) + 频道详情 (右, 折叠)
 * 差异化按钮: 每条消息 hover 出现 [开议事室] [转 Memory(WIP)]
 * @ 触发: @[name](userId:persona) 形式可召唤对方 AI 分身
 */

import { Suspense, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreateChannelDialog } from '@/components/im/create-channel-dialog';
import { ContactsTree } from '@/components/im/contacts-tree';
import { ChannelSettingsDialog } from '@/components/im/channel-settings-dialog';
import { SeedFromOrgDialog } from '@/components/im/seed-from-org-dialog';
import { AgentModeToggle } from '@/components/im/agent-mode-toggle';
import { AiTraceButton } from '@/components/im/ai-trace-button';
import { CompanyBrainFeedbackButtons } from '@/components/im/company-brain-feedback';
import type { ImChannel, ImMembership, ImMessage } from '@/lib/types/im';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
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
  Brain,
  Info,
  X,
  Pin,
  Trash2,
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

  /**
   * Deep-link query support (used by SubSidebar quick actions + Command Palette):
   *   /im?new=1   → 自动弹出"新建群聊"对话框
   *   /im?dm=new  → 切换到"通讯录" tab, 用户可直接选人发起 DM
   * 命中后清掉 URL 参数避免刷新再次触发.
   */
  useEffect(() => {
    if (!searchParams) return;
    const isNew = searchParams.get('new') === '1';
    const isDmNew = searchParams.get('dm') === 'new';
    if (isNew) {
      setShowCreateDialog(true);
      router.replace('/im');
    } else if (isDmNew) {
      setLeftTab('contacts');
      router.replace('/im');
    }
  }, [searchParams, router]);
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

  // Real auth-bound user id (replaces the legacy hardcoded 'demo-user').
  // Falls back to 'demo-user' only in unauth/demo mode so existing seeds keep working.
  const { user } = useCurrentUser();
  const ME = user?.id ?? 'demo-user';

  // -- channels --
  const loadChannels = useCallback(async () => {
    const res = await fetch(`/api/im/channels?userId=${ME}`);
    const data = await res.json();
    setChannels(data.channels ?? []);
    if (!activeId && data.channels?.length) {
      setActiveId(data.channels[0].id);
    }
  }, [activeId, ME]);
  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

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
    // loadMessages is a stable function reference within this component scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, loadChannels, ME]);

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
      <div className="grid flex-1 grid-cols-[340px_1fr_300px] overflow-hidden bg-white">
      {/* ---- 左栏: 频道列表 — Gemini Gems 风格 (柔和留白 + 大圆角 + 渐变头像) ---- */}
      <aside className="flex flex-col border-r border-slate-100 bg-gradient-to-b from-white via-white to-slate-50/40">
        {/* Header: 大标题 + 副描述 + 新建 pill */}
        <div className="flex flex-col gap-3 px-5 pt-6 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 leading-none">
                通讯
              </h1>
              <p className="mt-1.5 text-[12px] text-slate-500 leading-snug">
                与同事和 AI 分身一起协作 · 选择会话或新建一个
              </p>
            </div>
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-[10px] font-medium text-white shadow-sm"
              title={`${channels.length} 个频道 · 实时 SSE`}
            >
              {channels.length}
            </div>
          </div>

          {/* 新建按钮组: Gems 风 pill */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setShowCreateDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1.5 text-[12px] font-medium text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md"
              title="新建群聊 (普通/部门/项目/跨部门/公告)"
            >
              <Plus className="h-3.5 w-3.5" />
              新建
            </button>
            <button
              type="button"
              onClick={newDmPrompt}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              title="新建 1:1 对话"
            >
              <Users className="h-3.5 w-3.5" />
              1:1
            </button>
            <button
              type="button"
              onClick={() => setShowSeedDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-[12px] font-medium text-amber-700 transition hover:border-amber-300 hover:bg-amber-100/80"
              title="按组织架构一键建群 (HR/Admin)"
            >
              <Sparkles className="h-3.5 w-3.5" />
              一键建群
            </button>
          </div>
        </div>

        {/* Tab segmented control: Gems pill */}
        <div className="px-5 pb-2">
          <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-[12px]">
            <button
              type="button"
              onClick={() => setLeftTab('channels')}
              className={`rounded-full px-4 py-1 font-medium transition ${
                leftTab === 'channels'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              频道
            </button>
            <button
              type="button"
              onClick={() => setLeftTab('contacts')}
              className={`rounded-full px-4 py-1 font-medium transition ${
                leftTab === 'contacts'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              通讯录
            </button>
          </div>
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
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {channels.length === 0 && (
            <div className="mx-2 mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-2xl">
                💬
              </div>
              <p className="text-[12.5px] font-medium text-slate-700">还没有会话</p>
              <p className="mt-1 text-[11.5px] text-slate-500 leading-relaxed">
                点上方「新建」开一个群,<br />或「1:1」找同事单聊
              </p>
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
                className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-150 ${
                  active
                    ? 'bg-white shadow-sm ring-1 ring-slate-200/80'
                    : 'hover:bg-white/70 hover:shadow-sm'
                }`}
              >
                <GemChannelAvatar channel={c} name={displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-[13.5px] ${
                        u.show !== 'none'
                          ? 'font-semibold text-slate-900'
                          : 'font-medium text-slate-800'
                      }`}
                    >
                      {displayName}
                    </span>
                    {c.lastMessageAt && (
                      <span className="shrink-0 text-[10.5px] text-slate-400 font-medium">
                        {formatRelative(c.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11.5px] text-slate-500 leading-snug">
                      {c.lastMessagePreview ?? '开始对话…'}
                    </span>
                    {u.show === 'urgent' && (
                      <Badge
                        className="h-4 min-w-4 shrink-0 bg-rose-500 px-1.5 text-[10px] hover:bg-rose-600"
                        title="含指派/咨询/议事室回执 — 需关注"
                      >
                        {u.count! > 99 ? '99+' : u.count}
                      </Badge>
                    )}
                    {u.show === 'subtle' && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
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
                <GemChannelAvatar
                  channel={activeChannel}
                  name={
                    activeChannel.type === 'dm'
                      ? activeChannel.memberIds.find((m) => m !== ME) ?? '私聊'
                      : activeChannel.name
                  }
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
                <AgentModeToggle
                  channelId={activeChannel.id}
                  initialMode={members.find((m) => m.userId === ME)?.agentMode ?? 'manual'}
                />
                {activeChannel.type !== 'dm' && (
                  <button
                    type="button"
                    onClick={() => setShowSettings(true)}
                    className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--brand-50))] px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--brand-700))] hover:bg-[rgb(var(--brand-100))] transition-colors"
                    title="邀请新成员加入本群"
                  >
                    <Plus className="h-3 w-3" />
                    邀请
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200"
                  title="频道设置 (成员管理 / 公告 / 置顶 / 移除成员)"
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
                  meId={ME}
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
                <div className="flex flex-1 items-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-100">
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
                  className="h-11 gap-1.5 rounded-full bg-slate-900 px-5 text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  <Send className="h-3.5 w-3.5" />
                  发送
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-100 via-sky-100 to-emerald-100 text-4xl shadow-sm">
              ✨
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-700">选个会话开始</p>
              <p className="mt-1.5 text-[12px] text-slate-500 leading-relaxed max-w-xs">
                从左边选一个频道, 或点上方 <span className="font-medium text-slate-700">新建</span> / <span className="font-medium text-slate-700">1:1</span> 开一个。<br />
                发出的每条消息 hover 均可一键 <span className="font-medium text-amber-600">开议事室</span> 或 <span className="font-medium text-violet-600">沉淀 Memory</span>.
              </p>
            </div>
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

          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
              📝
            </div>
            <p className="text-[12px] text-slate-400 leading-relaxed">
              选个会话后<br />这里会显示频道详情·成员·文件
            </p>
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
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-2 text-[11px]">
      <div className="flex min-w-0 items-center gap-2 text-slate-500">
        <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
        <span className="truncate">
          <span className="font-medium text-slate-700">自建 IM</span> · 一键开议事室 · @Persona · 决议型已读
        </span>
        <a
          href="/docs/MANIFESTO.md#%E7%AC%AC%E5%8D%81%E5%85%AB%E6%9D%A1"
          className="shrink-0 text-slate-400 underline decoration-slate-200 underline-offset-2 hover:text-slate-600"
        >
          宪章 §18
        </a>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        title="收起"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="h-3 w-3" />
      </button>
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

/**
 * Gemini Gems 风频道头像 (左栏列表用):
 *   - 更大 (h-11 w-11), rounded-2xl (24px)
 *   - 渐变更柔, 阴影 shadow-md/shadow-sm
 *   - DM/group/announcement 三种语义保持区别
 */
function GemChannelAvatar({
  channel,
  name,
}: {
  channel: Channel;
  name: string;
}) {
  if (channel.type === 'announcement') {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-400 via-rose-500 to-pink-500 text-white shadow-md shadow-rose-200/60 ring-1 ring-white">
        <Megaphone className="h-5 w-5" />
      </div>
    );
  }
  if (channel.type === 'dm') {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 text-[15px] font-semibold uppercase text-white shadow-md shadow-slate-200/70 ring-1 ring-white">
        {name.slice(0, 2)}
      </div>
    );
  }
  const palette = [
    'from-amber-400 via-orange-400 to-orange-500 shadow-amber-200/60',
    'from-emerald-400 via-teal-400 to-teal-500 shadow-emerald-200/60',
    'from-sky-400 via-blue-400 to-blue-500 shadow-sky-200/60',
    'from-violet-400 via-purple-400 to-purple-500 shadow-violet-200/60',
    'from-pink-400 via-rose-400 to-rose-500 shadow-pink-200/60',
    'from-cyan-400 via-sky-400 to-sky-500 shadow-cyan-200/60',
  ];
  const idx = channel.id.charCodeAt(0) % palette.length;
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${palette[idx]} text-white shadow-md ring-1 ring-white`}
    >
      <Hash className="h-5 w-5" />
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
  meId,
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
  meId: string;
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
        <div className="rounded-full border border-slate-200/70 bg-slate-50 px-3 py-1 text-slate-400 italic">
          {msg.senderId === meId ? '你' : msg.senderId} 撤回了一条消息
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
  const isMe = msg.senderId === meId;

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
        {msg.senderId === meId && totalReaders > 0 && (
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
