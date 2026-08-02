import { describe, it, expect } from 'vitest';
import { analyzeDemotionFairness } from '../../lib/comp/demotion-audit';
import { calculateDepartmentAssessment, calculateLipBonus } from '../../lib/comp/lip-assessment';

describe('analyzeDemotionFairness', () => {
  it('returns empty distribution for no demotions', () => {
    const r = analyzeDemotionFairness([]);
    expect(r.total).toBe(0);
    expect(r.hasConcentration).toBe(false);
  });

  it('filters non-demotion records', () => {
    const r = analyzeDemotionFairness([
      { employeeId: 'e1', cycle: '2026-Q1', changeType: '知悉' },
      { employeeId: 'e2', cycle: '2026-Q1', changeType: '职级晋升' },
    ]);
    expect(r.total).toBe(0);
  });

  it('detects concentration when one department > 40%', () => {
    const r = analyzeDemotionFairness([
      { employeeId: 'e1', departmentId: 'dept-A', cycle: '2026-Q1', changeType: '降职生效' },
      { employeeId: 'e2', departmentId: 'dept-A', cycle: '2026-Q1', changeType: '降职生效' },
      { employeeId: 'e3', departmentId: 'dept-A', cycle: '2026-Q1', changeType: '降职生效' },
      { employeeId: 'e4', departmentId: 'dept-B', cycle: '2026-Q1', changeType: '降职生效' },
      { employeeId: 'e5', departmentId: 'dept-B', cycle: '2026-Q1', changeType: '降职生效' },
    ]);
    expect(r.total).toBe(5);
    expect(r.hasConcentration).toBe(true);
    expect(r.concentratedDepartments).toContain('dept-A');
  });

  it('does not flag concentration for < 5 total', () => {
    const r = analyzeDemotionFairness([
      { employeeId: 'e1', departmentId: 'dept-A', cycle: '2026-Q1', changeType: '降职生效' },
      { employeeId: 'e2', departmentId: 'dept-A', cycle: '2026-Q1', changeType: '降职生效' },
    ]);
    expect(r.total).toBe(2);
    expect(r.hasConcentration).toBe(false);
  });
});

describe('calculateDepartmentAssessment', () => {
  it('returns 1.0 when both quality and efficiency fully met', () => {
    const r = calculateDepartmentAssessment({ qualityRate: 1, efficiencyRate: 1 });
    expect(r.coefficient).toBe(1);
    expect(r.qualityBelow).toBe(false);
    expect(r.efficiencyBelow).toBe(false);
  });

  it('reduces coefficient when quality below target', () => {
    const r = calculateDepartmentAssessment({ qualityRate: 0.8, efficiencyRate: 1 });
    expect(r.coefficient).toBeCloseTo(0.9, 5);
    expect(r.qualityBelow).toBe(true);
  });

  it('caps at 1.0 (no department-level upside)', () => {
    const r = calculateDepartmentAssessment({ qualityRate: 1.2, efficiencyRate: 1.1 });
    expect(r.coefficient).toBe(1);
  });

  it('handles both dimensions below', () => {
    const r = calculateDepartmentAssessment({ qualityRate: 0.6, efficiencyRate: 0.4 });
    expect(r.coefficient).toBeCloseTo(0.5, 5);
  });
});

describe('calculateLipBonus', () => {
  it('calculates base × coeff × personal × attendance', () => {
    const bonus = calculateLipBonus(1000, 0.9, 1.2, 0.95);
    expect(bonus).toBe(1026);
  });

  it('caps personal coefficient at 1.3', () => {
    const bonus = calculateLipBonus(1000, 1, 2.0, 1);
    expect(bonus).toBe(1300);
  });

  it('returns 0 when attendance is 0', () => {
    const bonus = calculateLipBonus(1000, 1, 1.3, 0);
    expect(bonus).toBe(0);
  });
});
