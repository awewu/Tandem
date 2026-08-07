import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  boot: vi.fn(async () => undefined),
  getBootReadiness: vi.fn(),
  fireAlert: vi.fn(async () => undefined),
  loggerWarn: vi.fn(),
}));

vi.mock('@/lib/boot', () => ({
  boot: mocks.boot,
  getBootReadiness: mocks.getBootReadiness,
  getRouter: () => ({ listProviders: () => ['deepseek-v3'] }),
}));

vi.mock('@/lib/infra/drizzle-client', () => ({ db: {} }));
vi.mock('@/lib/infra/storage-mode', () => ({ isDatabaseMode: () => false }));
vi.mock('@/lib/api-log/with-api-log', () => ({
  withApiLog: (handler: () => Promise<Response>) => handler,
}));
vi.mock('@/lib/infra/logger', () => ({
  logger: { warn: mocks.loggerWarn },
}));
vi.mock('@/lib/infra/observability', () => ({
  isObservabilityEnabled: () => ({ sentry: false, otel: false }),
}));
vi.mock('@/lib/infra/alerts', () => ({ fireAlert: mocks.fireAlert }));

describe('/api/health bootstrap readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REDIS_URL;
    delete process.env.S3_ENDPOINT;
  });

  it('returns 503 while background initialization is still running', async () => {
    mocks.getBootReadiness.mockReturnValue({
      state: 'initializing',
      startedAt: 100,
      completedAt: null,
      durationMs: 25,
      warnings: [],
    });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET(new Request('http://test.local/api/health'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.checks.bootstrap).toMatchObject({
      ok: false,
      state: 'initializing',
      error: 'initialization in progress',
    });
    expect(mocks.fireAlert).not.toHaveBeenCalled();
  });

  it('returns 200 only after initialization reaches ready', async () => {
    mocks.getBootReadiness.mockReturnValue({
      state: 'ready',
      startedAt: 100,
      completedAt: 175,
      durationMs: 75,
      warnings: ['MCP servers sync: unavailable'],
    });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET(new Request('http://test.local/api/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.checks.bootstrap).toMatchObject({
      ok: true,
      state: 'ready',
      startedAt: 100,
      completedAt: 175,
      warnings: ['MCP servers sync: unavailable'],
    });
  });

  it('reports a terminal bootstrap failure and dispatches an alert', async () => {
    mocks.getBootReadiness.mockReturnValue({
      state: 'failed',
      startedAt: 100,
      completedAt: 130,
      durationMs: 30,
      warnings: [],
      error: 'seed crashed',
    });

    const { GET } = await import('@/app/api/health/route');
    const response = await GET(new Request('http://test.local/api/health'));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.checks.bootstrap).toMatchObject({
      ok: false,
      state: 'failed',
      error: 'seed crashed',
    });
    expect(mocks.fireAlert).toHaveBeenCalledOnce();
  });
});
