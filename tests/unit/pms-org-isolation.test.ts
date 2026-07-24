import { describe, it, expect } from 'vitest';
import { canAccessRecord, type PmsAuthResult } from '@/lib/pms/pms-auth';

/** 构造最小 PmsAuthResult */
function mkAuth(over: Partial<PmsAuthResult>): PmsAuthResult {
  return {
    userId: 'u1',
    email: 'u1@tandem.local',
    tenantId: 'default',
    roles: [],
    mfaVerified: false,
    demo: false,
    visibleOrgIds: [],
    isInternal: false,
    isDealer: false,
    orgId: null,
    ...over,
  } as PmsAuthResult;
}

describe('PMS orgId 隔离 · canAccessRecord (越权矩阵)', () => {
  it('内部角色: 同租户任意 org 全通', () => {
    const auth = mkAuth({ isInternal: true, roles: ['employee'] });
    expect(canAccessRecord(auth, { orgId: 'org_any', tenantId: 'default' })).toBe(true);
  });

  it('内部角色: 跨租户拒绝 (tenant 是第一道)', () => {
    const auth = mkAuth({ isInternal: true, roles: ['employee'], tenantId: 'default' });
    expect(canAccessRecord(auth, { orgId: 'org_any', tenantId: 'other' })).toBe(false);
  });

  it('外部经销商: 可见自身 org → 通过', () => {
    const auth = mkAuth({
      isDealer: true,
      roles: ['dealer_sales'],
      orgId: 'org_a',
      visibleOrgIds: ['org_a'],
    });
    expect(canAccessRecord(auth, { orgId: 'org_a', tenantId: 'default' })).toBe(true);
  });

  it('外部经销商: 他人 org → 越权拒绝', () => {
    const auth = mkAuth({
      isDealer: true,
      roles: ['dealer_sales'],
      orgId: 'org_a',
      visibleOrgIds: ['org_a'],
    });
    expect(canAccessRecord(auth, { orgId: 'org_b', tenantId: 'default' })).toBe(false);
  });

  it('一级经销商: 可见下级二级 org → 通过', () => {
    const auth = mkAuth({
      isDealer: true,
      roles: ['dealer_admin'],
      orgId: 'org_a',
      visibleOrgIds: ['org_a', 'org_a_sub'],
    });
    expect(canAccessRecord(auth, { orgId: 'org_a_sub', tenantId: 'default' })).toBe(true);
  });

  it('外部经销商: 跨租户即使 org 名相同也拒绝', () => {
    const auth = mkAuth({
      isDealer: true,
      roles: ['dealer_sales'],
      orgId: 'org_a',
      visibleOrgIds: ['org_a'],
      tenantId: 'default',
    });
    expect(canAccessRecord(auth, { orgId: 'org_a', tenantId: 'other' })).toBe(false);
  });

  it('外部经销商: visibleOrgIds 为空 → 一律拒绝 (安全降级)', () => {
    const auth = mkAuth({
      isDealer: true,
      roles: ['dealer_sales'],
      orgId: null,
      visibleOrgIds: [],
    });
    expect(canAccessRecord(auth, { orgId: 'org_a', tenantId: 'default' })).toBe(false);
  });
});
