import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { resolveDriveActor } from '@/lib/drive/actor';
import { ensureDriveOrgScope, isInDriveOrgScope } from '@/lib/drive/org-scope';
import { withApiLog } from '@/lib/api-log/with-api-log';
import type { DriveAclUser } from '@/lib/drive/acl';
import type { DriveFile } from '@/lib/types/feishu-catchup';

interface DriveRequestContext {
  svc: DriveService;
  actor: DriveAclUser;
  scope: Awaited<ReturnType<typeof ensureDriveOrgScope>>;
  all: DriveFile[];
}

async function resolveRequestScope(req: NextRequest): Promise<NextResponse | DriveRequestContext> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });
  const all = await ctx.driveRepo.list({ tenantId: auth.tenantId });
  return { svc, actor, scope, all };
}

const PATCHApiHandler = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const resolved = await resolveRequestScope(req);
  if (resolved instanceof NextResponse) return resolved;
  const { svc, actor, scope, all } = resolved;
  if (!isInDriveOrgScope(all, params.id, scope)) {
    return NextResponse.json({ error: 'file is outside current department scope', scope }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.name === 'string') {
    const file = await svc.rename(params.id, body.name, actor);
    return NextResponse.json(file);
  }
  if ('parentId' in body) {
    const parentId = body.parentId ?? scope.rootFolderId;
    if (!parentId || !isInDriveOrgScope(all, parentId, scope)) {
      return NextResponse.json({ error: 'target folder is outside current department scope', scope }, { status: 403 });
    }
    const file = await svc.move(params.id, parentId, actor);
    return NextResponse.json(file);
  }
  if ('permissions' in body) {
    const file = await svc.updatePermissions(params.id, body.permissions, actor);
    return NextResponse.json(file);
  }

  return NextResponse.json({ error: 'name, parentId or permissions required' }, { status: 400 });
});

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/drive/[id]' });

const DELETEApiHandler = withErrorHandler(async (
  req: NextRequest,
  { params }: { params: { id: string } },
) => {
  const resolved = await resolveRequestScope(req);
  if (resolved instanceof NextResponse) return resolved;
  const { svc, actor, scope, all } = resolved;
  if (!isInDriveOrgScope(all, params.id, scope)) {
    return NextResponse.json({ error: 'file is outside current department scope', scope }, { status: 403 });
  }

  await svc.delete(params.id, actor);
  return NextResponse.json({ ok: true });
});

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/drive/[id]' });
