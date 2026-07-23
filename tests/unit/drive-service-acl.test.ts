/**
 * DriveService ACL 鉴权集成单测 (lib/services/drive-service.ts)
 *
 * 用 InMemoryDriveFileRepository 直接播种目录树, 验证 service 层:
 *   list 只回可读子节点 / getById·requestDownload ACL / create·delete·move·rename 写权 /
 *   updatePermissions 仅 owner|admin / 目录继承生效 / 跨部门不可见。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import type { ApplicationContext } from '@/lib/repositories/app-context';
import { InMemoryDriveFileRepository } from '@/lib/repositories/memory-drive-repo';
import { DriveService } from '@/lib/services/drive-service';
import type { DriveAclUser } from '@/lib/drive/acl';

const TENANT = 'default';
const alice: DriveAclUser = { id: 'u_alice', departmentId: 'dept_a', roles: ['employee'] };
const bob: DriveAclUser = { id: 'u_bob', departmentId: 'dept_b', roles: ['employee'] };
const admin: DriveAclUser = { id: 'u_admin', departmentId: null, roles: ['admin'] };

let repo: InMemoryDriveFileRepository;
let svc: DriveService;

function folder(p: Partial<DriveFile> & { id: string; ownerId: string }): Omit<DriveFile, 'id'> & { id: string } {
  const ts = new Date().toISOString();
  return {
    id: p.id,
    name: p.name ?? p.id,
    mimeType: p.mimeType ?? 'application/x-directory',
    size: p.size ?? 0,
    parentId: p.parentId ?? null,
    ownerId: p.ownerId,
    tenantId: p.tenantId ?? TENANT,
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

// company_share(all) → dept_root(dept_a) → file(继承) ; 另有 alice 的 owner-only 文件
beforeEach(async () => {
  repo = new InMemoryDriveFileRepository();
  svc = new DriveService({ driveRepo: repo } as unknown as ApplicationContext);
  await repo.create(folder({ id: 'share', name: '公司共享区', parentId: null, ownerId: '__company__', nodeRole: 'company_share', permissions: { read: ['all'], write: ['role:admin'] } }));
  await repo.create(folder({ id: 'deptA', name: 'A部门', parentId: 'share', ownerId: '__company__', nodeRole: 'dept_root', permissions: { read: ['dept:dept_a'], write: ['dept:dept_a'] } }));
  await repo.create(folder({ id: 'fileA', name: 'a.txt', parentId: 'deptA', ownerId: 'u_carol', isFolder: false, storageKey: 'k/a', permissions: {} })); // 继承 deptA
  await repo.create(folder({ id: 'priv', name: 'private.txt', parentId: null, ownerId: 'u_alice', isFolder: false, storageKey: 'k/p', permissions: { read: ['user:u_alice'], write: ['user:u_alice'] } }));
});

describe('list · ACL 过滤', () => {
  it('company_share 下 dept_root: 同部门可见, 跨部门不可见', async () => {
    const forAlice = await svc.list({ parentId: 'share', tenantId: TENANT }, alice);
    expect(forAlice.map((f) => f.id)).toContain('deptA');
    const forBob = await svc.list({ parentId: 'share', tenantId: TENANT }, bob);
    expect(forBob.map((f) => f.id)).not.toContain('deptA');
  });

  it('继承: deptA 下文件对 A 部门可见, 对 B 不可见', async () => {
    expect((await svc.list({ parentId: 'deptA', tenantId: TENANT }, alice)).map((f) => f.id)).toContain('fileA');
    expect((await svc.list({ parentId: 'deptA', tenantId: TENANT }, bob)).map((f) => f.id)).not.toContain('fileA');
  });

  it('all: company_share 根对任何人可见', async () => {
    expect((await svc.list({ parentId: null, tenantId: TENANT }, bob)).map((f) => f.id)).toContain('share');
  });
});

describe('getById / requestDownload · 读权', () => {
  it('跨部门读被拒 (Forbidden)', async () => {
    await expect(svc.getById('fileA', bob)).rejects.toThrow(/permission/i);
  });
  it('同部门可读', async () => {
    expect((await svc.getById('fileA', alice))?.id).toBe('fileA');
  });
  it('requestDownload 无读权先被 ACL 拒 (不泄漏)', async () => {
    await expect(svc.requestDownload('fileA', bob)).rejects.toThrow(/permission/i);
  });
});

describe('create · 写权', () => {
  it('A 部门成员可在 deptA 下建文件', async () => {
    const f = await svc.create({ name: 'new.txt', parentId: 'deptA', storageKey: 'k/n' }, alice);
    expect(f.ownerId).toBe('u_alice');
    expect(f.permissions).toEqual({}); // 继承
  });
  it('跨部门在 deptA 下建文件被拒', async () => {
    await expect(svc.create({ name: 'x', parentId: 'deptA', storageKey: 'k/x' }, bob)).rejects.toThrow(/permission/i);
  });
});

describe('delete / move / rename · 写权', () => {
  it('owner 可删自己的私有文件', async () => {
    await expect(svc.delete('priv', alice)).resolves.toBeUndefined();
  });
  it('非 owner 且无写权不能删', async () => {
    await expect(svc.delete('priv', bob)).rejects.toThrow(/permission/i);
  });
  it('部门成员(有写权)可删部门文件', async () => {
    await expect(svc.delete('fileA', alice)).resolves.toBeUndefined();
  });
  it('rename 需写权', async () => {
    await expect(svc.rename('fileA', 'b.txt', bob)).rejects.toThrow(/permission/i);
    expect((await svc.rename('fileA', 'b.txt', alice)).name).toBe('b.txt');
  });
});

describe('updatePermissions · 仅 owner|admin', () => {
  it('owner 可改共享', async () => {
    const f = await svc.updatePermissions('priv', { read: ['user:u_alice', 'dept:dept_a'] }, alice);
    expect(f.permissions.read).toContain('dept:dept_a');
  });
  it('admin 可改任意文件共享', async () => {
    const f = await svc.updatePermissions('fileA', { read: ['all'] }, admin);
    expect(f.permissions.read).toEqual(['all']);
  });
  it('普通协作者不能改共享 (即便有写权)', async () => {
    await expect(svc.updatePermissions('fileA', { read: ['all'] }, alice)).rejects.toThrow(/owner or admin/i);
  });
});
