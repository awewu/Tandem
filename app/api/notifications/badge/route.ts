import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import type { NextRequest } from 'next/server';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { NotificationService } from '@/lib/services/notification-service';
import { cacheGetOrLoad } from '@/lib/infra/cache';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { requireAuth } from '@/lib/auth/require-auth';
import { ReminderEngine } from '@/lib/services/reminder-engine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/badge
 *
 * §T6 缓存策略: 30s TTL (Redis-first, InMemory fallback)
 * 失效路径: NotificationService.create / markRead / markDismissed 调用 cacheDel(`badge:${userId}`)
 */
const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const ctx = createAppContext();
  await new ReminderEngine(ctx).processDue({ userId, tenantId: auth.tenantId });
  const count = await cacheGetOrLoad(`badge:${userId}`, 30, async () => {
    const svc = new NotificationService(ctx);
    return svc.countUnread(userId, { tenantId: auth.tenantId });
  });
  return NextResponse.json({ unreadCount: count });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/notifications/badge' });
