import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withApiLog } from '@/lib/api-log/with-api-log';
import {
  buildYonyouTokenUrl,
  getYonyouTokenConfig,
  YonyouTokenConfigError,
  YonyouTokenRequestError,
} from '@/lib/integrations/yonyou-token';
import {
  buildYonyouLoginCodeUrl,
  buildYonyouSsoRedirectUrl,
  getYonyouSsoConfig,
  isYonyouSsoConfigured,
  YonyouSsoConfigError,
  YonyouSsoRequestError,
} from '@/lib/integrations/yonyou-sso';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TokenResponseBody {
  code?: string;
  message?: string;
  data?: {
    access_token?: string;
    expire?: number;
  };
}

interface LoginCodeResponseBody {
  code?: string | number;
  msg?: string;
  message?: string;
  data?: string | {
    status?: string | number;
    curYhtEnvironment?: string;
    code?: string;
    loginCode?: string;
    isBindYhtUser?: string | boolean;
  };
}

function redactUrl(raw: string): string {
  const url = new URL(raw);
  for (const key of ['signature', 'access_token', 'code']) {
    if (url.searchParams.has(key)) url.searchParams.set(key, '***');
  }
  return url.toString();
}

function extractLoginCode(body: LoginCodeResponseBody | null): string | null {
  if (!body) return null;
  if (typeof body.data === 'string') return body.data;
  return body.data?.code || body.data?.loginCode || null;
}

function sanitizeTokenResponse(body: TokenResponseBody | null): Record<string, unknown> | null {
  if (!body) return null;
  return {
    code: body.code,
    message: body.message,
    data: body.data
      ? {
          access_token: body.data.access_token ? '***' : undefined,
          expire: body.data.expire,
        }
      : undefined,
  };
}

function sanitizeLoginCodeResponse(body: LoginCodeResponseBody | null): Record<string, unknown> | null {
  if (!body) return null;
  if (typeof body.data === 'string') {
    return {
      code: body.code,
      message: body.message || body.msg,
      data: body.data ? '***' : body.data,
    };
  }
  return {
    code: body.code,
    message: body.message || body.msg,
    data: body.data
      ? {
          status: body.data.status,
          curYhtEnvironment: body.data.curYhtEnvironment,
          code: body.data.code ? '***' : undefined,
          loginCode: body.data.loginCode ? '***' : undefined,
          isBindYhtUser: body.data.isBindYhtUser,
        }
      : undefined,
  };
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs: number): Promise<{
  status: number;
  ok: boolean;
  body: T | null;
  textPreview: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    let body: T | null = null;
    try {
      body = text ? JSON.parse(text) as T : null;
    } catch {
      body = null;
    }
    return {
      status: response.status,
      ok: response.ok,
      body,
      textPreview: body ? '' : text.slice(0, 500),
    };
  } finally {
    clearTimeout(timer);
  }
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
    const now = Date.now();
    const tokenConfig = getYonyouTokenConfig();
    const ssoConfig = getYonyouSsoConfig();
    const tokenTimeoutMs = Number(tokenConfig.timeoutMs || ssoConfig.timeoutMs || 8000);
    const ssoTimeoutMs = Number(ssoConfig.timeoutMs || tokenConfig.timeoutMs || 8000);

    const tokenUrl = buildYonyouTokenUrl(tokenConfig, now);
    const tokenResponse = await fetchJsonWithTimeout<TokenResponseBody>(
      tokenUrl,
      { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      tokenTimeoutMs,
    );
    const accessToken = tokenResponse.body?.data?.access_token;
    if (!tokenResponse.ok || tokenResponse.body?.code !== '00000' || !accessToken) {
      return NextResponse.json({
        ok: false,
        stoppedAt: 'getAccessToken',
        steps: [{
          name: '1. 获取 access_token',
          request: { method: 'GET', url: redactUrl(tokenUrl) },
          response: {
            httpStatus: tokenResponse.status,
            ok: tokenResponse.ok,
            body: sanitizeTokenResponse(tokenResponse.body),
            textPreview: tokenResponse.textPreview || undefined,
          },
        }],
      }, { status: 502 });
    }

    const loginCodeUrl = buildYonyouLoginCodeUrl(ssoConfig, { accessToken });
    const loginCodeRequestBody = {
      thirdUcId: ssoConfig.thirdUcId,
      userId: employeeId,
    };
    const loginCodeResponse = await fetchJsonWithTimeout<LoginCodeResponseBody>(
      loginCodeUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginCodeRequestBody),
      },
      ssoTimeoutMs,
    );
    const loginCode = extractLoginCode(loginCodeResponse.body);
    if (!loginCodeResponse.ok || !loginCode) {
      return NextResponse.json({
        ok: false,
        stoppedAt: 'getThirdLoginCode',
        steps: [
          {
            name: '1. 获取 access_token',
            request: { method: 'GET', url: redactUrl(tokenUrl) },
            response: {
              httpStatus: tokenResponse.status,
              ok: tokenResponse.ok,
              body: sanitizeTokenResponse(tokenResponse.body),
            },
          },
          {
            name: '2. 获取登录临时 code',
            request: {
              method: 'POST',
              url: redactUrl(loginCodeUrl),
              body: loginCodeRequestBody,
            },
            response: {
              httpStatus: loginCodeResponse.status,
              ok: loginCodeResponse.ok,
              body: sanitizeLoginCodeResponse(loginCodeResponse.body),
              textPreview: loginCodeResponse.textPreview || undefined,
            },
          },
        ],
      }, { status: 502 });
    }

    const redirectUrl = buildYonyouSsoRedirectUrl(ssoConfig, loginCode);
    return NextResponse.json({
      ok: true,
      note: '敏感字段 access_token、signature、临时 code 已打码；第 3 步只展示将要跳转的地址，不在服务端消费临时 code。',
      config: {
        baseUrl: ssoConfig.apiBaseUrl,
        thirdUcId: ssoConfig.thirdUcId,
        loginService: ssoConfig.loginService,
        loginCodePath: ssoConfig.loginCodePath,
        ssoLoginPath: ssoConfig.loginPath,
        userId: employeeId,
      },
      steps: [
        {
          name: '1. 获取 access_token',
          request: { method: 'GET', url: redactUrl(tokenUrl) },
          response: {
            httpStatus: tokenResponse.status,
            ok: tokenResponse.ok,
            body: sanitizeTokenResponse(tokenResponse.body),
          },
        },
        {
          name: '2. 获取登录临时 code',
          request: {
            method: 'POST',
            url: redactUrl(loginCodeUrl),
            body: loginCodeRequestBody,
          },
          response: {
            httpStatus: loginCodeResponse.status,
            ok: loginCodeResponse.ok,
            body: sanitizeLoginCodeResponse(loginCodeResponse.body),
          },
        },
        {
          name: '3. 浏览器跳转用友认证',
          request: {
            method: 'GET',
            url: redactUrl(redirectUrl),
          },
          response: '此步由浏览器访问；服务端 trace 不请求，避免提前消费临时 code。',
        },
      ],
    });
  } catch (error) {
    if (
      error instanceof YonyouSsoConfigError ||
      error instanceof YonyouSsoRequestError ||
      error instanceof YonyouTokenConfigError ||
      error instanceof YonyouTokenRequestError
    ) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export const GET = withApiLog(GETApiHandler, { route: '/api/integrations/yonyou/sso/trace' });
