import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';

/**
 * PATCH /api/documents/[id]/permissions
 * Body: { read?: string[], write?: string[], publicAccess?: boolean }
 *
 * 鉴权: 必须登录; 跨租户视同不存在; 仅 owner / 有 write 权限者 / demo 可改 ACL.
 * 白名单: 仅接受 read/write/publicAccess, 防 body 注入其他文档字段.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await boot();
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const s = getStore();
    const documents = withTenantScope(s.documents, auth.tenantId);
    const doc = await documents.get(params.id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const canManage =
      auth.demo ||
      doc.ownerId === auth.userId ||
      (doc.permissions?.write ?? []).includes(auth.userId);
    if (!canManage) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

    const body = await req.json();
    const nextPerms: Record<string, unknown> = { ...doc.permissions };
    if (Array.isArray(body.read)) nextPerms.read = body.read;
    if (Array.isArray(body.write)) nextPerms.write = body.write;
    if (typeof body.publicAccess === 'boolean') nextPerms.publicAccess = body.publicAccess;

    const updated = await documents.update(params.id, {
      permissions: nextPerms as never,
    });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
