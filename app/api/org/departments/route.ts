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

const ORG_ADMIN_ROLES = new Set(['owner', 'admin', 'steward', 'champion', 'hr']);

function canManageOrg(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => ORG_ADMIN_ROLES.has(r));
}

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
  if (!canManageOrg(auth.roles)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
  try {
    const dept = await createDept({
      name: body.name.trim(),
      parentId: body.parentId ?? null,
      headId: body.headId ?? null,
      description: body.description ?? '',
      order: typeof body.order === 'number' ? body.order : 0,
      tenantId: auth.tenantId,
    });
    return NextResponse.json({ dept }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
