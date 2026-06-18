/**
 * PATCH  /api/org/departments/[id]  — 更新部门
 * DELETE /api/org/departments/[id]  — 删除部门
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { updateDept, deleteDept } from '@/lib/org/departments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles?.includes('admin') && !auth.roles?.includes('hr'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const dept = await updateDept(params.id, {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.parentId !== undefined && { parentId: body.parentId }),
    ...(body.headId !== undefined && { headId: body.headId }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.order !== undefined && { order: body.order }),
  });
  return NextResponse.json({ dept });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles?.includes('admin') && !auth.roles?.includes('hr'))
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await deleteDept(params.id);
  return NextResponse.json({ ok: true });
}
