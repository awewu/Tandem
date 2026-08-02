/**
 * P0 知识库治理硬化 · 回归测试
 *
 * 覆盖:
 *   1. authorizeSignerRole — 签字角色身份校验 (防伪造 CEO/steward 签字)
 *   2. module-scope canAccessPath — 纯外部协作者禁入升级/降级治理端点 (纵深防御)
 */

import { describe, expect, it } from 'vitest';

import { authorizeSignerRole } from '@/lib/memory/promotion-flow';
import { canAccessPath } from '@/lib/auth/module-scope';

describe('authorizeSignerRole · 签字角色身份校验', () => {
  it('owner 可担任 ceo/clevel/steward 等全部签字角色', () => {
    for (const role of ['ceo', 'clevel', 'team_leader', 'dept_leader', 'kr_owner', 'steward'] as const) {
      expect(authorizeSignerRole(role, ['owner'])).toBe(true);
    }
  });

  it('manager 仅可担任 team_leader/dept_leader/kr_owner, 不可 ceo/clevel/steward', () => {
    expect(authorizeSignerRole('team_leader', ['manager'])).toBe(true);
    expect(authorizeSignerRole('dept_leader', ['manager'])).toBe(true);
    expect(authorizeSignerRole('kr_owner', ['manager'])).toBe(true);
    expect(authorizeSignerRole('ceo', ['manager'])).toBe(false);
    expect(authorizeSignerRole('clevel', ['manager'])).toBe(false);
    expect(authorizeSignerRole('steward', ['manager'])).toBe(false);
  });

  it('普通员工/外部协作者不可担任任何签字角色 (核心防伪造)', () => {
    for (const role of ['ceo', 'clevel', 'team_leader', 'dept_leader', 'kr_owner', 'steward'] as const) {
      expect(authorizeSignerRole(role, ['employee'])).toBe(false);
      expect(authorizeSignerRole(role, ['guest'])).toBe(false);
      expect(authorizeSignerRole(role, [])).toBe(false);
    }
  });

  it('ceo 仅 owner 可担任 (admin 不足以自封 CEO)', () => {
    expect(authorizeSignerRole('ceo', ['owner'])).toBe(true);
    expect(authorizeSignerRole('ceo', ['admin'])).toBe(false);
  });

  it('steward 身份需 owner/admin/steward (端点外另有 stewards 表二次校验)', () => {
    expect(authorizeSignerRole('steward', ['steward'])).toBe(true);
    expect(authorizeSignerRole('steward', ['admin'])).toBe(true);
    expect(authorizeSignerRole('steward', ['owner'])).toBe(true);
    expect(authorizeSignerRole('steward', ['manager'])).toBe(false);
  });

  it('business_leader (V1 兼容) 等价 dept_leader', () => {
    expect(authorizeSignerRole('business_leader', ['manager'])).toBe(true);
    expect(authorizeSignerRole('business_leader', ['employee'])).toBe(false);
  });
});

describe('module-scope · 治理端点外部隔离', () => {
  const govPaths = [
    '/api/tandem/memory/promotion',
    '/api/tandem/memory/downgrade',
  ];

  it('纯外部协作者 (guest/partner/contractor) 被拒于升级/降级治理端点', () => {
    for (const path of govPaths) {
      expect(canAccessPath(['guest'], path)).toBe(false);
      expect(canAccessPath(['partner'], path)).toBe(false);
      expect(canAccessPath(['contractor'], path)).toBe(false);
      expect(canAccessPath(['dealer_sales'], path)).toBe(false);
    }
  });

  it('内部角色 (employee/manager/steward/admin/owner) 可达治理端点前缀 (端点内再做角色门)', () => {
    for (const path of govPaths) {
      expect(canAccessPath(['employee'], path)).toBe(true);
      expect(canAccessPath(['manager'], path)).toBe(true);
      expect(canAccessPath(['steward'], path)).toBe(true);
      expect(canAccessPath(['admin'], path)).toBe(true);
      expect(canAccessPath(['owner'], path)).toBe(true);
    }
  });
});
