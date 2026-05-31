/**
 * AuthApplications · 外部人员注册申请业务层
 *
 * 流程:
 *   1. submitApplication: 公开提交, 不需要登录 (限流 + 邮箱去重)
 *   2. approveApplication: Owner/Admin 审批通过 → 生成 invite 单次邀请码 + 返回 plainCode
 *      申请者用 plainCode 走标准 /api/auth/register 完成注册 (含密码强度 + email 一致性)
 *   3. rejectApplication: 标记 rejected, 14 天后清理 (清理由 admin 工具触发, 不在此实现)
 */

import { getStore } from '../storage/repository';
import { audit } from '../audit/log';
import { generateInviteCode } from './invite';
import { DEFAULT_EXTERNAL_ROLES, type Role } from './roles';
import type { AuthApplication } from '../types/auth-application';

const REASON_MIN = 20;
const REASON_MAX = 1000;
const APPROVED_INVITE_TTL_HOURS = 72;

export class ApplicationError extends Error {
  constructor(public code: string, message: string, public httpStatus = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Submit (公开)
// ---------------------------------------------------------------------------

export interface SubmitInput {
  email: string;
  name: string;
  reason: string;
  organization?: string;
  requestedScopes?: ('naba' | 'dazi')[];
  deviceInfo?: { userAgent?: string; ip?: string };
}

export async function submitApplication(input: SubmitInput): Promise<AuthApplication> {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApplicationError('invalid_email', '邮箱格式错误', 400);
  }
  if (!input.name?.trim()) {
    throw new ApplicationError('name_required', '姓名不能为空', 400);
  }
  const reason = input.reason?.trim() ?? '';
  if (reason.length < REASON_MIN) {
    throw new ApplicationError(
      'reason_too_short',
      `请说明申请理由 (至少 ${REASON_MIN} 字)`,
      400,
    );
  }
  if (reason.length > REASON_MAX) {
    throw new ApplicationError('reason_too_long', `申请理由过长 (上限 ${REASON_MAX} 字)`, 400);
  }

  const store = getStore();

  // 已存在 pending 申请 → 拒绝重复提交
  const existing = await store.authApplications.list();
  const dup = existing.find(
    (a) => a.email.toLowerCase() === email && a.status === 'pending',
  );
  if (dup) {
    throw new ApplicationError(
      'duplicate_pending',
      '该邮箱已有待审批的申请, 请耐心等候',
      409,
    );
  }

  // 已是用户 → 直接登录
  const existingUser = await store.auth.users.findByEmail(email);
  if (existingUser) {
    throw new ApplicationError('already_member', '该邮箱已是 Tandem 用户, 请直接登录', 409);
  }

  const now = new Date().toISOString();
  const created = await store.authApplications.create({
    email,
    name: input.name.trim(),
    reason,
    organization: input.organization?.trim() || undefined,
    requestedScopes: input.requestedScopes,
    status: 'pending',
    tenantId: 'default',
    ip: input.deviceInfo?.ip ?? null,
    userAgent: input.deviceInfo?.userAgent ?? null,
    createdAt: now,
  });

  await audit('auth.application.submit', 'anonymous', {
    metadata: { applicationId: created.id, email, hasOrg: !!input.organization },
  });

  return created;
}

// ---------------------------------------------------------------------------
// Approve (Owner/Admin)
// ---------------------------------------------------------------------------

export interface ApproveInput {
  applicationId: string;
  approverId: string;
  grantedRoles?: Role[];
  decisionNote?: string;
}

export interface ApproveResult {
  application: AuthApplication;
  /** 单次邀请码明文 — 仅此次返回, 用于带外通知申请人 (邮件/微信) */
  inviteCode: string;
  /** 邀请码过期时间 */
  inviteExpiresAt: string;
}

export async function approveApplication(input: ApproveInput): Promise<ApproveResult> {
  const store = getStore();
  const app = await store.authApplications.get(input.applicationId);
  if (!app) throw new ApplicationError('not_found', '申请不存在', 404);
  if (app.status !== 'pending') {
    throw new ApplicationError('not_pending', `申请已 ${app.status}, 无法重复审批`, 409);
  }

  const roles = input.grantedRoles && input.grantedRoles.length > 0
    ? input.grantedRoles
    : [...DEFAULT_EXTERNAL_ROLES];

  // 生成与申请邮箱绑定的单次邀请码
  const { plainCode, codeHash } = generateInviteCode();
  const expiresAt = new Date(Date.now() + APPROVED_INVITE_TTL_HOURS * 3600 * 1000).toISOString();
  await store.auth.invites.create({
    codeHash,
    email: app.email,
    presetRoles: roles,
    presetDepartmentId: null,
    tenantId: app.tenantId,
    invitedById: input.approverId,
    maxUses: 1,
    expiresAt,
  });

  const now = new Date().toISOString();
  const updated = await store.authApplications.update(app.id, {
    status: 'approved',
    grantedRoles: roles,
    inviteCodeHash: codeHash,
    decidedAt: now,
    decidedBy: input.approverId,
    decisionNote: input.decisionNote,
  });

  await audit('auth.application.approve', input.approverId, {
    metadata: {
      applicationId: app.id,
      email: app.email,
      roles,
    },
  });

  return {
    application: updated,
    inviteCode: plainCode,
    inviteExpiresAt: expiresAt,
  };
}

// ---------------------------------------------------------------------------
// Reject (Owner/Admin)
// ---------------------------------------------------------------------------

export interface RejectInput {
  applicationId: string;
  approverId: string;
  decisionNote?: string;
}

export async function rejectApplication(input: RejectInput): Promise<AuthApplication> {
  const store = getStore();
  const app = await store.authApplications.get(input.applicationId);
  if (!app) throw new ApplicationError('not_found', '申请不存在', 404);
  if (app.status !== 'pending') {
    throw new ApplicationError('not_pending', `申请已 ${app.status}, 无法重复审批`, 409);
  }

  const updated = await store.authApplications.update(app.id, {
    status: 'rejected',
    decidedAt: new Date().toISOString(),
    decidedBy: input.approverId,
    decisionNote: input.decisionNote,
  });

  await audit('auth.application.reject', input.approverId, {
    metadata: { applicationId: app.id, email: app.email },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface ListFilter {
  status?: AuthApplication['status'];
  tenantId?: string;
}

export async function listApplications(filter?: ListFilter): Promise<AuthApplication[]> {
  const store = getStore();
  let all = await store.authApplications.list();
  if (filter?.status) all = all.filter((a) => a.status === filter.status);
  if (filter?.tenantId) all = all.filter((a) => a.tenantId === filter.tenantId);
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
