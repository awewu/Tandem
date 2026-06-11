/**
 * Organizations · 上下游组织业务层 (借鉴企业微信「上下游」供应链模型)
 *
 * 上游 (anchor) 管理员的能力:
 *   1. createDownstreamOrg  建一个下游组织 (经销商/供应商/门店…), 挂在 anchor 下
 *   2. inviteDownstreamMember  给某个下游组织发邀请码 (邀请码绑定 orgId + membershipType)
 *      被邀请人用邀请码走标准 registerWithInvite → 注册即归属该下游组织
 *   3. listDownstreamOrgs / getOrg / suspendOrg  管理
 *
 * 关键边界:
 *   - 下游组织必须挂在 anchor 下 (parentOrgId = ANCHOR_ORG_ID), 单上游部署
 *   - 邀请码携带 orgId + membershipType → 注册时权威归属, 不再靠角色推断
 *   - 下游成员拿外部角色 (DEFAULT_EXTERNAL_ROLES), 看不到上游内部组织
 */

import { getStore } from '../storage/repository';
import { audit } from '../audit/log';
import { generateInviteCode } from './invite';
import { DEFAULT_EXTERNAL_ROLES, type Role } from './roles';
import {
  ANCHOR_ORG_ID,
  type Organization,
  type OrganizationCategory,
  type OrganizationType,
  type MembershipType,
} from '../types/organization';

const DOWNSTREAM_INVITE_TTL_HOURS = 72;

export class OrgError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
  }
}

function newOrgId(): string {
  return `org_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// 建下游组织
// ---------------------------------------------------------------------------

export interface CreateDownstreamInput {
  name: string;
  /** downstream (有企业微信的经销商/供应商) 或 individual (个人小经销商) */
  type?: Extract<OrganizationType, 'downstream' | 'individual'>;
  category?: OrganizationCategory;
  createdBy: string;
  tenantId?: string;
}

export async function createDownstreamOrg(input: CreateDownstreamInput): Promise<Organization> {
  const name = input.name?.trim();
  if (!name) throw new OrgError('name_required', '组织名称不能为空', 400);

  const store = getStore();
  // anchor 必须先存在 (bootstrap 应已建; 防御性兜底报错而非静默挂空 parent)
  const anchor = await store.organizations.get(ANCHOR_ORG_ID);
  if (!anchor) {
    throw new OrgError('anchor_missing', '上游本部组织尚未初始化, 无法建立下游关系', 409);
  }

  const org = await store.organizations.create({
    id: newOrgId(),
    name,
    type: input.type ?? 'downstream',
    parentOrgId: ANCHOR_ORG_ID,
    category: input.category,
    tenantId: input.tenantId ?? 'default',
    status: 'active',
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  });

  await audit('org.downstream.created', input.createdBy, {
    targetId: org.id,
    targetType: 'organization',
    metadata: { name, type: org.type, category: input.category ?? null },
  });

  return org;
}

// ---------------------------------------------------------------------------
// 邀请下游成员 (邀请码绑定 orgId + membershipType)
// ---------------------------------------------------------------------------

export interface InviteDownstreamInput {
  orgId: string;
  email?: string;
  /** 授予角色 (默认外部访客角色) */
  roles?: Role[];
  invitedById: string;
  ttlHours?: number;
}

export interface InviteDownstreamResult {
  inviteCode: string;
  inviteExpiresAt: string;
  orgId: string;
  membershipType: MembershipType;
}

export async function inviteDownstreamMember(
  input: InviteDownstreamInput,
): Promise<InviteDownstreamResult> {
  const store = getStore();
  const org = await store.organizations.get(input.orgId);
  if (!org) throw new OrgError('org_not_found', '下游组织不存在', 404);
  if (org.type === 'anchor') {
    throw new OrgError('not_downstream', '不能用下游邀请流邀请到上游本部 (内部员工走企业邮箱注册)', 400);
  }
  if (org.status !== 'active') {
    throw new OrgError('org_suspended', '该下游组织已停用, 无法邀请新成员', 409);
  }

  // individual 组织成员身份 = individual; downstream 组织成员身份 = upstream_downstream
  const membershipType: MembershipType =
    org.type === 'individual' ? 'individual' : 'upstream_downstream';
  const roles = input.roles && input.roles.length > 0 ? input.roles : [...DEFAULT_EXTERNAL_ROLES];

  const { plainCode, codeHash } = generateInviteCode();
  const ttl = input.ttlHours ?? DOWNSTREAM_INVITE_TTL_HOURS;
  const expiresAt = new Date(Date.now() + ttl * 3600 * 1000).toISOString();

  await store.auth.invites.create({
    codeHash,
    email: input.email?.trim().toLowerCase() || null,
    presetRoles: roles,
    presetDepartmentId: null,
    tenantId: org.tenantId,
    invitedById: input.invitedById,
    maxUses: 1,
    expiresAt,
    orgId: org.id,
    membershipType,
  });

  await audit('org.downstream.invited', input.invitedById, {
    targetId: org.id,
    targetType: 'organization',
    metadata: { email: input.email ?? null, roles, membershipType },
  });

  return { inviteCode: plainCode, inviteExpiresAt: expiresAt, orgId: org.id, membershipType };
}

// ---------------------------------------------------------------------------
// 查询 / 停用
// ---------------------------------------------------------------------------

export async function getOrg(id: string): Promise<Organization | null> {
  return getStore().organizations.get(id);
}

export async function listDownstreamOrgs(tenantId = 'default'): Promise<Organization[]> {
  const all = await getStore().organizations.list();
  return all
    .filter((o) => o.parentOrgId === ANCHOR_ORG_ID && o.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function suspendOrg(id: string, byUserId: string): Promise<Organization> {
  const store = getStore();
  const org = await store.organizations.get(id);
  if (!org) throw new OrgError('org_not_found', '组织不存在', 404);
  if (org.type === 'anchor') {
    throw new OrgError('cannot_suspend_anchor', '不能停用上游本部组织', 400);
  }
  const updated = await store.organizations.update(id, { status: 'suspended' });
  await audit('org.downstream.suspended', byUserId, {
    targetId: id,
    targetType: 'organization',
    metadata: { name: org.name },
  });
  return updated;
}
