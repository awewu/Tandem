/**
 * In-Memory Store · 开发期 / 测试期使用
 *
 * 用于 Persona/Memory/OKR/IM/DecisionCard 等遗留模块. 重启即丢.
 * V1 GA 模型 (Document/Calendar/Drive/Notification) 已迁移到 Drizzle + PG, 见 lib/repositories/.
 */

import type {
  ListOptions,
  Repository,
  TenantLockedRepository,
  TandemStore,
  AuthStore,
  AuthUser,
  AuthSession,
  AuthInvite,
  AuthEvent,
  ImMessageRepository,
  ChannelMessageQuery,
  MessageSearchQuery,
} from './repository';
import type { ImMessage } from '../types/im';
import { generateId } from './repository';
import { getActiveTenantScope, isRecordVisibleInScope } from './tenant-scope';
import { instrumentBusinessRepositories } from '@/lib/business-log/repository';

function paginate<T>(rows: T[], opts?: ListOptions): T[] {
  if (!opts) return rows;
  const start = opts.offset ?? 0;
  const end = opts.limit !== undefined ? start + opts.limit : undefined;
  return rows.slice(start, end);
}

class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private data = new Map<string, T>();

  async get(id: string): Promise<T | null> {
    const item = this.data.get(id) ?? null;
    // 租户作用域激活时: 跨租户记录视为 not-found (不泄漏存在性).
    if (item !== null && !isRecordVisibleInScope(item)) return null;
    return item;
  }

  async list(filter?: Partial<T>, opts?: ListOptions): Promise<T[]> {
    const scopeActive = getActiveTenantScope() !== undefined;
    // 作用域激活时剥离调用方传入的 tenantId 键 (防越权列举, 与 drizzle applyTenantScopeToFilter
    // "覆盖 tenantId" 语义对齐); 租户维度改由 isRecordVisibleInScope 按有效租户判定.
    const entries = filter
      ? Object.entries(filter).filter(([key]) => !(scopeActive && key === 'tenantId'))
      : [];
    const all = Array.from(this.data.values());
    let filtered = entries.length
      ? all.filter((item) => entries.every(([key, val]) => (item as never)[key] === val))
      : all;
    // 逐条按有效租户 (tenantId ?? 'default') 过滤 (与 drizzle 列 eq 同口径,
    // 避免对无 tenantId 字段的记录 (如 ImMessage) 误滤为空).
    filtered = filtered.filter((item) => isRecordVisibleInScope(item));
    return paginate(filtered, opts);
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const id = data.id ?? generateId();
    const item = { ...(data as object), id } as T;
    this.data.set(id, item);
    return item;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = this.data.get(id);
    if (!existing) {
      throw new Error(`Record ${id} not found`);
    }
    const updated = { ...existing, ...data, id };
    this.data.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
  }
}

/** IM 消息仓储 (memory): 复用 scope-aware list, 再按 createdAt 做游标/限行. */
class InMemoryImMessageRepository
  extends InMemoryRepository<ImMessage>
  implements ImMessageRepository
{
  async listByChannel(
    channelId: string,
    query: ChannelMessageQuery = {},
  ): Promise<ImMessage[]> {
    const all = await this.list({ channelId } as Partial<ImMessage>);
    let msgs = all
      .filter((m) => !m.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (query.before) msgs = msgs.filter((m) => m.createdAt < query.before!);
    const limit = query.limit ?? 100;
    return msgs.slice(-limit);
  }

  async searchByBody(query: MessageSearchQuery): Promise<ImMessage[]> {
    const q = (query.query ?? '').trim().toLowerCase();
    if (!q) return [];
    const limit = query.limit ?? 30;
    const channelSet = query.channelIds && query.channelIds.length > 0
      ? new Set(query.channelIds)
      : null;
    const all = await this.list();
    return all
      .filter((m) => !m.deletedAt)
      .filter((m) => !channelSet || channelSet.has(m.channelId))
      .filter((m) => (m.body ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }
}

class InMemoryTenantLockedRepository<T extends { id: string }>
  extends InMemoryRepository<T>
  implements TenantLockedRepository<T>
{
  private mutationTails = new Map<string, Promise<unknown>>();

  withTenantMutation<R>(
    tenantId: string,
    mutation: (repository: Repository<T>) => Promise<R>,
  ): Promise<R> {
    const previous = this.mutationTails.get(tenantId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(() => mutation(this));
    this.mutationTails.set(tenantId, current);
    return current.finally(() => {
      if (this.mutationTails.get(tenantId) === current) this.mutationTails.delete(tenantId);
    });
  }
}

class InMemoryStewardRepo {
  private data = new Map<string, import('../types/memory').Steward>();

  async get(userId: string) {
    return this.data.get(userId) ?? null;
  }

  async set(s: import('../types/memory').Steward) {
    this.data.set(s.userId, s);
  }
}

// ---------------------------------------------------------------------------
// 自研身份系统 in-memory 实现
// ---------------------------------------------------------------------------

function createInMemoryAuthStore(): AuthStore {
  const users = new Map<string, AuthUser>();
  const passwordHashes = new Map<string, { hash: string; historyHashes?: string[] }>();
  const mfaSecrets = new Map<
    string,
    { encryptedSecret: string; recoveryCodeHashes: string[] }
  >();
  const sessions = new Map<string, AuthSession>();
  const invites = new Map<string, AuthInvite>();
  const events: (AuthEvent & { createdAt: string })[] = [];

  return {
    users: {
      async findByEmail(email) {
        const target = email.toLowerCase();
        return Array.from(users.values()).find((u) => u.email.toLowerCase() === target) ?? null;
      },
      async findById(id) {
        return users.get(id) ?? null;
      },
      async list(filter) {
        let arr = Array.from(users.values());
        if (filter?.tenantId) arr = arr.filter((u) => (u.tenantId ?? 'default') === filter.tenantId);
        return arr;
      },
      async create(input) {
        const id = generateId('user');
        const user: AuthUser = {
          id,
          email: input.email.toLowerCase(),
          name: input.name,
          roles: input.roles ?? [],
          tenantId: input.tenantId ?? 'default',
          disabled: false,
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: null,
          lastLoginIp: null,
          emailVerifiedAt: input.emailVerifiedAt ?? null,
          departmentId: input.departmentId ?? null,
          jobTitle: input.jobTitle ?? null,
          managerId: input.managerId ?? null,
          employeeId: input.employeeId ?? null,
          hireDate: input.hireDate ?? null,
          workLocation: input.workLocation ?? null,
          phone: input.phone ?? null,
          orgId: input.orgId ?? null,
          membershipType: input.membershipType,
        };
        users.set(id, user);
        return user;
      },
      async update(id, patch) {
        const u = users.get(id);
        if (!u) return;
        users.set(id, { ...u, ...patch });
      },
      async savePasswordHash(userId, hash) {
        const prev = passwordHashes.get(userId);
        const history = (prev?.historyHashes ?? []).slice(-4);
        if (prev?.hash) history.push(prev.hash);
        passwordHashes.set(userId, { hash, historyHashes: history });
      },
      async findPasswordHash(userId) {
        return passwordHashes.get(userId) ?? null;
      },
      async findMfaSecret(userId) {
        return mfaSecrets.get(userId) ?? null;
      },
      async saveMfaSecret(userId, encryptedSecret, recoveryCodeHashes) {
        mfaSecrets.set(userId, { encryptedSecret, recoveryCodeHashes });
      },
      async consumeRecoveryCode(userId, hash) {
        const m = mfaSecrets.get(userId);
        if (!m) return;
        m.recoveryCodeHashes = m.recoveryCodeHashes.filter((h) => h !== hash);
      },
    },
    sessions: {
      async create(input) {
        const id = generateId('sess');
        const s: AuthSession = {
          id,
          userId: input.userId,
          refreshTokenHash: input.refreshTokenHash,
          mfaVerified: input.mfaVerified,
          expiresAt: input.expiresAt,
          revokedAt: null,
          userAgent: input.userAgent,
          ip: input.ip,
        };
        sessions.set(id, s);
        return s;
      },
      async findById(id) {
        return sessions.get(id) ?? null;
      },
      async findByRefreshHash(hash) {
        return Array.from(sessions.values()).find((s) => s.refreshTokenHash === hash) ?? null;
      },
      async revoke(id, reason) {
        const s = sessions.get(id);
        if (s) {
          s.revokedAt = new Date().toISOString();
          (s as AuthSession & { revokeReason?: string }).revokeReason = reason;
        }
      },
      async revokeAllForUser(userId, reason) {
        Array.from(sessions.values()).forEach((s) => {
          if (s.userId === userId && !s.revokedAt) {
            s.revokedAt = new Date().toISOString();
            (s as AuthSession & { revokeReason?: string }).revokeReason = reason;
          }
        });
      },
      async markMfaVerified(id) {
        const s = sessions.get(id);
        if (s) s.mfaVerified = true;
      },
      async rotate(id, newRefreshTokenHash, newExpiresAt) {
        const s = sessions.get(id);
        if (s && !s.revokedAt) {
          s.refreshTokenHash = newRefreshTokenHash;
          s.expiresAt = newExpiresAt;
        }
      },
    },
    invites: {
      async create(input) {
        const id = generateId('inv');
        const i: AuthInvite = {
          id,
          ...input,
          usedCount: 0,
          redeemedAt: null,
        };
        invites.set(id, i);
        return i;
      },
      async findByHash(hash) {
        return Array.from(invites.values()).find((i) => i.codeHash === hash) ?? null;
      },
      async list(filter) {
        let arr = Array.from(invites.values());
        if (filter?.invitedById) arr = arr.filter((i) => i.invitedById === filter.invitedById);
        if (filter?.tenantId) arr = arr.filter((i) => i.tenantId === filter.tenantId);
        return arr;
      },
      async markUsed(id) {
        const i = invites.get(id);
        if (!i) return;
        i.usedCount += 1;
        if (i.usedCount >= i.maxUses) i.redeemedAt = new Date().toISOString();
      },
      async revoke(id) {
        const i = invites.get(id);
        if (i) i.expiresAt = new Date().toISOString();
      },
    },
    events: {
      async append(event) {
        events.push({ ...event, createdAt: new Date().toISOString() });
        if (events.length > 10_000) events.shift();
      },
      async list(filter) {
        let arr = events;
        if (filter?.userId) arr = arr.filter((e) => e.userId === filter.userId);
        if (filter?.eventType) arr = arr.filter((e) => e.eventType === filter.eventType);
        if (filter?.sinceMs) {
          const cutoff = filter.sinceMs;
          arr = arr.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
        }
        return arr.slice(-1000);
      },
    },
  };
}

export function createInMemoryStore(): TandemStore {
  return instrumentBusinessRepositories({
    _storeKind: 'memory' as const,
    withMutationTransaction: (mutation) => mutation(),
    decisionCards: new InMemoryRepository(),
    personas: new InMemoryRepository(),
    agentTemplates: new InMemoryRepository(),
    // §CA-13 CompanyBrain 智能迭代闭环
    companyBrainDecisions: new InMemoryRepository(),
    companyBrainVersions: new InMemoryRepository(),
    companyBrainEvalCases: new InMemoryRepository(),
    companyBrainReflections: new InMemoryRepository(),
    // P0 Eval / Trace-Grading 台
    evalTraces: new InMemoryRepository(),
    evalAttributions: new InMemoryRepository(),
    episodicReflections: new InMemoryRepository(),
    correctionPatches: new InMemoryRepository(),
    origins: new InMemoryRepository(),
    materials: new InMemoryRepository(),
    memories: new InMemoryRepository(),
    promotions: new InMemoryRepository(),
    memoryCaptureCandidates: new InMemoryRepository(),
    downgrades: new InMemoryRepository(),
    stewards: new InMemoryStewardRepo(),
    cycles: new InMemoryRepository(),
    objectives: new InMemoryRepository(),
    keyResults: new InMemoryRepository(),
    ttis: new InMemoryRepository(),
    initiatives: new InMemoryRepository(),
    checkIns: new InMemoryRepository(),
    dailyReports: new InMemoryRepository(),

    // KPI 体系 (CHARTER-KPI-TTI §2)
    kpiCycles: new InMemoryRepository(),
    kpiSubjects: new InMemoryRepository(),
    kpis: new InMemoryRepository(),
    kpiCheckIns: new InMemoryRepository(),
    kpiSnapshots: new InMemoryRepository(),
    kpiManualEntries: new InMemoryRepository(),
    kpiBonusPayouts: new InMemoryRepository(),
    kpiCausalLinks: new InMemoryRepository(),
    kpiTargetAmendments: new InMemoryRepository(),
    imChannels: new InMemoryRepository(),
    imMessages: new InMemoryImMessageRepository(),
    imMemberships: new InMemoryRepository(),
    imPresence: new InMemoryRepository(),
    imMentionInbox: new InMemoryRepository(),
    oneOnOneMeetings: new InMemoryRepository(),
    oneOnOneActionItems: new InMemoryRepository(),
    review360Cycles: new InMemoryRepository(),
    review360Submissions: new InMemoryRepository(),
    review360Assignments: new InMemoryRepository(),
    skillRegistry: new InMemoryRepository(),
    skillProposals: new InMemoryRepository(),
    bitableTables: new InMemoryRepository(),
    bitableViews: new InMemoryRepository(),
    intranetPosts: new InMemoryRepository(),
    proxyActions: new InMemoryRepository(),
    personaFeedbacks: new InMemoryRepository(),
    lessons: new InMemoryRepository(),
    learningAttempts: new InMemoryRepository(),
    learningCertifications: new InMemoryRepository(),
    learningEnrollments: new InMemoryRepository(),
    llmPreferences: new InMemoryRepository(),
    reportViewPreferences: new InMemoryRepository(),
    reportSummaries: new InMemoryRepository(),
    tenantAiPolicies: new InMemoryRepository(),
    mobileFeatureConfigs: new InMemoryRepository(),
    legalDocuments: new InMemoryRepository(),
    workspaceManifests: new InMemoryRepository(),
    personaConstitutions: new InMemoryRepository(),
    documents: new InMemoryRepository(),
    calendarEvents: new InMemoryRepository(),
    driveFiles: new InMemoryRepository(),
    notifications: new InMemoryRepository(),
    auth: createInMemoryAuthStore(),
    organizations: new InMemoryRepository(),
    authApplications: new InMemoryRepository(),
    shouchaoNotes: new InMemoryRepository(),
    shouchaoNotebooks: new InMemoryRepository(),
    shouchaoAttachments: new InMemoryRepository(),
    shouchaoDatabases: new InMemoryRepository(),
    shouchaoRows: new InMemoryRepository(),
    shouchaoDistillCandidates: new InMemoryRepository(),
    knowledgeNodes: new InMemoryRepository(),
    driveDistillationCandidates: new InMemoryRepository(),
    governanceProjects: new InMemoryRepository(),
    governanceTemplates: new InMemoryRepository(),
    governanceTemplateVersions: new InMemoryRepository(),
    approvals: new InMemoryRepository(),
    workflowForms: new InMemoryRepository(),
    workflowTemplates: new InMemoryRepository(),
    workflowBindings: new InMemoryRepository(),
    workflowFormInstances: new InMemoryRepository(),
    workflowInstances: new InMemoryRepository(),
    workflowTasks: new InMemoryRepository(),
    workflowTaskForms: new InMemoryRepository(),
    workflowCcs: new InMemoryRepository(),
    meetingBookings: new InMemoryRepository(),
    aiSettings: new InMemoryRepository(),
    hardRefuseConfig: new InMemoryRepository(),
    mcpServers: new InMemoryRepository(),
    pushSubscriptions: new InMemoryRepository(),
    globalEmailConfigs: new InMemoryTenantLockedRepository(),
    userEmailCredentials: new InMemoryRepository(),
    calendarJobs: new InMemoryRepository(),
    calendarActivityLogs: new InMemoryRepository(),
    calendarSyncStates: new InMemoryRepository(),
    // PMS 不走仓储抽象 (lib/pms/*-service.ts 直连 drizzle typed 表).
  });
}
