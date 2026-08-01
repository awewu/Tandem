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
  await repo.create(folder({ id: 'emptyFolder', name: '空文件夹', parentId: 'deptA', ownerId: 'u_alice', isFolder: true, storageKey: '', permissions: {} }));
  await repo.create(folder({ id: 'priv', name: 'private.txt', parentId: null, ownerId: 'u_alice', isFolder: false, storageKey: 'k/p', permissions: { read: ['user:u_alice'], write: ['user:u_alice'] } }));
});

describe('list · ACL 过滤', () => {
  it('company_share 下 dept_root: 同部门可见, 跨部门不可见', async () => {
    const forAlice = await svc.list({ parentId: 'share', tenantId: TENANT }, alice);
    expect(forAlice.map((f) => f.id)).toContain('deptA');
    const forBob = await svc.list({ parentId: 'share', tenantId: TENANT }, bob);
    expect(forBob.map((f) => f.id)).not.toContain('deptA');
  });

  it('管理员可见所有部门目录', async () => {
    const forAdmin = await svc.list({ parentId: 'share', tenantId: TENANT }, admin);
    expect(forAdmin.map((f) => f.id)).toContain('deptA');
  });

  it('继承: deptA 下文件对 A 部门可见, 对 B 不可见', async () => {
    expect((await svc.list({ parentId: 'deptA', tenantId: TENANT }, alice)).map((f) => f.id)).toContain('fileA');
    expect((await svc.list({ parentId: 'deptA', tenantId: TENANT }, bob)).map((f) => f.id)).not.toContain('fileA');
  });

  it('all: company_share 根对任何人可见', async () => {
    expect((await svc.list({ parentId: null, tenantId: TENANT }, bob)).map((f) => f.id)).toContain('share');
  });
});

describe('search · 共享资料搜索', () => {
  it('按名称搜索当前共享范围内可读资料', async () => {
    const found = await svc.search({ query: 'a.', tenantId: TENANT, rootId: 'deptA' }, alice);
    expect(found.map((f) => f.id)).toEqual(['fileA']);
  });

  it('跨部门用户搜不到无权共享资料', async () => {
    const found = await svc.search({ query: 'a.', tenantId: TENANT, rootId: 'share' }, bob);
    expect(found.map((f) => f.id)).not.toContain('fileA');
  });

  it('管理员可在公司共享区搜索全部组织资料', async () => {
    const found = await svc.search({ query: 'a.', tenantId: TENANT, rootId: 'share' }, admin);
    expect(found.map((f) => f.id)).toContain('fileA');
  });

  it('搜索会匹配所在路径, 不是只改页面标题', async () => {
    await repo.create(folder({ id: 'hotWater', name: '热水资料', parentId: 'deptA', ownerId: '__company__', isFolder: true, storageKey: '', permissions: {} }));
    await repo.create(folder({ id: 'hotWaterFile', name: '销售达成.xlsx', parentId: 'hotWater', ownerId: 'u_alice', isFolder: false, storageKey: 'k/hot-water', permissions: {} }));

    const found = await svc.search({ query: '热水', tenantId: TENANT, rootId: 'share' }, alice);
    expect(found.map((f) => f.id)).toContain('hotWaterFile');
  });

  it('rootId 限制搜索范围, 不把个人私有根文件混入共享资料', async () => {
    const found = await svc.search({ query: 'private', tenantId: TENANT, rootId: 'share' }, alice);
    expect(found).toHaveLength(0);
  });
});

describe('getById / requestDownload · 读权', () => {
  it('跨部门读被拒 (Forbidden)', async () => {
    await expect(svc.getById('fileA', bob)).rejects.toThrow(/permission/i);
  });
  it('同部门可读', async () => {
    expect((await svc.getById('fileA', alice))?.id).toBe('fileA');
  });
  it('管理员可读跨部门文件', async () => {
    expect((await svc.getById('fileA', admin))?.id).toBe('fileA');
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
  it('创建者可删除自己的文件', async () => {
    await expect(svc.delete('priv', alice)).resolves.toBeUndefined();
  });
  it('创建者可删除自己的空文件夹', async () => {
    await expect(svc.delete('emptyFolder', alice)).resolves.toBeUndefined();
  });
  it('非创建者且非管理员不能删除, 即使有部门写权', async () => {
    await expect(svc.delete('fileA', alice)).rejects.toThrow(/owner/i);
  });
  it('管理员可删除文件', async () => {
    await expect(svc.delete('fileA', admin)).resolves.toBeUndefined();
  });
  it('管理员不能删除非空文件夹', async () => {
    await expect(svc.delete('deptA', admin)).rejects.toThrow(/not empty/i);
  });
  it('管理员可删除空文件夹', async () => {
    await expect(svc.delete('emptyFolder', admin)).resolves.toBeUndefined();
  });
  it('只能移动自己创建的文件或文件夹', async () => {
    await expect(svc.move('fileA', 'emptyFolder', alice)).rejects.toThrow(/owner/i);
    await expect(svc.move('fileA', 'emptyFolder', admin)).rejects.toThrow(/owner/i);
    expect((await svc.move('emptyFolder', null, alice)).parentId).toBeNull();
  });
  it('不能把文件夹移动到自己或自己的子文件夹', async () => {
    await repo.create(folder({ id: 'childFolder', name: '子文件夹', parentId: 'emptyFolder', ownerId: 'u_alice', isFolder: true, storageKey: '', permissions: {} }));

    await expect(svc.move('emptyFolder', 'emptyFolder', alice)).rejects.toThrow(/itself/i);
    await expect(svc.move('emptyFolder', 'childFolder', alice)).rejects.toThrow(/child folder/i);
  });
  it('rename 需写权', async () => {
    await expect(svc.rename('fileA', 'b.txt', bob)).rejects.toThrow(/permission/i);
    expect((await svc.rename('fileA', 'b.txt', alice)).name).toBe('b.txt');
  });
  it('管理员可写跨部门文件', async () => {
    expect((await svc.rename('fileA', 'admin.txt', admin)).name).toBe('admin.txt');
  });
  it('人员文件夹由组织架构生成, 不允许改名', async () => {
    await repo.create(folder({
      id: 'aliceHome',
      name: 'Alice 的工作区',
      parentId: 'deptA',
      ownerId: 'u_alice',
      nodeRole: 'personal_home',
      permissions: { read: ['user:u_alice'], write: ['user:u_alice'] },
    }));

    await expect(svc.rename('aliceHome', '新名字', admin)).rejects.toThrow(/Personal home/i);
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
