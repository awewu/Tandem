'use client';

/**
 * /decisions/[id] · 决议只读详情
 *
 * 用 DecisionCardView 渲染单条决议的完整信息:
 *   最终方案 / Action Items / 关联 KR-TTI / 24h 否决窗 / 复盘.
 *
 * 数据源: GET /api/convergence/[id] → { card }
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { DecisionCardView } from '@/components/decision-card/DecisionCardView';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { DecisionCard } from '@/lib/types';

export default function DecisionDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = (params instanceof Promise ? use(params) : params) as { id: string };
  const [card, setCard] = useState<DecisionCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/convergence/${resolved.id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`加载失败 (${r.status})`))))
      .then((d: { card: DecisionCard }) => setCard(d.card))
      .catch((e) => setError((e as Error).message));
  }, [resolved.id]);

  return (
    <main className="container mx-auto max-w-4xl py-6 px-4 md:px-8 space-y-4">
      <Link
        href="/decisions"
        className="inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-ink-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        返回决议台账
      </Link>

      {error && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 p-4 text-danger flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
        </div>
      )}

      {!card && !error && (
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载决议…
        </div>
      )}

      {card && <DecisionCardView card={card} />}
    </main>
  );
}
