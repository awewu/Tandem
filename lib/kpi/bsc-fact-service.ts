/**
 * BSC 全维度事实层 (跨财年真实同比 · 与 FP&A 同一套只读推演纪律)
 *
 * ─────────────────────────────────────────────────────────
 * 根治的假闭环: app/kpi/page.tsx 原 calcDeltas() 的"同比"是
 *   `(current - target * 0.85) / (target * 0.85)` —— 用当期目标 × 0.85
 *   **虚构**去年同期值, 从未查过任何历史数据。
 *
 * 本服务提供跨 KpiCycle(按 fiscalYear)的真实同比事实查询:
 *   给定一条 Kpi, 按 (subjectId, assigneeId, level) 在 tenantId 下找到
 *   fiscalYear-1 对应周期里的同一条 KPI, 用它的真实 currentValue 做基准。
 *   查不到真实历史 → 返回 null, 前端显示"暂无同比数据", 绝不编造。
 *
 * 与 lib/governance/delivery-baseline.ts 同一纪律: 纯只读, 不写任何值,
 * 是未来"目标自动生成引擎"的数据地基(先把真实历史事实立起来, 再谈生成算法)。
 */

import type { Kpi, KpiCycle } from '@/lib/types/kpi';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { getStore } from '@/lib/storage/repository';

export interface KpiYoyFact {
  kpiId: string;
  /** 上一财年匹配到的 KPI id (未找到则 undefined) */
  priorKpiId?: string;
  /** 上一财年的真实 currentValue (未找到则 null) */
  priorActual: number | null;
  /** 上一财年的财年号 (供 UI 展示 "vs FY2025") */
  priorFiscalYear: number | null;
  /** 真实同比 %, 无法计算 (缺历史/分母为0) 时为 null */
  yoyPct: number | null;
}

/** 按 fiscalYear 建索引, 供批量匹配 */
function indexCyclesByFiscalYear(cycles: KpiCycle[]): Map<number, KpiCycle> {
  const map = new Map<number, KpiCycle>();
  for (const c of cycles) map.set(c.fiscalYear, c);
  return map;
}

/**
 * 批量计算一批 KPI 的真实同比事实。
 * 调用方需保证 kpis 属于同一 tenantId (通常是同一周期下的全部 KPI)。
 */
export async function computeYoyFacts(
  tenantId: string,
  kpis: Pick<Kpi, 'id' | 'subjectId' | 'assigneeId' | 'level' | 'cycleId' | 'currentValue'>[],
): Promise<Map<string, KpiYoyFact>> {
  const store = getStore();
  const out = new Map<string, KpiYoyFact>();
  if (kpis.length === 0) return out;

  const allCycles = await withTenantScope(store.kpiCycles, tenantId).list();
  const cyclesByFiscalYear = indexCyclesByFiscalYear(allCycles);
  const cycleById = new Map(allCycles.map((c) => [c.id, c]));

  // 按需要对比的上一财年周期分组抓取, 避免对每条 KPI 单独 list() 全表
  const priorCycleIdsNeeded = new Set<string>();
  for (const k of kpis) {
    const cycle = cycleById.get(k.cycleId);
    if (!cycle) continue;
    const prior = cyclesByFiscalYear.get(cycle.fiscalYear - 1);
    if (prior) priorCycleIdsNeeded.add(prior.id);
  }

  const priorKpisByCycle = new Map<string, Kpi[]>();
  await Promise.all(
    Array.from(priorCycleIdsNeeded).map(async (cycleId) => {
      const rows = await withTenantScope(store.kpis, tenantId).list({ cycleId });
      priorKpisByCycle.set(cycleId, rows);
    }),
  );

  for (const k of kpis) {
    const cycle = cycleById.get(k.cycleId);
    const priorCycle = cycle ? cyclesByFiscalYear.get(cycle.fiscalYear - 1) : undefined;
    if (!priorCycle) {
      out.set(k.id, { kpiId: k.id, priorActual: null, priorFiscalYear: null, yoyPct: null });
      continue;
    }
    const priorRows = priorKpisByCycle.get(priorCycle.id) ?? [];
    const match = priorRows.find(
      (p) => p.subjectId === k.subjectId && p.assigneeId === k.assigneeId && p.level === k.level,
    );
    if (!match) {
      out.set(k.id, {
        kpiId: k.id,
        priorActual: null,
        priorFiscalYear: priorCycle.fiscalYear,
        yoyPct: null,
      });
      continue;
    }
    const priorActual = match.currentValue;
    const yoyPct = priorActual !== 0 ? ((k.currentValue - priorActual) / Math.abs(priorActual)) * 100 : null;
    out.set(k.id, {
      kpiId: k.id,
      priorKpiId: match.id,
      priorActual,
      priorFiscalYear: priorCycle.fiscalYear,
      yoyPct,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// 真实环比 (QoQ) — 按日历季度边界对齐, 与上方 YoY 同一套统计学纪律:
// 查不到某季度真实快照 → 返回 null, 绝不用"最近两条快照"这种颗粒度不明的近似值
// 冒充"环比"(旧实现问题: 快照按日采集时, 相邻两条实际是日环比, 却标成"周环比")。
// 纯函数, 无 IO 依赖, 前端已有 KpiSnapshot 数组即可直接算, 无需额外接口。
// ---------------------------------------------------------------------------

export interface QoqSnapshotPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface KpiQoqFact {
  /** 本季度(截至 asOf)最新快照值; 无数据为 null */
  currentQuarterValue: number | null;
  /** 上一季度末(季末当天或之前最后一条)快照值; 无数据为 null */
  priorQuarterValue: number | null;
  /** 真实环比 %, 缺一头数据或分母为 0 时为 null */
  qoqPct: number | null;
}

function quarterOf(dateStr: string): { year: number; q: number } {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return { year: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1 };
}

/** 某年某季度的最后一天 (YYYY-MM-DD) */
function quarterEndDate(year: number, q: number): string {
  const endMonth = q * 3; // 3/6/9/12, Date 的 day=0 取上个月最后一天 = 该季度最后一天
  return new Date(Date.UTC(year, endMonth, 0)).toISOString().slice(0, 10);
}

function priorQuarterOf(year: number, q: number): { year: number; q: number } {
  return q === 1 ? { year: year - 1, q: 4 } : { year, q: q - 1 };
}

/**
 * 按真实日历季度边界计算环比: 本季度(截至 asOfDate, 缺省=最新快照日) vs 上一季度末。
 * @param snapshots 该 KPI 的全部快照 (无需预排序)
 * @param asOfDate 缺省取 snapshots 里最晚的日期 (即"live"当前进度)
 */
export function computeQoqFact(snapshots: QoqSnapshotPoint[], asOfDate?: string): KpiQoqFact {
  if (snapshots.length === 0) {
    return { currentQuarterValue: null, priorQuarterValue: null, qoqPct: null };
  }
  const sorted = [...snapshots].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const asOf = asOfDate ?? sorted[sorted.length - 1].date;

  const lastValueAtOrBefore = (cutoff: string): number | null => {
    let val: number | null = null;
    for (const s of sorted) {
      if (s.date <= cutoff) val = s.value;
      else break;
    }
    return val;
  };

  const { year, q } = quarterOf(asOf);
  const prior = priorQuarterOf(year, q);
  const currentQuarterValue = lastValueAtOrBefore(asOf);
  const priorQuarterValue = lastValueAtOrBefore(quarterEndDate(prior.year, prior.q));

  const qoqPct =
    currentQuarterValue != null && priorQuarterValue != null && priorQuarterValue !== 0
      ? ((currentQuarterValue - priorQuarterValue) / Math.abs(priorQuarterValue)) * 100
      : null;

  return { currentQuarterValue, priorQuarterValue, qoqPct };
}
