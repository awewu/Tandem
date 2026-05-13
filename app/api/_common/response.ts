/**
 * Unified server-side response helpers.
 *
 * Provides consistent JSON encoding, CORS headers, and error envelope
 * formatting across all API routes.
 *
 * Migration strategy (backward-compatible):
 *   - Existing routes that return { ok, ... } keep their shape.
 *   - New routes should prefer ApiResponse<T> from lib/api-response.ts.
 */

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

export function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return Response.json(data, {
    status,
    headers: { ...DEFAULT_HEADERS, ...extraHeaders },
  });
}

export function error(message: string, status = 500, extra?: Record<string, unknown>): Response {
  return json({ ok: false, error: message, ...extra }, status);
}

export function ok<T>(data: T, extra?: Record<string, unknown>): Response {
  return json({ ok: true, data, ...extra }, 200);
}

/**
 * Wrap an async handler with standard try/catch + error envelope.
 */
export async function handle<T>(
  fn: () => Promise<T>,
  map: (result: T) => Response
): Promise<Response> {
  try {
    return map(await fn());
  } catch (err: any) {
    const msg = err?.message || 'Internal server error';
    return error(msg, err?.status || 500);
  }
}
