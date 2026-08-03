import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { CalendarReminderRepository } from './calendar-reminder-repo';
import type { CalendarReminderTask } from '@/lib/types/calendar-management';

const table = schema.calendarReminder;

function id(): string {
  return `cr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toDomain(row: typeof table.$inferSelect): CalendarReminderTask {
  return {
    id: row.id,
    eventId: row.eventId,
    userId: row.userId,
    remindAt: row.remindAt.toISOString(),
    status: row.status as CalendarReminderTask['status'],
    tenantId: row.tenantId,
    firedAt: row.firedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleCalendarReminderRepository implements CalendarReminderRepository {
  async create(draft: Omit<CalendarReminderTask, 'id'> & { id?: string }): Promise<CalendarReminderTask> {
    const [row] = await db.insert(table).values({
      id: draft.id ?? id(),
      eventId: draft.eventId,
      userId: draft.userId,
      remindAt: new Date(draft.remindAt),
      status: draft.status,
      tenantId: draft.tenantId,
      firedAt: draft.firedAt ? new Date(draft.firedAt) : null,
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    }).returning();
    return toDomain(row);
  }

  async list(filter?: { eventId?: string; userId?: string; tenantId?: string; status?: CalendarReminderTask['status'] }): Promise<CalendarReminderTask[]> {
    const conditions = [
      filter?.eventId ? eq(table.eventId, filter.eventId) : undefined,
      filter?.userId ? eq(table.userId, filter.userId) : undefined,
      filter?.tenantId ? eq(table.tenantId, filter.tenantId) : undefined,
      filter?.status ? eq(table.status, filter.status) : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const rows = conditions.length
      ? await db.select().from(table).where(and(...conditions))
      : await db.select().from(table);
    return rows.map(toDomain);
  }

  async cancelByEventIds(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    await db.update(table)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(inArray(table.eventId, eventIds), eq(table.status, 'pending')));
  }

  async cancelByEventIdsForUser(eventIds: string[], userId: string): Promise<void> {
    if (eventIds.length === 0) return;
    await db.update(table)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(and(inArray(table.eventId, eventIds), eq(table.userId, userId), eq(table.status, 'pending')));
  }

  async markFired(taskId: string, firedAt: string): Promise<CalendarReminderTask> {
    const [row] = await db.update(table)
      .set({ status: 'fired', firedAt: new Date(firedAt), updatedAt: new Date(firedAt) })
      .where(eq(table.id, taskId))
      .returning();
    return toDomain(row);
  }
}
