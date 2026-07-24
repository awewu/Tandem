import { describe, it, expect } from 'vitest';
import {
  computeDiscountRate,
  requiredApprovalLevel,
  approverLevelForRoles,
} from '@/lib/pms/price-application-service';

describe('PMS price-application · computeDiscountRate', () => {
  it('正常折扣计算 (保留两位)', () => {
    expect(computeDiscountRate(100, 90)).toBe(10);
    expect(computeDiscountRate(100, 85.5)).toBe(14.5);
    expect(computeDiscountRate(1000, 777)).toBe(22.3);
  });

  it('无折扣或加价 → 0', () => {
    expect(computeDiscountRate(100, 100)).toBe(0);
    expect(computeDiscountRate(100, 120)).toBe(0);
  });

  it('非法 listPrice → 0', () => {
    expect(computeDiscountRate(0, 50)).toBe(0);
    expect(computeDiscountRate(-10, 5)).toBe(0);
  });
});

describe('PMS price-application · requiredApprovalLevel (分级)', () => {
  it('<= 5% → level 1', () => {
    expect(requiredApprovalLevel(0)).toBe(1);
    expect(requiredApprovalLevel(5)).toBe(1);
  });

  it('(5, 15] → level 2', () => {
    expect(requiredApprovalLevel(5.01)).toBe(2);
    expect(requiredApprovalLevel(15)).toBe(2);
  });

  it('> 15% → level 3', () => {
    expect(requiredApprovalLevel(15.01)).toBe(3);
    expect(requiredApprovalLevel(50)).toBe(3);
  });

  it('自定义阈值生效', () => {
    expect(requiredApprovalLevel(8, { l1Max: 10, l2Max: 20 })).toBe(1);
    expect(requiredApprovalLevel(18, { l1Max: 10, l2Max: 20 })).toBe(2);
    expect(requiredApprovalLevel(25, { l1Max: 10, l2Max: 20 })).toBe(3);
  });
});

describe('PMS price-application · approverLevelForRoles', () => {
  it('owner/admin → 3', () => {
    expect(approverLevelForRoles(['owner'])).toBe(3);
    expect(approverLevelForRoles(['admin'])).toBe(3);
  });

  it('manager → 2', () => {
    expect(approverLevelForRoles(['manager'])).toBe(2);
  });

  it('其它内部角色 → 1', () => {
    expect(approverLevelForRoles(['employee'])).toBe(1);
    expect(approverLevelForRoles(['finance'])).toBe(1);
  });

  it('取最高级别', () => {
    expect(approverLevelForRoles(['employee', 'admin'])).toBe(3);
    expect(approverLevelForRoles(['employee', 'manager'])).toBe(2);
  });

  it('无审批权角色 (外部/未知) → 0', () => {
    expect(approverLevelForRoles(['dealer_sales'])).toBe(0);
    expect(approverLevelForRoles([])).toBe(0);
  });
});
