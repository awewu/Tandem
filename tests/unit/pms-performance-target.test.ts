import { describe, it, expect } from 'vitest';
import { computeAchievementRate } from '@/lib/pms/performance-target-service';

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
