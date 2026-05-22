'use client';

/**
 * /kpi · 我的 KPI (只读, 员工本人视图)
 *
 * CHARTER-KPI-TTI §2.1: 员工本人永远不能改自己的 KPI 数据
 * 此页 100% 只读, 仅查看 target / current / 完成率.
 *
 * 显示:
 *   - 顶部周期切换 (默认 active)
 *   - 两栏: 考核 (bonus, 进 9-box+奖金) + 监控 (monitor, 仅健康度)
 *   - 每张 KPI 卡: 完成率进度条 + 颜色 (绿/黄/红) + 数据来源
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import {
  RefreshCw,
  Target,
  AlertCircle,
  Coins,
  Activity,
  Database,
  Pencil,
  Cog,
  Lock,
} from 'lucide-react';
import {
  computeKpiCompletion,
  type Kpi,
  type KpiCycle,
  type KpiSubject,
} from '@/lib/types/kpi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function healthColor(c: number) {
  if (c >= 0.9) return { bar: 'bg-emerald-500', text: 'text-emerald-700' };
  if (c >= 0.6) return { bar: 'bg-amber-500', text: 'text-amber-700' };
  return { bar: 'bg-rose-500', text: 'text-rose-700' };
}

const DS: Record<string, { label: string; icon: typeof Database }> = {
  manual: { label: '人工补录', icon: Pencil },
  erp: { label: 'ERP 自动', icon: Database },
  system: { label: '系统计算', icon: Cog },
  pending: { label: '尚未采集', icon: Lock },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MyKpiPage() {
  const me = useCurrentUserId();
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [subjects, setSubjects] = useState<KpiSubject[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [activeCycleId, setActiveCycleId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadMyKpis = useCallback(async () => {
    if (!activeCycleId || !me) {
      setKpis([]);
      return;
    }
    try {
      const r = await fetch(
        `/api/kpi?cycleId=${activeCycleId}&assigneeId=${encodeURIComponent(me)}`,
        { cache: 'no-store' },
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setKpis(j.kpis ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [activeCycleId, me]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMyKpis();
  }, [loadMyKpis]);

  // Derived
  const activeCycle = useMemo(
    () => cycles.find((c) => c.id === activeCycleId) ?? null,
    [cycles, activeCycleId],
  );

  const subjectById = useMemo(() => {
    const m = new Map<string, KpiSubject>();
    for (const s of subjects) m.set(s.id, s);
    return m;
  }, [subjects]);

  const bonusKpis = useMemo(
    () =>
      kpis
        .filter((k) => k.scope === 'bonus')
        .sort((a, b) => b.weight - a.weight),
    [kpis],
  );
  const monitorKpis = useMemo(
    () => kpis.filter((k) => k.scope === 'monitor'),
    [kpis],
  );

  // 总加权完成率 (仅 bonus, 与奖金强相关)
  const totalWeightedCompletion = useMemo(() => {
    if (bonusKpis.length === 0) return 0;
    let totalW = 0;
    let weightedSum = 0;
    for (const k of bonusKpis) {
      totalW += k.weight;
      weightedSum += k.weight * computeKpiCompletion(k);
    }
    return totalW > 0 ? weightedSum / totalW : 0;
  }, [bonusKpis]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderKpiCard = (kpi: Kpi) => {
    const completion = computeKpiCompletion(kpi);
    const hc = healthColor(completion);
    const subject = subjectById.get(kpi.subjectId);
    const ds = DS[kpi.dataSource ?? 'pending'];
    const DsIcon = ds.icon;
    const pct = Math.round(completion * 100);
    return (
      <Card key={kpi.id}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium leading-tight">{kpi.title}</div>
              {subject && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{subject.code}</span> · {subject.name}
                </div>
              )}
              {kpi.description && (
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              )}
            </div>
            {kpi.scope === 'bonus' && kpi.weight > 0 && (
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 flex-shrink-0">
                权重 {kpi.weight}
              </Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="tabular-nums">
                <span className="font-semibold">
                  {(kpi.currentValue ?? 0).toLocaleString()}
                </span>
                <span className="text-muted-foreground">
                  {' '}/ {kpi.targetValue.toLocaleString()}
                  {kpi.unit && <span> {kpi.unit}</span>}
                </span>
              </span>
              <span className={`font-semibold tabular-nums ${hc.text}`}>{pct}%</span>
            </div>
            <Progress value={Math.min(100, pct)} className="h-2" />
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <DsIcon className="h-3 w-3" />
              {ds.label}
            </span>
            <span>层级: {kpi.level === 'company' ? '公司' : kpi.level === 'department' ? '部门' : '个人'}</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto max-w-5xl p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            我的 KPI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            年度目标只读视图 · 数据由 HR/财务/ERP 写入, 你不可修改
            <span className="ml-2 text-xs">CHARTER-KPI-TTI §2.1</span>
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

      {/* 周期选择 + 总览 */}
      <Card>
        <CardContent className="py-4 flex items-center gap-4 flex-wrap">
          <div className="min-w-[260px]">
            <Select value={activeCycleId ?? ''} onValueChange={setActiveCycleId}>
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

          {bonusKpis.length > 0 && (
            <div className="ml-auto text-right">
              <div className="text-xs text-muted-foreground">考核加权完成率</div>
              <div
                className={`text-2xl font-semibold tabular-nums ${
                  healthColor(totalWeightedCompletion).text
                }`}
              >
                {Math.round(totalWeightedCompletion * 100)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            加载中…
          </CardContent>
        </Card>
      ) : kpis.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            本周期没有分配给你的 KPI
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 考核 KPI (bonus) */}
          {bonusKpis.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base font-medium flex items-center gap-2">
                <Coins className="h-4 w-4 text-rose-600" />
                考核 KPI
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs">
                  bonus · 进 9-box + 奖金
                </Badge>
                <span className="text-sm text-muted-foreground font-normal">
                  ({bonusKpis.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {bonusKpis.map(renderKpiCard)}
              </div>
            </section>
          )}

          {/* 监控 KPI (monitor) */}
          {monitorKpis.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-base font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-600" />
                监控 KPI
                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs">
                  monitor · 不挂奖金
                </Badge>
                <span className="text-sm text-muted-foreground font-normal">
                  ({monitorKpis.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {monitorKpis.map(renderKpiCard)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
