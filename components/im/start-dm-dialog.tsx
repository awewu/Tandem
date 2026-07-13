'use client';

/**
 * 发起单聊对话框 (2026-06-30)
 *
 * IM 此前没有"找人单聊"的入口: DM 只能通过 window.prompt(输入 userId) 或
 * 个人名片"发消息"触发. 本对话框提供通讯录式搜索 → 选人 → 建/找 DM 频道.
 *
 * 后端: POST /api/im/dm { otherId } (meId 取自登录身份) → { channel }, 幂等.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Search, MessageSquarePlus } from 'lucide-react';

interface OrgUser {
  id: string;
  name: string;
  email?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 当前登录用户 ID — 用于从结果里排除自己 */
  currentUserId: string;
  /** 建/找 DM 成功后回调, 父组件应刷新 channels 并切到该频道 */
  onStarted: (channelId: string) => void;
}

export function StartDmDialog({ open, onOpenChange, currentUserId, onStarted }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q.trim()
        ? `/api/org/users?q=${encodeURIComponent(q)}`
        : '/api/org/users';
      const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
      const data = await res.json();
      const users: OrgUser[] = (data.users ?? []).filter((u: OrgUser) => u.id !== currentUserId);
      setResults(users.slice(0, 30));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  // 打开时重置并拉默认列表; 关闭时清空
  useEffect(() => {
    if (open) {
      setQuery('');
      setError(null);
      void search('');
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setResults([]);
    }
  }, [open, search]);

  // 输入防抖搜索
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void search(query), 200);
    return () => clearTimeout(t);
  }, [query, open, search]);

  async function pick(user: OrgUser) {
    if (busyId) return;
    setBusyId(user.id);
    setError(null);
    try {
      const res = await fetch('/api/im/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ otherId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.channel?.id) {
        onStarted(data.channel.id);
        onOpenChange(false);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" />
            发起单聊
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索姓名或邮箱…"
            className="flex-1 bg-transparent text-footnote outline-none placeholder:text-muted-foreground"
          />
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-footnote text-destructive">
            {error}
          </div>
        )}

        <div className="-mx-1 flex-1 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="py-6 text-center text-footnote text-muted-foreground">搜索中…</div>
          )}
          {!loading && results.length === 0 && (
            <div className="py-6 text-center text-footnote text-muted-foreground">
              {query.trim() ? '无匹配的同事' : '暂无可单聊的同事'}
            </div>
          )}
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={!!busyId}
              onClick={() => pick(u)}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent disabled:opacity-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 text-[11px] font-semibold uppercase text-white">
                {(u.name || u.id).slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-medium text-ink-primary">{u.name || u.id}</div>
                {u.email && <div className="truncate text-[10px] text-muted-foreground">{u.email}</div>}
              </div>
              {busyId === u.id && (
                <span className="shrink-0 text-[10px] text-muted-foreground">打开中…</span>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
