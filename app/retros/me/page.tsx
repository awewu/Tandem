'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Brain, AlertTriangle, Clock3, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';
import type { PendingRetro, RetroUrgency } from '@/lib/decisions/cadence';

const URGENCY_STYLE: Record<RetroUrgency, { badge: string; label: string }> = {
  fresh:   { badge: 'bg-surface-3 text-ink-secondary', label: '待复盘' },
  due:     { badge: 'bg-warning/10 text-warning', label: '即将过期' },
  overdue: { badge: 'bg-danger/10 text-danger', label: '已逾期' },
};

export default function MyRetrosPage() {
  const [items, setItems] = useState<PendingRetro[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/me/retro-pending?limit=50', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => {
        const list: PendingRetro[] = j.items ?? [];
        setItems(list);
        setHiddenCount(j.hiddenCount ?? 0);
        setStatus(list.length === 0 ? 'empty' : 'ok');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main className="container mx-auto max-w-2xl px-4 py-6 space-y-5">
      <div className="hero-ink p-5 sm:p-7 space-y-1">
        <h1 className="text-title-3 font-bold text-white flex items-center gap-2">
          <Brain className="h-5 w-5" style={{ color: 'rgb(var(--brand-300))' }} />
          我的复盘库
        </h1>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
          已 COMMIT 决议 · 待复盘清单
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16 text-ink-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载中…
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning bg-warning/5 px-4 py-3 text-caption text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> 加载失败，请刷新重试
        </div>
      )}

      {status === 'empty' && (
        <div className="surface-card p-10 text-center space-y-2">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <p className="text-caption text-ink-secondary">暂无待复盘决议</p>
          <p className="text-footnote text-ink-tertiary">
            COMMIT 后的决议到期将出现在这里，分身会定时提醒你复盘。
          </p>
        </div>
      )}

      {status === 'ok' && (
        <div className="space-y-3">
          {items.map((r) => {
            const style = URGENCY_STYLE[r.urgency];
            return (
              <Link
                key={r.decisionId}
                href={`/decisions/${r.decisionId}?tab=retro`}
                className="surface-card flex items-center gap-4 p-4 surface-interactive hover:border-brand-200 transition"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${r.urgency === 'overdue' ? 'bg-danger/10' : 'bg-surface-2'}`}>
                  {r.urgency === 'overdue'
                    ? <AlertTriangle className="h-4 w-4 text-danger" />
                    : <Clock3 className="h-4 w-4 text-ink-secondary" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-caption font-medium text-ink-primary truncate">{r.title}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.badge}`}>
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-footnote text-ink-tertiary">
                    决策类 {r.decisionClass} · COMMIT {r.daysSinceCommit} 天前
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />
              </Link>
            );
          })}
          {hiddenCount > 0 && (
            <p className="text-center text-footnote text-ink-tertiary py-2">
              还有 {hiddenCount} 条待复盘（已优先展示最紧急的）
            </p>
          )}
        </div>
      )}
    </main>
  );
}
