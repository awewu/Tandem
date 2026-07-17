import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { createCalendarService } from '@/lib/calendar/service-factory';
import { getStore } from '@/lib/storage/repository';

const POSTApiHandler = withErrorHandler(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json();
  const userIds: string[] = Array.isArray(body.userIds)
    ? body.userIds.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  const service = createCalendarService(auth.userId);
  const event = await service.getById(params.id);
  const users = await getStore().auth.users.list({ tenantId: auth.tenantId });
  const usersById = new Map(users.filter((user) => !user.disabled).map((user) => [user.id, user]));
  const invited = Array.from(new Set<string>(userIds)).filter((userId) => usersById.has(userId));
  const attendeeEmails = Array.from(new Set([
    ...(event?.attendeeEmails ?? []),
    ...(event?.attendees ?? []).map((userId) => usersById.get(userId)?.email).filter((email): email is string => !!email),
    ...invited.map((userId) => usersById.get(userId)!.email),
  ]));
  const [updated] = await service.updateManaged(params.id, auth.userId, 'single', {
    ownerEmail: auth.email,
    attendeeEmails,
  });
  return NextResponse.json({ event: updated, invited, warnings: service.getDeliveryWarnings() });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/[id]/invite' });
