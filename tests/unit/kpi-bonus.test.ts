/**
 * Unit tests for the bonus payout pure function.
 * No DB / no Next / no boot — runs in <100ms in CI.
 */

import { describe, it, expect } from 'vitest';
import { computeBonusPayout, computeKpiCompletion } from '@/lib/types/kpi';

const subj = () => 'CODE';

describe('computeKpiCompletion', () => {
  it('returns 0 if currentValue at startValue', () => {
    expect(computeKpiCompletion({ startValue: 100, targetValue: 200, currentValue: 100 })).toBe(0);
  });

  it('returns 1 at target', () => {
    expect(computeKpiCompletion({ startValue: 0, targetValue: 100, currentValue: 100 })).toBe(1);
  });

  it('caps at 1.5 (super-achievement)', () => {
    expect(computeKpiCompletion({ startValue: 0, targetValue: 100, currentValue: 1000 })).toBe(1.5);
  });

  it('clamps below 0 if regressing', () => {
    expect(computeKpiCompletion({ startValue: 100, targetValue: 200, currentValue: 50 })).toBe(0);
  });

  it('handles zero range as binary', () => {
    expect(computeKpiCompletion({ startValue: 100, targetValue: 100, currentValue: 100 })).toBe(1);
    expect(computeKpiCompletion({ startValue: 100, targetValue: 100, currentValue: 50 })).toBe(0);
  });
});

describe('computeBonusPayout', () => {
  it('returns zero for empty bonus list (no KPI = no bonus)', () => {
    const r = computeBonusPayout([], 50000, subj);
    expect(r.weightedCompletion).toBe(0);
    expect(r.finalBonus).toBe(0);
    expect(r.contributions).toEqual([]);
  });

  it('computes simple full-completion bonus', () => {
    const kpis = [
      { id: 'k1', subjectId: 's1', title: 'Rev', weight: 100, startValue: 0, targetValue: 100, currentValue: 100 },
    ];
    const r = computeBonusPayout(kpis, 50000, subj);
    expect(r.weightedCompletion).toBe(1);
    expect(r.finalBonus).toBe(50000);
    expect(r.contributions).toHaveLength(1);
    expect(r.contributions[0].weightedScore).toBe(100);
  });

  it('weighted average across multiple KPIs', () => {
    // 70% weight @ 100% + 30% weight @ 50% = 0.85
    const kpis = [
      { id: 'a', subjectId: 's', title: 'A', weight: 70, startValue: 0, targetValue: 100, currentValue: 100 },
      { id: 'b', subjectId: 's', title: 'B', weight: 30, startValue: 0, targetValue: 100, currentValue: 50 },
    ];
    const r = computeBonusPayout(kpis, 10000, subj);
    expect(r.weightedCompletion).toBeCloseTo(0.85, 5);
    expect(r.finalBonus).toBeCloseTo(8500, 1);
  });

  it('caps weighted completion at 1.5 (CHARTER §2.0 super-cap)', () => {
    const kpis = [
      { id: 'a', subjectId: 's', title: 'A', weight: 100, startValue: 0, targetValue: 100, currentValue: 1000 },
    ];
    const r = computeBonusPayout(kpis, 10000, subj);
    // raw weightedCompletion = 1.5 (computeKpiCompletion already capped)
    expect(r.weightedCompletion).toBe(1.5);
    expect(r.finalBonus).toBe(15000);
  });

  it('zero baseBonus → zero payout', () => {
    const kpis = [
      { id: 'a', subjectId: 's', title: 'A', weight: 100, startValue: 0, targetValue: 100, currentValue: 100 },
    ];
    const r = computeBonusPayout(kpis, 0, subj);
    expect(r.finalBonus).toBe(0);
  });
});
