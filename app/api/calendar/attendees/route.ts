import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const query = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const limitParam = Number(req.nextUrl.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitParam) ? Math.min(500, Math.max(1, Math.floor(limitParam))) : 30;
  const matchedUsers = (await getStore().auth.users.list({ tenantId: auth.tenantId }))
    .filter((user) => !user.disabled && user.id !== auth.userId)
    .filter((user) => !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query));
  const users = matchedUsers
    .slice(0, limit)
    .map((user) => ({ id: user.id, name: user.name, email: user.email }));
  return NextResponse.json({ users, total: matchedUsers.length, limit });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar/attendees' });
