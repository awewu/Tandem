const CacheEngine = require('../../server/core/CacheEngine');
const CalculationCache = require('../../server/core/CalculationCache');
const contract = require('../../contracts/cache/rhautt-nexus-redis-cache-boundary.json');

describe('Redis cache boundary readiness', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  test('documents Redis as cache/session/rate-limit/task-status only', () => {
    expect(contract.platform).toBe('Rhautt Nexus / 瑞合数智枢纽');
    expect(contract.status).toBe('target-boundary-not-production-redis-smoke');
    expect(contract.allowedRoles).toEqual(expect.arrayContaining([
      'session',
      'rate-limit',
      'calculation-cache',
      'task-status',
      'short-lived-lock'
    ]));
    expect(contract.forbiddenTruthSources).toEqual(expect.arrayContaining([
      'customers',
      'quotations',
      'contracts',
      'lifecycle',
      'rysnova-bim_artifacts',
      'rysnova-bim_customer_packages',
      'rysnova-bim_customer_package_ready',
      'rysnova-bim_customer_signoff',
      'rysnova-bim_customer_signoff_receipts',
      'rysnova-bim_customer_signoff_confirmed',
      'rysnova-bim_artifact_lists',
      'rysnova-bim_artifact_hashes',
      'rysnova-bim_customer_visibility',
      'audit_logs',
      'outbox_events',
      'workflow_instances',
      'file_artifacts'
    ]));
    expect(contract.degradationPolicy.iotBoundary).toContain('lifecycle handoff');
    expect(contract.rysnovaBimBoundary.allowedEphemeralRole).toBe('task-status');
    expect(contract.rysnovaBimBoundary.forbiddenBusinessTruthFields).toEqual(expect.arrayContaining([
      'artifacts',
      'artifactTypes',
      'contentHash',
      'objectKey',
      'customerVisible',
      'customerPackageReady',
      'customerPackageCount',
      'missingTypes',
      'outboxEvent',
      'workflowState',
      'artifactStatus',
      'customerSignoffReady',
      'customerSignoffConfirmed',
      'customerSignoffReceipt',
      'customerSignoffManifest',
      'signoffEvidence',
      'receiptNo',
      'signerMobileHash',
      'evidenceHash',
      'acknowledgements',
      'deepeningHandoffReady'
    ]));
    expect(contract.rysnovaBimBoundary.sourceOfTruth.packageReadiness).toContain('database transaction/outbox');
    expect(contract.rysnovaBimBoundary.sourceOfTruth.customerSignoff).toContain('transaction outbox');
  });

  test('CacheEngine builds tenant-scoped 瑞诺瓦AI舒适家 keys and degrades on Redis read failure', async () => {
    const redis = {
      async get() {
        throw new Error('redis unavailable');
      },
      async setex() {
        throw new Error('redis unavailable');
      },
      async del() {
        throw new Error('redis unavailable');
      }
    };
    const cache = new CacheEngine(redis);
    const key = cache.buildKey('catalog:water-heater', 'hot-catalog-cache', 'tenant-a');

    expect(key).toBe('rhautt:nexus:tenant:tenant-a:hot-catalog-cache:catalog:water-heater');

    await expect(cache.set('catalog:water-heater', { sku: 'RUUD-01' }, {
      namespace: 'hot-catalog-cache',
      tenantId: 'tenant-a',
      ttl: 120
    })).resolves.toBe(true);

    const miss = await cache.get('missing', {
      namespace: 'hot-catalog-cache',
      tenantId: 'tenant-a'
    });
    expect(miss).toBeNull();
  });

  test('CalculationCache keys are tenant scoped and reject unsupported business-truth systems', () => {
    const cache = Object.create(CalculationCache.prototype);

    const key = cache.generateKey('oneclick', {
      tenantId: 'tenant-a',
      area: 120,
      city: '上海'
    });

    expect(key).toMatch(/^rhautt:nexus:tenant:tenant-a:calc:oneclick:/);
    expect(() => cache.generateKey('quotations', {
      tenantId: 'tenant-a',
      quotationId: 'quote-1'
    })).toThrow('Unsupported calculation cache system');
  });

  test('Redis guard evidence rejects Rysnova customer-package and customer-signoff business truth from cache scope', () => {
    const report = require('../../evidence/cache/redis-cache-boundary-report.json');

    expect(report.summary.failures).toBe(0);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'simulation-rysnova-bim-truth-roles-rejected',
        passed: true
      }),
      expect.objectContaining({
        name: 'simulation-rysnova-bim-task-status-no-business-truth',
        passed: true
      }),
      expect.objectContaining({
        name: 'rysnova-bim-forbidden-business-field:customerSignoffReceipt',
        passed: true
      }),
      expect.objectContaining({
        name: 'rysnova-bim-forbidden-business-field:signerMobileHash',
        passed: true
      }),
      expect.objectContaining({
        name: 'rysnova-bim-forbidden-business-field:evidenceHash',
        passed: true
      }),
      expect.objectContaining({
        name: 'rysnova-bim-package-readiness-truth-source',
        passed: true
      })
    ]));
  });
});
