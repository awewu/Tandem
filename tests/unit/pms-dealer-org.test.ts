import { describe, it, expect } from 'vitest';
import {
  isQualificationValid,
  canApproveQualification,
} from '@/lib/pms/dealer-org-service';

describe('PMS dealer-org · isQualificationValid', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  it('未到期 → 有效', () => {
    expect(isQualificationValid('2026-12-31', now)).toBe(true);
  });
  it('已过期 → 失效', () => {
    expect(isQualificationValid('2026-01-01', now)).toBe(false);
  });
  it('空/非法 → 失效', () => {
    expect(isQualificationValid(null, now)).toBe(false);
    expect(isQualificationValid('bad', now)).toBe(false);
  });
});

describe('PMS dealer-org · canApproveQualification', () => {
  it('仅 pending 可审批', () => {
    expect(canApproveQualification('pending')).toBe(true);
    expect(canApproveQualification('approved')).toBe(false);
    expect(canApproveQualification('rejected')).toBe(false);
  });
});
