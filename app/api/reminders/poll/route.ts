import { NextResponse, type NextRequest } from 'next/server';
import { bootHotPath } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { ReminderEngine } from '@/lib/services/reminder-engine';
import { NotificationService } from '@/lib/services/notification-service';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  bootHotPath();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const sinceParam = req.nextUrl.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : null;
  const ctx = createAppContext();
  const result = await new ReminderEngine(ctx).processDue({
    tenantId: auth.tenantId,
    userId: auth.userId,
  });
  const notificationService = new NotificationService(ctx);
  const unreadCount = await notificationService.countUnread(auth.userId);
  const recentReminderNotifications = await notificationService.list(auth.userId, {
    tenantId: auth.tenantId,
    limit: 50,
  });
  const deliveredFromNotifications = recentReminderNotifications
    .filter((item) => (
      item.type === 'reminder' &&
      !item.readAt &&
      !item.dismissedAt &&
      (!since || (Number.isNaN(since.getTime()) ? true : new Date(item.createdAt) >= since))
    ))
    .map((item) => ({
      notificationId: item.id,
      title: item.title,
      body: item.body,
      url: typeof item.data?.url === 'string' ? item.data.url : null,
      sourceType: item.sourceType ?? undefined,
      sourceId: item.sourceId ?? undefined,
    }));
  const deliveredIds = new Set(deliveredFromNotifications.map((item) => item.notificationId));
  return NextResponse.json({
    unreadCount,
    delivered: [
      ...deliveredFromNotifications,
      ...result.delivered
        .filter((item) => item.notificationId && !deliveredIds.has(item.notificationId))
        .map((item) => ({
          notificationId: item.notificationId,
          title: item.task.title,
          body: item.task.body,
          url: item.task.url,
          sourceType: item.task.sourceType,
          sourceId: item.task.sourceId,
        })),
    ],
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/reminders/poll' });
