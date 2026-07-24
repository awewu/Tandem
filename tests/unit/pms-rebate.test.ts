import { describe, it, expect } from 'vitest';
import {
  selectRebateTier,
  computeRebate,
  type RebateTier,
} from '@/lib/pms/rebate-service';

const tiers: RebateTier[] = [
  { minAmount: 0, maxAmount: 100000, rebateRate: 1 },
  { minAmount: 100000, maxAmount: 500000, rebateRate: 3 },
  { minAmount: 500000, rebateRate: 5 }, // 最后一档无上限
];

describe('PMS rebate · selectRebateTier', () => {
  it('命中对应区间档 (取 minAmount 最高的匹配档)', () => {
    expect(selectRebateTier(50000, tiers)?.rebateRate).toBe(1);
    expect(selectRebateTier(300000, tiers)?.rebateRate).toBe(3);
    expect(selectRebateTier(800000, tiers)?.rebateRate).toBe(5);
  });

  it('边界值归入更高档 (minAmount 含等)', () => {
    expect(selectRebateTier(100000, tiers)?.rebateRate).toBe(3);
    expect(selectRebateTier(500000, tiers)?.rebateRate).toBe(5);
  });

  it('无匹配档返回 null', () => {
    expect(selectRebateTier(-1, tiers)).toBeNull();
    expect(selectRebateTier(50, [{ minAmount: 1000, rebateRate: 2 }])).toBeNull();
  });
});

describe('PMS rebate · computeRebate', () => {
  it('整额按达成档费率计算 (保留两位)', () => {
    expect(computeRebate(50000, tiers)).toEqual({ rebateRate: 1, rebateAmount: 500 });
    expect(computeRebate(300000, tiers)).toEqual({ rebateRate: 3, rebateAmount: 9000 });
    expect(computeRebate(800000, tiers)).toEqual({ rebateRate: 5, rebateAmount: 40000 });
  });

  it('小数金额四舍五入到分', () => {
    expect(computeRebate(12345.67, [{ minAmount: 0, rebateRate: 3 }]).rebateAmount).toBe(370.37);
  });

  it('非法输入 → 0', () => {
    expect(computeRebate(0, tiers)).toEqual({ rebateRate: 0, rebateAmount: 0 });
    expect(computeRebate(-100, tiers)).toEqual({ rebateRate: 0, rebateAmount: 0 });
    expect(computeRebate(50000, [])).toEqual({ rebateRate: 0, rebateAmount: 0 });
  });
});
