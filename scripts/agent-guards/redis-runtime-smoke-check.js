#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_JSON = 'evidence/cache/redis-runtime-smoke.json';
const REPORT_MD = 'evidence/cache/redis-runtime-smoke.md';
const CONTRACT_PATH = 'contracts/cache/rhautt-nexus-redis-cache-boundary.json';
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const COMMAND = 'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke';

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

function fileSha256(relativePath) {
  return crypto.createHash('sha256').update(read(relativePath)).digest('hex');
}

function fail(message) {
  failures.push(message);
}

function check(condition, message) {
  if (!condition) fail(message);
}

if (!exists(REPORT_JSON)) fail(`missing Redis runtime smoke report: ${REPORT_JSON}`);
if (!exists(REPORT_MD)) fail(`missing Redis runtime smoke summary: ${REPORT_MD}`);
if (!exists(CONTRACT_PATH)) fail(`missing Redis cache boundary contract: ${CONTRACT_PATH}`);
if (!exists(RELEASE_EVIDENCE)) fail(`missing release evidence: ${RELEASE_EVIDENCE}`);

if (!failures.length) {
  const report = readJson(REPORT_JSON);
  const reportText = JSON.stringify(report);
  const evidence = readJson(RELEASE_EVIDENCE);
  const releaseRecord = evidence.requiredEvidence?.redisRuntimeSmoke;

  check(report.platform === 'Rhautt Nexus / 瑞合数智枢纽', 'Redis runtime smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
  check(report.command === COMMAND, `Redis runtime smoke command must be ${COMMAND}`);
  check(report.contractPath === CONTRACT_PATH, 'Redis runtime smoke must point to the Redis boundary contract');
  check(report.contractSha256 === fileSha256(CONTRACT_PATH), 'Redis runtime smoke contract hash is stale; rerun npm run release:redis-runtime:smoke');
  check(!reportText.includes('redis://') && !reportText.includes('rediss://'), 'Redis runtime smoke report must not leak raw Redis URLs');
  check(!Object.prototype.hasOwnProperty.call(report, 'redisUrl'), 'Redis runtime smoke report must not store redisUrl');

  check(Boolean(releaseRecord), 'release evidence missing redisRuntimeSmoke');
  if (releaseRecord) {
    check(releaseRecord.command === COMMAND, `redisRuntimeSmoke release command must be ${COMMAND}`);
    check(releaseRecord.path === REPORT_JSON, `redisRuntimeSmoke path must be ${REPORT_JSON}`);
    check(releaseRecord.summaryPath === REPORT_MD, `redisRuntimeSmoke summaryPath must be ${REPORT_MD}`);
    check(releaseRecord.contractPath === CONTRACT_PATH, `redisRuntimeSmoke contractPath must be ${CONTRACT_PATH}`);
    check(releaseRecord.status === report.status, 'redisRuntimeSmoke release status must match report status');
    check(releaseRecord.finalLaunchRedisProof === (report.finalLaunchRedisProof === true), 'redisRuntimeSmoke finalLaunchRedisProof must match report');
  }

  for (const capability of [
    'redisUrlConfigured',
    'redisClientAvailable',
    'connectAndPing',
    'tenantScopedKeys',
    'ttlProof',
    'crossTenantMiss',
    'tlsAclSecretConfigurationObserved',
    'redisUnavailableDegradationDrillRequired',
    'notBusinessTruthSource',
    'rysnovaBimCustomerSignoffNotRedisTruth',
    'lifecycle_handoff_only'
  ]) {
    check(releaseRecord?.capabilities?.includes(capability), `redisRuntimeSmoke missing capability: ${capability}`);
  }

  const allowedStatuses = [
    'missing-runtime-run',
    'runtime-reachable-security-missing',
    'passed-runtime-current-run',
    'failed-runtime-current-run'
  ];
  check(allowedStatuses.includes(report.status), `Redis runtime smoke has unsupported status: ${report.status}`);
  if (report.status === 'failed-runtime-current-run') {
    fail('Redis runtime smoke failed against a configured Redis endpoint; fix runtime smoke failures before continuing');
  }

  if (report.status === 'missing-runtime-run') {
    check(report.finalLaunchRedisProof === false, 'missing Redis runtime smoke must not claim finalLaunchRedisProof');
    check(report.redisRuntime === false, 'missing Redis runtime smoke must not claim redisRuntime');
    check(String(report.reason || '').includes('REDIS_STAGING_URL') || String(report.reason || '').includes('redis package'), 'missing Redis runtime smoke must explain REDIS_STAGING_URL/REDIS_URL/REDIS_HOST or redis package blocker');
    warnings.push(`Redis runtime smoke is missing: ${report.reason}`);
  }

  if (report.status === 'runtime-reachable-security-missing') {
    check(report.redisRuntime === true, 'runtime-reachable-security-missing must prove Redis runtime behavior');
    check(report.finalLaunchRedisProof === false, 'runtime-reachable-security-missing must not claim finalLaunchRedisProof');
    warnings.push('Redis runtime behavior passed, but TLS/ACL/secret posture or degradation drill proof is missing');
  }

  if (report.status === 'passed-runtime-current-run') {
    check(report.redisRuntime === true, 'passed Redis runtime smoke must prove Redis runtime');
    check(report.tlsObserved === true, 'passed Redis runtime smoke must prove TLS/rediss configuration');
    check(report.aclSecretObserved === true, 'passed Redis runtime smoke must prove ACL/secret configuration');
    check(report.degradationDrillProof === true, 'passed Redis runtime smoke must prove degradation drill');
    check(report.finalLaunchRedisProof === true, 'passed Redis runtime smoke must set finalLaunchRedisProof true');
  } else {
    check(report.finalLaunchRedisProof === false, 'incomplete Redis runtime smoke must not claim finalLaunchRedisProof');
  }

  const checkMap = new Map((report.checks || []).map(item => [item.name, item]));
  if (report.status !== 'missing-runtime-run') {
    for (const requiredCheck of [
      'connect-and-ping',
      'tenant-scoped-key-prefix',
      'tenant-a-cache-hit',
      'cross-tenant-cache-miss',
      'ttl-proof',
      'lifecycle-handoff-only-boundary',
      'no-business-truth-source-key-written',
      'rysnova-bim-task-status-payload-no-business-truth',
      'rysnova-bim-signoff-business-truth-detected-before-write',
      'tls-observed',
      'acl-secret-observed',
      'redis-unavailable-degradation-drill-proof'
    ]) {
      check(checkMap.has(requiredCheck), `Redis runtime smoke missing check: ${requiredCheck}`);
    }
    for (const requiredBehaviorCheck of [
      'connect-and-ping',
      'tenant-scoped-key-prefix',
      'tenant-a-cache-hit',
      'cross-tenant-cache-miss',
      'ttl-proof',
      'lifecycle-handoff-only-boundary',
      'no-business-truth-source-key-written',
      'rysnova-bim-task-status-payload-no-business-truth',
      'rysnova-bim-signoff-business-truth-detected-before-write'
    ]) {
      check(checkMap.get(requiredBehaviorCheck)?.passed === true, `Redis runtime behavior check must pass: ${requiredBehaviorCheck}`);
    }
  }

  if (exists('package.json')) {
    const packageJson = readJson('package.json');
    check(packageJson.scripts?.['release:redis-runtime:smoke'] === 'node scripts/release/redis-runtime-smoke.js', 'package.json release:redis-runtime:smoke must run Redis runtime smoke');
    check(packageJson.scripts?.['guard:redis-runtime-smoke'] === 'node scripts/agent-guards/redis-runtime-smoke-check.js', 'package.json guard:redis-runtime-smoke must run Redis runtime smoke check');
    check(packageJson.scripts?.['guard:all']?.includes('guard:redis-runtime-smoke'), 'package.json guard:all must include guard:redis-runtime-smoke');
    check(packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:redis-runtime-smoke'), 'package.json guard:all:nonvisual must include guard:redis-runtime-smoke');
  }
}

console.log(`Redis Runtime Smoke Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
