'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ScrollText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface DecisionCardSummary {
  id: string;
  title: string;
  decisionClass: string;
  convergenceState: string;
  elapsedSeconds: number;
  selected?: string;
  createdAt: string;
}

const stateMeta: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  COMMIT: {
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: '已决议',
  },
  ESCALATED: {
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    label: '已升级',
  },
  VETOED: {
    color: 'text-rose-700 bg-rose-50 border-rose-200',
    icon: <XCircle className="h-3.5 w-3.5" />,
    label: '被否决',
  },
  DELIBERATION: {
    color: 'text-sky-700 bg-sky-50 border-sky-200',
    icon: <Clock className="h-3.5 w-3.5" />,
    label: '议中',
  },
  CONTEXT_GATHER: {
    color: 'text-slate-700 bg-slate-50 border-slate-200',
    icon: <Clock className="h-3.5 w-3.5" />,
    label: '收集中',
  },
};

const classLabel: Record<string, string> = {
  simple: '简单',
  complex: '复杂',
  strategic: '战略',
};

export default function DecisionCardListPage() {
  const [cards, setCards] = useState<DecisionCardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const data = await res.json();
        if (!cancelled) setCards(data.recentDecisions ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="container mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ScrollText className="h-6 w-6 text-amber-600" />
            决议卡 (Decision Cards)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            所有议事室决议结构化沉淀 · 17min 上限 · 24h 否决窗口 · 7 天后自动复盘
          </p>
        </div>
        <Link href="/convergence">
          <Button>
            <Sparkles className="mr-1.5 h-4 w-4" />
            发起新议事
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatBlock title="共计" value={cards.length} hint="所有决议" />
        <StatBlock
          title="17 分钟内闭环"
          value={
            cards.filter(
              (c) =>
                (c.convergenceState === 'COMMIT' || c.convergenceState === 'VETOED') &&
                c.elapsedSeconds <= 17 * 60
            ).length
          }
          hint="目标 ≥ 70%"
        />
        <StatBlock
          title="D 选项 (员工原创)"
          value={cards.filter((c) => c.selected === 'D').length}
          hint="目标 ≥ 20%"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">最近决议</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : cards.length === 0 ? (
            <div className="rounded border-2 border-dashed border-slate-200 p-8 text-center">
              <ScrollText className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-muted-foreground">尚无决议</p>
              <Link href="/convergence">
                <Button className="mt-4" size="sm">
                  发起第一个议事 <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {cards.map((c) => (
                <DecisionRow key={c.id} card={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StatBlock({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold">{value}</p>
        {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function DecisionRow({ card }: { card: DecisionCardSummary }) {
  const m =
    stateMeta[card.convergenceState] ?? {
      color: 'text-slate-700 bg-slate-50 border-slate-200',
      icon: null,
      label: card.convergenceState,
    };
  const mins = Math.floor(card.elapsedSeconds / 60);
  const secs = card.elapsedSeconds % 60;
  const inTime = card.elapsedSeconds <= 17 * 60;

  return (
    <Link href={`/decision-card/${card.id}`}>
      <div className="flex items-center gap-3 rounded border bg-white p-3 transition-colors hover:bg-slate-50">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{card.title}</p>
            <Badge variant="outline" className="text-[10px]">
              {classLabel[card.decisionClass] ?? card.decisionClass}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>
              {new Date(card.createdAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>·</span>
            <span className={inTime ? 'text-emerald-700' : 'text-rose-700'}>
              {mins}:{secs.toString().padStart(2, '0')}
              {!inTime && ' (超时)'}
            </span>
            {card.selected && (
              <>
                <span>·</span>
                <span className="font-mono">选 {card.selected}</span>
              </>
            )}
          </div>
        </div>
        <span
          className={`flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium ${m.color}`}
        >
          {m.icon}
          {m.label}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </Link>
  );
}
