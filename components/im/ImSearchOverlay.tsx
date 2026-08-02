'use client';

/**
 * IM 搜索浮层 (§Sprint1 Megaplan · 全文 + 语义消息搜索)
 *
 * - 输入 debounce 300ms → GET /api/im/search
 * - 结果点击 → onSelect(channelId, messageId) (页面导航并高亮定位)
 * - ESC / 点遮罩关闭
 * - 只呈现服务端已按权限过滤的结果 (越权频道消息不会返回)
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

export interface ImSearchResult {
  messageId: string;
  channelId: string;
  channelName: string;
  senderId: string;
  senderKind: 'user' | 'system' | 'persona';
  preview: string;
  createdAt: string;
  score: number;
}

interface Props {
  /** 限定单频道搜索 (在频道内点搜索时传入)。不传 = 全部可见频道。 */
  channelId?: string;
  nameOf?: (userId: string) => string | undefined;
  onSelect: (channelId: string, messageId: string) => void;
  onClose: () => void;
}

function formatTime(iso: string): string {
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

/**
 * 高亮预览中命中的关键词 (词面一路才会命中; 语义只命中无字面化 → 不高亮。
 * 多词按空白拆分后做 alternation 匹配。split 捕获组使奇数位为命中段。
 */
function highlightMatch(text: string, query: string): ReactNode {
  const terms = query.trim().split(/\s+/).filter((t) => t.length > 0).map(escapeRegExp);
  if (terms.length === 0) return text;
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(re);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-warning/30 px-0.5 text-ink-primary">
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function ImSearchOverlay({ channelId, nameOf, onSelect, onClose }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ImSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const runSearch = useCallback(
    async (query: string) => {
      const term = query.trim();
      if (!term) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: term });
        if (channelId) params.set('channelId', channelId);
        const res = await fetch(`/api/im/search?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json();
        setResults(res.ok ? (data.results ?? []) : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    },
    [channelId],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(q), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[72vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-surface-1 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 输入 */}
        <div className="flex shrink-0 items-center gap-2 border-b border-hairline px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-tertiary" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={channelId ? '搜本群消息…' : '搜索全部消息…'}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink-primary outline-none placeholder:text-ink-tertiary"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-ink-tertiary" />}
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-tertiary hover:bg-surface-3"
            title="关闭 (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 结果 */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {searched && !loading && results.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-ink-tertiary">
              <Search className="h-6 w-6" />
              <p className="text-[13px]">没有找到相关消息</p>
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.messageId}
              type="button"
              onClick={() => onSelect(r.channelId, r.messageId)}
              className="flex w-full flex-col gap-1 border-b border-hairline px-4 py-3 text-left hover:bg-surface-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-medium text-brand-600">{r.channelName}</span>
                <span className="shrink-0 text-[11px] text-ink-tertiary">{formatTime(r.createdAt)}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="shrink-0 text-[12px] text-ink-secondary">
                  {(nameOf?.(r.senderId) ?? r.senderId)}
                  {r.senderKind === 'persona' ? '(分身)' : r.senderKind === 'system' ? '(系统)' : ''}:
                </span>
                <span className="line-clamp-2 text-[13px] text-ink-primary">{highlightMatch(r.preview, q)}</span>
              </div>
            </button>
          ))}
          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center gap-1 py-12 text-ink-tertiary">
              <p className="text-[13px]">输入关键词搜索历史消息</p>
              <p className="text-[11px]">支持关键词与语义搜索</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
