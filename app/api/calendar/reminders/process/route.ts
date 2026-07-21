import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createCalendarService } from '@/lib/calendar/service-factory';

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const events = await createCalendarService().processDueReminders(auth.userId, auth.tenantId);
  return NextResponse.json({ processed: events.length, sent: events.length, failed: 0 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/reminders/process' });
