import type { DriveFileRepository } from './drive-repo';
import type { DriveFile } from '@/lib/types/feishu-catchup';

let _id = 0;
const genId = () => `drv_${++_id}_${Date.now()}`;

export class InMemoryDriveFileRepository implements DriveFileRepository {
  private data = new Map<string, DriveFile>();

  async findById(id: string): Promise<DriveFile | null> { return this.data.get(id) ?? null; }
  async findByParent(parentId: string | null): Promise<DriveFile[]> { return Array.from(this.data.values()).filter(f => f.parentId === parentId && !f.deletedAt); }
  async findByOwner(ownerId: string): Promise<DriveFile[]> { return Array.from(this.data.values()).filter(f => f.ownerId === ownerId && !f.deletedAt); }
  async create(draft: Omit<DriveFile, 'id'> & { id?: string }): Promise<DriveFile> {
    const f = { ...(draft as DriveFile), id: draft.id ?? genId() };
    this.data.set(f.id, f); return f;
  }
  async rename(id: string, name: string): Promise<DriveFile> {
    const f = this.data.get(id); if (!f) throw new Error('not found');
    f.name = name; f.updatedAt = new Date().toISOString(); return f;
  }
  async move(id: string, parentId: string | null): Promise<DriveFile> {
    const f = this.data.get(id); if (!f) throw new Error('not found');
    f.parentId = parentId; f.updatedAt = new Date().toISOString(); return f;
  }
  async updatePermissions(id: string, permissions: DriveFile['permissions']): Promise<DriveFile> {
    const f = this.data.get(id); if (!f) throw new Error('not found');
    f.permissions = permissions; return f;
  }
  async softDelete(id: string): Promise<void> {
    const f = this.data.get(id); if (f) f.deletedAt = new Date().toISOString();
  }
  async list(filter?: { parentId?: string | null; ownerId?: string }): Promise<DriveFile[]> {
    let arr = Array.from(this.data.values()).filter(f => !f.deletedAt);
    if (filter?.parentId !== undefined) arr = arr.filter(f => f.parentId === filter.parentId);
    if (filter?.ownerId) arr = arr.filter(f => f.ownerId === filter.ownerId);
    return arr;
  }
}
