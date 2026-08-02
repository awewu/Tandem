/**
 * lib/eval/pass-k.ts · P0-2 Pass^k 多试一致性 (纯函数, 可单测)
 *
 * 前沿 (Claw-Eval): 单次 pass 不足以度量生产可靠性 — 同一任务跑 k 次, 只有 **k 次全过**
 * 才算真正可靠 (pass^k)。单次偶然通过 (flaky) 会被 pass^k 暴露。
 *
 * API 模式约束: 我们不做在线重跑 (无法保证幂等 + 烧 token), 而是对**已采集的重复 trace**
 * 按 (kind + 归一化 inputSummary) 分组, 取每组最近 k 条, 计算"k 次是否全过"的一致性。
 * 这度量的是"同类输入的稳定性", 与 Claw-Eval pass^k 语义一致, 且零额外成本。
 *
 * 纪律: 纯只读聚合, 无副作用, 永不抛。
 */

import type { EvalTrace, EvalTraceKind } from '@/lib/types/eval';

/** 一条 trace 是否"通过": 有评分且无任一 grader fail (全 pass)。无评分 → 视为未通过 (保守)。 */
export function tracePassed(trace: Pick<EvalTrace, 'grades'>): boolean {
  const grades = trace.grades ?? [];
  if (grades.length === 0) return false;
  return grades.every((g) => g.pass);
}

/** 归一化输入摘要, 让"同一类问题"能聚到一组 (去空白/小写/截断)。 */
export function normalizeInput(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[，。！？、；：""''（）]/g, '')
    .trim()
    .slice(0, 120);
}

export interface PassKGroup {
  kind: EvalTraceKind;
  inputKey: string;
  /** 该组参与计算的样本数 (取最近 k 条) */
  runs: number;
  /** 这 k 次全过 → true */
  allPassed: boolean;
  /** k 次里实际通过的次数 */
  passedCount: number;
}

export interface PassKResult {
  k: number;
  /** 满足 ≥k 条样本的组数 (分母) */
  eligibleGroups: number;
  /** k 次全过的组数 (分子) */
  consistentGroups: number;
  /** pass^k 一致性 = consistentGroups / eligibleGroups; 无合格组 → null */
  passAtK: number | null;
  /** 单次通过率 (所有合格组的所有 run 里 pass 占比) — 对照 pass^k 看 flaky 程度 */
  singlePassRate: number | null;
  groups: PassKGroup[];
}

/**
 * 计算 pass^k 一致性。
 * @param traces 已采集 trace (需含 grades)
 * @param k 试次数 (默认 3 = Pass^3)
 */
export function computePassK(traces: EvalTrace[], k = 3): PassKResult {
  const empty: PassKResult = {
    k,
    eligibleGroups: 0,
    consistentGroups: 0,
    passAtK: null,
    singlePassRate: null,
    groups: [],
  };
  if (k < 1 || traces.length === 0) return empty;

  // 分组: kind + 归一化输入
  const buckets = new Map<string, EvalTrace[]>();
  for (const t of traces) {
    const key = `${t.kind}::${normalizeInput(t.inputSummary)}`;
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }

  const groups: PassKGroup[] = [];
  let consistentGroups = 0;
  let totalRuns = 0;
  let totalPassedRuns = 0;

  for (const [key, arr] of Array.from(buckets.entries())) {
    if (arr.length < k) continue; // 样本不足 k 条 → 不参与 pass^k
    // 取最近 k 条 (按 createdAt 降序)
    const recent = [...arr].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, k);
    const passedCount = recent.filter(tracePassed).length;
    const allPassed = passedCount === k;
    if (allPassed) consistentGroups += 1;
    totalRuns += k;
    totalPassedRuns += passedCount;
    const [kind, inputKey] = key.split('::');
    groups.push({
      kind: kind as EvalTraceKind,
      inputKey,
      runs: k,
      allPassed,
      passedCount,
    });
  }

  const eligibleGroups = groups.length;
  return {
    k,
    eligibleGroups,
    consistentGroups,
    passAtK: eligibleGroups > 0 ? consistentGroups / eligibleGroups : null,
    singlePassRate: totalRuns > 0 ? totalPassedRuns / totalRuns : null,
    groups: groups.sort((a, b) => Number(a.allPassed) - Number(b.allPassed)),
  };
}

// ---------------------------------------------------------------------------
// P2 #18 · 可靠性衰退曲线 (RDC · Reliability Decline Curve)
// ---------------------------------------------------------------------------

/** 任务时长档 (以 roundsExecuted 为 horizon 代理: 轮次越多 = 任务越长)。 */
export type DurationBucket = 'short' | 'medium' | 'long' | 'very_long';

export function durationBucketOf(roundsExecuted: number): DurationBucket {
  if (roundsExecuted <= 1) return 'short';
  if (roundsExecuted <= 3) return 'medium';
  if (roundsExecuted <= 5) return 'long';
  return 'very_long';
}

/** GDS (优雅降级分): 部分完成给部分分 — 用该 bucket 内 trace 的平均 grade score。 */
export interface ReliabilityBucket {
  bucket: DurationBucket;
  samples: number;
  /** 该档单次通过率 */
  passRate: number | null;
  /** 该档平均 grade 分 (GDS 代理: 部分完成给部分分) */
  gds: number | null;
  avgRounds: number;
}

export interface ReliabilityCurve {
  buckets: ReliabilityBucket[];
  /** RDC 斜率代理: short 档 passRate - very_long/long 档 passRate (越大 = 衰退越快) */
  declineSlope: number | null;
}

/** 一条 trace 的平均 grade 分 (无评分 → null)。 */
function avgGradeScore(t: EvalTrace): number | null {
  const g = t.grades ?? [];
  if (g.length === 0) return null;
  return g.reduce((s, x) => s + x.score, 0) / g.length;
}

/**
 * 计算可靠性衰退曲线: 按任务时长分档, 每档算 passRate + GDS。
 * 纯只读聚合, 永不抛。
 */
export function computeReliabilityCurve(traces: EvalTrace[]): ReliabilityCurve {
  const order: DurationBucket[] = ['short', 'medium', 'long', 'very_long'];
  const byBucket = new Map<DurationBucket, EvalTrace[]>();
  for (const b of order) byBucket.set(b, []);
  for (const t of traces) {
    byBucket.get(durationBucketOf(t.roundsExecuted ?? 1))!.push(t);
  }

  const buckets: ReliabilityBucket[] = order.map((bucket) => {
    const arr = byBucket.get(bucket)!;
    const passed = arr.filter(tracePassed).length;
    const gdsVals = arr.map(avgGradeScore).filter((x): x is number => x !== null);
    return {
      bucket,
      samples: arr.length,
      passRate: arr.length > 0 ? passed / arr.length : null,
      gds: gdsVals.length > 0 ? gdsVals.reduce((s, x) => s + x, 0) / gdsVals.length : null,
      avgRounds: arr.length > 0 ? arr.reduce((s, t) => s + (t.roundsExecuted ?? 1), 0) / arr.length : 0,
    };
  });

  const shortRate = buckets[0].passRate;
  // 取最长的有样本档作为对照
  const longEnd = [...buckets].reverse().find((b) => b.samples > 0 && b.passRate !== null);
  const declineSlope =
    shortRate !== null && longEnd && longEnd.passRate !== null ? shortRate - longEnd.passRate : null;

  return { buckets, declineSlope };
}
