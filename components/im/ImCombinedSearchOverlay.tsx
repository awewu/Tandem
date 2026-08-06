'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Loader2, MessageSquare, Search, Users, X } from 'lucide-react';
import type { ImChannel, ImMembership } from '@/lib/types/im';
import { displayImChannelName } from '@/lib/im/channel-name';
import { cn } from '@/lib/utils';

type Channel = ImChannel & { unread?: number; membership?: ImMembership };

interface ImSearchResult {
  messageId: string;
  channelId: string;
  channelName: string;
  senderId: string;
  senderKind: 'user' | 'system' | 'persona';
  preview: string;
  createdAt: string;
}


interface Props {
  query: string;
  channels: Channel[];
  currentUserId: string;
  nameOf?: (userId: string) => string | undefined;
  onSelectChannel: (channelId: string) => void;
  onSelectMessage: (channelId: string, messageId: string) => void;
  onClose: () => void;
}

function formatTime(iso?: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, query: string) {
  const terms = query.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  return text.split(re).map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-warning/30 px-0.5 text-ink-primary">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function channelName(channel: Channel, currentUserId: string, nameOf?: (userId: string) => string | undefined): string {
  if (channel.type !== 'dm') return displayImChannelName(channel);
  return nameOf?.(channel.memberIds.find((m) => m !== currentUserId) ?? '') ?? '私聊';
}

function getMemberNames(channel: Channel, currentUserId: string, nameOf?: (userId: string) => string | undefined): string[] {
  return channel.memberIds
    .filter((memberId) => memberId !== currentUserId)
    .map((memberId) => nameOf?.(memberId) ?? memberId)
    .filter((name) => Boolean(name));
}

function getMatchingMemberIds(
  channel: Channel,
  query: string,
  currentUserId: string,
  nameOf?: (userId: string) => string | undefined,
): string[] {
  return channel.memberIds.filter((memberId) => {
    if (memberId === currentUserId) return false;
    const name = nameOf?.(memberId) ?? memberId;
    return includesQuery(name, query) || includesQuery(memberId, query);
  });
}

function includesQuery(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

async function fetchJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function ChannelRow({
  channel,
  query,
  currentUserId,
  nameOf,
  onSelect,
}: {
  channel: Channel;
  query: string;
  currentUserId: string;
  nameOf?: (userId: string) => string | undefined;
  onSelect: (channelId: string) => void;
}) {
  const name = channelName(channel, currentUserId, nameOf);
  const isDm = channel.type === 'dm';
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.id)}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-surface-3"
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white',
          isDm ? 'bg-brand-500' : 'bg-success',
        )}
      >
        {isDm ? name.slice(0, 2) : <Hash className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-ink-primary">{highlightText(name, query)}</span>
          <span className="shrink-0 text-[11px] text-ink-tertiary">{formatTime(channel.lastMessageAt)}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-ink-secondary">
          {highlightText(channel.lastMessagePreview ?? '', query)}
        </span>
      </span>
    </button>
  );
}

export function ImCombinedSearchOverlay({
  query,
  channels,
  currentUserId,
  nameOf,
  onSelectChannel,
  onSelectMessage,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ImSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllDm, setShowAllDm] = useState(false);
  const [showAllGroups, setShowAllGroups] = useState(false);
  const lastRequestedTermRef = useRef('');
  const CHANNEL_PREVIEW_LIMIT = 2;

  const term = query.trim();
  const dmChannels = useMemo(() => channels.filter((channel) => {
    if (channel.type !== 'dm') return false;
    return getMemberNames(channel, currentUserId, nameOf).some((name) => includesQuery(name, term));
  }), [channels, currentUserId, nameOf, term]);
  const groupChannels = useMemo(() => channels.filter((channel) => {
    if (channel.type === 'dm') return false;
    return getMatchingMemberIds(channel, term, currentUserId, nameOf).length > 0;
  }), [channels, currentUserId, nameOf, term]);

  useEffect(() => {
    if (!term) return;
    if (lastRequestedTermRef.current === term) return;
    lastRequestedTermRef.current = term;
    let cancelled = false;

    async function runSearch() {
    setLoading(true);
    setError(null);
    setMessages([]);
    try {
        const params = new URLSearchParams({ q: term });
        const { res, data } = await fetchJson(`/api/im/search?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? '搜索失败');
        return;
      }
      setMessages(data.results ?? []);
    } catch {
        if (cancelled) return;
      setError('聊天记录搜索接口请求失败');
    } finally {
        if (cancelled) return;
      setLoading(false);
    }
    }

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [term]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const empty = !loading && !error && dmChannels.length === 0 && groupChannels.length === 0 && messages.length === 0;
  const dmMoreCount = Math.max(0, dmChannels.length - CHANNEL_PREVIEW_LIMIT);
  const groupMoreCount = Math.max(0, groupChannels.length - CHANNEL_PREVIEW_LIMIT);
  const visibleDmChannels = showAllDm ? dmChannels : dmChannels.slice(0, CHANNEL_PREVIEW_LIMIT);
  const visibleGroupChannels = showAllGroups ? groupChannels : groupChannels.slice(0, CHANNEL_PREVIEW_LIMIT);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[10vh]" onClick={onClose}>
      <div
        className="flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
          <div className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink-primary">{query}</div>
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-tertiary" />}
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-tertiary hover:bg-surface-3 hover:text-ink-primary"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden py-2">
          <div className="max-h-[34vh] overflow-y-auto">
            {dmChannels.length > 0 && (
              <section>
              <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-ink-tertiary">
                <MessageSquare className="h-3.5 w-3.5" />
                个人聊天
              </div>
              {visibleDmChannels.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  query={query}
                  currentUserId={currentUserId}
                  nameOf={nameOf}
                  onSelect={onSelectChannel}
                />
              ))}
              {dmMoreCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllDm((v) => !v)}
                  className="px-4 py-1 text-left text-[11px] text-ink-tertiary hover:text-ink-primary"
                >
                  {showAllDm ? '收起个人聊天' : `还有 ${dmMoreCount} 个个人聊天`}
                </button>
              )}
              </section>
            )}

            {groupChannels.length > 0 && (
              <section>
              <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-ink-tertiary">
                <Users className="h-3.5 w-3.5" />
                群聊
              </div>
              {visibleGroupChannels.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  query={query}
                  currentUserId={currentUserId}
                  nameOf={nameOf}
                  onSelect={onSelectChannel}
                />
              ))}
              {groupMoreCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllGroups((v) => !v)}
                  className="px-4 py-1 text-left text-[11px] text-ink-tertiary hover:text-ink-primary"
                >
                  {showAllGroups ? '收起群聊' : `还有 ${groupMoreCount} 个群聊`}
                </button>
              )}
              </section>
            )}
          </div>

          <section className="flex min-h-0 flex-1 flex-col border-t border-hairline">
            <div className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-ink-tertiary">
              <Search className="h-3.5 w-3.5" />
              聊天记录
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {error && <div className="px-4 py-8 text-center text-[13px] text-ink-tertiary">{error}</div>}
              {!loading && !error && messages.length === 0 && (
                <div className="px-4 py-4 text-[13px] text-ink-tertiary">没有匹配的聊天记录</div>
              )}
              {messages.map((message) => (
                <button
                  key={message.messageId}
                  type="button"
                  onClick={() => onSelectMessage(message.channelId, message.messageId)}
                  className="flex w-full flex-col gap-1 border-t border-hairline px-4 py-3 text-left hover:bg-surface-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-medium text-brand-600">{message.channelName}</span>
                    <span className="shrink-0 text-[11px] text-ink-tertiary">{formatTime(message.createdAt)}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-[12px] text-ink-secondary">
                      {nameOf?.(message.senderId) ?? message.senderId}
                      {message.senderKind === 'persona' ? '(分身)' : message.senderKind === 'system' ? '(系统)' : ''}:
                    </span>
                    <span className="line-clamp-2 text-[13px] text-ink-primary">{highlightText(message.preview, query)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {empty && <div className="px-4 py-12 text-center text-[13px] text-ink-tertiary">没有找到相关内容</div>}
        </div>
      </div>
    </div>
  );
}
