import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { requireAuth } from '@/lib/auth/require-auth';
import { resolveDriveActor } from '@/lib/drive/actor';
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

  if (body.mode === 'upload') {
    if (!body.fileName) {
      return NextResponse.json({ error: 'fileName required' }, { status: 400 });
    }
    const result = await svc.requestUpload({
      fileName: body.fileName,
      contentType: body.contentType,
      tenantId: auth.tenantId,
      parentId: body.parentId ?? null,
    }, actor);
    return NextResponse.json(result);
  }

  if (body.mode === 'download') {
    if (!body.fileId) {
      return NextResponse.json({ error: 'fileId required' }, { status: 400 });
    }
    const result = await svc.requestDownload(body.fileId, actor);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: 'mode must be upload | download' }, { status: 400 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/drive/presign' });
