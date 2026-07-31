'use client';

/**
 * /organization/performance — 我的绩效与潜力
 *
 * 「组织 · 反馈评估」组内的员工自视角聚合页:
 *   - 我的: 我的 KPI 完成率 + OKR/TTI 进度 + 【我的收入】(仅本人可见, 后端严格按 auth.userId 过滤)
 *   - 下属: 若本人在组织架构中有下属 (managerId 汇报链), 展示其目标达成情况——不含任何收入字段
 *
 * 数据源: GET /api/organization/performance?scope=me|reports (只读, 无写操作)
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, Wallet, Users, TrendingUp, AlertCircle, Grid3x3 } from 'lucide-react';
import { cn } from '@/lib/utils';

type NineBoxCell =
  | 'star'
  | 'high_performer'
  | 'risk_burnout'
  | 'rising_talent'
  | 'core'
  | 'plateau'
  | 'mismatch'
  | 'low_engagement'
  | 'must_intervene';

const NINE_BOX_META: Record<NineBoxCell, { label: string; emoji: string; cls: string }> = {
  star: { label: '明星', emoji: '⭐', cls: 'bg-warning/5 text-warning border-warning/20' },
  high_performer: { label: '高产', emoji: '🚀', cls: 'bg-success/10 text-success border-success/30' },
  risk_burnout: { label: '风险枯萎', emoji: '⚠️', cls: 'bg-danger/5 text-danger border-danger/30' },
  rising_talent: { label: '升星人才', emoji: '🌱', cls: 'bg-info/10 text-info border-info/30' },
  core: { label: '核心力量', emoji: '🧱', cls: 'bg-surface-1 text-ink-primary border' },
  plateau: { label: '平台期', emoji: '➖', cls: 'bg-surface-1 text-ink-secondary border' },
  mismatch: { label: '人岗错位', emoji: '🔄', cls: 'bg-brand-50 text-brand-700 border-brand-200' },
  low_engagement: { label: '投入不足', emoji: '😴', cls: 'bg-warning/5 text-warning border-warning/20' },
  must_intervene: { label: '必须干预', emoji: '🚨', cls: 'bg-danger/10 text-danger border-danger/40' },
};

interface KpiSummary {
  id: string;
  title: string;
  scope: 'bonus' | 'monitor';
  weight: number;
  completion: number;
}

interface ObjectiveSummary {
  id: string;
  title: string;
  confidence: string;
  progress: number;
}

interface NineBoxSummary {
  kpiScore: number;
  ttiScore: number;
  cell: NineBoxCell;
}

interface MePerformance {
  userId: string;
  kpis: KpiSummary[];
  objectives: ObjectiveSummary[];
  nineBox: NineBoxSummary | null;
  bonus: {
    baseBonus: number;
    weightedCompletion: number;
    finalBonus: number;
    committed: boolean;
  } | null;
}

interface ReportPerformance {
  userId: string;
  name?: string;
  email?: string;
  kpis: KpiSummary[];
  objectives: ObjectiveSummary[];
  nineBox: NineBoxSummary | null;
}

interface CycleLite {
  id: string;
  name: string;
  status: string;
}

function completionColor(c: number): string {
  if (c >= 0.9) return 'text-success';
  if (c >= 0.6) return 'text-warning';
  return 'text-danger';
}

function confidenceBadge(confidence: string) {
  if (confidence === 'on-track') return { label: '进度健康', cls: 'bg-success/10 text-success border-success/30' };
  if (confidence === 'at-risk') return { label: '有风险', cls: 'bg-warning/5 text-warning border-warning/20' };
  return { label: '已偏离', cls: 'bg-danger/5 text-danger border-danger/30' };
}

function KpiRow({ k }: { k: KpiSummary }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-footnote">
        <span className="truncate flex items-center gap-1.5">
          {k.title}
          <Badge variant="outline" className="text-[9px] scale-90">
            {k.scope === 'bonus' ? '强考核' : '监控'}
          </Badge>
        </span>
        <span className={cn('font-semibold tabular-nums', completionColor(k.completion))}>
          {Math.round(k.completion * 100)}%
        </span>
      </div>
      <Progress value={Math.min(100, Math.round(k.completion * 100))} className="h-1.5" />
    </div>
  );
}

function ObjectiveRow({ o }: { o: ObjectiveSummary }) {
  const badge = confidenceBadge(o.confidence);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-footnote">
        <span className="truncate">{o.title}</span>
        <Badge variant="outline" className={cn('text-[9px] scale-90', badge.cls)}>
          {badge.label}
        </Badge>
      </div>
      <Progress value={Math.round(o.progress * 100)} className="h-1.5" />
    </div>
  );
}

function PersonCard({
  title,
  kpis,
  objectives,
  nineBox,
  bonus,
}: {
  title: string;
  kpis: KpiSummary[];
  objectives: ObjectiveSummary[];
  nineBox?: NineBoxSummary | null;
  bonus?: MePerformance['bonus'];
}) {
  const nineBoxMeta = nineBox ? NINE_BOX_META[nineBox.cell] : null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-caption flex items-center justify-between gap-1.5">
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {title}
          </span>
          {nineBoxMeta && (
            <Badge variant="outline" className={cn('text-[10px] scale-90', nineBoxMeta.cls)}>
              {nineBoxMeta.emoji} {nineBoxMeta.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nineBox && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Grid3x3 className="h-3 w-3" />
            9-box 落点: KPI {Math.round(nineBox.kpiScore * 100)}% × TTI/360 {Math.round(nineBox.ttiScore * 100)}%
          </div>
        )}
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <Target className="h-3 w-3" /> KPI 目标达成
          </div>
          {kpis.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">当前周期暂无 KPI</p>
          ) : (
            kpis.map((k) => <KpiRow key={k.id} k={k} />)
          )}
        </div>
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> OKR / TTI 进度
          </div>
          {objectives.length === 0 ? (
            <p className="text-[10px] text-muted-foreground">当前无进行中的目标</p>
          ) : (
            objectives.map((o) => <ObjectiveRow key={o.id} o={o} />)
          )}
        </div>
        {bonus !== undefined && (
          <div className="space-y-1.5 border-t pt-3">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
              <Wallet className="h-3 w-3" /> 我的收入 (仅本人可见)
            </div>
            {bonus ? (
              <div className="bg-primary/5 rounded-md p-3 border border-primary/20 flex items-center justify-between">
                <div className="text-[10px] text-muted-foreground">
                  基础奖金 {bonus.baseBonus.toLocaleString()} × 加权完成率 {Math.round(bonus.weightedCompletion * 100)}%
                </div>
                <div className="text-right">
                  <div className="text-headline font-bold text-primary tabular-nums">
                    {Math.round(bonus.finalBonus).toLocaleString()}
                  </div>
                  <div className="text-[9px] text-muted-foreground">
                    {bonus.committed ? '已下发' : '预估 (未下发)'}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">本周期暂未生成奖金核算结果</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrganizationPerformancePage() {
  const [tab, setTab] = useState<'me' | 'reports'>('me');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<CycleLite | null>(null);
  const [me, setMe] = useState<MePerformance | null>(null);
  const [reports, setReports] = useState<ReportPerformance[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/organization/performance?scope=${tab}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (cancelled) return;
        setCycle(j.cycle ?? null);
        if (tab === 'me') setMe(j.me ?? null);
        else setReports(j.reports ?? []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const hasReports = reports.length > 0;

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4 md:px-8">
      <header>
        <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          我的绩效与潜力
        </h1>
        <p className="text-caption text-muted-foreground mt-1">
          BSC 目标达成 + OKR/TTI 推进进度{cycle && <> · 周期 <strong>{cycle.name}</strong></>}
        </p>
      </header>

      <div className="flex items-center gap-2 border-b">
        <button
          className={cn(
            'px-3 py-2 text-footnote font-medium border-b-2 -mb-px',
            tab === 'me' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
          )}
          onClick={() => setTab('me')}
        >
          我的
        </button>
        <button
          className={cn(
            'px-3 py-2 text-footnote font-medium border-b-2 -mb-px',
            tab === 'reports' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
          )}
          onClick={() => setTab('reports')}
        >
          下属
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-caption">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载中…
        </div>
      )}

      {!loading && error && (
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-caption text-danger flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            加载失败: {error}
          </CardContent>
        </Card>
      )}

      {!loading && !error && tab === 'me' && (
        <PersonCard
          title="我的目标与收入"
          kpis={me?.kpis ?? []}
          objectives={me?.objectives ?? []}
          nineBox={me?.nineBox}
          bonus={me?.bonus}
        />
      )}

      {!loading && !error && tab === 'reports' && (
        hasReports ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((r) => (
              <PersonCard
                key={r.userId}
                title={r.name ?? r.email ?? r.userId}
                kpis={r.kpis}
                objectives={r.objectives}
                nineBox={r.nineBox}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-caption">
              <Users className="w-10 h-10 mx-auto opacity-20 mb-2" />
              你在组织架构中暂无下属 (managerId 汇报链为空)
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}
