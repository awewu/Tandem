/**
 * Unified API response envelope.
 *
 * All API routes (both web and Tauri) should converge on this shape so that
 * consumers never need to guess which key (`ok`, `success`, or bare `error`)
 * indicates failure.
 *
 * Conventions:
 *   - `ok: true`  → operation succeeded, read `data`
 *   - `ok: false` → operation failed, read `error`
 *   - `meta`      → pagination, timing, or debug info (optional)
 */

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export function success<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return { ok: true, data, meta };
}

export function failure(error: string, meta?: Record<string, unknown>): ApiResponse<never> {
  return { ok: false, error, meta };
}

/**
 * Type guard to narrow an ApiResponse after checking `ok`.
 */
export function isSuccess<T>(res: ApiResponse<T>): res is ApiResponse<T> & { ok: true; data: T } {
  return res.ok === true;
}

export function isFailure<T>(res: ApiResponse<T>): res is ApiResponse<T> & { ok: false; error: string } {
  return res.ok === false;
}
