import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { NotificationService } from '@/lib/services/notification-service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') ?? auth.userId;
  const unreadOnly = searchParams.get('unread') === 'true';
  const ctx = createAppContext();
  const svc = new NotificationService(ctx);
  // Tenant isolation: scope reads to caller's tenant.
  const notifs = await svc.list(userId, { unreadOnly, tenantId: auth.tenantId });
  const unreadCount = await svc.countUnread(userId);
  return NextResponse.json({ notifications: notifs, unreadCount });
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new NotificationService(ctx);
  const n = await svc.create({ ...body, tenantId: body.tenantId ?? auth.tenantId });
  return NextResponse.json(n, { status: 201 });
});
