/**
 * Native Auth · 自研身份系统业务层
 *
 * 不依赖 NextAuth, 不依赖任何第三方 OAuth.
 * 配合 lib/storage/repository.ts 工作 (V1 内存; V2 接 Prisma).
 *
 * 流程:
 *   - registerWithInvite(email, password, inviteCode): 邀请制注册
 *   - login(email, password, deviceInfo): 一阶段验证
 *   - completeMfa(sessionId, totpCode): 二阶段 MFA (如启用)
 *   - logout(sessionId)
 *   - revokeAllSessions(userId)
 *
 * 安全策略 (等保 2.0 对齐):
 *   - 5 次失败后锁定 15 分钟
 *   - 密码强度强制
 *   - 历史密码不可复用
 *   - Session 设备绑定
 *   - 全程 audit
 */

import { hashPassword, verifyPassword, evaluatePassword, isPasswordReused } from './password';
import { DEFAULT_EMPLOYEE_ROLES, DATA_STEWARD_ROLES, hasInternalRole } from './roles';
import { ANCHOR_ORG_ID, type MembershipType } from '../types/organization';
import {
  signAccessToken,
  issueRefreshToken,
  hashRefreshToken,
  type SessionPayload,
} from './session';
import { hashInviteCode, validateInvite, type InviteRecord } from './invite';
import { encryptSecret, decryptSecret, verifyTotp, verifyRecoveryCode } from './mfa';
import { getStore } from '../storage/repository';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const PASSWORD_HISTORY_KEEP = 5;

// ---------------------------------------------------------------------------
// 错误类型
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(public code: string, message: string, public httpStatus = 401) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// 注册 (邀请制)
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  inviteCode: string;
  deviceInfo?: { userAgent?: string; ip?: string };
}

export interface AuthResult {
  userId: string;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  /** 是否需要 MFA 第二步 */
  requiresMfa: boolean;
  /** 临时 session id (MFA 未通过前持有) */
  pendingSessionId?: string;
  /**
   * P0-4 (LAUNCH-200): 特权角色 (owner/admin/steward) 未启用 MFA + REQUIRE_MFA_FOR_PRIVILEGED=1
   * 客户端应强跳 /settings/security 启用 MFA, 不放过任何业务路由.
   */
  mfaEnrollmentRequired?: boolean;
}

export async function registerWithInvite(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AuthError('invalid_email', '邮箱格式错误', 400);
  }

  // 1. 校验邀请码
  const inviteHash = hashInviteCode(input.inviteCode);
  const inviteStore = getInviteStore();
  const invite = await inviteStore.findByHash(inviteHash);
  const v = validateInvite(input.inviteCode, invite, email);
  if (!v.ok) {
    await audit({
      eventType: 'register_failed',
      email,
      metadata: { reason: v.reason },
      ...input.deviceInfo,
    });
    throw new AuthError('invalid_invite', v.reason ?? '邀请码无效', 400);
  }

  // 2. 强度校验
  const strength = evaluatePassword(input.password, { email, name: input.name });
  if (!strength.ok) {
    throw new AuthError('weak_password', `密码不符合要求: ${strength.errors.join(', ')}`, 400);
  }

  // 3. 邮箱重复检查
  const userStore = getUserStore();
  const existing = await userStore.findByEmail(email);
  if (existing) {
    throw new AuthError('email_taken', '该邮箱已注册', 409);
  }

  // 4. 创建用户 + 密码 hash
  // §上下游: 归属优先级 —
  //   (a) 邀请码显式携带 orgId/membershipType (上游邀请下游成员) → 权威, 直接采用
  //   (b) 否则按预设角色推断: 内部角色 → internal+anchor; 外部角色 → pending (待分配)
  const presetRoles = v.invite!.presetRoles;
  let membershipType: MembershipType;
  let orgId: string | null;
  if (v.invite!.membershipType) {
    membershipType = v.invite!.membershipType;
    orgId = v.invite!.orgId ?? null;
  } else {
    const internalInvite = hasInternalRole(presetRoles);
    membershipType = internalInvite ? 'internal' : 'pending';
    orgId = internalInvite ? ANCHOR_ORG_ID : null;
  }
  const user = await userStore.create({
    email,
    name: input.name,
    roles: presetRoles,
    departmentId: v.invite!.presetDepartmentId ?? null,
    tenantId: v.invite!.tenantId,
    orgId,
    membershipType,
    emailVerifiedAt: new Date().toISOString(),
  });

  await userStore.savePasswordHash(user.id, hashPassword(input.password));

  // 5. 标记邀请码已使用
  await inviteStore.markUsed(v.invite!.id);

  // 6. 立即颁发 session (注册即登录)
  const session = await issueSessionForUser(user, false, input.deviceInfo);

  await audit({
    userId: user.id,
    email,
    eventType: 'register',
    ...input.deviceInfo,
  });

  return session;
}

// ---------------------------------------------------------------------------
// 登录 (第一阶段: 密码)
// ---------------------------------------------------------------------------

export interface LoginInput {
  email: string;
  password: string;
  deviceInfo?: { userAgent?: string; ip?: string };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const userStore = getUserStore();
  const user = await userStore.findByEmail(email);

  if (!user) {
    await audit({
      eventType: 'login_failed',
      email,
      metadata: { reason: 'user_not_found' },
      ...input.deviceInfo,
    });
    // 同样的延迟 + 错误信息 (防止枚举)
    throw new AuthError('invalid_credentials', '邮箱或密码错误', 401);
  }

  if (user.disabled) {
    throw new AuthError('account_disabled', '账号已被禁用', 403);
  }

  if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
    const min = Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000);
    throw new AuthError('account_locked', `账号已锁定, 请 ${min} 分钟后重试`, 423);
  }

  const stored = await userStore.findPasswordHash(user.id);
  const passOk = stored ? verifyPassword(input.password, stored.hash) : false;

  if (!passOk) {
    const attempts = (user.failedLoginCount ?? 0) + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_DURATION_MS).toISOString() : null;
    await userStore.update(user.id, {
      failedLoginCount: attempts,
      lockedUntil,
    });
    await audit({
      userId: user.id,
      email,
      eventType: 'login_failed',
      metadata: { attempts, locked: !!lockedUntil },
      ...input.deviceInfo,
    });
    throw new AuthError('invalid_credentials', '邮箱或密码错误', 401);
  }

  // 重置失败计数
  await userStore.update(user.id, {
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: new Date().toISOString(),
    lastLoginIp: input.deviceInfo?.ip ?? null,
  });

  // MFA?
  const mfa = await userStore.findMfaSecret(user.id);
  const requiresMfa = !!mfa;

  // P0-4 (LAUNCH-200): 特权角色 (owner/admin/steward) 未启用 MFA 时强制启用门.
  //   生产 (NODE_ENV=production) 默认开启; 可用 REQUIRE_MFA_FOR_PRIVILEGED=0 关闭 (不建议).
  //   非生产默认关闭; REQUIRE_MFA_FOR_PRIVILEGED=1 显式开启.
  const userRoles = user.roles ?? [];
  const isPrivileged = userRoles.some((r) => DATA_STEWARD_ROLES.includes(r as never));
  const mfaForcedOn =
    process.env.REQUIRE_MFA_FOR_PRIVILEGED === '1' ||
    (process.env.NODE_ENV === 'production' && process.env.REQUIRE_MFA_FOR_PRIVILEGED !== '0');
  const mfaEnrollmentRequired = isPrivileged && !mfa && mfaForcedOn;

  const session = await issueSessionForUser(user, !requiresMfa, input.deviceInfo);

  await audit({
    userId: user.id,
    email,
    eventType: requiresMfa
      ? 'login_pending_mfa'
      : mfaEnrollmentRequired
        ? 'login_mfa_enrollment_required'
        : 'login',
    ...input.deviceInfo,
  });

  return { ...session, requiresMfa, mfaEnrollmentRequired };
}

// ---------------------------------------------------------------------------
// MFA 第二阶段
// ---------------------------------------------------------------------------

export async function completeMfa(input: {
  pendingSessionId: string;
  totpCode?: string;
  recoveryCode?: string;
  deviceInfo?: { userAgent?: string; ip?: string };
}): Promise<AuthResult> {
  const userStore = getUserStore();
  const sessionStore = getSessionStore();
  const session = await sessionStore.findById(input.pendingSessionId);
  if (!session || session.revokedAt) throw new AuthError('invalid_session', '会话不存在或已撤销', 401);

  const user = await userStore.findById(session.userId);
  if (!user) throw new AuthError('invalid_session', '账户异常', 401);

  const mfa = await userStore.findMfaSecret(user.id);
  if (!mfa) throw new AuthError('mfa_not_enrolled', 'MFA 未启用', 400);

  let ok = false;

  if (input.totpCode) {
    const secret = decryptSecret(mfa.encryptedSecret);
    ok = verifyTotp(secret, input.totpCode);
  } else if (input.recoveryCode) {
    const r = verifyRecoveryCode(input.recoveryCode, mfa.recoveryCodeHashes);
    if (r.ok && r.matchedHash) {
      // 一次性恢复码: 用过即作废
      await userStore.consumeRecoveryCode(user.id, r.matchedHash);
      ok = true;
    }
  }

  if (!ok) {
    await audit({ userId: user.id, eventType: 'mfa_failed', ...input.deviceInfo });
    throw new AuthError('invalid_mfa', 'MFA 验证失败', 401);
  }

  await sessionStore.markMfaVerified(session.id);
  await userStore.update(user.id, { lastLoginAt: new Date().toISOString() });
  await audit({ userId: user.id, eventType: 'mfa_verified', ...input.deviceInfo });

  // 重新颁发 access token (mfa: true)
  const access = signAccessToken({
    sub: user.id,
    email: user.email,
    roles: user.roles ?? [],
    tenantId: user.tenantId ?? 'default',
    mfa: true,
    sid: session.id,
  });

  return {
    userId: user.id,
    accessToken: access,
    refreshToken: '',  // 已在 login 阶段颁发, 这里不重发
    refreshTokenExpiresAt: new Date(session.expiresAt),
    requiresMfa: false,
  };
}

// ---------------------------------------------------------------------------
// SSO 自助注册 — 内部员工：邮箱域名白名单 + 工号自动激活
// ---------------------------------------------------------------------------

export interface SsoRegisterInput {
  email: string;
  name: string;
  /** 工号（人事主数据 ID），用于和 HR 系统对齐 */
  employeeId?: string;
  /** 密码（允许员工自设；也可企业统一下发临时密码） */
  password: string;
  deviceInfo?: { userAgent?: string; ip?: string };
}

/**
 * 邮箱域名白名单：读取环境变量 INTERNAL_EMAIL_DOMAINS
 * 格式: "company.com,corp.example.com"
 * 未配置时返回空数组（SSO 路径关闭）
 */
function getInternalDomains(): string[] {
  const raw = process.env.INTERNAL_EMAIL_DOMAINS ?? '';
  return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
}

/**
 * 内部员工自助注册
 * - 邮箱必须属于企业域名白名单 (INTERNAL_EMAIL_DOMAINS)
 * - 不需要邀请码：域名即凭证
 * - 自动分配 ['employee'] 角色，tenantId = 'default'
 * - 工号写入 departmentId 字段（临时用，待 HR 主数据接入后替换）
 */
export async function registerWithSso(input: SsoRegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new AuthError('invalid_email', '邮箱格式错误', 400);
  }

  const domains = getInternalDomains();
  if (domains.length === 0) {
    throw new AuthError('sso_disabled', '企业自助注册未开启，请联系管理员', 403);
  }
  const emailDomain = email.split('@')[1] ?? '';
  if (!domains.includes(emailDomain)) {
    throw new AuthError('domain_not_allowed', `邮箱域名 @${emailDomain} 不在企业白名单中`, 403);
  }

  const strength = evaluatePassword(input.password, { email, name: input.name });
  if (!strength.ok) {
    throw new AuthError('weak_password', `密码不符合要求: ${strength.errors.join(', ')}`, 400);
  }

  const userStore = getUserStore();
  const existing = await userStore.findByEmail(email);
  if (existing) {
    throw new AuthError('email_taken', '该邮箱已注册，请直接登录', 409);
  }

  const user = await userStore.create({
    email,
    name: input.name,
    roles: [...DEFAULT_EMPLOYEE_ROLES],
    tenantId: 'default',
    // §上下游: 企业邮箱域名白名单 = 内部员工身份, 归属上游本部组织 (anchor)
    orgId: ANCHOR_ORG_ID,
    membershipType: 'internal',
    departmentId: input.employeeId ?? null,
    emailVerifiedAt: new Date().toISOString(),
  });
  await userStore.savePasswordHash(user.id, hashPassword(input.password));

  const session = await issueSessionForUser(user, false, input.deviceInfo);
  await audit({
    userId: user.id,
    email,
    eventType: 'register_sso',
    metadata: { employeeId: input.employeeId, domain: emailDomain },
    ...input.deviceInfo,
  });
  return session;
}

// ---------------------------------------------------------------------------
// 登出 / 撤销
// ---------------------------------------------------------------------------

export async function logout(sessionId: string): Promise<void> {
  const sessionStore = getSessionStore();
  await sessionStore.revoke(sessionId, 'user_logout');
  const session = await sessionStore.findById(sessionId);
  if (session) {
    await audit({ userId: session.userId, eventType: 'logout' });
  }
}

export async function revokeAllSessions(userId: string, reason: string): Promise<void> {
  const sessionStore = getSessionStore();
  await sessionStore.revokeAllForUser(userId, reason);
  await audit({ userId, eventType: 'session_revoked_all', metadata: { reason } });
}

// ---------------------------------------------------------------------------
// 内部: 颁发 session
// ---------------------------------------------------------------------------

async function issueSessionForUser(
  user: { id: string; email: string; roles?: string[]; tenantId?: string },
  mfaVerified: boolean,
  deviceInfo?: { userAgent?: string; ip?: string }
): Promise<AuthResult> {
  const refresh = issueRefreshToken();
  const sessionStore = getSessionStore();
  const session = await sessionStore.create({
    userId: user.id,
    refreshTokenHash: refresh.refreshTokenHash,
    mfaVerified,
    userAgent: deviceInfo?.userAgent ?? null,
    ip: deviceInfo?.ip ?? null,
    expiresAt: refresh.expiresAt.toISOString(),
  });

  const access = signAccessToken({
    sub: user.id,
    email: user.email,
    roles: user.roles ?? [],
    tenantId: user.tenantId ?? 'default',
    mfa: mfaVerified,
    sid: session.id,
  });

  return {
    userId: user.id,
    accessToken: access,
    refreshToken: refresh.refreshToken,
    refreshTokenExpiresAt: refresh.expiresAt,
    requiresMfa: !mfaVerified,
    pendingSessionId: !mfaVerified ? session.id : undefined,
  };
}

/**
 * 外部身份登录 (手机 OTP / 微信扫码) 验证通过后, 复用统一会话签发.
 * external login 视为已完成身份验证 → mfaVerified=true (跳过 MFA 阶段).
 * 调用方 (phone-login / wechat-login) 负责"找/建用户 + 绑定", 这里只发 session.
 */
export async function issueSessionForExternalLogin(
  user: { id: string; email: string; roles?: string[]; tenantId?: string },
  deviceInfo?: { userAgent?: string; ip?: string },
): Promise<AuthResult> {
  return issueSessionForUser(user, true, deviceInfo);
}

// ---------------------------------------------------------------------------
// 占位 store wrappers (V1: 包装 in-memory store; V2: Prisma)
// ---------------------------------------------------------------------------

interface NativeUserStore {
  findByEmail(email: string): Promise<NativeUser | null>;
  findById(id: string): Promise<NativeUser | null>;
  create(input: Partial<NativeUser> & { email: string; name: string }): Promise<NativeUser>;
  update(id: string, patch: Partial<NativeUser>): Promise<void>;
  savePasswordHash(userId: string, hash: string): Promise<void>;
  findPasswordHash(userId: string): Promise<{ hash: string; historyHashes?: string[] } | null>;
  findMfaSecret(userId: string): Promise<{ encryptedSecret: string; recoveryCodeHashes: string[] } | null>;
  consumeRecoveryCode(userId: string, hash: string): Promise<void>;
}

export interface NativeUser {
  id: string;
  email: string;
  name: string;
  roles?: string[];
  tenantId?: string;
  disabled?: boolean;
  failedLoginCount?: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  emailVerifiedAt?: string | null;
  departmentId?: string | null;
  /** 所属组织 (企业微信上下游模型) */
  orgId?: string | null;
  /** 成员身份类型 */
  membershipType?: MembershipType;
}

interface NativeSessionStore {
  create(input: {
    userId: string;
    refreshTokenHash: string;
    mfaVerified: boolean;
    userAgent: string | null;
    ip: string | null;
    expiresAt: string;
  }): Promise<{ id: string; userId: string; expiresAt: string }>;
  findById(id: string): Promise<NativeSession | null>;
  revoke(id: string, reason: string): Promise<void>;
  revokeAllForUser(userId: string, reason: string): Promise<void>;
  markMfaVerified(id: string): Promise<void>;
}

interface NativeSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  mfaVerified: boolean;
  expiresAt: string;
  revokedAt: string | null;
}

interface NativeInviteStore {
  findByHash(hash: string): Promise<InviteRecord | null>;
  markUsed(id: string): Promise<void>;
}

// V1 实现: 直接挂在 in-memory store 上
function getUserStore(): NativeUserStore {
  return getStore().auth.users;
}

function getSessionStore(): NativeSessionStore {
  return getStore().auth.sessions;
}

function getInviteStore(): NativeInviteStore {
  return getStore().auth.invites;
}

async function audit(event: {
  userId?: string;
  email?: string;
  eventType: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await getStore().auth.events.append(event);
}
