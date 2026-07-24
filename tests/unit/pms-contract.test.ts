import { describe, it, expect } from 'vitest';
import {
  yyyymmdd,
  formatContractNumber,
  formatOrderNumber,
  canApproveContract,
} from '@/lib/pms/contract-service';

describe('PMS contract · yyyymmdd', () => {
  it('格式化为 YYYYMMDD (UTC, 补零)', () => {
    expect(yyyymmdd(new Date('2026-01-05T00:00:00Z'))).toBe('20260105');
    expect(yyyymmdd(new Date('2026-12-31T23:59:59Z'))).toBe('20261231');
  });
});

describe('PMS contract · formatContractNumber', () => {
  it('CT-YYYYMMDD-<suffix>', () => {
    const d = new Date('2026-07-23T10:00:00Z');
    expect(formatContractNumber(d, 'ABC123')).toBe('CT-20260723-ABC123');
  });
});

describe('PMS contract · formatOrderNumber', () => {
  it('DO-YYYYMMDD-<suffix>', () => {
    const d = new Date('2026-07-23T10:00:00Z');
    expect(formatOrderNumber(d, 'XYZ789')).toBe('DO-20260723-XYZ789');
  });
});

describe('PMS contract · canApproveContract 状态机', () => {
  it('draft / pending 可审批', () => {
    expect(canApproveContract('draft')).toBe(true);
    expect(canApproveContract('pending')).toBe(true);
  });

  it('已终态 (approved/rejected) 不可再审批', () => {
    expect(canApproveContract('approved')).toBe(false);
    expect(canApproveContract('rejected')).toBe(false);
  });

  it('未知状态不可审批', () => {
    expect(canApproveContract('')).toBe(false);
    expect(canApproveContract('effective')).toBe(false);
  });
});
