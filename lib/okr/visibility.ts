/**
 * lib/okr/visibility.ts · OKR 读权限范围解析 (全员公开读, 2026-07-20)
 *
 * 决策:
 *   - OKR 作为对齐信息, 在同租户内默认全员公开可读。
 *   - 跨租户隔离由 API 层 withTenantScope 负责。
 *   - 写权限仍由各写路由独立校验 (owner / admin / demo 等), 不在这里放宽。
 *
 * 数据来源:
 *   - AuthContext.tenantId 由调用 API 用于租户隔离。
 *
 * 返回:
 *   - null → 同租户内不按 ownerId 过滤
 */

import type { AuthContext } from '../auth/require-auth';
import type { TandemStore } from '../storage/repository';

/** 看全部的角色 (跨部门) */
export const OKR_BOSS_ROLES = ['owner', 'admin'] as const;
/**
 * 目标审批漏斗中可作为 approver (通过/打回/暂停/完成) 的角色.
 * 与前端 app/okr/page.tsx ApprovalActions 口径一致 (单一真值, 防散落字面量).
 */
export const OKR_APPROVER_ROLES = ['manager', 'steward', 'admin', 'champion', 'owner'] as const;

/** 该角色集是否含 approver 权限 */
export function hasOkrApproverRole(roles: string[]): boolean {
  return roles.some((r) => OKR_APPROVER_ROLES.includes(r as never));
}

/**
 * 解析调用方可见的 OKR ownerId 集合.
 * @returns null = 同租户全员可见; Set 形状仅为兼容旧调用方.
 */
export async function resolveOkrVisibleOwnerIds(
  auth: AuthContext,
  _store: TandemStore,
): Promise<Set<string> | null> {
  void auth;
  void _store;
  return null;
}
