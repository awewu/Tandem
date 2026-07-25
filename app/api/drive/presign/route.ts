import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { requireAuth } from '@/lib/auth/require-auth';
import { resolveDriveActor } from '@/lib/drive/actor';
import { ensureDriveOrgScope, isInDriveOrgScope } from '@/lib/drive/org-scope';
import { isLocalDriveStorageKey } from '@/lib/drive/local-storage';
import { withApiLog } from '@/lib/api-log/with-api-log';

/**
 * POST /api/drive/presign
 * Body: { mode: 'upload', fileName, contentType }
 *      | { mode: 'download', fileId }
 *
 * §T6 客户端不直传后端, 走 S3/MinIO 预签名 URL.
 * 上传成功后客户端再 POST /api/drive 提交文件元数据.
 */
const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    mode?: 'upload' | 'download';
    fileName?: string;
    contentType?: string;
    fileId?: string;
    parentId?: string | null;
  };

  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });

  if (body.mode === 'upload') {
    if (!body.fileName) {
      return NextResponse.json({ error: 'fileName required' }, { status: 400 });
    }
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
    const result = await svc.requestUpload({
      fileName: body.fileName,
      contentType: body.contentType,
      tenantId: auth.tenantId,
      parentId,
    }, actor);
    return NextResponse.json(result);
  }

  if (body.mode === 'download') {
    if (!body.fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }
    const all = await ctx.driveRepo.list({ tenantId: auth.tenantId });
    if (!isInDriveOrgScope(all, body.fileId, scope)) {
      return NextResponse.json({ error: 'file is outside current department scope', scope }, { status: 403 });
    }
    const file = await svc.getById(body.fileId, actor);
    if (file?.storageKey && isLocalDriveStorageKey(file.storageKey)) {
      return NextResponse.json({ url: `/api/drive/${encodeURIComponent(file.id)}/download`, expiresInSec: 900 });
    }
    const result = await svc.requestDownload(body.fileId, actor);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'mode must be upload | download' }, { status: 400 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/drive/presign' });
