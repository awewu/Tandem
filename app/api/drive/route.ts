import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';
import { resolveDriveActor } from '@/lib/drive/actor';
import { ensurePersonalHome } from '@/lib/drive/provision';
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
  // 首次访问懒建个人主目录 (幂等, fail-soft).
  try {
    await ensurePersonalHome({
      tenantId: auth.tenantId,
      userId: auth.userId,
      departmentId: actor.departmentId,
      repo: ctx.driveRepo,
    });
  } catch {/* fail-soft: 不阻塞列表 */}
  const files = await svc.list({ parentId: parentId ?? null, ownerId, tenantId: auth.tenantId }, actor);
  return NextResponse.json({ files });
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
  // P0-A: tenantId 一律取自鉴权上下文, 绝不接受 body 注入 (防跨租户写).
  const file = await svc.create({
    name: body.name,
    mimeType: body.mimeType,
    size: body.size,
    parentId: body.parentId ?? null,
    storageKey: body.storageKey,
    isFolder: body.isFolder,
    ownerId: auth.userId,
    tenantId: auth.tenantId,
  }, actor);
  return NextResponse.json(file, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/drive' });
