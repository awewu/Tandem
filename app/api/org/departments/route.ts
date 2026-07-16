/**
 * GET  /api/org/departments       — 列出本租户所有部门
 * POST /api/org/departments       — 新建部门
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requirePermission } from '@/lib/auth/require-auth';
import { listDepts, createDept } from '@/lib/org/departments';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const depts = await listDepts(auth.tenantId);
  return NextResponse.json({ depts });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/org/departments' });

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = await requirePermission(auth, 'organization.manage');
  if (forbidden) return forbidden;
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

export const POST = withApiLog(POSTApiHandler, { route: '/api/org/departments' });
