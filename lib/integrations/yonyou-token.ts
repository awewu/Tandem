import { createHmac } from 'crypto';
import { childLogger } from '@/lib/infra/logger';

const DEFAULT_SELF_APP_TOKEN_PATH = '/iuap-api-auth/open-auth/selfAppAuth/base/v1/getAccessToken';
const DEFAULT_TIMEOUT_MS = 8_000;
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface YonyouTokenConfig {
  baseUrl: string;
  appKey: string;
  appSecret: string;
  tokenUrl?: string;
  tokenPath?: string;
  timeoutMs?: number;
}

export interface YonyouTokenResult {
  accessToken: string;
  expireSeconds: number;
  expiresAt: string;
  cached: boolean;
}

interface CachedToken {
  cacheKey: string;
  accessToken: string;
  expireSeconds: number;
  expiresAtMs: number;
}

interface YonyouTokenResponse {
  code?: string;
  message?: string;
  data?: {
    access_token?: string;
    expire?: number;
  };
}

export class YonyouTokenConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YonyouTokenConfigError';
  }
}

export class YonyouTokenRequestError extends Error {
  constructor(
    message: string,
    readonly details: {
      status?: number;
      code?: string;
      yonyouMessage?: string;
      endpoint?: string;
    } = {},
  ) {
    super(message);
    this.name = 'YonyouTokenRequestError';
  }
}

const log = childLogger({ integration: 'yonyou', component: 'access-token' });
let cachedToken: CachedToken | null = null;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizePath(value: string): string {
  return value.startsWith('/') ? value : `/${value}`;
}

export function isYonyouTokenConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(
    (env.YONYOU_ERP_BASE_URL || env.YONSUITE_API_BASE) &&
    (env.YONYOU_ERP_APP_KEY || env.YONSUITE_APP_KEY) &&
    (env.YONYOU_ERP_APP_SECRET || env.YONSUITE_APP_SECRET)
  );
}

export function getYonyouTokenConfig(env: NodeJS.ProcessEnv = process.env): YonyouTokenConfig {
  const baseUrl = (env.YONYOU_ERP_BASE_URL || env.YONSUITE_API_BASE)?.trim();
  const appKey = (env.YONYOU_ERP_APP_KEY || env.YONSUITE_APP_KEY)?.trim();
  const appSecret = (env.YONYOU_ERP_APP_SECRET || env.YONSUITE_APP_SECRET)?.trim();

  if (!baseUrl || !appKey || !appSecret) {
    throw new YonyouTokenConfigError('Yonyou/YonSuite token is not configured');
  }

  return {
    baseUrl,
    appKey,
    appSecret,
    tokenUrl: (env.YONYOU_ERP_TOKEN_URL || env.YONSUITE_TOKEN_URL)?.trim() || undefined,
    tokenPath: (env.YONYOU_ERP_TOKEN_PATH || env.YONSUITE_TOKEN_PATH)?.trim() || DEFAULT_SELF_APP_TOKEN_PATH,
    timeoutMs: Number(env.YONYOU_ERP_TOKEN_TIMEOUT_MS || env.YONSUITE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

export function buildYonyouStringToSign(params: Record<string, string | number>): string {
  return Object.keys(params)
    .filter((key) => key !== 'signature')
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');
}

export function signYonyouParams(
  params: Record<string, string | number>,
  appSecret: string,
): string {
  const text = buildYonyouStringToSign(params);
  const signature = createHmac('sha256', appSecret).update(text, 'utf8').digest('base64');
  return encodeURIComponent(signature);
}

export function buildYonyouTokenUrl(config: YonyouTokenConfig, timestamp = Date.now()): string {
  const endpoint = config.tokenUrl
    ? config.tokenUrl
    : `${trimTrailingSlash(config.baseUrl)}${normalizePath(config.tokenPath || DEFAULT_SELF_APP_TOKEN_PATH)}`;
  const params = { appKey: config.appKey, timestamp };
  const signature = signYonyouParams(params, config.appSecret);
  const url = new URL(endpoint);
  url.searchParams.set('appKey', config.appKey);
  url.searchParams.set('timestamp', String(timestamp));
  return `${url.toString()}&signature=${signature}`;
}

function cacheKeyForConfig(config: YonyouTokenConfig): string {
  const endpoint = config.tokenUrl
    ? config.tokenUrl
    : `${trimTrailingSlash(config.baseUrl)}${normalizePath(config.tokenPath || DEFAULT_SELF_APP_TOKEN_PATH)}`;
  return `${endpoint}:${config.appKey}`;
}

function assertHttpBaseUrl(baseUrl: string): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new YonyouTokenConfigError('YONSUITE_API_BASE or YONYOU_ERP_BASE_URL must be a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new YonyouTokenConfigError('YONSUITE_API_BASE or YONYOU_ERP_BASE_URL must use http or https');
  }
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<{ status: number; ok: boolean; body: YonyouTokenResponse | null; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    const text = await response.text();
    let body: YonyouTokenResponse | null = null;
    try {
      body = text ? JSON.parse(text) as YonyouTokenResponse : null;
    } catch {
      body = null;
    }
    return { status: response.status, ok: response.ok, body, text };
  } finally {
    clearTimeout(timer);
  }
}

function toResult(token: CachedToken, cached: boolean): YonyouTokenResult {
  return {
    accessToken: token.accessToken,
    expireSeconds: token.expireSeconds,
    expiresAt: new Date(token.expiresAtMs).toISOString(),
    cached,
  };
}

export function resetYonyouAccessTokenCacheForTests(): void {
  cachedToken = null;
}

export async function getYonyouAccessToken(options: {
  config?: YonyouTokenConfig;
  forceRefresh?: boolean;
  fetchImpl?: typeof fetch;
  now?: number;
} = {}): Promise<YonyouTokenResult> {
  const now = options.now ?? Date.now();
  const config = options.config ?? getYonyouTokenConfig();
  const cacheKey = cacheKeyForConfig(config);
  if (
    !options.forceRefresh &&
    cachedToken &&
    cachedToken.cacheKey === cacheKey &&
    cachedToken.expiresAtMs - REFRESH_SKEW_MS > now
  ) {
    return toResult(cachedToken, true);
  }

  assertHttpBaseUrl(config.baseUrl);
  const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs && config.timeoutMs > 0
    ? config.timeoutMs
    : DEFAULT_TIMEOUT_MS;
  const url = buildYonyouTokenUrl(config, now);
  const endpoint = config.tokenUrl
    ? config.tokenUrl
    : `${trimTrailingSlash(config.baseUrl)}${normalizePath(config.tokenPath || DEFAULT_SELF_APP_TOKEN_PATH)}`;

  try {
    const response = await fetchJsonWithTimeout(url, timeoutMs, options.fetchImpl ?? fetch);
    if (!response.ok) {
      throw new YonyouTokenRequestError(`Yonyou token HTTP request failed: ${response.status}`, {
        status: response.status,
        endpoint,
      });
    }

    const body = response.body;
    if (!body || body.code !== '00000' || !body.data?.access_token || !body.data.expire) {
      throw new YonyouTokenRequestError('Yonyou token response is not successful', {
        status: response.status,
        code: body?.code,
        yonyouMessage: body?.message,
        endpoint,
      });
    }

    cachedToken = {
      cacheKey,
      accessToken: body.data.access_token,
      expireSeconds: body.data.expire,
      expiresAtMs: now + body.data.expire * 1000,
    };
    log.info({
      endpoint,
      expireSeconds: cachedToken.expireSeconds,
      expiresAt: new Date(cachedToken.expiresAtMs).toISOString(),
    }, 'Yonyou access token refreshed');
    return toResult(cachedToken, false);
  } catch (error) {
    if (error instanceof YonyouTokenRequestError || error instanceof YonyouTokenConfigError) {
      log.warn({
        endpoint,
        status: error instanceof YonyouTokenRequestError ? error.details.status : undefined,
        code: error instanceof YonyouTokenRequestError ? error.details.code : undefined,
        yonyouMessage: error instanceof YonyouTokenRequestError ? error.details.yonyouMessage : undefined,
      }, 'Yonyou access token request failed');
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ endpoint, error: message }, 'Yonyou access token request failed');
    throw new YonyouTokenRequestError(`Yonyou token request failed: ${message}`, { endpoint });
  }
}
