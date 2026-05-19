import type { DriveFile } from '@/lib/types/feishu-catchup';

export interface DriveFileRepository {
  findById(id: string): Promise<DriveFile | null>;
  findByParent(parentId: string | null): Promise<DriveFile[]>;
  findByOwner(ownerId: string): Promise<DriveFile[]>;
  create(draft: Omit<DriveFile, 'id'> & { id?: string }): Promise<DriveFile>;
  rename(id: string, name: string): Promise<DriveFile>;
  move(id: string, parentId: string | null): Promise<DriveFile>;
  updatePermissions(id: string, permissions: DriveFile['permissions']): Promise<DriveFile>;
  softDelete(id: string): Promise<void>;
  list(filter?: { parentId?: string | null; ownerId?: string }): Promise<DriveFile[]>;
}
