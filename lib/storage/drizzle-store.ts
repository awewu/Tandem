/**
 * Drizzle Store · 遗留模块 PostgreSQL 持久化
 *
 * 使用 KvStore 通用 JSONB 表 + Drizzle 实现 Repository<T>.
 * 与 InMemory Store 行为完全一致, 替换无业务影响.
 * §T6: 后续热表会逐步升级为强类型 schema, 同时保持 Repository 接口稳定.
 */

import { and, eq, sql, desc } from 'drizzle-orm';
import { db, schema } from '../infra/drizzle-client';
import type {
  Repository,
  TandemStore,
  AuthStore,
  AuthUser,
  AuthSession,
  AuthInvite,
  AuthEvent,
} from './repository';
import { generateId } from './repository';

const kv = schema.kvStore;

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

  async list(filter?: Partial<T>): Promise<T[]> {
    const rows = await db
      .select()
      .from(kv)
      .where(eq(kv.collection, this.collection))
      .orderBy(desc(kv.updatedAt));
    const all = rows.map((r) => r.data as T);
    if (!filter || Object.keys(filter).length === 0) return all;
    return all.filter((item) =>
      Object.entries(filter).every(([key, val]) => (item as Record<string, unknown>)[key] === val),
    );
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const id = data.id ?? generateId();
    const item = { ...(data as object), id } as T;
    await db
      .insert(kv)
      .values({ collection: this.collection, id, data: item as object })
      .onConflictDoUpdate({
        target: [kv.collection, kv.id],
        set: { data: item as object, updatedAt: new Date() },
      });
    return item;
  }

  async update(id: string, patch: Partial<T>): Promise<T> {
    const existing = await this.get(id);
    if (!existing) throw new Error(`Record ${this.collection}/${id} not found`);
    const updated = { ...existing, ...patch, id } as T;
    await db
      .update(kv)
      .set({ data: updated as object, updatedAt: new Date() })
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
    };
  }
  void authUserFromRow;

  return {
    users: {
      async findByEmail(email) {
        const rows = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.email, email.toLowerCase()))
          .limit(1);
        return rows[0] ? fetchUserComposite(rows[0]) : null;
      },
      async findById(id) {
        const rows = await db
          .select()
          .from(schema.user)
          .where(eq(schema.user.id, id))
          .limit(1);
        return rows[0] ? fetchUserComposite(rows[0]) : null;
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
        if (input.departmentId) {
          await extrasRepo.create({ id, departmentId: input.departmentId });
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
        }> = {};
        if (patch.failedLoginCount !== undefined)
          extrasPatch.failedLoginCount = patch.failedLoginCount;
        if (patch.lockedUntil !== undefined) extrasPatch.lockedUntil = patch.lockedUntil;
        if (patch.lastLoginAt !== undefined) extrasPatch.lastLoginAt = patch.lastLoginAt;
        if (patch.lastLoginIp !== undefined) extrasPatch.lastLoginIp = patch.lastLoginIp;
        if (patch.departmentId !== undefined) extrasPatch.departmentId = patch.departmentId;
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
        const all = await sessRepo.list();
        return all.find((s) => s.refreshTokenHash === hash) ?? null;
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
        const all = await sessRepo.list({ userId } as Partial<AuthSession>);
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
        const all = await inviteRepo.list();
        return all.find((i) => i.codeHash === hash) ?? null;
      },
      async list(filter) {
        const all = await inviteRepo.list();
        let arr = all;
        if (filter?.invitedById) arr = arr.filter((i) => i.invitedById === filter.invitedById);
        if (filter?.tenantId) arr = arr.filter((i) => i.tenantId === filter.tenantId);
        return arr;
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
        // 简单清理: 超过 10k 条时删最旧 (近似实现, 高频场景应改为后台任务)
        const total = await db
          .select({ c: sql<number>`count(*)` })
          .from(kv)
          .where(eq(kv.collection, 'auth_event'));
        if (Number(total[0]?.c ?? 0) > 10_000) {
          await db.execute(
            sql`DELETE FROM "KvStore" WHERE collection = 'auth_event' AND id IN (SELECT id FROM "KvStore" WHERE collection = 'auth_event' ORDER BY "createdAt" ASC LIMIT 1000)`,
          );
        }
      },
      async list(filter) {
        let arr = await eventsRepo.list();
        if (filter?.userId) arr = arr.filter((e) => e.userId === filter.userId);
        if (filter?.eventType) arr = arr.filter((e) => e.eventType === filter.eventType);
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
// Drizzle Store 工厂
// ---------------------------------------------------------------------------

export function createDrizzleStore(): TandemStore {
  return {
    _storeKind: 'prisma' as const, // 历史命名, 表示"已持久化"模式
    decisionCards: new DrizzleKvRepository('decision_cards'),
    personas: new DrizzleKvRepository('personas'),
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

    // KPI 体系 (CHARTER-KPI-TTI §2)
    kpiCycles: new DrizzleKvRepository('kpi_cycles'),
    kpiSubjects: new DrizzleKvRepository('kpi_subjects'),
    kpis: new DrizzleKvRepository('kpis'),
    kpiCheckIns: new DrizzleKvRepository('kpi_check_ins'),
    kpiSnapshots: new DrizzleKvRepository('kpi_snapshots'),
    kpiManualEntries: new DrizzleKvRepository('kpi_manual_entries'),
    imChannels: new DrizzleKvRepository('im_channels'),
    imMessages: new DrizzleKvRepository('im_messages'),
    imMemberships: new DrizzleKvRepository('im_memberships'),
    oneOnOneMeetings: new DrizzleKvRepository('one_on_one_meetings'),
    oneOnOneActionItems: new DrizzleKvRepository('one_on_one_actions'),
    review360Cycles: new DrizzleKvRepository('review360_cycles'),
    review360Submissions: new DrizzleKvRepository('review360_submissions'),
    review360Assignments: new DrizzleKvRepository('review360_assignments'),
    skillRegistry: new DrizzleKvRepository('skill_registry'),
    bitableTables: new DrizzleKvRepository('bitable_tables'),
    bitableViews: new DrizzleKvRepository('bitable_views'),
    // V1 GA 模型仍使用专用 Drizzle Repo (强类型 schema)
    documents: new DrizzleKvRepository('documents_legacy'),
    calendarEvents: new DrizzleKvRepository('calendar_events_legacy'),
    driveFiles: new DrizzleKvRepository('drive_files_legacy'),
    notifications: new DrizzleKvRepository('notifications_legacy'),
    auth: createDrizzleAuthStore(),
  };
}
