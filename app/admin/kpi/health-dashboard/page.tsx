'use client';

/**
 * /admin/kpi/health-dashboard · KPI 健康度看板 (monitor scope 专用)
 *
 * CHARTER-KPI-TTI §2.0: scope=monitor 的 KPI 不挂奖金, 不进 9-box,
 * 仅用于公司全维度健康度监控.
 *
 * 页面: 高管/HR 只读视图
 *   - 顶部: 周期选择 + 整体健康度 (绿/黄/红 KPI 数量)
 *   - 主体: 按科目一级分组的 KPI 卡片 grid
 *   - 每张卡: 完成率进度条 + 颜色编码 + 当前/目标 + 数据来源徽标
 *
 * 颜色规则 (区别于 TTI):
 *   - 绿: completion >= 0.9
 *   - 黄: 0.6 <= completion < 0.9
 *   - 红: completion < 0.6
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkline } from '@/components/charts/sparkline';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Activity,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  Pencil,
  Cog,
} from 'lucide-react';
import { computeKpiCompletion, type Kpi, type KpiCycle, type KpiSubject } from '@/lib/types/kpi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Health = 'green' | 'amber' | 'red';

function healthOf(completion: number): Health {
  if (completion >= 0.9) return 'green';
  if (completion >= 0.6) return 'amber';
  return 'red';
}

const HEALTH_COLOR: Record<Health, { bar: string; text: string; bg: string; border: string; label: string }> = {
  green: {
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    label: '健康',
  },
  amber: {
    bar: 'bg-amber-500',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    label: '警戒',
  },
  red: {
    bar: 'bg-rose-500',
    text: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    label: '风险',
  },
};

const DATA_SOURCE_LABEL: Record<string, { label: string; icon: typeof Database }> = {
  manual: { label: '人工', icon: Pencil },
  erp: { label: 'ERP', icon: Database },
  system: { label: '系统', icon: Cog },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KpiHealthDashboardPage() {
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [subjects, setSubjects] = useState<KpiSubject[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [snapshotsByKpi, setSnapshotsByKpi] = useState<Record<string, number[]>>({});
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rc, rs] = await Promise.all([
        fetch('/api/kpi/cycles', { cache: 'no-store' }),
        fetch('/api/kpi/subjects', { cache: 'no-store' }),
      ]);
      if (!rc.ok || !rs.ok) throw new Error('load failed');
      const [jc, js] = await Promise.all([rc.json(), rs.json()]);
      setCycles(jc.cycles ?? []);
      setSubjects(js.subjects ?? []);
      if (!activeCycleId && (jc.cycles?.length ?? 0) > 0) {
        const sorted = [...jc.cycles].sort(
          (a: KpiCycle, b: KpiCycle) => b.fiscalYear - a.fiscalYear,
        );
        setActiveCycleId(
          (sorted.find((c: KpiCycle) => c.status === 'active') ?? sorted[0]).id,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [activeCycleId]);

  const loadKpis = useCallback(async () => {
    if (!activeCycleId) {
      setKpis([]);
      setSnapshotsByKpi({});
      return;
    }
    try {
      const [rk, rs] = await Promise.all([
        fetch(`/api/kpi?cycleId=${activeCycleId}&scope=monitor`, { cache: 'no-store' }),
        fetch(`/api/kpi/snapshots?cycleId=${activeCycleId}`, { cache: 'no-store' }),
      ]);
      if (!rk.ok) throw new Error(`HTTP ${rk.status}`);
      const jk = await rk.json();
      setKpis(jk.kpis ?? []);
      if (rs.ok) {
        const js = await rs.json();
        const byKpi: Record<string, number[]> = {};
        const sorted = [...(js.snapshots ?? [])].sort((a: { date: string }, b: { date: string }) =>
          a.date < b.date ? -1 : 1,
        );
        for (const s of sorted as Array<{ kpiId: string; cumulativeValue: number }>) {
          (byKpi[s.kpiId] ??= []).push(s.cumulativeValue);
        }
        setSnapshotsByKpi(byKpi);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [activeCycleId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadKpis();
  }, [loadKpis]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const activeCycle = useMemo(
    () => cycles.find((c) => c.id === activeCycleId) ?? null,
    [cycles, activeCycleId],
  );

  const subjectById = useMemo(() => {
    const m = new Map<string, KpiSubject>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);

  // 找一级父科目用于分组
  const rootSubjectFor = useCallback(
    (subjectId: string): KpiSubject | null => {
      let cur = subjectById.get(subjectId);
      const seen = new Set<string>();
      while (cur && cur.parentId) {
        if (seen.has(cur.id)) return cur; // safety: 循环保护
        seen.add(cur.id);
        const parent = subjectById.get(cur.parentId);
        if (!parent) return cur;
        cur = parent;
      }
      return cur ?? null;
    },
    [subjectById],
  );

  interface KpiWithMeta {
    kpi: Kpi;
    completion: number;
    health: Health;
  }

  const groups = useMemo(() => {
    const out = new Map<string, { root: KpiSubject | null; items: KpiWithMeta[] }>();
    for (const k of kpis) {
      const root = rootSubjectFor(k.subjectId);
      const key = root?.id ?? '__no_subject__';
      if (!out.has(key)) out.set(key, { root, items: [] });
      const completion = computeKpiCompletion(k);
      out.get(key)!.items.push({
        kpi: k,
        completion,
        health: healthOf(completion),
      });
    }
    // sort items: 先红 后黄 后绿
    const order: Record<Health, number> = { red: 0, amber: 1, green: 2 };
    for (const g of Array.from(out.values())) {
      g.items.sort((a, b) => order[a.health] - order[b.health]);
    }
    return Array.from(out.values()).sort((a, b) =>
      (a.root?.code ?? '').localeCompare(b.root?.code ?? ''),
    );
  }, [kpis, rootSubjectFor]);

  const stats = useMemo(() => {
    const total = kpis.length;
    let green = 0;
    let amber = 0;
    let red = 0;
    for (const k of kpis) {
      const h = healthOf(computeKpiCompletion(k));
      if (h === 'green') green++;
      else if (h === 'amber') amber++;
      else red++;
    }
    return { total, green, amber, red };
  }, [kpis]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            KPI 健康度看板
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            scope=monitor 的全维度 KPI · 不挂奖金, 仅监控公司运行健康度
            <span className="ml-2 text-xs">CHARTER-KPI-TTI §2.0</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* 顶部: 周期 + 整体健康 */}
      <Card>
        <CardContent className="py-4 flex items-center gap-4 flex-wrap">
          <div className="min-w-[260px]">
            <Select
              value={activeCycleId ?? ''}
              onValueChange={(v) => setActiveCycleId(v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择周期" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · FY{c.fiscalYear} · {c.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {activeCycle && (
            <span className="text-xs text-muted-foreground">
              {activeCycle.startDate.slice(0, 10)} → {activeCycle.endDate.slice(0, 10)}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className={`${HEALTH_COLOR.green.bg} ${HEALTH_COLOR.green.text} ${HEALTH_COLOR.green.border}`}>
              健康 {stats.green}
            </Badge>
            <Badge variant="outline" className={`${HEALTH_COLOR.amber.bg} ${HEALTH_COLOR.amber.text} ${HEALTH_COLOR.amber.border}`}>
              警戒 {stats.amber}
            </Badge>
            <Badge variant="outline" className={`${HEALTH_COLOR.red.bg} ${HEALTH_COLOR.red.text} ${HEALTH_COLOR.red.border}`}>
              风险 {stats.red}
            </Badge>
            <Badge variant="outline">合计 {stats.total}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* 主体: 分组卡片 grid */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            加载中…
          </CardContent>
        </Card>
      ) : kpis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {activeCycle
              ? '本周期没有 scope=monitor 的 KPI · 监控类指标可在 /admin/kpi/setup 创建'
              : '请选择一个周期'}
          </CardContent>
        </Card>
      ) : (
        groups.map(({ root, items }) => (
          <Card key={root?.id ?? '__none__'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                {root ? (
                  <>
                    <span className="font-mono text-xs text-muted-foreground">{root.code}</span>
                    {root.name}
                  </>
                ) : (
                  <span className="text-muted-foreground">未分类</span>
                )}
                <Badge variant="outline" className="text-xs">
                  {items.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map(({ kpi, completion, health }) => {
                  const c = HEALTH_COLOR[health];
                  const subject = subjectById.get(kpi.subjectId);
                  const ds = DATA_SOURCE_LABEL[kpi.dataSource ?? ''] ?? null;
                  const DsIcon = ds?.icon;
                  const pct = Math.round(completion * 100);
                  const Trend = completion >= 0.9 ? TrendingUp : completion >= 0.6 ? Minus : TrendingDown;
                  return (
                    <div
                      key={kpi.id}
                      className={`rounded-lg border p-3 ${c.bg} ${c.border} space-y-2`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm leading-tight truncate">
                            {kpi.title}
                          </div>
                          {subject && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {subject.name}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={`${c.text} ${c.bg} ${c.border} flex-shrink-0`}>
                          <Trend className="h-3 w-3 mr-1" />
                          {c.label}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between text-xs">
                          <span className="tabular-nums">
                            <span className="text-foreground font-semibold">
                              {(kpi.currentValue ?? 0).toLocaleString()}
                            </span>
                            <span className="text-muted-foreground">
                              {' '}
                              / {kpi.targetValue.toLocaleString()}
                              {kpi.unit && <span> {kpi.unit}</span>}
                            </span>
                          </span>
                          <span className={`tabular-nums font-semibold ${c.text}`}>{pct}%</span>
                        </div>
                        <Progress value={Math.min(100, pct)} className="h-1.5" />
                        {(snapshotsByKpi[kpi.id]?.length ?? 0) >= 2 && (
                          <div className="flex justify-end pt-1">
                            <Sparkline
                              points={snapshotsByKpi[kpi.id]}
                              target={kpi.targetValue}
                              health={health}
                              width={120}
                              height={28}
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {DsIcon && ds && (
                          <span className="inline-flex items-center gap-0.5">
                            <DsIcon className="h-3 w-3" />
                            {ds.label}
                          </span>
                        )}
                        <span className="font-mono truncate">{kpi.assigneeId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
