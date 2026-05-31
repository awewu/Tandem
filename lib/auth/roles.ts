/**
 * Roles SSOT · 全代码唯一角色枚举来源
 *
 * 设计:
 *   - 内部角色: 公司员工/管理层, 默认可访问全部三板块 (事半/拿捏/搭子)
 *   - 外部角色: 客户/合作伙伴/承包商, 受 lib/auth/module-scope.ts 限制 — 默认拒绝事半
 *   - 系统角色: 仅 bootstrap / 测试 / demo fallback 使用
 *
 * 任何 role 字符串新增, 必须先来这个文件登记. 禁止散落字面量.
 */

export const INTERNAL_ROLES = [
  'owner',     // 公司主, env bootstrap 创建, 不可降级
  'admin',     // IT/系统管理员
  'manager',   // 主管 / 管理层
  'employee',  // 普通员工 (默认)
  'steward',   // HR / 数据管家
  'champion',  // 业务冠军 / 推广大使
] as const;

export const EXTERNAL_ROLES = [
  'guest',     // 临时访客 (短期, 只读)
  'partner',   // 长期合作伙伴 / 客户接口人
  'contractor',// 承包商 / 乙方 (按项目)
] as const;

export const ROLES = [...INTERNAL_ROLES, ...EXTERNAL_ROLES] as const;

export type InternalRole = (typeof INTERNAL_ROLES)[number];
export type ExternalRole = (typeof EXTERNAL_ROLES)[number];
export type Role = (typeof ROLES)[number];

const INTERNAL_SET: ReadonlySet<string> = new Set(INTERNAL_ROLES);
const EXTERNAL_SET: ReadonlySet<string> = new Set(EXTERNAL_ROLES);
const ROLES_SET: ReadonlySet<string> = new Set(ROLES);

export function isRole(s: string): s is Role {
  return ROLES_SET.has(s);
}

export function isInternalRole(s: string): s is InternalRole {
  return INTERNAL_SET.has(s);
}

export function isExternalRole(s: string): s is ExternalRole {
  return EXTERNAL_SET.has(s);
}

/** 任一 role 是外部角色 → 该用户被视为外部协作者 (走 module-scope 限制) */
export function hasExternalRole(roles: readonly string[]): boolean {
  return roles.some((r) => EXTERNAL_SET.has(r));
}

/** 任一 role 是内部角色 → 该用户被视为正式员工 */
export function hasInternalRole(roles: readonly string[]): boolean {
  return roles.some((r) => INTERNAL_SET.has(r));
}

/** Demo / 测试 fallback 用的全角色集 (生产不可达) */
export const DEMO_FULL_ROLES: Role[] = [
  'admin',
  'manager',
  'employee',
  'champion',
  'steward',
];

/** SSO 自助注册默认角色 (公司邮箱白名单激活) */
export const DEFAULT_EMPLOYEE_ROLES: Role[] = ['employee'];

/** Owner bootstrap 默认角色 */
export const OWNER_BOOTSTRAP_ROLES: Role[] = ['owner', 'admin'];

/** 外部申请审批默认角色 (Owner 可在审批时改写) */
export const DEFAULT_EXTERNAL_ROLES: Role[] = ['guest'];

/** 一段中文标签, 用于 admin UI 展示 */
export const ROLE_LABELS: Record<Role, string> = {
  owner: '公司主',
  admin: '系统管理员',
  manager: '主管',
  employee: '员工',
  steward: 'HR / 管家',
  champion: '冠军',
  guest: '访客',
  partner: '合作伙伴',
  contractor: '承包商',
};
