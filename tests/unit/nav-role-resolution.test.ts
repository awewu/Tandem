/**
 * resolveNavRoles · 两层用户导航可见性解析 (外部用户不串内部 nav)
 *
 * 关键不变量: 纯外部角色 (guest/partner/contractor) 绝不回落到 employee,
 * 否则经销商/申请注册人会在导航里看到内部 OKR/事半等模块.
 */

import { describe, it, expect } from 'vitest';
import { activeModuleId, isGlobalNavEntry, NAV_MODULES, resolveNavRoles } from '@/components/nav-modules';

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
});

describe('nav module ownership', () => {
  it('战略项目 · 三省六部 归属议事模块, 不归 IM', () => {
    expect(activeModuleId('/governance/three-departments')).toBe('tandem');
    expect(activeModuleId('/strategic-projects')).toBe('tandem');
    expect(activeModuleId('/strategic-projects/v3')).toBe('tandem');
    const im = NAV_MODULES.find((m) => m.id === 'im')!;
    const tandem = NAV_MODULES.find((m) => m.id === 'tandem')!;
    expect(im.items.some((item) => item.href === '/governance/three-departments')).toBe(false);
    expect(tandem.items.some((item) => item.href === '/governance/three-departments')).toBe(true);
    expect(tandem.items.some((item) => item.href === '/strategic-projects')).toBe(true);
  });

  it('PMS 只能从首页跳板进入, 不出现在全局主导航', () => {
    expect(activeModuleId('/pms')).toBe('pms');
    expect(activeModuleId('/pms/dealer-orgs')).toBe('pms');
    const pms = NAV_MODULES.find((m) => m.id === 'pms')!;
    expect(pms.pathPrefixes).toContain('/pms');
    expect(isGlobalNavEntry(pms)).toBe(false);
  });
});
