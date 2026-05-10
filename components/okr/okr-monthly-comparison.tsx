'use client';

/**
 * OKR 月度对比表 + MoM 环比 · P0.3 + P0.4 (2026-05-10)
 *
 * 解决 Tita 缺口:
 *   - 月度 Plan vs Actual 时间轴 (对齐 cycle 起止按月切)
 *   - MoM 环比 (本月 progress - 上月 progress, 数值 + 颜色趋势)
 *
 * 数据源: 现有 checkIns (已有 scope+scopeId+progressAfter+createdAt)
 *         + KR targetValue (线性期望)
 *         + cycle startDate/endDate (决定月数)
 *
 * 不新增 store 字段 / 不改 schema. 纯派生计算.
 *
 * M2 增强占位:
 *   - 多季度 YoY (数据足够后开)
 *   - 按部门聚合版
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Minus, TrendingUp, Calendar } from 'lucide-react';
import type { CheckIn, Cycle, KeyResult, Objective } from '@/lib/store';

interface Props {
  objective: Objective;
  cycle: Cycle | undefined;
  keyResults: KeyResult[];
  checkIns: CheckIn[];
}

interface MonthBucket {
  key: string;        // '2026-04'
  label: string;      // '4 月'
  startMs: number;
  endMs: number;
}

/** 把 cycle 切成月 bucket 列表 (起始月 → 结束月) */
function buildMonthBuckets(cycle: Cycle | undefined): MonthBucket[] {
  if (!cycle) return [];
  const start = new Date(cycle.startDate);
  const end = new Date(cycle.endDate);
  const buckets: MonthBucket[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const hard = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= hard) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthStart = new Date(y, m, 1).getTime();
    const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
    buckets.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: `${m + 1} 月`,
      startMs: monthStart,
      endMs: monthEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

/** 月末实际值 = 该月最后一条 check-in 的 progressAfter; 该月无 check-in 则继承上月末值 */
function actualAtMonthEnd(
  checkIns: CheckIn[],
  monthEndMs: number,
): number | null {
  const hit = checkIns
    .filter((c) => c.createdAt <= monthEndMs)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  return hit ? hit.progressAfter : null;
}

/** 线性期望: 按 cycle 内的时间占比线性推进 */
function planAtMonthEnd(cycle: Cycle, monthEndMs: number): number {
  if (monthEndMs <= cycle.startDate) return 0;
  if (monthEndMs >= cycle.endDate) return 100;
  const total = cycle.endDate - cycle.startDate;
  const elapsed = monthEndMs - cycle.startDate;
  return Math.round((elapsed / total) * 100);
}

/** KR 的 progress = (current - start) / (target - start) * 100 */
function krProgress(kr: KeyResult): number {
  const denom = kr.targetValue - kr.startValue;
  if (Math.abs(denom) < 0.0001) return kr.currentValue >= kr.targetValue ? 100 : 0;
  const pct = ((kr.currentValue - kr.startValue) / denom) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function varianceChip(plan: number, actual: number | null): React.ReactNode {
  if (actual === null) return <span className="text-slate-400 text-[10px]">—</span>;
  const diff = actual - plan;
  if (Math.abs(diff) < 3) {
    return (
      <Badge variant="outline" className="gap-0.5 text-[10px] border-slate-300 text-slate-600">
        <Minus className="h-2.5 w-2.5" /> 同步
      </Badge>
    );
  }
  if (diff > 0) {
    return (
      <Badge className="gap-0.5 text-[10px] bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        <ArrowUp className="h-2.5 w-2.5" /> +{diff}
      </Badge>
    );
  }
  return (
    <Badge className="gap-0.5 text-[10px] bg-rose-100 text-rose-800 hover:bg-rose-100">
      <ArrowDown className="h-2.5 w-2.5" /> {diff}
    </Badge>
  );
}

function momChip(curr: number | null, prev: number | null): React.ReactNode {
  if (curr === null || prev === null) return <span className="text-slate-400 text-[10px]">—</span>;
  const diff = curr - prev;
  if (diff === 0) {
    return <span className="text-[10px] text-slate-500">持平</span>;
  }
  if (diff > 0) {
    return <span className="text-[10px] text-emerald-700 font-medium">+{diff} pp</span>;
  }
  return <span className="text-[10px] text-rose-700 font-medium">{diff} pp</span>;
}

export function OKRMonthlyComparison({ objective, cycle, keyResults, checkIns }: Props) {
  const buckets = useMemo(() => buildMonthBuckets(cycle), [cycle]);
  // SSR 安全: Date.now() 不能在 render 里用, 否则 hydration mismatch.
  // 先给 0 让 SSR 和首次 CSR 一致, mount 后再设真值 (也兼职 'now' 每分钟刷新).
  const [nowMs, setNowMs] = useState<number>(0);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Objective 级 checkIns (scope=objective) + 每 KR 的 checkIns
  const objectiveCheckIns = useMemo(
    () => checkIns.filter((c) => c.scope === 'objective' && c.scopeId === objective.id),
    [checkIns, objective.id]
  );
  // objectiveActuals 依赖 nowMs 用于未来月处理逻辑, 加入 deps
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _nowDep = nowMs;

  /** Objective 月末 actual (降级: 无 objective check-in 时用 KR 加权平均) */
  const objectiveActuals = useMemo(() => {
    return buckets.map((b) => {
      const direct = actualAtMonthEnd(objectiveCheckIns, b.endMs);
      if (direct !== null) return direct;
      // 降级: 用 KR 加权平均
      if (!keyResults.length) return null;
      const totalWeight = keyResults.reduce((s, k) => s + (k.weight || 0), 0) || keyResults.length;
      let sum = 0;
      for (const kr of keyResults) {
        const krCi = checkIns.filter((c) => c.scope === 'kr' && c.scopeId === kr.id);
        const krActual = actualAtMonthEnd(krCi, b.endMs);
        const progress = krActual ?? (nowMs === 0 || b.endMs >= nowMs ? null : 0);
        if (progress === null) return null;
        const w = kr.weight || 1;
        sum += (progress * w) / (totalWeight || 1);
      }
      return Math.round(sum);
    });
  }, [buckets, objectiveCheckIns, keyResults, checkIns]);

  if (!cycle) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        该 Objective 未绑定 cycle, 无法展开月度对比
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        cycle {cycle.name} 跨度为 0 月
      </div>
    );
  }

  // KR 级 actual 矩阵 (row=kr, col=month)
  const krActuals: (number | null)[][] = keyResults.map((kr) => {
    const ci = checkIns.filter((c) => c.scope === 'kr' && c.scopeId === kr.id);
    return buckets.map((b) => actualAtMonthEnd(ci, b.endMs));
  });

  // 当前月索引 (for 高亮). nowMs=0 时 (SSR / 未 mount) 不高亮任何月
  const currentMonthIdx = nowMs === 0
    ? -1
    : buckets.findIndex((b) => nowMs >= b.startMs && nowMs <= b.endMs);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            月度 Plan vs Actual + MoM 环比
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {cycle.name} · {buckets.length} 月 · 按月末 check-in 快照聚合
          </div>
        </div>
        <Badge variant="outline" className="text-[10px]">
          <Calendar className="h-3 w-3 mr-0.5" />
          {new Date(cycle.startDate).toLocaleDateString('zh-CN')}
          {' → '}
          {new Date(cycle.endDate).toLocaleDateString('zh-CN')}
        </Badge>
      </div>

      {/* Objective 主表 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Objective 整体</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-1.5 pr-3 font-medium whitespace-nowrap">行</th>
                {buckets.map((b, i) => (
                  <th
                    key={b.key}
                    className={`text-center py-1.5 px-2 font-medium whitespace-nowrap ${
                      i === currentMonthIdx ? 'bg-amber-50 text-amber-900 rounded-t' : ''
                    }`}
                  >
                    {b.label}
                    {i === currentMonthIdx && (
                      <span className="ml-1 text-[9px] text-amber-600">● 本月</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Plan 行 (线性期望) */}
              <tr className="border-b">
                <td className="py-1.5 pr-3 text-slate-600">计划 Plan</td>
                {buckets.map((b) => (
                  <td key={b.key} className="text-center py-1.5 px-2 tabular-nums text-slate-600">
                    {planAtMonthEnd(cycle, b.endMs)}%
                  </td>
                ))}
              </tr>
              {/* Actual 行 */}
              <tr className="border-b">
                <td className="py-1.5 pr-3 font-medium">实际 Actual</td>
                {objectiveActuals.map((actual, i) => (
                  <td
                    key={buckets[i].key}
                    className={`text-center py-1.5 px-2 tabular-nums font-medium ${
                      i === currentMonthIdx ? 'bg-amber-50' : ''
                    }`}
                  >
                    {actual === null ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      `${actual}%`
                    )}
                  </td>
                ))}
              </tr>
              {/* Variance 行 */}
              <tr className="border-b">
                <td className="py-1.5 pr-3 text-slate-600">偏差 Var</td>
                {objectiveActuals.map((actual, i) => (
                  <td key={buckets[i].key} className="text-center py-1.5 px-2">
                    {varianceChip(planAtMonthEnd(cycle, buckets[i].endMs), actual)}
                  </td>
                ))}
              </tr>
              {/* MoM 行 */}
              <tr>
                <td className="py-1.5 pr-3 text-slate-600">环比 MoM</td>
                {objectiveActuals.map((actual, i) => (
                  <td key={buckets[i].key} className="text-center py-1.5 px-2">
                    {i === 0 ? (
                      <span className="text-[10px] text-slate-400">—</span>
                    ) : (
                      momChip(actual, objectiveActuals[i - 1])
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* KR 级明细表 */}
      {keyResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              KR 明细 ({keyResults.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-1.5 pr-3 font-medium min-w-[200px]">KR</th>
                  <th className="text-center py-1.5 px-2 font-medium whitespace-nowrap">当前</th>
                  {buckets.map((b, i) => (
                    <th
                      key={b.key}
                      className={`text-center py-1.5 px-2 font-medium whitespace-nowrap ${
                        i === currentMonthIdx ? 'bg-amber-50 text-amber-900' : ''
                      }`}
                    >
                      {b.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keyResults.map((kr, rowIdx) => {
                  const row = krActuals[rowIdx];
                  return (
                    <tr key={kr.id} className="border-b hover:bg-muted/30">
                      <td className="py-1.5 pr-3">
                        <div className="font-medium truncate max-w-[220px]" title={kr.title}>
                          {kr.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {kr.startValue} → {kr.targetValue} {kr.unit}
                        </div>
                      </td>
                      <td className="text-center py-1.5 px-2 font-medium tabular-nums">
                        {krProgress(kr)}%
                      </td>
                      {row.map((v, i) => (
                        <td
                          key={buckets[i].key}
                          className={`text-center py-1.5 px-2 tabular-nums ${
                            i === currentMonthIdx ? 'bg-amber-50' : ''
                          } ${v === null ? 'text-slate-300' : ''}`}
                        >
                          {v === null ? '—' : `${v}%`}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 说明 */}
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-3 text-[11px] text-slate-600 space-y-1">
        <div>
          <span className="font-medium">📐 Plan:</span>{' '}
          cycle 内线性期望 (时间占比).{' '}
          <span className="font-medium ml-2">📊 Actual:</span>{' '}
          该月末前最后一条 check-in 的 <code>progressAfter</code>.
        </div>
        <div>
          <span className="font-medium">📏 Var:</span>{' '}
          Actual − Plan (&gt; 0 为超前, &lt; 0 为落后, ±3pp 视为同步).{' '}
          <span className="font-medium ml-2">🔁 MoM:</span>{' '}
          本月末 Actual − 上月末 Actual (pp = percentage point).
        </div>
        <div className="text-slate-500 italic">
          数据源 = checkIns (零新字段). KR 行无 check-in 的月份留空.
        </div>
      </div>
    </div>
  );
}
