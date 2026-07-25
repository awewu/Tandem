import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { resolveDriveActor } from '@/lib/drive/actor';
import { ensureDriveOrgScope, isInDriveOrgScope } from '@/lib/drive/org-scope';
import { isLocalDriveStorageKey, localDriveObjectPath } from '@/lib/drive/local-storage';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const runtime = 'nodejs';

interface Params {
  params: { id: string };
}

function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

const GETApiHandler = withErrorHandler(async (req: NextRequest, { params }: Params) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });
  const all = await ctx.driveRepo.list({ tenantId: auth.tenantId });
  if (!isInDriveOrgScope(all, params.id, scope)) {
    return NextResponse.json({ error: 'file is outside current department scope', scope }, { status: 403 });
  }

  const file = await svc.getById(params.id, actor);
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (file.isFolder) return NextResponse.json({ error: 'folders cannot be downloaded' }, { status: 400 });
  if (!isLocalDriveStorageKey(file.storageKey)) {
    return NextResponse.json({ error: 'file is not stored locally' }, { status: 409 });
  }

  const filePath = localDriveObjectPath(file.storageKey);
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Length': String(fileStat.size),
      'Content-Disposition': contentDisposition(file.name),
      'Cache-Control': 'no-store',
    },
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/drive/[id]/download' });
