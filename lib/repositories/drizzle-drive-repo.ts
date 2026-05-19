import { eq, and, isNull, desc } from 'drizzle-orm';
import { db, schema } from '@/lib/infra/drizzle-client';
import type { DriveFileRepository } from './drive-repo';
import type { DriveFile } from '@/lib/types/feishu-catchup';

const t = schema.driveFile;

function cuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function toDomain(row: typeof t.$inferSelect): DriveFile {
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    size: row.size,
    parentId: row.parentId,
    ownerId: row.ownerId,
    tenantId: row.tenantId,
    storageKey: row.storageKey,
    storageUrl: row.storageUrl,
    permissions: (row.permissions ?? {}) as DriveFile['permissions'],
    version: row.version,
    isFolder: row.isFolder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export class DrizzleDriveFileRepository implements DriveFileRepository {
  async findById(id: string): Promise<DriveFile | null> {
    const rows = await db.select().from(t).where(eq(t.id, id)).limit(1);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByParent(parentId: string | null): Promise<DriveFile[]> {
    const cond = parentId === null ? isNull(t.parentId) : eq(t.parentId, parentId);
    const rows = await db
      .select()
      .from(t)
      .where(and(cond, isNull(t.deletedAt)))
      .orderBy(desc(t.updatedAt));
    return rows.map(toDomain);
  }

  async findByOwner(ownerId: string): Promise<DriveFile[]> {
    const rows = await db
      .select()
      .from(t)
      .where(and(eq(t.ownerId, ownerId), isNull(t.deletedAt)))
      .orderBy(desc(t.updatedAt));
    return rows.map(toDomain);
  }

  async create(draft: Omit<DriveFile, 'id'> & { id?: string }): Promise<DriveFile> {
    const now = new Date();
    const row = {
      id: draft.id ?? cuid(),
      name: draft.name,
      mimeType: draft.mimeType ?? 'application/octet-stream',
      size: draft.size ?? 0,
      parentId: draft.parentId ?? null,
      ownerId: draft.ownerId,
      tenantId: draft.tenantId ?? 'default',
      storageKey: draft.storageKey,
      storageUrl: draft.storageUrl ?? null,
      permissions: (draft.permissions ?? {}) as object,
      version: draft.version ?? 1,
      isFolder: draft.isFolder ?? false,
      createdAt: draft.createdAt ? new Date(draft.createdAt) : now,
      updatedAt: now,
    };
    const [inserted] = await db.insert(t).values(row).returning();
    return toDomain(inserted);
  }

  async rename(id: string, name: string): Promise<DriveFile> {
    const [row] = await db
      .update(t)
      .set({ name, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async move(id: string, parentId: string | null): Promise<DriveFile> {
    const [row] = await db
      .update(t)
      .set({ parentId, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async updatePermissions(id: string, permissions: DriveFile['permissions']): Promise<DriveFile> {
    const [row] = await db
      .update(t)
      .set({ permissions: permissions as object, updatedAt: new Date() })
      .where(eq(t.id, id))
      .returning();
    return toDomain(row);
  }

  async softDelete(id: string): Promise<void> {
    await db.update(t).set({ deletedAt: new Date() }).where(eq(t.id, id));
  }

  async list(filter?: { parentId?: string | null; ownerId?: string }): Promise<DriveFile[]> {
    const conds = [isNull(t.deletedAt)];
    if (filter?.ownerId) conds.push(eq(t.ownerId, filter.ownerId));
    if (filter && 'parentId' in filter) {
      conds.push(filter.parentId === null ? isNull(t.parentId) : eq(t.parentId, filter.parentId!));
    }
    const rows = await db
      .select()
      .from(t)
      .where(and(...conds))
      .orderBy(desc(t.updatedAt));
    return rows.map(toDomain);
  }
}
