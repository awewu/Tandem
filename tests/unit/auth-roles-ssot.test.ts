/**
 * tests/unit/auth-roles-ssot.test.ts
 *
 * 锁定 P0 角色 SSOT 收口 (2026-06-08 权限复盘修复):
 *   背景: kpi-perms / persona / 360 / redactor / governance 曾散落引用
 *         SSOT 不存在的角色字面量 ('hr' / 'finance' / 'internal_staff' / 'governance'),
 *         导致真实 HR 用户 (实际角色 'steward') 永远匹配不到权限 → HR 功能静默失效.
 *
 *   修复: 'hr'/'governance' 收敛到 'steward'; 'finance'/'internal_staff' 正式注册进 SSOT;
 *         端点改用语义组 DATA_STEWARD_ROLES.
 *
 *   本测试: 防回归 —
 *     1. 语义角色组只含合法 SSOT 角色
 *     2. KPI 权限矩阵按 SSOT 角色生效 (steward=HR 拿全三位)
 *     3. 旧幽灵字面量 'hr' 不再具特权
 */

import { describe, expect, it } from 'vitest';

import { ROLES, isRole, DATA_STEWARD_ROLES, INTERNAL_ROLES } from '@/lib/auth/roles';
import { hasKpiPermission, canManualEntry } from '@/lib/auth/kpi-perms';
import type { AuthContext } from '@/lib/auth/require-auth';

function ctx(roles: string[]): AuthContext {
  return {
    userId: 'u1',
    email: 'u1@tandem.local',
    tenantId: 'default',
    roles,
    mfaVerified: true,
    demo: false,
  };
}

describe('SSOT 角色组 · 只含合法角色', () => {
  it('DATA_STEWARD_ROLES 每个元素都是登记过的 Role', () => {
    for (const r of DATA_STEWARD_ROLES) expect(isRole(r)).toBe(true);
  });
  it('DATA_STEWARD_ROLES = owner + admin + steward', () => {
    expect([...DATA_STEWARD_ROLES].sort()).toEqual(['admin', 'owner', 'steward']);
  });
  it("旧幽灵角色 'hr' 不在 SSOT", () => {
    expect(ROLES.includes('hr' as never)).toBe(false);
  });
  it("'finance' / 'internal_staff' 已正式注册为内部角色", () => {
    expect((INTERNAL_ROLES as readonly string[]).includes('finance')).toBe(true);
    expect((INTERNAL_ROLES as readonly string[]).includes('internal_staff')).toBe(true);
  });
});

describe('KPI 权限矩阵 · 按 SSOT 角色生效', () => {
  it('steward (HR/数据管家) 拿满全三位', () => {
    const c = ctx(['steward']);
    expect(hasKpiPermission(c, 'kpi.subject_admin')).toBe(true);
    expect(hasKpiPermission(c, 'kpi.write')).toBe(true);
    expect(hasKpiPermission(c, 'kpi.manual_entry')).toBe(true);
  });
  it('owner / admin 满权', () => {
    for (const role of ['owner', 'admin']) {
      const c = ctx([role]);
      expect(hasKpiPermission(c, 'kpi.subject_admin')).toBe(true);
      expect(hasKpiPermission(c, 'kpi.write')).toBe(true);
      expect(hasKpiPermission(c, 'kpi.manual_entry')).toBe(true);
    }
  });
  it('finance: 科目管理 + 补录, 但无 write', () => {
    const c = ctx(['finance']);
    expect(hasKpiPermission(c, 'kpi.subject_admin')).toBe(true);
    expect(hasKpiPermission(c, 'kpi.manual_entry')).toBe(true);
    expect(hasKpiPermission(c, 'kpi.write')).toBe(false);
  });
  it('internal_staff: 仅补录', () => {
    const c = ctx(['internal_staff']);
    expect(hasKpiPermission(c, 'kpi.manual_entry')).toBe(true);
    expect(hasKpiPermission(c, 'kpi.write')).toBe(false);
    expect(hasKpiPermission(c, 'kpi.subject_admin')).toBe(false);
  });
  it('manager: 仅目标设定 write', () => {
    const c = ctx(['manager']);
    expect(hasKpiPermission(c, 'kpi.write')).toBe(true);
    expect(hasKpiPermission(c, 'kpi.manual_entry')).toBe(false);
  });
  it('employee: 无任何 KPI 权限', () => {
    const c = ctx(['employee']);
    expect(hasKpiPermission(c, 'kpi.subject_admin')).toBe(false);
    expect(hasKpiPermission(c, 'kpi.write')).toBe(false);
    expect(hasKpiPermission(c, 'kpi.manual_entry')).toBe(false);
  });
  it("旧 'hr' 字面量已失效 (真实 HR 须用 steward)", () => {
    const c = ctx(['hr']);
    expect(hasKpiPermission(c, 'kpi.manual_entry')).toBe(false);
  });
});

describe('canManualEntry · CHARTER §2.1 不能补录自己', () => {
  it('finance 可补录他人 KPI', () => {
    expect(canManualEntry(ctx(['finance']), { assigneeId: 'someone-else' }).ok).toBe(true);
  });
  it('finance 不能补录自己的 KPI (自评禁令)', () => {
    const res = canManualEntry(ctx(['finance']), { assigneeId: 'u1' });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('self_edit_forbidden');
  });
  it('无补录权限的 employee 直接拒', () => {
    const res = canManualEntry(ctx(['employee']), { assigneeId: 'other' });
    expect(res.ok).toBe(false);
    expect(res.reason).toContain('permission_denied');
  });
});
