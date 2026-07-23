#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const REPORT_JSON = 'evidence/workflow/temporal-runtime-smoke.json';
const REPORT_MD = 'evidence/workflow/temporal-runtime-smoke.md';
const CONTRACT_PATH = 'contracts/workflow/rhautt-nexus-workflow-outbox-contract.json';
const SCRIPT_PATH = 'scripts/release/temporal-runtime-smoke.js';

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

for (const file of [RELEASE_EVIDENCE, REPORT_JSON, REPORT_MD, CONTRACT_PATH, SCRIPT_PATH, 'package.json']) {
  if (!exists(file)) fail(`missing Temporal runtime smoke file: ${file}`);
}

if (!failures.length) {
  const release = readJson(RELEASE_EVIDENCE);
  const report = readJson(REPORT_JSON);
  const packageJson = readJson('package.json');
  const script = read(SCRIPT_PATH);
  const record = release.requiredEvidence?.temporalRuntimeSmoke;

  if (packageJson.scripts?.['release:temporal-runtime:smoke'] !== 'node scripts/release/temporal-runtime-smoke.js') {
    fail('package.json release:temporal-runtime:smoke must run node scripts/release/temporal-runtime-smoke.js');
  }
  if (packageJson.scripts?.['guard:temporal-runtime-smoke'] !== 'node scripts/agent-guards/temporal-runtime-smoke-check.js') {
    fail('package.json guard:temporal-runtime-smoke must run node scripts/agent-guards/temporal-runtime-smoke-check.js');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:temporal-runtime-smoke')) {
    fail('package.json guard:all must include guard:temporal-runtime-smoke');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:temporal-runtime-smoke')) {
    fail('package.json guard:all:nonvisual must include guard:temporal-runtime-smoke');
  }

  if (!record) {
    fail('release evidence missing temporalRuntimeSmoke');
  } else {
    if (record.command !== 'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke') {
      fail('temporalRuntimeSmoke command must document TEMPORAL_ADDRESS launch gate');
    }
    if (record.path !== REPORT_JSON) fail(`temporalRuntimeSmoke path must be ${REPORT_JSON}`);
    if (record.summaryPath !== REPORT_MD) fail(`temporalRuntimeSmoke summaryPath must be ${REPORT_MD}`);
    if (record.contractPath !== CONTRACT_PATH) fail(`temporalRuntimeSmoke contractPath must be ${CONTRACT_PATH}`);
  }

  if (report.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    fail('Temporal runtime smoke report platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  if (report.contractSha256 !== fileSha256(CONTRACT_PATH)) {
    fail('Temporal runtime smoke report is stale; rerun npm run release:temporal-runtime:smoke');
  }

  const acceptedStatuses = ['missing-runtime-run', 'runtime-unreachable', 'runtime-reachable-worker-missing', 'passed-runtime-current-run'];
  if (!acceptedStatuses.includes(report.status)) {
    fail(`Temporal runtime smoke status is invalid: ${report.status}`);
  }

  if (!report.workerProof || report.workerProof.rawIdentifiersPersisted !== false) {
    fail('Temporal runtime smoke must record sanitized workerProof with rawIdentifiersPersisted false');
  }
  if (report.workerProof?.workflowIdSha256 && report.workerProof.workflowIdSha256.length !== 64) {
    fail('Temporal worker proof workflowIdSha256 must be a SHA-256 hash');
  }
  if (report.workerProof?.runIdSha256 && report.workerProof.runIdSha256.length !== 64) {
    fail('Temporal worker proof runIdSha256 must be a SHA-256 hash');
  }
  if (report.workerProof?.tenantSha256 && report.workerProof.tenantSha256.length !== 64) {
    fail('Temporal worker proof tenantSha256 must be a SHA-256 hash');
  }
  if (report.workerProof?.projectSha256 && report.workerProof.projectSha256.length !== 64) {
    fail('Temporal worker proof projectSha256 must be a SHA-256 hash');
  }

  if (report.status === 'passed-runtime-current-run') {
    if (report.finalLaunchWorkflowProof !== true || report.temporalRuntime !== true || report.workerRuntimeProof !== true) {
      fail('passed Temporal runtime smoke must prove Temporal runtime and worker runtime');
    }
    if (report.workerProof?.status !== 'passed') {
      fail('passed Temporal runtime smoke must include passed workerProof');
    }
    if (report.workerProof?.mode !== 'passed') {
      fail('passed Temporal runtime smoke workerProof mode must be passed');
    }
    if (report.workerProof?.workflowType !== 'rysnova-bim-customer-signoff-workflow') {
      fail('passed Temporal runtime smoke workerProof workflowType must be rysnova-bim-customer-signoff-workflow');
    }
    if (report.workerProof?.eventType !== 'rysnova-bim.customer_signoff.confirmed') {
      fail('passed Temporal runtime smoke workerProof eventType must prove Rysnova customer signoff confirmation');
    }
    if (report.workerProof?.taskQueue !== report.taskQueue) {
      fail('passed Temporal runtime smoke workerProof taskQueue must match report taskQueue');
    }
    if (report.workerProof?.workflowDescribe?.passed !== true) {
      fail('passed Temporal runtime smoke must prove Temporal workflow describe');
    }
    if (!report.workerProof?.tenantSha256 || !report.workerProof?.projectSha256) {
      fail('passed Temporal runtime smoke must carry hashed tenant/project scope proof');
    }
    if (record?.status !== 'passed-runtime-current-run') fail('release evidence temporalRuntimeSmoke status must match passed-runtime-current-run');
    if (record?.finalLaunchWorkflowProof !== true || record?.workerRuntimeProof !== true) {
      fail('release evidence temporalRuntimeSmoke must set finalLaunchWorkflowProof and workerRuntimeProof true only after runtime pass');
    }
  }

  if (report.status === 'missing-runtime-run') {
    if (report.finalLaunchWorkflowProof !== false || report.temporalRuntime !== false || report.workerRuntimeProof !== false) {
      fail('missing Temporal runtime smoke must not claim runtime or worker proof');
    }
    if (record?.status !== 'missing-runtime-run') fail('release evidence temporalRuntimeSmoke status must remain missing-runtime-run');
    if (record?.finalLaunchWorkflowProof !== false || record?.workerRuntimeProof !== false) {
      fail('release evidence temporalRuntimeSmoke must not claim workflow proof while missing runtime');
    }
    if (!String(report.reason || '').includes('TEMPORAL_ADDRESS') && !String(report.reason || '').includes('temporal CLI')) {
      fail('missing Temporal runtime smoke report must explain TEMPORAL_ADDRESS or temporal CLI blocker');
    }
    warnings.push(`Temporal runtime smoke is missing: ${report.reason}`);
  }

  if (report.status === 'runtime-reachable-worker-missing') {
    if (report.finalLaunchWorkflowProof !== false || report.workerRuntimeProof !== false) {
      fail('Temporal runtime reachable without worker proof must not claim final workflow proof');
    }
    warnings.push('Temporal namespace may be reachable, but worker runtime proof is still missing');
  }

  if (report.status === 'runtime-unreachable') {
    if (report.finalLaunchWorkflowProof !== false || report.workerRuntimeProof !== false || report.temporalRuntime !== false) {
      fail('unreachable Temporal runtime smoke must not claim runtime, worker, or final workflow proof');
    }
    warnings.push('Temporal CLI/address may be configured, but namespace is unreachable');
  }

  for (const token of [
    'TEMPORAL_ADDRESS',
    'temporal',
    'namespace',
    'TEMPORAL_TASK_QUEUE',
    'TEMPORAL_WORKER_PROOF',
    'TEMPORAL_WORKER_PROOF_WORKFLOW_ID',
    'TEMPORAL_WORKER_PROOF_RUN_ID',
    'TEMPORAL_WORKER_PROOF_TASK_QUEUE',
    'TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE',
    'TEMPORAL_WORKER_PROOF_EVENT_TYPE',
    'TEMPORAL_WORKER_PROOF_TENANT_ID',
    'TEMPORAL_WORKER_PROOF_PROJECT_ID',
    'workerProofIdentifiersHashed',
    'workflowExecutionDescribed',
    'workerRuntimeProof',
    'finalLaunchWorkflowProof',
    'rysnova-bim.customer_signoff.confirmed',
    'rysnovaBimCustomerSignoffConfirmedWorkerProof',
    'lifecycle_handoff_only'
  ]) {
    if (!script.includes(token)) fail(`Temporal runtime smoke script missing token: ${token}`);
  }
}

console.log(`Temporal Runtime Smoke Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
