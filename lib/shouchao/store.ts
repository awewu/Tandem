/**
 * Shouchao storage boundary.
 *
 * By default Shouchao keeps using the current Tandem store, so existing
 * deployments do not change. When SHOUCHAO_DATABASE_URL is configured, only
 * Shouchao collections are routed to that independent PostgreSQL database.
 */

import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { SQL } from 'drizzle-orm';
import { getStore, generateId, type ListOptions, type Repository, type TandemStore } from '../storage/repository';
import * as schema from '../infra/drizzle-schema';

type ShouchaoStore = Pick<
  TandemStore,
  | 'shouchaoNotes'
  | 'shouchaoNotebooks'
  | 'shouchaoAttachments'
  | 'shouchaoDatabases'
  | 'shouchaoRows'
  | 'shouchaoDistillCandidates'
>;

const kv = schema.kvStore;
type ShouchaoDb = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  // eslint-disable-next-line no-var
  var __shouchao_pg__: ReturnType<typeof postgres> | undefined;
}

let cachedUrl: string | null = null;
let cachedDb: ShouchaoDb | null = null;
let cachedStore: ShouchaoStore | null = null;

function configuredUrl(): string | null {
  const raw = (process.env.SHOUCHAO_DATABASE_URL ?? process.env.shouchao_DATABASE_URL)?.trim();
  return raw ? sanitizeDatabaseUrl(raw) : null;
}

function sanitizeDatabaseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.searchParams.has('schema')) u.searchParams.delete('schema');
    return u.toString();
  } catch {
    return raw;
  }
}

export function isDedicatedShouchaoDatabaseEnabled(): boolean {
  return Boolean(configuredUrl());
}

function fallbackStore(): ShouchaoStore {
  const store = getStore();
  return {
    shouchaoNotes: store.shouchaoNotes,
    shouchaoNotebooks: store.shouchaoNotebooks,
    shouchaoAttachments: store.shouchaoAttachments,
    shouchaoDatabases: store.shouchaoDatabases,
    shouchaoRows: store.shouchaoRows,
    shouchaoDistillCandidates: store.shouchaoDistillCandidates,
  };
}

function getDedicatedDb(url: string): ShouchaoDb {
  if (cachedDb && cachedUrl === url) return cachedDb;
  const client = global.__shouchao_pg__ ?? postgres(url, { max: 10, prepare: false });
  if (process.env.NODE_ENV !== 'production') global.__shouchao_pg__ = client;
  cachedUrl = url;
  cachedDb = drizzle(client, { schema });
  cachedStore = null;
  return cachedDb;
}

export function getShouchaoStore(): ShouchaoStore {
  const url = configuredUrl();
  if (!url) return fallbackStore();
  if (cachedStore && cachedUrl === url) return cachedStore;
  const db = getDedicatedDb(url);
  cachedStore = {
    shouchaoNotes: new ShouchaoKvRepository(db, 'shouchao_notes'),
    shouchaoNotebooks: new ShouchaoKvRepository(db, 'shouchao_notebooks'),
    shouchaoAttachments: new ShouchaoKvRepository(db, 'shouchao_attachments'),
    shouchaoDatabases: new ShouchaoKvRepository(db, 'shouchao_databases'),
    shouchaoRows: new ShouchaoKvRepository(db, 'shouchao_rows'),
    shouchaoDistillCandidates: new ShouchaoKvRepository(db, 'shouchao_distill_candidates'),
  };
  return cachedStore;
}

export function getShouchaoVectorDb(): ShouchaoDb | null {
  const url = configuredUrl();
  return url ? getDedicatedDb(url) : null;
}

export function __resetShouchaoStoreForTests(): void {
  cachedUrl = null;
  cachedDb = null;
  cachedStore = null;
}

class ShouchaoKvRepository<T extends { id: string }> implements Repository<T> {
  constructor(
    private readonly db: ShouchaoDb,
    private readonly collection: string,
  ) {}

  async get(id: string): Promise<T | null> {
    const rows = await this.db
      .select()
      .from(kv)
      .where(and(eq(kv.collection, this.collection), eq(kv.id, id)))
      .limit(1);
    return rows[0] ? (rows[0].data as T) : null;
  }

  async list(filter?: Partial<T>, opts?: ListOptions): Promise<T[]> {
    const filterRec = (filter as Record<string, unknown> | undefined) ?? {};
    const conds: SQL[] = [eq(kv.collection, this.collection)];
    const jsFilter: Array<[string, unknown]> = [];

    for (const [key, value] of Object.entries(filterRec)) {
      if (value === undefined) continue;
      if (key === 'tenantId' && typeof value === 'string') {
        conds.push(eq(kv.tenantId, value));
      } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof value === 'string') {
        conds.push(sql`${kv.data}->>${sql.raw(`'${key}'`)} = ${value}`);
      } else {
        jsFilter.push([key, value]);
      }
    }

    const where = conds.length === 1 ? conds[0] : and(...conds);
    let q = this.db.select().from(kv).where(where).orderBy(desc(kv.updatedAt)).$dynamic();
    if (opts && jsFilter.length === 0) {
      if (opts.limit !== undefined) q = q.limit(opts.limit);
      if (opts.offset !== undefined) q = q.offset(opts.offset);
    }

    const rows = await q;
    let all = rows.map((r) => r.data as T);
    if (jsFilter.length > 0) {
      all = all.filter((item) =>
        jsFilter.every(([key, value]) => (item as Record<string, unknown>)[key] === value),
      );
      if (opts) {
        const start = opts.offset ?? 0;
        const end = opts.limit !== undefined ? start + opts.limit : undefined;
        all = all.slice(start, end);
      }
    }
    return all;
  }

  async create(data: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const id = data.id ?? generateId();
    const item = { ...(data as object), id } as T;
    const tenantId = ((item as Record<string, unknown>).tenantId as string | undefined) ?? 'default';
    await this.db
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
    const tenantId = ((updated as Record<string, unknown>).tenantId as string | undefined) ?? 'default';
    await this.db
      .update(kv)
      .set({ data: updated as object, tenantId, updatedAt: new Date() })
      .where(and(eq(kv.collection, this.collection), eq(kv.id, id)));
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(kv).where(and(eq(kv.collection, this.collection), eq(kv.id, id)));
  }
}
