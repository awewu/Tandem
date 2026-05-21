import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DocumentService } from '@/lib/services/document-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const ctx = createAppContext();
  const svc = new DocumentService(ctx);
  const docs = await svc.list({ ownerId });
  // Tenant isolation: only return rows belonging to caller's tenant.
  const scoped = docs.filter((d) => (d.tenantId ?? 'default') === auth.tenantId);
  return NextResponse.json({ documents: scoped });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new DocumentService(ctx);
  const doc = await svc.create({ ...body, tenantId: body.tenantId ?? auth.tenantId, ownerId: body.ownerId ?? auth.userId });
  return NextResponse.json(doc, { status: 201 });
});
