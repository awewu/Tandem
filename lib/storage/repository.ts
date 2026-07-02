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
  KpiCausalLink,
} from '../types/kpi';
import type { ImChannel, ImMessage, ImMembership, ImPresence, ImMentionInboxItem } from '../types/im';
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

/**
 * 列表分页选项 (P1 · 可选, 向后兼容).
 * 热集合 (im_messages / memories / audit) 应传 limit 避免全集合加载.
 * 注: 当 filter 仅含 tenantId (或为空) 时, limit/offset 下推到 SQL;
 *     若含其它需 JS 过滤的字段, 则在 JS 过滤后再切片 (仍兜底返回行数).
 */
export interface ListOptions {
  limit?: number;
  offset?: number;
}

export interface Repository<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  list(filter?: Partial<T>, opts?: ListOptions): Promise<T[]>;
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

  /** BSC 战略地图因果链 (B-019) */
  kpiCausalLinks: Repository<KpiCausalLink>;

  /** IM (内置消息层) */
  imChannels: Repository<ImChannel>;
  imMessages: Repository<ImMessage>;
  imMemberships: Repository<ImMembership>;
  /** IM 在线状态 (真人离线时分身 24h 兜底代答) */
  imPresence: Repository<ImPresence>;
  /** IM @我/回复我 收件箱 (个人消息已读确认) */
  imMentionInbox: Repository<ImMentionInboxItem>;

  /** 1on1 主管-员工对话 (A2.1b) */
  oneOnOneMeetings: Repository<OneOnOneMeeting>;
  oneOnOneActionItems: Repository<OneOnOneActionItem>;

  /** 360 评估 (A2.1b) */
  review360Cycles: Repository<Review360Cycle>;
  review360Submissions: Repository<Review360Submission>;
  review360Assignments: Repository<Review360Assignment>;

  /** Skills 治理状态机 (§T15) */
  skillRegistry: Repository<import('../taf/skills/governance').SkillRecord>;

  /** Skill Proposals · pattern-detector + LLM 生成的 SkillProposal 草稿 (#14 闭环) */
  skillProposals: Repository<import('../skills/skill-proposal').SkillProposal>;

  /** Bitable 多维表格 (V1 MVP) */
  bitableTables: Repository<import('../types/bitable').BitableTable>;
  bitableViews: Repository<import('../types/bitable').BitableView>;

  /** Intranet 公告/政策/大事记/福利 CMS (P3-10) */
  intranetPosts: Repository<import('../types/intranet-post').IntranetPost>;

  /** 拿捏代行行为 (Persona ProxyAction 一等公民, §13 24h 否决窗口) */
  proxyActions: Repository<import('../types/proxy-action').ProxyAction>;

  /** Persona 反馈评分 (闭环④) */
  personaFeedbacks: Repository<import('../types/persona-feedback').PersonaFeedback>;

  /** Academy 闭环 (P0 KvStore-based, P2 升级 drizzle 强类型表) */
  /** 学院课程内容 (CMS, store-backed) */
  lessons: Repository<import('../learning/types').Lesson>;
  learningAttempts: Repository<import('../learning/types').LessonAttempt>;
  learningCertifications: Repository<import('../learning/types').Certification>;
  learningEnrollments: Repository<import('../learning/enrollment').LearningEnrollment>;

  /** LLM 模型切换偏好 (中央AI + 个人AI) */
  llmPreferences: Repository<import('../types/llm-preference').LlmPreference>;

  /** 企业 AI 治理策略 (中央AI token 开关 / 配额 / 白名单) */
  tenantAiPolicies: Repository<import('../types/tenant-ai-policy').TenantAiPolicy>;

  /** WorkspaceManifest (tandem.workspace.md declarative governance, 借鉴 CLAUDE.md/AGENTS.md) */
  workspaceManifests: Repository<import('../types/workspace-manifest').WorkspaceManifest>;

  /** Persona 价值观锚 (B-027, 五引擎 · 防漂移层. id=userId 一对一) */
  personaConstitutions: Repository<import('../types/persona-constitution').PersonaConstitution>;

  /** 飞书功能追赶 (Feishu Catch-up) */
  documents: Repository<import('../types/feishu-catchup').Document>;
  calendarEvents: Repository<import('../types/feishu-catchup').CalendarEvent>;
  driveFiles: Repository<import('../types/feishu-catchup').DriveFile>;
  notifications: Repository<import('../types/feishu-catchup').Notification>;

  /** 自研身份系统 (Native Auth) */
  auth: AuthStore;

  /** 组织实体 · 企业微信「上下游」供应链模型 (anchor 上游 / downstream 下游 / individual 个人下游) */
  organizations: Repository<import('../types/organization').Organization>;

  /** 外部人员注册申请 (审批制) — 区别于即时邀请码 */
  authApplications: Repository<import('../types/auth-application').AuthApplication>;

  /** 搭子手抄 · AI 笔记 (独立模块, KvStore-based) */
  shouchaoNotes: Repository<import('../types/shouchao').ShouchaoNote>;

  /** 知识库 · 文件树节点 (后端持久化, 替代原纯前端 localStorage) */
  knowledgeNodes: Repository<import('../types/knowledge').KnowledgeNode>;

  /** 三省六部项目治理 · 战略项目实体 (Phase 2) */
  governanceProjects: Repository<import('../types/governance').GovernanceProject>;
  /** 三省六部项目治理 · 每个项目的协同模板 (id = projectId) */
  governanceTemplates: Repository<import('../types/governance').GovernanceTemplate>;
  /** 三省六部模板版本快照 (id = `{projectId}:{version}`) */
  governanceTemplateVersions: Repository<import('../types/governance').GovernanceTemplateVersion>;

  /** 通用审批单 (采购/请假等, KvStore-based) */
  approvals: Repository<import('../types/approval').Approval>;

  /** 会议室预订 (KvStore-based) */
  meetingBookings: Repository<import('../types/meeting-booking').MeetingBooking>;

  /** AI 配置 (Admin UI 可热更新, 优先级高于 env) */
  aiSettings: Repository<import('../types/ai-settings').AiSettings>;

  /** Web Push 订阅记录 */
  pushSubscriptions: Repository<import('../infra/web-push').PushSubscriptionRecord>;
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
  /** 职务 / 岗位名称 */
  jobTitle?: string | null;
  /** 直属上级 userId */
  managerId?: string | null;
  /** 员工工号 (可选, HR 侧编号) */
  employeeId?: string | null;
  /** 入职日期 ISO string */
  hireDate?: string | null;
  /** 工作地点 */
  workLocation?: string | null;
  /** 手机 */
  phone?: string | null;
  /** 所属组织 (企业微信上下游模型); 未归属时为 null */
  orgId?: string | null;
  /** 成员身份类型 (internal / upstream_downstream / individual / linked / pending) */
  membershipType?: import('../types/organization').MembershipType;
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
  /**
   * §上下游: 邀请码携带的目标组织 id (上游邀请下游成员时绑定下游组织).
   * 注册时权威归属来源 — 优先于按角色推断. anchor/内部邀请可留空.
   */
  orgId?: string | null;
  /** §上下游: 邀请码携带的成员身份类型 (注册时权威归属来源). */
  membershipType?: import('../types/organization').MembershipType;
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
    /**
     * 滑动续期: 轮换 refresh token hash + 顺延过期时间 (桌面端长会话 §desktop).
     * 仅更新未撤销的活跃会话; 调用方负责校验有效性.
     */
    rotate(id: string, newRefreshTokenHash: string, newExpiresAt: string): Promise<void>;
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
