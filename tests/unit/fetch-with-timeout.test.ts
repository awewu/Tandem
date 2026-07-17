import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, type FetchImplementation } from '@/lib/http/fetch-with-timeout';

describe('fetchWithTimeout', () => {
  afterEach(() => vi.useRealTimers());

  it('ends a stalled calendar mutation after the request deadline', async () => {
    vi.useFakeTimers();
    const stalledFetch = vi.fn<FetchImplementation>((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }));
    let result: unknown = 'pending';

    void fetchWithTimeout('/api/calendar', { method: 'POST' }, 15_000, stalledFetch)
      .catch((error: unknown) => {
        result = error;
      });

    await vi.advanceTimersByTimeAsync(15_000);
    await Promise.resolve();

    expect(result).toMatchObject({ code: 'REQUEST_TIMEOUT' });
  });
});
