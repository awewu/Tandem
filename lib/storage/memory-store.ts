/**
 * In-Memory Store · 开发期 / 测试期使用
 *
 * 生产期由 PrismaStore (lib/storage/prisma-store.ts) 替换.
 * 数据仅在进程内存中, 进程结束即失效.
 */

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

class InMemoryRepository<T extends { id: string }> implements Repository<T> {
  private data = new Map<string, T>();

  async get(id: string): Promise<T | null> {
    return this.data.get(id) ?? null;
  }

  async list(filter?: Partial<T>): Promise<T[]> {
    const all = Array.from(this.data.values());
    if (!filter) return all;
    return all.filter((item) =>
      Object.entries(filter).every(([key, val]) => (item as never)[key] === val)
    );
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
  return {
    decisionCards: new InMemoryRepository(),
    personas: new InMemoryRepository(),
    origins: new InMemoryRepository(),
    materials: new InMemoryRepository(),
    memories: new InMemoryRepository(),
    promotions: new InMemoryRepository(),
    downgrades: new InMemoryRepository(),
    stewards: new InMemoryStewardRepo(),
    cycles: new InMemoryRepository(),
    objectives: new InMemoryRepository(),
    keyResults: new InMemoryRepository(),
    ttis: new InMemoryRepository(),
    initiatives: new InMemoryRepository(),
    checkIns: new InMemoryRepository(),
    imChannels: new InMemoryRepository(),
    imMessages: new InMemoryRepository(),
    imMemberships: new InMemoryRepository(),
    oneOnOneMeetings: new InMemoryRepository(),
    oneOnOneActionItems: new InMemoryRepository(),
    review360Cycles: new InMemoryRepository(),
    review360Submissions: new InMemoryRepository(),
    review360Assignments: new InMemoryRepository(),
    auth: createInMemoryAuthStore(),
  };
}
