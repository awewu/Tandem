import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import {
  deleteGlobalEmailConfig,
  updateGlobalEmailConfig,
  type GlobalEmailConfigInput,
} from '@/lib/email/global-email-config';

interface RouteContext {
  params: { id: string };
}

function canManage(roles: string[]): boolean {
  return roles.some((role) => role === 'owner' || role === 'admin');
}

const PUTApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManage(auth.roles)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const config = await updateGlobalEmailConfig(params.id, auth.tenantId, body as GlobalEmailConfigInput);
  return NextResponse.json({ config });
});

export const PUT = withApiLog(PUTApiHandler, { route: '/api/mail/global-configs/[id]' });

const DELETEApiHandler = withErrorHandler(async (req: NextRequest, { params }: RouteContext) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManage(auth.roles)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await deleteGlobalEmailConfig(params.id, auth.tenantId);
  return NextResponse.json({ ok: true });
});

export const DELETE = withApiLog(DELETEApiHandler, { route: '/api/mail/global-configs/[id]' });
