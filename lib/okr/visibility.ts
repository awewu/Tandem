/**
 * lib/okr/visibility.ts · OKR 读权限范围解析 (按部门模型, 2026-06-17)
 *
 * 决策 (用户确认 · 缺汇报链数据, 改用部门归属):
 *   - 老板   (owner / admin)         → 看全部 (返回 null = 不过滤)
 *   - 部门领导 (manager / steward)   → 看本部门所有成员的 OKR
 *   - 其他   (employee / champion …) → 只看自己 (ownerId === self)
 *
 * 数据来源:
 *   - 角色: AuthContext.roles
 *   - 部门: AuthUser.departmentId (drizzle-store 从 KvStore auth_user_extras 合成)
 *
 * 返回:
 *   - null            → 无限制 (老板), 调用方不过滤
 *   - Set<ownerId>    → 仅这些 ownerId 的 OKR 可见 (部门领导含本部门成员; 员工仅自己)
 */

import type { AuthContext } from '../auth/require-auth';
import type { TandemStore } from '../storage/repository';

/** 看全部的角色 (跨部门) */
export const OKR_BOSS_ROLES = ['owner', 'admin'] as const;
/** 看本部门的角色 */
export const OKR_DEPT_LEADER_ROLES = ['manager', 'steward'] as const;

/**
 * 解析调用方可见的 OKR ownerId 集合.
 * @returns null = 全部可见 (不过滤); 否则为可见 ownerId 的 Set.
 */
export async function resolveOkrVisibleOwnerIds(
  auth: AuthContext,
  store: TandemStore,
): Promise<Set<string> | null> {
  // demo 回退 (仅 dev/e2e) 有全角色, 视为老板.
  if (auth.demo) return null;
  if (auth.roles.some((r) => OKR_BOSS_ROLES.includes(r as never))) return null;

  const isLeader = auth.roles.some((r) => OKR_DEPT_LEADER_ROLES.includes(r as never));
  if (!isLeader) {
    // 普通员工: 只看自己.
    return new Set([auth.userId]);
  }

  // 部门领导: 解析本部门 → 本部门全体成员的 ownerId.
  const me = await store.auth.users.findById(auth.userId);
  const dept = me?.departmentId ?? null;
  if (!dept) {
    // 无部门归属 → 退化为只看自己 (防越权看全公司).
    return new Set([auth.userId]);
  }
  const users = await store.auth.users.list({ tenantId: auth.tenantId });
  const ids = users.filter((u) => (u.departmentId ?? null) === dept).map((u) => u.id);
  ids.push(auth.userId); // 自己一定可见
  return new Set(ids);
}
