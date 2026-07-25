/**
 * 组织云盘 provision 单测 (lib/drive/provision.ts)
 *
 * 覆盖: company_share 幂等 / dept_root 按层级镜像挂载 / 重复调用不重建 /
 *       personal_home 懒创建·仅本人可见·挂本部门 dept_root。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { DriveFile } from '@/lib/types/feishu-catchup';
import {
  provisionOrgDrive,
  ensurePersonalHome,
  DRIVE_SYSTEM_OWNER,
  type DriveFolderRepoLike,
  type ProvisionDept,
  type ProvisionUser,
} from '@/lib/drive/provision';

class FakeRepo implements DriveFolderRepoLike {
  private seq = 0;
  store: DriveFile[] = [];
  async list(opts?: { tenantId?: string }): Promise<DriveFile[]> {
    return this.store.filter((f) => !opts?.tenantId || f.tenantId === opts.tenantId);
  }
  async create(data: Omit<DriveFile, 'id'>): Promise<DriveFile> {
    const f: DriveFile = { ...data, id: `f_${++this.seq}` };
    this.store.push(f);
    return f;
  }
  async move(id: string, parentId: string | null): Promise<DriveFile> {
    const f = this.store.find((item) => item.id === id);
    if (!f) throw new Error('not found');
    f.parentId = parentId;
    f.updatedAt = new Date().toISOString();
    return f;
  }
  async softDelete(id: string): Promise<void> {
    const f = this.store.find((item) => item.id === id);
    if (f) f.deletedAt = new Date().toISOString();
  }
}

const TENANT = 'default';
// dept_b 是 dept_a 的子部门
const depts: ProvisionDept[] = [
  { id: 'dept_a', name: '销售大区', parentId: null },
  { id: 'dept_b', name: '华东销售部', parentId: 'dept_a' },
];
const users: ProvisionUser[] = [
  { id: 'u_alice', name: 'Alice', departmentId: 'dept_b' },
  { id: 'u_bob', name: 'Bob', departmentId: 'dept_a' },
  { id: 'u_disabled', name: 'Disabled', departmentId: 'dept_a', disabled: true },
];

let repo: FakeRepo;
beforeEach(() => { repo = new FakeRepo(); });

describe('provisionOrgDrive', () => {
  it('创建 company_share + 每个部门 dept_root', async () => {
    const { created } = await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    expect(created.length).toBe(3); // company_share + 2 dept_root

    const share = repo.store.find((f) => f.nodeRole === 'company_share')!;
    expect(share.parentId).toBeNull();
    expect(share.permissions.read).toEqual(['all']);
    expect(share.ownerId).toBe(DRIVE_SYSTEM_OWNER);

    const rootA = repo.store.find((f) => f.permissions.read?.includes('dept:dept_a'))!;
    const rootB = repo.store.find((f) => f.permissions.read?.includes('dept:dept_b'))!;
    expect(rootA.nodeRole).toBe('dept_root');
    expect(rootA.parentId).toBe(share.id);      // 顶层部门挂 company_share
    expect(rootB.parentId).toBe(rootA.id);       // 子部门挂父部门 dept_root (镜像层级)
    expect(rootA.isFolder).toBe(true);
  });

  it('幂等: 重复调用不重建', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const countAfterFirst = repo.store.length;
    const { created } = await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    expect(created.length).toBe(0);
    expect(repo.store.length).toBe(countAfterFirst);
  });

  it('部门声明顺序颠倒 (子在前) 仍正确挂载', async () => {
    const reversed = [depts[1], depts[0]];
    await provisionOrgDrive({ tenantId: TENANT, depts: reversed, repo });
    const rootA = repo.store.find((f) => f.permissions.read?.includes('dept:dept_a'))!;
    const rootB = repo.store.find((f) => f.permissions.read?.includes('dept:dept_b'))!;
    expect(rootB.parentId).toBe(rootA.id);
  });

  it('批量为在职员工创建个人工作区, 挂到所属部门目录下', async () => {
    const { created } = await provisionOrgDrive({ tenantId: TENANT, depts, users, repo });
    expect(created.length).toBe(5); // company_share + 2 dept_root + 2 personal_home

    const rootA = repo.store.find((f) => f.permissions.read?.includes('dept:dept_a'))!;
    const rootB = repo.store.find((f) => f.permissions.read?.includes('dept:dept_b'))!;
    const alice = repo.store.find((f) => f.nodeRole === 'personal_home' && f.ownerId === 'u_alice')!;
    const bob = repo.store.find((f) => f.nodeRole === 'personal_home' && f.ownerId === 'u_bob')!;

    expect(alice.name).toBe('Alice 的工作区');
    expect(alice.parentId).toBe(rootB.id);
    expect(bob.parentId).toBe(rootA.id);
    expect(repo.store.some((f) => f.ownerId === 'u_disabled' && f.nodeRole === 'personal_home')).toBe(false);
  });

  it('批量创建幂等: 重复调用不重建员工个人工作区', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, users, repo });
    const countAfterFirst = repo.store.length;
    const { created } = await provisionOrgDrive({ tenantId: TENANT, depts, users, repo });
    expect(created.length).toBe(0);
    expect(repo.store.length).toBe(countAfterFirst);
  });
});

describe('ensurePersonalHome', () => {
  it('懒创建 · 仅本人可见 · 挂本部门 dept_root', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const rootB = repo.store.find((f) => f.permissions.read?.includes('dept:dept_b'))!;

    const home = await ensurePersonalHome({
      tenantId: TENANT, userId: 'u_alice', userName: 'Alice', departmentId: 'dept_b', repo,
    });
    expect(home.nodeRole).toBe('personal_home');
    expect(home.ownerId).toBe('u_alice');
    expect(home.parentId).toBe(rootB.id);
    expect(home.permissions.read).toEqual(['user:u_alice']);   // 仅本人可见
    expect(home.permissions.write).toEqual(['user:u_alice']);
  });

  it('幂等: 已存在则返回原目录', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const a = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_alice', departmentId: 'dept_b', repo });
    const b = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_alice', departmentId: 'dept_b', repo });
    expect(b.id).toBe(a.id);
    expect(repo.store.filter((f) => f.nodeRole === 'personal_home').length).toBe(1);
  });

  it('人员换部门后, 复用并移动个人工作区到当前部门', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const rootA = repo.store.find((f) => f.permissions.read?.includes('dept:dept_a'))!;
    const rootB = repo.store.find((f) => f.permissions.read?.includes('dept:dept_b'))!;
    const a = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_alice', departmentId: 'dept_b', repo });
    expect(a.parentId).toBe(rootB.id);

    const b = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_alice', departmentId: 'dept_a', repo });
    expect(b.id).toBe(a.id);
    expect(b.parentId).toBe(rootA.id);
    expect(repo.store.filter((f) => f.nodeRole === 'personal_home' && f.ownerId === 'u_alice' && !f.deletedAt).length).toBe(1);
  });

  it('不会把其他用户的 personal_home 当成本人目录', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const rootB = repo.store.find((f) => f.permissions.read?.includes('dept:dept_b'))!;
    const aliceHome = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_alice', departmentId: 'dept_b', repo });
    const bobHome = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_bob', departmentId: 'dept_b', repo });

    expect(bobHome.id).not.toBe(aliceHome.id);
    expect(bobHome.ownerId).toBe('u_bob');
    expect(bobHome.parentId).toBe(rootB.id);
  });

  it('合并同一用户同一部门下重复的个人工作区', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const rootB = repo.store.find((f) => f.permissions.read?.includes('dept:dept_b'))!;
    const first = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_alice', departmentId: 'dept_b', repo });
    const { id: _firstId, ...firstDraft } = first;
    const duplicate = await repo.create({
      ...firstDraft,
      createdAt: new Date(Date.parse(first.createdAt) + 1000).toISOString(),
      updatedAt: new Date(Date.parse(first.updatedAt) + 1000).toISOString(),
    });
    const { id: _duplicateId, ...duplicateDraft } = duplicate;
    const child = await repo.create({
      ...duplicateDraft,
      name: '重复目录里的文件',
      isFolder: false,
      nodeRole: null,
      parentId: duplicate.id,
      storageKey: 'k/child',
      createdAt: new Date(Date.parse(first.createdAt) + 2000).toISOString(),
      updatedAt: new Date(Date.parse(first.updatedAt) + 2000).toISOString(),
    });

    const home = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_alice', departmentId: 'dept_b', repo });

    expect(home.id).toBe(first.id);
    expect(home.parentId).toBe(rootB.id);
    expect(repo.store.find((f) => f.id === duplicate.id)?.deletedAt).toBeTruthy();
    expect(repo.store.find((f) => f.id === child.id)?.parentId).toBe(first.id);
  });

  it('无部门 → 挂 company_share', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const share = repo.store.find((f) => f.nodeRole === 'company_share')!;
    const home = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_x', repo });
    expect(home.parentId).toBe(share.id);
  });
});
