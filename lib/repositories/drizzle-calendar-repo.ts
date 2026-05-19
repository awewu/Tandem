import { eq, and, gte, lte, sql, asc, arrayContains } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { CalendarEventRepository } from './calendar-repo';
import type { CalendarEvent } from '@/lib/types/feishu-catchup';

const t = schema.calendarEvent;

function cuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toDomain(row: typeof t.$inferSelect): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    timezone: row.timezone,
    allDay: row.allDay,
    recurringRule: row.recurringRule as Record<string, unknown> | null,
    ownerId: row.ownerId,
    attendees: row.attendees,
    location: row.location,
    meetingUrl: row.meetingUrl,
    calendarSource: row.calendarSource as CalendarEvent['calendarSource'],
    externalId: row.externalId,
    status: row.status as CalendarEvent['status'],
    tenantId: row.tenantId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleCalendarEventRepository implements CalendarEventRepository {
  async findById(id: string): Promise<CalendarEvent | null> {
    const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByOwner(ownerId: string, range?: { from: Date; to: Date }): Promise<CalendarEvent[]> {
    const conds = [eq(t.ownerId, ownerId)];
    if (range) {
      conds.push(gte(t.startAt, range.from), lte(t.endAt, range.to));
    }
    const rows = await db.select().from(t).where(and(...conds)).orderBy(asc(t.startAt));
    return rows.map(toDomain);
  }

  async findByAttendee(userId: string, range?: { from: Date; to: Date }): Promise<CalendarEvent[]> {
    const conds = [arrayContains(t.attendees, [userId])];
    if (range) {
      conds.push(gte(t.startAt, range.from), lte(t.endAt, range.to));
    }
    const rows = await db.select().from(t).where(and(...conds)).orderBy(asc(t.startAt));
    return rows.map(toDomain);
  }

  async create(draft: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<CalendarEvent> {
    const now = new Date();
    const row = {
      id: draft.id ?? cuid(),
      title: draft.title,
      description: draft.description ?? null,
      startAt: new Date(draft.startAt),
      endAt: new Date(draft.endAt),
      timezone: draft.timezone ?? 'Asia/Shanghai',
      allDay: draft.allDay ?? false,
      recurringRule: (draft.recurringRule ?? null) as object | null,
      ownerId: draft.ownerId,
      attendees: draft.attendees ?? [],
      location: draft.location ?? null,
      meetingUrl: draft.meetingUrl ?? null,
      calendarSource: draft.calendarSource ?? 'manual',
      externalId: draft.externalId ?? null,
      status: draft.status ?? 'confirmed',
      tenantId: draft.tenantId ?? 'default',
      createdAt: draft.createdAt ? new Date(draft.createdAt) : now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(t).values(row).returning();
    return toDomain(inserted);
  }

  async updateTime(id: string, startAt: string, endAt: string): Promise<CalendarEvent> {
    const [row] = await db
      .update(t)
      .set({ startAt: new Date(startAt), endAt: new Date(endAt), updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async addAttendees(id: string, userIds: string[]): Promise<CalendarEvent> {
    const cur = await this.findById(id);
    if (!cur) throw new Error(`CalendarEvent ${id} not found`);
    const next = Array.from(new Set([...cur.attendees, ...userIds]));
    const [row] = await db
      .update(t)
      .set({ attendees: next, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async removeAttendees(id: string, userIds: string[]): Promise<CalendarEvent> {
    const cur = await this.findById(id);
    if (!cur) throw new Error(`CalendarEvent ${id} not found`);
    const next = cur.attendees.filter((u) => !userIds.includes(u));
    const [row] = await db
      .update(t)
      .set({ attendees: next, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async cancel(id: string): Promise<CalendarEvent> {
    const [row] = await db
      .update(t)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async list(filter?: { ownerId?: string }): Promise<CalendarEvent[]> {
    const conds = filter?.ownerId ? [eq(t.ownerId, filter.ownerId)] : [];
    const rows = conds.length
      ? await db.select().from(t).where(and(...conds)).orderBy(asc(t.startAt))
      : await db.select().from(t).orderBy(asc(t.startAt));
    return rows.map(toDomain);
  }
}

// helper to silence unused import warning if removed
void sql;
