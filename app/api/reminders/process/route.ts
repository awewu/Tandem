import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { ReminderEngine } from '@/lib/services/reminder-engine';

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const result = await new ReminderEngine(createAppContext()).processDue({
    tenantId: auth.tenantId,
    userId: auth.userId,
  });
  return NextResponse.json({
    processed: result.processed,
    sent: result.sent,
    failed: result.failed,
    delivered: result.delivered.map((item) => ({
      notificationId: item.notificationId,
      title: item.task.title,
      body: item.task.body,
      url: item.task.url,
      sourceType: item.task.sourceType,
      sourceId: item.task.sourceId,
    })),
  });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/reminders/process' });
