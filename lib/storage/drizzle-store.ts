/**
 * Drizzle Store · PostgreSQL 持久化
 *
 * 两层实现:
 *   1. DrizzleKvRepository<T> — 遗留模块用 KvStore JSONB 表 (接口稳定, 逐步升级)
 *   2. 强类型 Repository — KPI 体系 8 张表已升级 (B-019/B-020):
 *        KpiCycle / KpiSubject / Kpi / KpiCheckIn / KpiSnapshot /
 *        KpiManualEntry / KpiBonusPayout / KpiCausalLink
 * §T6: 后续热表按需升级, Repository<T> 接口保持稳定.
 */

import { and, eq, sql, desc, asc, gte, lte, isNull } from 'drizzle-orm';
import { db, schema } from '../infra/drizzle-client';
import type {
  ListOptions,
  Repository,
  TandemStore,
  AuthStore,
  AuthUser,
  AuthSession,
  AuthInvite,
  AuthEvent,
} from './repository';
import type {
  KpiCycle,
  KpiSubject,
  Kpi,
  KpiCheckIn,
  KpiSnapshot,
  KpiManualEntry,
  KpiBonusPayout,
  KpiCausalLink,
} from '../types/kpi';
import { generateId } from './repository';
// DB-AUDIT P1 · classifier 提取到独立无 db-import 文件 (便于单测).
import { classifyKvFilter } from './kv-filter';

const kv = schema.kvStore;

export { SAFE_KEY_RE, classifyKvFilter } from './kv-filter';

// ---------------------------------------------------------------------------
// 通用 JSON Repository
// ---------------------------------------------------------------------------

class DrizzleKvRepository<T extends { id: string }> implements Repository<T> {
  constructor(private readonly collection: string) {}

  async get(id: string): Promise<T | null> {
    const rows = await db
      .select()
      .from(kv)
      .where(and(eq(kv.collection, this.collection), eq(kv.id, id)))
      .limit(1);
    return rows[0] ? (rows[0].data as T) : null;
  }

  async list(filter?: Partial<T>, opts?: ListOptions): Promise<T[]> {
    // ────────────────────────────────────────────────────────────────────
    // C2/C1 + P1 (DB-AUDIT 2026-06-09): 把可下推的 filter 都推到 SQL,
    //   减少"加载全集合 → JS 过滤"的内存与网络开销.
    //   - tenantId 列下推 (0006 回填后列已复活)
    //   - 其余 string 类型 filter 走 JSONB ->> 表达式 + 参数绑定
    //   - number / boolean / object 留给 JS 兜底 (避免 ->> 类型转换坑)
    //   - 仅当无 JS 兜底键 (= 全部下推成功) 时才把 limit/offset 也推到 SQL,
    //     否则 SQL 限行会发生在 JS 过滤之前 → 语义错误.
    //   key 必须是合法标识符 ([A-Za-z_][A-Za-z0-9_]*), 防 SQL 注入 (虽然 key 来自
    //   typed Partial<T> 编译期源, 但兜底校验保留, 兜底成本 ≈ 0).
    // ────────────────────────────────────────────────────────────────────
    const filterRec = (filter as Record<string, unknown> | undefined) ?? {};
    const cls = classifyKvFilter(filterRec);

    const conds = [eq(kv.collection, this.collection)] as Array<ReturnType<typeof eq> | ReturnType<typeof sql>>;
    if (cls.tenantId) conds.push(eq(kv.tenantId, cls.tenantId));
    for (const { key, value } of cls.jsonbStringKeys) {
      // sql.raw on key is safe because classifyKvFilter已用 SAFE_KEY_RE 校验;
      // value 走标准参数绑定 (Drizzle 自动 prepared statement).
      conds.push(sql`${kv.data}->>${sql.raw(`'${key}'`)} = ${value}`);
    }

    const where = conds.length === 1 ? conds[0] : and(...conds);

    let q = db.select().from(kv).where(where).orderBy(desc(kv.updatedAt)).$dynamic();
    if (opts && cls.canPushLimit) {
      if (opts.limit !== undefined) q = q.limit(opts.limit);
      if (opts.offset !== undefined) q = q.offset(opts.offset);
    }
    const rows = await q;
    const all = rows.map((r) => r.data as T);
    if (cls.jsFallbackKeys.length === 0) return all;

    const filtered = all.filter((item) =>
      cls.jsFallbackKeys.every(
        (key) => (item as Record<string, unknown>)[key] === filterRec[key],
      ),
    );
    // 退化路径: limit/offset 在 JS 过滤后切片 (仍兜底返回行数, 但 DB 仍加载了 tenant 全量).
    if (!opts) return filtered;
    const start = opts.offset ?? 0;
    const end = opts.limit !== undefined ? start + opts.limit : undefined;
    return filtered.slice(start, end);
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const id = data.id ?? generateId();
    const item = { ...(data as object), id } as T;
    // C1: 把 data.tenantId 落到 tenantId 列 (历史只写 JSONB, 列恒为 'default' → 索引死).
    const tenantId =
      ((item as Record<string, unknown>).tenantId as string | undefined) ?? 'default';
    await db
      .insert(kv)
      .values({ collection: this.collection, id, data: item as object, tenantId })
      .onConflictDoUpdate({
        target: [kv.collection, kv.id],
        set: { data: item as object, tenantId, updatedAt: new Date() },
      });
    return item;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Record ${this.collection}/${id} not found`);
    const updated = { ...existing, ...patch, id } as T;
    // C1: 写更新时保持 tenantId 列与 JSONB 同步.
    const tenantId =
      ((updated as Record<string, unknown>).tenantId as string | undefined) ?? 'default';
    await db
      .update(kv)
      .set({ data: updated as object, tenantId, updatedAt: new Date() })
      .where(and(eq(kv.collection, this.collection), eq(kv.id, id)));
    return updated;
  }

  async delete(id: string): Promise<void> {
    await db.delete(kv).where(and(eq(kv.collection, this.collection), eq(kv.id, id)));
  }
}

// ---------------------------------------------------------------------------
// Steward (single entity per userId)
// ---------------------------------------------------------------------------

class DrizzleStewardRepo {
  private readonly collection = 'stewards';

  async get(userId: string) {
    const rows = await db
      .select()
      .from(kv)
      .where(and(eq(kv.collection, this.collection), eq(kv.id, userId)))
      .limit(1);
    return rows[0] ? (rows[0].data as import('../types/memory').Steward) : null;
  }

  async set(s: import('../types/memory').Steward) {
    await db
      .insert(kv)
      .values({ collection: this.collection, id: s.userId, data: s as object })
      .onConflictDoUpdate({
        target: [kv.collection, kv.id],
        set: { data: s as object, updatedAt: new Date() },
      });
  }
}

// ---------------------------------------------------------------------------
// AuthStore · users 落 User 表, 其余落 KvStore
// ---------------------------------------------------------------------------

function authUserFromRow(row: typeof schema.user.$inferSelect): AuthUser {
  const extras = ((row as Record<string, unknown>).data as Record<string, unknown> | undefined) ?? {};
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    roles: row.roles ?? [],
    tenantId: row.tenantId,
    disabled: row.disabled,
    emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
    failedLoginCount: (extras.failedLoginCount as number | undefined) ?? 0,
    lockedUntil: (extras.lockedUntil as string | null | undefined) ?? null,
    lastLoginAt: (extras.lastLoginAt as string | null | undefined) ?? null,
    lastLoginIp: (extras.lastLoginIp as string | null | undefined) ?? null,
    departmentId: (extras.departmentId as string | null | undefined) ?? null,
  };
}

function createDrizzleAuthStore(): AuthStore {
  // password / mfa / session / invite / event 用 KvStore 命名空间
  const pwdRepo = new DrizzleKvRepository<{ id: string; hash: string; historyHashes?: string[] }>(
    'auth_password',
  );
  const mfaRepo = new DrizzleKvRepository<{
    id: string;
    encryptedSecret: string;
    recoveryCodeHashes: string[];
  }>('auth_mfa');
  const sessRepo = new DrizzleKvRepository<AuthSession>('auth_session');
  const inviteRepo = new DrizzleKvRepository<AuthInvite>('auth_invite');
  const eventsRepo = new DrizzleKvRepository<AuthEvent & { id: string; createdAt: string }>(
    'auth_event',
  );
  // 用户附加字段 (lastLoginAt 等) 落 KvStore auth_user_extras
  const extrasRepo = new DrizzleKvRepository<{
    id: string;
    failedLoginCount?: number;
    lockedUntil?: string | null;
    lastLoginAt?: string | null;
    lastLoginIp?: string | null;
    departmentId?: string | null;
    orgId?: string | null;
    membershipType?: import('../types/organization').MembershipType;
  }>('auth_user_extras');

  async function fetchUserComposite(row: typeof schema.user.$inferSelect): Promise<AuthUser> {
    const extras = await extrasRepo.get(row.id);
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      roles: row.roles ?? [],
      tenantId: row.tenantId,
      disabled: row.disabled,
      emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : null,
      failedLoginCount: extras?.failedLoginCount ?? 0,
      lockedUntil: extras?.lockedUntil ?? null,
      lastLoginAt: extras?.lastLoginAt ?? null,
      lastLoginIp: extras?.lastLoginIp ?? null,
      departmentId: extras?.departmentId ?? null,
      orgId: extras?.orgId ?? null,
      membershipType: extras?.membershipType,
    };
  }
  void authUserFromRow;

  return {
    users: {
      async findByEmail(email) {
        // C5: 排除软删用户 (deletedAt 非空) — 防软删账号仍可被命中/登录.
        const rows = await db
          .select()
          .from(schema.user)
          .where(and(eq(schema.user.email, email.toLowerCase()), isNull(schema.user.deletedAt)))
          .limit(1);
        return rows[0] ? fetchUserComposite(rows[0]) : null;
      },
      async findById(id) {
        const rows = await db
          .select()
          .from(schema.user)
          .where(and(eq(schema.user.id, id), isNull(schema.user.deletedAt)))
          .limit(1);
        return rows[0] ? fetchUserComposite(rows[0]) : null;
      },
      async list(filter) {
        const tenantId = filter?.tenantId;
        const where = tenantId
          ? and(eq(schema.user.tenantId, tenantId), isNull(schema.user.deletedAt))
          : isNull(schema.user.deletedAt);
        const rows = await db.select().from(schema.user).where(where);
        return Promise.all(rows.map((r) => fetchUserComposite(r)));
      },
      async create(input) {
        const id = generateId('user');
        const now = new Date();
        const row = {
          id,
          email: input.email.toLowerCase(),
          name: input.name,
          roles: input.roles ?? [],
          tenantId: input.tenantId ?? 'default',
          disabled: false,
          emailVerifiedAt: input.emailVerifiedAt ? new Date(input.emailVerifiedAt) : null,
          updatedAt: now,
        };
        const [inserted] = await db.insert(schema.user).values(row).returning();
        if (input.departmentId || input.orgId || input.membershipType) {
          await extrasRepo.create({
            id,
            departmentId: input.departmentId ?? null,
            orgId: input.orgId ?? null,
            membershipType: input.membershipType,
          });
        }
        return fetchUserComposite(inserted);
      },
      async update(id, patch) {
        const dbPatch: Partial<typeof schema.user.$inferInsert> = { updatedAt: new Date() };
        if (patch.email !== undefined) dbPatch.email = patch.email.toLowerCase();
        if (patch.name !== undefined) dbPatch.name = patch.name;
        if (patch.roles !== undefined) dbPatch.roles = patch.roles;
        if (patch.tenantId !== undefined) dbPatch.tenantId = patch.tenantId;
        if (patch.disabled !== undefined) dbPatch.disabled = patch.disabled;
        if (patch.emailVerifiedAt !== undefined) {
          dbPatch.emailVerifiedAt = patch.emailVerifiedAt ? new Date(patch.emailVerifiedAt) : null;
        }
        if (Object.keys(dbPatch).length > 1) {
          await db.update(schema.user).set(dbPatch).where(eq(schema.user.id, id));
        }
        const extrasPatch: Partial<{
          failedLoginCount: number;
          lockedUntil: string | null;
          lastLoginAt: string | null;
          lastLoginIp: string | null;
          departmentId: string | null;
          orgId: string | null;
          membershipType: import('../types/organization').MembershipType;
        }> = {};
        if (patch.failedLoginCount !== undefined)
          extrasPatch.failedLoginCount = patch.failedLoginCount;
        if (patch.lockedUntil !== undefined) extrasPatch.lockedUntil = patch.lockedUntil;
        if (patch.lastLoginAt !== undefined) extrasPatch.lastLoginAt = patch.lastLoginAt;
        if (patch.lastLoginIp !== undefined) extrasPatch.lastLoginIp = patch.lastLoginIp;
        if (patch.departmentId !== undefined) extrasPatch.departmentId = patch.departmentId;
        if (patch.orgId !== undefined) extrasPatch.orgId = patch.orgId;
        if (patch.membershipType !== undefined) extrasPatch.membershipType = patch.membershipType;
        if (Object.keys(extrasPatch).length > 0) {
          const existing = await extrasRepo.get(id);
          await extrasRepo.create({ ...(existing ?? { id }), ...extrasPatch, id });
        }
      },
      async savePasswordHash(userId, hash) {
        const prev = await pwdRepo.get(userId);
        const history = (prev?.historyHashes ?? []).slice(-4);
        if (prev?.hash) history.push(prev.hash);
        await pwdRepo.create({ id: userId, hash, historyHashes: history });
      },
      async findPasswordHash(userId) {
        const r = await pwdRepo.get(userId);
        return r ? { hash: r.hash, historyHashes: r.historyHashes } : null;
      },
      async findMfaSecret(userId) {
        const r = await mfaRepo.get(userId);
        return r ? { encryptedSecret: r.encryptedSecret, recoveryCodeHashes: r.recoveryCodeHashes } : null;
      },
      async saveMfaSecret(userId, encryptedSecret, recoveryCodeHashes) {
        await mfaRepo.create({ id: userId, encryptedSecret, recoveryCodeHashes });
      },
      async consumeRecoveryCode(userId, hash) {
        const m = await mfaRepo.get(userId);
        if (!m) return;
        await mfaRepo.update(userId, {
          recoveryCodeHashes: m.recoveryCodeHashes.filter((h) => h !== hash),
        });
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
        await sessRepo.create(s);
        return s;
      },
      async findById(id) {
        return sessRepo.get(id);
      },
      async findByRefreshHash(hash) {
        const rows = await db
          .select()
          .from(kv)
          .where(and(
            eq(kv.collection, 'auth_session'),
            sql`${kv.data}->>'refreshTokenHash' = ${hash}`
          ))
          .limit(1);
        return rows[0] ? (rows[0].data as AuthSession) : null;
      },
      async revoke(id, reason) {
        const s = await sessRepo.get(id);
        if (!s) return;
        await sessRepo.update(id, {
          revokedAt: new Date().toISOString(),
          ...({ revokeReason: reason } as Partial<AuthSession>),
        });
      },
      async revokeAllForUser(userId, reason) {
        const rows = await db
          .select()
          .from(kv)
          .where(and(
            eq(kv.collection, 'auth_session'),
            sql`${kv.data}->>'userId' = ${userId}`
          ));
        const all = rows.map((r) => r.data as AuthSession);
        for (const s of all) {
          if (!s.revokedAt) {
            await sessRepo.update(s.id, {
              revokedAt: new Date().toISOString(),
              ...({ revokeReason: reason } as Partial<AuthSession>),
            });
          }
        }
      },
      async markMfaVerified(id) {
        const s = await sessRepo.get(id);
        if (s) await sessRepo.update(id, { mfaVerified: true });
      },
    },
    invites: {
      async create(input) {
        const id = generateId('inv');
        const i: AuthInvite = { id, ...input, usedCount: 0, redeemedAt: null };
        await inviteRepo.create(i);
        return i;
      },
      async findByHash(hash) {
        const rows = await db
          .select()
          .from(kv)
          .where(and(
            eq(kv.collection, 'auth_invite'),
            sql`${kv.data}->>'codeHash' = ${hash}`
          ))
          .limit(1);
        return rows[0] ? (rows[0].data as AuthInvite) : null;
      },
      async list(filter) {
        const conds = [eq(kv.collection, 'auth_invite')];
        if (filter?.invitedById) {
          conds.push(sql`${kv.data}->>'invitedById' = ${filter.invitedById}`);
        }
        if (filter?.tenantId) {
          conds.push(sql`${kv.data}->>'tenantId' = ${filter.tenantId}`);
        }
        const rows = await db
          .select()
          .from(kv)
          .where(and(...conds))
          .orderBy(desc(kv.updatedAt));
        return rows.map((r) => r.data as AuthInvite);
      },
      async markUsed(id) {
        const i = await inviteRepo.get(id);
        if (!i) return;
        const usedCount = i.usedCount + 1;
        const redeemedAt = usedCount >= i.maxUses ? new Date().toISOString() : i.redeemedAt;
        await inviteRepo.update(id, { usedCount, redeemedAt });
      },
      async revoke(id) {
        await inviteRepo.update(id, { expiresAt: new Date().toISOString() });
      },
    },
    events: {
      async append(event) {
        const id = generateId('evt');
        const createdAt = new Date().toISOString();
        await eventsRepo.create({ ...event, id, createdAt });
        
        // 分摊剪裁 (Amortized pruning): 仅以 1% 概率运行后台清理，且绝不阻塞响应
        if (Math.random() < 0.01) {
          void (async () => {
            try {
              const total = await db
                .select({ c: sql<number>`count(*)` })
                .from(kv)
                .where(eq(kv.collection, 'auth_event'));
              if (Number(total[0]?.c ?? 0) > 10_000) {
                await db.execute(
                  sql`DELETE FROM "KvStore" WHERE collection = 'auth_event' AND id IN (SELECT id FROM "KvStore" WHERE collection = 'auth_event' ORDER BY "createdAt" ASC LIMIT 1000)`,
                );
              }
            } catch (err) {
              // 守护后台任务，防报错崩溃影响主流程; 但不静默吞错 (C7), 留告警便于排障.
              // eslint-disable-next-line no-console
              console.warn('[drizzle-store] auth_event amortized prune failed:', err);
            }
          })();
        }
      },
      async list(filter) {
        const conds = [eq(kv.collection, 'auth_event')];
        if (filter?.userId) {
          conds.push(sql`${kv.data}->>'userId' = ${filter.userId}`);
        }
        if (filter?.eventType) {
          conds.push(sql`${kv.data}->>'eventType' = ${filter.eventType}`);
        }
        const rows = await db
          .select()
          .from(kv)
          .where(and(...conds))
          .orderBy(desc(kv.updatedAt))
          .limit(1000);
        let arr = rows.map((r) => r.data as AuthEvent & { id: string; createdAt: string });
        if (filter?.sinceMs) {
          const cutoff = filter.sinceMs;
          arr = arr.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
        }
        return arr.slice(0, 1000).map((e) => ({
          userId: e.userId,
          email: e.email,
          eventType: e.eventType,
          ip: e.ip,
          userAgent: e.userAgent,
          metadata: e.metadata,
          createdAt: e.createdAt,
        }));
      },
    },
  };
}

// ---------------------------------------------------------------------------
// KPI 强类型 Repository 实现 (B-019 / B-020)
// ---------------------------------------------------------------------------

type KpiCycleRow = typeof schema.kpiCycle.$inferSelect;
type KpiSubjectRow = typeof schema.kpiSubject.$inferSelect;
type KpiRow = typeof schema.kpi.$inferSelect;
type KpiCheckInRow = typeof schema.kpiCheckIn.$inferSelect;
type KpiSnapshotRow = typeof schema.kpiSnapshot.$inferSelect;
type KpiManualEntryRow = typeof schema.kpiManualEntry.$inferSelect;
type KpiBonusPayoutRow = typeof schema.kpiBonusPayout.$inferSelect;
type KpiCausalLinkRow = typeof schema.kpiCausalLink.$inferSelect;

function rowToKpiCycle(r: KpiCycleRow): KpiCycle {
  return {
    id: r.id,
    fiscalYear: r.fiscalYear,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    status: r.status as KpiCycle['status'],
    tenantId: r.tenantId,
    targetsLockedAt: r.targetsLockedAt?.toISOString(),
    closedAt: r.closedAt?.toISOString(),
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToKpiSubject(r: KpiSubjectRow): KpiSubject {
  return {
    id: r.id,
    parentId: r.parentId ?? undefined,
    code: r.code,
    name: r.name,
    description: r.description ?? undefined,
    bscPerspective: r.bscPerspective as KpiSubject['bscPerspective'] ?? undefined,
    level: r.level,
    defaultScope: r.defaultScope as KpiSubject['defaultScope'],
    defaultUnit: r.defaultUnit ?? undefined,
    defaultMeasureType: r.defaultMeasureType as KpiSubject['defaultMeasureType'],
    active: r.active,
    tenantId: r.tenantId,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToKpi(r: KpiRow): Kpi {
  return {
    id: r.id,
    cycleId: r.cycleId,
    subjectId: r.subjectId,
    bscPerspective: r.bscPerspective as Kpi['bscPerspective'] ?? undefined,
    level: r.level as Kpi['level'],
    parentKpiId: r.parentKpiId ?? undefined,
    assigneeId: r.assigneeId,
    departmentId: r.departmentId ?? undefined,
    title: r.title,
    description: r.description ?? undefined,
    measureType: r.measureType as Kpi['measureType'],
    startValue: Number(r.startValue),
    targetValue: Number(r.targetValue),
    currentValue: Number(r.currentValue),
    unit: r.unit ?? undefined,
    weight: Number(r.weight),
    dataSource: r.dataSource as Kpi['dataSource'],
    scope: r.scope as Kpi['scope'],
    tenantId: r.tenantId,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToKpiCheckIn(r: KpiCheckInRow): KpiCheckIn {
  return {
    id: r.id,
    kpiId: r.kpiId,
    asOf: r.asOf,
    cumulativeValue: Number(r.cumulativeValue),
    delta: Number(r.delta),
    source: r.source as KpiCheckIn['source'],
    note: r.note ?? undefined,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

function rowToKpiSnapshot(r: KpiSnapshotRow): KpiSnapshot {
  return {
    id: r.id,
    kpiId: r.kpiId,
    date: r.date,
    cumulativeValue: Number(r.cumulativeValue),
    source: r.source as KpiSnapshot['source'],
    breakdown: r.breakdown as KpiSnapshot['breakdown'] ?? undefined,
    createdAt: r.createdAt.toISOString(),
  };
}

function rowToKpiManualEntry(r: KpiManualEntryRow): KpiManualEntry {
  return {
    id: r.id,
    kpiId: r.kpiId,
    operatorId: r.operatorId,
    operatorRole: r.operatorRole as KpiManualEntry['operatorRole'],
    fromValue: Number(r.fromValue),
    toValue: Number(r.toValue),
    reason: r.reason,
    evidenceUrl: r.evidenceUrl ?? undefined,
    tenantId: r.tenantId,
    createdAt: r.createdAt.toISOString(),
  };
}

function rowToKpiBonusPayout(r: KpiBonusPayoutRow): KpiBonusPayout {
  return {
    id: r.id,
    cycleId: r.cycleId,
    assigneeId: r.assigneeId,
    baseBonus: Number(r.baseBonus),
    weightedCompletion: Number(r.weightedCompletion),
    finalBonus: Number(r.finalBonus),
    contributions: r.contributions as KpiBonusPayout['contributions'],
    calculatedAt: r.calculatedAt.toISOString(),
    calculatedBy: r.calculatedBy,
    committed: r.committed,
    committedAt: r.committedAt?.toISOString(),
    note: r.note ?? undefined,
    tenantId: r.tenantId,
  };
}

function rowToKpiCausalLink(r: KpiCausalLinkRow): KpiCausalLink {
  return {
    id: r.id,
    cycleId: r.cycleId,
    fromKpiId: r.fromKpiId,
    toKpiId: r.toKpiId,
    strength: Number(r.strength),
    hypothesis: r.hypothesis ?? undefined,
    validated: r.validated,
    validatedAt: r.validatedAt?.toISOString(),
    validatedBy: r.validatedBy ?? undefined,
    validationNote: r.validationNote ?? undefined,
    tenantId: r.tenantId,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function createKpiCycleRepo(): import('./repository').Repository<KpiCycle> {
  const t = schema.kpiCycle;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpiCycle(rows[0]) : null;
    },
    async list(filter) {
      const rows = await db
        .select()
        .from(t)
        .where(filter?.tenantId ? eq(t.tenantId, filter.tenantId as string) : undefined)
        .orderBy(desc(t.createdAt));
      const all = rows.map(rowToKpiCycle);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('kc');
      const now = new Date();
      const row = {
        ...data,
        id,
        targetsLockedAt: data.targetsLockedAt ? new Date(data.targetsLockedAt) : null,
        closedAt: data.closedAt ? new Date(data.closedAt) : null,
        createdAt: new Date(data.createdAt ?? now),
        updatedAt: new Date(data.updatedAt ?? now),
      } as typeof t.$inferInsert;
      await db.insert(t).values(row).onConflictDoUpdate({
        target: t.id,
        set: { ...row, updatedAt: now },
      });
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const now = new Date();
      const dbPatch: Partial<typeof t.$inferInsert> = { updatedAt: now };
      if (patch.fiscalYear !== undefined) dbPatch.fiscalYear = patch.fiscalYear;
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.startDate !== undefined) dbPatch.startDate = patch.startDate;
      if (patch.endDate !== undefined) dbPatch.endDate = patch.endDate;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.targetsLockedAt !== undefined)
        dbPatch.targetsLockedAt = patch.targetsLockedAt ? new Date(patch.targetsLockedAt) : null;
      if (patch.closedAt !== undefined)
        dbPatch.closedAt = patch.closedAt ? new Date(patch.closedAt) : null;
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

function createKpiSubjectRepo(): import('./repository').Repository<KpiSubject> {
  const t = schema.kpiSubject;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpiSubject(rows[0]) : null;
    },
    async list(filter) {
      const rows = await db
        .select()
        .from(t)
        .where(filter?.tenantId ? eq(t.tenantId, filter.tenantId as string) : undefined)
        .orderBy(asc(t.level), asc(t.code));
      const all = rows.map(rowToKpiSubject);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('ks');
      const now = new Date();
      const row = {
        ...data,
        id,
        parentId: data.parentId ?? null,
        description: data.description ?? null,
        bscPerspective: data.bscPerspective ?? null,
        defaultUnit: data.defaultUnit ?? null,
        createdAt: new Date(data.createdAt ?? now),
        updatedAt: new Date(data.updatedAt ?? now),
      } as typeof t.$inferInsert;
      await db.insert(t).values(row).onConflictDoUpdate({
        target: t.id,
        set: { ...row, updatedAt: now },
      });
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const now = new Date();
      const dbPatch: Partial<typeof t.$inferInsert> = { updatedAt: now };
      const fields = ['code','name','description','bscPerspective','level','defaultScope','defaultUnit','defaultMeasureType','active','parentId'] as const;
      for (const f of fields) {
        if ((patch as Record<string, unknown>)[f] !== undefined)
          (dbPatch as Record<string, unknown>)[f] = (patch as Record<string, unknown>)[f] ?? null;
      }
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

function createKpiRepo(): import('./repository').Repository<Kpi> {
  const t = schema.kpi;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpi(rows[0]) : null;
    },
    async list(filter) {
      let q = db.select().from(t).$dynamic();
      q = q.where(
        and(
          filter?.cycleId ? eq(t.cycleId, filter.cycleId as string) : undefined,
          filter?.assigneeId && !filter?.cycleId
            ? eq(t.assigneeId, filter.assigneeId as string)
            : undefined,
          filter?.tenantId ? eq(t.tenantId, filter.tenantId as string) : undefined,
        ),
      );
      const rows = await q.orderBy(desc(t.createdAt));
      const all = rows.map(rowToKpi);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('kpi');
      const now = new Date();
      const row = {
        ...data,
        id,
        startValue: String(data.startValue ?? 0),
        targetValue: String(data.targetValue ?? 0),
        currentValue: String(data.currentValue ?? 0),
        weight: String(data.weight ?? 0),
        parentKpiId: data.parentKpiId ?? null,
        departmentId: data.departmentId ?? null,
        description: data.description ?? null,
        bscPerspective: data.bscPerspective ?? null,
        unit: data.unit ?? null,
        createdAt: new Date(data.createdAt ?? now),
        updatedAt: new Date(data.updatedAt ?? now),
      } as typeof t.$inferInsert;
      await db.insert(t).values(row).onConflictDoUpdate({
        target: t.id,
        set: { ...row, updatedAt: now },
      });
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const now = new Date();
      const dbPatch: Partial<typeof t.$inferInsert> = { updatedAt: now };
      const numericFields = ['startValue','targetValue','currentValue','weight'] as const;
      for (const f of numericFields) {
        if ((patch as Record<string, unknown>)[f] !== undefined)
          (dbPatch as Record<string, unknown>)[f] = String((patch as Record<string, unknown>)[f]);
      }
      const textFields = ['title','description','bscPerspective','level','parentKpiId','assigneeId','departmentId','measureType','unit','dataSource','scope','subjectId','cycleId'] as const;
      for (const f of textFields) {
        if ((patch as Record<string, unknown>)[f] !== undefined)
          (dbPatch as Record<string, unknown>)[f] = (patch as Record<string, unknown>)[f] ?? null;
      }
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

function createKpiCheckInRepo(): import('./repository').Repository<KpiCheckIn> {
  const t = schema.kpiCheckIn;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpiCheckIn(rows[0]) : null;
    },
    async list(filter) {
      // 注: KpiCheckIn 领域类型不含 tenantId 字段, 仅按 kpiId 下推.
      let q = db.select().from(t).$dynamic();
      if (filter?.kpiId) q = q.where(eq(t.kpiId, filter.kpiId as string));
      const rows = await q.orderBy(asc(t.asOf));
      const all = rows.map(rowToKpiCheckIn);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('kci');
      const now = new Date();
      const row = {
        ...data,
        id,
        cumulativeValue: String(data.cumulativeValue),
        delta: String(data.delta ?? 0),
        note: data.note ?? null,
        createdAt: new Date(data.createdAt ?? now),
      } as typeof t.$inferInsert;
      await db.insert(t).values(row);
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const dbPatch: Partial<typeof t.$inferInsert> = {};
      if (patch.note !== undefined) dbPatch.note = patch.note ?? null;
      if (patch.cumulativeValue !== undefined) dbPatch.cumulativeValue = String(patch.cumulativeValue);
      if (patch.delta !== undefined) dbPatch.delta = String(patch.delta);
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

function createKpiSnapshotRepo(): import('./repository').Repository<KpiSnapshot> {
  const t = schema.kpiSnapshot;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpiSnapshot(rows[0]) : null;
    },
    async list(filter) {
      // 注: KpiSnapshot 领域类型不含 tenantId 字段, 仅按 kpiId 下推.
      let q = db.select().from(t).$dynamic();
      if (filter?.kpiId) q = q.where(eq(t.kpiId, filter.kpiId as string));
      const rows = await q.orderBy(asc(t.date));
      const all = rows.map(rowToKpiSnapshot);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('ksn');
      const now = new Date();
      const row = {
        ...data,
        id,
        cumulativeValue: String(data.cumulativeValue),
        breakdown: data.breakdown ?? null,
        createdAt: new Date(data.createdAt ?? now),
      } as typeof t.$inferInsert;
      await db.insert(t).values(row).onConflictDoUpdate({
        target: [t.kpiId, t.date],
        set: { cumulativeValue: row.cumulativeValue, source: row.source, breakdown: row.breakdown },
      });
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const dbPatch: Partial<typeof t.$inferInsert> = {};
      if (patch.cumulativeValue !== undefined) dbPatch.cumulativeValue = String(patch.cumulativeValue);
      if (patch.source !== undefined) dbPatch.source = patch.source;
      if (patch.breakdown !== undefined) dbPatch.breakdown = patch.breakdown ?? null;
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

function createKpiManualEntryRepo(): import('./repository').Repository<KpiManualEntry> {
  const t = schema.kpiManualEntry;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpiManualEntry(rows[0]) : null;
    },
    async list(filter) {
      let q = db.select().from(t).$dynamic();
      q = q.where(
        and(
          filter?.kpiId ? eq(t.kpiId, filter.kpiId as string) : undefined,
          filter?.tenantId ? eq(t.tenantId, filter.tenantId as string) : undefined,
        ),
      );
      const rows = await q.orderBy(desc(t.createdAt));
      const all = rows.map(rowToKpiManualEntry);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('kme');
      const now = new Date();
      const row = {
        ...data,
        id,
        fromValue: String(data.fromValue),
        toValue: String(data.toValue),
        evidenceUrl: data.evidenceUrl ?? null,
        createdAt: new Date(data.createdAt ?? now),
      } as typeof t.$inferInsert;
      await db.insert(t).values(row);
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const dbPatch: Partial<typeof t.$inferInsert> = {};
      if (patch.reason !== undefined) dbPatch.reason = patch.reason;
      if (patch.evidenceUrl !== undefined) dbPatch.evidenceUrl = patch.evidenceUrl ?? null;
      if (patch.fromValue !== undefined) dbPatch.fromValue = String(patch.fromValue);
      if (patch.toValue !== undefined) dbPatch.toValue = String(patch.toValue);
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

function createKpiBonusPayoutRepo(): import('./repository').Repository<KpiBonusPayout> {
  const t = schema.kpiBonusPayout;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpiBonusPayout(rows[0]) : null;
    },
    async list(filter) {
      let q = db.select().from(t).$dynamic();
      q = q.where(
        and(
          filter?.cycleId ? eq(t.cycleId, filter.cycleId as string) : undefined,
          filter?.tenantId ? eq(t.tenantId, filter.tenantId as string) : undefined,
        ),
      );
      const rows = await q.orderBy(desc(t.calculatedAt));
      const all = rows.map(rowToKpiBonusPayout);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('kbp');
      const row = {
        ...data,
        id,
        baseBonus: String(data.baseBonus),
        weightedCompletion: String(data.weightedCompletion),
        finalBonus: String(data.finalBonus),
        contributions: data.contributions as object[],
        calculatedAt: new Date(data.calculatedAt),
        committedAt: data.committedAt ? new Date(data.committedAt) : null,
        note: data.note ?? null,
      } as typeof t.$inferInsert;
      await db.insert(t).values(row).onConflictDoUpdate({
        target: t.id,
        set: { ...row },
      });
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const dbPatch: Partial<typeof t.$inferInsert> = {};
      if (patch.committed !== undefined) dbPatch.committed = patch.committed;
      if (patch.committedAt !== undefined)
        dbPatch.committedAt = patch.committedAt ? new Date(patch.committedAt) : null;
      if (patch.note !== undefined) dbPatch.note = patch.note ?? null;
      if (patch.finalBonus !== undefined) dbPatch.finalBonus = String(patch.finalBonus);
      if (patch.weightedCompletion !== undefined) dbPatch.weightedCompletion = String(patch.weightedCompletion);
      if (patch.contributions !== undefined) dbPatch.contributions = patch.contributions as object[];
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

function createKpiCausalLinkRepo(): import('./repository').Repository<KpiCausalLink> {
  const t = schema.kpiCausalLink;
  return {
    async get(id) {
      const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
      return rows[0] ? rowToKpiCausalLink(rows[0]) : null;
    },
    async list(filter) {
      let q = db.select().from(t).$dynamic();
      q = q.where(
        and(
          filter?.cycleId ? eq(t.cycleId, filter.cycleId as string) : undefined,
          filter?.fromKpiId && !filter?.cycleId
            ? eq(t.fromKpiId, filter.fromKpiId as string)
            : undefined,
          filter?.tenantId ? eq(t.tenantId, filter.tenantId as string) : undefined,
        ),
      );
      const rows = await q.orderBy(desc(t.createdAt));
      const all = rows.map(rowToKpiCausalLink);
      if (!filter || Object.keys(filter).length === 0) return all;
      return all.filter((item) =>
        Object.entries(filter).every(([k, v]) => (item as unknown as Record<string, unknown>)[k] === v),
      );
    },
    async create(data) {
      const id = data.id ?? generateId('kcl');
      const now = new Date();
      const row = {
        ...data,
        id,
        strength: String(data.strength ?? 0.5),
        hypothesis: data.hypothesis ?? null,
        validatedAt: data.validatedAt ? new Date(data.validatedAt) : null,
        validatedBy: data.validatedBy ?? null,
        validationNote: data.validationNote ?? null,
        createdAt: new Date(data.createdAt ?? now),
        updatedAt: new Date(data.updatedAt ?? now),
      } as typeof t.$inferInsert;
      await db.insert(t).values(row).onConflictDoUpdate({
        target: [t.fromKpiId, t.toKpiId, t.cycleId],
        set: { strength: row.strength, hypothesis: row.hypothesis, updatedAt: now },
      });
      return (await this.get(id))!;
    },
    async update(id, patch) {
      const now = new Date();
      const dbPatch: Partial<typeof t.$inferInsert> = { updatedAt: now };
      if (patch.strength !== undefined) dbPatch.strength = String(patch.strength);
      if (patch.hypothesis !== undefined) dbPatch.hypothesis = patch.hypothesis ?? null;
      if (patch.validated !== undefined) dbPatch.validated = patch.validated;
      if (patch.validatedAt !== undefined)
        dbPatch.validatedAt = patch.validatedAt ? new Date(patch.validatedAt) : null;
      if (patch.validatedBy !== undefined) dbPatch.validatedBy = patch.validatedBy ?? null;
      if (patch.validationNote !== undefined) dbPatch.validationNote = patch.validationNote ?? null;
      await db.update(t).set(dbPatch).where(eq(t.id, id));
      return (await this.get(id))!;
    },
    async delete(id) {
      await db.delete(t).where(eq(t.id, id));
    },
  };
}

// ---------------------------------------------------------------------------
// Drizzle Store 工厂
// ---------------------------------------------------------------------------

export function createDrizzleStore(): TandemStore {
  return {
    _storeKind: 'prisma' as const, // 历史命名, 表示"已持久化"模式
    decisionCards: new DrizzleKvRepository('decision_cards'),
    personas: new DrizzleKvRepository('personas'),
    // §CA-13 CompanyBrain 智能迭代闭环
    companyBrainDecisions: new DrizzleKvRepository('company_brain_decisions'),
    companyBrainVersions: new DrizzleKvRepository('company_brain_versions'),
    companyBrainEvalCases: new DrizzleKvRepository('company_brain_eval_cases'),
    companyBrainReflections: new DrizzleKvRepository('company_brain_reflections'),
    origins: new DrizzleKvRepository('origins'),
    materials: new DrizzleKvRepository('materials'),
    memories: new DrizzleKvRepository('memories'),
    promotions: new DrizzleKvRepository('memory_promotions'),
    downgrades: new DrizzleKvRepository('memory_downgrades'),
    stewards: new DrizzleStewardRepo(),
    cycles: new DrizzleKvRepository('cycles'),
    objectives: new DrizzleKvRepository('objectives'),
    keyResults: new DrizzleKvRepository('key_results'),
    ttis: new DrizzleKvRepository('ttis'),
    initiatives: new DrizzleKvRepository('initiatives'),
    checkIns: new DrizzleKvRepository('check_ins'),

    // KPI 体系 (CHARTER-KPI-TTI §2) — 强类型表, 不走 KvStore
    kpiCycles: createKpiCycleRepo(),
    kpiSubjects: createKpiSubjectRepo(),
    kpis: createKpiRepo(),
    kpiCheckIns: createKpiCheckInRepo(),
    kpiSnapshots: createKpiSnapshotRepo(),
    kpiManualEntries: createKpiManualEntryRepo(),
    kpiBonusPayouts: createKpiBonusPayoutRepo(),
    kpiCausalLinks: createKpiCausalLinkRepo(),
    imChannels: new DrizzleKvRepository('im_channels'),
    imMessages: new DrizzleKvRepository('im_messages'),
    imMemberships: new DrizzleKvRepository('im_memberships'),
    imPresence: new DrizzleKvRepository('im_presence'),
    imMentionInbox: new DrizzleKvRepository('im_mention_inbox'),
    oneOnOneMeetings: new DrizzleKvRepository('one_on_one_meetings'),
    oneOnOneActionItems: new DrizzleKvRepository('one_on_one_actions'),
    review360Cycles: new DrizzleKvRepository('review360_cycles'),
    review360Submissions: new DrizzleKvRepository('review360_submissions'),
    review360Assignments: new DrizzleKvRepository('review360_assignments'),
    skillRegistry: new DrizzleKvRepository('skill_registry'),
    skillProposals: new DrizzleKvRepository('skill_proposals'),
    bitableTables: new DrizzleKvRepository('bitable_tables'),
    bitableViews: new DrizzleKvRepository('bitable_views'),
    intranetPosts: new DrizzleKvRepository('intranet_posts'),
    proxyActions: new DrizzleKvRepository('proxy_actions'),
    personaFeedbacks: new DrizzleKvRepository('persona_feedbacks'),
    lessons: new DrizzleKvRepository('learning_lessons'),
    learningAttempts: new DrizzleKvRepository('learning_attempts'),
    learningCertifications: new DrizzleKvRepository('learning_certifications'),
    learningEnrollments: new DrizzleKvRepository('learning_enrollments'),
    llmPreferences: new DrizzleKvRepository('llm_preferences'),
    tenantAiPolicies: new DrizzleKvRepository('tenant_ai_policies'),
    workspaceManifests: new DrizzleKvRepository('workspace_manifests'),
    personaConstitutions: new DrizzleKvRepository('persona_constitutions'),
    // V1 GA 模型仍使用专用 Drizzle Repo (强类型 schema)
    documents: new DrizzleKvRepository('documents_legacy'),
    calendarEvents: new DrizzleKvRepository('calendar_events_legacy'),
    driveFiles: new DrizzleKvRepository('drive_files_legacy'),
    notifications: new DrizzleKvRepository('notifications_legacy'),
    auth: createDrizzleAuthStore(),
    organizations: new DrizzleKvRepository('organizations'),
    authApplications: new DrizzleKvRepository('auth_applications'),
    shouchaoNotes: new DrizzleKvRepository('shouchao_notes'),
    knowledgeNodes: new DrizzleKvRepository('knowledge_nodes'),
    governanceProjects: new DrizzleKvRepository('governance_projects'),
    governanceTemplates: new DrizzleKvRepository('governance_templates'),
    governanceTemplateVersions: new DrizzleKvRepository('governance_template_versions'),
    approvals: new DrizzleKvRepository('approvals'),
    meetingBookings: new DrizzleKvRepository('meeting_bookings'),
  };
}
