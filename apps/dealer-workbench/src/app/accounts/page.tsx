'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Check,
  ClipboardList,
  KeyRound,
  LockKeyhole,
  Plus,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  UsersRound,
} from 'lucide-react';
import { adminRbac, adminUsers, auditLogs, auth } from '../../lib/api';
import {
  StatusPill,
  WorkbenchFilterToolbar,
  WorkbenchPaginationFooter,
  WorkbenchSectionHeader,
  WorkbenchTableShell,
  WorkbenchTableState,
} from '../../components/WorkbenchCore';

type AdminUser = {
  id: string;
  name: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  status: 'active' | 'inactive' | 'suspended';
  identifierMasked: string;
  identifierKind?: 'email' | 'phone' | 'unknown';
  isLocked: boolean;
  dealerId: string | null;
  storeId: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
};

type PermissionItem = {
  code: string;
  name: string;
  domain: string;
  action: string;
  description?: string;
  sortOrder?: number;
};

type RoleItem = {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive';
  isSystem?: boolean;
  permissions: string[];
  userCount?: number;
};

type EffectiveRole = {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
};

type AuditLogRow = {
  id: string;
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  status?: 'success' | 'failed';
  requestId?: string | null;
  traceId?: string | null;
  createdAt: string;
};

type AccountsTab = 'users' | 'roles' | 'audit';

const LEGACY_ROLE_LABEL: Record<string, string> = {
  platform_admin: '平台超级管理员',
  hq_admin: '总部管理员',
  brand_admin: '品牌管理员',
  regional_manager: '区域经理',
  dealer_admin: '经销商管理员',
  store_manager: '门店经理',
  designer: '设计师',
  sales: '销售',
  engineer: '工程师',
  installer: '安装工',
  customer: '客户',
};

const PERMISSION_DOMAIN_LABEL: Record<string, string> = {
  'admin.users': '账号管理',
  'admin.roles': '角色管理',
  'admin.permissions': '权限目录',
  'marketing.content': '营销内容',
  'marketing.campaigns': '营销活动',
  'marketing.assets': '营销物料',
  'product.catalog': '产品库',
  'product.content': '产品内容',
  'brand.library': '品牌库',
  'brand.asset': '品牌资源',
  'analytics.dashboard': '数据看板',
  analytics: '数据分析',
  'system.audit': '审计日志',
};

const PERMISSION_NAME_LABEL: Record<string, string> = {
  'admin.users.view': '查看账号权限页面',
  'admin.users.read': '查看账号列表',
  'admin.users.create': '新建账号',
  'admin.users.update': '编辑账号',
  'admin.users.delete': '删除账号',
  'admin.users.reset_password': '重置账号密码',
  'admin.users.assign_roles': '分配用户角色',
  'admin.roles.view': '查看角色权限页面',
  'admin.roles.read': '查看角色列表',
  'admin.roles.create': '新建角色',
  'admin.roles.update': '编辑角色',
  'admin.roles.assign_permissions': '配置角色权限',
  'admin.permissions.read': '查看权限点目录',
  'marketing.content.view': '查看内容页面',
  'marketing.content.create': '新建内容',
  'marketing.content.update': '编辑内容',
  'marketing.content.delete': '删除内容',
  'marketing.campaigns.view': '查看营销活动',
  'marketing.campaigns.create': '新建营销活动',
  'marketing.campaigns.update': '编辑营销活动',
  'marketing.campaigns.delete': '删除营销活动',
  'marketing.assets.view': '查看营销物料',
  'marketing.assets.create': '新建营销物料',
  'marketing.assets.update': '编辑营销物料',
  'marketing.assets.delete': '删除营销物料',
  'product.catalog.view': '查看产品库页面',
  'product.catalog.read': '查看产品库列表',
  'product.catalog.create': '新增产品',
  'product.catalog.update': '编辑产品',
  'product.catalog.delete': '删除产品',
  'product.catalog.publish': '发布产品内容',
  'product.content.read': '查看产品内容',
  'product.content.create': '新增产品内容',
  'product.content.update': '编辑产品内容',
  'product.content.delete': '删除产品内容',
  'brand.library.view': '查看品牌库页面',
  'brand.library.read': '查看品牌库列表',
  'brand.library.create': '新增品牌库内容',
  'brand.library.update': '编辑品牌库内容',
  'brand.library.delete': '删除品牌库内容',
  'brand.library.publish': '发布品牌库内容',
  'brand.asset.update': '更新品牌资源',
  'analytics.dashboard.view': '查看数据看板',
  'analytics.export': '导出数据',
  'system.audit.read': '查看审计日志',
};

const PERMISSION_ACTION_LABEL: Record<string, string> = {
  view: '页面可见',
  read: '查看',
  create: '新增',
  update: '编辑',
  delete: '删除',
  reset_password: '重置密码',
  assign_roles: '分配角色',
  assign_permissions: '配置权限',
  export: '导出',
  publish: '发布',
};

const AUDIT_MODULE_LABEL: Record<string, string> = {
  'admin.users': '账号管理',
  'admin.roles': '角色权限',
  product: '产品管理',
  'product.catalog': '产品库',
  'product.content': '产品内容',
  'site-news': '资讯管理',
  'site-product-assignment': '官网产品',
  'brand-site': '官网站点',
  'brand-site-basic-settings': '基础信息',
  'marketing.content': '咨询/资讯',
  'marketing.assets': '图片素材',
  'growth.geo': 'GEO 可见度',
  'growth.copy': 'AI 文案',
  'growth.opinion': '舆情雷达',
  'growth.campaigns': '营销活动',
  'growth.materials': '营销物料',
  'brand.library': '品牌发布',
  'diagnosis.consultation': '咨询问诊',
  'crm.consultation': '客户咨询',
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: '新增',
  update: '修改',
  delete: '删除',
  publish: '发布',
  published: '发布',
  draft: '草稿',
  hidden: '隐藏',
  upload: '上传',
  archive: '归档/隐藏',
  restore: '恢复',
  reset_password: '重置密码',
  assign_roles: '分配角色',
  assign_permissions: '配置权限',
};

const AUDIT_MODULE_FILTER_OPTIONS = [
  ['site-news', '资讯管理'],
  ['site-product-assignment', '官网产品'],
  ['brand-site-basic-settings', '基础信息'],
  ['brand-site', '官网站点'],
  ['product', '产品管理'],
  ['product.catalog', '产品库'],
  ['product.content', '产品内容'],
  ['marketing.content', '咨询/资讯'],
  ['marketing.assets', '图片素材'],
  ['growth.geo', 'GEO 可见度'],
  ['growth.copy', 'AI 文案'],
  ['growth.opinion', '舆情雷达'],
  ['growth.campaigns', '营销活动'],
  ['growth.materials', '营销物料'],
  ['brand.library', '品牌发布'],
  ['admin.users', '账号管理'],
  ['admin.roles', '角色权限'],
  ['diagnosis.consultation', '咨询问诊'],
  ['crm.consultation', '客户咨询'],
] as const;

const AUDIT_ACTION_FILTER_OPTIONS = [
  ['create', '新增'],
  ['update', '修改'],
  ['delete', '删除'],
  ['publish', '发布'],
  ['upload', '上传'],
  ['archive', '归档/隐藏'],
  ['restore', '恢复'],
  ['reset_password', '重置密码'],
  ['assign_roles', '分配角色'],
  ['assign_permissions', '配置权限'],
] as const;

const AUDIT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const ACCOUNT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const STATUS_TONE: Record<AdminUser['status'], 'success' | 'neutral' | 'danger'> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
};

const PHONE_PATTERN = /^1[3-9]\d{9}$/;
const ROLE_CODE_PATTERN = /^[a-z0-9_:-]+$/;

function labelForRole(code: string, roles: RoleItem[]) {
  const role = roles.find((item) => item.code === code);
  if (role?.name && role.name !== role.code) return role.name;
  return LEGACY_ROLE_LABEL[code] || code;
}

function displayRoleName(role: Pick<RoleItem, 'code' | 'name'> | Pick<EffectiveRole, 'code' | 'name'>) {
  if (role.name && role.name !== role.code) return role.name;
  return LEGACY_ROLE_LABEL[role.code] || role.name || role.code;
}

function displayRoleDescription(role: RoleItem) {
  if (role.description === 'Backfilled from users.role') return '由历史账号角色自动迁移生成';
  return role.description || '-';
}

function displayPermissionName(permission: PermissionItem) {
  if (permission.name && permission.name !== permission.code) return permission.name;
  return PERMISSION_NAME_LABEL[permission.code] || permission.name || permission.code;
}

function displayPermissionDomain(domain: string) {
  return PERMISSION_DOMAIN_LABEL[domain] || domain;
}

function displayPermissionAction(action: string) {
  return PERMISSION_ACTION_LABEL[action] || '操作权限';
}

function displayAuditModule(resourceType: string) {
  return AUDIT_MODULE_LABEL[resourceType] || resourceType || '-';
}

function displayAuditAction(action: string) {
  const actionKey = action.split('.').pop() || action;
  return AUDIT_ACTION_LABEL[actionKey] || actionKey;
}

function displayAuditSummary(action: string, resourceType: string) {
  return `${displayAuditModule(resourceType)} · ${displayAuditAction(action)}`;
}

function displayAuditResource(log: AuditLogRow) {
  const states = [log.afterState, log.beforeState].filter(Boolean) as Record<string, unknown>[];
  const label = String(log.resourceLabel || '').trim();
  const labelParts = splitAuditLabel(label);
  const resourceName = labelParts[0] || auditResourceTitle(states) || auditResourceFallback(log);
  const action = displayAuditAction(log.action);
  const target = auditTargetLabel(log.resourceType);
  const primary = resourceName && resourceName !== '-' ? `${action}${target}：${resourceName}` : `${action}${target}`;
  const id = String(log.resourceId || '').trim();
  const details = auditDetailParts(states);
  const secondaryParts = [
    ...(details.length ? details : auditDetailsFromLabel(log.resourceType, labelParts.slice(1))),
    id && resourceName !== id ? `ID：${id}` : '',
  ].filter(Boolean);
  return {
    primary,
    secondary: secondaryParts.join(' / '),
  };
}

function auditTargetLabel(resourceType: string) {
  const labels: Record<string, string> = {
    'admin.users': '账号',
    'admin.roles': '角色',
    product: '产品',
    'product.catalog': '产品',
    'product.content': '产品内容',
    'site-news': '资讯',
    'site-product-assignment': '官网产品',
    'brand-site': '品牌站点',
    'brand-site-basic-settings': '官网基础信息',
    'marketing.content': '资讯',
    'marketing.assets': '图片素材',
    'growth.geo': 'GEO 探测',
    'growth.copy': 'AI 文案',
    'growth.opinion': '舆情记录',
    'growth.campaigns': '营销活动',
    'growth.materials': '营销物料',
    'brand.library': '品牌内容',
    'diagnosis.consultation': '咨询问诊',
    'crm.consultation': '客户咨询',
  };
  return labels[resourceType] || displayAuditModule(resourceType);
}

function splitAuditLabel(label: string) {
  return label
    .split(/\s*[·|/]\s*/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function auditDetailsFromLabel(resourceType: string, parts: string[]) {
  if (!parts.length) return [];
  if (resourceType === 'growth.materials') {
    const [materialType, brandSlug, fileFormat] = parts;
    return [
      materialType ? `类型：${materialType}` : '',
      brandSlug ? `品牌：${brandSlug}` : '',
      fileFormat ? `格式：${fileFormat}` : '',
    ].filter(Boolean);
  }
  if (resourceType === 'growth.geo') {
    const [category, brandSlug, engine] = parts;
    return [
      category ? `品类：${category}` : '',
      brandSlug ? `品牌：${brandSlug}` : '',
      engine ? `引擎：${engine}` : '',
    ].filter(Boolean);
  }
  if (resourceType === 'product' || resourceType === 'product.catalog') {
    const [sku] = parts;
    return sku ? [`SKU：${sku}`] : [];
  }
  return parts.map((item) => `信息：${item}`);
}

function auditDetailParts(states: Record<string, unknown>[]) {
  for (const state of states) {
    const current = auditDetailsFromObject(state);
    if (current.length) return current;
    const nested = auditNestedDetails(state);
    if (nested.length) return nested;
  }
  return [];
}

function auditNestedDetails(state: Record<string, unknown>) {
  const queue = [state];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const details = auditDetailsFromObject(current);
    if (details.length) return details;
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 8)) {
          if (item && typeof item === 'object') queue.push(item as Record<string, unknown>);
        }
      } else if (value && typeof value === 'object') {
        queue.push(value as Record<string, unknown>);
      }
    }
  }
  return [];
}

function auditDetailsFromObject(value: Record<string, unknown>) {
  return [
    labeledAuditText('问题', value, ['question']),
    labeledAuditText('引擎', value, ['engine']),
    labeledAuditText('类型', value, ['materialType', 'category', 'kind', 'type']),
    labeledAuditText('品牌', value, ['brandSlug', 'brand']),
    labeledAuditText('渠道', value, ['channel']),
    labeledAuditText('格式', value, ['fileFormat', 'mimeType']),
    labeledAuditText('版本', value, ['versionLabel']),
    labeledAuditText('SKU', value, ['sku']),
    labeledAuditText('型号', value, ['model']),
    labeledAuditText('路径', value, ['publicSlug', 'slug']),
    labeledAuditText('AIVS', value, ['aivs']),
  ].filter(Boolean);
}

function labeledAuditText(label: string, value: Record<string, unknown>, keys: string[]) {
  const text = firstAuditText(value, keys);
  return text ? `${label}：${text}` : '';
}

function auditResourceFallback(log: AuditLogRow) {
  const id = String(log.resourceId || '').trim();
  if (id && !isOpaqueAuditId(id)) return id;
  return id || '-';
}

function auditResourceTitle(states: Record<string, unknown>[]) {
  for (const state of states) {
    const direct = auditTitleFromObject(state);
    if (direct) return direct;
    const nested = auditTitleFromNestedState(state);
    if (nested) return nested;
  }
  return '';
}

function auditTitleFromNestedState(state: Record<string, unknown>) {
  const queue = [state];
  const seen = new Set<unknown>();
  while (queue.length) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const title = auditTitleFromObject(current);
    if (title) return title;
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 8)) {
          if (item && typeof item === 'object') queue.push(item as Record<string, unknown>);
        }
      } else if (value && typeof value === 'object') {
        queue.push(value as Record<string, unknown>);
      }
    }
  }
  return '';
}

function auditTitleFromObject(value: Record<string, unknown>) {
  const name = firstAuditText(value, [
    'displayName',
    'productName',
    'officialName',
    'name',
    'title',
    'headline',
    'filename',
    'fileName',
    'originalName',
    'label',
  ]);
  const detail = firstAuditText(value, ['materialType', 'category', 'sku', 'model', 'code', 'slug', 'publicSlug', 'brandSlug', 'brand', 'channel', 'fileFormat']);
  if (name && detail && name !== detail) return `${name} · ${detail}`;
  if (name) return name;
  return detail && !isOpaqueAuditId(detail) ? detail : '';
}

function firstAuditText(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const raw = value[key];
    if (typeof raw !== 'string' && typeof raw !== 'number') continue;
    const text = String(raw).trim();
    if (text && !isRedactedAuditText(text)) return text;
  }
  return '';
}

function isRedactedAuditText(value: string) {
  return value === '[Redacted]' || value === '[Truncated]';
}

function isOpaqueAuditId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{24}$/i.test(value);
}

function displayContact(user: AdminUser) {
  if (user.identifierMasked && user.identifierMasked !== '***') return user.identifierMasked;
  return '未绑定联系方式';
}

function normalizeRoleCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').replace(/^_+|_+$/g, '');
}

function displayStatus(status: AdminUser['status']) {
  if (status === 'active') return '正常';
  if (status === 'suspended') return '冻结';
  return '停用';
}

function can(mePermissions: string[], permission: string, meRole?: string | null) {
  return meRole === 'platform_admin' || meRole === 'hq_admin' || mePermissions.includes('*') || mePermissions.includes(permission);
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<Center><WorkbenchTableState type="loading" title="正在加载账号权限" /></Center>}>
      <AccountsPageContent />
    </Suspense>
  );
}

function AccountsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const moduleParam = searchParams.get('module') || 'users';
  const [meRole, setMeRole] = useState<string | null>(null);
  const [mePermissions, setMePermissions] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authed, setAuthed] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [tab, setTab] = useState<AccountsTab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditModule, setAuditModule] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditStatus, setAuditStatus] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [rolesPage, setRolesPage] = useState(1);
  const [rolesPageSize, setRolesPageSize] = useState(10);
  const [auditDetail, setAuditDetail] = useState<AuditLogRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [fRole, setFRole] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [assignFor, setAssignFor] = useState<AdminUser | null>(null);
  const [editRoleFor, setEditRoleFor] = useState<RoleItem | null>(null);

  const canViewUsers = can(mePermissions, 'admin.users.view', meRole);
  const canReadUsers = can(mePermissions, 'admin.users.read', meRole);
  const canCreateUser = can(mePermissions, 'admin.users.create', meRole);
  const canUpdateUser = can(mePermissions, 'admin.users.update', meRole);
  const canDeleteUser = can(mePermissions, 'admin.users.delete', meRole);
  const canResetPassword = can(mePermissions, 'admin.users.reset_password', meRole);
  const canAssignRoles = can(mePermissions, 'admin.users.assign_roles', meRole);
  const canViewRoles = can(mePermissions, 'admin.roles.view', meRole);
  const canReadRoles = can(mePermissions, 'admin.roles.read', meRole);
  const canReadPermissions = can(mePermissions, 'admin.permissions.read', meRole);
  const canCreateRole = can(mePermissions, 'admin.roles.create', meRole);
  const canUpdateRole = can(mePermissions, 'admin.roles.update', meRole);
  const canAssignPermissions = can(mePermissions, 'admin.roles.assign_permissions', meRole);
  const canReadAudit = can(mePermissions, 'system.audit.read', meRole);
  const canUseUsersTab = canViewUsers && canReadUsers;
  const canUseRolesTab = canViewRoles && canReadRoles && canReadPermissions;
  const canUseAuditTab = canReadAudit;
  const auditTotalPages = Math.max(Math.ceil(auditTotal / auditPageSize), 1);
  const usersTotalPages = Math.max(Math.ceil(users.length / usersPageSize), 1);
  const rolesTotalPages = Math.max(Math.ceil(roles.length / rolesPageSize), 1);

  const activeRoles = useMemo(() => roles.filter((role) => role.status === 'active'), [roles]);
  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersPageSize;
    return users.slice(start, start + usersPageSize);
  }, [users, usersPage, usersPageSize]);
  const paginatedRoles = useMemo(() => {
    const start = (rolesPage - 1) * rolesPageSize;
    return roles.slice(start, start + rolesPageSize);
  }, [roles, rolesPage, rolesPageSize]);

  const selectTab = useCallback((nextTab: AccountsTab) => {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (nextTab === 'users') nextParams.delete('module');
    else nextParams.set('module', nextTab);
    const query = nextParams.toString();
    router.replace(query ? `/accounts?${query}` : '/accounts', { scroll: false });
  }, [router, searchParams]);

  const loadAuditRows = useCallback(async () => {
    if (!canReadAudit) {
      setAuditRows([]);
      setAuditTotal(0);
      return;
    }
    setAuditLoading(true);
    try {
      const q: Record<string, string> = { page: String(auditPage), limit: String(auditPageSize) };
      if (auditModule) q.module = auditModule;
      if (auditAction) q.action = auditAction;
      if (auditStatus) q.status = auditStatus;
      if (auditSearch) q.search = auditSearch;
      const res = await auditLogs.list(q);
      setAuditRows(res.logs || []);
      setAuditTotal(res.total || 0);
    } finally {
      setAuditLoading(false);
    }
  }, [auditAction, auditModule, auditPage, auditPageSize, auditSearch, auditStatus, canReadAudit]);

  const loadUsers = useCallback(async () => {
    if (!canReadUsers) {
      setUsers([]);
      return;
    }
    const q: Record<string, string> = {};
    if (search) q.search = search;
    if (fRole) q.role = fRole;
    if (fStatus) q.status = fStatus;
    const res = await adminUsers.list(q);
    setUsers(res.users || []);
  }, [canReadUsers, search, fRole, fStatus]);

  const loadRbac = useCallback(async () => {
    const [roleRes, permissionRes] = await Promise.all([
      canReadRoles ? adminRbac.roles() : Promise.resolve({ roles: [] }),
      canReadPermissions ? adminRbac.permissions() : Promise.resolve({ permissions: [] }),
    ]);
    setRoles(roleRes.roles || []);
    setPermissions(permissionRes.permissions || []);
  }, [canReadPermissions, canReadRoles]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      if (!canReadUsers) setUsers([]);
      if (!canReadRoles && !canReadPermissions) {
        setRoles([]);
        setPermissions([]);
      }
      await Promise.all([
        canReadUsers ? loadUsers() : Promise.resolve(),
        canReadRoles || canReadPermissions ? loadRbac() : Promise.resolve(),
        canReadAudit && tab === 'audit' ? loadAuditRows() : Promise.resolve(),
      ]);
    } catch (error) {
      setErr((error as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [canReadAudit, canReadPermissions, canReadRoles, canReadUsers, loadAuditRows, loadRbac, loadUsers, tab]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      let role: string | null = null;
      let effectivePermissions: string[] = [];
      try {
        const me = await auth.me();
        if (cancelled) return;
        role = me.role || null;
        effectivePermissions = me.permissions || [];
        setMeRole(role);
        setMePermissions(effectivePermissions);
        setCurrentUserId(me.id || me.userId || null);
      } catch {
        if (!cancelled) window.location.href = '/?returnUrl=' + encodeURIComponent('/accounts');
        return;
      }

      if (
        !can(effectivePermissions, 'admin.users.view', role)
        && !can(effectivePermissions, 'admin.roles.view', role)
        && !can(effectivePermissions, 'system.audit.read', role)
      ) {
        setAuthed('denied');
        setLoading(false);
        return;
      }

      setAuthed('ok');
      try {
        const canLoadUsers = can(effectivePermissions, 'admin.users.read', role);
        const canLoadRoles = can(effectivePermissions, 'admin.roles.read', role);
        const canLoadPermissions = can(effectivePermissions, 'admin.permissions.read', role);
        const canLoadAudit = can(effectivePermissions, 'system.audit.read', role);
        const q: Record<string, string> = {};
        if (search) q.search = search;
        if (fRole) q.role = fRole;
        if (fStatus) q.status = fStatus;
        const shouldLoadAudit = moduleParam === 'audit' && canLoadAudit;
        const [userRes, roleRes, permissionRes, auditRes] = await Promise.all([
          canLoadUsers ? adminUsers.list(q) : Promise.resolve({ users: [] }),
          canLoadRoles ? adminRbac.roles() : Promise.resolve({ roles: [] }),
          canLoadPermissions ? adminRbac.permissions() : Promise.resolve({ permissions: [] }),
          shouldLoadAudit ? auditLogs.list({ page: '1', limit: String(auditPageSize) }) : Promise.resolve({ logs: [], total: 0 }),
        ]);
        if (cancelled) return;
        setUsers(userRes.users || []);
        setRoles(roleRes.roles || []);
        setPermissions(permissionRes.permissions || []);
        setAuditRows(auditRes.logs || []);
        setAuditTotal(auditRes.total || 0);
        if (moduleParam === 'audit' && canLoadAudit) setTab('audit');
        else if (moduleParam === 'roles' && canLoadRoles && canLoadPermissions) setTab('roles');
        else if (canLoadUsers) setTab('users');
      } catch (error) {
        if (!cancelled) setErr((error as Error).message || '账号权限数据加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [auditPageSize, fRole, fStatus, moduleParam, search]);

  useEffect(() => {
    if (authed !== 'ok') return;
    if (moduleParam === 'audit' && canUseAuditTab && tab !== 'audit') setTab('audit');
    if (moduleParam === 'roles' && canUseRolesTab && tab !== 'roles') setTab('roles');
    if ((moduleParam === 'users' || !moduleParam) && canUseUsersTab && tab !== 'users') setTab('users');
    if (tab === 'users' && !canUseUsersTab && canUseRolesTab) setTab('roles');
    if (tab === 'users' && !canUseUsersTab && !canUseRolesTab && canUseAuditTab) setTab('audit');
    if (tab === 'roles' && !canUseRolesTab && canUseUsersTab) setTab('users');
    if (tab === 'roles' && !canUseRolesTab && !canUseUsersTab && canUseAuditTab) setTab('audit');
    if (tab === 'audit' && !canUseAuditTab && canUseUsersTab) setTab('users');
    if (tab === 'audit' && !canUseAuditTab && !canUseUsersTab && canUseRolesTab) setTab('roles');
  }, [authed, canUseAuditTab, canUseRolesTab, canUseUsersTab, moduleParam, tab]);

  useEffect(() => {
    if (authed !== 'ok' || tab !== 'audit' || !canUseAuditTab) return;
    loadAuditRows().catch((error) => setErr((error as Error).message || '操作日志加载失败'));
  }, [authed, canUseAuditTab, loadAuditRows, tab]);

  useEffect(() => {
    if (tab === 'audit' && auditPage > auditTotalPages) setAuditPage(auditTotalPages);
  }, [auditPage, auditTotalPages, tab]);

  useEffect(() => {
    if (tab === 'users' && usersPage > usersTotalPages) setUsersPage(usersTotalPages);
  }, [tab, usersPage, usersTotalPages]);

  useEffect(() => {
    if (tab === 'roles' && rolesPage > rolesTotalPages) setRolesPage(rolesTotalPages);
  }, [rolesPage, rolesTotalPages, tab]);

  function flash(message: string) {
    setMsg(message);
    window.setTimeout(() => setMsg(''), 2500);
  }

  function reloadAuditFromFirstPage() {
    if (auditPage !== 1) {
      setAuditPage(1);
      return;
    }
    loadAuditRows().catch((error) => setErr((error as Error).message || '操作日志加载失败'));
  }

  async function updateUser(user: AdminUser, patch: Record<string, unknown>) {
    setErr('');
    try {
      await adminUsers.update(user.id, patch);
      flash('账号已更新：' + user.name);
      await loadUsers();
    } catch (error) {
      setErr((error as Error).message || '更新失败');
    }
  }

  async function deleteUser(user: AdminUser) {
    if (user.id === currentUserId) {
      setErr('不能删除当前登录账号');
      return;
    }
    if (!window.confirm(`确认删除账号「${user.name}」？删除后不能在列表中恢复。`)) return;
    setErr('');
    try {
      await adminUsers.remove(user.id);
      flash('账号已删除：' + user.name);
      await loadUsers();
    } catch (error) {
      setErr((error as Error).message || '删除失败');
    }
  }

  if (authed === 'denied') {
    return (
      <Center>
        <WorkbenchTableState
          type="error"
          title="当前账号无权访问账号权限管理"
          description="需要账号或角色管理权限后才能维护用户、角色和权限。"
        />
      </Center>
    );
  }

  if (authed === 'ok' && !canUseUsersTab && !canUseRolesTab && !canUseAuditTab) {
    return (
      <Center>
        <WorkbenchTableState
          type="error"
          title="当前账号缺少账号或角色数据读取权限"
          description="页面入口权限只控制是否可见；列表、配置和日志需要对应 read 权限，避免继续请求无权接口。"
        />
      </Center>
    );
  }

  return (
    <div className="page-container" style={{ display: 'grid', gap: 18 }}>
      <WorkbenchSectionHeader
        eyebrow="营销工作台"
        title="账号权限"
        description="动态维护后台角色、页面可见性与 CRUD 操作权限。用户可绑定多个角色，权限叠加生效。"
        actions={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <a href="/comfort/sites" className="btn btn-outline btn-sm">
              <ArrowLeft size={14} />
              品牌官网
            </a>
            {canCreateRole && (
              <button onClick={() => setShowCreateRole(true)} className="btn btn-outline btn-sm">
                <ShieldCheck size={14} />
                新建角色
              </button>
            )}
            {canCreateUser && (
              <button onClick={() => setShowCreateUser(true)} className="btn btn-brand btn-sm">
                <Plus size={14} />
                新建账号
              </button>
            )}
          </div>
        }
      />

      <div className="card-elevated" style={{ padding: 6, display: 'inline-flex', gap: 4, justifySelf: 'start' }}>
        {canUseUsersTab && <TabButton active={tab === 'users'} onClick={() => selectTab('users')} icon={<UsersRound size={14} />}>账号分配</TabButton>}
        {canUseRolesTab && <TabButton active={tab === 'roles'} onClick={() => selectTab('roles')} icon={<ShieldCheck size={14} />}>角色权限</TabButton>}
        {canUseAuditTab && <TabButton active={tab === 'audit'} onClick={() => selectTab('audit')} icon={<ClipboardList size={14} />}>操作日志</TabButton>}
      </div>

      {err && <Banner tone="error">{err}</Banner>}
      {msg && <Banner tone="success">{msg}</Banner>}

      {tab === 'users' ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <WorkbenchFilterToolbar className="accounts-filter-toolbar">
            <div style={{ position: 'relative', flex: '1 1 360px', minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-tertiary)' }} />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setUsersPage(1); }} onKeyDown={(event) => { if (event.key === 'Enter') { setUsersPage(1); refreshAll(); } }} placeholder="搜索姓名 / 联系方式" className="input" style={{ width: '100%', paddingLeft: 34 }} />
            </div>
            <select value={fRole} onChange={(event) => { setFRole(event.target.value); setUsersPage(1); }} className="select accounts-filter-toolbar__select">
              <option value="">全部角色</option>
              {roles.map((role) => <option key={role.id} value={role.code}>{displayRoleName(role)}</option>)}
            </select>
            <select value={fStatus} onChange={(event) => { setFStatus(event.target.value); setUsersPage(1); }} className="select accounts-filter-toolbar__select">
              <option value="">全部状态</option>
              <option value="active">正常</option>
              <option value="inactive">停用</option>
              <option value="suspended">冻结</option>
            </select>
            <button onClick={() => { setUsersPage(1); refreshAll(); }} className="btn btn-outline btn-sm">
              <Search size={14} />
              查询
            </button>
            <span className="workbench-filter-toolbar__meta">共 {users.length} 个账号</span>
          </WorkbenchFilterToolbar>

          <WorkbenchTableShell>
            <table className="table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>联系方式</th>
                  <th>主角色</th>
                  <th>状态</th>
                  <th>最近登录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><WorkbenchTableState type="loading" title="正在加载账号" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={6}><WorkbenchTableState type="empty" title="暂无账号" description="调整筛选条件后可以重新查询。" /></td></tr>
                ) : paginatedUsers.map((user) => {
                  const canRemoveUser = canDeleteUser && user.id !== currentUserId;
                  const hasUserActions = canUpdateUser || canAssignRoles || canResetPassword || canRemoveUser;

                  return (
                    <tr key={user.id}>
                      <td>{user.name}{user.isLocked && <span className="badge badge-warning" style={{ marginLeft: 6 }}><LockKeyhole size={12} />锁定</span>}</td>
                      <td style={{ ...td, fontFamily: 'var(--font-mono)', color: 'var(--t-secondary)' }}>{displayContact(user)}</td>
                      <td><span className="pill-neutral"><ShieldCheck size={12} />{labelForRole(user.role, roles)}</span></td>
                      <td><StatusPill tone={STATUS_TONE[user.status]}>{displayStatus(user.status)}</StatusPill></td>
                      <td style={{ ...td, color: 'var(--t-tertiary)', fontSize: 12.5 }}>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN') : '-'}</td>
                      <td>
                        {hasUserActions ? (
                          <div className="table-row-actions">
                            {canUpdateUser && (user.status === 'active'
                              ? <button onClick={() => updateUser(user, { status: 'inactive' })} className="btn btn-outline btn-sm"><Ban size={13} />停用</button>
                              : <button onClick={() => updateUser(user, { status: 'active' })} className="btn btn-outline btn-sm"><RotateCcw size={13} />启用</button>)}
                            {canAssignRoles && <button onClick={() => setAssignFor(user)} className="btn btn-outline btn-sm"><UserCog size={13} />分配角色</button>}
                            {canResetPassword && <button onClick={() => setResetFor(user)} className="btn btn-outline btn-sm"><KeyRound size={13} />重置密码</button>}
                            {canRemoveUser && <button onClick={() => deleteUser(user)} className="btn btn-danger btn-sm"><Trash2 size={13} />删除</button>}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--t-tertiary)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </WorkbenchTableShell>
          <WorkbenchPaginationFooter
            currentPage={Math.min(usersPage, usersTotalPages)}
            totalPages={usersTotalPages}
            totalItems={users.length}
            pageSize={usersPageSize}
            pageSizeOptions={ACCOUNT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextPageSize) => {
              setUsersPageSize(nextPageSize);
              setUsersPage(1);
            }}
            onPageChange={setUsersPage}
            onPrevious={loading || usersPage <= 1 ? undefined : () => setUsersPage((current) => Math.max(current - 1, 1))}
            onNext={loading || usersPage >= usersTotalPages ? undefined : () => setUsersPage((current) => Math.min(current + 1, usersTotalPages))}
          />
        </section>
      ) : tab === 'roles' ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <div className="g3" style={{ gap: 12 }}>
            <Metric label="角色" value={String(roles.length)} hint="动态配置" />
            <Metric label="权限点" value={String(permissions.length)} hint="页面与操作" />
            <Metric label="当前权限" value={String(mePermissions.length)} hint="多角色叠加" />
          </div>

          <WorkbenchTableShell>
            <table className="table">
              <thead>
                <tr>
                  <th>角色</th>
                  <th>状态</th>
                  <th>权限数量</th>
                  <th>账号数量</th>
                  <th>说明</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><WorkbenchTableState type="loading" title="正在加载角色" /></td></tr>
                ) : roles.length === 0 ? (
                  <tr><td colSpan={6}><WorkbenchTableState type="empty" title="暂无角色" description="先创建一个角色，再分配页面和操作权限。" /></td></tr>
                ) : paginatedRoles.map((role) => {
                  const canConfigureRole = canUpdateRole || canAssignPermissions;
                  const hasRoleActions = canConfigureRole || canUpdateRole;

                  return (
                    <tr key={role.id}>
                      <td>
                        <div style={{ display: 'grid', gap: 3 }}>
                          <strong style={{ color: 'var(--t-strong)' }}>{displayRoleName(role)}</strong>
                          <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{role.isSystem ? '内置角色' : '自定义角色'}</span>
                        </div>
                      </td>
                      <td><StatusPill tone={role.status === 'active' ? 'success' : 'neutral'}>{role.status === 'active' ? '启用' : '停用'}</StatusPill></td>
                      <td style={td}>{role.permissions.length}</td>
                      <td style={td}>{role.userCount ?? 0}</td>
                      <td style={{ ...td, color: 'var(--t-secondary)', maxWidth: 360 }}>{displayRoleDescription(role)}</td>
                      <td>
                        {hasRoleActions ? (
                          <div className="table-row-actions">
                            {canConfigureRole && (
                              <button onClick={() => setEditRoleFor(role)} className="btn btn-outline btn-sm">
                                <SlidersHorizontal size={13} />
                                配置权限
                              </button>
                            )}
                            {canUpdateRole && (
                              <button
                                onClick={() => updateRoleStatus(role, role.status === 'active' ? 'inactive' : 'active', setErr, flash, refreshAll)}
                                className="btn btn-outline btn-sm"
                              >
                                {role.status === 'active' ? <Ban size={13} /> : <RotateCcw size={13} />}
                                {role.status === 'active' ? '停用' : '启用'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--t-tertiary)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </WorkbenchTableShell>
          <WorkbenchPaginationFooter
            currentPage={Math.min(rolesPage, rolesTotalPages)}
            totalPages={rolesTotalPages}
            totalItems={roles.length}
            pageSize={rolesPageSize}
            pageSizeOptions={ACCOUNT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextPageSize) => {
              setRolesPageSize(nextPageSize);
              setRolesPage(1);
            }}
            onPageChange={setRolesPage}
            onPrevious={loading || rolesPage <= 1 ? undefined : () => setRolesPage((current) => Math.max(current - 1, 1))}
            onNext={loading || rolesPage >= rolesTotalPages ? undefined : () => setRolesPage((current) => Math.min(current + 1, rolesTotalPages))}
          />
        </section>
      ) : (
        <section style={{ display: 'grid', gap: 14 }}>
          <WorkbenchFilterToolbar className="accounts-filter-toolbar">
            <select value={auditModule} onChange={(event) => { setAuditModule(event.target.value); setAuditPage(1); }} className="select accounts-filter-toolbar__select">
              <option value="">全部模块</option>
              {AUDIT_MODULE_FILTER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={auditAction} onChange={(event) => { setAuditAction(event.target.value); setAuditPage(1); }} className="select accounts-filter-toolbar__select">
              <option value="">全部动作</option>
              {AUDIT_ACTION_FILTER_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={auditStatus} onChange={(event) => { setAuditStatus(event.target.value); setAuditPage(1); }} className="select accounts-filter-toolbar__select">
              <option value="">全部结果</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
            </select>
            <div style={{ position: 'relative', flex: '1 1 320px', minWidth: 220 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-tertiary)' }} />
              <input value={auditSearch} onChange={(event) => setAuditSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && reloadAuditFromFirstPage()} placeholder="搜索动作 / 对象 / 操作人" className="input" style={{ width: '100%', paddingLeft: 34 }} />
            </div>
            <button onClick={reloadAuditFromFirstPage} className="btn btn-outline btn-sm">
              <Search size={14} />
              查询
            </button>
            <span className="workbench-filter-toolbar__meta">共 {auditTotal} 条日志</span>
          </WorkbenchFilterToolbar>

          <WorkbenchTableShell>
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>模块</th>
                  <th>动作</th>
                  <th>操作说明</th>
                  <th>操作人</th>
                  <th>结果</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {loading || auditLoading ? (
                  <tr><td colSpan={7}><WorkbenchTableState type="loading" title="正在加载操作日志" /></td></tr>
                ) : auditRows.length === 0 ? (
                  <tr><td colSpan={7}><WorkbenchTableState type="empty" title="暂无操作日志" description="产品、资讯、图片、发布、账号权限等写操作会自动进入这里。" /></td></tr>
                ) : auditRows.map((row) => {
                  const resource = displayAuditResource(row);
                  return (
                  <tr key={row.id}>
                    <td style={{ ...td, color: 'var(--t-secondary)', whiteSpace: 'nowrap' }}>{new Date(row.createdAt).toLocaleString('zh-CN')}</td>
                    <td><span className="pill-neutral">{displayAuditModule(row.resourceType)}</span></td>
                    <td style={td}>{displayAuditAction(row.action)}</td>
                    <td style={{ ...td, maxWidth: 260 }}>
                      <div style={{ display: 'grid', gap: 2 }}>
                        <strong title={resource.primary} style={{ color: 'var(--t-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.primary}</strong>
                        <span title={resource.secondary} style={{ color: 'var(--t-tertiary)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.secondary}</span>
                      </div>
                    </td>
                    <td style={td}>{row.actorName || row.actorUserId || '系统'}</td>
                    <td><StatusPill tone={row.status === 'failed' ? 'danger' : 'success'}>{row.status === 'failed' ? '失败' : '成功'}</StatusPill></td>
                    <td>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setAuditDetail(row)}>
                        <ClipboardList size={13} />
                        查看
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </WorkbenchTableShell>
          <WorkbenchPaginationFooter
            currentPage={Math.min(auditPage, auditTotalPages)}
            totalPages={auditTotalPages}
            totalItems={auditTotal}
            pageSize={auditPageSize}
            pageSizeOptions={AUDIT_PAGE_SIZE_OPTIONS}
            onPageSizeChange={(nextPageSize) => {
              setAuditPageSize(nextPageSize);
              setAuditPage(1);
            }}
            onPageChange={setAuditPage}
            onPrevious={loading || auditLoading || auditPage <= 1 ? undefined : () => setAuditPage((current) => Math.max(current - 1, 1))}
            onNext={loading || auditLoading || auditPage >= auditTotalPages ? undefined : () => setAuditPage((current) => Math.min(current + 1, auditTotalPages))}
          />
        </section>
      )}

      {showCreateUser && <CreateUserModal roles={activeRoles} onClose={() => setShowCreateUser(false)} onDone={() => { setShowCreateUser(false); flash('账号已创建'); refreshAll(); }} onError={setErr} />}
      {showCreateRole && <CreateRoleModal permissions={permissions} onClose={() => setShowCreateRole(false)} onDone={() => { setShowCreateRole(false); flash('角色已创建'); refreshAll(); }} onError={setErr} />}
      {assignFor && <AssignRolesModal user={assignFor} roles={activeRoles} onClose={() => setAssignFor(null)} onDone={() => { setAssignFor(null); flash('用户角色已更新'); refreshAll(); }} onError={setErr} />}
      {editRoleFor && <RolePermissionsModal role={editRoleFor} permissions={permissions} canEditRole={canUpdateRole} canAssignPermissions={canAssignPermissions} onClose={() => setEditRoleFor(null)} onDone={() => { setEditRoleFor(null); flash('角色权限已更新'); refreshAll(); }} onError={setErr} />}
      {resetFor && <ResetModal user={resetFor} onClose={() => setResetFor(null)} onDone={() => { setResetFor(null); flash('密码已重置'); }} onError={setErr} />}
      {auditDetail && <AuditDetailModal log={auditDetail} onClose={() => setAuditDetail(null)} />}
    </div>
  );
}

async function updateRoleStatus(role: RoleItem, status: 'active' | 'inactive', onError: (message: string) => void, flash: (message: string) => void, refresh: () => Promise<void>) {
  onError('');
  try {
    await adminRbac.updateRole(role.id, { status });
    flash(`角色已${status === 'active' ? '启用' : '停用'}：${displayRoleName(role)}`);
    await refresh();
  } catch (error) {
    onError((error as Error).message || '角色状态更新失败');
  }
}

function CreateUserModal({ roles, onClose, onDone, onError }: { roles: RoleItem[]; onClose: () => void; onDone: () => void; onError: (message: string) => void }) {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const selectedRole = roles.find((role) => role.id === roleId);

  async function submit() {
    if (!PHONE_PATTERN.test(phone)) { onError('请输入正确的手机号'); return; }
    if (!name.trim()) { onError('姓名必填'); return; }
    if (!selectedRole) { onError('请选择角色'); return; }
    if (password.length < 8) { onError('初始密码至少 8 位'); return; }
    setBusy(true); onError('');
    try {
      const created = await adminUsers.create({ identifier: phone, phone, name, password, role: selectedRole.code });
      const userId = created?.user?.id;
      if (userId) await adminUsers.setRoles(userId, { roleIds: [selectedRole.id], primaryRoleId: selectedRole.id });
      onDone();
    } catch (error) {
      onError((error as Error).message || '创建失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalTitle title="新建账号" subtitle="创建后会绑定所选主角色，后续可继续叠加角色。" />
      <Field label="手机号"><input value={phone} onChange={(event) => setPhone(event.target.value.trim())} placeholder="请输入手机号" className="input" autoFocus /></Field>
      <Field label="姓名"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="显示名称" className="input" /></Field>
      <Field label="主角色">
        <select value={roleId} onChange={(event) => setRoleId(event.target.value)} className="select">
          {roles.map((role) => <option key={role.id} value={role.id}>{displayRoleName(role)}</option>)}
        </select>
      </Field>
      <Field label="初始密码"><input type="text" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 位" className="input" /></Field>
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm"><Plus size={14} />{busy ? '创建中...' : '创建'}</button>
      </ModalActions>
    </Overlay>
  );
}

function CreateRoleModal({ permissions, onClose, onDone, onError }: { permissions: PermissionItem[]; onClose: () => void; onDone: () => void; onError: (message: string) => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) { onError('角色名称必填'); return; }
    const normalizedCode = normalizeRoleCode(code) || `custom_role_${Date.now().toString(36)}`;
    if (!ROLE_CODE_PATTERN.test(normalizedCode)) {
      onError('角色编码只能使用英文小写、数字、下划线、冒号或中横线');
      return;
    }
    setBusy(true); onError('');
    try {
      await adminRbac.createRole({ code: normalizedCode, name, description, permissions: selected });
      onDone();
    } catch (error) {
      onError((error as Error).message || '角色创建失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle title="新建角色" subtitle="角色编码保存后作为权限判断稳定 key，建议使用英文小写。" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="角色编码"><input value={code} onChange={(event) => setCode(normalizeRoleCode(event.target.value))} placeholder="marketing_operator" className="input" autoFocus /></Field>
        <Field label="角色名称"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="营销运营" className="input" /></Field>
      </div>
      <div style={{ color: 'var(--t-tertiary)', fontSize: 12, marginTop: -4 }}>角色名称可以是中文；角色编码只能使用英文小写、数字、下划线、冒号或中横线。</div>
      <Field label="说明"><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="角色职责说明" className="input" rows={3} /></Field>
      <PermissionPicker permissions={permissions} selected={selected} onChange={setSelected} />
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm"><Plus size={14} />{busy ? '创建中...' : '创建角色'}</button>
      </ModalActions>
    </Overlay>
  );
}

function AssignRolesModal({ user, roles, onClose, onDone, onError }: { user: AdminUser; roles: RoleItem[]; onClose: () => void; onDone: () => void; onError: (message: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState('');
  const [effectiveRoles, setEffectiveRoles] = useState<EffectiveRole[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [scopeType, setScopeType] = useState<'group' | 'business_unit'>('group');
  const [scopeDim, setScopeDim] = useState<'brand' | 'category'>('brand');
  const [scopeRef, setScopeRef] = useState('');
  const [bu, setBu] = useState<{ brands: Array<{ code: string; name: string }>; categories: Array<{ id: string; name: string; brandCode: string }> }>({ brands: [], categories: [] });

  useEffect(() => {
    let cancelled = false;
    adminRbac.businessUnits().then((res) => { if (!cancelled) setBu({ brands: res.brands || [], categories: res.categories || [] }); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminUsers.effectivePermissions(user.id).then((res) => {
      if (cancelled) return;
      const currentRoles: EffectiveRole[] = res.roles || [];
      setEffectiveRoles(currentRoles);
      setEffectivePermissions(res.permissions || []);
      setSelected(currentRoles.map((role) => role.id));
      setPrimary(currentRoles.find((role) => role.isPrimary)?.id || currentRoles[0]?.id || '');
    }).catch((error) => onError((error as Error).message || '加载用户权限失败'));
    return () => { cancelled = true; };
  }, [onError, user.id]);

  function toggle(roleId: string) {
    setSelected((current) => {
      const next = current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId];
      if (!next.includes(primary)) setPrimary(next[0] || '');
      return next;
    });
  }

  async function submit() {
    if (!selected.length) { onError('至少选择一个角色'); return; }
    if (scopeType === 'business_unit' && !scopeRef) { onError('事业部范围需选择具体品牌/品类'); return; }
    setBusy(true); onError('');
    try {
      const scope = scopeType === 'group'
        ? { scopeType: 'group' as const }
        : { scopeType: 'business_unit' as const, scopeDimension: scopeDim, scopeRef };
      await adminUsers.setRoles(user.id, { roleIds: selected, primaryRoleId: primary || selected[0], scope });
      onDone();
    } catch (error) {
      onError((error as Error).message || '角色分配失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle title="分配用户角色" subtitle={`${user.name} 当前拥有 ${effectiveRoles.length} 个角色，合并 ${effectivePermissions.length} 个权限点。`} />
      <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto', paddingRight: 4 }}>
        {roles.map((role) => {
          const checked = selected.includes(role.id);
          return (
            <label key={role.id} className="surface-interactive" style={choiceStyle(checked)}>
              <input type="checkbox" checked={checked} onChange={() => toggle(role.id)} />
              <span style={{ display: 'grid', gap: 2, minWidth: 0, flex: 1 }}>
                <strong style={{ color: 'var(--t-strong)' }}>{displayRoleName(role)}</strong>
                <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{role.permissions.length} 个权限点</span>
              </span>
              <button
                type="button"
                disabled={!checked}
                onClick={(event) => { event.preventDefault(); setPrimary(role.id); }}
                className={primary === role.id ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'}
              >
                <Check size={13} />
                主角色
              </button>
            </label>
          );
        })}
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle, #e4e4e7)' }}>
        <strong style={{ color: 'var(--t-strong)', fontSize: 13 }}>授权范围（scope）</strong>
        <div style={{ display: 'flex', gap: 16 }}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
            <input type="radio" checked={scopeType === 'group'} onChange={() => setScopeType('group')} /> 集团
          </label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
            <input type="radio" checked={scopeType === 'business_unit'} onChange={() => setScopeType('business_unit')} /> 事业部
          </label>
        </div>
        {scopeType === 'business_unit' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={scopeDim} onChange={(e) => { setScopeDim(e.target.value as 'brand' | 'category'); setScopeRef(''); }}>
              <option value="brand">品牌事业部</option>
              <option value="category">品类事业部</option>
            </select>
            <select value={scopeRef} onChange={(e) => setScopeRef(e.target.value)} style={{ flex: 1 }}>
              <option value="">请选择…</option>
              {scopeDim === 'brand'
                ? bu.brands.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)
                : bu.categories.map((c) => <option key={c.id} value={c.id}>{c.brandCode} · {c.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm"><Save size={14} />{busy ? '保存中...' : '保存分配'}</button>
      </ModalActions>
    </Overlay>
  );
}

function RolePermissionsModal({ role, permissions, canEditRole, canAssignPermissions, onClose, onDone, onError }: { role: RoleItem; permissions: PermissionItem[]; canEditRole: boolean; canAssignPermissions: boolean; onClose: () => void; onDone: () => void; onError: (message: string) => void }) {
  const [name, setName] = useState(displayRoleName(role));
  const [description, setDescription] = useState(displayRoleDescription(role) === '-' ? '' : displayRoleDescription(role));
  const [selected, setSelected] = useState<string[]>(role.permissions);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); onError('');
    try {
      if (canEditRole) await adminRbac.updateRole(role.id, { name, description });
      if (canAssignPermissions) await adminRbac.setRolePermissions(role.id, selected);
      onDone();
    } catch (error) {
      onError((error as Error).message || '角色权限保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle title="配置角色权限" subtitle={`${displayRoleName(role)} · 当前 ${selected.length} 个权限点`} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="角色名称"><input value={name} onChange={(event) => setName(event.target.value)} disabled={!canEditRole} className="input" /></Field>
        <Field label="状态"><input value={role.status === 'active' ? '启用' : '停用'} disabled className="input" /></Field>
      </div>
      <Field label="说明"><textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEditRole} className="input" rows={3} /></Field>
      <PermissionPicker permissions={permissions} selected={selected} onChange={setSelected} disabled={!canAssignPermissions} />
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy || (!canEditRole && !canAssignPermissions)} className="btn btn-brand btn-sm"><Save size={14} />{busy ? '保存中...' : '保存'}</button>
      </ModalActions>
    </Overlay>
  );
}

function PermissionPicker({ permissions, selected, onChange, disabled = false }: { permissions: PermissionItem[]; selected: string[]; onChange: (next: string[]) => void; disabled?: boolean }) {
  const groups = useMemo(() => {
    const byDomain = new Map<string, PermissionItem[]>();
    for (const permission of permissions) {
      const list = byDomain.get(permission.domain) || [];
      list.push(permission);
      byDomain.set(permission.domain, list);
    }
    return [...byDomain.entries()];
  }, [permissions]);

  function toggle(code: string) {
    if (disabled) return;
    onChange(selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code]);
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t-secondary)' }}>权限点</label>
        <span className="badge badge-info">{selected.length} / {permissions.length}</span>
      </div>
      <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflow: 'auto', paddingRight: 4 }}>
        {groups.map(([domain, items]) => (
          <div key={domain} className="card-elevated" style={{ padding: 12, boxShadow: 'var(--sh-xs)' }}>
            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--t-secondary)' }}>{displayPermissionDomain(domain)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
              {items.map((permission) => {
                const checked = selected.includes(permission.code);
                return (
                  <label key={permission.code} className="surface-interactive" style={choiceStyle(checked, disabled)}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(permission.code)} />
                    <span style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                      <strong style={{ color: 'var(--t-strong)' }}>{displayPermissionName(permission)}</strong>
                      <span style={{ color: 'var(--t-tertiary)', fontSize: 12 }}>{displayPermissionAction(permission.action)}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResetModal({ user, onClose, onDone, onError }: { user: AdminUser; onClose: () => void; onDone: () => void; onError: (message: string) => void }) {
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pwd.length < 8) { onError('新密码至少 8 位'); return; }
    setBusy(true); onError('');
    try {
      await adminUsers.resetPassword(user.id, pwd);
      onDone();
    } catch (error) {
      onError((error as Error).message || '重置失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose}>
      <ModalTitle title="重置密码" subtitle={`为「${user.name}」设置新密码。`} />
      <Field label="新密码"><input type="text" value={pwd} onChange={(event) => setPwd(event.target.value)} placeholder="至少 8 位" className="input" autoFocus /></Field>
      <ModalActions onClose={onClose}>
        <button onClick={submit} disabled={busy} className="btn btn-brand btn-sm"><KeyRound size={14} />{busy ? '重置中...' : '确认重置'}</button>
      </ModalActions>
    </Overlay>
  );
}

function AuditDetailModal({ log, onClose }: { log: AuditLogRow; onClose: () => void }) {
  const resource = displayAuditResource(log);
  return (
    <Overlay onClose={onClose} wide>
      <ModalTitle title="操作日志详情" subtitle={`${displayAuditModule(log.resourceType)} · ${displayAuditAction(log.action)}`} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="操作时间"><input value={new Date(log.createdAt).toLocaleString('zh-CN')} disabled className="input" /></Field>
        <Field label="操作人"><input value={log.actorName || log.actorUserId || '系统'} disabled className="input" /></Field>
        <Field label="对象类型"><input value={displayAuditModule(log.resourceType)} disabled className="input" /></Field>
        <Field label="操作说明"><input value={resource.primary} disabled className="input" /></Field>
        <Field label="动作"><input value={displayAuditAction(log.action)} disabled className="input" /></Field>
        <Field label="结果"><input value={log.status === 'failed' ? '失败' : '成功'} disabled className="input" /></Field>
      </div>
      {resource.secondary ? (
        <Field label="补充信息"><input value={resource.secondary} disabled className="input" /></Field>
      ) : null}
      {log.resourceId && resource.primary !== log.resourceId ? (
        <Field label="对象 ID"><input value={log.resourceId} disabled className="input" /></Field>
      ) : null}
      <Field label="操作前 / 请求上下文">
        <pre style={auditJsonStyle}>{stringifyAuditState(log.beforeState)}</pre>
      </Field>
      <Field label="操作后 / 执行结果">
        <pre style={auditJsonStyle}>{stringifyAuditState(log.afterState)}</pre>
      </Field>
      <ModalActions onClose={onClose} />
    </Overlay>
  );
}

function stringifyAuditState(value: unknown) {
  if (!value || typeof value !== 'object') return '{}';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={active ? 'btn btn-brand btn-sm' : 'btn btn-ghost btn-sm'}>
      {icon}
      {children}
    </button>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-elevated" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--t-secondary)' }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 28, lineHeight: 1, fontWeight: 800, color: 'var(--t-strong)' }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--t-tertiary)' }}>{hint}</div>
    </div>
  );
}

function Overlay({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(17, 24, 39, 0.46)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div onClick={(event) => event.stopPropagation()} className="card-elevated" style={{ padding: 24, width: wide ? 'min(100%, 860px)' : 'min(100%, 420px)', maxHeight: 'min(92vh, 820px)', overflow: 'auto', boxShadow: 'var(--sh-modal)' }}>{children}</div>
    </div>
  );
}

function ModalTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--t-strong)' }}>{title}</h3>
      {subtitle ? <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--t-secondary)' }}>{subtitle}</p> : null}
    </div>
  );
}

function ModalActions({ children, onClose }: { children?: ReactNode; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
      <button onClick={onClose} className="btn btn-ghost btn-sm">取消</button>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--t-secondary)', marginBottom: 6 }}>{label}</label>{children}</div>;
}

function Banner({ children, tone }: { children: ReactNode; tone: 'success' | 'error' }) {
  return <div className={tone === 'success' ? 'badge badge-success' : 'badge badge-danger'} style={{ justifyContent: 'flex-start', whiteSpace: 'normal', overflowWrap: 'anywhere', padding: '10px 14px' }}>{children}</div>;
}

function Center({ children }: { children: ReactNode }) {
  return <div className="page-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>;
}

function choiceStyle(checked: boolean, disabled = false): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    border: checked ? '1px solid var(--brand)' : '1px solid var(--border)',
    background: checked ? 'var(--brand-50)' : 'var(--surface-1)',
    opacity: disabled ? 0.62 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const td: CSSProperties = { padding: '11px 16px', verticalAlign: 'middle' };
const auditJsonStyle: CSSProperties = {
  maxHeight: 260,
  margin: 0,
  overflow: 'auto',
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--surface-2)',
  color: 'var(--t-secondary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
};
