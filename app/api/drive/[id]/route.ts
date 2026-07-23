/**
 * /api/drive/[id]
 *
 * DELETE : 软删节点 (owner 或有写权; 文件夹递归由 repo 处理)。
 * PATCH  : 按 body 分派 —— { name } 改名 / { parentId } 移动 / { permissions } 共享(改 ACL)。
 *
 * 全部经 DriveService 的 ACL 鉴权 (canWrite / owner / admin)。
 */
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { resolveDriveActor } from '@/lib/drive/actor';
import { withApiLog } from '@/lib/api-log/with-api-log';

const DELETEApiHandler = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    await boot();
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const ctx = createAppContext();
    const svc = new DriveService(ctx);
    const actor = await resolveDriveActor(auth);
    await svc.delete(params.id, actor);
    return NextResponse.json({ ok: true });
  },
);

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/drive/[id]' });

const PATCHApiHandler = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    await boot();
    const auth = requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      parentId?: string | null;
      permissions?: { read?: string[]; write?: string[] };
    };
    const ctx = createAppContext();
    const svc = new DriveService(ctx);
    const actor = await resolveDriveActor(auth);

    if (body.permissions !== undefined) {
      const updated = await svc.updatePermissions(params.id, body.permissions, actor);
      return NextResponse.json(updated);
    }
    if (body.parentId !== undefined) {
      const updated = await svc.move(params.id, body.parentId ?? null, actor);
      return NextResponse.json(updated);
    }
    if (typeof body.name === 'string') {
      const updated = await svc.rename(params.id, body.name, actor);
      return NextResponse.json(updated);
    }
    return NextResponse.json(
      { error: 'body must contain one of: name | parentId | permissions' },
      { status: 400 },
    );
  },
);

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/drive/[id]' });
