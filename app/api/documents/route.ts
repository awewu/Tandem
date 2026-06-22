import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { DocumentService } from '@/lib/services/document-service';
import { docAccess } from '@/lib/documents/access';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const ownerId = searchParams.get('ownerId') ?? undefined;
  const q = (searchParams.get('q') ?? '').trim().toLowerCase();
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 200);
  const ctx = createAppContext();
  const svc = new DocumentService(ctx);
  // Tenant isolation: tenantId 下推到 repo (drizzle SQL eq(tenantId)), 不再逐路由手写过滤.
  let scoped = await svc.list({ ownerId, tenantId: auth.tenantId });
  // D-01: optional ?q= title contains (case-insensitive) for @ mention picker
  if (q) {
    scoped = scoped.filter((d) => (d.title ?? '').toLowerCase().includes(q));
  }
  scoped = scoped.slice(0, limit);
  const documents = scoped.map((d) => ({ ...d, ...docAccess(auth, d) }));
  return NextResponse.json({ documents });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new DocumentService(ctx);
  // P0-A: tenantId 一律取自鉴权上下文, 绝不接受 body 注入 (防跨租户写).
  const doc = await svc.create({ ...body, tenantId: auth.tenantId, ownerId: body.ownerId ?? auth.userId });
  return NextResponse.json(doc, { status: 201 });
});
