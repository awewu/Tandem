import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/lib/api/error-middleware';
import { requireAuth } from '@/lib/auth/require-auth';
import { boot } from '@/lib/boot';
import { syncNeteaseCalendar } from '@/lib/calendar/netease-sync';
import { withApiLog } from '@/lib/api-log/with-api-log';

export const dynamic = 'force-dynamic';

const POSTApiHandler = withErrorHandler(async (req: NextRequest) => {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const from = typeof body.from === 'string' ? new Date(body.from) : undefined;
  const to = typeof body.to === 'string' ? new Date(body.to) : undefined;
  const verifyCode = typeof body.verifyCode === 'string' ? body.verifyCode : undefined;

  let result;
  try {
    result = await syncNeteaseCalendar({
      userId: auth.userId,
      tenantId: auth.tenantId,
      email: auth.email,
      from,
      to,
      verifyCode,
    });
  } catch (error) {
    const message = error instanceof Error ? sanitizeSyncError(error.message) : '网易邮箱日程同步失败';
    return NextResponse.json(
      { error: { code: 'NETEASE_SYNC_FAILED', message } },
      { status: message.includes('未绑定') || message.includes('时间范围') ? 400 : 502 },
    );
  }

  return NextResponse.json(result);
});

export const POST = withApiLog(POSTApiHandler, { route: '/api/calendar/sync/netease' });

function sanitizeSyncError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return '网易邮箱日程同步失败';
  if (/password|cookie|sid|token|authorization/i.test(trimmed)) return '网易邮箱日程同步失败，请检查邮箱配置或稍后重试。';
  if (/fetch failed|ssl|certificate|network|econn|timeout|enotfound|tls/i.test(trimmed)) {
    return '服务端暂时无法连接网易企业邮箱日历接口，请检查服务器网络/证书/代理配置后重试。';
  }
  return trimmed;
}
