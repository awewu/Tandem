/**
 * GET  /api/org/departments       — 列出本租户所有部门
 * POST /api/org/departments       — 新建部门
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listDepts, createDept } from '@/lib/org/departments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const depts = await listDepts(auth.tenantId);
  return NextResponse.json({ depts });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles?.includes('admin') && !auth.roles?.includes('hr')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const dept = await createDept({
    name: body.name.trim(),
    parentId: body.parentId ?? null,
    headId: body.headId ?? null,
    description: body.description ?? '',
    order: typeof body.order === 'number' ? body.order : 0,
    tenantId: auth.tenantId,
  });
  return NextResponse.json({ dept }, { status: 201 });
}
