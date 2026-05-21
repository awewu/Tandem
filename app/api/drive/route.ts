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
  const files = await svc.list({ parentId: parentId ?? null, ownerId });
  // Tenant isolation: scope to caller's tenant.
  const scoped = files.filter((f) => (f.tenantId ?? 'default') === auth.tenantId);
  return NextResponse.json({ files: scoped });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new DriveService(ctx);
  const file = await svc.create({ ...body, tenantId: body.tenantId ?? auth.tenantId, ownerId: body.ownerId ?? auth.userId });
  return NextResponse.json(file, { status: 201 });
});
