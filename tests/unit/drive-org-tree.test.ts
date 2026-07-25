import { describe, expect, it } from 'vitest';
import { buildDriveDeptTree } from '@/lib/drive/org-tree';
import type { DriveFile } from '@/lib/types/feishu-catchup';

function folder(input: Partial<DriveFile> & Pick<DriveFile, 'id' | 'name'>): DriveFile {
  return {
    id: input.id,
    name: input.name,
    parentId: input.parentId ?? null,
    ownerId: input.ownerId ?? '__company__',
    tenantId: input.tenantId ?? 'default',
    mimeType: 'application/x-directory',
    size: 0,
    storageKey: '',
    storageUrl: null,
    version: 1,
    isFolder: true,
    distillable: true,
    createdAt: input.createdAt ?? '2026-07-24T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-07-24T00:00:00.000Z',
    nodeRole: input.nodeRole ?? 'dept_root',
    permissions: input.permissions ?? { read: [], write: [] },
  };
}

describe('buildDriveDeptTree', () => {
  it('promotes a visible child department to root when its parent is outside current scope', () => {
    const depts = [
      { id: 'group', name: '集团', parentId: null, updatedAt: '2026-07-24T00:00:00.000Z' },
      { id: 'ceo-office', name: '总裁办', parentId: 'group', updatedAt: '2026-07-24T00:00:00.000Z' },
    ];
    const folderByDeptId = new Map<string, DriveFile>([
      ['ceo-office', folder({ id: 'folder-ceo-office', name: '总裁办' })],
    ]);

    const tree = buildDriveDeptTree(depts, folderByDeptId, new Map([['ceo-office', 7]]));

    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      id: 'folder-ceo-office',
      deptId: 'ceo-office',
      name: '总裁办',
      parentId: null,
      peopleCount: 7,
    });
  });
});
