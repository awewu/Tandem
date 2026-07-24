import { describe, expect, it } from 'vitest';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import { isInDriveOrgScope, scopeBreadcrumbs, type DriveOrgScope } from '@/lib/drive/org-scope';

const scope: DriveOrgScope = {
  rootFolderId: 'deptB',
  departmentId: 'dept_b',
  departmentName: '华东销售部',
  hasDepartment: true,
  isAdmin: false,
};

function node(p: Partial<DriveFile> & { id: string }): DriveFile {
  const ts = new Date().toISOString();
  return {
    id: p.id,
    name: p.name ?? p.id,
    mimeType: p.mimeType ?? 'application/x-directory',
    size: p.size ?? 0,
    parentId: p.parentId ?? null,
    ownerId: p.ownerId ?? '__company__',
    tenantId: p.tenantId ?? 'default',
    storageKey: p.storageKey ?? '',
    storageUrl: p.storageUrl ?? null,
    permissions: p.permissions ?? {},
    version: p.version ?? 1,
    isFolder: p.isFolder ?? true,
    nodeRole: p.nodeRole ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

describe('drive org scope helpers', () => {
  it('只允许当前部门 root 及其后代', () => {
    const files = [
      node({ id: 'share', name: '公司共享区' }),
      node({ id: 'deptA', parentId: 'share', permissions: { read: ['dept:dept_a'], write: ['dept:dept_a'] } }),
      node({ id: 'deptB', parentId: 'deptA', permissions: { read: ['dept:dept_b'], write: ['dept:dept_b'] } }),
      node({ id: 'child', parentId: 'deptB' }),
      node({ id: 'oldFile', parentId: 'deptA', ownerId: 'u_alice', isFolder: false }),
    ];

    expect(isInDriveOrgScope(files, 'deptB', scope)).toBe(true);
    expect(isInDriveOrgScope(files, 'child', scope)).toBe(true);
    expect(isInDriveOrgScope(files, 'deptA', scope)).toBe(false);
    expect(isInDriveOrgScope(files, 'oldFile', scope)).toBe(false);
  });

  it('面包屑裁剪到当前部门 root 之后', () => {
    const chain = [
      { id: 'share', name: '公司共享区' },
      { id: 'deptA', name: '销售大区' },
      { id: 'deptB', name: '华东销售部' },
      { id: 'child', name: '项目资料' },
    ];

    expect(scopeBreadcrumbs(chain, scope)).toEqual([
      { id: 'deptB', name: '华东销售部' },
      { id: 'child', name: '项目资料' },
    ]);
  });
});
