import { describe, it, expect } from 'vitest';
import {
  canArbitrate,
  normalizeDecision,
} from '@/lib/pms/duplicate-appeal-service';

describe('PMS duplicate-appeal · canArbitrate 状态机', () => {
  it('pending / under_review 可仲裁', () => {
    expect(canArbitrate('pending')).toBe(true);
    expect(canArbitrate('under_review')).toBe(true);
  });

  it('已裁决 (approved/rejected) 不可再仲裁', () => {
    expect(canArbitrate('approved')).toBe(false);
    expect(canArbitrate('rejected')).toBe(false);
  });

  it('未知状态不可仲裁', () => {
    expect(canArbitrate('')).toBe(false);
    expect(canArbitrate('closed')).toBe(false);
  });
});

describe('PMS duplicate-appeal · normalizeDecision', () => {
  it('接受 approved / approve', () => {
    expect(normalizeDecision('approved')).toBe('approved');
    expect(normalizeDecision('approve')).toBe('approved');
  });

  it('接受 rejected / reject', () => {
    expect(normalizeDecision('rejected')).toBe('rejected');
    expect(normalizeDecision('reject')).toBe('rejected');
  });

  it('非法裁决抛错', () => {
    expect(() => normalizeDecision('maybe')).toThrow();
    expect(() => normalizeDecision('')).toThrow();
    expect(() => normalizeDecision('pending')).toThrow();
  });
});
