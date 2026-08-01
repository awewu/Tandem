import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { listMyChannels, listVisibleChannels, seedDepartmentChannels } from '@/lib/im/service';
import { COOKIE_ACCESS, signAccessToken } from '@/lib/auth/session';

vi.mock('@/lib/boot', async () => {
  const repo = await import('@/lib/storage/repository');
  return {
    boot: vi.fn(async () => {}),
    getStore: repo.getStore,
  };
});

beforeEach(() => {
  setStore(createInMemoryStore());
});

describe('IM seedDepartmentChannels', () => {
  it('按 tenant 隔离自动组织群的幂等判断和创建结果', async () => {
    await seedDepartmentChannels(
      [{ departmentId: 'dept-sales', name: '销售部 部门群', memberIds: ['u-other'], level: 'department' }],
      'u-other',
      'tenant-other',
    );

    const result = await seedDepartmentChannels(
      [{ departmentId: 'dept-sales', name: '销售部 部门群', memberIds: ['u-me'], level: 'department' }],
      'u-me',
      'tenant-main',
    );

    expect(result.created).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);

    const channels = await getStore().imChannels.list();
    const main = channels.find((c) => c.tenantId === 'tenant-main' && c.departmentId === 'dept-sales');
    expect(main).toMatchObject({
      name: '销售部',
      type: 'department',
      autoCreated: true,
      tenantId: 'tenant-main',
    });
    expect(main?.memberIds).toEqual(expect.arrayContaining(['u-me']));
  });

  it('同步操作人不自动加入所有组织群, 组织管理员也只能查看自己加入的群', async () => {
    await seedDepartmentChannels(
      [
        { departmentId: 'dept-a', name: 'A 部门群', memberIds: ['u-a'], level: 'department' },
        { departmentId: 'dept-b', name: 'B 部门群', memberIds: ['u-b'], level: 'department' },
      ],
      'org-admin',
      'default',
    );

    const adminMemberChannels = await listMyChannels('org-admin', 'default');
    const adminVisibleChannels = await listVisibleChannels('org-admin', 'default');
    const userAChannels = await listMyChannels('u-a', 'default');

    expect(adminMemberChannels.map((c) => c.name)).not.toContain('A');
    expect(adminVisibleChannels).toHaveLength(0);
    expect(userAChannels.map((c) => c.name)).toEqual(['A']);
  });
});

function reqWithRoles(roles: string[]) {
  const token = signAccessToken({
    sub: `user-${roles.join('-') || 'none'}`,
    email: 'user@tandem.local',
    roles,
    tenantId: 'default',
    mfa: true,
    sid: 'sid-test',
  });
  return new NextRequest(new Request('http://test.local/api/im/channels/seed-from-org', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${COOKIE_ACCESS}=${token}`,
    },
    body: JSON.stringify({
      specs: [
        {
          departmentId: 'dept-rd',
          name: '研发部 部门群',
          memberIds: ['u-rd'],
          level: 'department',
        },
      ],
    }),
  }));
}

describe('POST /api/im/channels/seed-from-org permissions', () => {
  it('允许有 organization.manage 权限的角色同步组织群', async () => {
    const { POST } = await import('@/app/api/im/channels/seed-from-org/route');

    const res = await POST(reqWithRoles(['steward']));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.created).toHaveLength(1);
    expect(json.created[0].name).toBe('研发部');
  });

  it('普通员工仍不能同步全组织群', async () => {
    const { POST } = await import('@/app/api/im/channels/seed-from-org/route');

    const res = await POST(reqWithRoles(['employee']));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: 'forbidden',
      requiresPermission: 'organization.manage',
    });
  });
});
