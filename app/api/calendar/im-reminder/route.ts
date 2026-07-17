import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { CalendarImReminderService } from '@/lib/services/calendar-im-reminder-service';
import { ValidationError } from '@/lib/domain/errors';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const service = new CalendarImReminderService(createAppContext());
  const events = await service.listCandidates(auth.userId, auth.tenantId);
  const users = await getUsersById(auth.tenantId);

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      location: event.location,
      meetingUrl: event.meetingUrl,
      status: event.status,
      ownerId: event.ownerId,
      organizer: users.get(event.ownerId),
      hasConflict: events.some((other) => (
        other.id !== event.id &&
        new Date(event.startAt) < new Date(other.endAt) &&
        new Date(event.endAt) > new Date(other.startAt)
      )),
      attendeeUsers: event.attendees
        .map((userId) => users.get(userId))
        .filter((user) => user !== undefined),
    })),
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar/im-reminder' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
  if (!eventId) throw new ValidationError('eventId is required');

  const service = new CalendarImReminderService(createAppContext());
  const result = await service.remind(eventId, auth.userId, auth.tenantId);

  return NextResponse.json({
    event: {
      id: result.event.id,
      title: result.event.title,
      startAt: result.event.startAt,
      endAt: result.event.endAt,
    },
    channel: result.channel,
    message: result.message,
    reused: result.reused,
  });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/im-reminder' });

async function getUsersById(tenantId: string) {
  const { getStore } = await import('@/lib/storage/repository');
  const users = await getStore().auth.users.list({ tenantId });
  return new Map(users.map((user) => [user.id, { id: user.id, name: user.name, email: user.email }]));
}
