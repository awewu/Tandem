import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { NotificationRepository } from './notification-repo';
import type { Notification } from '@/lib/types/feishu-catchup';

const t = schema.notification;

function cuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toDomain(row: typeof t.$inferSelect): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as Notification['type'],
    title: row.title,
    body: row.body,
    data: row.data as Record<string, unknown> | null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
    priority: row.priority as Notification['priority'],
    channel: row.channel as Notification['channel'],
    sourceId: row.sourceId,
    sourceType: row.sourceType,
    tenantId: row.tenantId,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleNotificationRepository implements NotificationRepository {
  async findById(id: string): Promise<Notification | null> {
    const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByUser(
    userId: string,
    opts?: { unreadOnly?: boolean; limit?: number },
  ): Promise<Notification[]> {
    const conds = [eq(t.userId, userId)];
    if (opts?.unreadOnly) conds.push(isNull(t.readAt));
    const q = db
      .select()
      .from(t)
      .where(and(...conds))
      .orderBy(desc(t.createdAt));
    const rows = opts?.limit ? await q.limit(opts.limit) : await q;
    return rows.map(toDomain);
  }

  async create(draft: Omit<Notification, 'id'> & { id?: string }): Promise<Notification> {
    const now = new Date();
    const row = {
      id: draft.id ?? cuid(),
      userId: draft.userId,
      type: draft.type,
      title: draft.title,
      body: draft.body ?? null,
      data: (draft.data ?? null) as object | null,
      readAt: draft.readAt ? new Date(draft.readAt) : null,
      dismissedAt: draft.dismissedAt ? new Date(draft.dismissedAt) : null,
      priority: draft.priority ?? 'normal',
      channel: draft.channel ?? 'in-app',
      sourceId: draft.sourceId ?? null,
      sourceType: draft.sourceType ?? null,
      tenantId: draft.tenantId ?? 'default',
      createdAt: draft.createdAt ? new Date(draft.createdAt) : now,
    };
    const [inserted] = await db.insert(t).values(row).returning();
    return toDomain(inserted);
  }

  async markRead(id: string): Promise<Notification> {
    const [row] = await db
      .update(t)
      .set({ readAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async markDismissed(id: string): Promise<Notification> {
    const [row] = await db
      .update(t)
      .set({ dismissedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async countUnread(userId: string): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(t)
      .where(and(eq(t.userId, userId), isNull(t.readAt)));
    return Number(row?.c ?? 0);
  }

  async list(filter?: { userId?: string }): Promise<Notification[]> {
    const conds = filter?.userId ? [eq(t.userId, filter.userId)] : [];
    const rows = conds.length
      ? await db.select().from(t).where(and(...conds)).orderBy(desc(t.createdAt))
      : await db.select().from(t).orderBy(desc(t.createdAt));
    return rows.map(toDomain);
  }
}
