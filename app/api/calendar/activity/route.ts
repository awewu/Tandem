import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import { listCalendarActivities } from '@/lib/calendar/activity-log';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
  const result = await listCalendarActivities({
    tenantId: auth.tenantId,
    viewerId: auth.userId,
    viewerEmail: auth.email,
    page,
    pageSize,
  });
  const users = await getStore().auth.users.list({ tenantId: auth.tenantId });
  const usersById = new Map(users.map((user) => [user.id, user]));
  const usersByEmail = new Map(users.map((user) => [user.email.trim().toLowerCase(), user]));
  const items = result.items.map((item) => {
    const actor = usersById.get(item.actorId) ?? (item.actorEmail ? usersByEmail.get(item.actorEmail.trim().toLowerCase()) : undefined);
    return {
      ...item,
      actorName: item.actorName ?? actor?.name,
      actorEmail: item.actorEmail ?? actor?.email,
      attendeeUsers: Array.from(new Set((item.attendeeEmails ?? []).map((email) => email.trim().toLowerCase()).filter(Boolean)))
        .map((email) => usersByEmail.get(email))
        .filter((user) => user !== undefined),
    };
  });
  return NextResponse.json({ ...result, items });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar/activity' });
