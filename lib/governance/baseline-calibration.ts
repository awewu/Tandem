/**
 * FP&A · 交付基线差异校正 (BaselineCalibration)
 *
 * 闭环最后一环 (docs/GOVERNANCE-FPA-ENGINE-2026-06-09.md §3 + §6):
 *   周期末用真实 KPI 值对比 DeliveryBaseline 推演 → 把差异归因到 BSC 因果链 →
 *   产出每条 KpiCausalLink 的「强度校准建议」+「validated 信号」。
 *
 * 铁律 (宪法 A · 中央 AI 永不自行写库):
 *   - 本模块只产 *建议* (proposal), 绝不直接改 KpiCausalLink.strength/validated。
 *   - 调用方 (议事室 / Steward / proposeAction 肢体) 决定是否采纳。
 *   - 纯函数, 无 DB / 网络 / 时钟依赖。
 *
 * 归因模型 (透明启发式, 单链近似):
 *   下游 KPI 的「真实末值 vs 推演末值」差异 = 估计误差。
 *   按各入边 causal 贡献的量级占比, 把误差分摊到每条入边:
 *     - 实际高于推演 + 该边正向贡献 → 因果效应被低估 → 建议↑ strength
 *     - 实际低于推演 + 该边正向贡献 → 因果效应被高估 → 建议↓ strength
 *     - 差异在容差内 → hold + 建议标记 validated
 *     - 上游本周期无改善 (该边推演贡献≈0) 却下游显著偏移 → review (本周期无法归因)
 */

import {
  analyzeBaselineVariance,
  type DeliveryBaseline,
  type CausalEdgeInput,
} from './delivery-baseline';

export interface CalibrationOptions {
  /** 显著阈值 (相对下游量程, 默认 10%) */
  significantThreshold?: number;
  /** 调整增益 (误差比 → strength 增量的放大系数, 默认 0.5) */
  gain?: number;
  /** 单次最大 strength 调整步长 (默认 0.3, 防剧烈摆动) */
  maxStep?: number;
}

export type CalibrationAction = 'increase' | 'decrease' | 'hold' | 'review';

export interface StrengthCalibration {
  linkId: string;
  fromKpiId: string;
  toKpiId: string;
  currentStrength: number;
  suggestedStrength: number;
  /** suggestedStrength - currentStrength */
  delta: number;
  action: CalibrationAction;
  /** 建议把该因果链标记为 validated (差异在容差内, 假设成立) */
  validatedSuggestion: boolean;
  rationale: string;
  evidence: {
    toKpiId: string;
    projectedValue: number;
    actualValue: number;
    variance: number;
    variancePct: number;
  };
}

export interface BaselineCalibrationResult {
  readonly kind: 'calibration';
  cycleId: string;
  generatedAt: string;
  suggestions: StrengthCalibration[];
  /** 有显著差异但无入边因果链可归因的 KPI (纯 OKR 估计误差, 提示补战略地图) */
  unattributed: { kpiId: string; title: string; variance: number; variancePct: number }[];
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 用真实交付校准 BSC 因果链强度, 产出建议 (不写库)。
 *
 * @param baseline DeliveryBaseline (其 causal 贡献需带 linkId 溯源)
 * @param actuals  周期末真实 KPI 值 { kpiId: value }
 * @param edges    原始因果边 (须含 linkId + 当前 strength)
 */
export function calibrateCausalStrength(
  baseline: DeliveryBaseline,
  actuals: Record<string, number>,
  edges: CausalEdgeInput[],
  opts: CalibrationOptions = {},
): BaselineCalibrationResult {
  const significantThreshold = opts.significantThreshold ?? 0.1;
  const gain = opts.gain ?? 0.5;
  const maxStep = opts.maxStep ?? 0.3;
  const eps = 1e-9;

  const projByKpi = new Map(baseline.projections.map((p) => [p.kpiId, p]));
  const variances = analyzeBaselineVariance(baseline, actuals, significantThreshold);
  const varByKpi = new Map(variances.map((v) => [v.kpiId, v]));

  const suggestions: StrengthCalibration[] = [];

  for (const e of edges) {
    if (!e.linkId) continue; // 无 linkId 无法回写定位
    const to = projByKpi.get(e.toKpiId);
    if (!to) continue;
    const v = varByKpi.get(e.toKpiId);
    if (!v) continue; // 无真实值 → 无证据, 跳过 (本周期不校准)

    const current = clamp01(e.strength);
    const room = Math.abs(to.targetValue - to.startValue) || 1;

    // 本边对下游的推演贡献 (按 linkId 定位)
    const thisContrib =
      to.contributions.find((c) => c.kind === 'causal' && c.linkId === e.linkId)?.value ?? 0;
    const totalIncomingCausal = to.contributions
      .filter((c) => c.kind === 'causal')
      .reduce((s, c) => s + Math.abs(c.value), 0);

    const base = {
      linkId: e.linkId,
      fromKpiId: e.fromKpiId,
      toKpiId: e.toKpiId,
      currentStrength: current,
      evidence: {
        toKpiId: e.toKpiId,
        projectedValue: to.projectedValue,
        actualValue: v.actualValue,
        variance: v.variance,
        variancePct: v.variancePct,
      },
    };

    // 容差内: 假设成立
    if (!v.significant) {
      suggestions.push({
        ...base,
        suggestedStrength: current,
        delta: 0,
        action: 'hold',
        validatedSuggestion: true,
        rationale: `下游「${to.title}」真实值与推演相差 ${(v.variancePct * 100).toFixed(1)}% (容差内), 因果假设本周期成立, 建议标记 validated。`,
      });
      continue;
    }

    // 上游本周期无改善 (本边推演贡献≈0) → 无法从本周期数据归因
    if (Math.abs(thisContrib) < eps) {
      suggestions.push({
        ...base,
        suggestedStrength: current,
        delta: 0,
        action: 'review',
        validatedSuggestion: false,
        rationale: `下游「${to.title}」显著偏离推演 (${(v.variancePct * 100).toFixed(1)}%), 但本边上游本周期无改善 (推演贡献≈0), 无法据此校准, 建议人工复核假设。`,
      });
      continue;
    }

    // 显著差异 → 按本边贡献占比分摊误差, 调整 strength
    const share = totalIncomingCausal > eps ? Math.abs(thisContrib) / totalIncomingCausal : 1;
    const errorRatio = v.variance / room; // 带符号: >0 实际高于推演
    const rawDelta = gain * errorRatio * share * Math.sign(thisContrib);
    const delta = Math.max(-maxStep, Math.min(maxStep, rawDelta));
    const suggested = clamp01(current + delta);
    const realDelta = suggested - current;
    const action: CalibrationAction =
      realDelta > eps ? 'increase' : realDelta < -eps ? 'decrease' : 'hold';

    const dir = v.variance >= 0 ? '高于' : '低于';
    const adjWord = action === 'increase' ? '上调' : action === 'decrease' ? '下调' : '维持';
    suggestions.push({
      ...base,
      suggestedStrength: suggested,
      delta: realDelta,
      action,
      validatedSuggestion: false,
      rationale: `下游「${to.title}」真实值${dir}推演 ${(v.variancePct * 100).toFixed(1)}% (占本边贡献 ${(share * 100).toFixed(0)}%), 建议${adjWord}强度 ${current.toFixed(2)} → ${suggested.toFixed(2)}。`,
    });
  }

  // 有显著差异但无任何入边因果链的 KPI → 纯 OKR 估计误差
  const attributedDownstream = new Set(edges.filter((e) => e.linkId).map((e) => e.toKpiId));
  const unattributed = variances
    .filter((v) => v.significant && !attributedDownstream.has(v.kpiId))
    .map((v) => ({
      kpiId: v.kpiId,
      title: v.title,
      variance: v.variance,
      variancePct: v.variancePct,
    }));

  return {
    kind: 'calibration',
    cycleId: baseline.cycleId,
    generatedAt: baseline.generatedAt,
    suggestions,
    unattributed,
  };
}

/**
 * 把一条校准建议映射为既有 `PATCH /api/kpi/causal-links/[id]` 的请求体。
 *
 * 仍是「建议→人工点应用」: 本函数只产请求体, 真写由有 kpi.write 权限的人 (Steward) 触发,
 * 不自动调用 (宪法 A · 治理配置变更须人工批准)。
 *
 * 映射:
 *   - increase / decrease → { strength: 建议值 }
 *   - hold + validatedSuggestion → { validate: true } (假设成立, 标记复盘验证)
 *   - review / 其他 → null (需人工复核, 不给一键)
 */
export function toCausalLinkPatch(
  s: StrengthCalibration,
): { strength: number } | { validate: true; validationNote: string } | null {
  if (s.action === 'increase' || s.action === 'decrease') {
    return { strength: s.suggestedStrength };
  }
  if (s.action === 'hold' && s.validatedSuggestion) {
    return { validate: true, validationNote: s.rationale };
  }
  return null;
}
