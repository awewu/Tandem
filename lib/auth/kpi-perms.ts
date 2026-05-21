/**
 * KPI 权限位映射 · CHARTER-KPI-TTI §2.1 + §2.4
 *
 * 三个独立权限位 (KPI 数据通道分级管控):
 *   - kpi.subject_admin : 科目主数据 CRUD (科目体系动态优化)
 *   - kpi.write         : 通道 A 目标设定 (target/weight/cycle setup)
 *   - kpi.manual_entry  : 通道 C 人工补录 (财务/HR/内勤, ERP 未覆盖指标)
 *
 * 角色 → 权限映射 (默认): admin/hr 拥有全部三位; finance 缺 kpi.write;
 * manager 仅 kpi.write; internal_staff 仅 kpi.manual_entry.
 *
 * 绝对禁止改 KPI 的角色 (CHARTER §2.1): 被考核员工本人 / 直属主管 / 高管 (改 actuals).
 */

import type { AuthContext } from './require-auth';

export type KpiPermission = 'kpi.subject_admin' | 'kpi.write' | 'kpi.manual_entry';

/**
 * 角色 → 权限位映射. 改这里 = 改全局 KPI 数据通道权限边界.
 */
const ROLE_PERMS: Record<string, KpiPermission[]> = {
  admin: ['kpi.subject_admin', 'kpi.write', 'kpi.manual_entry'],
  hr: ['kpi.subject_admin', 'kpi.write', 'kpi.manual_entry'],
  finance: ['kpi.subject_admin', 'kpi.manual_entry'],
  internal_staff: ['kpi.manual_entry'],
  manager: ['kpi.write'],
};

export function hasKpiPermission(ctx: AuthContext, perm: KpiPermission): boolean {
  // demo 模式 (e2e/dev) 视为全权
  if (ctx.demo) return true;
  for (const role of ctx.roles) {
    const perms = ROLE_PERMS[role];
    if (perms?.includes(perm)) return true;
  }
  return false;
}

/**
 * 通道 C 二级守卫: 即便有 kpi.manual_entry 权限, 也不能改自己的 KPI.
 * (CHARTER §2.1 绝对禁止 1: 被考核员工本人, 即使是 HR/财务身份)
 */
export function canManualEntry(
  ctx: AuthContext,
  kpi: { assigneeId: string },
): { ok: boolean; reason?: string } {
  if (!hasKpiPermission(ctx, 'kpi.manual_entry')) {
    return { ok: false, reason: 'permission_denied: kpi.manual_entry required' };
  }
  if (kpi.assigneeId === ctx.userId && !ctx.demo) {
    return { ok: false, reason: 'self_edit_forbidden: 不能补录自己的 KPI (CHARTER §2.1)' };
  }
  return { ok: true };
}
