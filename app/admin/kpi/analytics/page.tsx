'use client';

/**
 * /admin/kpi/analytics · KPI 分析中枢
 *
 * 把 /api/kpi/analytics 的 8 个视图全部 surface 出来, 作为高管 / HR 的简报页.
 * 不依赖 recharts (轻量 SVG / 纯 div 条形图).
 *
 * 8 视图:
 *   - company-summary       公司整体卡片
 *   - department-rollup     部门加权完成率排序
 *   - assignee-rollup       人员加权完成率排序 + 9-box grade
 *   - cascade-coverage      cascade 完整度
 *   - data-source           数据来源分布
 *   - risk-list             红色 KPI 清单
 *   - scope-balance         bonus/monitor 平衡
 *   - weight-validation     权重 = 100 校验 (违反列表)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stat } from '@/components/ui/stat';
import {
  Activity,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  Building2,
  Users,
  Layers,
  Database,
  Scale,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { KPI_LEVEL_LABEL, type KpiCycle, type KpiLevel } from '@/lib/types/kpi';

/** byLevel (Record<level, count>) → "公司 4 · 事业部 16 · 个人 180" (仅非零) */
function levelBreakdown(byLevel: Record<string, number>): string {
  const entries = Object.entries(byLevel).filter(([, n]) => n > 0);
  if (entries.length === 0) return '—';
  return entries
    .map(([lvl, n]) => `${KPI_LEVEL_LABEL[lvl as KpiLevel] ?? lvl} ${n}`)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// Tiny inline bar chart (no chart lib dependency)
// ---------------------------------------------------------------------------

function HorizontalBar({
  label,
  value,
  max,
  color,
  hint,
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  color: string;
  hint?: React.ReactNode;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-3 text-footnote">
        <div className="min-w-0 flex-1 truncate">{label}</div>
        <div className="text-muted-foreground tabular-nums flex-shrink-0">{hint}</div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEALTH_COLOR: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-warning',
  red: 'bg-rose-500',
};

const HEALTH_BADGE: Record<string, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-warning/5 text-warning border-warning/20',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
};

const GRADE_BADGE: Record<string, string> = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  mid: 'bg-sky-50 text-sky-700 border-sky-200',
  low: 'bg-rose-50 text-rose-700 border-rose-200',
};

interface Views {
  companySummary?: {
    total: number;
    bonus: number;
    monitor: number;
    green: number;
    amber: number;
    red: number;
    bonusWeightedCompletion: number;
    companyLevelWeightedCompletion: number;
  };
  departmentRollup?: {
    departments: Array<{
      departmentId: string;
      kpiCount: number;
      weightedCompletion: number;
      health: 'green' | 'amber' | 'red';
    }>;
  };
  assigneeRollup?: {
    assignees: Array<{
      assigneeId: string;
      kpiCount: number;
      totalWeight: number;
      weightedCompletion: number;
      grade: 'low' | 'mid' | 'high';
      health: 'green' | 'amber' | 'red';
    }>;
  };
  cascadeCoverage?: {
    levels: Array<{
      level: string;
      label: string;
      total: number;
      orphan: number;
      uncascaded: number;
    }>;
  };
  dataSource?: { total: number; counts: Record<string, number> };
  riskList?: {
    risks: Array<{
      id: string;
      title: string;
      subjectCode: string;
      level: string;
      scope: string;
      assigneeId: string;
      currentValue: number;
      targetValue: number;
      completion: number;
      dataSource: string;
    }>;
  };
  scopeBalance?: {
    bonus: { count: number; totalWeight: number; byLevel: Record<string, number> };
    monitor: { count: number; byLevel: Record<string, number> };
  };
  weightValidation?: {
    ok: boolean;
    violations: Array<{ assigneeId: string; totalWeight: number; expected: number }>;
  };
}

const VIEW_KEYS = [
  ['company-summary', 'companySummary'],
  ['department-rollup', 'departmentRollup'],
  ['assignee-rollup', 'assigneeRollup'],
  ['cascade-coverage', 'cascadeCoverage'],
  ['data-source', 'dataSource'],
  ['risk-list', 'riskList'],
  ['scope-balance', 'scopeBalance'],
  ['weight-validation', 'weightValidation'],
] as const;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function KpiAnalyticsPage() {
  const [cycles, setCycles] = useState<KpiCycle[]>([]);
  const [cycleId, setCycleId] = useState<string>('');
  const [data, setData] = useState<Views>({});
  const [userMap, setUserMap] = useState<Record<string, { name?: string; email?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCycles = useCallback(async () => {
    const r = await fetch('/api/kpi/cycles', { cache: 'no-store' });
    if (!r.ok) throw new Error(`cycles HTTP ${r.status}`);
    const j = await r.json();
    const list = (j.cycles ?? []) as KpiCycle[];
    setCycles(list);
    if (!cycleId && list.length > 0) {
      const sorted = [...list].sort((a, b) => b.fiscalYear - a.fiscalYear);
      const pref = sorted.find((c) => c.status === 'active') ?? sorted[0];
      setCycleId(pref.id);
    }
  }, [cycleId]);

  const loadUsers = useCallback(async () => {
    try {
      const r = await fetch('/api/org/users', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const m: Record<string, { name?: string; email?: string }> = {};
      for (const u of (j.users ?? []) as { id: string; name?: string; email?: string }[]) {
        m[u.id] = { name: u.name, email: u.email };
      }
      setUserMap(m);
    } catch {
      /* noop */
    }
  }, []);

  const loadAnalytics = useCallback(async () => {
    if (!cycleId) return;
    const results = await Promise.all(
      VIEW_KEYS.map(async ([apiName]) => {
        const r = await fetch(`/api/kpi/analytics?view=${apiName}&cycleId=${cycleId}`, {
          cache: 'no-store',
        });
        if (!r.ok) return null;
        return r.json();
      }),
    );
    const next: Views = {};
    VIEW_KEYS.forEach(([, key], i) => {
      const j = results[i];
      if (j) {
        // strip 'view' key
        const { view: _v, error: _e, ...rest } = j as Record<string, unknown>;
        void _v;
        void _e;
        (next as Record<string, unknown>)[key] = rest;
      }
    });
    setData(next);
  }, [cycleId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadCycles(), loadUsers()]);
      await loadAnalytics();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [loadCycles, loadUsers, loadAnalytics]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const userName = (id: string) =>
    userMap[id]?.name ?? userMap[id]?.email ?? id;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const cs = data.companySummary;
  const greenPct = cs && cs.total > 0 ? (cs.green / cs.total) * 100 : 0;
  const amberPct = cs && cs.total > 0 ? (cs.amber / cs.total) * 100 : 0;
  const redPct = cs && cs.total > 0 ? (cs.red / cs.total) * 100 : 0;

  const maxAssigneeWC =
    Math.max(0, ...(data.assigneeRollup?.assignees.map((a) => a.weightedCompletion) ?? [0]));
  const maxDeptWC =
    Math.max(0, ...(data.departmentRollup?.departments.map((d) => d.weightedCompletion) ?? [0]));

  return (
    <div className="container mx-auto max-w-7xl p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            KPI 分析中枢
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            8 视图 · 公司全维度健康度 · 高管 / HR 简报
            <span className="ml-2 text-footnote">CHARTER §3 + M2b</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-4">
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="max-w-md">
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
        </CardContent>
      </Card>

      {!cycleId ? (
        <Card>
          <CardContent className="py-12 text-center text-caption text-muted-foreground">
            请先选择一个 KPI 周期
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 1. company-summary */}
          {cs && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-body flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  公司整体
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border rounded-md p-3">
                    <Stat label="KPI 总数" value={cs.total} format="integer" size="md" />
                  </div>
                  <div className="border rounded-md p-3">
                    <Stat label="bonus (奖金挂钩)" value={cs.bonus} format="integer" size="md" />
                  </div>
                  <div className="border rounded-md p-3">
                    <Stat
                      label="bonus 加权完成率"
                      value={cs.bonusWeightedCompletion}
                      format="percent"
                      precision={0}
                      size="md"
                    />
                  </div>
                  <div className="border rounded-md p-3">
                    <Stat
                      label="公司层级加权完成率"
                      value={cs.companyLevelWeightedCompletion}
                      format="percent"
                      precision={0}
                      size="md"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-3 text-footnote text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                      绿 {cs.green}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-warning" />
                      黄 {cs.amber}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                      红 {cs.red}
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500" style={{ width: `${greenPct}%` }} />
                    <div className="bg-warning" style={{ width: `${amberPct}%` }} />
                    <div className="bg-rose-500" style={{ width: `${redPct}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. assignee-rollup */}
          {data.assigneeRollup && data.assigneeRollup.assignees.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-body flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  人员加权完成率排序
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.assigneeRollup.assignees.map((a) => (
                  <HorizontalBar
                    key={a.assigneeId}
                    label={
                      <span className="inline-flex items-center gap-2">
                        <Badge variant="outline" className={`${GRADE_BADGE[a.grade]} text-footnote`}>
                          {a.grade}
                        </Badge>
                        <span>{userName(a.assigneeId)}</span>
                        <span className="text-muted-foreground text-[10px]">
                          ({a.kpiCount} KPI · 权重 {a.totalWeight})
                        </span>
                      </span>
                    }
                    value={a.weightedCompletion}
                    max={Math.max(1, maxAssigneeWC)}
                    color={HEALTH_COLOR[a.health]}
                    hint={`${Math.round(a.weightedCompletion * 100)}%`}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* 3. department-rollup */}
          {data.departmentRollup && data.departmentRollup.departments.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-body flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  部门加权完成率
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.departmentRollup.departments.map((d) => (
                  <HorizontalBar
                    key={d.departmentId}
                    label={
                      <span>
                        {d.departmentId === '__unassigned__' ? '(未指定部门)' : d.departmentId}
                        <span className="text-muted-foreground text-[10px] ml-2">
                          {d.kpiCount} KPI
                        </span>
                      </span>
                    }
                    value={d.weightedCompletion}
                    max={Math.max(1, maxDeptWC)}
                    color={HEALTH_COLOR[d.health]}
                    hint={`${Math.round(d.weightedCompletion * 100)}%`}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* 4. risk-list */}
          {data.riskList && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-body flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600" />
                  红色 KPI 清单 (完成率 &lt; 60%)
                  <Badge variant="outline" className="ml-2 text-footnote">
                    {data.riskList.risks.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.riskList.risks.length === 0 ? (
                  <p className="text-caption text-muted-foreground">
                    没有红色 KPI · 全部完成率 ≥ 60% 🎉
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.riskList.risks.slice(0, 20).map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-2 text-caption border-l-2 border-rose-300 pl-2 py-0.5"
                      >
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-mono text-footnote text-muted-foreground mr-1">
                            {r.subjectCode}
                          </span>
                          {r.title}
                          <span className="text-footnote text-muted-foreground ml-2">
                            {userName(r.assigneeId)} · {r.scope}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-footnote text-muted-foreground tabular-nums">
                            {r.currentValue} / {r.targetValue}
                          </span>
                          <Badge variant="outline" className={HEALTH_BADGE.red}>
                            {Math.round(r.completion * 100)}%
                          </Badge>
                        </div>
                      </li>
                    ))}
                    {data.riskList.risks.length > 20 && (
                      <li className="text-footnote text-muted-foreground pl-2 pt-1">
                        …还有 {data.riskList.risks.length - 20} 条
                      </li>
                    )}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {/* 5. cascade-coverage + 6. data-source + 7. scope-balance + 8. weight-validation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.cascadeCoverage && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-body flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Cascade 覆盖
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-caption">
                  {data.cascadeCoverage.levels.map((lvl, i) => (
                    <div key={lvl.level} className="space-y-1">
                      {i > 0 && <div className="border-t my-1" />}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{lvl.label}层 KPI 总数</span>
                        <span className="font-semibold">{lvl.total}</span>
                      </div>
                      {lvl.orphan > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">无父级 (孤儿)</span>
                          <span className="text-rose-700 font-semibold">{lvl.orphan}</span>
                        </div>
                      )}
                      {lvl.uncascaded > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">未向下拆解</span>
                          <span className="text-warning font-semibold">{lvl.uncascaded}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {data.dataSource && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-body flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    数据来源分布
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-caption">
                  {Object.entries(data.dataSource.counts).map(([src, count]) => (
                    <div key={src} className="flex justify-between items-center">
                      <span className="capitalize">
                        {src === 'erp'
                          ? '通道 B · ERP 自动'
                          : src === 'manual'
                          ? '通道 C · 人工补录'
                          : src === 'pending'
                          ? '待录入'
                          : src}
                      </span>
                      <span className="tabular-nums font-semibold">{count}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between text-footnote text-muted-foreground">
                    <span>合计</span>
                    <span>{data.dataSource.total}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.scopeBalance && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-body flex items-center gap-2">
                    <Scale className="h-4 w-4" />
                    Scope 平衡 (bonus vs monitor)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-caption">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-md p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-footnote text-muted-foreground">bonus</span>
                        <span className="font-semibold">
                          {data.scopeBalance.bonus.count}
                        </span>
                      </div>
                      <div className="text-footnote text-muted-foreground">
                        总权重 {data.scopeBalance.bonus.totalWeight}
                      </div>
                      <div className="text-footnote text-muted-foreground">
                        {levelBreakdown(data.scopeBalance.bonus.byLevel)}
                      </div>
                    </div>
                    <div className="border rounded-md p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-footnote text-muted-foreground">monitor</span>
                        <span className="font-semibold">
                          {data.scopeBalance.monitor.count}
                        </span>
                      </div>
                      <div className="text-footnote text-muted-foreground">不进奖金</div>
                      <div className="text-footnote text-muted-foreground">
                        {levelBreakdown(data.scopeBalance.monitor.byLevel)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {data.weightValidation && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-body flex items-center gap-2">
                    {data.weightValidation.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                    权重 = 100 校验
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-caption">
                  {data.weightValidation.ok ? (
                    <p className="text-emerald-700">
                      所有 assignee 的 bonus KPI 权重之和 = 100 ✓
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {data.weightValidation.violations.map((v) => (
                        <li
                          key={v.assigneeId}
                          className="flex justify-between border-l-2 border-rose-300 pl-2"
                        >
                          <span>{userName(v.assigneeId)}</span>
                          <span className="tabular-nums text-rose-700">
                            {v.totalWeight} / {v.expected}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
