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
    // @ts-expect-error optional dependency
    const mod = await import('@prisma/client');
    _prisma = new mod.PrismaClient();
    return _prisma;
  } catch (err) {
    throw new Error(
      '@prisma/client not installed. Run: npm i @prisma/client && npx prisma generate'
    );
  }
}

class PrismaRepository<T extends { id: string }> implements Repository<T> {
  constructor(private readonly tableName: string) {}

  async get(id: string): Promise<T | null> {
    const p = await getPrisma();
    const row = await p[this.tableName].findUnique({ where: { id } });
    return row as T | null;
  }

  async list(filter?: Partial<T>): Promise<T[]> {
    const p = await getPrisma();
    const rows = await p[this.tableName].findMany({ where: filter ?? {} });
    return rows as T[];
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const p = await getPrisma();
    const row = await p[this.tableName].create({ data });
    return row as T;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const p = await getPrisma();
    const row = await p[this.tableName].update({ where: { id }, data });
    return row as T;
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
 * 占位 AuthStore — Prisma 持久化版本待 V2 实现.
 *
 * 现状: V1 主路径走 InMemoryStore + bootstrapOwnerIfMissing.
 * Prisma store 仅供 schema / 类型检查使用, 调用任何方法会抛 not implemented.
 * V2 启用前必须把每个方法换成基于 prisma.user / prisma.session / prisma.invite 的真实实现.
 */
function createPrismaAuthStub(): AuthStore {
  const todo = (name: string) => () => {
    throw new Error(
      `[prisma-auth-stub] ${name} not implemented. V1 走 InMemoryStore. ` +
        `V2 启用前请基于 prisma.user / prisma.session / prisma.invite / prisma.authEvent 实现.`
    );
  };
  return {
    users: {
      findByEmail: todo('users.findByEmail'),
      findById: todo('users.findById'),
      create: todo('users.create'),
      update: todo('users.update'),
      savePasswordHash: todo('users.savePasswordHash'),
      findPasswordHash: todo('users.findPasswordHash'),
      findMfaSecret: todo('users.findMfaSecret'),
      saveMfaSecret: todo('users.saveMfaSecret'),
      consumeRecoveryCode: todo('users.consumeRecoveryCode'),
    },
    sessions: {
      create: todo('sessions.create'),
      findById: todo('sessions.findById'),
      findByRefreshHash: todo('sessions.findByRefreshHash'),
      revoke: todo('sessions.revoke'),
      revokeAllForUser: todo('sessions.revokeAllForUser'),
      markMfaVerified: todo('sessions.markMfaVerified'),
    },
    invites: {
      create: todo('invites.create'),
      findByHash: todo('invites.findByHash'),
      list: todo('invites.list'),
      markUsed: todo('invites.markUsed'),
      revoke: todo('invites.revoke'),
    },
    events: {
      append: todo('events.append'),
      list: todo('events.list'),
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
    auth: createPrismaAuthStub(),
  };
}
