import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { CalendarSubscriptionRepository } from './calendar-subscription-repo';
import type { CalendarSubscription } from '@/lib/types/calendar-management';

const table = schema.calendarSubscription;

function id(): string {
  return `cs${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toDomain(row: typeof table.$inferSelect): CalendarSubscription {
  return {
    id: row.id,
    subscriberId: row.subscriberId,
    targetUserId: row.targetUserId,
    status: row.status as CalendarSubscription['status'],
    detailPermission: row.detailPermission as CalendarSubscription['detailPermission'],
    tenantId: row.tenantId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleCalendarSubscriptionRepository implements CalendarSubscriptionRepository {
  async findById(subscriptionId: string): Promise<CalendarSubscription | null> {
    const rows = await db.select().from(table).where(eq(table.id, subscriptionId)).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByUsers(subscriberId: string, targetUserId: string, tenantId: string): Promise<CalendarSubscription | null> {
    const rows = await db.select().from(table).where(and(
      eq(table.subscriberId, subscriberId),
      eq(table.targetUserId, targetUserId),
      eq(table.tenantId, tenantId),
    )).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async create(draft: Omit<CalendarSubscription, 'id'> & { id?: string }): Promise<CalendarSubscription> {
    const [row] = await db.insert(table).values({
      id: draft.id ?? id(),
      subscriberId: draft.subscriberId,
      targetUserId: draft.targetUserId,
      status: draft.status,
      detailPermission: draft.detailPermission,
      tenantId: draft.tenantId,
      createdAt: new Date(draft.createdAt),
      updatedAt: new Date(draft.updatedAt),
    }).returning();
    return toDomain(row);
  }

  async update(subscriptionId: string, patch: Partial<CalendarSubscription>): Promise<CalendarSubscription> {
    const [row] = await db.update(table).set({
      status: patch.status,
      detailPermission: patch.detailPermission,
      updatedAt: patch.updatedAt ? new Date(patch.updatedAt) : new Date(),
    }).where(eq(table.id, subscriptionId)).returning();
    return toDomain(row);
  }

  async list(filter?: { subscriberId?: string; targetUserId?: string; tenantId?: string }): Promise<CalendarSubscription[]> {
    const conditions = [
      filter?.subscriberId ? eq(table.subscriberId, filter.subscriberId) : undefined,
      filter?.targetUserId ? eq(table.targetUserId, filter.targetUserId) : undefined,
      filter?.tenantId ? eq(table.tenantId, filter.tenantId) : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const rows = conditions.length
      ? await db.select().from(table).where(and(...conditions))
      : await db.select().from(table);
    return rows.map(toDomain);
  }
}

