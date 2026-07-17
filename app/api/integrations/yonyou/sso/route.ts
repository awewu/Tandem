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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function manualRedirectHtml(redirectUrl: string): string {
  const safeUrl = escapeHtml(redirectUrl);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>用友单点登录</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #172033; }
    main { width: min(760px, calc(100vw - 40px)); border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: 24px; box-shadow: 0 18px 45px rgba(15, 23, 42, .08); }
    h1 { margin: 0 0 10px; font-size: 18px; }
    p { margin: 0 0 14px; color: #64748b; line-height: 1.6; font-size: 14px; }
    code { display: block; white-space: pre-wrap; word-break: break-all; border: 1px solid #e5e7eb; border-radius: 8px; background: #f8fafc; padding: 12px; color: #334155; font-size: 12px; }
    a { display: inline-flex; margin-top: 16px; align-items: center; justify-content: center; border-radius: 8px; background: #b91c1c; color: #fff; text-decoration: none; padding: 10px 14px; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <h1>用友单点登录链接已生成</h1>
    <p>当前为手动模式，页面不会自动重定向。点击下面按钮后再访问用友。</p>
    <code>${safeUrl}</code>
    <a href="${safeUrl}">手动进入 YonSuite ERP</a>
  </main>
</body>
</html>`;
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
    const redirectUrl = await buildYonyouSsoUrlForUser({
      userId: employeeId,
      serviceOverride: serviceOverrideFromRequest(req, config.loginService),
    });
    const redirectMode = req.nextUrl.searchParams.get('redirect');
    if (redirectMode === '0') {
      return new NextResponse(manualRedirectHtml(redirectUrl), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }
    return NextResponse.redirect(redirectUrl);
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

export const GET = withApiLog(GETApiHandler, { route: '/api/integrations/yonyou/sso' });
