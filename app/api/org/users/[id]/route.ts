/**
 * PATCH /api/org/users/[id] — 修改员工部门、职务、汇报关系等 HR 字段
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = ['departmentId','jobTitle','managerId','employeeId','hireDate','workLocation','phone','name','roles','disabled'] as const;
type PatchKey = typeof ALLOWED[number];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles?.includes('admin') && !auth.roles?.includes('hr'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const patch: Partial<Record<PatchKey, unknown>> = {};
  for (const k of ALLOWED) {
    if (k in body) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: 'no fields to update' }, { status: 400 });

  const store = getStore();
  // 租户隔离: store.auth.users 是 auth 子存储 (findById/update), 非 TandemStore Repository<T>,
  // withTenantScope 不适用; 保留显式 tenantId 校验。
  const existing = await store.auth.users.findById(params.id);
  if (!existing || existing.tenantId !== auth.tenantId)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  await store.auth.users.update(params.id, patch as Parameters<typeof store.auth.users.update>[1]);

  // 禁用账号时撤销其全部会话 → 现有各端立即登出 (与前端提示一致).
  if (patch.disabled === true) {
    await store.auth.sessions.revokeAllForUser(params.id, 'admin_disabled');
  }

  const updated = await store.auth.users.findById(params.id);
  return NextResponse.json({ user: updated });
}
