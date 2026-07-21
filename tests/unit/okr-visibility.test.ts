/**
 * OKR 读权限范围解析测试 (按部门模型, 2026-06-17)
 *
 * 覆盖 resolveOkrVisibleOwnerIds 的公开读策略:
 *   - 同租户 OKR 默认全员可见 → null (不按 owner 过滤)
 *   - 跨租户隔离由各 API 的 withTenantScope 负责
 */

import { describe, it, expect } from 'vitest';
import { resolveOkrVisibleOwnerIds } from '@/lib/okr/visibility';
import type { AuthContext } from '@/lib/auth/require-auth';

interface FakeUser {
  id: string;
  tenantId: string;
  departmentId?: string | null;
}

function makeStore(users: FakeUser[]) {
  return {
    auth: {
      users: {
        findById: async (id: string) => users.find((u) => u.id === id) ?? null,
        list: async (filter?: { tenantId?: string }) =>
          users.filter((u) => !filter?.tenantId || u.tenantId === filter.tenantId),
      },
    },
  } as never;
}

function auth(userId: string, roles: string[], demo = false): AuthContext {
  return { userId, email: `${userId}@t.local`, tenantId: 'default', roles, mfaVerified: true, demo };
}

const USERS: FakeUser[] = [
  { id: 'user_boss', tenantId: 'default', departmentId: '总经办' },
  { id: 'user_mgr_sales', tenantId: 'default', departmentId: '销售部' },
  { id: 'user_emp_sales1', tenantId: 'default', departmentId: '销售部' },
  { id: 'user_emp_sales2', tenantId: 'default', departmentId: '销售部' },
  { id: 'user_emp_rd', tenantId: 'default', departmentId: '研发部' },
  { id: 'user_mgr_nodept', tenantId: 'default', departmentId: null },
];

describe('resolveOkrVisibleOwnerIds · 全员公开读', () => {
  it('owner/admin → null (全部可见)', async () => {
    expect(await resolveOkrVisibleOwnerIds(auth('user_boss', ['owner', 'admin']), makeStore(USERS))).toBeNull();
    expect(await resolveOkrVisibleOwnerIds(auth('x', ['admin']), makeStore(USERS))).toBeNull();
  });

  it('demo 回退 → null', async () => {
    expect(await resolveOkrVisibleOwnerIds(auth('x', ['employee'], true), makeStore(USERS))).toBeNull();
  });

  it('普通员工 → null (同租户全员 OKR 可见)', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_emp_sales1', ['employee']), makeStore(USERS));
    expect(v).toBeNull();
  });

  it('champion/finance → null (同租户全员 OKR 可见)', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_emp_sales2', ['employee', 'champion']), makeStore(USERS));
    expect(v).toBeNull();
  });

  it('部门领导 (manager) → null (不再按部门限制)', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_mgr_sales', ['manager']), makeStore(USERS));
    expect(v).toBeNull();
  });

  it('steward → null (不再按部门限制)', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_mgr_sales', ['steward']), makeStore(USERS));
    expect(v).toBeNull();
  });

  it('部门领导但无部门归属 → null (同租户全员 OKR 可见)', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_mgr_nodept', ['manager']), makeStore(USERS));
    expect(v).toBeNull();
  });
});
