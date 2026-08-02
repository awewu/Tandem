/**
 * Eval Service · trace 采集 + 评分 + 回归 (P0 · 2026-07-20)
 *
 * 热路径纪律:
 *   - recordEvalTrace 仅跑【同步规则 graders】+ 落库, 便宜、永不阻塞主流程 (fail-soft)。
 *   - LLM grader 不在热路径: 由 regression / 手动 regrade / 月度批处理按需触发, 控成本。
 */

import type { EvalTrace, EvalTraceKind, EvalGrade } from '@/lib/types/eval';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { runRuleGraders, runLlmGraders } from './graders';
import { computePassK, computeReliabilityCurve, type PassKResult, type ReliabilityCurve } from './pass-k';

function genTraceId(): string {
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export type RecordTraceInput = Omit<EvalTrace, 'id' | 'createdAt' | 'grades'>;

/**
 * 采集一条 agent pass trace + 跑同步规则 graders + 落库。
 * 永不抛 (best-effort): 任何异常仅 warn, 返回 null, 绝不影响调用方主流程。
 */
export async function recordEvalTrace(input: RecordTraceInput): Promise<EvalTrace | null> {
  try {
    const trace: EvalTrace = {
      id: genTraceId(),
      createdAt: new Date().toISOString(),
      ...input,
      inputSummary: truncate(input.inputSummary ?? '', 500),
      finalOutputSummary: truncate(input.finalOutputSummary ?? '', 1000),
      grades: [],
    };
    trace.grades = runRuleGraders(trace);
    const store = getStore();
    await store.evalTraces.create(trace);
    return trace;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[eval] recordEvalTrace failed (fail-soft)');
    return null;
  }
}

/** 埋点专用: 绝不抛、绝不返回 (fire-and-forget 语义), 供 hot-path pass 调用。 */
export async function recordEvalTraceSafe(input: RecordTraceInput): Promise<void> {
  try {
    await recordEvalTrace(input);
  } catch {
    /* recordEvalTrace 已 fail-soft; 此处再兜一层, 永不影响调用方 */
  }
}

export interface ListTracesFilter {
  tenantId?: string;
  kind?: EvalTraceKind;
  limit?: number;
}

export async function listTraces(filter: ListTracesFilter = {}): Promise<EvalTrace[]> {
  try {
    const store = getStore();
    const all = await store.evalTraces.list();
    let out = all;
    if (filter.tenantId) out = out.filter((t) => t.tenantId === filter.tenantId);
    if (filter.kind) out = out.filter((t) => t.kind === filter.kind);
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out.slice(0, filter.limit ?? 100);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[eval] listTraces failed');
    return [];
  }
}

/** 给一条 trace 追加 LLM grader 评分 (best-effort). 用于 regression / 手动 regrade. */
export async function gradeTraceLlm(traceId: string): Promise<EvalTrace | null> {
  try {
    const store = getStore();
    const trace = await store.evalTraces.get(traceId);
    if (!trace) return null;
    const llm = await runLlmGraders(trace);
    if (llm.length === 0) return trace;
    // 去重: 同 graderId 用最新覆盖
    const byId = new Map<string, EvalGrade>();
    for (const g of trace.grades ?? []) byId.set(g.graderId, g);
    for (const g of llm) byId.set(g.graderId, g);
    const grades = Array.from(byId.values());
    const updated = { ...trace, grades };
    await store.evalTraces.update(traceId, { grades });
    return updated;
  } catch (err) {
    logger.warn({ err: (err as Error).message, traceId }, '[eval] gradeTraceLlm failed');
    return null;
  }
}

export interface RegressionResult {
  tracesEvaluated: number;
  /** 逐 grader 的通过率 */
  byGrader: Record<string, { pass: number; total: number; passRate: number; avgScore: number }>;
  /** 总体通过率 (所有 grade 的 pass 占比) */
  overallPassRate: number;
  perTrace: Array<{ traceId: string; kind: EvalTraceKind; grades: EvalGrade[] }>;
}

export interface RunRegressionOpts {
  tenantId?: string;
  kind?: EvalTraceKind;
  limit?: number;
  /** 是否对每条补跑 LLM grader (慢/花钱), 默认 false */
  includeLlm?: boolean;
}

/**
 * 回归跑分: 对已采集的 trace 重新汇总规则分 (可选补 LLM 分), 输出逐 grader 通过率 + 总体。
 * 纯只读聚合, 永不抛。
 */
export async function runRegression(opts: RunRegressionOpts = {}): Promise<RegressionResult> {
  const empty: RegressionResult = {
    tracesEvaluated: 0,
    byGrader: {},
    overallPassRate: 0,
    perTrace: [],
  };
  try {
    const traces = await listTraces({ tenantId: opts.tenantId, kind: opts.kind, limit: opts.limit ?? 50 });
    const byGrader: RegressionResult['byGrader'] = {};
    const perTrace: RegressionResult['perTrace'] = [];
    let passTotal = 0;
    let gradeTotal = 0;

    for (const t of traces) {
      let grades = t.grades ?? [];
      if (opts.includeLlm) {
        const graded = await gradeTraceLlm(t.id);
        if (graded) grades = graded.grades ?? grades;
      }
      perTrace.push({ traceId: t.id, kind: t.kind, grades });
      for (const g of grades) {
        const b = (byGrader[g.graderId] ??= { pass: 0, total: 0, passRate: 0, avgScore: 0 });
        b.total += 1;
        b.avgScore += g.score;
        if (g.pass) b.pass += 1;
        gradeTotal += 1;
        if (g.pass) passTotal += 1;
      }
    }

    for (const b of Object.values(byGrader)) {
      b.passRate = b.total > 0 ? b.pass / b.total : 0;
      b.avgScore = b.total > 0 ? b.avgScore / b.total : 0;
    }

    return {
      tracesEvaluated: traces.length,
      byGrader,
      overallPassRate: gradeTotal > 0 ? passTotal / gradeTotal : 0,
      perTrace,
    };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[eval] runRegression failed');
    return empty;
  }
}

/**
 * P0-2 · Pass^k 多试一致性: 对已采集 trace 按 (kind + 归一化输入) 分组, 计算 k 次全过率。
 * 纯只读聚合, 永不抛。默认 k=3 (Pass^3)。
 */
export async function runPassK(
  opts: { tenantId?: string; kind?: EvalTraceKind; k?: number; limit?: number } = {},
): Promise<PassKResult> {
  const k = opts.k ?? 3;
  try {
    const traces = await listTraces({ tenantId: opts.tenantId, kind: opts.kind, limit: opts.limit ?? 500 });
    return computePassK(traces, k);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[eval] runPassK failed');
    return { k, eligibleGroups: 0, consistentGroups: 0, passAtK: null, singlePassRate: null, groups: [] };
  }
}

/**
 * P2 #18 · 可靠性衰退曲线: 按任务时长分档算 passRate + GDS, 度量 "任务越长可靠性降多快"。
 * 纯只读聚合, 永不抛。
 */
export async function runReliabilityCurve(
  opts: { tenantId?: string; kind?: EvalTraceKind; limit?: number } = {},
): Promise<ReliabilityCurve> {
  try {
    const traces = await listTraces({ tenantId: opts.tenantId, kind: opts.kind, limit: opts.limit ?? 500 });
    return computeReliabilityCurve(traces);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[eval] runReliabilityCurve failed');
    return { buckets: [], declineSlope: null };
  }
}
