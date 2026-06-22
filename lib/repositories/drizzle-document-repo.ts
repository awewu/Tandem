import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { DocumentRepository } from './document-repo';
import type { Document } from '@/lib/types/feishu-catchup';

const t = schema.document;

function cuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toDomain(row: typeof t.$inferSelect): Document {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    type: row.type as Document['type'],
    ownerId: row.ownerId,
    tenantId: row.tenantId,
    permissions: (row.permissions ?? {}) as Document['permissions'],
    version: row.version,
    isLocked: row.isLocked,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    spawnedPromotionId: row.spawnedPromotionId ?? undefined,
    spawnedDecisionCardId: row.spawnedDecisionCardId ?? undefined,
  };
}

export class DrizzleDocumentRepository implements DocumentRepository {
  async findById(id: string): Promise<Document | null> {
    const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByOwner(ownerId: string): Promise<Document[]> {
    const rows = await db
      .select()
      .from(t)
      .where(and(eq(t.ownerId, ownerId), isNull(t.deletedAt)))
      .orderBy(desc(t.updatedAt));
    return rows.map(toDomain);
  }

  async findByTenant(tenantId: string): Promise<Document[]> {
    const rows = await db
      .select()
      .from(t)
      .where(and(eq(t.tenantId, tenantId), isNull(t.deletedAt)))
      .orderBy(desc(t.updatedAt));
    return rows.map(toDomain);
  }

  async create(draft: Omit<Document, 'id'> & { id?: string }): Promise<Document> {
    const now = new Date();
    const row = {
      id: draft.id ?? cuid(),
      title: draft.title,
      content: draft.content ?? '',
      type: draft.type ?? 'doc',
      ownerId: draft.ownerId,
      tenantId: draft.tenantId ?? 'default',
      permissions: (draft.permissions ?? {}) as object,
      version: draft.version ?? 1,
      isLocked: draft.isLocked ?? false,
      spawnedPromotionId: draft.spawnedPromotionId ?? null,
      spawnedDecisionCardId: draft.spawnedDecisionCardId ?? null,
      createdAt: draft.createdAt ? new Date(draft.createdAt) : now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(t).values(row).returning();
    return toDomain(inserted);
  }

  async updateTitle(id: string, title: string): Promise<Document> {
    const [row] = await db
      .update(t)
      .set({ title, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async updateContent(id: string, content: string): Promise<Document> {
    const [row] = await db
      .update(t)
      .set({ content, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async updatePermissions(id: string, permissions: Document['permissions']): Promise<Document> {
    const [row] = await db
      .update(t)
      .set({ permissions: permissions as object, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async lock(id: string): Promise<Document> {
    const [row] = await db
      .update(t)
      .set({ isLocked: true, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async unlock(id: string): Promise<Document> {
    const [row] = await db
      .update(t)
      .set({ isLocked: false, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async setSpawnedPromotionId(id: string, promotionId: string): Promise<Document> {
    const [row] = await db
      .update(t)
      .set({ spawnedPromotionId: promotionId, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async setSpawnedDecisionCardId(id: string, decisionCardId: string): Promise<Document> {
    const [row] = await db
      .update(t)
      .set({ spawnedDecisionCardId: decisionCardId, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async softDelete(id: string): Promise<void> {
    await db.update(t).set({ deletedAt: new Date() }).where(eq(t.id, id));
  }

  async list(filter?: { ownerId?: string; tenantId?: string }): Promise<Document[]> {
    const conds = [isNull(t.deletedAt)];
    if (filter?.ownerId) conds.push(eq(t.ownerId, filter.ownerId));
    if (filter?.tenantId) conds.push(eq(t.tenantId, filter.tenantId));
    const rows = await db
      .select()
      .from(t)
      .where(and(...conds))
      .orderBy(desc(t.updatedAt));
    return rows.map(toDomain);
  }
}
