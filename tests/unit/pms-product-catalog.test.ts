import { describe, it, expect } from 'vitest';
import {
  computeMargin,
  isPriceAboveFloor,
} from '@/lib/pms/product-catalog-service';

describe('PMS product · computeMargin', () => {
  it('毛利率 (%) 保留一位', () => {
    expect(computeMargin(100, 60)).toBe(40);
    expect(computeMargin(100, 66.6)).toBe(33.4);
  });
  it('成本高于售价 → 负毛利', () => {
    expect(computeMargin(100, 120)).toBe(-20);
  });
  it('非法 listPrice → 0', () => {
    expect(computeMargin(0, 50)).toBe(0);
    expect(computeMargin(-1, 50)).toBe(0);
  });
});

describe('PMS product · isPriceAboveFloor', () => {
  it('高于/等于限价 → true', () => {
    expect(isPriceAboveFloor(100, 80)).toBe(true);
    expect(isPriceAboveFloor(80, 80)).toBe(true);
  });
  it('低于限价 → false', () => {
    expect(isPriceAboveFloor(70, 80)).toBe(false);
  });
  it('未设限价 → 恒 true', () => {
    expect(isPriceAboveFloor(1, null)).toBe(true);
    expect(isPriceAboveFloor(1, undefined)).toBe(true);
  });
});
