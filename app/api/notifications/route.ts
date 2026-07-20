import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { NotificationService } from '@/lib/services/notification-service';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { ReminderEngine } from '@/lib/services/reminder-engine';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const { searchParams } = new URL(req.url);
  const userId = auth.userId;
  const unreadOnly = searchParams.get('unread') === 'true';
  const ctx = createAppContext();
  const svc = new NotificationService(ctx);
  await new ReminderEngine(ctx).processDue({ userId: auth.userId, tenantId: auth.tenantId });
  // Tenant isolation: scope reads to caller's tenant.
  const notifs = await svc.list(userId, { unreadOnly, tenantId: auth.tenantId });
  const unreadCount = await svc.countUnread(userId);
  return NextResponse.json({ notifications: notifs, unreadCount });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/notifications' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const ctx = createAppContext();
  const svc = new NotificationService(ctx);
  // P0-A: tenantId 一律取自鉴权上下文, 绝不接受 body 注入 (防跨租户写).
  const n = await svc.create({
    userId: body.userId,
    type: body.type,
    title: body.title,
    body: body.body,
    data: body.data,
    priority: body.priority,
    channel: body.channel,
    sourceId: body.sourceId,
    sourceType: body.sourceType,
    tenantId: auth.tenantId,
  });
  return NextResponse.json(n, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/notifications' });
