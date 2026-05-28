/**
 * Storage Repository · 存储抽象层
 *
 * 任何业务模块通过此接口访问数据, 不直接依赖 DB 实现.
 * V1 开发期: 使用 InMemoryStore.
 * V1 后期: 实现 PrismaStore 替换 (无业务代码改动).
 */

import type { DecisionCard } from '../types/decision-card';
import type { Persona } from '../types/persona';
import type {
  Material,
  MemoryDowngradeRequest,
  MemoryEntry,
  MemoryPromotionRequest,
  Origin,
  Steward,
} from '../types/memory';
import type {
  CheckIn,
  Cycle,
  Initiative,
  KeyResult,
  Objective,
  TTI,
} from '../types/okr-tti';
import type {
  Kpi,
  KpiCycle,
  KpiCheckIn,
  KpiSnapshot,
  KpiManualEntry,
  KpiBonusPayout,
  KpiSubject,
} from '../types/kpi';
import type { ImChannel, ImMessage, ImMembership } from '../types/im';
import type {
  CompanyBrainDecision,
  CompanyBrainVersion,
  CompanyBrainEvalCase,
  CompanyBrainReflectionReport,
} from '../types/company-brain';
import type { OneOnOneMeeting, OneOnOneActionItem } from '../types/one-on-one';
import type {
  Review360Cycle,
  Review360Submission,
  Review360Assignment,
} from '../types/review-360';

// ---------------------------------------------------------------------------
// 通用 CRUD 接口
// ---------------------------------------------------------------------------

export interface Repository<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  list(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, 'id'> & { id?: string }): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// 业务 Repository 集合 (Tandem 数据访问层)
// ---------------------------------------------------------------------------

export interface TandemStore {
  _storeKind?: 'memory' | 'prisma';
  decisionCards: Repository<DecisionCard>;
  personas: Repository<Persona>;

  /** §CA-13 (CENTRAL-AI-ARCHITECTURE) CompanyBrain 智能迭代闭环 */
  companyBrainDecisions: Repository<CompanyBrainDecision>;
  companyBrainVersions: Repository<CompanyBrainVersion>;
  companyBrainEvalCases: Repository<CompanyBrainEvalCase>;
  companyBrainReflections: Repository<CompanyBrainReflectionReport>;
  origins: Repository<Origin>;
  materials: Repository<Material>;
  memories: Repository<MemoryEntry>;
  promotions: Repository<MemoryPromotionRequest>;
  /** Memory 降级评估 (宪章 §8.2) */
  downgrades: Repository<MemoryDowngradeRequest>;
  stewards: { get(userId: string): Promise<Steward | null>; set(s: Steward): Promise<void> };
  cycles: Repository<Cycle>;
  objectives: Repository<Objective>;
  keyResults: Repository<KeyResult>;
  ttis: Repository<TTI>;
  initiatives: Repository<Initiative>;
  checkIns: Repository<CheckIn>;

  /** KPI 体系 (CHARTER-KPI-TTI §2): 年度底线 + 全维度监控, 三通道写入 */
  kpiCycles: Repository<KpiCycle>;
  /** 科目主数据 (动态可扩展树, HR/财务管理) */
  kpiSubjects: Repository<KpiSubject>;
  kpis: Repository<Kpi>;
  kpiCheckIns: Repository<KpiCheckIn>;
  kpiSnapshots: Repository<KpiSnapshot>;
  /** 通道 C 人工补录审计 (财务/HR/部门内勤) */
  kpiManualEntries: Repository<KpiManualEntry>;
  kpiBonusPayouts: Repository<KpiBonusPayout>;

  /** IM (内置消息层) */
  imChannels: Repository<ImChannel>;
  imMessages: Repository<ImMessage>;
  imMemberships: Repository<ImMembership>;

  /** 1on1 主管-员工对话 (A2.1b) */
  oneOnOneMeetings: Repository<OneOnOneMeeting>;
  oneOnOneActionItems: Repository<OneOnOneActionItem>;

  /** 360 评估 (A2.1b) */
  review360Cycles: Repository<Review360Cycle>;
  review360Submissions: Repository<Review360Submission>;
  review360Assignments: Repository<Review360Assignment>;

  /** Skills 治理状态机 (§T15) */
  skillRegistry: Repository<import('../taf/skills/governance').SkillRecord>;

  /** Bitable 多维表格 (V1 MVP) */
  bitableTables: Repository<import('../types/bitable').BitableTable>;
  bitableViews: Repository<import('../types/bitable').BitableView>;

  /** Intranet 公告/政策/大事记/福利 CMS (P3-10) */
  intranetPosts: Repository<import('../types/intranet-post').IntranetPost>;

  /** 拿捏代行行为 (Persona ProxyAction 一等公民, §13 24h 否决窗口) */
  proxyActions: Repository<import('../types/proxy-action').ProxyAction>;

  /** Persona 反馈评分 (闭环④) */
  personaFeedbacks: Repository<import('../types/persona-feedback').PersonaFeedback>;

  /** LLM 模型切换偏好 (中央AI + 个人AI) */
  llmPreferences: Repository<import('../types/llm-preference').LlmPreference>;

  /** 企业 AI 治理策略 (中央AI token 开关 / 配额 / 白名单) */
  tenantAiPolicies: Repository<import('../types/tenant-ai-policy').TenantAiPolicy>;

  /** 飞书功能追赶 (Feishu Catch-up) */
  documents: Repository<import('../types/feishu-catchup').Document>;
  calendarEvents: Repository<import('../types/feishu-catchup').CalendarEvent>;
  driveFiles: Repository<import('../types/feishu-catchup').DriveFile>;
  notifications: Repository<import('../types/feishu-catchup').Notification>;

  /** 自研身份系统 (Native Auth) */
  auth: AuthStore;
}

// ---------------------------------------------------------------------------
// Auth Store · 自研身份系统数据访问
// ---------------------------------------------------------------------------

export interface AuthUser {
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
}

export interface AuthSession {
  id: string;
  userId: string;
  refreshTokenHash: string;
  mfaVerified: boolean;
  expiresAt: string;
  revokedAt: string | null;
  userAgent?: string | null;
  ip?: string | null;
}

export interface AuthInvite {
  id: string;
  codeHash: string;
  email?: string | null;
  presetRoles: string[];
  presetDepartmentId?: string | null;
  tenantId: string;
  invitedById: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  redeemedAt?: string | null;
}

export interface AuthEvent {
  userId?: string;
  email?: string;
  eventType: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthStore {
  users: {
    findByEmail(email: string): Promise<AuthUser | null>;
    findById(id: string): Promise<AuthUser | null>;
    /** P1-2: 列出全部 (或按 tenant) 用户; /admin/organization 列表用 */
    list(filter?: { tenantId?: string }): Promise<AuthUser[]>;
    create(input: Partial<AuthUser> & { email: string; name: string }): Promise<AuthUser>;
    update(id: string, patch: Partial<AuthUser>): Promise<void>;
    savePasswordHash(userId: string, hash: string): Promise<void>;
    findPasswordHash(userId: string): Promise<{ hash: string; historyHashes?: string[] } | null>;
    findMfaSecret(userId: string): Promise<{ encryptedSecret: string; recoveryCodeHashes: string[] } | null>;
    saveMfaSecret(userId: string, encryptedSecret: string, recoveryCodeHashes: string[]): Promise<void>;
    consumeRecoveryCode(userId: string, hash: string): Promise<void>;
  };
  sessions: {
    create(input: Omit<AuthSession, 'id' | 'revokedAt'> & { userAgent: string | null; ip: string | null }): Promise<AuthSession>;
    findById(id: string): Promise<AuthSession | null>;
    findByRefreshHash(hash: string): Promise<AuthSession | null>;
    revoke(id: string, reason: string): Promise<void>;
    revokeAllForUser(userId: string, reason: string): Promise<void>;
    markMfaVerified(id: string): Promise<void>;
  };
  invites: {
    create(input: Omit<AuthInvite, 'id' | 'usedCount' | 'redeemedAt'>): Promise<AuthInvite>;
    findByHash(hash: string): Promise<AuthInvite | null>;
    list(filter?: { invitedById?: string; tenantId?: string }): Promise<AuthInvite[]>;
    markUsed(id: string): Promise<void>;
    revoke(id: string): Promise<void>;
  };
  events: {
    append(event: AuthEvent): Promise<void>;
    list(filter?: { userId?: string; eventType?: string; sinceMs?: number }): Promise<(AuthEvent & { createdAt: string })[]>;
  };
}

// ---------------------------------------------------------------------------
// 全局 store 引用 (启动时注入)
//
// 单例必须挂在 globalThis 上, 否则 Next.js dev HMR 会在每次模块重载时
// 重新求值此文件 → _store 被重置 → 之前 seed 的频道/消息全部丢失.
// 生产期 Node 不重载, 但用 globalThis 也无害.
// ---------------------------------------------------------------------------

const STORE_KEY = '__tandem_store__';

type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: TandemStore | null;
};

const _g = globalThis as GlobalWithStore;

export function setStore(store: TandemStore): void {
  _g[STORE_KEY] = store;
}

export function getStore(): TandemStore {
  const s = _g[STORE_KEY];
  if (!s) {
    throw new Error('TandemStore not initialized. Call setStore() at app boot.');
  }
  return s;
}

// ---------------------------------------------------------------------------
// CUID-like id helper (轻依赖)
// ---------------------------------------------------------------------------

export function generateId(prefix = ''): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return prefix ? `${prefix}_${ts}${rnd}` : `${ts}${rnd}`;
}
