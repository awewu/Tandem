import type { ApiLogInput, ApiLogOutcome } from './types';

const INGEST_PATH = '/api/internal/api-log-ingest';
export interface ApiLogRouteConfig { route: string }

function secret(): string {
  return process.env.API_LOG_INGEST_SECRET || process.env.BUSINESS_LOG_INGEST_SECRET
    || process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || 'dev-only-api-log-ingest-secret';
}

async function hmacHex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function outcomeForStatus(status: number): ApiLogOutcome {
  if (status >= 200 && status < 400) return 'success';
  if (status === 401 || status === 403) return 'denied';
  if (status >= 500) return 'error';
  return 'failure';
}

function categoryForRoute(route: string): string {
  return route.split('/').filter(Boolean).filter((part) => part !== 'api')[0] ?? 'system';
}

async function persist(req: Request, input: ApiLogInput): Promise<void> {
  const body = JSON.stringify(input);
  const timestamp = String(Date.now());
  const signature = await hmacHex(`${timestamp}.${body}`);
  await fetch(new URL(INGEST_PATH, req.url), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-log-timestamp': timestamp, 'x-api-log-signature': signature },
    body,
  });
}

export function withApiLog<TRequest extends Request, TArgs extends unknown[]>(
  handler: (req: TRequest, ...args: TArgs) => Response | Promise<Response>,
  config: ApiLogRouteConfig,
): (req: TRequest, ...args: TArgs) => Promise<Response> {
  return async (req: TRequest, ...args: TArgs): Promise<Response> => {
    const startedAt = performance.now();
    const method = req.method.toUpperCase();
    const operation = `${method} ${config.route}`;
    const context = args[0] as { params?: Record<string, unknown> } | undefined;
    const targetId = context?.params ? Object.values(context.params).find((value) => typeof value === 'string') as string | undefined : undefined;
    const base = {
      requestId: req.headers.get('x-request-id'),
      tenantId: req.headers.get('x-tandem-tenant-id') ?? 'default',
      actorId: req.headers.get('x-tandem-user-id') ?? 'anonymous',
      actorType: req.headers.has('x-tandem-user-id') ? 'user' : 'anonymous',
      source: 'edge',
      category: categoryForRoute(config.route),
      operation,
      action: method === 'GET' || method === 'HEAD' ? 'read' : 'execute',
      method,
      path: new URL(req.url).pathname,
      route: config.route,
      targetId: targetId ?? null,
    } satisfies Partial<ApiLogInput>;
    try {
      const response = await handler(req, ...args);
      const outcome = outcomeForStatus(response.status);
      await persist(req, {
        ...base,
        statusCode: response.status,
        outcome,
        durationMs: performance.now() - startedAt,
        summary: `${operation} ${outcome} (${response.status})`,
        requestData: context?.params ? { params: context.params } : null,
      } as ApiLogInput).catch(() => undefined);
      return response;
    } catch (error) {
      await persist(req, {
        ...base,
        statusCode: 500,
        outcome: 'error',
        durationMs: performance.now() - startedAt,
        summary: `${operation} error (unhandled)`,
        details: { errorName: error instanceof Error ? error.name : 'UnknownError' },
      } as ApiLogInput).catch(() => undefined);
      throw error;
    }
  };
}
