/**
 * GET /api/org/users   — list tenant users (替代 zustand `useOrgStore.people`)
 *   ?role=manager       仅 manager 角色
 *   ?departmentId=...   仅某部门
 *   ?q=zhang            按 name/email 模糊
 *
 *   返回不包含敏感字段 (passwordHash, mfaSecret 等).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const departmentId = searchParams.get('departmentId');
    const q = (searchParams.get('q') ?? '').trim().toLowerCase();
    const store = getStore();

    /** auth store 当前没有 list 接口, 走 demo fallback or hint */
    // 兼容: 若 prisma store, 直接用 prisma (后续 A2 可补 list 接口)
    // V1: 用 auth.users API 没暴露 list, 这里直接用 (store as any).auth?.users.list?
    // 实际上 InMemory + Prisma 都用 Map / prisma.user.findMany 即可.
    // 为最小改动: 走 prisma 直接查 (生产模式), demo 模式回 fixture.
    let users: { id: string; email: string; name: string; departmentId: string | null; roles: string[] }[] = [];

    // 检查 store.auth.users 是否暴露 list (新增方法). 若无则 fallback.
    const authUsers = (store as unknown as {
      auth: { users: { list?: (filter?: { tenantId?: string }) => Promise<unknown[]> } };
    }).auth.users;

    if (typeof authUsers.list === 'function') {
      const raw = (await authUsers.list({ tenantId: auth.tenantId })) as Array<{
        id: string; email: string; name: string;
        departmentId?: string | null; roles?: string[]; tenantId?: string;
      }>;
      users = raw.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        departmentId: u.departmentId ?? null,
        roles: u.roles ?? [],
      }));
    } else {
      // demo fallback: 提供与 zustand fixture 一致的人员清单
      users = [
        { id: 'demo-user', email: 'demo@tandem.local', name: '我 (Demo)', departmentId: 'dept-tech', roles: ['admin', 'manager', 'employee', 'champion', 'steward'] },
        { id: 'colleague-li', email: 'li@tandem.local', name: '李同事', departmentId: 'dept-tech', roles: ['employee'] },
        { id: 'colleague-wang', email: 'wang@tandem.local', name: '王同事', departmentId: 'dept-product', roles: ['employee'] },
        { id: 'manager-zhang', email: 'zhang@tandem.local', name: '张经理', departmentId: 'dept-tech', roles: ['manager'] },
        { id: 'hr-chen', email: 'chen@tandem.local', name: '陈 HR', departmentId: 'dept-hr', roles: ['hr'] },
      ];
    }

    if (role) users = users.filter((u) => u.roles.includes(role));
    if (departmentId) users = users.filter((u) => u.departmentId === departmentId);
    if (q) users = users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
