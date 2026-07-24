import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { resolveDriveActor } from '@/lib/drive/actor';
import { ensureDriveOrgScope, scopeBreadcrumbs } from '@/lib/drive/org-scope';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';

const ROOT = { id: 'root', name: '我的工作云盘' };

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get('folderId');
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const actor = await resolveDriveActor(auth);
  const scope = await ensureDriveOrgScope({ tenantId: auth.tenantId, userId: auth.userId, actor, repo: ctx.driveRepo });
  if (!scope.rootFolderId) return NextResponse.json({ breadcrumbs: [ROOT], scope });

  const targetId = !folderId || folderId === 'root' ? scope.rootFolderId : folderId;
  const chain = await svc.breadcrumbs(targetId, auth.tenantId, actor);
  const scoped = scopeBreadcrumbs(chain, scope);
  return NextResponse.json({ breadcrumbs: [ROOT, ...scoped], scope });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/drive/breadcrumbs' });
