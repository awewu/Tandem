import { describe, it, expect } from 'vitest';
import { isCascadeConsistent } from '@/lib/types/kpi';

describe('isCascadeConsistent · CHARTER §2.2 体系目标同步', () => {
  it('empty children = trivially ok', () => {
    expect(isCascadeConsistent(1000, [])).toBe(true);
  });

  it('exact sum matches', () => {
    expect(isCascadeConsistent(1000, [400, 300, 300])).toBe(true);
  });

  it('within ±1% tolerance is allowed', () => {
    expect(isCascadeConsistent(1000, [400, 300, 305])).toBe(true); // 1005 → 0.5% off
  });

  it('beyond default ±1% tolerance is rejected', () => {
    expect(isCascadeConsistent(1000, [400, 300, 320])).toBe(false); // 1020 → 2% off
  });

  it('custom tolerance ratio', () => {
    expect(isCascadeConsistent(1000, [400, 300, 320], 0.05)).toBe(true); // 5% allowed
  });

  it('handles negative parent', () => {
    expect(isCascadeConsistent(-100, [-30, -30, -40])).toBe(true);
  });
});
