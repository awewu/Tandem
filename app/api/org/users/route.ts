/**
 * GET /api/org/users   — list tenant users (替代 zustand `useOrgStore.people`)
 *   ?role=manager       仅 manager 角色
 *   ?departmentId=...   仅某部门
 *   ?q=zhang            按 name/email 模糊
 *
 *   返回不包含敏感字段 (passwordHash, mfaSecret 等).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { redactAuthUser, type RedactableUser } from '@/lib/privacy/redactors-domain';
import { resolveScope } from '@/lib/privacy/redactor';
import { listDepts } from '@/lib/org/departments';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const departmentId = searchParams.get('departmentId');
    const q = (searchParams.get('q') ?? '').trim().toLowerCase();
    const store = getStore();

    // P1-2 (2026-05-22): auth.users.list 已实装 (memory-store + drizzle-store).
    // 不再 demo fallback, 直接走 store. 空表时返回空数组而不是 fixture.
    const raw = await store.auth.users.list({ tenantId: auth.tenantId });
    const depts = await listDepts(auth.tenantId);
    const deptById = new Map(depts.map((d) => [d.id, d]));
    let users = raw.map((u) => {
      const departmentId = u.departmentId ?? null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        departmentId,
        departmentName: departmentId ? (deptById.get(departmentId)?.name ?? departmentId) : null,
        jobTitle: u.jobTitle ?? null,
        managerId: u.managerId ?? null,
        employeeId: u.employeeId ?? null,
        hireDate: u.hireDate ?? null,
        workLocation: u.workLocation ?? null,
        phone: u.phone ?? null,
        roles: u.roles ?? [],
        disabled: u.disabled ?? false,
      };
    });

    if (role) users = users.filter((u) => u.roles.includes(role));
    if (departmentId) users = users.filter((u) => u.departmentId === departmentId);
    if (q) users = users.filter((u) => (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.jobTitle ?? '').toLowerCase().includes(q) ||
      (u.employeeId ?? '').toLowerCase().includes(q) ||
      (u.departmentName ?? '').toLowerCase().includes(q)
    ));

    // EVO-7: 按视角抹白. 同事看不到 email/IP/锁定状态; 本人 + admin 看全.
    const ctx = {
      viewerId: auth.userId,
      viewerRoles: auth.roles,
      viewerTenantId: auth.tenantId,
      ownerTenantId: auth.tenantId,
      demo: auth.demo,
    };
    const redactedUsers = users.map((u) => {
      const scope = resolveScope(ctx, [u.id]);
      return redactAuthUser(u as RedactableUser, scope, ctx);
    });

    return NextResponse.json({ users: redactedUsers });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/org/users' });
