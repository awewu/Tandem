import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { resolveDriveActor } from '@/lib/drive/actor';
import { ensureDriveOrgScope, isInDriveOrgScope } from '@/lib/drive/org-scope';
import { withApiLog } from '@/lib/api-log/with-api-log';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });
  const effectiveParentId = parentId ?? scope.rootFolderId;
  if (!effectiveParentId) return NextResponse.json({ files: [], scope });
  const all = await ctx.driveRepo.list({ tenantId: auth.tenantId });
  if (parentId) {
    if (!isInDriveOrgScope(all, parentId, scope)) {
      return NextResponse.json({ error: 'folder is outside current department scope', scope }, { status: 403 });
    }
  }
  const files = await svc.list({ parentId: effectiveParentId, ownerId, tenantId: auth.tenantId }, actor);
  const childCountByParent = new Map<string, number>();
  for (const item of all) {
    if (item.deletedAt || !item.parentId) continue;
    childCountByParent.set(item.parentId, (childCountByParent.get(item.parentId) ?? 0) + 1);
  }
  const filesWithDeleteState = files.map((file) => {
    const childCount = file.isFolder ? childCountByParent.get(file.id) ?? 0 : 0;
    const hasDeleteRole = (actor.roles ?? []).some((role) => role === 'admin' || role === 'owner') || file.ownerId === actor.id;
    const canDelete = hasDeleteRole && (!file.isFolder || childCount === 0);
    const deleteDisabledReason = canDelete
      ? null
      : !hasDeleteRole
      ? '仅管理员或创建者可删除'
      : '文件夹不为空，不能删除';
    return { ...file, childCount, canDelete, deleteDisabledReason };
  });
  return NextResponse.json({ files: filesWithDeleteState, scope });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/drive' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });
  const parentId = body.parentId ?? scope.rootFolderId;
  if (!parentId) {
    return NextResponse.json({ error: 'current user has no department drive scope', scope }, { status: 409 });
  }
  if (body.parentId) {
    const all = await ctx.driveRepo.list({ tenantId: auth.tenantId });
    if (!isInDriveOrgScope(all, body.parentId, scope)) {
      return NextResponse.json({ error: 'folder is outside current department scope', scope }, { status: 403 });
    }
  }
  // P0-A: tenantId 一律取自鉴权上下文, 绝不接受 body 注入 (防跨租户写).
  const file = await svc.create({
    name: body.name,
    mimeType: body.mimeType,
    size: body.size,
    parentId,
    storageKey: body.storageKey,
    isFolder: body.isFolder,
    ownerId: auth.userId,
    tenantId: auth.tenantId,
  }, actor);
  return NextResponse.json(file, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/drive' });
