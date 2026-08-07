import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

const mocks = vi.hoisted(() => {
  let seedGate: Deferred;
  const resetSeedGate = () => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    seedGate = { promise, resolve, reject };
  };
  resetSeedGate();
  return {
    get seedGate() { return seedGate; },
    resetSeedGate,
  };
});

const testStore = {
  _storeKind: 'memory',
  documents: {},
  calendarSyncStates: {},
  legalDocuments: {},
  reportSummaries: {},
  auth: { users: { list: vi.fn(async () => []) } },
};

vi.mock('@/lib/storage/repository', () => ({
  setStore: (store: unknown) => { (globalThis as Record<string, unknown>).__tandem_store__ = store; },
  getStore: () => testStore,
}));
vi.mock('@/lib/storage/memory-store', () => ({ createInMemoryStore: () => testStore }));
vi.mock('@/lib/storage/drizzle-store', () => ({ createDrizzleStore: () => testStore }));
vi.mock('@/lib/infra/storage-mode', () => ({ isDatabaseMode: () => false }));
vi.mock('@/lib/infra/production-guard', () => ({ enforceProductionGuard: vi.fn() }));
vi.mock('@/lib/fixtures/seed', () => ({
  seedDevData: vi.fn(async () => undefined),
  seedLaunchpadIfEmpty: vi.fn(() => mocks.seedGate.promise),
  seedExtraModulesIfEmpty: vi.fn(async () => undefined),
  seedKpiDemoIfEmpty: vi.fn(async () => undefined),
}));
vi.mock('@/lib/fixtures/seed-showcase', () => ({ seedShowcaseIfEmpty: vi.fn(async () => undefined) }));
vi.mock('@/lib/taf/skills', () => ({ registerBuiltinSkills: vi.fn() }));
vi.mock('@/lib/workflows/builtin-triggers', () => ({ registerBuiltinTriggers: vi.fn() }));
vi.mock('@/lib/infra/observability', () => ({ initObservability: vi.fn(async () => undefined) }));
vi.mock('@/lib/auth/bootstrap', () => ({ bootstrapOwnerIfMissing: vi.fn(async () => undefined) }));
vi.mock('@/lib/infra/leader', () => ({ withCronLock: vi.fn(async () => undefined) }));
vi.mock('@/lib/kpi/erp-adapter', () => ({ registerErpAdapter: vi.fn() }));
vi.mock('@/lib/kpi/erp-adapters/yonyou-kpi-adapter', () => ({
  createYonyouKpiErpAdapterIfConfigured: () => null,
}));

const router = {
  listProviders: () => [],
  unregisterProvider: vi.fn(),
  registerProvider: vi.fn(),
  promoteToPrimary: vi.fn(),
  getPrimaryOverride: () => null,
};
vi.mock('@/lib/taf', () => ({
  TandemRouter: class {},
  createDefaultRouter: () => router,
  createLocalDevRouter: () => router,
  OpenAICompatibleProvider: class {},
  PROVIDER_CONFIGS: {},
  GATEWAY_PROVIDER_NAME: 'gateway',
  buildGatewayConfig: () => null,
}));
vi.mock('@/lib/convergence/orchestrator', () => ({
  ConvergenceOrchestrator: class { checkStalls = vi.fn(async () => undefined); },
}));

vi.mock('@/lib/persona/company-brain', () => ({
  seedCompanyBrainIfMissing: vi.fn(async () => ({ created: false })),
}));
vi.mock('@/lib/settings/ai-settings', () => ({ getAiSettings: vi.fn(async () => ({})) }));
vi.mock('@/lib/settings/mcp-servers', () => ({ syncMcpServersToRegistry: vi.fn(async () => undefined) }));
vi.mock('@/lib/infra/s3-client', () => ({
  ensureBucket: vi.fn(async () => undefined),
  BUCKET_DRIVE: 'drive',
  getS3: () => null,
}));
vi.mock('@/lib/drive/provision', () => ({
  provisionOrgDrive: vi.fn(async () => ({ created: [] })),
}));
vi.mock('@/lib/org/departments', () => ({ listDepts: vi.fn(async () => []) }));
vi.mock('@/lib/repositories/app-context-factory', () => ({
  createAppContext: () => ({ driveRepo: {} }),
}));
vi.mock('@/lib/events/subscribers', () => ({ registerCrossDomainSubscribers: vi.fn() }));

const bootGlobals = [
  '__tandem_booted__',
  '__tandem_seed_promise__',
  '__tandem_boot_readiness__',
  '__tandem_router__',
  '__tandem_orchestrator__',
  '__tandem_store__',
  '__tandem_tick_interval__',
  '__tandem_retro_interval__',
  '__tandem_reminder_interval__',
] as const;

function resetBootGlobals(): void {
  const globals = globalThis as Record<string, unknown>;
  for (const key of ['__tandem_tick_interval__', '__tandem_retro_interval__', '__tandem_reminder_interval__']) {
    const timer = globals[key] as ReturnType<typeof setInterval> | undefined;
    if (timer) clearInterval(timer);
  }
  for (const key of bootGlobals) delete globals[key];
}

describe('boot readiness', () => {
  beforeEach(() => {
    resetBootGlobals();
    mocks.resetSeedGate();
    vi.resetModules();
  });

  afterEach(() => {
    resetBootGlobals();
    vi.unstubAllEnvs();
  });

  it('does not make production requests wait for the initialization chain', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { boot, getBootReadiness, waitForBootReady } = await import('@/lib/boot');

    await boot();
    expect(getBootReadiness().state).toBe('initializing');

    mocks.seedGate.resolve();
    await waitForBootReady();
    expect(getBootReadiness().state).toBe('ready');
  });

  it('keeps development boot blocking until initialization is ready', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { boot, getBootReadiness } = await import('@/lib/boot');

    let settled = false;
    const pendingBoot = boot().then(() => { settled = true; });
    await Promise.resolve();

    expect(settled).toBe(false);
    expect(getBootReadiness().state).toBe('initializing');

    mocks.seedGate.resolve();
    await pendingBoot;
    expect(getBootReadiness().state).toBe('ready');
  });

  it('reports optional initializer failures as readiness warnings', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { boot, getBootReadiness, waitForBootReady } = await import('@/lib/boot');

    await boot();
    mocks.seedGate.reject(new Error('launchpad unavailable'));
    await waitForBootReady();

    expect(getBootReadiness()).toMatchObject({
      state: 'ready',
      warnings: ['launchpad seed: launchpad unavailable'],
    });
  });
});
