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
}

const TENANT = 'default';
// dept_b 是 dept_a 的子部门
const depts: ProvisionDept[] = [
  { id: 'dept_a', name: '销售大区', parentId: null },
  { id: 'dept_b', name: '华东销售部', parentId: 'dept_a' },
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

  it('无部门 → 挂 company_share', async () => {
    await provisionOrgDrive({ tenantId: TENANT, depts, repo });
    const share = repo.store.find((f) => f.nodeRole === 'company_share')!;
    const home = await ensurePersonalHome({ tenantId: TENANT, userId: 'u_x', repo });
    expect(home.parentId).toBe(share.id);
  });
});
