import { and, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth, requirePermission } from '@/lib/auth/require-auth';
import { isPermission } from '@/lib/auth/permissions';
import { DEFAULT_ROLE_KEYS } from '@/lib/auth/role-definitions';
import { db } from '@/lib/infra/drizzle-client';
import { roleDefinition } from '@/lib/infra/drizzle-schema';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return { error: auth } as const;
  const forbidden = await requirePermission(auth, 'roles.manage');
  if (forbidden) return { error: forbidden } as const;
  return { auth } as const;
}

async function PATCHApiHandler(req: NextRequest, { params }: { params: { key: string } }) {
  const result = await authorize(req);
  if ('error' in result && result.error) return result.error;
  const where = and(eq(roleDefinition.tenantId, result.auth.tenantId), eq(roleDefinition.key, params.key));
  const [existing] = await db.select().from(roleDefinition).where(where).limit(1);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const patch: Partial<typeof roleDefinition.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 40);
  if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 200);
  if (!existing.system) patch.kind = 'internal';
  if (Array.isArray(body.permissions)) {
    patch.permissions = Array.from(new Set<string>(body.permissions.filter((value: unknown): value is string => typeof value === 'string' && isPermission(value))));
  }
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
  if (existing.key === 'owner') {
    patch.enabled = true;
    patch.kind = 'internal';
  }
  const [role] = await db.update(roleDefinition).set(patch).where(where).returning();
  return NextResponse.json({ role });
}

async function DELETEApiHandler(req: NextRequest, { params }: { params: { key: string } }) {
  const result = await authorize(req);
  if ('error' in result && result.error) return result.error;
  const where = and(eq(roleDefinition.tenantId, result.auth.tenantId), eq(roleDefinition.key, params.key));
  const [existing] = await db.select().from(roleDefinition).where(where).limit(1);
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (existing.system || DEFAULT_ROLE_KEYS.has(existing.key)) return NextResponse.json({ error: '系统角色不能删除，可以调整权限或停用' }, { status: 409 });
  const users = await getStore().auth.users.list({ tenantId: result.auth.tenantId });
  const assigned = users.filter((user) => (user.roles ?? []).includes(params.key)).length;
  if (assigned > 0) return NextResponse.json({ error: `仍有 ${assigned} 位用户使用此角色，请先调整人员角色` }, { status: 409 });
  await db.delete(roleDefinition).where(where);
  return NextResponse.json({ ok: true });
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/admin/roles/[key]' });
export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/admin/roles/[key]' });
