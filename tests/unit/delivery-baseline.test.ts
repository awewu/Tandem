import { describe, it, expect } from 'vitest';
import {
  projectDeliveryBaseline,
  analyzeBaselineVariance,
  projectedCompletionOf,
  completionToConfidence,
  type DeliveryBaselineInput,
} from '@/lib/governance/delivery-baseline';

describe('delivery-baseline · projectDeliveryBaseline', () => {
  it('直接投影: KPI 末值 = current + Σ(expectedΔ × progress)', () => {
    const input: DeliveryBaselineInput = {
      cycleId: 'cy-1',
      kpis: [
        {
          kpiId: 'sla',
          title: '核心系统 SLA',
          perspective: 'process',
          startValue: 99.0,
          currentValue: 99.5,
          targetValue: 99.9,
          drivers: [
            { krId: 'kr1', krTitle: '支付链路重构', progress: 0.6, expectedKpiDelta: 0.3 },
          ],
        },
      ],
    };
    const out = projectDeliveryBaseline(input);
    const sla = out.projections.find((p) => p.kpiId === 'sla')!;
    // 99.5 + 0.3 * 0.6 = 99.68
    expect(sla.directProjectedValue).toBeCloseTo(99.68, 5);
    expect(sla.projectedValue).toBeCloseTo(99.68, 5);
    expect(out.kind).toBe('baseline');
  });

  it('多驱动累加 + 贡献明细记录', () => {
    const out = projectDeliveryBaseline({
      cycleId: 'cy-1',
      kpis: [
        {
          kpiId: 'rev',
          title: '事业部营收',
          perspective: 'financial',
          startValue: 0,
          currentValue: 3000,
          targetValue: 5000,
          drivers: [
            { krId: 'a', krTitle: '标杆客户A', progress: 1, expectedKpiDelta: 800 },
            { krId: 'b', krTitle: '标杆客户B', progress: 0.5, expectedKpiDelta: 1000 },
          ],
        },
      ],
    });
    const rev = out.projections[0];
    // 3000 + 800*1 + 1000*0.5 = 4300
    expect(rev.projectedValue).toBeCloseTo(4300, 5);
    expect(rev.contributions.filter((c) => c.kind === 'okr')).toHaveLength(2);
    expect(rev.gap).toBeCloseTo(700, 5); // 5000 - 4300
  });

  it('causal 传导: 下游按 改善比例 × strength × 下游量程 获得增量', () => {
    const out = projectDeliveryBaseline({
      cycleId: 'cy-1',
      kpis: [
        {
          kpiId: 'sla',
          title: 'SLA',
          perspective: 'process',
          startValue: 99.0,
          currentValue: 99.5,
          targetValue: 99.9, // room = 0.4
          drivers: [{ krId: 'kr1', krTitle: '重构', progress: 1, expectedKpiDelta: 0.4 }],
        },
        {
          kpiId: 'renew',
          title: '续费率',
          perspective: 'customer',
          startValue: 80,
          currentValue: 88,
          targetValue: 92, // room = 4
        },
      ],
      causalEdges: [{ fromKpiId: 'sla', toKpiId: 'renew', strength: 0.6 }],
    });
    const sla = out.projections.find((p) => p.kpiId === 'sla')!;
    const renew = out.projections.find((p) => p.kpiId === 'renew')!;
    // SLA 投影 99.5 + 0.4 = 99.9 → 改善比例 = (99.9-99.5)/(99.9-99.5) = 1
    expect(sla.projectedValue).toBeCloseTo(99.9, 5);
    // renew 传导 = 1 * 0.6 * (92-88=4) = 2.4 → 88 + 2.4 = 90.4
    expect(renew.projectedValue).toBeCloseTo(90.4, 5);
    expect(renew.contributions.some((c) => c.kind === 'causal' && c.source === 'SLA')).toBe(true);
  });

  it('上游无改善时不向下游传导 (改善比例 ≤ 0 截零)', () => {
    const out = projectDeliveryBaseline({
      cycleId: 'cy-1',
      kpis: [
        {
          kpiId: 'up',
          title: 'Up',
          perspective: 'process',
          startValue: 0,
          currentValue: 50,
          targetValue: 100,
          drivers: [], // 无驱动 → 投影 = current, 改善比例 0
        },
        {
          kpiId: 'down',
          title: 'Down',
          perspective: 'customer',
          startValue: 0,
          currentValue: 40,
          targetValue: 80,
        },
      ],
      causalEdges: [{ fromKpiId: 'up', toKpiId: 'down', strength: 0.9 }],
    });
    const down = out.projections.find((p) => p.kpiId === 'down')!;
    expect(down.projectedValue).toBeCloseTo(40, 5);
    expect(down.contributions).toHaveLength(0);
  });

  it('信心分级: ≥1 on-track, ≥0.85 at-risk, else off-track', () => {
    expect(completionToConfidence(1.0)).toBe('on-track');
    expect(completionToConfidence(0.9)).toBe('at-risk');
    expect(completionToConfidence(0.5)).toBe('off-track');
    expect(projectedCompletionOf(0, 100, 50)).toBeCloseTo(0.5, 5);
    expect(projectedCompletionOf(0, 100, 200)).toBeCloseTo(1.5, 5); // 超额截顶
  });

  it('无驱动无传导: 投影 = current', () => {
    const out = projectDeliveryBaseline({
      cycleId: 'cy-1',
      kpis: [{ kpiId: 'x', title: 'X', startValue: 0, currentValue: 30, targetValue: 100 }],
    });
    expect(out.projections[0].projectedValue).toBe(30);
  });
});

describe('delivery-baseline · analyzeBaselineVariance', () => {
  const baseline = projectDeliveryBaseline({
    cycleId: 'cy-1',
    kpis: [
      {
        kpiId: 'sla',
        title: 'SLA',
        perspective: 'process',
        startValue: 99.0,
        currentValue: 99.5,
        targetValue: 99.9,
        drivers: [{ krId: 'kr1', krTitle: '重构', progress: 1, expectedKpiDelta: 0.2 }],
      },
    ],
  });

  it('实际不及推演 → 负差异, 显著时标记', () => {
    // 推演 99.5 + 0.2 = 99.7; 实际 99.65 → variance = -0.05; range = 0.9 → pct ≈ 0.055 (< 0.1 不显著)
    const rows = analyzeBaselineVariance(baseline, { sla: 99.65 });
    expect(rows).toHaveLength(1);
    expect(rows[0].variance).toBeCloseTo(-0.05, 5);
    expect(rows[0].significant).toBe(false);
  });

  it('显著差异触发标记 (超过阈值)', () => {
    const rows = analyzeBaselineVariance(baseline, { sla: 99.2 }, 0.1);
    // variance = 99.2 - 99.7 = -0.5; range = 0.9 → pct ≈ 0.55 ≥ 0.1
    expect(rows[0].significant).toBe(true);
  });

  it('缺失 actual 的 KPI 跳过', () => {
    const rows = analyzeBaselineVariance(baseline, {});
    expect(rows).toHaveLength(0);
  });
});
