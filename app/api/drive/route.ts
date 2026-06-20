import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DriveService } from '@/lib/services/drive-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId');
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  // Tenant isolation: tenantId 下推到 repo (drizzle SQL eq(tenantId)), 不再逐路由手写过滤.
  const files = await svc.list({ parentId: parentId ?? null, ownerId, tenantId: auth.tenantId });
  return NextResponse.json({ files });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  // P0-A: tenantId 一律取自鉴权上下文, 绝不接受 body 注入 (防跨租户写).
  const file = await svc.create({ ...body, tenantId: auth.tenantId, ownerId: body.ownerId ?? auth.userId });
  return NextResponse.json(file, { status: 201 });
});
