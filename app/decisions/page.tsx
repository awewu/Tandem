'use client';

/**
 * /decisions · 决议台账
 *
 * 把已生效 / 进行中的决议汇总成台账:
 *   - 顶部 HeatMap: 近 12 周决议密度 (组织活力)
 *   - 列表: 最近 50 条决议, 点进 /decisions/[id] 看只读详情 (DecisionCardView)
 *
 * 数据源: GET /api/convergence (按 createdAt 倒序, tenant 隔离)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeatMap } from '@/components/decision-card/HeatMap';
import { ScrollText, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import type { DecisionCard } from '@/lib/types';

const STATE_META: Record<string, { label: string; className: string }> = {
  DIVERGE: { label: '审议中', className: 'bg-info/10 text-info' },
  CONVERGE: { label: '收敛中', className: 'bg-purple-100 text-purple-700' },
  COMMIT: { label: '已生效', className: 'bg-emerald-100 text-emerald-700' },
  ESCALATED: { label: '已升级', className: 'bg-warning/10 text-warning' },
  VETOED: { label: '已否决', className: 'bg-danger/10 text-danger' },
};

const CLASS_LABEL: Record<string, string> = {
  simple: '常规',
  complex: '复杂',
  strategic: '战略',
};

export default function DecisionsPage() {
  const [cards, setCards] = useState<DecisionCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/convergence', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`加载失败 (${r.status})`))))
      .then((d: { cards: DecisionCard[] }) => setCards(d.cards ?? []))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <main className="container mx-auto max-w-4xl py-6 px-4 md:px-8 space-y-6">
      <header>
        <h1 className="text-title-2 text-ink-primary flex items-center gap-2">
          <ScrollText className="h-6 w-6 text-[rgb(var(--brand-600))]" />
          决议台账
        </h1>
        <p className="mt-1 text-caption text-ink-tertiary">
          全部议事决议的汇总视图 · 点击任意决议查看方案 / 行动项 / 复盘
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {cards === null && !error && (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载决议台账…
        </div>
      )}

      {cards !== null && (
        <>
          <HeatMap cards={cards} />

          <Card>
            <CardContent className="p-0">
              {cards.length === 0 ? (
                <div className="p-8 text-center text-caption text-muted-foreground">
                  暂无决议. 去 <Link href="/convergence" className="text-[rgb(var(--brand-600))] hover:underline">议事室</Link> 发起第一个议题.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {cards.map((card) => {
                    const state = STATE_META[card.convergenceState] ?? STATE_META.DIVERGE;
                    return (
                      <li key={card.id} className="cv-auto">
                        <Link
                          href={`/decisions/${card.id}`}
                          className="flex items-center gap-3 px-4 py-3 surface-interactive hover:bg-surface-2"
                        >
                          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-footnote font-medium ${state.className}`}>
                            {state.label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-body text-ink-primary">{card.title}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-footnote text-muted-foreground">
                              <Badge variant="outline" className="text-footnote">
                                {CLASS_LABEL[card.decisionClass] ?? card.decisionClass}
                              </Badge>
                              <span>{formatDate(card.createdAt)}</span>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}
