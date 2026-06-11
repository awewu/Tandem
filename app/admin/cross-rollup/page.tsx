'use client';

/**
 * /admin/cross-rollup · 四维错配看板 (机会#5)
 *
 * 把 OKR 目标 / KPI 底线 / 人才 9 宫格 / 年终奖金 在「人」上对齐, 自动算出:
 *   - 全公司「四维错配得分」(0-100) + 奖金池就绪度
 *   - 各事业部错配得分排行
 *   - 错配最严重的人 (含具体信号)
 * 数据源 /api/analytics/cross-rollup, 与 9-box / 奖金引擎同口径。
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, RefreshCw, Building2, Layers, Flame, Coins } from 'lucide-react';

type MisalignKind =
  | 'burnout_risk'
  | 'mismatch'
  | 'must_intervene'
  | 'bonus_overpay'
  | 'bonus_underpay'
  | 'bonus_uncommitted';

const KIND_LABEL: Record<MisalignKind, string> = {
  burnout_risk: '烧穿风险',
  mismatch: '人岗错位',
  must_intervene: '紧急干预',
  bonus_overpay: '奖金错配',
  bonus_underpay: '激励不足',
  bonus_uncommitted: '奖金未下发',
};

const CELL_LABEL: Record<string, string> = {
  star: '明星',
  high_performer: '高绩效',
  risk_burnout: '烧穿风险',
  rising_talent: '潜力新星',
  core: '中坚',
  plateau: '平台期',
  mismatch: '人岗错位',
  low_engagement: '投入不足',
  must_intervene: '紧急干预',
};

interface Signal {
  kind: MisalignKind;
  severity: 'low' | 'medium' | 'high' | 'urgent';
  detail: string;
}
interface Person {
  userId: string;
  name: string;
  businessUnit: string;
  okrProgress: number | null;
  ttiScore: number;
  kpiScore: number;
  cell: string;
  bonus: { finalBonus: number; weightedCompletion: number; committed: boolean } | null;
  signals: Signal[];
  misalignScore: number;
}
interface Unit {
  businessUnit: string;
  headcount: number;
  avgOkrProgress: number;
  avgKpiScore: number;
  bonusTotal: number;
  bonusCommittedRatio: number;
  misalignScore: number;
  signalCounts: Partial<Record<MisalignKind, number>>;
}
interface Rollup {
  cycleId: string | null;
  cycleName: string | null;
  overall: {
    headcount: number;
    misalignScore: number;
    bonusTotal: number;
    bonusCommittedRatio: number;
    signalCounts: Partial<Record<MisalignKind, number>>;
  };
  units: Unit[];
  topRisks: Person[];
}
interface Cycle {
  id: string;
  name: string;
}
type ConsistencyStatus =
  | 'ok'
  | 'no_revenue_anchor'
  | 'partially_anchored'
  | 'unanchored'
  | 'orphan_link';
const CONSISTENCY_LABEL: Record<ConsistencyStatus, string> = {
  ok: '一致',
  no_revenue_anchor: '缺营收锚',
  partially_anchored: '部分锚定',
  unanchored: '未锚定 KPI',
  orphan_link: '悬空锚',
};
interface ConsistencyRow {
  objectiveId: string;
  title: string;
  level: string;
  krCount: number;
  anchoredKrCount: number;
  revenueAnchorCount: number;
  orphanLinkCount: number;
  status: ConsistencyStatus;
}
interface Consistency {
  summary: {
    objectiveCount: number;
    withRevenueAnchor: number;
    revenueAnchorRate: number;
    fullyAnchored: number;
    anchorCoverage: number;
    orphanLinks: number;
    consistencyScore: number;
  };
  issues: ConsistencyRow[];
}

function scoreColor(score: number): string {
  if (score >= 50) return 'text-rose-600';
  if (score >= 25) return 'text-amber-600';
  return 'text-emerald-600';
}
function scoreBg(score: number): string {
  if (score >= 50) return 'bg-rose-500';
  if (score >= 25) return 'bg-amber-500';
  return 'bg-emerald-500';
}
const pct = (n: number) => `${Math.round(n * 100)}%`;
const yuan = (n: number) => `${Math.round(n).toLocaleString()} 元`;

export default function CrossRollupPage() {
  const [data, setData] = useState<Rollup | null>(null);
  const [consistency, setConsistency] = useState<Consistency | null>(null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = cycleId && cycleId !== 'all' ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
      const [res, cres] = await Promise.all([
        fetch(`/api/analytics/cross-rollup${q}`),
        fetch(`/api/analytics/okr-kpi-consistency${q}`),
      ]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '加载失败');
      setData(json);
      if (cres.ok) setConsistency(await cres.json());
      else setConsistency(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    fetch('/api/tandem-okr')
      .then((r) => r.json())
      .then((j) => setCycles(j.cycles ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title2 font-semibold flex items-center gap-2">
            <Layers className="w-5 h-5" /> 四维错配看板
          </h1>
          <p className="text-footnote text-muted-foreground mt-1">
            OKR 目标 × KPI 底线 × 人才 9 宫格 × 年终奖金 — 在「人」上对齐, 找跨维度错配杠杆点
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="周期" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部周期</SelectItem>
              {cycles.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-rose-200">
          <CardContent className="py-4 text-rose-600 text-footnote flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          {/* 全公司概览 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-callout">
                全公司四维错配 {data.cycleName ? `· ${data.cycleName}` : '· 全周期'}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <div className="text-footnote text-muted-foreground">四维错配得分</div>
                <div className={`text-title1 font-bold tabular-nums ${scoreColor(data.overall.misalignScore)}`}>
                  {data.overall.misalignScore}
                  <span className="text-footnote font-normal text-muted-foreground"> /100</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-footnote text-muted-foreground">纳入人数</div>
                <div className="text-title2 font-semibold tabular-nums">{data.overall.headcount}</div>
              </div>
              <div className="space-y-1">
                <div className="text-footnote text-muted-foreground">奖金池 (最终)</div>
                <div className="text-title2 font-semibold tabular-nums">{yuan(data.overall.bonusTotal)}</div>
              </div>
              <div className="space-y-1">
                <div className="text-footnote text-muted-foreground">奖金下发率</div>
                <div className="text-title2 font-semibold tabular-nums">{pct(data.overall.bonusCommittedRatio)}</div>
              </div>
            </CardContent>
            <CardContent className="pt-0 flex flex-wrap gap-2">
              {Object.entries(data.overall.signalCounts).map(([kind, n]) => (
                <Badge key={kind} variant="outline" className="border-amber-200 text-amber-700">
                  {KIND_LABEL[kind as MisalignKind] ?? kind} · {n}
                </Badge>
              ))}
              {Object.keys(data.overall.signalCounts).length === 0 && (
                <span className="text-footnote text-muted-foreground">未发现跨维度错配信号</span>
              )}
            </CardContent>
          </Card>

          {/* OKR-KPI 一致性 */}
          {consistency && (
            <Card>
              <CardHeader>
                <CardTitle className="text-callout flex items-center gap-2">
                  <Layers className="w-4 h-4" /> OKR-KPI 一致性 (目标是否锚定营收硬底线)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-footnote text-muted-foreground">一致性得分</div>
                  <div
                    className={`text-title1 font-bold tabular-nums ${
                      consistency.summary.consistencyScore >= 60
                        ? 'text-emerald-600'
                        : consistency.summary.consistencyScore >= 30
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {consistency.summary.consistencyScore}
                    <span className="text-footnote font-normal text-muted-foreground"> /100</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-footnote text-muted-foreground">含营收锚目标</div>
                  <div className="text-title2 font-semibold tabular-nums">
                    {consistency.summary.withRevenueAnchor}/{consistency.summary.objectiveCount}{' '}
                    <span className="text-footnote font-normal text-muted-foreground">
                      ({pct(consistency.summary.revenueAnchorRate)})
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-footnote text-muted-foreground">KR 锚定覆盖率</div>
                  <div className="text-title2 font-semibold tabular-nums">
                    {pct(consistency.summary.anchorCoverage)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-footnote text-muted-foreground">悬空锚</div>
                  <div className="text-title2 font-semibold tabular-nums">
                    {consistency.summary.orphanLinks}
                  </div>
                </div>
              </CardContent>
              {consistency.issues.length > 0 && (
                <CardContent className="pt-0 space-y-2">
                  <div className="text-footnote text-muted-foreground">不一致目标 (Top 8)</div>
                  {consistency.issues.slice(0, 8).map((it) => (
                    <div
                      key={it.objectiveId}
                      className="flex items-center justify-between gap-3 text-footnote border-b pb-1.5 last:border-0"
                    >
                      <span className="truncate flex-1">{it.title}</span>
                      <span className="text-muted-foreground tabular-nums flex-shrink-0">
                        KR {it.anchoredKrCount}/{it.krCount} 锚定
                      </span>
                      <Badge variant="outline" className="border-amber-200 text-amber-700 flex-shrink-0">
                        {CONSISTENCY_LABEL[it.status]}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* 事业部错配排行 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-callout flex items-center gap-2">
                <Building2 className="w-4 h-4" /> 事业部错配排行
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.units.map((u) => (
                <div key={u.businessUnit} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-3 text-footnote">
                    <div className="font-medium truncate">
                      {u.businessUnit}{' '}
                      <span className="text-muted-foreground font-normal">· {u.headcount} 人</span>
                    </div>
                    <div className="flex items-center gap-3 tabular-nums text-muted-foreground flex-shrink-0">
                      <span>OKR {pct(u.avgOkrProgress)}</span>
                      <span>KPI {pct(u.avgKpiScore)}</span>
                      <span>奖金 {pct(u.bonusCommittedRatio)} 已发</span>
                      <span className={`font-semibold ${scoreColor(u.misalignScore)}`}>错配 {u.misalignScore}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${scoreBg(u.misalignScore)}`}
                      style={{ width: `${Math.min(100, u.misalignScore)}%` }}
                    />
                  </div>
                </div>
              ))}
              {data.units.length === 0 && (
                <span className="text-footnote text-muted-foreground">暂无单元数据</span>
              )}
            </CardContent>
          </Card>

          {/* 重点风险人 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-callout flex items-center gap-2">
                <Flame className="w-4 h-4" /> 错配最严重的人 (Top {data.topRisks.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.topRisks.map((p) => (
                <div key={p.userId} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{p.name}</span>
                      <Badge variant="outline" className="text-caption2 flex-shrink-0">
                        {p.businessUnit}
                      </Badge>
                      <Badge variant="outline" className="text-caption2 flex-shrink-0 border-sky-200 text-sky-700">
                        {CELL_LABEL[p.cell] ?? p.cell}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-footnote tabular-nums text-muted-foreground flex-shrink-0">
                      <span>KPI {pct(p.kpiScore)}</span>
                      <span>TTI {pct(p.ttiScore)}</span>
                      {p.bonus && (
                        <span className="flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {yuan(p.bonus.finalBonus)}
                        </span>
                      )}
                      <span className={`font-semibold ${scoreColor(p.misalignScore)}`}>{p.misalignScore}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.signals.map((s, i) => (
                      <span
                        key={i}
                        className="text-caption1 px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
                      >
                        {KIND_LABEL[s.kind]}: {s.detail}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {data.topRisks.length === 0 && (
                <span className="text-footnote text-muted-foreground">未发现显著错配的人</span>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
