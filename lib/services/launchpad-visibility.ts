/**
 * Launchpad visibility — 纯函数 (无 DB / Node 依赖), 便于单测与 Edge 复用.
 *
 * 决定某 launchpad 应用对某 viewer 是否可见. 两层用户模型 (MANIFESTO):
 *
 *   内部员工 (owner/admin/manager/...):
 *     - role gate: app.visibleToRoles 非空时需命中; 空 = 全员可见 (默认开放)
 *     - dept gate: app.visibleTo 非空时需命中部门
 *
 *   纯外部用户 (经销商/合作伙伴/申请注册人, guest/partner/contractor 且无内部角色):
 *     - **opt-in 白名单**: 仅当 app.visibleToRoles 显式包含其某个外部角色才可见.
 *       空 visibleToRoles = 内部默认开放 = 外部不可见. (= "只看到后台授权的部分信息")
 *     - 不参与部门门 (外部用户无公司部门归属).
 *
 * 通用前置: 仅 active 应用; 必须同租户.
 */

import type { LaunchpadApp } from '@/lib/types/launchpad';
import { hasExternalRole, hasInternalRole } from '@/lib/auth/roles';

export interface ViewerCtx {
  userId: string;
  roles: string[];
  /** 用户所在部门 ID 列表 (从 org tree 解析) */
  deptIds?: string[];
  tenantId: string;
}

export function isAppVisibleTo(app: LaunchpadApp, viewer: ViewerCtx): boolean {
  if (app.status !== 'active') return false;
  if (app.tenantId !== viewer.tenantId) return false;

  // 纯外部用户: 白名单制 — 必须被显式授权某个外部角色, 否则一律不可见.
  const pureExternal = hasExternalRole(viewer.roles) && !hasInternalRole(viewer.roles);
  if (pureExternal) {
    if (app.visibleToRoles.length === 0) return false; // 未授权 = 不可见
    return viewer.roles.some((r) => app.visibleToRoles.includes(r));
  }

  // 内部员工: role gate (空 = 全员可见)
  if (app.visibleToRoles.length > 0) {
    const ok = viewer.roles.some((r) => app.visibleToRoles.includes(r));
    if (!ok) return false;
  }

  // dept gate (空数组 = 全员可见)
  if (app.visibleTo.length > 0) {
    const userDepts = viewer.deptIds ?? [];
    const ok = userDepts.some((d) => app.visibleTo.includes(d));
    if (!ok) return false;
  }

  return true;
}
