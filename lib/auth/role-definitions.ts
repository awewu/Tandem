import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/infra/drizzle-client';
import { roleDefinition } from '@/lib/infra/drizzle-schema';
import { isDatabaseMode } from '@/lib/infra/storage-mode';
import type { Permission } from './permissions';

export interface RoleDefinition {
  key: string;
  name: string;
  description: string;
  kind: 'internal' | 'external';
  permissions: Permission[];
  system: boolean;
  enabled: boolean;
  sortOrder: number;
  tenantId: string;
}

export const DEFAULT_ROLE_DEFINITIONS: Omit<RoleDefinition, 'tenantId'>[] = [
  { key: 'owner', name: '公司主', description: '公司最高权限，不能停用或移除', kind: 'internal', permissions: ['roles.manage', 'organization.manage', 'users.manage', 'intranet.manage'], system: true, enabled: true, sortOrder: 0 },
  { key: 'admin', name: '系统管理员', description: '系统、人员和业务后台管理', kind: 'internal', permissions: ['roles.manage', 'organization.manage', 'users.manage', 'intranet.manage'], system: true, enabled: true, sortOrder: 10 },
  { key: 'champion', name: '推广大使', description: '推广与跨部门业务运营', kind: 'internal', permissions: ['organization.manage', 'users.manage', 'intranet.manage'], system: true, enabled: true, sortOrder: 20 },
  { key: 'intranet_editor', name: '内网内容编辑', description: '仅维护企业内网内容', kind: 'internal', permissions: ['intranet.manage'], system: true, enabled: true, sortOrder: 30 },
  { key: 'steward', name: 'HR / 管家', description: '组织数据与治理审核', kind: 'internal', permissions: ['organization.manage', 'users.manage', 'intranet.manage'], system: true, enabled: true, sortOrder: 40 },
  { key: 'manager', name: '主管', description: '团队管理与业务审批', kind: 'internal', permissions: [], system: true, enabled: true, sortOrder: 50 },
  { key: 'employee', name: '员工', description: '普通内部员工', kind: 'internal', permissions: [], system: true, enabled: true, sortOrder: 60 },
  { key: 'finance', name: '财务', description: '财务口径数据维护', kind: 'internal', permissions: [], system: true, enabled: true, sortOrder: 70 },
  { key: 'internal_staff', name: '内勤', description: '内部运营数据维护', kind: 'internal', permissions: [], system: true, enabled: true, sortOrder: 80 },
  { key: 'guest', name: '访客', description: '短期外部访客', kind: 'external', permissions: [], system: true, enabled: true, sortOrder: 90 },
  { key: 'partner', name: '合作伙伴', description: '长期合作伙伴', kind: 'external', permissions: [], system: true, enabled: true, sortOrder: 100 },
  { key: 'contractor', name: '承包商', description: '项目承包方', kind: 'external', permissions: [], system: true, enabled: true, sortOrder: 110 },
];

export const DEFAULT_ROLE_KEYS = new Set(DEFAULT_ROLE_DEFINITIONS.map((role) => role.key));

export function defaultPermissionsForRoles(roles: readonly string[]): Permission[] {
  const byKey = new Map(DEFAULT_ROLE_DEFINITIONS.map((role) => [role.key, role.permissions]));
  return Array.from(new Set(roles.flatMap((role) => byKey.get(role) ?? [])));
}

export async function ensureDefaultRoleDefinitions(tenantId: string): Promise<void> {
  await db.insert(roleDefinition).values(DEFAULT_ROLE_DEFINITIONS.map((role) => ({ ...role, tenantId }))).onConflictDoNothing();
}

export async function listRoleDefinitions(tenantId: string, includeDisabled = false): Promise<RoleDefinition[]> {
  await ensureDefaultRoleDefinitions(tenantId);
  const where = includeDisabled
    ? eq(roleDefinition.tenantId, tenantId)
    : and(eq(roleDefinition.tenantId, tenantId), eq(roleDefinition.enabled, true));
  return db.select().from(roleDefinition).where(where).orderBy(asc(roleDefinition.sortOrder), asc(roleDefinition.name)) as Promise<RoleDefinition[]>;
}

export async function permissionsForRoles(tenantId: string, roles: readonly string[]): Promise<Permission[]> {
  if (roles.length === 0) return [];
  // Vitest 的 memory store 有意不配置 PostgreSQL；仍使用与迁移完全一致的默认权限。
  if (!isDatabaseMode()) return defaultPermissionsForRoles(roles);
  await ensureDefaultRoleDefinitions(tenantId);
  const rows = await db.select({ permissions: roleDefinition.permissions }).from(roleDefinition).where(and(
    eq(roleDefinition.tenantId, tenantId),
    eq(roleDefinition.enabled, true),
    inArray(roleDefinition.key, [...roles]),
  ));
  return Array.from(new Set(rows.flatMap((row) => row.permissions as Permission[])));
}

export async function roleKeysExist(tenantId: string, keys: readonly string[]): Promise<boolean> {
  if (keys.length === 0) return true;
  const roles = await listRoleDefinitions(tenantId);
  const available = new Set(roles.map((role) => role.key));
  return keys.every((key) => available.has(key));
}
