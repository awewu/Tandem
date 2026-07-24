import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import { withApiLog } from '@/lib/api-log/with-api-log';
import {
  getYonyouAccessToken,
  isYonyouTokenConfigured,
  YonyouTokenConfigError,
  YonyouTokenRequestError,
} from '@/lib/integrations/yonyou-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function GETApiHandler(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const forbidden = requireRole(auth, DATA_STEWARD_ROLES);
  if (forbidden) return forbidden;

  if (!isYonyouTokenConfigured()) {
    return NextResponse.json({
      configured: false,
      reachable: false,
      error: 'YONSUITE_API_BASE, YONSUITE_APP_KEY and YONSUITE_APP_SECRET are required',
    }, { status: 503 });
  }

  const forceRefresh = req.nextUrl.searchParams.get('force') === '1';
  try {
    const result = await getYonyouAccessToken({ forceRefresh });
    return NextResponse.json({
      configured: true,
      reachable: true,
      cached: result.cached,
      expireSeconds: result.expireSeconds,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    if (error instanceof YonyouTokenConfigError) {
      return NextResponse.json({
        configured: true,
        reachable: false,
        error: error.message,
      }, { status: 400 });
    }
    if (error instanceof YonyouTokenRequestError) {
      return NextResponse.json({
        configured: true,
        reachable: false,
        error: error.message,
        code: error.details.code,
        yonyouMessage: error.details.yonyouMessage,
        status: error.details.status,
      }, { status: 502 });
    }
    return NextResponse.json({
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 502 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/integrations/yonyou/token' });
