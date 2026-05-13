/**
 * Prisma Store · 生产期实现
 *
 * 启用步骤:
 *   1. npm i -D prisma && npm i @prisma/client
 *   2. 配 DATABASE_URL (postgresql://...)
 *   3. npx prisma migrate dev --name init
 *   4. npx prisma generate
 *   5. 在 boot.ts 改:  setStore(createPrismaStore())
 *
 * 设计:
 *   - 与 InMemoryRepository 接口完全一致
 *   - JSON 字段 (options, signers, etc) 在读写时透明序列化
 *   - 复杂查询 (按 cycleId 联表) 暂用全表扫描, 后续可加索引和 raw query
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { Repository, TandemStore, AuthStore } from './repository';

// 我们使用 dynamic import 避免在没装 @prisma/client 时编译失败.
// 如果未来想严格依赖, 可改为 static import.
type PrismaClientType = any;
let _prisma: PrismaClientType | null = null;

async function getPrisma(): Promise<PrismaClientType> {
  if (_prisma) return _prisma;
  try {
    const mod = await import('@prisma/client');
    _prisma = new mod.PrismaClient();
    return _prisma;
  } catch {
    throw new Error(
      '@prisma/client installed but prisma generate has not been run yet. Run: npx prisma generate'
    );
  }
}

/**
 * 域对象 ↔ Prisma 表的边界适配.
 *
 * 1. RELATION_FIELDS_TO_STRIP — 域对象有但 Prisma 是 relation (不是 column),
 *    比如 DecisionCard.actionItems / initiatives. Prisma create 时不能传
 *    普通数组, 必须用 { create: [...] } 嵌套语法. 这里直接剥掉, 由业务层
 *    另外调对应 repo 创建.
 *
 * 2. FIELD_RENAMES — 域对象字段名 → Prisma 列名映射. 比如域里写
 *    createdBy: 'user_xxx' (字符串, 直接是用户 ID), Prisma schema 里这列叫
 *    createdById (column), 加上 createdBy (relation pointer). 写入时改名.
 *    读取时不改 (Prisma 返回 createdById, 业务读时按需改).
 */
const RELATION_FIELDS_TO_STRIP: Record<string, string[]> = {
  decisionCard: ['actionItems', 'initiatives'],
};

const FIELD_RENAMES: Record<string, Record<string, string>> = {
  decisionCard: {
    createdBy: 'createdById',
    selectedBy: 'selectedById',
  },
};

function adaptForPrisma(tableName: string, data: any): any {
  const drop = RELATION_FIELDS_TO_STRIP[tableName] ?? [];
  const renames = FIELD_RENAMES[tableName] ?? {};
  const out: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (drop.includes(k)) continue;
    const newKey = renames[k] ?? k;
    out[newKey] = v;
  }
  return out;
}

/**
 * Read-side adapter: Prisma returns Date for timestamp columns, but our domain
 * types declare them as ISO strings. Convert to keep the boundary clean.
 *
 * Also reverse the FIELD_RENAMES on read (createdById → createdBy) so that
 * downstream code reading the object uses the domain field names.
 */
function adaptFromPrisma(tableName: string, row: any): any {
  if (!row || typeof row !== 'object') return row;
  const renames = FIELD_RENAMES[tableName] ?? {};
  const reverseRenames: Record<string, string> = {};
  for (const [k, v] of Object.entries(renames)) reverseRenames[v] = k;

  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    const domainKey = reverseRenames[k] ?? k;
    if (v instanceof Date) {
      out[domainKey] = v.toISOString();
    } else {
      out[domainKey] = v;
    }
  }
  return out;
}

class PrismaRepository<T extends { id: string }> implements Repository<T> {
  constructor(private readonly tableName: string) {}

  async get(id: string): Promise<T | null> {
    const p = await getPrisma();
    const row = await p[this.tableName].findUnique({ where: { id } });
    return row ? (adaptFromPrisma(this.tableName, row) as T) : null;
  }

  async list(filter?: Partial<T>): Promise<T[]> {
    const p = await getPrisma();
    const rows = await p[this.tableName].findMany({ where: filter ?? {} });
    return rows.map((r: any) => adaptFromPrisma(this.tableName, r)) as T[];
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const p = await getPrisma();
    const row = await p[this.tableName].create({ data: adaptForPrisma(this.tableName, data) });
    return adaptFromPrisma(this.tableName, row) as T;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const p = await getPrisma();
    const row = await p[this.tableName].update({
      where: { id },
      data: adaptForPrisma(this.tableName, data),
    });
    return adaptFromPrisma(this.tableName, row) as T;
  }

  async delete(id: string): Promise<void> {
    const p = await getPrisma();
    await p[this.tableName].delete({ where: { id } });
  }
}

class PrismaStewardRepo {
  async get(userId: string) {
    const p = await getPrisma();
    return p.steward.findUnique({ where: { userId } });
  }

  async set(s: { userId: string; appointedAt: string; conflictWith?: string[] }) {
    const p = await getPrisma();
    await p.steward.upsert({
      where: { userId: s.userId },
      create: s,
      update: s,
    });
  }
}

/**
 * PrismaAuthStore · 基于 prisma.user / session / invite / mfaSecret / authEvent
 *
 * 与 lib/auth/native.ts 的 AuthStore 接口等价. DATETIME ↔ ISO string
 * 在边界上透明转换; 不在业务层暴露 Prisma Date 对象.
 */
function createPrismaAuthStore(): AuthStore {
  const dt = (d: Date | null | undefined): string | null =>
    d ? d.toISOString() : null;

  return {
    users: {
      async findByEmail(email) {
        const p = await getPrisma();
        const u = await p.user.findUnique({ where: { email } });
        if (!u) return null;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          roles: u.roles ?? [],
          tenantId: u.tenantId ?? 'default',
          disabled: u.disabled ?? false,
          failedLoginCount: u.failedLoginCount ?? 0,
          lockedUntil: dt(u.lockedUntil),
          lastLoginAt: dt(u.lastLoginAt),
          lastLoginIp: u.lastLoginIp ?? null,
          emailVerifiedAt: dt(u.emailVerifiedAt),
          departmentId: u.departmentId ?? null,
          ssoBindings: (u.ssoBindings as Record<string, string> | null) ?? null,
        };
      },
      async findById(id) {
        const p = await getPrisma();
        const u = await p.user.findUnique({ where: { id } });
        if (!u) return null;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          roles: u.roles ?? [],
          tenantId: u.tenantId ?? 'default',
          disabled: u.disabled ?? false,
          failedLoginCount: u.failedLoginCount ?? 0,
          lockedUntil: dt(u.lockedUntil),
          lastLoginAt: dt(u.lastLoginAt),
          lastLoginIp: u.lastLoginIp ?? null,
          emailVerifiedAt: dt(u.emailVerifiedAt),
          departmentId: u.departmentId ?? null,
          ssoBindings: (u.ssoBindings as Record<string, string> | null) ?? null,
        };
      },
      async list() {
        const p = await getPrisma();
        const all = await p.user.findMany();
        return all.map((u: typeof all[0]) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          roles: u.roles ?? [],
          tenantId: u.tenantId ?? 'default',
          disabled: u.disabled ?? false,
          failedLoginCount: u.failedLoginCount ?? 0,
          lockedUntil: dt(u.lockedUntil),
          lastLoginAt: dt(u.lastLoginAt),
          lastLoginIp: u.lastLoginIp ?? null,
          emailVerifiedAt: dt(u.emailVerifiedAt),
          departmentId: u.departmentId ?? null,
          ssoBindings: (u.ssoBindings as Record<string, string> | null) ?? null,
        }));
      },
      async create(input) {
        const p = await getPrisma();
        const u = await p.user.create({
          data: {
            email: input.email,
            name: input.name,
            roles: input.roles ?? [],
            tenantId: input.tenantId ?? 'default',
            departmentId: input.departmentId ?? null,
            emailVerifiedAt: input.emailVerifiedAt ? new Date(input.emailVerifiedAt) : null,
          ssoBindings: input.ssoBindings as any,
          },
        });
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          roles: u.roles ?? [],
          tenantId: u.tenantId ?? 'default',
          disabled: u.disabled ?? false,
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: null,
          lastLoginIp: null,
          emailVerifiedAt: dt(u.emailVerifiedAt),
          departmentId: u.departmentId ?? null,
          ssoBindings: (u.ssoBindings as Record<string, string> | null) ?? null,
        };
      },
      async update(id, patch) {
        const p = await getPrisma();
        const data: Record<string, unknown> = {};
        if (patch.email !== undefined) data.email = patch.email;
        if (patch.name !== undefined) data.name = patch.name;
        if (patch.roles !== undefined) data.roles = patch.roles;
        if (patch.disabled !== undefined) data.disabled = patch.disabled;
        if (patch.failedLoginCount !== undefined) data.failedLoginCount = patch.failedLoginCount;
        if (patch.lockedUntil !== undefined) {
          data.lockedUntil = patch.lockedUntil ? new Date(patch.lockedUntil) : null;
        }
        if (patch.lastLoginAt !== undefined) {
          data.lastLoginAt = patch.lastLoginAt ? new Date(patch.lastLoginAt) : null;
        }
        if (patch.lastLoginIp !== undefined) data.lastLoginIp = patch.lastLoginIp;
        if (patch.departmentId !== undefined) data.departmentId = patch.departmentId;
        if (patch.ssoBindings !== undefined) data.ssoBindings = patch.ssoBindings as any;
        await p.user.update({ where: { id }, data });
      },
      async savePasswordHash(userId, hash) {
        const p = await getPrisma();
        await p.passwordHash.upsert({
          where: { userId },
          create: { userId, hash, changedAt: new Date() },
          update: { hash, changedAt: new Date() },
        });
      },
      async findPasswordHash(userId) {
        const p = await getPrisma();
        const r = await p.passwordHash.findUnique({ where: { userId } });
        if (!r) return null;
        return { hash: r.hash, historyHashes: r.historyHashes ?? [] };
      },
      async findMfaSecret(userId) {
        const p = await getPrisma();
        const r = await p.mfaSecret.findUnique({ where: { userId } });
        if (!r) return null;
        return {
          encryptedSecret: r.encryptedSecret,
          recoveryCodeHashes: r.recoveryCodeHashes ?? [],
        };
      },
      async saveMfaSecret(userId, encryptedSecret, recoveryCodeHashes) {
        const p = await getPrisma();
        await p.mfaSecret.upsert({
          where: { userId },
          create: { userId, encryptedSecret, recoveryCodeHashes, enrolledAt: new Date() },
          update: { encryptedSecret, recoveryCodeHashes, enrolledAt: new Date() },
        });
      },
      async consumeRecoveryCode(userId, hash) {
        const p = await getPrisma();
        const r = await p.mfaSecret.findUnique({ where: { userId } });
        if (!r) return;
        const next = (r.recoveryCodeHashes ?? []).filter((h: string) => h !== hash);
        await p.mfaSecret.update({
          where: { userId },
          data: { recoveryCodeHashes: next, lastUsedAt: new Date() },
        });
      },
    },
    sessions: {
      async create(input) {
        const p = await getPrisma();
        const s = await p.session.create({
          data: {
            userId: input.userId,
            refreshTokenHash: input.refreshTokenHash,
            mfaVerified: input.mfaVerified,
            userAgent: input.userAgent,
            ip: input.ip,
            expiresAt: new Date(input.expiresAt),
          },
        });
        return {
          id: s.id,
          userId: s.userId,
          refreshTokenHash: s.refreshTokenHash,
          mfaVerified: s.mfaVerified,
          expiresAt: s.expiresAt.toISOString(),
          revokedAt: dt(s.revokedAt),
          userAgent: s.userAgent ?? null,
          ip: s.ip ?? null,
        };
      },
      async findById(id) {
        const p = await getPrisma();
        const s = await p.session.findUnique({ where: { id } });
        if (!s) return null;
        return {
          id: s.id,
          userId: s.userId,
          refreshTokenHash: s.refreshTokenHash,
          mfaVerified: s.mfaVerified,
          expiresAt: s.expiresAt.toISOString(),
          revokedAt: dt(s.revokedAt),
          userAgent: s.userAgent ?? null,
          ip: s.ip ?? null,
        };
      },
      async findByRefreshHash(hash) {
        const p = await getPrisma();
        const s = await p.session.findUnique({ where: { refreshTokenHash: hash } });
        if (!s) return null;
        return {
          id: s.id,
          userId: s.userId,
          refreshTokenHash: s.refreshTokenHash,
          mfaVerified: s.mfaVerified,
          expiresAt: s.expiresAt.toISOString(),
          revokedAt: dt(s.revokedAt),
          userAgent: s.userAgent ?? null,
          ip: s.ip ?? null,
        };
      },
      async revoke(id, reason) {
        const p = await getPrisma();
        await p.session.update({
          where: { id },
          data: { revokedAt: new Date(), revokeReason: reason },
        });
      },
      async revokeAllForUser(userId, reason) {
        const p = await getPrisma();
        await p.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), revokeReason: reason },
        });
      },
      async markMfaVerified(id) {
        const p = await getPrisma();
        await p.session.update({
          where: { id },
          data: { mfaVerified: true, lastSeenAt: new Date() },
        });
      },
    },
    invites: {
      async create(input) {
        const p = await getPrisma();
        const i = await p.invite.create({
          data: {
            codeHash: input.codeHash,
            email: input.email ?? null,
            presetRoles: input.presetRoles ?? [],
            presetDepartmentId: input.presetDepartmentId ?? null,
            tenantId: input.tenantId ?? 'default',
            invitedById: input.invitedById,
            maxUses: input.maxUses ?? 1,
            expiresAt: new Date(input.expiresAt),
          },
        });
        return {
          id: i.id,
          codeHash: i.codeHash,
          email: i.email ?? null,
          presetRoles: i.presetRoles ?? [],
          presetDepartmentId: i.presetDepartmentId ?? null,
          tenantId: i.tenantId ?? 'default',
          invitedById: i.invitedById,
          maxUses: i.maxUses,
          usedCount: i.usedCount,
          expiresAt: i.expiresAt.toISOString(),
          redeemedAt: dt(i.redeemedAt),
        };
      },
      async findByHash(hash) {
        const p = await getPrisma();
        const i = await p.invite.findUnique({ where: { codeHash: hash } });
        if (!i) return null;
        return {
          id: i.id,
          codeHash: i.codeHash,
          email: i.email ?? null,
          presetRoles: i.presetRoles ?? [],
          presetDepartmentId: i.presetDepartmentId ?? null,
          tenantId: i.tenantId ?? 'default',
          invitedById: i.invitedById,
          maxUses: i.maxUses,
          usedCount: i.usedCount,
          expiresAt: i.expiresAt.toISOString(),
          redeemedAt: dt(i.redeemedAt),
        };
      },
      async list(filter) {
        const p = await getPrisma();
        const rows = await p.invite.findMany({
          where: {
            invitedById: filter?.invitedById,
            tenantId: filter?.tenantId,
          },
        });
        return rows.map((i: Record<string, unknown>) => {
          const r = i as {
            id: string;
            codeHash: string;
            email: string | null;
            presetRoles: string[];
            presetDepartmentId: string | null;
            tenantId: string;
            invitedById: string;
            maxUses: number;
            usedCount: number;
            expiresAt: Date;
            redeemedAt: Date | null;
          };
          return {
            id: r.id,
            codeHash: r.codeHash,
            email: r.email,
            presetRoles: r.presetRoles,
            presetDepartmentId: r.presetDepartmentId,
            tenantId: r.tenantId,
            invitedById: r.invitedById,
            maxUses: r.maxUses,
            usedCount: r.usedCount,
            expiresAt: r.expiresAt.toISOString(),
            redeemedAt: dt(r.redeemedAt),
          };
        });
      },
      async markUsed(id) {
        const p = await getPrisma();
        await p.invite.update({
          where: { id },
          data: {
            usedCount: { increment: 1 },
            redeemedAt: new Date(),
          },
        });
      },
      async revoke(id) {
        const p = await getPrisma();
        await p.invite.delete({ where: { id } });
      },
    },
    events: {
      async append(event) {
        const p = await getPrisma();
        await p.authEvent.create({
          data: {
            userId: event.userId,
            email: event.email,
            eventType: event.eventType,
            ip: event.ip,
            userAgent: event.userAgent,
            metadata: event.metadata as never,
          },
        });
      },
      async list(filter) {
        const p = await getPrisma();
        const where: Record<string, unknown> = {};
        if (filter?.userId) where.userId = filter.userId;
        if (filter?.eventType) where.eventType = filter.eventType;
        if (filter?.sinceMs) where.createdAt = { gte: new Date(filter.sinceMs) };
        const rows = await p.authEvent.findMany({ where, orderBy: { createdAt: 'desc' } });
        return rows.map((e: Record<string, unknown>) => {
          const r = e as {
            userId: string | null;
            email: string | null;
            eventType: string;
            ip: string | null;
            userAgent: string | null;
            metadata: unknown;
            createdAt: Date;
          };
          return {
            userId: r.userId ?? undefined,
            email: r.email ?? undefined,
            eventType: r.eventType,
            ip: r.ip ?? undefined,
            userAgent: r.userAgent ?? undefined,
            metadata: (r.metadata ?? undefined) as Record<string, unknown> | undefined,
            createdAt: r.createdAt.toISOString(),
          };
        });
      },
    },
  };
}

export function createPrismaStore(): TandemStore {
  return {
    decisionCards: new PrismaRepository('decisionCard'),
    personas: new PrismaRepository('persona'),
    origins: new PrismaRepository('origin'),
    materials: new PrismaRepository('material'),
    memories: new PrismaRepository('memoryEntry'),
    promotions: new PrismaRepository('memoryPromotionRequest'),
    downgrades: new PrismaRepository('memoryDowngradeRequest'),
    stewards: new PrismaStewardRepo() as never,
    cycles: new PrismaRepository('cycle'),
    objectives: new PrismaRepository('objective'),
    keyResults: new PrismaRepository('keyResult'),
    ttis: new PrismaRepository('tTI'),
    initiatives: new PrismaRepository('initiative'),
    checkIns: new PrismaRepository('checkIn'),
    imChannels: new PrismaRepository('imChannel'),
    imMessages: new PrismaRepository('imMessage'),
    imMemberships: new PrismaRepository('imMembership'),
    oneOnOneMeetings: new PrismaRepository('oneOnOneMeeting'),
    oneOnOneActionItems: new PrismaRepository('oneOnOneActionItem'),
    review360Cycles: new PrismaRepository('review360Cycle'),
    review360Submissions: new PrismaRepository('review360Submission'),
    review360Assignments: new PrismaRepository('review360Assignment'),
    auth: createPrismaAuthStore(),
    workspaces: new PrismaRepository('workspace'),
    plans: new PrismaRepository('plan'),
  };
}
