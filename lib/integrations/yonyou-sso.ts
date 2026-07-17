import { childLogger } from '@/lib/infra/logger';
import { getYonyouAccessToken } from './yonyou-token';

const DEFAULT_SSO_BASE_URL = 'https://euc.yonyoucloud.com';
const DEFAULT_SSO_LOGIN_PATH = '/cas/thirdOauth2CodeLogin';
const DEFAULT_LOGIN_CODE_PATH = '/iuap-api-gateway/yonbip/yht/getThirdLoginCode';
const DEFAULT_TIMEOUT_MS = 8_000;

export interface YonyouSsoConfig {
  apiBaseUrl: string;
  thirdUcId: string;
  ssoBaseUrl: string;
  loginService: string;
  loginPath: string;
  loginCodePath: string;
  timeoutMs: number;
}

interface YonyouLoginCodeResponse {
  code?: string | number;
  msg?: string;
  message?: string;
  data?: string | {
    code?: string;
    loginCode?: string;
  };
}

export class YonyouSsoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YonyouSsoConfigError';
  }
}

export class YonyouSsoRequestError extends Error {
  constructor(
    message: string,
    readonly details: {
      status?: number;
      code?: string | number;
      yonyouMessage?: string;
      endpoint?: string;
    } = {},
  ) {
    super(message);
    this.name = 'YonyouSsoRequestError';
  }
}

const log = childLogger({ integration: 'yonyou', component: 'sso' });

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

function assertHttpUrl(raw: string, fieldName: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new YonyouSsoConfigError(`${fieldName} must be a valid URL`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new YonyouSsoConfigError(`${fieldName} must use http or https`);
  }
}

function buildLoginServiceFromTenant(apiBaseUrl: string, tenantId: string): string {
  const url = new URL('/login', `${trimTrailingSlash(apiBaseUrl)}/`);
  url.searchParams.set('tenantId', tenantId);
  return url.toString();
}

export function isYonyouSsoConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.YONYOU_ERP_THIRD_UC_ID);
}

export function getYonyouSsoConfig(env: NodeJS.ProcessEnv = process.env): YonyouSsoConfig {
  const thirdUcId = env.YONYOU_ERP_THIRD_UC_ID?.trim();
  const apiBaseUrl = env.YONYOU_ERP_BASE_URL?.trim();
  if (!thirdUcId) {
    throw new YonyouSsoConfigError('YONYOU_ERP_THIRD_UC_ID is required');
  }
  if (!apiBaseUrl) {
    throw new YonyouSsoConfigError('YONYOU_ERP_BASE_URL is required');
  }
  const ssoBaseUrl = env.YONYOU_ERP_SSO_BASE_URL?.trim() || DEFAULT_SSO_BASE_URL;
  const tenantId = env.YONYOU_ERP_TENANT_ID?.trim();
  const loginService = env.YONYOU_ERP_LOGIN_SERVICE_EMPTY === '1'
    ? ''
    : env.YONYOU_ERP_LOGIN_SERVICE?.trim()
    || (tenantId ? buildLoginServiceFromTenant(apiBaseUrl, tenantId) : apiBaseUrl);
  assertHttpUrl(apiBaseUrl, 'YONYOU_ERP_BASE_URL');
  assertHttpUrl(ssoBaseUrl, 'YONYOU_ERP_SSO_BASE_URL');
  if (loginService) assertHttpUrl(loginService, 'YONYOU_ERP_LOGIN_SERVICE');
  return {
    apiBaseUrl,
    thirdUcId,
    ssoBaseUrl,
    loginService,
    loginPath: env.YONYOU_ERP_SSO_LOGIN_PATH?.trim() || DEFAULT_SSO_LOGIN_PATH,
    loginCodePath: env.YONYOU_ERP_SSO_CODE_PATH?.trim() || DEFAULT_LOGIN_CODE_PATH,
    timeoutMs: Number(env.YONYOU_ERP_SSO_TIMEOUT_MS || env.YONYOU_ERP_TOKEN_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

function codeFromResponse(body: YonyouLoginCodeResponse | null): string | null {
  if (!body) return null;
  if (typeof body.data === 'string') return body.data;
  return body.data?.code || body.data?.loginCode || null;
}

function responseLooksSuccessful(body: YonyouLoginCodeResponse | null): boolean {
  if (!body) return false;
  if (body.code === undefined || body.code === null) return Boolean(codeFromResponse(body));
  return body.code === 0 || body.code === 200 || body.code === '0' || body.code === '200' || body.code === '00000';
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  requestBody: Record<string, string>,
): Promise<{ status: number; ok: boolean; body: YonyouLoginCodeResponse | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const text = await response.text();
    let responseBody: YonyouLoginCodeResponse | null = null;
    try {
      responseBody = text ? JSON.parse(text) as YonyouLoginCodeResponse : null;
    } catch {
      responseBody = null;
    }
    return { status: response.status, ok: response.ok, body: responseBody };
  } finally {
    clearTimeout(timer);
  }
}

export function buildYonyouLoginCodeUrl(
  config: YonyouSsoConfig,
  params: { accessToken: string },
): string {
  const endpoint = `${trimTrailingSlash(config.apiBaseUrl)}${normalizePath(config.loginCodePath)}`;
  const query = new URLSearchParams({
    access_token: params.accessToken,
  });
  return `${endpoint}?${query.toString()}`;
}

export function buildYonyouSsoRedirectUrl(
  config: YonyouSsoConfig,
  loginCode: string,
  serviceOverride?: string,
): string {
  const url = new URL(normalizePath(config.loginPath), `${trimTrailingSlash(config.ssoBaseUrl)}/`);
  url.searchParams.set('thirdUCId', config.thirdUcId);
  url.searchParams.set('code', loginCode);
  url.searchParams.set('service', serviceOverride || config.loginService);
  return url.toString();
}

export async function getYonyouSsoLoginCode(options: {
  userId: string;
  config?: YonyouSsoConfig;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const userId = options.userId.trim();
  if (!userId) throw new YonyouSsoConfigError('Yonyou SSO userId is required');
  const config = options.config ?? getYonyouSsoConfig();
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0
    ? config.timeoutMs
    : DEFAULT_TIMEOUT_MS;
  const token = await getYonyouAccessToken();
  const url = buildYonyouLoginCodeUrl(config, {
    accessToken: token.accessToken,
  });
  const endpoint = `${trimTrailingSlash(config.apiBaseUrl)}${normalizePath(config.loginCodePath)}`;

  try {
    const response = await fetchJsonWithTimeout(
      url,
      timeoutMs,
      options.fetchImpl ?? fetch,
      {
        thirdUcId: config.thirdUcId,
        userId,
      },
    );
    const body = response.body;
    const loginCode = codeFromResponse(body);
    if (!response.ok || !responseLooksSuccessful(body) || !loginCode) {
      throw new YonyouSsoRequestError('Yonyou SSO login code response is not successful', {
        status: response.status,
        code: body?.code,
        yonyouMessage: body?.message || body?.msg,
        endpoint,
      });
    }
    log.info({ userId, endpoint }, 'Yonyou SSO login code issued');
    return loginCode;
  } catch (error) {
    if (error instanceof YonyouSsoRequestError || error instanceof YonyouSsoConfigError) {
      log.warn({
        userId,
        endpoint,
        status: error instanceof YonyouSsoRequestError ? error.details.status : undefined,
        code: error instanceof YonyouSsoRequestError ? error.details.code : undefined,
        yonyouMessage: error instanceof YonyouSsoRequestError ? error.details.yonyouMessage : undefined,
      }, 'Yonyou SSO login code request failed');
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ userId, endpoint, error: message }, 'Yonyou SSO login code request failed');
    throw new YonyouSsoRequestError(`Yonyou SSO login code request failed: ${message}`, { endpoint });
  }
}

export async function buildYonyouSsoUrlForUser(options: {
  userId: string;
  serviceOverride?: string;
}): Promise<string> {
  const config = getYonyouSsoConfig();
  const code = await getYonyouSsoLoginCode({ userId: options.userId, config });
  return buildYonyouSsoRedirectUrl(config, code, options.serviceOverride);
}
