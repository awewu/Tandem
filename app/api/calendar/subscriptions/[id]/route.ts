import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { CalendarSubscriptionService } from '@/lib/services/calendar-subscription-service';
import { ValidationError } from '@/lib/domain/errors';

interface RouteContext {
  params: { id: string };
}

const PATCHApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const service = new CalendarSubscriptionService(createAppContext());
  if (body.action === 'cancel') {
    return NextResponse.json({ subscription: await service.cancel(params.id, auth.userId) });
  }
  if (!['approve', 'reject', 'revoke'].includes(body.action)) {
    throw new ValidationError('invalid subscription action');
  }
  const subscription = await service.respond(params.id, auth.userId, body.action);
  return NextResponse.json({ subscription });
});

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/calendar/subscriptions/[id]' });
