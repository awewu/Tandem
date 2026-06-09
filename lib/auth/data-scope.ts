/**
 * Data Scope · 数据访问边界 SSOT (闸③ · MANIFESTO §19.3)
 *
 * 把"谁能看哪一级数据"从散落在各 skill 内的自觉判断, 收敛成唯一可测的纯逻辑:
 *
 *   级别 (level):
 *     personal   — 个人数据 (本人 OKR / Persona / 决议)
 *     team       — 团队数据
 *     department — 部门数据
 *     company    — 全公司数据
 *
 *   规则:
 *     1. 访问**他人**的 personal/team 数据 → 需特权角色 (manager/steward/admin/owner)
 *     2. 访问 department / company 级数据 → 需特权角色
 *     3. 访问**本人** personal 数据 / 未指定目标的 personal/team → 放行
 *
 * 纯函数, 无 IO。角色查询由调用方 (gateway / registry) 负责注入。
 */

import type { Role } from './roles';

export type DataScopeLevel = 'personal' | 'team' | 'department' | 'company';

/**
 * 可越过本人边界、访问他人 / 部门 / 公司数据的特权角色组。
 * 收敛自 skill-gateway 旧字面量 ['manager','steward','admin','owner']。
 */
export const DATA_SCOPE_PRIVILEGED_ROLES: Role[] = ['manager', 'steward', 'admin', 'owner'];

const PRIVILEGED_SET: ReadonlySet<string> = new Set(DATA_SCOPE_PRIVILEGED_ROLES);

/** 是否拥有跨边界数据特权 */
export function hasDataPrivilege(roles: readonly string[]): boolean {
  return roles.some((r) => PRIVILEGED_SET.has(r));
}

export interface DataScopeCheckInput {
  /** 调用方 userId */
  actorUserId: string;
  /** 调用方角色集 */
  actorRoles: readonly string[];
  /** 涉及的数据级别 (缺省 personal) */
  level?: DataScopeLevel;
  /**
   * 涉及的目标用户 (若本次访问指向某个具体用户的数据)。
   * - 等于 actorUserId → 本人, 放行
   * - 不等 → 跨用户, personal/team 需特权
   * - 不传 → 不做跨用户判定 (仅按 level 判定)
   */
  targetUserId?: string;
}

export interface DataScopeCheckResult {
  allowed: boolean;
  /** 命中级别 (回显, 审计用) */
  level: DataScopeLevel;
  /** 拒绝原因 (allowed=false 时) */
  reason?: string;
}

/**
 * 数据边界判定 (唯一入口)。
 */
export function checkDataScope(input: DataScopeCheckInput): DataScopeCheckResult {
  const level = input.level ?? 'personal';
  const privileged = hasDataPrivilege(input.actorRoles);

  // department / company: 一律需特权
  if (level === 'department' || level === 'company') {
    if (!privileged) {
      return {
        allowed: false,
        level,
        reason: `无权访问数据级别 ${level}: 需内部管理/审计角色 (${DATA_SCOPE_PRIVILEGED_ROLES.join('/')}) · MANIFESTO §19.3`,
      };
    }
    return { allowed: true, level };
  }

  // personal / team: 访问他人数据需特权; 本人 / 未指定目标 → 放行
  if (input.targetUserId && input.targetUserId !== input.actorUserId) {
    if (!privileged) {
      return {
        allowed: false,
        level,
        reason: `无权访问他人 (${input.targetUserId}) 的 ${level} 数据: 仅本人或管理/审计角色可见 · MANIFESTO §19.3`,
      };
    }
  }
  return { allowed: true, level };
}
