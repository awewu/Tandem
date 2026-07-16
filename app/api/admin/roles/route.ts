import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth, requirePermission } from '@/lib/auth/require-auth';
import { listRoleDefinitions } from '@/lib/auth/role-definitions';
import { isPermission, PERMISSION_LABELS, PERMISSIONS } from '@/lib/auth/permissions';
import { db } from '@/lib/infra/drizzle-client';
import { roleDefinition } from '@/lib/infra/drizzle-schema';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const roleForbidden = await requirePermission(auth, 'roles.manage');
  const userForbidden = await requirePermission(auth, 'users.manage');
  if (roleForbidden && userForbidden) return roleForbidden;
  const roles = await listRoleDefinitions(auth.tenantId, true);
  return NextResponse.json({ roles, permissionCatalog: PERMISSIONS.map((key) => ({ key, ...PERMISSION_LABELS[key] })) });
}

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = await requirePermission(auth, 'roles.manage');
  if (forbidden) return forbidden;
  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === 'string' ? body.key.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const permissions: string[] = Array.isArray(body.permissions)
    ? Array.from(new Set(body.permissions.filter((value: unknown): value is string => typeof value === 'string' && isPermission(value))))
    : [];
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) {
    return NextResponse.json({ error: '角色编码仅支持 2-40 位小写字母、数字和下划线' }, { status: 400 });
  }
  if (!name || name.length > 40) return NextResponse.json({ error: '角色名称必填且不能超过 40 字' }, { status: 400 });
  const kind = 'internal';
  try {
    const [role] = await db.insert(roleDefinition).values({
      key,
      name,
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 200) : '',
      kind,
      permissions,
      system: false,
      enabled: body.enabled !== false,
      sortOrder: Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 500,
      tenantId: auth.tenantId,
    }).returning();
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: '角色编码已存在' }, { status: 409 });
    throw error;
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/admin/roles' });
export const POST = withApiLog(POSTApiHandler, { route: '/api/admin/roles' });
