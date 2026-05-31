'use client';

/**
 * EVO-1 · 决议节奏护栏 · Dashboard 卡片
 *
 * 极简 + 不打扰原则:
 *   - 无数据时整张卡片不渲染 (return null)
 *   - 最多 3 行 + 总数 badge
 *   - 永不弹 toast / 推送 / 弹窗
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, ArrowRight } from 'lucide-react';

type Urgency = 'due' | 'overdue';

interface PendingRetro {
  decisionId: string;
  title: string;
  decisionClass: 'simple' | 'complex' | 'strategic';
  daysSinceCommit: number;
  urgency: Urgency;
}

interface ApiResponse {
  items: PendingRetro[];
  hiddenCount: number;
  total: number;
}

const URGENCY_BADGE: Record<Urgency, { label: string; cls: string }> = {
  due: {
    label: '到期',
    cls: 'bg-warning/5 text-warning border-warning/20 dark:bg-warning/30',
  },
  overdue: {
    label: '逾期',
    cls: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30',
  },
};

const CLASS_LABEL = {
  simple: '简单决议',
  complex: '复杂决议',
  strategic: '战略决议',
} as const;

export function PendingRetrosCard() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/retro-pending')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) setData(j);
      })
      .catch(() => {
        /* 静默 · 不打扰 */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data || data.items.length === 0) return null;

  return (
    <div className="card-elevated overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-surface-2/40">
        <History className="h-4 w-4 text-ink-secondary" />
        <h3 className="text-callout text-ink-primary font-medium">该复盘的决议</h3>
        <span className="text-footnote text-ink-tertiary">
          · 共 {data.total} 条
          {data.hiddenCount > 0 && <> · 仅显示前 {data.items.length}</>}
        </span>
        <div className="flex-1" />
        <span className="text-[10px] text-ink-tertiary font-mono uppercase tracking-wider">
          EVO-1
        </span>
      </div>
      <ul className="divide-y divide-border">
        {data.items.map((r) => {
          const badge = URGENCY_BADGE[r.urgency];
          return (
            <li key={r.decisionId}>
              <Link
                href={`/convergence/${r.decisionId}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2 transition-colors duration-fast"
              >
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${badge.cls}`}
                >
                  {badge.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-ink-primary truncate">{r.title}</p>
                  <p className="mt-0.5 text-footnote text-ink-tertiary">
                    {CLASS_LABEL[r.decisionClass]} · 决议已 {r.daysSinceCommit} 天 ·
                    建议补一次复盘
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-ink-tertiary shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="px-5 py-2 text-footnote text-ink-tertiary bg-surface-2/30">
        节奏窗口: 简单 7-14 天 · 复杂 14-28 天 · 战略 30-60 天. 不强制, 不推送.
      </div>
    </div>
  );
}
