import { describe, it, expect } from 'vitest';
import { projectDeliveryBaseline, type CausalEdgeInput } from '@/lib/governance/delivery-baseline';
import {
  calibrateCausalStrength,
  toCausalLinkPatch,
  type StrengthCalibration,
} from '@/lib/governance/baseline-calibration';

// 共享场景: SLA(process) --L1(0.6)--> 续费率(customer)
// SLA: start 99.0 / current 99.5 / target 99.9, 驱动 progress=1 expectedΔ=0.4 → 投影 99.9 (改善比例 1)
// 续费率: start 80 / current 88 / target 92 (room 4), range(量程) 12
//   → 传导 = 1 * 0.6 * 4 = 2.4 → 投影 90.4
function buildBaseline(slaProgress = 1) {
  const edges: CausalEdgeInput[] = [
    { fromKpiId: 'sla', toKpiId: 'renew', strength: 0.6, linkId: 'L1' },
  ];
  const baseline = projectDeliveryBaseline({
    cycleId: 'cy-1',
    generatedAt: '2026-06-09T00:00:00Z',
    kpis: [
      {
        kpiId: 'sla',
        title: 'SLA',
        perspective: 'process',
        startValue: 99.0,
        currentValue: 99.5,
        targetValue: 99.9,
        drivers: [{ krId: 'kr1', krTitle: '重构', progress: slaProgress, expectedKpiDelta: 0.4 }],
      },
      {
        kpiId: 'renew',
        title: '续费率',
        perspective: 'customer',
        startValue: 80,
        currentValue: 88,
        targetValue: 92,
      },
    ],
    causalEdges: edges,
  });
  return { baseline, edges };
}

describe('baseline-calibration · calibrateCausalStrength', () => {
  it('causal 贡献带 linkId 溯源 (delivery-baseline 贯通)', () => {
    const { baseline } = buildBaseline();
    const renew = baseline.projections.find((p) => p.kpiId === 'renew')!;
    const causal = renew.contributions.find((c) => c.kind === 'causal');
    expect(causal?.linkId).toBe('L1');
    expect(renew.projectedValue).toBeCloseTo(90.4, 5);
  });

  it('容差内 → hold + 建议 validated', () => {
    const { baseline, edges } = buildBaseline();
    // 推演 90.4, 实际 90.5 → variance 0.1, range 12 → pct 0.8% < 10%
    const out = calibrateCausalStrength(baseline, { renew: 90.5 }, edges);
    expect(out.kind).toBe('calibration');
    const s = out.suggestions.find((x) => x.linkId === 'L1')!;
    expect(s.action).toBe('hold');
    expect(s.validatedSuggestion).toBe(true);
    expect(s.delta).toBe(0);
  });

  it('实际显著高于推演 + 正向贡献 → 建议上调 strength', () => {
    const { baseline, edges } = buildBaseline();
    // 推演 90.4, 实际 92 → variance +1.6, range 12 → pct 13.3% 显著
    const out = calibrateCausalStrength(baseline, { renew: 92 }, edges);
    const s = out.suggestions.find((x) => x.linkId === 'L1')!;
    expect(s.action).toBe('increase');
    expect(s.suggestedStrength).toBeGreaterThan(s.currentStrength);
    // delta = gain(0.5) * (1.6/12) * share(1) * sign(+) ≈ 0.0667
    expect(s.delta).toBeCloseTo(0.0667, 3);
    expect(s.validatedSuggestion).toBe(false);
  });

  it('实际显著低于推演 + 正向贡献 → 建议下调 strength', () => {
    const { baseline, edges } = buildBaseline();
    // 推演 90.4, 实际 88 → variance -2.4, pct 20% 显著
    const out = calibrateCausalStrength(baseline, { renew: 88 }, edges);
    const s = out.suggestions.find((x) => x.linkId === 'L1')!;
    expect(s.action).toBe('decrease');
    expect(s.suggestedStrength).toBeLessThan(s.currentStrength);
    // delta = 0.5 * (-2.4/12) * 1 * 1 = -0.1
    expect(s.delta).toBeCloseTo(-0.1, 5);
  });

  it('上游本周期无改善 (贡献≈0) 却下游显著偏移 → review, 不调整', () => {
    const { baseline, edges } = buildBaseline(0); // SLA 驱动 progress 0 → 无传导
    const renew = baseline.projections.find((p) => p.kpiId === 'renew')!;
    expect(renew.projectedValue).toBeCloseTo(88, 5); // 无 causal 贡献
    const out = calibrateCausalStrength(baseline, { renew: 82 }, edges);
    const s = out.suggestions.find((x) => x.linkId === 'L1')!;
    expect(s.action).toBe('review');
    expect(s.delta).toBe(0);
    expect(s.validatedSuggestion).toBe(false);
  });

  it('无真实值的下游 → 不产建议 (本周期不校准)', () => {
    const { baseline, edges } = buildBaseline();
    const out = calibrateCausalStrength(baseline, {}, edges);
    expect(out.suggestions).toHaveLength(0);
  });

  it('调整步长受 maxStep 限幅', () => {
    const { baseline, edges } = buildBaseline();
    // 极端实际值 → 大误差; maxStep 默认 0.3
    const out = calibrateCausalStrength(baseline, { renew: 200 }, edges, { gain: 5 });
    const s = out.suggestions.find((x) => x.linkId === 'L1')!;
    expect(Math.abs(s.delta)).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(s.suggestedStrength).toBeLessThanOrEqual(1);
    expect(s.suggestedStrength).toBeGreaterThanOrEqual(0);
  });

  it('toCausalLinkPatch: 映射为既有 PATCH 请求体', () => {
    const mk = (over: Partial<StrengthCalibration>): StrengthCalibration => ({
      linkId: 'L1', fromKpiId: 'a', toKpiId: 'b',
      currentStrength: 0.6, suggestedStrength: 0.7, delta: 0.1,
      action: 'increase', validatedSuggestion: false, rationale: 'r',
      evidence: { toKpiId: 'b', projectedValue: 1, actualValue: 2, variance: 1, variancePct: 0.5 },
      ...over,
    });
    expect(toCausalLinkPatch(mk({ action: 'increase', suggestedStrength: 0.7 }))).toEqual({ strength: 0.7 });
    expect(toCausalLinkPatch(mk({ action: 'decrease', suggestedStrength: 0.5 }))).toEqual({ strength: 0.5 });
    expect(toCausalLinkPatch(mk({ action: 'hold', validatedSuggestion: true, rationale: 'ok' }))).toEqual({ validate: true, validationNote: 'ok' });
    expect(toCausalLinkPatch(mk({ action: 'hold', validatedSuggestion: false }))).toBeNull();
    expect(toCausalLinkPatch(mk({ action: 'review' }))).toBeNull();
  });

  it('显著差异但无入边因果链的 KPI → 归入 unattributed', () => {
    const baseline = projectDeliveryBaseline({
      cycleId: 'cy-1',
      generatedAt: '',
      kpis: [
        { kpiId: 'rev', title: '营收', perspective: 'financial', startValue: 0, currentValue: 3000, targetValue: 5000 },
      ],
    });
    const out = calibrateCausalStrength(baseline, { rev: 4500 }, []);
    // 推演 3000 (无驱动), 实际 4500 → variance 1500, range 5000 → 30% 显著
    expect(out.suggestions).toHaveLength(0);
    expect(out.unattributed).toHaveLength(1);
    expect(out.unattributed[0].kpiId).toBe('rev');
  });
});
