/**
 * resolveNavRoles · 两层用户导航可见性解析 (外部用户不串内部 nav)
 *
 * 关键不变量: 纯外部角色 (guest/partner/contractor) 绝不回落到 employee,
 * 否则经销商/申请注册人会在导航里看到内部 OKR/事半等模块.
 */

import { describe, it, expect } from 'vitest';
import { resolveNavRoles, NAV_MODULES, isVisible } from '@/components/nav-modules';

describe('resolveNavRoles', () => {
  it('未发起 fetch → employee (避免闪烁)', () => {
    expect(resolveNavRoles(undefined, { fetched: false })).toEqual(['employee']);
  });

  it('未登录 → ALL_ROLES (公开壳不依赖)', () => {
    expect(resolveNavRoles(undefined, { fetched: true, unauthenticated: true })).toContain('employee');
  });

  it('内部员工 → 原样返回内部角色', () => {
    expect(resolveNavRoles(['employee'], { fetched: true })).toEqual(['employee']);
    expect(resolveNavRoles(['manager', 'admin'], { fetched: true })).toEqual(['manager', 'admin']);
  });

  it('partner → partner 视图', () => {
    expect(resolveNavRoles(['partner'], { fetched: true })).toEqual(['partner']);
  });

  it('guest (申请注册人默认角色) → 映射为 partner, 绝不 employee', () => {
    const r = resolveNavRoles(['guest'], { fetched: true });
    expect(r).toEqual(['partner']);
    expect(r).not.toContain('employee');
  });

  it('contractor → 映射为 partner', () => {
    expect(resolveNavRoles(['contractor'], { fetched: true })).toEqual(['partner']);
  });

  it('混合内部+外部 → 取内部 (向上聚合)', () => {
    expect(resolveNavRoles(['employee', 'guest'], { fetched: true })).toEqual(['employee']);
  });

  it('admin@tandem.local 无角色 bootstrap → ALL_ROLES', () => {
    const r = resolveNavRoles([], { fetched: true, email: 'admin@tandem.local' });
    expect(r).toContain('owner');
    expect(r).toContain('admin');
  });

  it('空角色非外部 → employee', () => {
    expect(resolveNavRoles([], { fetched: true })).toEqual(['employee']);
  });

  it('数据库自定义角色按权限获得内网管理导航', () => {
    expect(resolveNavRoles(['custom_editor'], {
      fetched: true,
      permissions: ['intranet.manage'],
    })).toContain('intranet_editor');
  });

  it('经销商 dealer_sales/dealer_admin → dealer 视图, 绝不 employee (防内部模块泄露)', () => {
    expect(resolveNavRoles(['dealer_sales'], { fetched: true })).toEqual(['dealer']);
    expect(resolveNavRoles(['dealer_admin'], { fetched: true })).toEqual(['dealer']);
    const r = resolveNavRoles(['dealer_sales'], { fetched: true });
    expect(r).not.toContain('employee');
  });

  it('经销商 + 内部混合 → 取内部 (向上聚合)', () => {
    expect(resolveNavRoles(['employee', 'dealer_sales'], { fetched: true })).toEqual(['employee']);
  });
});

describe('PMS 导航 · 经销商可见性', () => {
  const pms = NAV_MODULES.find((m) => m.id === 'pms')!;

  it('PMS 模块对 dealer 可见', () => {
    expect(isVisible(pms.visibleTo, ['dealer'])).toBe(true);
  });

  it('经销商可见渠道相关项 (驾驶舱/工程项目/合同/在线订货)', () => {
    const dealerItems = pms.items.filter((i) => isVisible(i.visibleTo, ['dealer'])).map((i) => i.href);
    expect(dealerItems).toContain('/pms/cockpit');
    expect(dealerItems).toContain('/pms/projects');
    expect(dealerItems).toContain('/pms/contracts');
    expect(dealerItems).toContain('/pms/dealer-orders');
  });

  it('经销商不可见总部专属项 (业绩目标/经销商档案/健康分/告警中心)', () => {
    const dealerItems = pms.items.filter((i) => isVisible(i.visibleTo, ['dealer'])).map((i) => i.href);
    expect(dealerItems).not.toContain('/pms/performance-targets');
    expect(dealerItems).not.toContain('/pms/dealer-orgs');
    expect(dealerItems).not.toContain('/pms/dealer-health');
    expect(dealerItems).not.toContain('/pms/alerts');
  });

  it('内部员工仍可见全部 PMS 项 (总部项不被误伤)', () => {
    const empItems = pms.items.filter((i) => isVisible(i.visibleTo, ['employee'])).map((i) => i.href);
    expect(empItems).toContain('/pms/performance-targets');
    expect(empItems).toContain('/pms/cockpit');
  });
});
