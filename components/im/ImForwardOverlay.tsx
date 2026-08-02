'use client';

/**
 * IM 转发浮层 (§Sprint2 Megaplan · 消息转发)
 *
 * - 拉当前用户可见频道 → 选目标频道 → POST /api/im/messages/forward
 * - 单条转发 (merge=false); 合并转发的多选 UI 后续迭代
 * - ESC / 点遮罩关闭; 只显示服务端已按权限返回的频道
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Forward, X, Loader2, Search } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  type: string;
  memberIds: string[];
}

interface Props {
  meId: string;
  /** 待转发的源消息 id (当前为单条) */
  messageIds: string[];
  /** 转发成功回调 (目标频道 id) */
  onForwarded: (toChannelId: string) => void;
  onClose: () => void;
}

export default function ImForwardOverlay({ meId, messageIds, onForwarded, onClose }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/im/channels?userId=${encodeURIComponent(meId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setChannels(data.channels ?? []);
      })
      .catch(() => {
        if (!cancelled) setChannels([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meId]);

  const forwardTo = useCallback(
    async (toChannelId: string) => {
      if (sendingTo) return;
      setSendingTo(toChannelId);
      try {
        const res = await fetch('/api/im/messages/forward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fromMessageIds: messageIds, toChannelId }),
        });
        if (res.ok) {
          onForwarded(toChannelId);
          onClose();
        }
      } finally {
        setSendingTo(null);
      }
    },
    [messageIds, onForwarded, onClose, sendingTo],
  );

  const term = filter.trim().toLowerCase();
  const visible = term
    ? channels.filter((c) => (c.name ?? '').toLowerCase().includes(term))
    : channels;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-3">
          <Forward className="h-4 w-4 shrink-0 text-ink-tertiary" />
          <span className="flex-1 text-[14px] font-medium text-ink-primary">转发到…</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-tertiary hover:bg-surface-3"
            title="关闭 (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-2">
          <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
          <input
            ref={inputRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索会话…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink-primary outline-none placeholder:text-ink-tertiary"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-ink-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[13px]">加载会话…</span>
            </div>
          )}
          {!loading && visible.length === 0 && (
            <div className="py-10 text-center text-[13px] text-ink-tertiary">没有可转发的会话</div>
          )}
          {visible.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={sendingTo !== null}
              onClick={() => void forwardTo(c.id)}
              className="flex w-full items-center justify-between gap-2 border-b border-hairline px-4 py-3 text-left hover:bg-surface-3 disabled:opacity-60"
            >
              <span className="truncate text-[14px] text-ink-primary">{c.name || c.id}</span>
              {sendingTo === c.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-tertiary" />
              ) : (
                <Forward className="h-4 w-4 shrink-0 text-ink-tertiary" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
