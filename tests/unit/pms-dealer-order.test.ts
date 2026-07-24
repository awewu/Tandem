import { describe, it, expect } from 'vitest';
import {
  canTransitionOrder,
  computeOrderTotal,
  formatDealerOrderNumber,
} from '@/lib/pms/dealer-order-service';

describe('PMS dealer-order · canTransitionOrder 状态机', () => {
  it('pending → confirmed / cancelled', () => {
    expect(canTransitionOrder('pending', 'confirmed')).toBe(true);
    expect(canTransitionOrder('pending', 'cancelled')).toBe(true);
  });
  it('confirmed → shipped / cancelled', () => {
    expect(canTransitionOrder('confirmed', 'shipped')).toBe(true);
    expect(canTransitionOrder('confirmed', 'cancelled')).toBe(true);
  });
  it('shipped → completed (不可取消)', () => {
    expect(canTransitionOrder('shipped', 'completed')).toBe(true);
    expect(canTransitionOrder('shipped', 'cancelled')).toBe(false);
  });
  it('跳级/终态非法', () => {
    expect(canTransitionOrder('pending', 'shipped')).toBe(false);
    expect(canTransitionOrder('completed', 'pending')).toBe(false);
    expect(canTransitionOrder('cancelled', 'confirmed')).toBe(false);
    expect(canTransitionOrder('', 'confirmed')).toBe(false);
  });
});

describe('PMS dealer-order · computeOrderTotal', () => {
  it('Σ(qty×price) 保留两位', () => {
    expect(computeOrderTotal([
      { productId: 'a', quantity: 2, unitPrice: 100 },
      { productId: 'b', quantity: 3, unitPrice: 49.9 },
    ])).toBe(349.7);
  });
  it('忽略非法行 (qty<=0 或负价)', () => {
    expect(computeOrderTotal([
      { productId: 'a', quantity: 0, unitPrice: 100 },
      { productId: 'b', quantity: -1, unitPrice: 50 },
      { productId: 'c', quantity: 1, unitPrice: 50 },
    ])).toBe(50);
  });
  it('空/非数组 → 0', () => {
    expect(computeOrderTotal([])).toBe(0);
    // @ts-expect-error 测试非法输入
    expect(computeOrderTotal(null)).toBe(0);
  });
});

describe('PMS dealer-order · formatDealerOrderNumber', () => {
  it('DO-YYYYMMDD-XXXX', () => {
    const d = new Date('2026-06-05T00:00:00Z');
    expect(formatDealerOrderNumber(d, 42)).toBe('DO-20260605-0042');
  });
});
