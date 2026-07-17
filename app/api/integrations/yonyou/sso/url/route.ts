import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import {
  buildYonyouSsoUrlForUser,
  getYonyouSsoConfig,
  isYonyouSsoConfigured,
  YonyouSsoConfigError,
  YonyouSsoRequestError,
} from '@/lib/integrations/yonyou-sso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function serviceOverrideFromRequest(req: NextRequest, configuredService: string): string | undefined {
  const raw = req.nextUrl.searchParams.get('service');
  if (!raw) return undefined;

  const configured = new URL(configuredService);
  const candidate = new URL(raw);
  if (candidate.origin !== configured.origin) {
    throw new YonyouSsoConfigError('service must use configured Yonyou origin');
  }
  return candidate.toString();
}

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isYonyouSsoConfigured()) {
    return NextResponse.json({
      ok: false,
      error: 'YONYOU_ERP_THIRD_UC_ID is required',
    }, { status: 503 });
  }

  const store = getStore();
  const user = auth.demo ? null : await store.auth.users.findById(auth.userId);
  const employeeId = user?.employeeId?.trim();
  if (!employeeId) {
    return NextResponse.json({
      ok: false,
      error: '当前用户没有工号 employeeId，无法作为用友 SSO userId',
    }, { status: 400 });
  }

  try {
    const config = getYonyouSsoConfig();
    const url = await buildYonyouSsoUrlForUser({
      userId: employeeId,
      serviceOverride: serviceOverrideFromRequest(req, config.loginService),
    });
    return NextResponse.json({ ok: true, url }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof YonyouSsoConfigError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    if (error instanceof YonyouSsoRequestError) {
      return NextResponse.json({
        ok: false,
        error: error.message,
        code: error.details.code,
        yonyouMessage: error.details.yonyouMessage,
        status: error.details.status,
      }, { status: 502 });
    }
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/integrations/yonyou/sso/url' });
