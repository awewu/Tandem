import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { withApiLog } from '@/lib/api-log/with-api-log';
import type { ReportViewPreference } from '@/lib/types/report-view-preference';

function preferenceId(tenantId: string, userId: string): string {
  return `${tenantId}:${userId}`;
}

async function getPreference(tenantId: string, userId: string): Promise<ReportViewPreference | null> {
  const store = getStore();
  const existing = await store.reportViewPreferences.get(preferenceId(tenantId, userId));
  if (existing && existing.tenantId === tenantId && existing.userId === userId) return existing;
  return null;
}

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const tenantId = auth.tenantId ?? 'default';
  const preference = await getPreference(tenantId, auth.userId);
  return NextResponse.json({
    ok: true,
    preference: preference ?? {
      id: preferenceId(tenantId, auth.userId),
      tenantId,
      userId: auth.userId,
      followedPersonIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/me/report-view-preferences' });

async function PUTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const followedPersonIds = Array.isArray(body.followedPersonIds)
    ? Array.from(new Set(body.followedPersonIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))).slice(0, 100)
    : null;
  if (!followedPersonIds) {
    return NextResponse.json({ ok: false, error: 'followedPersonIds must be a string array' }, { status: 400 });
  }

  const tenantId = auth.tenantId ?? 'default';
  const store = getStore();
  const id = preferenceId(tenantId, auth.userId);
  const now = new Date().toISOString();
  const existing = await getPreference(tenantId, auth.userId);
  const preference = existing
    ? await store.reportViewPreferences.update(id, { followedPersonIds, updatedAt: now })
    : await store.reportViewPreferences.create({
        id,
        tenantId,
        userId: auth.userId,
        followedPersonIds,
        createdAt: now,
        updatedAt: now,
      });

  return NextResponse.json({ ok: true, preference });
}

export const PUT = withApiLog(PUTApiHandler, { route: '/api/me/report-view-preferences' });
