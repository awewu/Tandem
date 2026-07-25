import { describe, it, expect } from 'vitest';
import {
  computeAchievementRate,
  computeGrowth,
  periodBounds,
  shiftPeriod,
} from '@/lib/pms/performance-target-service';

describe('PMS performance · computeAchievementRate', () => {
  it('达成率 (%) 保留一位', () => {
    expect(computeAchievementRate(80, 100)).toBe(80);
    expect(computeAchievementRate(120, 100)).toBe(120);
    expect(computeAchievementRate(1, 3)).toBe(33.3);
  });
  it('target<=0 → 0', () => {
    expect(computeAchievementRate(50, 0)).toBe(0);
    expect(computeAchievementRate(50, -10)).toBe(0);
  });
  it('actual=0 → 0', () => {
    expect(computeAchievementRate(0, 100)).toBe(0);
  });
});

describe('PMS performance · computeGrowth', () => {
  it('增长率 (%) 保留一位', () => {
    expect(computeGrowth(120, 100)).toBe(20);
    expect(computeGrowth(80, 100)).toBe(-20);
    expect(computeGrowth(100, 3)).toBe(3233.3);
  });
  it('prev<=0 → null (无可比基期)', () => {
    expect(computeGrowth(50, 0)).toBeNull();
    expect(computeGrowth(50, -10)).toBeNull();
  });
});

describe('PMS performance · periodBounds', () => {
  it('monthly → 当月 [start, end)', () => {
    const { start, end } = periodBounds('2026-03', 'monthly');
    expect(start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
  it('quarterly Q2 → 4-6 月', () => {
    const { start, end } = periodBounds('2026-Q2', 'quarterly');
    expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
  it('yearly → 全年', () => {
    const { start, end } = periodBounds('2026', 'yearly');
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
  it('非法格式抛错', () => {
    expect(() => periodBounds('2026-13', 'monthly')).toThrow();
    expect(() => periodBounds('2026-Q5', 'quarterly')).toThrow();
    expect(() => periodBounds('abcd', 'yearly')).toThrow();
  });
});

describe('PMS performance · shiftPeriod', () => {
  it('monthly yoy=去年同月, mom=上月(跨年)', () => {
    expect(shiftPeriod('2026-03', 'monthly', 'yoy')).toBe('2025-03');
    expect(shiftPeriod('2026-03', 'monthly', 'mom')).toBe('2026-02');
    expect(shiftPeriod('2026-01', 'monthly', 'mom')).toBe('2025-12');
  });
  it('quarterly yoy=去年同季, mom=上季(跨年)', () => {
    expect(shiftPeriod('2026-Q2', 'quarterly', 'yoy')).toBe('2025-Q2');
    expect(shiftPeriod('2026-Q2', 'quarterly', 'mom')).toBe('2026-Q1');
    expect(shiftPeriod('2026-Q1', 'quarterly', 'mom')).toBe('2025-Q4');
  });
  it('yearly → 上一年', () => {
    expect(shiftPeriod('2026', 'yearly', 'yoy')).toBe('2025');
    expect(shiftPeriod('2026', 'yearly', 'mom')).toBe('2025');
  });
});
