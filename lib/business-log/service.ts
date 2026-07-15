import { randomUUID } from 'crypto';
import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from 'drizzle-orm';
import { logger } from '@/lib/infra/logger';
import { redactBusinessLogData } from './redact';
import type {
  BusinessLogEntry,
  BusinessLogInput,
  BusinessLogQuery,
  BusinessLogQueryResult,
} from './types';

const MEMORY_LIMIT = Math.max(100, Number(process.env.BUSINESS_LOG_MEMORY_MAX ?? 5_000));
const globalState = globalThis as typeof globalThis & { __tandem_business_logs__?: BusinessLogEntry[] };

function memoryLogs(): BusinessLogEntry[] {
  if (!globalState.__tandem_business_logs__) globalState.__tandem_business_logs__ = [];
  return globalState.__tandem_business_logs__;
}

function normalize(input: BusinessLogInput): BusinessLogEntry {
  const createdAt = input.createdAt instanceof Date
    ? input.createdAt.toISOString()
    : input.createdAt ?? new Date().toISOString();
  return {
    id: input.id ?? `blog_${randomUUID()}`,
    requestId: input.requestId ?? null,
    tenantId: input.tenantId ?? 'default',
    actorId: input.actorId ?? 'system',
    actorType: input.actorType ?? 'system',
    source: input.source ?? 'domain',
    category: input.category ?? 'system',
    operation: input.operation,
    action: input.action,
    targetType: input.targetType ?? null,
    targetId: input.targetId ?? null,
    outcome: input.outcome,
    level: input.level ?? (input.outcome === 'error' ? 'error' : input.outcome === 'success' ? 'info' : 'warn'),
    summary: input.summary.slice(0, 1_000),
    details: redactBusinessLogData(input.details),
    createdAt: typeof createdAt === 'string' ? createdAt : new Date(createdAt).toISOString(),
  };
}

function remember(entry: BusinessLogEntry): void {
  const logs = memoryLogs();
  logs.push(entry);
  if (logs.length > MEMORY_LIMIT) logs.splice(0, logs.length - MEMORY_LIMIT);
}

export async function appendBusinessLog(input: BusinessLogInput): Promise<BusinessLogEntry> {
  const entry = normalize(input);
  remember(entry);

  if (process.env.DATABASE_URL) {
    try {
      const { db, schema } = await import('@/lib/infra/drizzle-client');
      await db.insert(schema.businessLog).values({
        ...entry,
        kind: 'business_operation',
        method: null,
        path: null,
        route: null,
        statusCode: null,
        durationMs: null,
        requestData: null,
        createdAt: new Date(entry.createdAt),
      });
    } catch (error) {
      logger.warn(
        { requestId: entry.requestId, operation: entry.operation, err: (error as Error).message },
        '[business-log] persist failed; retained in memory',
      );
    }
  }
  return entry;
}

export function deferBusinessLog(input: BusinessLogInput): void {
  queueMicrotask(() => {
    void appendBusinessLog(input).catch((error) => {
      logger.warn({ err: (error as Error).message }, '[business-log] deferred write failed');
    });
  });
}

function dbRowToEntry(row: {
  id: string;
  requestId: string | null;
  tenantId: string;
  actorId: string;
  actorType: string;
  source: string;
  category: string;
  operation: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  outcome: string;
  level: string;
  summary: string;
  details: unknown;
  createdAt: Date;
}): BusinessLogEntry {
  return {
    ...row,
    outcome: row.outcome as BusinessLogEntry['outcome'],
    level: row.level as BusinessLogEntry['level'],
    details: (row.details as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function matches(entry: BusinessLogEntry, query: BusinessLogQuery): boolean {
  if (entry.tenantId !== query.tenantId) return false;
  if (query.actorId && entry.actorId !== query.actorId) return false;
  if (query.requestId && entry.requestId !== query.requestId) return false;
  if (query.source && entry.source !== query.source) return false;
  if (query.category && entry.category !== query.category) return false;
  if (query.operation && entry.operation !== query.operation) return false;
  if (query.action && entry.action !== query.action) return false;
  if (query.outcome && entry.outcome !== query.outcome) return false;
  if (query.targetType && entry.targetType !== query.targetType) return false;
  if (query.targetId && entry.targetId !== query.targetId) return false;
  if (query.from && entry.createdAt < query.from.toISOString()) return false;
  if (query.to && entry.createdAt > query.to.toISOString()) return false;
  if (query.q && !JSON.stringify(entry).toLowerCase().includes(query.q.toLowerCase())) return false;
  return true;
}

export async function queryBusinessLogs(query: BusinessLogQuery): Promise<BusinessLogQueryResult> {
  const limit = Math.max(1, Math.min(200, query.limit ?? 50));
  const offset = Math.max(0, Math.min(10_000, query.offset ?? 0));

  if (process.env.DATABASE_URL) {
    try {
      const { db, schema } = await import('@/lib/infra/drizzle-client');
      const b = schema.businessLog;
      const conditions: SQL[] = [eq(b.tenantId, query.tenantId), eq(b.kind, 'business_operation')];
      if (query.actorId) conditions.push(eq(b.actorId, query.actorId));
      if (query.requestId) conditions.push(eq(b.requestId, query.requestId));
      if (query.source) conditions.push(eq(b.source, query.source));
      if (query.category) conditions.push(eq(b.category, query.category));
      if (query.operation) conditions.push(eq(b.operation, query.operation));
      if (query.action) conditions.push(eq(b.action, query.action));
      if (query.outcome) conditions.push(eq(b.outcome, query.outcome));
      if (query.targetType) conditions.push(eq(b.targetType, query.targetType));
      if (query.targetId) conditions.push(eq(b.targetId, query.targetId));
      if (query.from) conditions.push(gte(b.createdAt, query.from));
      if (query.to) conditions.push(lte(b.createdAt, query.to));
      if (query.q) {
        const pattern = `%${query.q.slice(0, 100)}%`;
        conditions.push(or(
          ilike(b.summary, pattern),
          ilike(b.operation, pattern),
          ilike(b.category, pattern),
          ilike(b.actorId, pattern),
          ilike(b.targetId, pattern),
          sql`${b.details}::text ILIKE ${pattern}`,
        )!);
      }
      const rows = await db
        .select({
          id: b.id,
          requestId: b.requestId,
          tenantId: b.tenantId,
          actorId: b.actorId,
          actorType: b.actorType,
          source: b.source,
          category: b.category,
          operation: b.operation,
          action: b.action,
          targetType: b.targetType,
          targetId: b.targetId,
          outcome: b.outcome,
          level: b.level,
          summary: b.summary,
          details: b.details,
          createdAt: b.createdAt,
        })
        .from(b)
        .where(and(...conditions))
        .orderBy(desc(b.createdAt))
        .limit(limit + 1)
        .offset(offset);
      return {
        entries: rows.slice(0, limit).map(dbRowToEntry),
        hasMore: rows.length > limit,
        limit,
        offset,
      };
    } catch (error) {
      logger.warn({ err: (error as Error).message }, '[business-log] query failed; using memory fallback');
    }
  }

  const filtered = memoryLogs()
    .filter((entry) => matches(entry, query))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    entries: filtered.slice(offset, offset + limit),
    hasMore: filtered.length > offset + limit,
    limit,
    offset,
  };
}

export function resetBusinessLogsForTests(): void {
  globalState.__tandem_business_logs__ = [];
}
