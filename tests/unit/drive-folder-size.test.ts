import { describe, expect, it } from 'vitest';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import { buildFolderSizeMap } from '@/lib/drive/folder-size';

function node(input: Partial<DriveFile> & { id: string; parentId?: string | null }): DriveFile {
  const ts = '2026-07-25T00:00:00.000Z';
  return {
    id: input.id,
    name: input.name ?? input.id,
    mimeType: input.mimeType ?? (input.isFolder ? 'application/x-directory' : 'text/plain'),
    size: input.size ?? 0,
    parentId: input.parentId ?? null,
    ownerId: input.ownerId ?? 'u_owner',
    tenantId: input.tenantId ?? 'default',
    storageKey: input.storageKey ?? '',
    storageUrl: input.storageUrl ?? null,
    permissions: input.permissions ?? {},
    version: input.version ?? 1,
    isFolder: input.isFolder ?? true,
    nodeRole: input.nodeRole ?? null,
    createdAt: input.createdAt ?? ts,
    updatedAt: input.updatedAt ?? ts,
    deletedAt: input.deletedAt,
  };
}

describe('buildFolderSizeMap', () => {
  it('递归统计文件夹下所有未删除文件大小', () => {
    const sizes = buildFolderSizeMap([
      node({ id: 'root' }),
      node({ id: 'outer', parentId: 'root' }),
      node({ id: 'inner', parentId: 'outer' }),
      node({ id: 'a', parentId: 'outer', isFolder: false, size: 512 }),
      node({ id: 'b', parentId: 'inner', isFolder: false, size: 1536 }),
      node({ id: 'deleted', parentId: 'inner', isFolder: false, size: 2048, deletedAt: '2026-07-25T01:00:00.000Z' }),
    ]);

    expect(sizes.get('inner')).toBe(1536);
    expect(sizes.get('outer')).toBe(2048);
    expect(sizes.get('root')).toBe(2048);
  });
});
