'use client';

/**
 * ImSidebar — 企业微信式会话列表面板
 *
 * 渲染在 SubSidebar 内 (对 /im 路由替代静态 nav items).
 * 会话选择通过 router.push('/im?ch=<id>') 驱动, 与消息流解耦.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { usePersonNameResolver } from '@/lib/org/people-source';
import { CreateChannelDialog } from '@/components/im/create-channel-dialog';
import { SeedFromOrgDialog } from '@/components/im/seed-from-org-dialog';
import { StartDmDialog } from '@/components/im/start-dm-dialog';
import { useHandoffPrefill } from '@/hooks/useHandoffPrefill';
import { cn } from '@/lib/utils';
import type { ImChannel, ImMembership } from '@/lib/types/im';
import { displayImChannelName } from '@/lib/im/channel-name';
import { Hash, Megaphone, Plus, Search, Bot, AtSign, MessageSquare, MessageSquarePlus, Users, Bookmark, BellDot, Building2, UsersRound } from 'lucide-react';

type Channel = ImChannel & { unread?: number; membership?: ImMembership };

type FilterGroup = 'all' | 'unread' | 'at' | 'dm' | 'group' | 'dept' | 'marked';

const FILTER_TABS: { id: FilterGroup; label: string; icon: React.ElementType }[] = [
  { id: 'unread', label: '未读', icon: BellDot },
  { id: 'at', label: '@我', icon: AtSign },
  { id: 'dm', label: '单聊', icon: MessageSquare },
  { id: 'group', label: '群聊', icon: Users },
  { id: 'dept', label: '部门群', icon: Building2 },
  { id: 'marked', label: '标记', icon: Bookmark },
];

function unreadStyle(channel: Channel): { show: 'none' | 'subtle' | 'urgent'; count?: number } {
  if (!channel.unread || channel.unread <= 0) return { show: 'none' };
  const preview = channel.lastMessagePreview ?? '';
  const isUrgent =
    preview.includes('🏛️') ||
    /\(assign\)|\(consult\)/.test(preview) ||
    /^@/.test(preview);
  return isUrgent ? { show: 'urgent', count: channel.unread } : { show: 'subtle', count: channel.unread };
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
    'from-warning/30 to-warning',
    'from-success/30 to-success',
    'from-info/30 to-info',
    'from-brand-400 to-brand-500',
    'from-brand-300 to-danger',
    'from-info/30 to-info',
  ];
  if (channel.type === 'announcement') {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-danger/30 to-danger text-white`}>
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
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-500 ring-1 ring-white">
            <Bot className="h-2 w-2 text-white" />
          </span>
        )}
      </div>
    );
  }
  if (channel.type === 'team') {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-info/40 to-brand-500 text-white`}>
        <UsersRound className={collapsed ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </div>
    );
  }
  if (channel.type === 'department') {
    return (
      <div className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-info/30 to-info text-white`}>
        <Building2 className={collapsed ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
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
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const ME = user?.id ?? 'demo-user';
  const nameOf = usePersonNameResolver();
  const canManageOrgGroups = user?.permissions?.includes('organization.manage') ?? false;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterGroup>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showDm, setShowDm] = useState(false);
  const [showSeedOrg, setShowSeedOrg] = useState(false);
  const [handoffDraft, setHandoffDraft] = useState<{ name?: string; topic?: string } | null>(null);

  const activeId = searchParams?.get('ch') ?? null;
  const isImRoute = pathname?.startsWith('/im') ?? false;

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
      // 首次加载自动选第一个 — 仅桌面端 (md+).
      // 移动端 SubSidebar 隐藏, /im 入口应停留在会话选择页, 不能自动跳进对话框.
      if (isImRoute && !activeId && list.length > 0) {
        const isDesktop =
          typeof window !== 'undefined' &&
          window.matchMedia('(min-width: 768px)').matches;
        if (isDesktop) router.replace(`/im?ch=${list[0].id}`);
      }
    } catch { /* ignore */ }
  }, [ME, activeId, isImRoute, router]);

  useEffect(() => { void loadChannels(); }, [loadChannels]);

  // 兜底刷新会话列表。当前聊天区标已读/发消息后会派发事件立即刷新。
  useEffect(() => {
    const refresh = () => void loadChannels();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('tandem:im-channels-refresh', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const id = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void loadChannels();
    }, 30_000);
    return () => {
      window.removeEventListener('tandem:im-channels-refresh', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(id);
    };
  }, [loadChannels]);

  useEffect(() => {
    const es = new EventSource('/api/im/stream');
    const refresh = () => void loadChannels();
    es.addEventListener('unread', refresh);
    es.addEventListener('channel', refresh);
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, [loadChannels]);

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
      list = list.filter((c) => c.type === 'group' || c.type === 'announcement' || c.type === 'project' || c.type === 'cross_dept');
    } else if (activeFilter === 'dept') {
      list = list.filter((c) => c.type === 'department' || c.type === 'team');
    } else if (activeFilter === 'marked') {
      list = list.filter((c) => !!(c.membership?.markedChat));
    }
    // 再按搜索词
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((c) => {
      const name = c.type === 'dm' ? nameOf(c.memberIds.find((m) => m !== ME)) : displayImChannelName(c);
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
    group: channels.filter((c) => c.type === 'group' || c.type === 'announcement' || c.type === 'project' || c.type === 'cross_dept').length,
    dept: channels.filter((c) => c.type === 'department' || c.type === 'team').length,
    marked: channels.filter((c) => !!(c.membership?.markedChat)).length,
  }), [channels]);

  // 总未读数 (AppRail 角标用)
  const totalUnread = useMemo(
    () => channels.reduce((s, c) => s + (c.unread ?? 0), 0),
    [channels],
  );

  function selectChannel(id: string) {
    router.replace(`/im?ch=${encodeURIComponent(id)}`);
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
        {canManageOrgGroups && (
          <button
            type="button"
            onClick={() => setShowSeedOrg(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3"
            title="按组织架构同步部门群"
          >
            <Building2 className="h-4 w-4" />
          </button>
        )}
        {filteredChannels.slice(0, 12).map((c) => {
          const displayName = c.type === 'dm' ? (nameOf(c.memberIds.find((m) => m !== ME)) || '?') : displayImChannelName(c);
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
              {u.show !== 'none' && (
                <span className={cn(
                  'absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[8px] font-bold text-white',
                  u.show === 'urgent' ? 'bg-danger' : 'bg-success',
                )}>
                  {(u.count ?? 0) > 9 ? '9+' : u.count}
                </span>
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
        <SeedFromOrgDialog
          open={showSeedOrg}
          onOpenChange={setShowSeedOrg}
          currentUserId={ME}
          onSeeded={() => void loadChannels()}
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
            <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
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

      {canManageOrgGroups && (
        <div className="shrink-0 px-2 pb-2">
          <button
            type="button"
            onClick={() => setShowSeedOrg(true)}
            className="flex w-full items-center gap-2 rounded-md border border-hairline bg-surface-2 px-2.5 py-2 text-left text-[12px] font-medium text-ink-primary transition-colors hover:bg-surface-3"
            title="按照 HR 组织结构自动生成体系群和部门群"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
              <Building2 className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate">同步组织群</span>
          </button>
        </div>
      )}

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
                    active ? 'bg-brand-500 text-white' : 'bg-danger text-white',
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
              : activeFilter === 'dept' ? '还没有部门群'
              : activeFilter === 'marked' ? '还没有标记的会话'
              : '还没有会话'}
          </div>
        )}
        {filteredChannels.map((c) => {
          const displayName = c.type === 'dm' ? (nameOf(c.memberIds.find((m) => m !== ME)) || '私聊') : displayImChannelName(c);
          const u = unreadStyle(c);
          const active = activeId === c.id;

          return (
            <Link
              key={c.id}
              href={`/im?ch=${encodeURIComponent(c.id)}`}
              scroll={false}
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
                  {u.show !== 'none' && (
                    <span className={cn(
                      'flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white',
                      u.show === 'urgent' ? 'bg-danger' : 'bg-success',
                    )}>
                      {(u.count ?? 0) > 99 ? '99+' : u.count}
                    </span>
                  )}
                </div>
              </div>
            </Link>
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
      <SeedFromOrgDialog
        open={showSeedOrg}
        onOpenChange={setShowSeedOrg}
        currentUserId={ME}
        onSeeded={() => void loadChannels()}
      />
    </div>
  );
}
