import { randomUUID } from 'crypto';
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { logger } from '@/lib/infra/logger';
import { redactBusinessLogData } from '@/lib/business-log/redact';
import { isDatabaseMode } from '@/lib/infra/storage-mode';
import type { ApiLogEntry, ApiLogInput, ApiLogQuery, ApiLogQueryResult } from './types';

function boundedInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

const MEMORY_LIMIT = boundedInt(process.env.API_LOG_MEMORY_MAX, 5_000, 100, 100_000);
const DB_BATCH_SIZE = boundedInt(process.env.API_LOG_DB_BATCH_SIZE, 100, 1, 500);
const DB_FLUSH_INTERVAL_MS = boundedInt(process.env.API_LOG_DB_FLUSH_INTERVAL_MS, 250, 25, 60_000);
const DB_RETRY_INTERVAL_MS = boundedInt(process.env.API_LOG_DB_RETRY_INTERVAL_MS, 5_000, 250, 60_000);
const DB_QUEUE_LIMIT = Math.max(
  DB_BATCH_SIZE,
  boundedInt(process.env.API_LOG_DB_QUEUE_MAX, 2_000, 1, 100_000),
);
type ApiLogGlobalState = typeof globalThis & {
  __tandem_api_logs__?: ApiLogEntry[];
  __tandem_api_log_db_queue__?: ApiLogEntry[];
  __tandem_api_log_flush_timer__?: ReturnType<typeof setTimeout>;
  __tandem_api_log_flush_promise__?: Promise<void>;
};
const globalState = globalThis as ApiLogGlobalState;

function memoryLogs(): ApiLogEntry[] {
  if (!globalState.__tandem_api_logs__) globalState.__tandem_api_logs__ = [];
  return globalState.__tandem_api_logs__;
}

function normalize(input: ApiLogInput): ApiLogEntry {
  const createdAt = input.createdAt instanceof Date
    ? input.createdAt.toISOString()
    : input.createdAt ?? new Date().toISOString();
  return {
    id: input.id ?? `alog_${randomUUID()}`,
    requestId: input.requestId ?? null,
    tenantId: input.tenantId ?? 'default',
    actorId: input.actorId ?? 'anonymous',
    actorType: input.actorType ?? 'anonymous',
    source: input.source ?? 'api',
    category: input.category ?? 'system',
    operation: input.operation,
    action: input.action,
    method: input.method.toUpperCase(),
    path: input.path,
    route: input.route ?? null,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    statusCode: input.statusCode,
    outcome: input.outcome,
    level: input.level ?? (input.outcome === 'error' ? 'error' : input.outcome === 'success' ? 'info' : 'warn'),
    durationMs: input.durationMs == null ? null : Math.max(0, Math.round(input.durationMs)),
    summary: input.summary.slice(0, 1_000),
    requestData: redactBusinessLogData(input.requestData),
    details: redactBusinessLogData(input.details),
    createdAt: typeof createdAt === 'string' ? createdAt : new Date(createdAt).toISOString(),
  };
}

function remember(entry: ApiLogEntry): void {
  const logs = memoryLogs();
  logs.push(entry);
  if (logs.length > MEMORY_LIMIT) logs.splice(0, logs.length - MEMORY_LIMIT);
}

function pendingDbLogs(): ApiLogEntry[] {
  if (!globalState.__tandem_api_log_db_queue__) globalState.__tandem_api_log_db_queue__ = [];
  return globalState.__tandem_api_log_db_queue__;
}

function enforceDbQueueLimit(queue: ApiLogEntry[]): number {
  const dropped = Math.max(0, queue.length - DB_QUEUE_LIMIT);
  if (dropped > 0) queue.splice(0, dropped);
  return dropped;
}

function scheduleDbFlush(delayMs = DB_FLUSH_INTERVAL_MS): void {
  if (globalState.__tandem_api_log_flush_timer__ || globalState.__tandem_api_log_flush_promise__) return;
  const timer = setTimeout(() => {
    globalState.__tandem_api_log_flush_timer__ = undefined;
    void flushQueuedApiLogs();
  }, delayMs);
  timer.unref?.();
  globalState.__tandem_api_log_flush_timer__ = timer;
}

async function flushQueuedApiLogs(): Promise<void> {
  if (globalState.__tandem_api_log_flush_promise__) return globalState.__tandem_api_log_flush_promise__;
  if (globalState.__tandem_api_log_flush_timer__) {
    clearTimeout(globalState.__tandem_api_log_flush_timer__);
    globalState.__tandem_api_log_flush_timer__ = undefined;
  }
  const batch = pendingDbLogs().splice(0, DB_BATCH_SIZE);
  if (batch.length === 0) return;

  let persistFailed = false;
  const flush = (async () => {
    try {
      const { db, schema } = await import('@/lib/infra/drizzle-client');
      await db
        .insert(schema.apiLog)
        .values(batch.map((entry) => ({ ...entry, createdAt: new Date(entry.createdAt) })))
        .onConflictDoNothing();
    } catch (error) {
      persistFailed = true;
      const queue = pendingDbLogs();
      queue.unshift(...batch);
      const dropped = enforceDbQueueLimit(queue);
      logger.warn(
        { count: batch.length, dropped, err: error instanceof Error ? error.message : String(error) },
        '[api-log] batch persist failed; queued for retry',
      );
    }
  })().finally(() => {
    globalState.__tandem_api_log_flush_promise__ = undefined;
    if (pendingDbLogs().length > 0) {
      scheduleDbFlush(persistFailed ? DB_RETRY_INTERVAL_MS : DB_FLUSH_INTERVAL_MS);
    }
  });
  globalState.__tandem_api_log_flush_promise__ = flush;
  return flush;
}

export async function appendApiLog(input: ApiLogInput): Promise<ApiLogEntry> {
  const entry = normalize(input);
  remember(entry);
  if (isDatabaseMode()) {
    try {
      const { db, schema } = await import('@/lib/infra/drizzle-client');
      await db.insert(schema.apiLog).values({ ...entry, createdAt: new Date(entry.createdAt) });
    } catch (error) {
      logger.warn(
        { requestId: entry.requestId, operation: entry.operation, err: (error as Error).message },
        '[api-log] persist failed; retained in memory',
      );
    }
  }
  return entry;
}

export function deferApiLog(input: ApiLogInput): void {
  const entry = normalize(input);
  remember(entry);
  if (!isDatabaseMode()) return;

  const queue = pendingDbLogs();
  queue.push(entry);
  const dropped = enforceDbQueueLimit(queue);
  if (dropped > 0) {
    logger.warn({ queueLimit: DB_QUEUE_LIMIT, dropped }, '[api-log] DB queue full; dropped oldest pending entry');
  }
  if (queue.length >= DB_BATCH_SIZE) void flushQueuedApiLogs();
  else scheduleDbFlush();
}

function dbRowToEntry(row: {
  createdAt: Date;
  requestData: unknown;
  details: unknown;
  [key: string]: unknown;
}): ApiLogEntry {
  return {
    ...(row as unknown as Omit<ApiLogEntry, 'createdAt' | 'requestData' | 'details'>),
    requestData: (row.requestData as Record<string, unknown> | null) ?? null,
    details: (row.details as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function matches(entry: ApiLogEntry, query: ApiLogQuery): boolean {
  if (entry.tenantId !== query.tenantId) return false;
  if (query.actorId && entry.actorId !== query.actorId) return false;
  if (query.requestId && entry.requestId !== query.requestId) return false;
  if (query.source && entry.source !== query.source) return false;
  if (query.category && entry.category !== query.category) return false;
  if (query.method && entry.method !== query.method.toUpperCase()) return false;
  if (query.route && entry.route !== query.route) return false;
  if (query.outcome && entry.outcome !== query.outcome) return false;
  if (query.statusCode && entry.statusCode !== query.statusCode) return false;
  if (query.from && entry.createdAt < query.from.toISOString()) return false;
  if (query.to && entry.createdAt > query.to.toISOString()) return false;
  if (query.q && !JSON.stringify(entry).toLowerCase().includes(query.q.toLowerCase())) return false;
  return true;
}

export async function queryApiLogs(query: ApiLogQuery): Promise<ApiLogQueryResult> {
  const limit = Math.max(1, Math.min(200, query.limit ?? 50));
  const offset = Math.max(0, Math.min(10_000, query.offset ?? 0));
  if (isDatabaseMode()) {
    try {
      const { db, schema } = await import('@/lib/infra/drizzle-client');
      const a = schema.apiLog;
      const conditions: SQL[] = [eq(a.tenantId, query.tenantId)];
      if (query.actorId) conditions.push(eq(a.actorId, query.actorId));
      if (query.requestId) conditions.push(eq(a.requestId, query.requestId));
      if (query.source) conditions.push(eq(a.source, query.source));
      if (query.category) conditions.push(eq(a.category, query.category));
      if (query.method) conditions.push(eq(a.method, query.method.toUpperCase()));
      if (query.route) conditions.push(eq(a.route, query.route));
      if (query.outcome) conditions.push(eq(a.outcome, query.outcome));
      if (query.statusCode) conditions.push(eq(a.statusCode, query.statusCode));
      if (query.from) conditions.push(gte(a.createdAt, query.from));
      if (query.to) conditions.push(lte(a.createdAt, query.to));
      if (query.q) {
        const pattern = `%${query.q.slice(0, 100)}%`;
        conditions.push(or(
          ilike(a.operation, pattern),
          ilike(a.path, pattern),
          ilike(a.actorId, pattern),
          ilike(a.requestId, pattern),
          sql`${a.requestData}::text ILIKE ${pattern}`,
          sql`${a.details}::text ILIKE ${pattern}`,
        )!);
      }
      const rows = await db.select().from(a).where(and(...conditions))
        .orderBy(desc(a.createdAt)).limit(limit + 1).offset(offset);
      return {
        entries: rows.slice(0, limit).map(dbRowToEntry),
        hasMore: rows.length > limit,
        limit,
        offset,
      };
    } catch (error) {
      logger.warn({ err: (error as Error).message }, '[api-log] query failed; using memory fallback');
    }
  }
  const filtered = memoryLogs().filter((entry) => matches(entry, query))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    entries: filtered.slice(offset, offset + limit),
    hasMore: filtered.length > offset + limit,
    limit,
    offset,
  };
}

export function resetApiLogsForTests(): void {
  globalState.__tandem_api_logs__ = [];
  globalState.__tandem_api_log_db_queue__ = [];
  if (globalState.__tandem_api_log_flush_timer__) {
    clearTimeout(globalState.__tandem_api_log_flush_timer__);
    globalState.__tandem_api_log_flush_timer__ = undefined;
  }
}
