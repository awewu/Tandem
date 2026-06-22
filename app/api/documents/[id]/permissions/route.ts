import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { docAccess } from '@/lib/documents/access';

/**
 * PATCH /api/documents/[id]/permissions
 * Body: { read?: string[], write?: string[], publicAccess?: boolean, isLocked?: boolean }
 *
 * 鉴权: 必须登录; 跨租户视同不存在; 仅 owner / 有 write 权限者 / demo 可改 ACL / 锁.
 * 白名单: 仅接受 read/write/publicAccess/isLocked, 防 body 注入其他文档字段.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await boot();
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const { documentRepo } = createAppContext();
    const doc = await documentRepo.findById(params.id);
    if (!doc || doc.deletedAt || doc.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!docAccess(auth, doc).canManage) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const body = await req.json();
    let updated = doc;

    const wantsPerms =
      Array.isArray(body.read) || Array.isArray(body.write) || typeof body.publicAccess === 'boolean';
    if (wantsPerms) {
      const nextPerms: Record<string, unknown> = { ...doc.permissions };
      if (Array.isArray(body.read)) nextPerms.read = body.read;
      if (Array.isArray(body.write)) nextPerms.write = body.write;
      if (typeof body.publicAccess === 'boolean') nextPerms.publicAccess = body.publicAccess;
      updated = await documentRepo.updatePermissions(params.id, nextPerms as never);
    }

    if (typeof body.isLocked === 'boolean') {
      updated = body.isLocked
        ? await documentRepo.lock(params.id)
        : await documentRepo.unlock(params.id);
    }

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
