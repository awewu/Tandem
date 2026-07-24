import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import {
  getNeteaseCalendarSyncStatus,
  runNeteaseCalendarSyncForUser,
  sanitizeSyncError,
} from '@/lib/calendar/netease-auto-sync';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';

const GETApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const status = await getNeteaseCalendarSyncStatus(auth.userId);
  return NextResponse.json({
    configured: status.configured,
    account: status.account,
    autoEnabled: status.state?.autoEnabled ?? false,
    status: status.state?.status ?? 'idle',
    lastSyncAt: status.state?.lastSyncAt ?? null,
    lastAttemptAt: status.state?.lastAttemptAt ?? null,
    lastManualSyncAt: status.state?.lastManualSyncAt ?? null,
    lastError: status.state?.lastError ?? null,
    lastResult: status.state?.lastResult ?? null,
  });
});

export const GET = withApiLog(GETApiHandler, { route: '/api/calendar/sync/netease' });

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const credentialStatus = await getNeteaseCalendarSyncStatus(auth.userId);
  if (!credentialStatus.configured) {
    return NextResponse.json(
      {
        error: {
          code: 'MAIL_CREDENTIALS_REQUIRED',
          message: '请先配置个人邮箱账号和密码，再同步网易日程。',
          configureUrl: '/settings/email?next=/calendar&reason=netease-calendar-sync',
        },
      },
      { status: 428 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const from = typeof body.from === 'string' ? new Date(body.from) : undefined;
  const to = typeof body.to === 'string' ? new Date(body.to) : undefined;
  const verifyCode = typeof body.verifyCode === 'string' ? body.verifyCode : undefined;

  try {
    const result = await runNeteaseCalendarSyncForUser({
      userId: auth.userId,
      tenantId: auth.tenantId,
      email: auth.email,
      from,
      to,
      verifyCode,
      mode: 'manual',
    });
    const status = await getNeteaseCalendarSyncStatus(auth.userId);
    return NextResponse.json({
      ...result,
      autoEnabled: status.state?.autoEnabled ?? true,
      lastSyncAt: status.state?.lastSyncAt ?? null,
      syncState: status.state,
    });
  } catch (error) {
    const message = error instanceof Error ? sanitizeSyncError(error.message) : '网易邮箱日程同步失败';
    return NextResponse.json(
      { error: { code: 'NETEASE_SYNC_FAILED', message } },
      { status: message.includes('未绑定') || message.includes('时间范围') ? 400 : 502 },
    );
  }
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/sync/netease' });
