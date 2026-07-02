'use client';

/**
 * ImSidebar — 企业微信式会话列表面板
 *
 * 渲染在 SubSidebar 内 (对 /im 路由替代静态 nav items).
 * 会话选择通过 router.push('/im?ch=<id>') 驱动, 与消息流解耦.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { usePersonNameResolver } from '@/lib/org/people-source';
import { CreateChannelDialog } from '@/components/im/create-channel-dialog';
import { StartDmDialog } from '@/components/im/start-dm-dialog';
import { useHandoffPrefill } from '@/hooks/useHandoffPrefill';
import { cn } from '@/lib/utils';
import type { ImChannel, ImMembership } from '@/lib/types/im';
import { Hash, Megaphone, Plus, Search, Bot, AtSign, MessageSquare, MessageSquarePlus, Users, Bookmark, BellDot } from 'lucide-react';

type Channel = ImChannel & { unread?: number; membership?: ImMembership };

type FilterGroup = 'all' | 'unread' | 'at' | 'dm' | 'group' | 'marked';

const FILTER_TABS: { id: FilterGroup; label: string; icon: React.ElementType }[] = [
  { id: 'unread', label: '未读', icon: BellDot },
  { id: 'at', label: '@我', icon: AtSign },
  { id: 'dm', label: '单聊', icon: MessageSquare },
  { id: 'group', label: '群聊', icon: Users },
  { id: 'marked', label: '标记', icon: Bookmark },
];

function unreadStyle(channel: Channel): { show: 'none' | 'subtle' | 'urgent'; count?: number } {
  if (!channel.unread || channel.unread <= 0) return { show: 'none' };
  const preview = channel.lastMessagePreview ?? '';
  const isUrgent =
    preview.includes('🏛️') ||
    /\(assign\)|\(consult\)/.test(preview) ||
    /^@/.test(preview);
  return isUrgent ? { show: 'urgent', count: channel.unread } : { show: 'subtle' };
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
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function ConvAvatar({ channel, name, collapsed }: { channel: Channel; name: string; collapsed?: boolean }) {
  const size = collapsed ? 'h-8 w-8' : 'h-9 w-9';
  const palette = [
    'from-amber-400 to-orange-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-blue-500',
    'from-violet-400 to-purple-500',
    'from-pink-400 to-rose-500',
    'from-cyan-400 to-sky-500',
  ];
  if (channel.type === 'announcement') {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-rose-400 to-rose-500 text-white`}>
        <Megaphone className={collapsed ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </div>
    );
  }
  if (channel.type === 'dm') {
    const idx = (name.codePointAt(0) ?? 0) % palette.length;
    return (
      <div className={`${size} relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${palette[idx]} text-[11px] font-semibold uppercase text-white`}>
        {name.slice(0, 2)}
        {/* 分身在群里发言过 → 小机器人角标 */}
        {channel.lastMessagePreview?.includes('[AI分身]') && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-500 ring-1 ring-white">
            <Bot className="h-2 w-2 text-white" />
          </span>
        )}
      </div>
    );
  }
  const idx = channel.id.charCodeAt(0) % palette.length;
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${palette[idx]} text-white`}>
      <Hash className={collapsed ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </div>
  );
}

export function ImSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();
  const ME = user?.id ?? 'demo-user';
  const nameOf = usePersonNameResolver();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDm, setShowDm] = useState(false);
  const [handoffDraft, setHandoffDraft] = useState<{ name?: string; topic?: string } | null>(null);

  const activeId = searchParams?.get('ch') ?? null;

  useHandoffPrefill('im', (payload) => {
    setHandoffDraft({ name: payload.title, topic: payload.body });
    setShowCreate(true);
  });

  const loadChannels = useCallback(async () => {
    try {
      const res = await fetch(`/api/im/channels?userId=${ME}`, { cache: 'no-store' });
      const data = await res.json();
      const list: Channel[] = data.channels ?? [];
      setChannels(list);
      // 首次加载自动选第一个
      if (!activeId && list.length > 0) {
        router.replace(`/im?ch=${list[0].id}`);
      }
    } catch { /* ignore */ }
  }, [ME, activeId, router]);

  useEffect(() => { void loadChannels(); }, [loadChannels]);

  // 每 10s 轮询未读
  useEffect(() => {
    const id = setInterval(() => void loadChannels(), 10_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听 SSE unread 事件 (跨频道) — 当 activeId 变化时重建
  useEffect(() => {
    if (!activeId) return;
    const es = new EventSource(`/api/im/channels/${activeId}/stream?userId=${ME}`);
    es.addEventListener('unread', () => void loadChannels());
    es.addEventListener('channel', () => void loadChannels());
    return () => es.close();
  }, [activeId, ME, loadChannels]);

  const filteredChannels = useMemo(() => {
    let list = channels;
    // 先按分组 filter
    if (activeFilter === 'unread') {
      list = list.filter((c) => (c.unread ?? 0) > 0);
    } else if (activeFilter === 'at') {
      list = list.filter((c) => !!(c.membership?.hasUnreadMention));
    } else if (activeFilter === 'dm') {
      list = list.filter((c) => c.type === 'dm');
    } else if (activeFilter === 'group') {
      list = list.filter((c) => c.type === 'group' || c.type === 'announcement');
    } else if (activeFilter === 'marked') {
      list = list.filter((c) => !!(c.membership?.markedChat));
    }
    // 再按搜索词
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => {
      const name = c.type === 'dm' ? nameOf(c.memberIds.find((m) => m !== ME)) : c.name;
      return (
        name.toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? '').toLowerCase().includes(q)
      );
    });
  }, [channels, search, activeFilter, ME, nameOf]);

  // 各分组未读计数
  const groupCounts = useMemo(() => ({
    unread: channels.filter((c) => (c.unread ?? 0) > 0).length,
    at: channels.filter((c) => !!(c.membership?.hasUnreadMention)).length,
    dm: channels.filter((c) => c.type === 'dm').length,
    group: channels.filter((c) => c.type === 'group' || c.type === 'announcement').length,
    marked: channels.filter((c) => !!(c.membership?.markedChat)).length,
  }), [channels]);

  // 总未读数 (AppRail 角标用)
  const totalUnread = useMemo(
    () => channels.reduce((s, c) => s + (c.unread ?? 0), 0),
    [channels],
  );

  function selectChannel(id: string) {
    router.push(`/im?ch=${id}`);
  }

  if (collapsed) {
    // 折叠态: 只显示头像列 + 未读点
    return (
      <div className="flex flex-col items-center gap-1 py-2">
        <button
          type="button"
          onClick={() => setShowDm(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3"
          title="发起单聊"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3"
          title="新建会话"
        >
          <Plus className="h-4 w-4" />
        </button>
        {filteredChannels.slice(0, 12).map((c) => {
          const displayName = c.type === 'dm' ? (nameOf(c.memberIds.find((m) => m !== ME)) || '?') : c.name;
          const u = unreadStyle(c);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => selectChannel(c.id)}
              title={displayName}
              className={cn('relative', activeId === c.id && 'ring-2 ring-brand-500 rounded-full')}
            >
              <ConvAvatar channel={c} name={displayName} collapsed />
              {u.show === 'urgent' && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[8px] font-bold text-white">
                  {(u.count ?? 0) > 9 ? '9+' : u.count}
                </span>
              )}
              {u.show === 'subtle' && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white" />
              )}
            </button>
          );
        })}
        <CreateChannelDialog
          open={showCreate}
          onOpenChange={(v) => { setShowCreate(v); if (!v) setHandoffDraft(null); }}
          currentUserId={ME}
          prefillDraft={handoffDraft}
          onCreated={(id) => { void loadChannels(); selectChannel(id); }}
        />
        <StartDmDialog
          open={showDm}
          onOpenChange={setShowDm}
          currentUserId={ME}
          onStarted={(id) => { void loadChannels(); selectChannel(id); }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶栏: 标题 + 新建 */}
      <div className="flex shrink-0 items-center justify-between px-3 pb-2 pt-1">
        <span className="text-[13px] font-semibold text-ink-primary">
          消息
          {totalUnread > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setShowDm(true)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
            title="发起单聊"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3 hover:text-ink-primary"
            title="新建会话"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 搜索框 */}
      <div className="shrink-0 px-2 pb-2">
        <div className="flex items-center gap-1.5 rounded-md bg-surface-3 px-2.5 py-1.5">
          <Search className="h-3 w-3 shrink-0 text-ink-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索"
            className="flex-1 bg-transparent text-[12px] text-ink-primary placeholder:text-ink-tertiary outline-none"
          />
        </div>
      </div>

      {/* 分组 tabs */}
      <div className="shrink-0 overflow-x-auto px-2 pb-2">
        <div className="flex gap-1">
          {FILTER_TABS.map(({ id, label, icon: Icon }) => {
            const cnt = groupCounts[id as keyof typeof groupCounts];
            const active = activeFilter === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveFilter(active ? 'all' : id)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-brand-100 text-brand-700'
                    : 'bg-surface-3 text-ink-secondary hover:bg-surface-3 hover:text-ink-primary',
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
                {cnt > 0 && (
                  <span className={cn(
                    'inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold',
                    active ? 'bg-brand-500 text-white' : 'bg-rose-500 text-white',
                  )}>
                    {cnt > 99 ? '99+' : cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 会话列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredChannels.length === 0 && (
          <div className="px-3 py-8 text-center text-[12px] text-ink-tertiary">
            {search
              ? '无匹配结果'
              : activeFilter === 'unread' ? '没有未读消息'
              : activeFilter === 'at' ? '没有 @ 我的消息'
              : activeFilter === 'dm' ? '还没有单聊'
              : activeFilter === 'group' ? '还没有群聊'
              : activeFilter === 'marked' ? '还没有标记的会话'
              : '还没有会话'}
          </div>
        )}
        {filteredChannels.map((c) => {
          const displayName = c.type === 'dm' ? (nameOf(c.memberIds.find((m) => m !== ME)) || '私聊') : c.name;
          const u = unreadStyle(c);
          const active = activeId === c.id;

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => selectChannel(c.id)}
              className={cn(
                'flex w-full items-center gap-2.5 px-2 py-2 text-left transition-colors',
                active
                  ? 'bg-brand-50'
                  : 'hover:bg-surface-3',
              )}
            >
              <ConvAvatar channel={c} name={displayName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className={cn(
                    'truncate text-[12.5px]',
                    active ? 'font-semibold text-brand-700' : u.show !== 'none' ? 'font-semibold text-ink-primary' : 'text-ink-primary',
                  )}>
                    {displayName}
                  </span>
                  <span className="shrink-0 text-[10px] text-ink-tertiary">
                    {c.lastMessageAt ? formatRelative(c.lastMessageAt) : ''}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-1">
                  <span className="truncate text-[11px] text-ink-secondary">
                    {c.lastMessagePreview ?? ''}
                  </span>
                  {u.show === 'urgent' && (
                    <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                      {(u.count ?? 0) > 99 ? '99+' : u.count}
                    </span>
                  )}
                  {u.show === 'subtle' && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <CreateChannelDialog
        open={showCreate}
        onOpenChange={(v) => { setShowCreate(v); if (!v) setHandoffDraft(null); }}
        currentUserId={ME}
        prefillDraft={handoffDraft}
        onCreated={(id) => { void loadChannels(); selectChannel(id); }}
      />
      <StartDmDialog
        open={showDm}
        onOpenChange={setShowDm}
        currentUserId={ME}
        onStarted={(id) => { void loadChannels(); selectChannel(id); }}
      />
    </div>
  );
}
