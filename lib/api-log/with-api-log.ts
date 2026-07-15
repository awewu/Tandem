import { createHash } from 'crypto';
import { runWithBusinessLogContext } from '@/lib/business-log/context';
import { redactBusinessLogData, redactErrorMessage } from '@/lib/business-log/redact';
import type { ApiLogInput, ApiLogOutcome } from './types';

const BODY_LIMIT = Math.max(1_024, Number(process.env.API_LOG_BODY_MAX_BYTES ?? 32_768));
const COOKIE_ACCESS = 'tandem_at';

export interface ApiLogRouteConfig { route: string }
interface ActorContext { actorId: string; tenantId: string; actorType: string }

function cookieValue(raw: string | null, name: string): string | null {
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try { return decodeURIComponent(rest.join('=')); } catch { return rest.join('='); }
    }
  }
  return null;
}

async function resolveActor(req: Request): Promise<ActorContext> {
  const injectedUser = req.headers.get('x-tandem-user-id');
  const injectedTenant = req.headers.get('x-tandem-tenant-id');
  if (injectedUser) return { actorId: injectedUser, tenantId: injectedTenant ?? 'default', actorType: 'user' };
  const accessToken = cookieValue(req.headers.get('cookie'), COOKIE_ACCESS);
  const session = accessToken ? (await import('@/lib/auth/session')).verifyAccessToken(accessToken) : null;
  if (session) return { actorId: session.sub, tenantId: session.tenantId ?? 'default', actorType: 'user' };
  const authorization = req.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
  const apiToken = bearer ? (await import('@/lib/oidc/tokens')).verifyAccessTokenForApiSync(bearer) : null;
  if (apiToken) {
    return {
      actorId: apiToken.sub,
      tenantId: apiToken.tenant ?? 'default',
      actorType: apiToken.client_id ? 'oidc_client' : 'user',
    };
  }
  return { actorId: 'anonymous', tenantId: 'default', actorType: 'anonymous' };
}

function deferApiLog(input: ApiLogInput): void {
  queueMicrotask(() => {
    void import('./service').then(({ appendApiLog }) => appendApiLog(input)).catch(() => undefined);
  });
}

function deriveAction(method: string): string {
  if (method === 'GET' || method === 'HEAD') return 'read';
  if (method === 'DELETE') return 'delete';
  if (method === 'PUT' || method === 'PATCH') return 'update';
  return 'execute';
}

function routeParts(route: string): string[] {
  return route.split('/').filter(Boolean).filter((part) => part !== 'api');
}

function deriveCategory(route: string): string {
  const parts = routeParts(route).filter((part) => !part.startsWith('['));
  return parts[0] === 'admin' ? parts[1] ?? 'admin' : parts[0] ?? 'system';
}

function deriveTargetType(route: string): string | null {
  const parts = routeParts(route);
  const dynamicIndex = parts.findIndex((part) => part.startsWith('['));
  const candidate = dynamicIndex > 0 ? parts[dynamicIndex - 1] : parts.at(-1);
  return candidate?.startsWith('[') ? null : candidate?.replace(/-/g, '_') ?? null;
}

function outcomeForStatus(status: number): ApiLogOutcome {
  if (status >= 200 && status < 400) return 'success';
  if (status === 401 || status === 403) return 'denied';
  if (status >= 500) return 'error';
  return 'failure';
}

function extractParams(args: unknown[]): Record<string, unknown> | null {
  const context = args[0] as { params?: Record<string, unknown> } | undefined;
  return context?.params && typeof context.params === 'object' ? context.params : null;
}

async function readRequestData(req: Request): Promise<Record<string, unknown> | null> {
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const result: Record<string, unknown> = {};
  if (Object.keys(query).length) result.query = query;
  if (req.method === 'GET' || req.method === 'HEAD') return redactBusinessLogData(result);
  const contentType = req.headers.get('content-type')?.toLowerCase() ?? '';
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > BODY_LIMIT) {
    result.body = { omitted: 'size', contentType, contentLength };
    return redactBusinessLogData(result);
  }
  if (contentType.includes('multipart/form-data') || contentType.includes('application/octet-stream')) {
    result.body = { omitted: 'binary', contentType, contentLength: contentLength || null };
    return redactBusinessLogData(result);
  }
  try {
    const clone = req.clone();
    if (contentType.includes('application/json')) result.body = await clone.json();
    else if (contentType.includes('application/x-www-form-urlencoded')) {
      result.body = Object.fromEntries(new URLSearchParams(await clone.text()).entries());
    } else if (contentType.startsWith('text/') && contentLength <= BODY_LIMIT) {
      const text = await clone.text();
      result.body = { omitted: 'text', length: text.length, sha256: createHash('sha256').update(text).digest('hex').slice(0, 16) };
    }
  } catch {
    result.body = { omitted: 'unreadable', contentType };
  }
  return redactBusinessLogData(result);
}

async function readErrorDetails(response: Response): Promise<Record<string, unknown> | null> {
  if (response.status < 400 || !response.headers.get('content-type')?.includes('application/json')) return null;
  try { return redactBusinessLogData({ response: await response.clone().json() }); } catch { return null; }
}

function clientFingerprint(req: Request): string | null {
  const raw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip');
  if (!raw) return null;
  const salt = process.env.API_LOG_IP_SALT || process.env.NEXTAUTH_SECRET || 'dev-api-log-salt';
  return createHash('sha256').update(`${salt}:${raw}`).digest('hex').slice(0, 16);
}

export function withApiLog<TRequest extends Request, TArgs extends unknown[]>(
  handler: (req: TRequest, ...args: TArgs) => Response | Promise<Response>,
  config: ApiLogRouteConfig,
): (req: TRequest, ...args: TArgs) => Promise<Response> {
  return async (req: TRequest, ...args: TArgs): Promise<Response> => {
    const startedAt = performance.now();
    const actor = await resolveActor(req);
    const requestId = req.headers.get('x-request-id');
    const method = req.method.toUpperCase();
    const url = new URL(req.url);
    const operation = `${method} ${config.route}`;
    const params = extractParams(args);
    const targetId = params ? Object.values(params).find((value) => typeof value === 'string') as string | undefined : undefined;
    const requestDataPromise = readRequestData(req);

    return runWithBusinessLogContext({ requestId, ...actor }, async () => {
      try {
        const response = await handler(req, ...args);
        const outcome = outcomeForStatus(response.status);
        deferApiLog({
          requestId,
          ...actor,
          source: 'api',
          category: deriveCategory(config.route),
          operation,
          action: deriveAction(method),
          method,
          path: url.pathname,
          route: config.route,
          targetType: deriveTargetType(config.route),
          targetId: targetId ?? null,
          statusCode: response.status,
          outcome,
          durationMs: performance.now() - startedAt,
          summary: `${operation} ${outcome} (${response.status})`,
          requestData: { ...(await requestDataPromise), params },
          details: {
            ...(await readErrorDetails(response)),
            clientFingerprint: clientFingerprint(req),
            userAgent: req.headers.get('user-agent')?.slice(0, 256) ?? null,
          },
        });
        return response;
      } catch (error) {
        deferApiLog({
          requestId,
          ...actor,
          source: 'api',
          category: deriveCategory(config.route),
          operation,
          action: deriveAction(method),
          method,
          path: url.pathname,
          route: config.route,
          targetType: deriveTargetType(config.route),
          targetId: targetId ?? null,
          statusCode: 500,
          outcome: 'error',
          durationMs: performance.now() - startedAt,
          summary: `${operation} error (unhandled)`,
          requestData: { ...(await requestDataPromise), params },
          details: {
            errorName: error instanceof Error ? error.name : 'UnknownError',
            errorMessage: redactErrorMessage(error instanceof Error ? error.message : String(error)),
            clientFingerprint: clientFingerprint(req),
          },
        });
        throw error;
      }
    });
  };
}
