'use client';

/**
 * 三省六部 · FP&A 引擎视图 (经营·成本中心 BSC + FP&A 推演)
 *
 * docs/GOVERNANCE-FPA-ENGINE-2026-06-09.md:
 *   - CostCenterBscView : 尚书六部=成本中心单元, 每单元展示四维 BSC (门下底线 + 尚书体检)
 *   - FpaRehearsalView  : 抓 OKR (KR.targetKpiId+expectedKpiDelta) → DeliveryBaseline 投影 BSC 末值
 *
 * 纪律: 只读 + 只产预测, 不写任何真值。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Network,
  Building2,
  TrendingUp,
  AlertTriangle,
  Scale,
  ArrowUp,
  ArrowDown,
  Check,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BSC_PERSPECTIVE, type BscPerspective } from '@/lib/design-tokens';
import {
  BSC_PERSPECTIVES,
  computeBscDistribution,
  assessBscBalance,
} from '@/lib/kpi/bsc-validation';
import { useOKRStore } from '@/lib/store';
import {
  projectDeliveryBaseline,
  type DeliveryBaselineInput,
  type KpiProjection,
} from '@/lib/governance/delivery-baseline';
import {
  calibrateCausalStrength,
  toCausalLinkPatch,
  type StrengthCalibration,
  type BaselineCalibrationResult,
} from '@/lib/governance/baseline-calibration';

// ---------------------------------------------------------------------------
// 共享: KPI 类型 (最小子集) + 周期加载
// ---------------------------------------------------------------------------

interface KpiLite {
  id: string;
  title: string;
  level: 'individual' | 'department' | 'system' | 'business_unit' | 'company';
  departmentId?: string;
  assigneeId: string;
  subjectId: string;
  bscPerspective?: BscPerspective;
  scope: 'bonus' | 'monitor';
  weight: number;
  startValue: number;
  currentValue: number;
  targetValue: number;
  unit?: string | null;
}

interface CausalLite {
  id: string;
  fromKpiId: string;
  toKpiId: string;
  strength: number;
}

interface CycleLite {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'closed';
}

async function loadActiveCycle(): Promise<CycleLite | null> {
  try {
    const r = await fetch('/api/kpi/cycles', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    const cycles: CycleLite[] = j.cycles ?? [];
    return cycles.find((c) => c.status === 'active') ?? cycles[0] ?? null;
  } catch {
    return null;
  }
}

const LEVEL_LABEL: Record<KpiLite['level'], string> = {
  individual: '个人',
  department: '部门',
  system: '体系',
  business_unit: '事业部',
  company: '公司',
};

const BALANCE_BADGE = {
  healthy: { label: '四维均衡', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  warning: { label: '配比预警', cls: 'bg-warning/5 text-warning border-warning/20' },
  imbalanced: { label: '战略失衡', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
} as const;

// ===========================================================================
// 视图 1 · 经营 · 成本中心 BSC
// ===========================================================================

export function CostCenterBscView() {
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<CycleLite | null>(null);
  const [kpis, setKpis] = useState<KpiLite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await loadActiveCycle();
      setCycle(c);
      if (!c) {
        setKpis([]);
        return;
      }
      const r = await fetch(`/api/kpi?cycleId=${encodeURIComponent(c.id)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setKpis(j.kpis ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 成本中心单元 = (level, departmentId|assigneeId) 分组. 默认聚焦部门/体系/事业部三层.
  const units = useMemo(() => {
    const groups = new Map<string, { key: string; level: KpiLite['level']; unitId: string; kpis: KpiLite[] }>();
    for (const k of kpis) {
      if (k.level === 'individual' || k.level === 'company') continue; // 成本中心聚焦组织单元层
      const unitId = k.departmentId || k.assigneeId || '(未指派)';
      const key = `${k.level}:${unitId}`;
      if (!groups.has(key)) groups.set(key, { key, level: k.level, unitId, kpis: [] });
      groups.get(key)!.kpis.push(k);
    }
    return Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [kpis]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-caption">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载成本中心 BSC…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            尚书 · 执行 · 成本中心
          </Badge>
          <span className="text-footnote text-muted-foreground">
            每个执行单元 = 成本中心, 展示四维 BSC 底线 (bonus 强考核 + monitor 参考)
            {cycle && <> · 周期 <strong>{cycle.name}</strong></>}
          </span>
        </div>

        {error && (
          <Card><CardContent className="p-4 text-rose-600 text-caption">加载失败: {error}</CardContent></Card>
        )}

        {!error && units.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-caption">
              <Building2 className="w-10 h-10 mx-auto opacity-20 mb-2" />
              当前周期暂无部门/体系/事业部级 KPI。请在「管理 · KPI 设置」为各成本中心单元设定四维 KPI。
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {units.map((u) => (
            <CostCenterCard key={u.key} level={u.level} unitId={u.unitId} kpis={u.kpis} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CostCenterCard({
  level,
  unitId,
  kpis,
}: {
  level: KpiLite['level'];
  unitId: string;
  kpis: KpiLite[];
}) {
  // 复用 BSC 校验纯函数 (只算 bonus 配比)
  const dist = useMemo(
    () => computeBscDistribution(kpis, [], { onlyBonus: true }),
    [kpis],
  );
  const report = useMemo(() => assessBscBalance(dist), [dist]);
  const balance = BALANCE_BADGE[report.level];
  const bonusCount = kpis.filter((k) => k.scope === 'bonus').length;
  const monitorCount = kpis.filter((k) => k.scope === 'monitor').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-caption flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Building2 className="w-4 h-4" />
            {LEVEL_LABEL[level]} · {unitId}
          </span>
          <Badge variant="outline" className={cn('text-[10px]', balance.cls)}>
            {balance.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-[11px] text-muted-foreground">
          {bonusCount} 个强考核 (bonus) · {monitorCount} 个参考 (monitor)
        </div>
        {/* 四维占比条 */}
        <div className="space-y-1.5">
          {BSC_PERSPECTIVES.map((p) => {
            const meta = BSC_PERSPECTIVE[p];
            const share = dist.byPerspective[p];
            const count = dist.countByPerspective[p];
            return (
              <div key={p} className="flex items-center gap-2">
                <span className="text-[11px] w-20 shrink-0 flex items-center gap-1">
                  {meta.emoji} {meta.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', meta.bar)}
                    style={{ width: `${Math.round(share * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums w-14 text-right text-muted-foreground">
                  {Math.round(share * 100)}% · {count}
                </span>
              </div>
            );
          })}
        </div>
        {report.issues.length > 0 && (
          <div className="text-[10px] text-warning flex items-start gap-1 pt-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{report.issues[0].message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// 视图 2 · FP&A 推演 (DeliveryBaseline)
// ===========================================================================

export function FpaRehearsalView() {
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<CycleLite | null>(null);
  const [kpis, setKpis] = useState<KpiLite[]>([]);
  const [links, setLinks] = useState<CausalLite[]>([]);
  const [error, setError] = useState<string | null>(null);

  const keyResults = useOKRStore((s) => s.keyResults);
  const getKRProgress = useOKRStore((s) => s.getKRProgress);

  // 差异校准 (周期 close 后用真值对比推演 → 因果链强度建议)
  const [showCalibration, setShowCalibration] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [applyError, setApplyError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await loadActiveCycle();
      setCycle(c);
      if (!c) {
        setKpis([]);
        setLinks([]);
        return;
      }
      const [rk, rl] = await Promise.all([
        fetch(`/api/kpi?cycleId=${encodeURIComponent(c.id)}`, { cache: 'no-store' }),
        fetch(`/api/kpi/causal-links?cycleId=${encodeURIComponent(c.id)}`, { cache: 'no-store' }),
      ]);
      if (!rk.ok) throw new Error(`KPI HTTP ${rk.status}`);
      const jk = await rk.json();
      setKpis(jk.kpis ?? []);
      if (rl.ok) {
        const jl = await rl.json();
        setLinks((jl.links ?? []).map((l: CausalLite) => ({ id: l.id, fromKpiId: l.fromKpiId, toKpiId: l.toKpiId, strength: l.strength })));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 锚定 KR (有 targetKpiId) → 按 KPI 聚合为 drivers
  const anchoredKRs = useMemo(
    () => keyResults.filter((k) => k.targetKpiId && k.expectedKpiDelta != null),
    [keyResults],
  );

  const baseline = useMemo(() => {
    if (kpis.length === 0) return null;
    const driversByKpi = new Map<string, DeliveryBaselineInput['kpis'][number]['drivers']>();
    for (const kr of anchoredKRs) {
      const arr = driversByKpi.get(kr.targetKpiId!) ?? [];
      arr.push({
        krId: kr.id,
        krTitle: kr.title || '(未命名 KR)',
        progress: getKRProgress(kr.id) / 100,
        expectedKpiDelta: Number(kr.expectedKpiDelta),
      });
      driversByKpi.set(kr.targetKpiId!, arr);
    }
    const input: DeliveryBaselineInput = {
      cycleId: cycle?.id ?? '',
      generatedAt: new Date().toISOString(),
      kpis: kpis.map((k) => ({
        kpiId: k.id,
        title: k.title,
        perspective: k.bscPerspective,
        startValue: k.startValue,
        currentValue: k.currentValue,
        targetValue: k.targetValue,
        drivers: driversByKpi.get(k.id) ?? [],
      })),
      causalEdges: links.map((l) => ({ fromKpiId: l.fromKpiId, toKpiId: l.toKpiId, strength: l.strength, linkId: l.id })),
    };
    return projectDeliveryBaseline(input);
  }, [kpis, anchoredKRs, links, cycle, getKRProgress]);

  // 只展示有驱动或有传导贡献的 KPI (其余末值=现值, 无推演意义)
  const activeProjections = useMemo(
    () => (baseline?.projections ?? []).filter((p) => p.contributions.length > 0),
    [baseline],
  );

  // 差异校准: 用当前真值 (周期 close 后即终值) 对比推演 → 因果链强度建议
  const calibration = useMemo(() => {
    if (!baseline) return null;
    const actuals: Record<string, number> = {};
    for (const k of kpis) actuals[k.id] = k.currentValue;
    const edges = links.map((l) => ({
      fromKpiId: l.fromKpiId,
      toKpiId: l.toKpiId,
      strength: l.strength,
      linkId: l.id,
    }));
    return calibrateCausalStrength(baseline, actuals, edges);
  }, [baseline, kpis, links]);

  const applyCalibration = useCallback(
    async (s: StrengthCalibration) => {
      const patch = toCausalLinkPatch(s);
      if (!patch) return;
      setApplyingId(s.linkId);
      setApplyError(null);
      try {
        const r = await fetch(`/api/kpi/causal-links/${encodeURIComponent(s.linkId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.message || j.error || `HTTP ${r.status}`);
        }
        setAppliedIds((prev) => new Set(prev).add(s.linkId));
        await reload();
      } catch (e) {
        setApplyError((e as Error).message);
      } finally {
        setApplyingId(null);
      }
    },
    [reload],
  );

  const actionableCount = useMemo(
    () => (calibration?.suggestions ?? []).filter((s) => toCausalLinkPatch(s)).length,
    [calibration],
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-caption">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> 加载 FP&A 推演…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="bg-warning/5 text-warning border-warning/20">
            门下 · 推演
          </Badge>
          <span className="text-footnote text-muted-foreground flex-1 min-w-[12rem]">
            抓 OKR 进度 → 投影 BSC 末值 (DeliveryBaseline) · <strong className="text-warning">预测, 非真值</strong>
            {cycle && <> · 周期 {cycle.name}</>}
          </span>
          {(calibration?.suggestions.length ?? 0) > 0 && (
            <Button
              size="sm"
              variant={showCalibration ? 'default' : 'outline'}
              className="h-7 text-footnote"
              onClick={() => setShowCalibration((v) => !v)}
            >
              <Scale className="w-3 h-3 mr-1" />
              差异校准{actionableCount > 0 ? ` · ${actionableCount} 条建议` : ''}
            </Button>
          )}
        </div>

        {showCalibration && calibration && (
          <CalibrationPanel
            calibration={calibration}
            cycleClosed={cycle?.status === 'closed'}
            applyingId={applyingId}
            appliedIds={appliedIds}
            applyError={applyError}
            onApply={applyCalibration}
          />
        )}

        {error && (
          <Card><CardContent className="p-4 text-rose-600 text-caption">加载失败: {error}</CardContent></Card>
        )}

        {!error && anchoredKRs.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-caption">
              <Network className="w-10 h-10 mx-auto opacity-20 mb-2" />
              暂无锚定 KR。请在「事半 · OKR」编辑 KR 时设置「FP&A 锚定」(目标 BSC KPI + 预期增量 Δ),
              FP&A 才能推演 OKR 对 BSC 的影响。
            </CardContent>
          </Card>
        )}

        {!error && anchoredKRs.length > 0 && activeProjections.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground text-caption">
              已有 {anchoredKRs.length} 个锚定 KR, 但其目标 KPI 不在当前周期。请确认 KR 锚定的 KPI 属于活跃 BSC 周期。
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {activeProjections.map((p) => (
            <ProjectionCard key={p.kpiId} p={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

const CONF_BADGE = {
  'on-track': { label: '达标', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'at-risk': { label: '有风险', cls: 'bg-warning/5 text-warning border-warning/20' },
  'off-track': { label: '不达', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
} as const;

const CALIB_ACTION = {
  increase: { label: '上调强度', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: ArrowUp },
  decrease: { label: '下调强度', cls: 'bg-rose-50 text-rose-700 border-rose-200', Icon: ArrowDown },
  hold: { label: '维持/验证', cls: 'bg-sky-50 text-sky-700 border-sky-200', Icon: Check },
  review: { label: '人工复核', cls: 'bg-warning/5 text-warning border-warning/20', Icon: Eye },
} as const;

function CalibrationPanel({
  calibration,
  cycleClosed,
  applyingId,
  appliedIds,
  applyError,
  onApply,
}: {
  calibration: BaselineCalibrationResult;
  cycleClosed: boolean;
  applyingId: string | null;
  appliedIds: Set<string>;
  applyError: string | null;
  onApply: (s: StrengthCalibration) => void;
}) {
  return (
    <Card className="border-violet-200 bg-violet-50/30 dark:bg-violet-900/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-caption flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-violet-600" />
          差异校准 · 真值 vs 推演 → 因果链强度建议
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          {cycleClosed
            ? '周期已 close, 下方为终值校准建议。'
            : '周期未 close — 下方为按当前真值的校准试算 (终值以 close 时为准)。'}
          {' '}建议须人工点「应用」方写回 (需 kpi.write · 宪法 A 不自动改治理配置)。
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {applyError && (
          <div className="text-[11px] text-rose-600">应用失败: {applyError}</div>
        )}
        {calibration.suggestions.map((s) => {
          const meta = CALIB_ACTION[s.action];
          const patch = toCausalLinkPatch(s);
          const applied = appliedIds.has(s.linkId);
          const applying = applyingId === s.linkId;
          return (
            <div
              key={s.linkId}
              className="rounded-md border bg-background p-2.5 flex items-start gap-2 flex-wrap"
            >
              <Badge variant="outline" className={cn('text-[10px] shrink-0', meta.cls)}>
                <meta.Icon className="w-3 h-3 mr-0.5" />
                {meta.label}
              </Badge>
              <div className="flex-1 min-w-[14rem] space-y-0.5">
                <div className="text-[11px]">{s.rationale}</div>
                {s.action !== 'review' && (
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    强度 {s.currentStrength.toFixed(2)}
                    {s.delta !== 0 && <> → <span className="text-violet-600 font-medium">{s.suggestedStrength.toFixed(2)}</span></>}
                    {' · '}下游真值 {fmt(s.evidence.actualValue)} vs 推演 {fmt(s.evidence.projectedValue)}
                    {' '}(差 {(s.evidence.variancePct * 100).toFixed(1)}%)
                  </div>
                )}
              </div>
              {patch && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[11px] shrink-0"
                  disabled={applying || applied}
                  onClick={() => onApply(s)}
                >
                  {applied ? (
                    <><Check className="w-3 h-3 mr-0.5" /> 已应用</>
                  ) : applying ? (
                    <><Loader2 className="w-3 h-3 mr-0.5 animate-spin" /> 应用中</>
                  ) : (
                    '应用'
                  )}
                </Button>
              )}
            </div>
          );
        })}
        {calibration.unattributed.length > 0 && (
          <div className="text-[10px] text-warning flex items-start gap-1 pt-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              {calibration.unattributed.length} 个 KPI 显著偏离推演但无入边因果链 (纯 OKR 估计误差):{' '}
              {calibration.unattributed.map((u) => u.title).join('、')} —— 建议补战略地图因果链。
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProjectionCard({ p }: { p: KpiProjection }) {
  const conf = CONF_BADGE[p.confidence];
  const meta = p.perspective ? BSC_PERSPECTIVE[p.perspective] : null;
  // 进度条: current / projected / target 在 [start, target] 量程上的位置
  const range = p.targetValue - p.startValue || 1;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - p.startValue) / range) * 100));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-caption flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1.5">
            {meta && <span>{meta.emoji}</span>}
            {p.title}
            {meta && (
              <Badge variant="outline" className={cn('text-[10px]', meta.badge)}>{meta.label}</Badge>
            )}
          </span>
          <Badge variant="outline" className={cn('text-[10px]', conf.cls)}>
            投影完成 {Math.round(p.projectedCompletion * 100)}% · {conf.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* 量程条: 现值(实) → 投影(虚) → 目标 */}
        <div className="relative h-2.5 rounded-full bg-muted">
          <div className="absolute h-full rounded-full bg-sky-400/70" style={{ width: `${pos(p.currentValue)}%` }} />
          <div
            className="absolute h-full rounded-full border-r-2 border-violet-500"
            style={{ width: `${pos(p.projectedValue)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>现值 {fmt(p.currentValue)}</span>
          <span className="text-violet-600 font-medium">推演末值 {fmt(p.projectedValue)}</span>
          <span>目标 {fmt(p.targetValue)}</span>
        </div>
        {p.gap > 0 ? (
          <div className="text-[11px] text-warning flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 距目标还差 {fmt(p.gap)}
          </div>
        ) : (
          <div className="text-[11px] text-emerald-700 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> 推演可达标 (超出 {fmt(-p.gap)})
          </div>
        )}
        {/* 贡献明细 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {p.contributions.map((c, i) => (
            <Badge
              key={i}
              variant="outline"
              className={cn(
                'text-[10px] font-normal',
                c.kind === 'okr'
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-sky-50 text-sky-700 border-sky-200',
              )}
            >
              {c.kind === 'okr' ? 'KR' : '传导'} · {c.source} {c.value >= 0 ? '+' : ''}{fmt(c.value)}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n * 100) / 100;
  return String(r);
}
