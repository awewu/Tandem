import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { withApiLog } from '@/lib/api-log/with-api-log';
import {
  createGlobalEmailConfig,
  listPublicGlobalEmailConfigs,
  type GlobalEmailConfigInput,
} from '@/lib/email/global-email-config';

function canManage(roles: string[]): boolean {
  return roles.some((role) => role === 'owner' || role === 'admin');
}

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManage(auth.roles)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return NextResponse.json({ configs: await listPublicGlobalEmailConfigs(auth.tenantId) });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/mail/global-configs' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canManage(auth.roles)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await req.json();
  const config = await createGlobalEmailConfig(auth.tenantId, body as GlobalEmailConfigInput);
  return NextResponse.json({ config }, { status: 201 });
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/mail/global-configs' });
