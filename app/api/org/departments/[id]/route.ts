/**
 * PATCH  /api/org/departments/[id]  — 更新部门
 * DELETE /api/org/departments/[id]  — 删除部门
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { deleteDeptTree, updateDept } from '@/lib/org/departments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'steward', 'champion', 'hr']);

function canManageOrg(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => ORG_ADMIN_ROLES.has(r));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManageOrg(auth.roles))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  try {
    const dept = await updateDept(params.id, auth.tenantId, {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.parentId !== undefined && { parentId: body.parentId || null }),
      ...(body.headId !== undefined && { headId: body.headId || null }),
      ...(body.description !== undefined && { description: body.description ?? '' }),
      ...(body.order !== undefined && { order: Number(body.order) || 0 }),
    });
    return NextResponse.json({ dept });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: message.includes('not found') ? 404 : 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManageOrg(auth.roles))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const deletedIds = await deleteDeptTree(params.id, auth.tenantId);
    const store = getStore();
    const users = await store.auth.users.list({ tenantId: auth.tenantId });
    await Promise.all(
      users
        .filter((u) => u.departmentId && deletedIds.includes(u.departmentId))
        .map((u) => store.auth.users.update(u.id, { departmentId: null })),
    );
    return NextResponse.json({ ok: true, deletedIds });
  } catch (err) {
    const message = (err as Error).message;
    return NextResponse.json({ error: message }, { status: message.includes('not found') ? 404 : 400 });
  }
}
