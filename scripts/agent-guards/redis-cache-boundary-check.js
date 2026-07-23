#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = 'contracts/cache/rhautt-nexus-redis-cache-boundary.json';
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const REPORT_JSON = 'evidence/cache/redis-cache-boundary-report.json';
const REPORT_MD = 'evidence/cache/redis-cache-boundary-report.md';

const failures = [];
const warnings = [];

function fullPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(fullPath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function writeJson(relativePath, data) {
  fs.mkdirSync(path.dirname(fullPath(relativePath)), { recursive: true });
  fs.writeFileSync(fullPath(relativePath), `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(relativePath, text) {
  fs.mkdirSync(path.dirname(fullPath(relativePath)), { recursive: true });
  fs.writeFileSync(fullPath(relativePath), text);
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(read(relativePath)).digest('hex');
}

function record(report, name, passed, details) {
  report.checks.push({ name, passed, details });
  if (!passed) failures.push(details || name);
}

function updateReleaseEvidence(patch) {
  const evidence = readJson(RELEASE_EVIDENCE);
  evidence.updatedAt = new Date().toISOString().slice(0, 10);
  evidence.requiredEvidence = evidence.requiredEvidence || {};
  evidence.requiredEvidence.redisCacheBoundary = {
    ...(evidence.requiredEvidence.redisCacheBoundary || {}),
    ...patch
  };
  writeJson(RELEASE_EVIDENCE, evidence);
}

function createBoundaryCache({ redisAvailable = true } = {}) {
  const store = new Map();
  const allowedRoles = new Set([
    'session',
    'rate-limit',
    'hot-catalog-cache',
    'calculation-cache',
    'task-status',
    'short-lived-lock'
  ]);
  const forbiddenTruthSources = new Set([
    'customers',
    'crm_leads',
    'opportunities',
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
    'file_artifacts',
    'tenant_memberships',
    'permissions'
  ]);
  const rysnovaBimForbiddenBusinessTruthFields = new Set([
    'artifactList',
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
  ]);

  function containsRysnovaBusinessTruth(value) {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(item => containsRysnovaBusinessTruth(item));
    return Object.entries(value).some(([key, nested]) => (
      rysnovaBimForbiddenBusinessTruthFields.has(key) || containsRysnovaBusinessTruth(nested)
    ));
  }

  function keyFor({ tenantId, role, key }) {
    if (!tenantId) throw new Error('tenantId is required for Redis cache key');
    if (!allowedRoles.has(role)) throw new Error(`Redis role is not allowed: ${role}`);
    return `rhautt:nexus:tenant:${tenantId}:${role}:${key}`;
  }

  function set({ tenantId, role, key, value, ttlSeconds }) {
    if (forbiddenTruthSources.has(role)) {
      throw new Error(`Redis cannot be source of truth for ${role}`);
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error(`TTL is required for Redis role ${role}`);
    }
    if (role === 'task-status' && String(key || '').includes('rysnova-bim') && containsRysnovaBusinessTruth(value)) {
      throw new Error('Redis task-status cannot store Rysnova customer package or artifact business truth');
    }
    if (!redisAvailable) return { stored: false, degraded: true };
    const fullKey = keyFor({ tenantId, role, key });
    store.set(fullKey, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
    return { stored: true, key: fullKey };
  }

  function get({ tenantId, role, key }) {
    if (!redisAvailable) return { hit: false, degraded: true, fallbackRequired: true };
    const fullKey = keyFor({ tenantId, role, key });
    const item = store.get(fullKey);
    if (!item) return { hit: false, fallbackRequired: true };
    if (Date.now() > item.expiresAt) {
      store.delete(fullKey);
      return { hit: false, fallbackRequired: true };
    }
    return { hit: true, key: fullKey, value: item.value };
  }

  return { get, set, store };
}

function renderMarkdown(report) {
  const lines = [
    '# Redis Cache Boundary Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status}`,
    `Final launch Redis proof: ${report.finalLaunchRedisProof ? 'yes' : 'no'}`,
    '',
    '| Check | Result | Details |',
    '|---|---|---|'
  ];

  for (const check of report.checks) {
    lines.push(`| ${check.name} | ${check.passed ? 'pass' : 'fail'} | ${String(check.details || '').replace(/\n/g, ' ')} |`);
  }

  lines.push('');
  lines.push('Boundary: Redis is allowed for cache/session/rate-limit/task-status/short-lived-lock only. It is not a business truth source and this local report is not a staging Redis smoke proof.');
  lines.push('');
  return lines.join('\n');
}

const report = {
  platform: 'Rhautt Nexus / 瑞合数智枢纽',
  generatedAt: new Date().toISOString(),
  status: 'target-cache-boundary-simulated-not-staging-redis',
  contractPath: CONTRACT_PATH,
  finalLaunchRedisProof: false,
  checks: [],
  warnings
};

if (!exists(CONTRACT_PATH)) failures.push(`missing ${CONTRACT_PATH}`);
if (!exists(RELEASE_EVIDENCE)) failures.push(`missing ${RELEASE_EVIDENCE}`);
if (!exists('package.json')) failures.push('missing package.json');

if (!failures.length) {
  const contract = readJson(CONTRACT_PATH);
  const packageJson = readJson('package.json');
  const cacheEngine = exists('server/core/CacheEngine.js') ? read('server/core/CacheEngine.js') : '';
  const calculationCache = exists('server/core/CalculationCache.js') ? read('server/core/CalculationCache.js') : '';
  const productionMiddleware = exists('server/modules/productionMiddleware.js') ? read('server/modules/productionMiddleware.js') : '';
  const healthService = exists('server/modules/health/health.service.js') ? read('server/modules/health/health.service.js') : '';
  const architectureContract = exists('contracts/architecture/rhautt-nexus-target-architecture.json')
    ? readJson('contracts/architecture/rhautt-nexus-target-architecture.json')
    : null;

  record(report, 'contract-platform', contract.platform === report.platform, 'contract platform must be Rhautt Nexus / 瑞合数智枢纽');
  record(report, 'contract-status-boundary-only', contract.status === 'target-boundary-not-production-redis-smoke', 'Redis contract must not claim production smoke');
  record(report, 'redis-dependency-present', Boolean(packageJson.dependencies?.redis), 'package.json must list redis dependency');
  record(report, 'express-rate-limit-present', Boolean(packageJson.dependencies?.['express-rate-limit']), 'package.json must list express-rate-limit dependency for current compatibility rate limit');

  for (const role of ['session', 'rate-limit', 'hot-catalog-cache', 'calculation-cache', 'task-status', 'short-lived-lock']) {
    record(report, `allowed-role:${role}`, contract.allowedRoles?.includes(role), `contract missing allowed role: ${role}`);
  }

  for (const truth of [
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
  ]) {
    record(report, `forbidden-truth-source:${truth}`, contract.forbiddenTruthSources?.includes(truth), `contract must forbid Redis truth source: ${truth}`);
  }

  record(report, 'rysnova-bim-boundary-ephemeral-only', contract.rysnovaBimBoundary?.allowedEphemeralRole === 'task-status', 'Rysnova Redis boundary must allow task-status only');
  for (const field of [
    'artifactList',
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
  ]) {
    record(
      report,
      `rysnova-bim-forbidden-business-field:${field}`,
      contract.rysnovaBimBoundary?.forbiddenBusinessTruthFields?.includes(field),
      `Rysnova Redis boundary must forbid business truth field: ${field}`
    );
  }
  record(
    report,
    'rysnova-bim-package-readiness-truth-source',
    String(contract.rysnovaBimBoundary?.sourceOfTruth?.packageReadiness || '').includes('database transaction/outbox'),
    'Rysnova package readiness truth source must be artifact service + database transaction/outbox'
  );

  record(report, 'key-prefix-policy', contract.keyPolicy?.prefix === 'rhautt:nexus:', 'Redis key prefix must be rhautt:nexus:');
  record(report, 'tenant-key-policy', String(contract.keyPolicy?.tenantScopedPattern || '').includes('tenant:<tenantId>'), 'Redis key policy must require tenant scope');
  record(report, 'ttl-required-policy', (contract.keyPolicy?.ttlRequiredFor || []).length >= 6, 'Redis key policy must require TTL for all allowed roles');
  record(report, 'redis-unavailable-degrades', String(contract.degradationPolicy?.redisUnavailable || '').includes('Business truth writes must continue'), 'Redis unavailable policy must preserve business truth writes');
  record(report, 'iot-handoff-only-policy', String(contract.degradationPolicy?.iotBoundary || '').includes('lifecycle handoff'), 'Redis IoT policy must allow lifecycle handoff only');

  record(report, 'architecture-contract-redis-boundary', architectureContract?.dataAndWorkflow?.redis?.role === 'cache, session, rate-limit, short-lived job state', 'target architecture must keep Redis as cache/session/rate-limit/job state');
  record(report, 'cache-engine-prefix-updated', cacheEngine.includes("prefix: 'rhautt:nexus:'"), 'CacheEngine must use rhautt:nexus prefix');
  record(report, 'cache-engine-tenant-key', cacheEngine.includes('tenant:${safeTenantId}') && cacheEngine.includes('tenantId'), 'CacheEngine must build tenant-scoped keys');
  record(report, 'cache-engine-ttl', cacheEngine.includes('defaultTTL') && cacheEngine.includes('setex'), 'CacheEngine must set Redis TTL');
  record(report, 'cache-engine-redis-error-miss', cacheEngine.includes('Redis get error') && cacheEngine.includes('return null'), 'CacheEngine Redis errors must degrade to miss');
  record(report, 'cache-engine-timer-unref', cacheEngine.includes('timer.unref'), 'CacheEngine cleanup timer must not keep tests/process alive');

  record(report, 'calculation-cache-official-redis', calculationCache.includes("require('redis')") && calculationCache.includes('createClient'), 'CalculationCache must use the installed redis package');
  record(report, 'calculation-cache-configured-only', calculationCache.includes('REDIS_ENABLED') && calculationCache.includes('Redis未配置'), 'CalculationCache must only connect when Redis is configured');
  record(report, 'calculation-cache-tenant-key', calculationCache.includes('rhautt:nexus:tenant:${tenantId}:calc'), 'CalculationCache keys must be tenant scoped');
  record(report, 'calculation-cache-allowed-systems', calculationCache.includes('ALLOWED_SYSTEMS') && calculationCache.includes('Unsupported calculation cache system'), 'CalculationCache must restrict cache systems');
  record(report, 'calculation-cache-ttl', calculationCache.includes('setEx') || calculationCache.includes('setex'), 'CalculationCache must set TTL for Redis writes');
  record(report, 'calculation-cache-redis-error-miss', calculationCache.includes('Redis读取失败') && calculationCache.includes('hit: false'), 'CalculationCache Redis errors must degrade to miss');

  record(report, 'rate-limit-present', productionMiddleware.includes("app.use('/api', rateLimit") && productionMiddleware.includes("app.use(['/api/login'"), 'production middleware must keep API and auth rate limits');
  record(report, 'rate-limit-ttl-window', productionMiddleware.includes('RATE_LIMIT_WINDOW_MS') && productionMiddleware.includes('rateLimitWindowMs'), 'rate limits must have an explicit window/TTL');
  record(report, 'health-redis-optional', healthService.includes("redis: process.env.REDIS_URL ? 'configured' : 'not_configured'"), 'health service must keep Redis optional unless configured');

  const boundaryCache = createBoundaryCache({ redisAvailable: true });
  const stored = boundaryCache.set({
    tenantId: 'tenant-a',
    role: 'task-status',
    key: 'rysnova-bim-export-1',
    value: { status: 'running', boundary: 'lifecycle_handoff_only' },
    ttlSeconds: 600
  });
  const hit = boundaryCache.get({
    tenantId: 'tenant-a',
    role: 'task-status',
    key: 'rysnova-bim-export-1'
  });
  const crossTenantMiss = boundaryCache.get({
    tenantId: 'tenant-b',
    role: 'task-status',
    key: 'rysnova-bim-export-1'
  });
  const degradedCache = createBoundaryCache({ redisAvailable: false });
  const degradedSet = degradedCache.set({
    tenantId: 'tenant-a',
    role: 'calculation-cache',
    key: 'oneclick:abc',
    value: { total: 100 },
    ttlSeconds: 300
  });
  const degradedGet = degradedCache.get({
    tenantId: 'tenant-a',
    role: 'calculation-cache',
    key: 'oneclick:abc'
  });

  let missingTtlRejected = false;
  try {
    boundaryCache.set({ tenantId: 'tenant-a', role: 'session', key: 'user-1', value: { userId: 'user-1' } });
  } catch (error) {
    missingTtlRejected = error.message.includes('TTL is required');
  }

  let truthSourceRejected = false;
  try {
    boundaryCache.set({ tenantId: 'tenant-a', role: 'quotations', key: 'quote-1', value: { status: 'approved' }, ttlSeconds: 300 });
  } catch (error) {
    truthSourceRejected = error.message.includes('not allowed') || error.message.includes('source of truth');
  }

  const rejectedRysnovaTruthRoles = [];
  for (const role of [
    'rysnova-bim_customer_packages',
    'rysnova-bim_customer_package_ready',
    'rysnova-bim_customer_signoff',
    'rysnova-bim_customer_signoff_receipts',
    'rysnova-bim_customer_signoff_confirmed',
    'rysnova-bim_artifact_lists',
    'rysnova-bim_artifact_hashes',
    'rysnova-bim_customer_visibility'
  ]) {
    try {
      boundaryCache.set({
        tenantId: 'tenant-a',
        role,
        key: 'capacity-rysnova-bim-project-23',
        value: {
          artifacts: ['principle-diagram', 'construction-drawing'],
          contentHash: 'sha256:forbidden',
          customerVisible: true,
          customerPackageReady: true,
          customerSignoffConfirmed: true,
          receiptNo: 'LITH-SIGNOFF-FORBIDDEN',
          signerMobileHash: 'sha256:forbidden',
          evidenceHash: 'sha256:forbidden',
          outboxEvent: 'rysnova-bim.customer_signoff.confirmed'
        },
        ttlSeconds: 300
      });
    } catch (error) {
      if (error.message.includes('source of truth')) rejectedRysnovaTruthRoles.push(role);
    }
  }

  let allowedRysnovaTaskStatusHasBusinessTruth = false;
  try {
    boundaryCache.set({
      tenantId: 'tenant-a',
      role: 'task-status',
      key: 'rysnova-bim-customer-package-ready',
      value: {
        customerPackageReady: true,
        customerSignoffConfirmed: true,
        customerSignoffReceipt: {
          receiptNo: 'LITH-SIGNOFF-FORBIDDEN',
          signerMobileHash: 'sha256:forbidden',
          evidenceHash: 'sha256:forbidden'
        },
        acknowledgements: ['forbidden'],
        artifactTypes: ['principle-diagram'],
        contentHash: 'sha256:forbidden'
      },
      ttlSeconds: 600
    });
    const businessTruthHit = boundaryCache.get({
      tenantId: 'tenant-a',
      role: 'task-status',
      key: 'rysnova-bim-customer-package-ready'
    });
    allowedRysnovaTaskStatusHasBusinessTruth = Boolean(
      businessTruthHit.value?.customerPackageReady ||
      businessTruthHit.value?.customerSignoffConfirmed ||
      businessTruthHit.value?.customerSignoffReceipt ||
      businessTruthHit.value?.acknowledgements ||
      businessTruthHit.value?.artifactTypes ||
      businessTruthHit.value?.contentHash
    );
  } catch {
    allowedRysnovaTaskStatusHasBusinessTruth = false;
  }

  const handoffOnly = hit.value?.boundary === 'lifecycle_handoff_only' &&
    !Object.prototype.hasOwnProperty.call(hit.value || {}, 'controlCommand');

  record(report, 'simulation-tenant-key-prefix', stored.key === 'rhautt:nexus:tenant:tenant-a:task-status:rysnova-bim-export-1', 'simulation must create tenant-scoped 瑞诺瓦AI舒适家 key');
  record(report, 'simulation-tenant-isolation', hit.hit === true && crossTenantMiss.hit === false, 'tenant-b must not read tenant-a cache key');
  record(report, 'simulation-missing-ttl-rejected', missingTtlRejected, 'Redis cache writes without TTL must be rejected');
  record(report, 'simulation-truth-source-rejected', truthSourceRejected, 'Redis must reject business truth source roles such as quotations');
  record(
    report,
    'simulation-rysnova-bim-truth-roles-rejected',
    rejectedRysnovaTruthRoles.length === 8,
    'Redis must reject Rysnova customer package, customer signoff, signoff receipt, artifact list/hash, ready-state, and visibility truth roles'
  );
  record(
    report,
    'simulation-rysnova-bim-task-status-no-business-truth',
    allowedRysnovaTaskStatusHasBusinessTruth === false,
    'Rysnova task-status cache must not contain customer package ready state, customer signoff receipt/confirmation, artifact types, or content hashes'
  );
  record(report, 'simulation-redis-down-degrades', degradedSet.degraded === true && degradedGet.fallbackRequired === true, 'Redis unavailable must degrade to fallback/miss');
  record(report, 'simulation-lifecycle-handoff-only', handoffOnly, 'task-status cache must keep lifecycle_handoff_only and no controlCommand');

  const evidence = readJson(RELEASE_EVIDENCE);
  const existingRecord = evidence.requiredEvidence?.redisCacheBoundary;
  if (existingRecord) {
    record(report, 'release-evidence-key-existing-or-generated', true, 'release evidence has redisCacheBoundary');
  } else {
    warnings.push('redisCacheBoundary release evidence will be created by this guard run');
  }

  report.summary = {
    checks: report.checks.length,
    failures: report.checks.filter(check => !check.passed).length,
    warnings: warnings.length,
    allowedRoles: contract.allowedRoles?.length || 0,
    forbiddenTruthSources: contract.forbiddenTruthSources?.length || 0,
    finalLaunchRedisProof: false
  };
}

report.summary = report.summary || {
  checks: report.checks.length,
  failures: failures.length,
  warnings: warnings.length,
  finalLaunchRedisProof: false
};

writeJson(REPORT_JSON, report);
writeText(REPORT_MD, renderMarkdown(report));

if (!failures.length) {
  updateReleaseEvidence({
    command: 'npm run guard:redis-cache-boundary',
    status: 'target-cache-boundary-simulated',
    path: REPORT_JSON,
    summaryPath: REPORT_MD,
    contractPath: CONTRACT_PATH,
    capabilities: [
      'cache-session-rate-limit-task-status-only',
      'tenant-scoped-keys',
      'ttl-required',
      'redis-unavailable-safe-degrade',
      'not-business-truth-source',
      'rysnova-bim-ephemeral-task-status-only',
      'rysnova-bim-customer-package-not-redis-truth',
      'rysnova-bim-customer-signoff-not-redis-truth',
      'lifecycle_handoff_only'
    ],
    finalLaunchRedisProof: false,
    note: 'Local deterministic Redis boundary simulation. This is not staging Redis HA/TLS/ACL or Redis-backed session/rate-limit production smoke proof.'
  });
}

console.log(`Redis Cache Boundary Check: failures = ${failures.length}, warnings = ${warnings.length}`);
console.log(`Report: ${REPORT_JSON}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
