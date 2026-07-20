import { and, asc, eq, inArray, lt, lte, or } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { ReminderChannel, ReminderTask, ReminderTaskStatus } from '@/lib/types/reminder';
import type { ReminderTaskRepository } from './reminder-task-repo';

const table = schema.reminderTask;

function id(): string {
  return `rt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toDomain(row: typeof table.$inferSelect): ReminderTask {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    dedupeKey: row.dedupeKey,
    title: row.title,
    body: row.body ?? '',
    url: row.url,
    remindAt: row.remindAt.toISOString(),
    channels: (row.channels ?? ['in_app']) as ReminderChannel[],
    priority: row.priority as ReminderTask['priority'],
    status: row.status as ReminderTaskStatus,
    retryCount: row.retryCount,
    lastError: row.lastError,
    processingAt: row.processingAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleReminderTaskRepository implements ReminderTaskRepository {
  async create(draft: Omit<ReminderTask, 'id'> & { id?: string }): Promise<ReminderTask> {
    const [row] = await db.insert(table).values({
      id: draft.id ?? id(),
      tenantId: draft.tenantId,
      userId: draft.userId,
      sourceType: draft.sourceType,
      sourceId: draft.sourceId,
      dedupeKey: draft.dedupeKey,
      title: draft.title,
      body: draft.body,
      url: draft.url ?? null,
      remindAt: new Date(draft.remindAt),
      channels: draft.channels,
      priority: draft.priority,
      status: draft.status,
      retryCount: draft.retryCount,
      lastError: draft.lastError ?? null,
      processingAt: draft.processingAt ? new Date(draft.processingAt) : null,
      sentAt: draft.sentAt ? new Date(draft.sentAt) : null,
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    }).returning();
    return toDomain(row);
  }

  async update(id: string, patch: Partial<Omit<ReminderTask, 'id' | 'createdAt'>>): Promise<ReminderTask> {
    const [row] = await db.update(table)
      .set({
        tenantId: patch.tenantId,
        userId: patch.userId,
        sourceType: patch.sourceType,
        sourceId: patch.sourceId,
        dedupeKey: patch.dedupeKey,
        title: patch.title,
        body: patch.body,
        url: patch.url,
        remindAt: patch.remindAt ? new Date(patch.remindAt) : undefined,
        channels: patch.channels,
        priority: patch.priority,
        status: patch.status,
        retryCount: patch.retryCount,
        lastError: patch.lastError,
        processingAt: toNullableDate(patch.processingAt),
        sentAt: toNullableDate(patch.sentAt),
        updatedAt: patch.updatedAt ? new Date(patch.updatedAt) : undefined,
      })
      .where(eq(table.id, id))
      .returning();
    return toDomain(row);
  }

  async findById(taskId: string): Promise<ReminderTask | null> {
    const [row] = await db.select().from(table).where(eq(table.id, taskId)).limit(1);
    return row ? toDomain(row) : null;
  }

  async findByDedupeKey(tenantId: string, dedupeKey: string): Promise<ReminderTask | null> {
    const [row] = await db.select().from(table).where(and(eq(table.tenantId, tenantId), eq(table.dedupeKey, dedupeKey))).limit(1);
    return row ? toDomain(row) : null;
  }

  async list(filter?: {
    tenantId?: string;
    userId?: string;
    sourceType?: string;
    sourceId?: string;
    status?: ReminderTaskStatus;
  }): Promise<ReminderTask[]> {
    const conditions = [
      filter?.tenantId ? eq(table.tenantId, filter.tenantId) : undefined,
      filter?.userId ? eq(table.userId, filter.userId) : undefined,
      filter?.sourceType ? eq(table.sourceType, filter.sourceType) : undefined,
      filter?.sourceId ? eq(table.sourceId, filter.sourceId) : undefined,
      filter?.status ? eq(table.status, filter.status) : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const rows = conditions.length
      ? await db.select().from(table).where(and(...conditions))
      : await db.select().from(table);
    return rows.map(toDomain);
  }

  async listDue(nowIso: string, filter?: { tenantId?: string; userId?: string; limit?: number; maxRetryCount?: number }): Promise<ReminderTask[]> {
    const maxRetryCount = filter?.maxRetryCount ?? 3;
    const conditions = [
      or(eq(table.status, 'pending'), and(eq(table.status, 'failed'), lt(table.retryCount, maxRetryCount))),
      lte(table.remindAt, new Date(nowIso)),
      filter?.tenantId ? eq(table.tenantId, filter.tenantId) : undefined,
      filter?.userId ? eq(table.userId, filter.userId) : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const query = db.select().from(table).where(and(...conditions)).orderBy(asc(table.remindAt));
    const rows = typeof filter?.limit === 'number' ? await query.limit(filter.limit) : await query;
    return rows.map(toDomain);
  }

  async claimDue(nowIso: string, filter?: { tenantId?: string; userId?: string; limit?: number; maxRetryCount?: number }): Promise<ReminderTask[]> {
    const due = await this.listDue(nowIso, filter);
    if (due.length === 0) return [];
    const processingAt = new Date();
    const maxRetryCount = filter?.maxRetryCount ?? 3;
    const rows = await db.update(table)
      .set({ status: 'processing', processingAt, updatedAt: processingAt })
      .where(and(
        inArray(table.id, due.map((task) => task.id)),
        or(eq(table.status, 'pending'), and(eq(table.status, 'failed'), lt(table.retryCount, maxRetryCount))),
      ))
      .returning();
    return rows.map(toDomain);
  }

  async cancelBySource(tenantId: string, sourceType: string, sourceId: string): Promise<number> {
    const rows = await db.update(table)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(
        eq(table.tenantId, tenantId),
        eq(table.sourceType, sourceType),
        eq(table.sourceId, sourceId),
        inArray(table.status, ['pending', 'processing', 'failed']),
      ))
      .returning();
    return rows.length;
  }
}

function toNullableDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}
