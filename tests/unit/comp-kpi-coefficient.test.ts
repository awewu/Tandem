import { describe, it, expect } from 'vitest';
import { kpiToCoefficient, aggregateKpiToCoefficient } from '../../lib/comp/kpi-coefficient';

describe('kpiToCoefficient', () => {
  it('returns 0 coefficient (hard cutoff) when achievement < 80%', () => {
    const r = kpiToCoefficient({ currentValue: 70, targetValue: 100 });
    expect(r.achievementRate).toBe(0.7);
    expect(r.coefficient).toBe(0);
    expect(r.hardCutoff).toBe(true);
  });

  it('returns 0 at exactly 80%', () => {
    const r = kpiToCoefficient({ currentValue: 80, targetValue: 100 });
    expect(r.coefficient).toBeCloseTo(0, 5);
    expect(r.hardCutoff).toBe(false);
  });

  it('returns 1.0 at 100% achievement', () => {
    const r = kpiToCoefficient({ currentValue: 100, targetValue: 100 });
    expect(r.coefficient).toBeCloseTo(1.0, 5);
  });

  it('returns 1.3 at 130% achievement', () => {
    const r = kpiToCoefficient({ currentValue: 130, targetValue: 100 });
    expect(r.coefficient).toBeCloseTo(1.3, 5);
  });

  it('caps at 1.3 above 130%', () => {
    const r = kpiToCoefficient({ currentValue: 200, targetValue: 100 });
    expect(r.coefficient).toBe(1.3);
  });

  it('handles negative-direction KPI (smaller is better)', () => {
    const r = kpiToCoefficient({ currentValue: 30, targetValue: 30, startValue: 60, positive: false });
    expect(r.achievementRate).toBeCloseTo(1.0, 5);
    expect(r.coefficient).toBeCloseTo(1.0, 5);
  });

  it('handles targetValue=0 gracefully', () => {
    const r = kpiToCoefficient({ currentValue: 0, targetValue: 0 });
    expect(r.coefficient).toBe(1);
    expect(r.hardCutoff).toBe(false);
  });
});

describe('aggregateKpiToCoefficient', () => {
  it('returns 1.0 for empty items', () => {
    const r = aggregateKpiToCoefficient({ items: [] });
    expect(r.coefficient).toBe(1);
  });

  it('hard-cuts if any single KPI is below 80%', () => {
    const r = aggregateKpiToCoefficient({
      items: [
        { currentValue: 100, targetValue: 100 },
        { currentValue: 50, targetValue: 100 },
      ],
    });
    expect(r.hardCutoff).toBe(true);
    expect(r.coefficient).toBe(0);
  });

  it('averages weighted rates when all pass', () => {
    const r = aggregateKpiToCoefficient({
      items: [
        { currentValue: 100, targetValue: 100 },
        { currentValue: 110, targetValue: 100 },
      ],
      weights: [1, 1],
    });
    expect(r.achievementRate).toBeCloseTo(1.05, 2);
    expect(r.coefficient).toBeGreaterThan(1.0);
  });
});
