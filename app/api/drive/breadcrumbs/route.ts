import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { resolveDriveActor } from '@/lib/drive/actor';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';

const ROOT = { id: 'root', name: '我的工作云盘' };

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId');
  if (!folderId || folderId === 'root') return NextResponse.json({ breadcrumbs: [ROOT] });

  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const chain = await svc.breadcrumbs(folderId, auth.tenantId, actor);
  return NextResponse.json({ breadcrumbs: [ROOT, ...chain] });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/drive/breadcrumbs' });
