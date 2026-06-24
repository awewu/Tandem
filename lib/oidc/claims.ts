/**
 * lib/oidc/claims.ts · 用户 → OIDC claims 映射
 *
 * 把 Tandem 的身份 + 组织结构体系抽成标准/自定义 claims, 供接入方按 scope 获取:
 *   - profile: name / preferred_username / job_title / updated_at
 *   - email:   email / email_verified
 *   - roles:   roles[] / tenant            (Tandem 角色 SSOT)
 *   - org:     department / department_id / department_path / manager_id /
 *              manager_name / employee_id / job_title
 *
 * 这是"组织结构公共服务"的核心: 其他项目据此对齐通讯录与权限.
 */

import { getStore } from '@/lib/storage/repository';
import { listDepts, type HrDept } from '@/lib/org/departments';
import type { AuthUser } from '@/lib/storage/repository';

export interface OidcClaims {
  sub: string;
  [key: string]: unknown;
}

function deptPath(deptId: string | null | undefined, depts: HrDept[]): string | undefined {
  if (!deptId) return undefined;
  const byId = new Map(depts.map((d) => [d.id, d]));
  const parts: string[] = [];
  let cur = byId.get(deptId);
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return parts.length ? parts.join(' / ') : undefined;
}

/**
 * 按 scope 构造 claims. 始终包含 sub.
 * scopes: 已解析的 scope 数组 (含 openid).
 */
export async function buildClaimsForUser(
  user: AuthUser,
  scopes: string[],
  depts?: HrDept[],
): Promise<OidcClaims> {
  const claims: OidcClaims = { sub: user.id };
  const has = (s: string) => scopes.includes(s);

  const needDepts = has('org');
  const deptList = needDepts ? depts ?? (await listDepts(user.tenantId ?? 'default')) : [];

  if (has('profile')) {
    claims.name = user.name;
    claims.preferred_username = user.email?.split('@')[0] ?? user.id;
    if (user.jobTitle) claims.job_title = user.jobTitle;
  }

  if (has('email')) {
    claims.email = user.email;
    claims.email_verified = !!user.emailVerifiedAt;
  }

  if (has('roles')) {
    claims.roles = user.roles ?? [];
    claims.tenant = user.tenantId ?? 'default';
  }

  if (has('org')) {
    claims.department_id = user.departmentId ?? null;
    claims.department_path = deptPath(user.departmentId, deptList) ?? null;
    const dept = user.departmentId ? deptList.find((d) => d.id === user.departmentId) : undefined;
    claims.department = dept?.name ?? null;
    claims.manager_id = user.managerId ?? null;
    if (user.managerId) {
      const mgr = await getStore().auth.users.findById(user.managerId);
      claims.manager_name = mgr?.name ?? null;
    }
    claims.employee_id = user.employeeId ?? null;
    if (user.jobTitle && claims.job_title === undefined) claims.job_title = user.jobTitle;
  }

  return claims;
}

/** 便捷: 按 userId 取 claims (token / userinfo 端点用) */
export async function buildClaimsForUserId(
  userId: string,
  scopes: string[],
): Promise<OidcClaims | null> {
  const user = await getStore().auth.users.findById(userId);
  if (!user) return null;
  return buildClaimsForUser(user, scopes);
}
