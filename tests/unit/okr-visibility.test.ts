/**
 * OKR 读权限范围解析测试 (按部门模型, 2026-06-17)
 *
 * 覆盖 resolveOkrVisibleOwnerIds 的三档:
 *   - 老板 (owner/admin)      → null (全部可见)
 *   - 部门领导 (manager/steward) → 本部门全体成员 ownerId
 *   - 普通员工                 → 仅自己
 *   - demo 回退                → null
 *   - 部门领导但无部门归属     → 退化为仅自己 (防越权)
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

describe('resolveOkrVisibleOwnerIds · 按部门', () => {
  it('owner/admin → null (全部可见)', async () => {
    expect(await resolveOkrVisibleOwnerIds(auth('user_boss', ['owner', 'admin']), makeStore(USERS))).toBeNull();
    expect(await resolveOkrVisibleOwnerIds(auth('x', ['admin']), makeStore(USERS))).toBeNull();
  });

  it('demo 回退 → null', async () => {
    expect(await resolveOkrVisibleOwnerIds(auth('x', ['employee'], true), makeStore(USERS))).toBeNull();
  });

  it('普通员工 → 仅自己', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_emp_sales1', ['employee']), makeStore(USERS));
    expect(v).not.toBeNull();
    expect(Array.from(v!)).toEqual(['user_emp_sales1']);
  });

  it('champion/finance (非领导) → 仅自己', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_emp_sales2', ['employee', 'champion']), makeStore(USERS));
    expect(Array.from(v!)).toEqual(['user_emp_sales2']);
  });

  it('部门领导 (manager) → 本部门全体成员', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_mgr_sales', ['manager']), makeStore(USERS));
    expect(v).not.toBeNull();
    const ids = Array.from(v!).sort();
    expect(ids).toEqual(['user_emp_sales1', 'user_emp_sales2', 'user_mgr_sales'].sort());
    // 不应看到其他部门
    expect(v!.has('user_emp_rd')).toBe(false);
  });

  it('steward 同样按部门', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_mgr_sales', ['steward']), makeStore(USERS));
    expect(v!.has('user_emp_sales1')).toBe(true);
    expect(v!.has('user_emp_rd')).toBe(false);
  });

  it('部门领导但无部门归属 → 退化为仅自己', async () => {
    const v = await resolveOkrVisibleOwnerIds(auth('user_mgr_nodept', ['manager']), makeStore(USERS));
    expect(Array.from(v!)).toEqual(['user_mgr_nodept']);
  });
});
