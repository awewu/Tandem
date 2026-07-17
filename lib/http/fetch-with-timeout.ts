export type FetchImplementation = typeof fetch;

export class RequestTimeoutError extends Error {
  readonly code = 'REQUEST_TIMEOUT';

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

export function isRequestTimeoutError(error: unknown): error is RequestTimeoutError {
  return error instanceof RequestTimeoutError
    || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'REQUEST_TIMEOUT');
}

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  fetchImplementation: FetchImplementation = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  upstreamSignal?.addEventListener('abort', abortFromUpstream, { once: true });
  if (upstreamSignal?.aborted) abortFromUpstream();

  return new Promise<Response>((resolve, reject) => {
    const timeout = setTimeout(() => {
      const error = new RequestTimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);

    void fetchImplementation(input, { ...init, signal: controller.signal }).then(resolve, reject).finally(() => {
      clearTimeout(timeout);
      upstreamSignal?.removeEventListener('abort', abortFromUpstream);
    });
  });
}
