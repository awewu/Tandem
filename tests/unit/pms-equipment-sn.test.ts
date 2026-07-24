import { describe, it, expect } from 'vitest';
import {
  canTransitionSN,
  computeWarrantyExpiry,
  isWarrantyValid,
} from '@/lib/pms/equipment-sn-service';

describe('PMS equipment-sn · canTransitionSN 状态机', () => {
  it('in_stock → shipped / recalled', () => {
    expect(canTransitionSN('in_stock', 'shipped')).toBe(true);
    expect(canTransitionSN('in_stock', 'recalled')).toBe(true);
  });

  it('shipped → installed / returned / recalled', () => {
    expect(canTransitionSN('shipped', 'installed')).toBe(true);
    expect(canTransitionSN('shipped', 'returned')).toBe(true);
    expect(canTransitionSN('shipped', 'recalled')).toBe(true);
  });

  it('installed → active / recalled; active → retired / recalled', () => {
    expect(canTransitionSN('installed', 'active')).toBe(true);
    expect(canTransitionSN('active', 'retired')).toBe(true);
    expect(canTransitionSN('active', 'recalled')).toBe(true);
  });

  it('returned → in_stock (返库); recalled → returned/retired', () => {
    expect(canTransitionSN('returned', 'in_stock')).toBe(true);
    expect(canTransitionSN('recalled', 'returned')).toBe(true);
    expect(canTransitionSN('recalled', 'retired')).toBe(true);
  });

  it('跳级/逆向/终态非法', () => {
    expect(canTransitionSN('in_stock', 'installed')).toBe(false);
    expect(canTransitionSN('in_stock', 'active')).toBe(false);
    expect(canTransitionSN('retired', 'active')).toBe(false);
    expect(canTransitionSN('active', 'installed')).toBe(false);
    expect(canTransitionSN('', 'shipped')).toBe(false);
  });
});

describe('PMS equipment-sn · computeWarrantyExpiry', () => {
  it('安装日 + 保修月数', () => {
    expect(computeWarrantyExpiry('2026-01-15', 12)).toBe('2027-01-15');
    expect(computeWarrantyExpiry('2026-01-15', 24)).toBe('2028-01-15');
  });

  it('跨年月份进位 (JS Date 溢出前滚: 2月无30日→3月)', () => {
    expect(computeWarrantyExpiry('2026-11-30', 3)).toBe('2027-03-02');
  });

  it('非法日期原样返回', () => {
    expect(computeWarrantyExpiry('not-a-date', 12)).toBe('not-a-date');
  });
});

describe('PMS equipment-sn · isWarrantyValid', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('到期日在未来 → 有效', () => {
    expect(isWarrantyValid('2026-12-31', now)).toBe(true);
  });

  it('到期日已过 → 失效', () => {
    expect(isWarrantyValid('2026-01-01', now)).toBe(false);
  });

  it('空/非法 → 失效', () => {
    expect(isWarrantyValid(null, now)).toBe(false);
    expect(isWarrantyValid(undefined, now)).toBe(false);
    expect(isWarrantyValid('bad', now)).toBe(false);
  });
});
