/**
 * KR Forecast 单测 (vs Tita 2025 H2 #缺口 · trend.ts 扩展)
 *
 * 覆盖:
 *   1. 数据不足 (0/1 条 check-in) → insufficient-data
 *   2. 完美线性 → high confidence + 准确预测
 *   3. on-track / at-risk / off-track 三级风险阈值
 *   4. 波动大 → r² 低 + reasoning 含警告
 *   5. forecastObjective 按风险排序
 *   6. clamp: forecastProgress 不会 > 100 或 < 0
 *   7. cycleEndAt < now → daysToEnd = 0
 */

import { describe, it, expect } from 'vitest';
import { forecastKr, forecastObjective, type ForecastRiskLevel } from '../../lib/okr/trend';
import type { CheckIn, KeyResult, Objective } from '../../lib/store';

const DAY = 86_400_000;
const T0 = new Date('2026-04-01T00:00:00Z').getTime();
const CYCLE_END = T0 + 90 * DAY; // 90 天周期

function makeKr(overrides: Partial<KeyResult> = {}): KeyResult {
  return {
    id: 'kr_1',
    objectiveId: 'o_1',
    title: 'Test KR',
    type: 'numeric',
    startValue: 0,
    targetValue: 100,
    currentValue: 50,
    unit: '万元',
    weight: 100,
    ownerId: 'alice',
    confidence: 'on-track',
    status: 'active',
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  } as KeyResult;
}

function makeCheckIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: `c_${Math.random()}`,
    scope: 'kr',
    scopeId: 'kr_1',
    progressBefore: 0,
    progressAfter: 0,
    confidenceBefore: 'on-track',
    confidenceAfter: 'on-track',
    narrative: { progress: '', blocker: '', next: '' },
    createdBy: 'alice',
    createdAt: T0,
    ...overrides,
  } as CheckIn;
}

describe('forecastKr · 数据不足', () => {
  it('0 条 check-in → insufficient-data', () => {
    const f = forecastKr(makeKr(), [], CYCLE_END, T0);
    expect(f.hasData).toBe(false);
    expect(f.riskLevel).toBe('insufficient-data');
    expect(f.slope).toBe(0);
    expect(f.confidence).toBe(0);
    expect(f.reasoning).toContain('< 2');
  });

  it('1 条 check-in 仍不足', () => {
    const f = forecastKr(
      makeKr(),
      [makeCheckIn({ progressAfter: 30, createdAt: T0 + 10 * DAY })],
      CYCLE_END,
      T0 + 10 * DAY,
    );
    expect(f.hasData).toBe(false);
    expect(f.riskLevel).toBe('insufficient-data');
  });
});

describe('forecastKr · 完美线性 → on-track', () => {
  it('每天 +1pp, 90 天周期 → 季末预测 100%', () => {
    const checkIns = [
      makeCheckIn({ progressAfter: 10, createdAt: T0 + 10 * DAY }),
      makeCheckIn({ progressAfter: 20, createdAt: T0 + 20 * DAY }),
      makeCheckIn({ progressAfter: 30, createdAt: T0 + 30 * DAY }),
      makeCheckIn({ progressAfter: 40, createdAt: T0 + 40 * DAY }),
    ];
    const f = forecastKr(makeKr({ currentValue: 40 }), checkIns, CYCLE_END, T0 + 40 * DAY);
    expect(f.hasData).toBe(true);
    expect(f.riskLevel).toBe('on-track');
    expect(f.slope).toBeCloseTo(1, 1); // ~1 pp/天
    expect(f.confidence).toBeGreaterThan(0.95);
    // 推到 90 天 → ~100% (clamp)
    expect(f.forecastProgress).toBeGreaterThanOrEqual(90);
  });
});

describe('forecastKr · 三级风险阈值', () => {
  it('forecastProgress = 95 → on-track', () => {
    // 起点 50, 后 +0.5 pp/天, 周期共 90 天 → 50 + 90*0.5 = 95
    const cps = [
      { progress: 50, day: 0 },
      { progress: 55, day: 10 },
      { progress: 60, day: 20 },
    ].map((p) => makeCheckIn({ progressAfter: p.progress, createdAt: T0 + p.day * DAY }));
    const f = forecastKr(makeKr({ currentValue: 60 }), cps, CYCLE_END, T0 + 20 * DAY);
    expect(f.riskLevel).toBe('on-track');
    expect(f.forecastProgress).toBeGreaterThanOrEqual(90);
  });

  it('forecastProgress in [60, 90) → at-risk', () => {
    // +0.3 pp/天 → 90 天后 50+27 = 77
    const cps = [
      { progress: 50, day: 0 },
      { progress: 53, day: 10 },
      { progress: 56, day: 20 },
    ].map((p) => makeCheckIn({ progressAfter: p.progress, createdAt: T0 + p.day * DAY }));
    const f = forecastKr(makeKr({ currentValue: 56 }), cps, CYCLE_END, T0 + 20 * DAY);
    expect(f.riskLevel).toBe('at-risk');
    expect(f.forecastProgress).toBeGreaterThanOrEqual(60);
    expect(f.forecastProgress).toBeLessThan(90);
  });

  it('forecastProgress < 60 → off-track', () => {
    // +0.1 pp/天 → 90 天后 10+9 = 19
    const cps = [
      { progress: 10, day: 0 },
      { progress: 11, day: 10 },
      { progress: 12, day: 20 },
    ].map((p) => makeCheckIn({ progressAfter: p.progress, createdAt: T0 + p.day * DAY }));
    const f = forecastKr(makeKr({ currentValue: 12 }), cps, CYCLE_END, T0 + 20 * DAY);
    expect(f.riskLevel).toBe('off-track');
    expect(f.forecastProgress).toBeLessThan(60);
    expect(f.reasoning).toContain('严重落后');
  });
});

describe('forecastKr · 边界', () => {
  it('forecastProgress clamp 0-100 (即使外推 > 100)', () => {
    // 极快增长率 2 pp/天 → 90 天后 200%, clamp 到 100
    const cps = [
      { progress: 0, day: 0 },
      { progress: 20, day: 10 },
      { progress: 40, day: 20 },
    ].map((p) => makeCheckIn({ progressAfter: p.progress, createdAt: T0 + p.day * DAY }));
    const f = forecastKr(makeKr({ currentValue: 40 }), cps, CYCLE_END, T0 + 20 * DAY);
    expect(f.forecastProgress).toBeLessThanOrEqual(100);
    expect(f.forecastProgress).toBeGreaterThanOrEqual(0);
  });

  it('forecastValue 计算正确 (start=100, target=200, forecast 50% → 150)', () => {
    const cps = [
      { progress: 30, day: 0 },
      { progress: 40, day: 10 },
      { progress: 50, day: 20 },
    ].map((p) => makeCheckIn({ progressAfter: p.progress, createdAt: T0 + p.day * DAY }));
    const f = forecastKr(
      makeKr({ startValue: 100, targetValue: 200, currentValue: 150 }),
      cps,
      // 短周期, 让外推不 clamp
      T0 + 30 * DAY,
      T0 + 20 * DAY,
    );
    // forecastProgress ~60, forecastValue = 100 + 0.6 * 100 = 160
    expect(f.forecastValue).toBeCloseTo(100 + (f.forecastProgress / 100) * 100, 1);
  });

  it('cycleEndAt < now → daysToEnd = 0', () => {
    const cps = [
      makeCheckIn({ progressAfter: 50, createdAt: T0 }),
      makeCheckIn({ progressAfter: 60, createdAt: T0 + 10 * DAY }),
    ];
    const f = forecastKr(
      makeKr({ currentValue: 60 }),
      cps,
      T0 + 5 * DAY,
      T0 + 100 * DAY,
    );
    expect(f.daysToEnd).toBe(0);
  });

  it('波动大数据 → r² 低 + reasoning 含警告', () => {
    // 完全随机的进度数据 (大波动)
    const cps = [
      { progress: 10, day: 0 },
      { progress: 80, day: 5 },
      { progress: 20, day: 10 },
      { progress: 70, day: 15 },
      { progress: 30, day: 20 },
    ].map((p) => makeCheckIn({ progressAfter: p.progress, createdAt: T0 + p.day * DAY }));
    const f = forecastKr(makeKr({ currentValue: 30 }), cps, CYCLE_END, T0 + 20 * DAY);
    expect(f.confidence).toBeLessThan(0.5);
    expect(f.reasoning).toContain('波动较大');
  });
});

describe('forecastObjective · 风险排序', () => {
  it('off-track 先, 然后 at-risk, on-track, insufficient', () => {
    const obj: Objective = { id: 'o_1' } as Objective;
    const krs: KeyResult[] = [
      makeKr({ id: 'kr_high', currentValue: 90 }),
      makeKr({ id: 'kr_low', currentValue: 10 }),
      makeKr({ id: 'kr_mid', currentValue: 50 }),
      makeKr({ id: 'kr_no_data', currentValue: 30 }),
    ];

    const cps: CheckIn[] = [];
    // kr_high: +1.5 pp/天 → 强 on-track
    for (let i = 0; i < 3; i++) {
      cps.push(makeCheckIn({ scopeId: 'kr_high', progressAfter: 80 + i * 5, createdAt: T0 + i * 10 * DAY }));
    }
    // kr_low: +0.05 pp/天 → off-track
    for (let i = 0; i < 3; i++) {
      cps.push(makeCheckIn({ scopeId: 'kr_low', progressAfter: 10 + i * 0.5, createdAt: T0 + i * 10 * DAY }));
    }
    // kr_mid: 中等增长 → at-risk
    for (let i = 0; i < 3; i++) {
      cps.push(makeCheckIn({ scopeId: 'kr_mid', progressAfter: 50 + i * 3, createdAt: T0 + i * 10 * DAY }));
    }
    // kr_no_data: 0 条 → insufficient

    const ranked = forecastObjective(obj, krs, cps, CYCLE_END, T0 + 30 * DAY);
    const order: ForecastRiskLevel[] = ranked.map((r) => r.forecast.riskLevel);
    // 至少: off-track 排第 0 位, insufficient 排最后
    expect(order[0]).toBe('off-track');
    expect(order[order.length - 1]).toBe('insufficient-data');
  });
});

describe('reasoning 文本', () => {
  it('正向斜率显示 +N pp/天', () => {
    const cps = [
      makeCheckIn({ progressAfter: 20, createdAt: T0 }),
      makeCheckIn({ progressAfter: 40, createdAt: T0 + 10 * DAY }),
    ];
    const f = forecastKr(makeKr({ currentValue: 40 }), cps, CYCLE_END, T0 + 10 * DAY);
    expect(f.reasoning).toMatch(/\+\d+\.\d+ pp\/天/);
  });

  it('reasoning 含距季末天数', () => {
    const cps = [
      makeCheckIn({ progressAfter: 50, createdAt: T0 }),
      makeCheckIn({ progressAfter: 60, createdAt: T0 + 10 * DAY }),
    ];
    const f = forecastKr(makeKr({ currentValue: 60 }), cps, CYCLE_END, T0 + 10 * DAY);
    expect(f.reasoning).toContain('距季末');
  });
});
