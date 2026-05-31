/**
 * Unit tests for BSC 四维配比校验 (B-020).
 * Pure-function tests — no DB / Next / boot.
 */

import { describe, it, expect } from 'vitest';
import {
  computeBscDistribution,
  assessBscBalance,
  isCausalDirectionValid,
  resolvePerspective,
  BSC_FINANCIAL_HARD_MAX,
  BSC_FINANCIAL_SOFT_MAX,
  BSC_NON_FINANCIAL_SOFT_MIN,
} from '@/lib/kpi/bsc-validation';
import type { Kpi, KpiSubject } from '@/lib/types/kpi';

type KpiLike = Pick<Kpi, 'bscPerspective' | 'subjectId' | 'weight' | 'scope'>;
type SubjLike = Pick<KpiSubject, 'id' | 'bscPerspective'>;

const kpi = (overrides: Partial<KpiLike> = {}): KpiLike => ({
  bscPerspective: 'financial',
  subjectId: 'subj-1',
  weight: 25,
  scope: 'bonus',
  ...overrides,
});

describe('resolvePerspective', () => {
  it('prefers kpi.bscPerspective over subject', () => {
    const subjects: SubjLike[] = [{ id: 's1', bscPerspective: 'process' }];
    expect(
      resolvePerspective({ bscPerspective: 'customer', subjectId: 's1' }, subjects),
    ).toBe('customer');
  });

  it('falls back to subject.bscPerspective', () => {
    const subjects: SubjLike[] = [{ id: 's1', bscPerspective: 'growth' }];
    expect(resolvePerspective({ subjectId: 's1' }, subjects)).toBe('growth');
  });

  it('returns undefined when neither set', () => {
    const subjects: SubjLike[] = [{ id: 's1' }];
    expect(resolvePerspective({ subjectId: 's1' }, subjects)).toBeUndefined();
  });
});

describe('computeBscDistribution', () => {
  it('returns zero distribution when no KPIs', () => {
    const d = computeBscDistribution([], []);
    expect(d.totalWeight).toBe(0);
    expect(d.byPerspective.financial).toBe(0);
    expect(d.unclassifiedCount).toBe(0);
  });

  it('normalizes by weight, ignores monitor scope by default', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 40 }),
      kpi({ bscPerspective: 'customer', weight: 20 }),
      kpi({ bscPerspective: 'process', weight: 20 }),
      kpi({ bscPerspective: 'growth', weight: 20 }),
      kpi({ bscPerspective: 'financial', weight: 999, scope: 'monitor' }), // ignored
    ];
    const d = computeBscDistribution(kpis, []);
    expect(d.totalWeight).toBe(100);
    expect(d.byPerspective.financial).toBeCloseTo(0.4);
    expect(d.byPerspective.customer).toBeCloseTo(0.2);
    expect(d.byPerspective.process).toBeCloseTo(0.2);
    expect(d.byPerspective.growth).toBeCloseTo(0.2);
    expect(d.countByPerspective.financial).toBe(1); // monitor not counted
  });

  it('counts unclassified KPIs separately', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 50 }),
      kpi({ bscPerspective: undefined, subjectId: 'unknown', weight: 30 }),
    ];
    const d = computeBscDistribution(kpis, []);
    expect(d.unclassifiedCount).toBe(1);
    expect(d.unclassifiedWeight).toBe(30);
    expect(d.totalWeight).toBe(50); // unclassified excluded from total
  });

  it('uses subject fallback for perspective', () => {
    const subjects: SubjLike[] = [{ id: 's1', bscPerspective: 'growth' }];
    const kpis: KpiLike[] = [kpi({ bscPerspective: undefined, subjectId: 's1', weight: 100 })];
    const d = computeBscDistribution(kpis, subjects);
    expect(d.byPerspective.growth).toBe(1);
  });

  it('clamps negative weights to 0', () => {
    const kpis: KpiLike[] = [kpi({ weight: -50, bscPerspective: 'financial' })];
    const d = computeBscDistribution(kpis, []);
    expect(d.totalWeight).toBe(0);
  });

  it('includes monitor KPIs when onlyBonus=false', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 50, scope: 'bonus' }),
      kpi({ bscPerspective: 'growth', weight: 50, scope: 'monitor' }),
    ];
    const d = computeBscDistribution(kpis, [], { onlyBonus: false });
    expect(d.totalWeight).toBe(100);
    expect(d.byPerspective.growth).toBeCloseTo(0.5);
  });
});

describe('assessBscBalance', () => {
  it('healthy: 40/20/20/20 split', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 40 }),
      kpi({ bscPerspective: 'customer', weight: 20 }),
      kpi({ bscPerspective: 'process', weight: 20 }),
      kpi({ bscPerspective: 'growth', weight: 20 }),
    ];
    const r = assessBscBalance(computeBscDistribution(kpis, []));
    expect(r.level).toBe('healthy');
    expect(r.issues).toHaveLength(0);
    expect(r.canActivateWithoutConfirm).toBe(true);
  });

  it('warning: financial just above soft max', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 60 }),
      kpi({ bscPerspective: 'customer', weight: 15 }),
      kpi({ bscPerspective: 'process', weight: 15 }),
      kpi({ bscPerspective: 'growth', weight: 10 }),
    ];
    const r = assessBscBalance(computeBscDistribution(kpis, []));
    expect(r.level).toBe('warning');
    expect(r.issues.some((i) => i.code === 'financial-too-high')).toBe(true);
    expect(r.canActivateWithoutConfirm).toBe(true);
  });

  it('imbalanced: financial > 70% triggers severe', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 80 }),
      kpi({ bscPerspective: 'customer', weight: 10 }),
      kpi({ bscPerspective: 'process', weight: 5 }),
      kpi({ bscPerspective: 'growth', weight: 5 }),
    ];
    const r = assessBscBalance(computeBscDistribution(kpis, []));
    expect(r.level).toBe('imbalanced');
    expect(r.issues.some((i) => i.code === 'financial-severe')).toBe(true);
    expect(r.canActivateWithoutConfirm).toBe(false);
  });

  it('imbalanced: zero perspective triggers severe', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 50 }),
      kpi({ bscPerspective: 'customer', weight: 30 }),
      kpi({ bscPerspective: 'process', weight: 20 }),
      // growth = 0
    ];
    const r = assessBscBalance(computeBscDistribution(kpis, []));
    expect(r.level).toBe('imbalanced');
    expect(
      r.issues.some((i) => i.code === 'perspective-zero' && i.perspective === 'growth'),
    ).toBe(true);
    expect(r.canActivateWithoutConfirm).toBe(false);
  });

  it('warning: non-financial below soft min but >0', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 45 }),
      kpi({ bscPerspective: 'customer', weight: 30 }),
      kpi({ bscPerspective: 'process', weight: 20 }),
      kpi({ bscPerspective: 'growth', weight: 5 }), // 5% < 10%
    ];
    const r = assessBscBalance(computeBscDistribution(kpis, []));
    expect(r.level).toBe('warning');
    expect(
      r.issues.some((i) => i.code === 'perspective-too-low' && i.perspective === 'growth'),
    ).toBe(true);
  });

  it('warning: unclassified KPIs flagged', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 25 }),
      kpi({ bscPerspective: 'customer', weight: 25 }),
      kpi({ bscPerspective: 'process', weight: 25 }),
      kpi({ bscPerspective: 'growth', weight: 25 }),
      kpi({ bscPerspective: undefined, subjectId: 'x', weight: 10 }),
    ];
    const r = assessBscBalance(computeBscDistribution(kpis, []));
    expect(r.issues.some((i) => i.code === 'unclassified-present')).toBe(true);
    expect(r.level).toBe('warning');
  });

  it('no-weights edge case: returns warning but allows activation', () => {
    const r = assessBscBalance(computeBscDistribution([], []));
    expect(r.level).toBe('warning');
    expect(r.issues[0]?.code).toBe('no-weights');
    expect(r.canActivateWithoutConfirm).toBe(true);
  });

  it('boundary: financial exactly at soft max = healthy', () => {
    const kpis: KpiLike[] = [
      kpi({ bscPerspective: 'financial', weight: 50 }),
      kpi({ bscPerspective: 'customer', weight: 20 }),
      kpi({ bscPerspective: 'process', weight: 15 }),
      kpi({ bscPerspective: 'growth', weight: 15 }),
    ];
    const r = assessBscBalance(computeBscDistribution(kpis, []));
    expect(r.distribution.byPerspective.financial).toBeCloseTo(BSC_FINANCIAL_SOFT_MAX);
    expect(r.level).toBe('healthy');
  });

  it('threshold constants are sane (soft < hard, min < soft-max)', () => {
    expect(BSC_FINANCIAL_SOFT_MAX).toBeLessThan(BSC_FINANCIAL_HARD_MAX);
    expect(BSC_NON_FINANCIAL_SOFT_MIN).toBeLessThan(BSC_FINANCIAL_SOFT_MAX);
  });
});

describe('isCausalDirectionValid', () => {
  it('growth → process is valid (upstream → downstream)', () => {
    expect(isCausalDirectionValid('growth', 'process')).toBe(true);
  });

  it('growth → financial is valid (transitive downstream)', () => {
    expect(isCausalDirectionValid('growth', 'financial')).toBe(true);
  });

  it('financial → growth is invalid (reverse)', () => {
    expect(isCausalDirectionValid('financial', 'growth')).toBe(false);
  });

  it('customer → process is invalid (sideways/reverse)', () => {
    expect(isCausalDirectionValid('customer', 'process')).toBe(false);
  });

  it('same perspective is invalid', () => {
    expect(isCausalDirectionValid('growth', 'growth')).toBe(false);
  });

  it('process → customer is valid', () => {
    expect(isCausalDirectionValid('process', 'customer')).toBe(true);
  });
});
