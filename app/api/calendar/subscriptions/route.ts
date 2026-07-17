import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { CalendarSubscriptionService } from '@/lib/services/calendar-subscription-service';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const subscriptions = await new CalendarSubscriptionService(createAppContext()).listForUser(auth.userId, auth.tenantId);
  return NextResponse.json({ subscriptions });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar/subscriptions' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const subscription = await new CalendarSubscriptionService(createAppContext()).subscribe(
    auth.userId,
    body.targetUserId,
    auth.tenantId,
    body.requestDetails === true,
  );
  return NextResponse.json({ subscription }, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/subscriptions' });

