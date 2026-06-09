/**
 * isAppVisibleTo · 后台授权外部用户可见模块 (③)
 *
 * 验证: 管理员把 launchpad 应用授权给外部角色 (partner/guest) 后,
 * 该外部用户的 /hub 才会出现该应用; 未授权则不可见.
 */

import { describe, it, expect } from 'vitest';
import { isAppVisibleTo, type ViewerCtx } from '@/lib/services/launchpad-visibility';
import type { LaunchpadApp } from '@/lib/types/launchpad';

function makeApp(overrides: Partial<LaunchpadApp> = {}): LaunchpadApp {
  return {
    id: 'app_1',
    category: 'custom',
    name: '经销商手册',
    description: null,
    iconUrl: null,
    url: '/shouchao',
    ssoMode: 'none',
    ssoConfig: null,
    visibleTo: [],
    visibleToRoles: [],
    order: 0,
    recommendKeywords: [],
    unreadAdapter: null,
    status: 'active',
    tenantId: 'default',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const dealer: ViewerCtx = { userId: 'u1', roles: ['partner'], tenantId: 'default' };

const employee: ViewerCtx = { userId: 'e1', roles: ['employee'], tenantId: 'default' };

describe('isAppVisibleTo · 外部授权 (opt-in 白名单)', () => {
  it('未授权 (visibleToRoles=[]) → 外部用户不可见 (核心: 默认不漏内部应用)', () => {
    expect(isAppVisibleTo(makeApp(), dealer)).toBe(false);
  });

  it('未授权 (visibleToRoles=[]) → 内部员工仍可见 (内部默认开放)', () => {
    expect(isAppVisibleTo(makeApp(), employee)).toBe(true);
  });

  it('授权给 partner → 经销商可见', () => {
    expect(isAppVisibleTo(makeApp({ visibleToRoles: ['partner'] }), dealer)).toBe(true);
  });

  it('只授权内部角色 → 经销商不可见', () => {
    expect(isAppVisibleTo(makeApp({ visibleToRoles: ['manager', 'admin'] }), dealer)).toBe(false);
  });

  it('授权给 guest → 申请注册人可见, 但 partner 不可见', () => {
    const app = makeApp({ visibleToRoles: ['guest'] });
    expect(isAppVisibleTo(app, { userId: 'u2', roles: ['guest'], tenantId: 'default' })).toBe(true);
    expect(isAppVisibleTo(app, dealer)).toBe(false);
  });

  it('disabled 应用 → 任何人不可见', () => {
    expect(isAppVisibleTo(makeApp({ status: 'disabled', visibleToRoles: ['partner'] }), dealer)).toBe(false);
  });

  it('跨租户 → 不可见', () => {
    expect(isAppVisibleTo(makeApp({ tenantId: 'other', visibleToRoles: ['partner'] }), dealer)).toBe(false);
  });

  it('部门门只约束内部员工, 不影响已授权外部用户', () => {
    const app = makeApp({ visibleToRoles: ['partner'], visibleTo: ['dept-sales'] });
    // 外部用户无部门归属, 已授权角色即可见 (不被部门门拦)
    expect(isAppVisibleTo(app, dealer)).toBe(true);
    // 内部员工不在该部门 → 被部门门拦
    expect(isAppVisibleTo(app, employee)).toBe(false);
  });
});
