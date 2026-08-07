import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiLogInput } from '@/lib/api-log/types';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  values: vi.fn(),
  onConflictDoNothing: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/lib/infra/storage-mode', () => ({ isDatabaseMode: () => true }));
vi.mock('@/lib/infra/drizzle-client', () => ({
  db: { insert: mocks.insert },
  schema: { apiLog: {} },
}));
vi.mock('@/lib/infra/logger', () => ({ logger: { warn: mocks.warn } }));

import { deferApiLog, resetApiLogsForTests } from '@/lib/api-log/service';

function logInput(index: number): ApiLogInput {
  return {
    id: `retry-log-${index}`,
    operation: 'POST /api/retry-test',
    action: 'execute',
    method: 'POST',
    path: '/api/retry-test',
    statusCode: 200,
    outcome: 'success',
    summary: `retry test ${index}`,
  };
}

describe('api log database batching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetApiLogsForTests();
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockReturnValue({ onConflictDoNothing: mocks.onConflictDoNothing });
  });

  afterEach(() => {
    resetApiLogsForTests();
    vi.useRealTimers();
  });

  it('retries a failed batch instead of dropping it', async () => {
    mocks.onConflictDoNothing
      .mockRejectedValueOnce(new Error('database temporarily unavailable'))
      .mockResolvedValueOnce(undefined);

    for (let index = 0; index < 100; index++) deferApiLog(logInput(index));

    await vi.waitFor(() => expect(mocks.onConflictDoNothing).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(mocks.onConflictDoNothing).toHaveBeenCalledTimes(2));

    expect(mocks.values.mock.calls[1][0]).toHaveLength(100);
    expect(mocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({ count: 100, dropped: 0 }),
      '[api-log] batch persist failed; queued for retry',
    );
  });
});
