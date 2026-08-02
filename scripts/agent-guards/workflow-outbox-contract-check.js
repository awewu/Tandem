#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = 'contracts/workflow/rhautt-nexus-workflow-outbox-contract.json';
const DOC_PATH = 'docs/_archive/RHAUTT-NEXUS-WORKFLOW-OUTBOX-CONTRACT.md';
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const REPORT_JSON = 'evidence/workflow/workflow-outbox-contract-report.json';
const REPORT_MD = 'evidence/workflow/workflow-outbox-contract-report.md';
const REPLAY_SMOKE_JSON = 'evidence/workflow/workflow-replay-smoke.json';
const REPLAY_SMOKE_MD = 'evidence/workflow/workflow-replay-smoke.md';

const REQUIRED_WORKFLOWS = [
  'quote-approval-workflow',
  'contract-signing-workflow',
  'construction-delivery-workflow',
  'iot-handoff-workflow',
  'service-plan-workflow'
];

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

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function check(report, name, passed, details) {
  report.checks.push({ name, passed, details });
  if (!passed) failures.push(details || name);
}

function sourceIncludes(sourcePath, token) {
  return exists(sourcePath) && read(sourcePath).includes(token);
}

function inspect() {
  for (const file of [CONTRACT_PATH, DOC_PATH, RELEASE_EVIDENCE]) {
    if (!exists(file)) failures.push(`missing workflow/outbox file: ${file}`);
  }
  if (failures.length) return null;

  const contract = readJson(CONTRACT_PATH);
  const doc = read(DOC_PATH);
  const release = readJson(RELEASE_EVIDENCE);
  const contractSource = read(CONTRACT_PATH);
  const workflows = contract.workflows || [];
  const report = {
    generatedAt: new Date().toISOString(),
    platform: contract.platform,
    status: contract.status,
    contractPath: CONTRACT_PATH,
    contractSha256: sha256(contractSource),
    summary: {
      workflows: workflows.length,
      outboxEvents: workflows.reduce((sum, workflow) => sum + (workflow.requiredOutboxEvents || []).length, 0),
      auditActions: workflows.reduce((sum, workflow) => sum + (workflow.requiredAuditActions || []).length, 0),
      failures: 0,
      warnings: 0
    },
    checks: []
  };

  check(report, 'platform-name', contract.platform === 'Rhautt Nexus / 瑞合数智枢纽', 'workflow contract platform must be Rhautt Nexus / 瑞合数智枢纽');
  check(report, 'target-status', contract.status === 'target-contract-not-production-runtime', 'workflow contract must remain target-contract-not-production-runtime until Temporal worker proof exists');
  check(report, 'runtime-truth', String(contract.runtimeTruth || '').includes('no production Temporal worker'), 'workflow contract must state no production Temporal worker proof yet');
  check(report, 'iot-boundary', JSON.stringify(contract).includes('lifecycle_handoff_only'), 'workflow contract must preserve lifecycle_handoff_only boundary');

  const workflowIds = new Set(workflows.map(workflow => workflow.id));
  for (const id of REQUIRED_WORKFLOWS) {
    check(report, `workflow:${id}`, workflowIds.has(id), `missing required workflow: ${id}`);
  }

  for (const workflow of workflows) {
    check(report, `workflow-owner:${workflow.id}`, Boolean(workflow.owner), `${workflow.id}: missing owner`);
    check(report, `workflow-trigger:${workflow.id}`, Boolean(workflow.trigger), `${workflow.id}: missing trigger`);
    check(report, `workflow-aggregate:${workflow.id}`, Boolean(workflow.aggregateType && workflow.aggregateIdField), `${workflow.id}: missing aggregate identity`);
    check(report, `workflow-idempotency:${workflow.id}`, String(workflow.idempotencyKey || '').includes('tenantId'), `${workflow.id}: idempotencyKey must include tenantId`);
    check(report, `workflow-events:${workflow.id}`, (workflow.requiredOutboxEvents || []).length >= 3, `${workflow.id}: must declare at least 3 outbox events`);
    check(report, `workflow-audit:${workflow.id}`, (workflow.requiredAuditActions || []).length >= 2, `${workflow.id}: must declare at least 2 audit actions`);
    check(report, `workflow-steps:${workflow.id}`, (workflow.steps || []).includes('emit-outbox') && (workflow.steps || []).includes('write-audit'), `${workflow.id}: steps must include write-audit and emit-outbox`);
    check(report, `workflow-retry:${workflow.id}`, Boolean(workflow.retryPolicy?.maxAttempts && workflow.retryPolicy?.timeout), `${workflow.id}: missing retry policy`);
    check(report, `workflow-compensation:${workflow.id}`, (workflow.compensation || []).length >= 1, `${workflow.id}: missing compensation action`);
  }

  const invariants = contract.requiredInvariants || {};
  for (const key of ['tenantScope', 'idempotency', 'transaction', 'audit', 'deadLetter', 'iotBoundary']) {
    check(report, `invariant:${key}`, Boolean(invariants[key]), `workflow contract missing invariant: ${key}`);
  }

  for (const token of [
    'quote-approval-workflow',
    'contract-signing-workflow',
    'construction-delivery-workflow',
    'iot-handoff-workflow',
    'service-plan-workflow',
    'target contract',
    'not production runtime'
  ]) {
    check(report, `doc-token:${token}`, doc.includes(token), `workflow doc missing token: ${token}`);
  }

  const probes = contract.sourceProbes || {};
  const sqlPath = probes.postgresMigration;
  const sql = exists(sqlPath) ? read(sqlPath) : '';
  for (const token of [
    'outbox_events',
    'workflow_instances',
    'workflow_steps',
    'idempotency_key',
    'dead_letter',
    'temporal_workflow_id',
    'aggregate_type',
    'aggregate_id'
  ]) {
    check(report, `postgres-token:${token}`, sql.includes(token), `PostgreSQL target migration missing workflow/outbox token: ${token}`);
  }

  for (const [sourceKey, tokens] of Object.entries({
    quotationService: ['persistFromBOM', 'marginGuard', 'lifecycleHandoff', 'quotationNo', 'publishOutbox', 'quotation.persisted'],
    lifecycleService: ['lifecycle.handover.upsert', 'lifecycle.acceptance.marked', 'lifecycle.project_state.update', 'lifecycle_handoff_only', 'publishOutbox', 'lifecycleOutboxEvent'],
    auditService: ['tenantId is required for audit logging', 'audit action and resourceType are required', 'this.auditRepo.create'],
    openApi: ['/api/v2/lifecycle/handover/{contractId}', 'lifecycle_handoff_only']
  })) {
    const sourcePath = probes[sourceKey];
    check(report, `source-exists:${sourceKey}`, exists(sourcePath), `missing source probe ${sourceKey}: ${sourcePath}`);
    for (const token of tokens) {
      check(report, `source-token:${sourceKey}:${token}`, sourceIncludes(sourcePath, token), `${sourceKey} missing source token: ${token}`);
    }
  }

  for (const [sourcePath, tokens] of Object.entries({
    'server/models/OutboxEvent.js': ['tenantId', 'idempotencyKey', 'dead_letter', 'tenantId: 1, idempotencyKey: 1'],
    'server/modules/outbox/outbox.service.js': ['class OutboxService', 'tenantId is required for outbox events', 'idempotencyKey', 'dead_letter', 'this.outboxRepo.create'],
    'test/production-readiness/outbox-service.test.js': ['publishes tenant-scoped idempotent events', 'lists events only inside tenant scope', 'rejects events without tenant'],
    'test/production-readiness/quotation-v2-persistence.test.js': ['quotation.persisted', 'outboxService.publish'],
    'test/production-readiness/lifecycle-service.test.js': ['lifecycle.handover.upsert', 'lifecycle.project_state.update', 'lifecycle.acceptance.marked', 'outboxService.publish']
  })) {
    check(report, `compat-source-exists:${sourcePath}`, exists(sourcePath), `missing compatibility outbox source: ${sourcePath}`);
    for (const token of tokens) {
      check(report, `compat-source-token:${sourcePath}:${token}`, sourceIncludes(sourcePath, token), `${sourcePath} missing token: ${token}`);
    }
  }

  for (const [sourcePath, tokens] of Object.entries({
    'server/modules/outbox/outbox.service.js': [
      'claimPending',
      'markDelivered',
      'markFailed',
      'replay',
      'nextAvailableAt',
      'deadLetteredAt',
      'tenantId: scope.tenantId'
    ],
    'server/models/OutboxEvent.js': [
      'lockedAt',
      'deliveredAt',
      'deadLetteredAt',
      'replayedAt',
      'replayReason'
    ],
    'test/production-readiness/outbox-service.test.js': [
      'claims pending events only when available inside tenant scope',
      'marks delivered events without crossing tenant boundary',
      'retries failed delivery with backoff and dead_letter after max attempts',
      'replays dead_letter events as pending without losing idempotency key'
    ]
  })) {
    check(report, `delivery-source-exists:${sourcePath}`, exists(sourcePath), `missing outbox delivery source: ${sourcePath}`);
    for (const token of tokens) {
      check(report, `delivery-source-token:${sourcePath}:${token}`, sourceIncludes(sourcePath, token), `${sourcePath} missing delivery token: ${token}`);
    }
  }

  const releaseRecord = release.requiredEvidence?.workflowOutboxContract;
  check(report, 'release-evidence-key', Boolean(releaseRecord), 'release evidence missing workflowOutboxContract');
  if (releaseRecord) {
    check(report, 'release-status', releaseRecord.status === 'target-contract-guarded', 'workflowOutboxContract status must be target-contract-guarded');
    check(report, 'release-command', releaseRecord.command === 'npm run guard:workflow-outbox-contract', 'workflowOutboxContract command must be npm run guard:workflow-outbox-contract');
    check(report, 'release-path', releaseRecord.path === REPORT_JSON, `workflowOutboxContract path must be ${REPORT_JSON}`);
    check(report, 'release-runtime-proof', releaseRecord.finalLaunchWorkflowProof === false, 'workflowOutboxContract must not claim final launch workflow proof');
    check(report, 'release-compat-outbox-proof', releaseRecord.compatibilityOutboxProof === true, 'workflowOutboxContract must record compatibilityOutboxProof true after current-trunk tests pass');
    check(report, 'release-compat-workflow-replay-proof', releaseRecord.compatibilityWorkflowReplayProof === true, 'workflowOutboxContract must record compatibilityWorkflowReplayProof true after local replay smoke passes');
    check(report, 'release-workflow-replay-command', releaseRecord.workflowReplaySmokeCommand === 'npm run release:workflow-replay:smoke', 'workflowOutboxContract workflowReplaySmokeCommand must be npm run release:workflow-replay:smoke');
    check(report, 'release-workflow-replay-path', releaseRecord.workflowReplaySmokePath === REPLAY_SMOKE_JSON, `workflowOutboxContract workflowReplaySmokePath must be ${REPLAY_SMOKE_JSON}`);
    check(report, 'release-workflow-replay-summary-path', releaseRecord.workflowReplaySmokeSummaryPath === REPLAY_SMOKE_MD, `workflowOutboxContract workflowReplaySmokeSummaryPath must be ${REPLAY_SMOKE_MD}`);
    check(report, 'release-workflow-replay-count', releaseRecord.replayedWorkflows === REQUIRED_WORKFLOWS.length, `workflowOutboxContract replayedWorkflows must be ${REQUIRED_WORKFLOWS.length}`);
  }

  check(report, 'replay-smoke-exists-json', exists(REPLAY_SMOKE_JSON), `missing workflow replay smoke report: ${REPLAY_SMOKE_JSON}`);
  check(report, 'replay-smoke-exists-md', exists(REPLAY_SMOKE_MD), `missing workflow replay smoke summary: ${REPLAY_SMOKE_MD}`);
  if (exists(REPLAY_SMOKE_JSON)) {
    const replaySmoke = readJson(REPLAY_SMOKE_JSON);
    check(report, 'replay-smoke-platform', replaySmoke.platform === 'Rhautt Nexus / 瑞合数智枢纽', 'workflow replay smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
    check(report, 'replay-smoke-status', replaySmoke.status === 'local-deterministic-replay-not-production-temporal', 'workflow replay smoke must remain local-deterministic-replay-not-production-temporal');
    check(report, 'replay-smoke-final-proof', replaySmoke.finalLaunchWorkflowProof === false, 'workflow replay smoke must not claim final launch workflow proof');
    check(report, 'replay-smoke-temporal-runtime', replaySmoke.temporalRuntime === false, 'workflow replay smoke must not claim Temporal runtime');
    check(report, 'replay-smoke-contract-current', replaySmoke.contractSha256 === sha256(read(CONTRACT_PATH)), 'workflow replay smoke report is stale; rerun npm run release:workflow-replay:smoke');
    check(report, 'replay-smoke-workflows', replaySmoke.summary?.workflows === REQUIRED_WORKFLOWS.length, `workflow replay smoke must cover ${REQUIRED_WORKFLOWS.length} workflows`);
    check(report, 'replay-smoke-failures', replaySmoke.summary?.failed === 0, 'workflow replay smoke must have zero failed workflows');
    check(report, 'replay-smoke-outbox-events', replaySmoke.summary?.outboxEvents >= 24, 'workflow replay smoke must publish at least 24 outbox events');
    check(report, 'replay-smoke-audit-actions', replaySmoke.summary?.auditActions >= 17, 'workflow replay smoke must record at least 17 audit actions');
    check(report, 'replay-smoke-dead-letter-replay', replaySmoke.summary?.replayedEvents >= REQUIRED_WORKFLOWS.length, 'workflow replay smoke must replay at least one dead-letter per workflow');
    check(report, 'replay-smoke-duplicates', replaySmoke.summary?.duplicatePublishPrevented === true, 'workflow replay smoke must prove duplicate publish prevention');
    check(report, 'replay-smoke-iot-boundary', replaySmoke.summary?.lifecycleHandoffOnlyBoundary === true, 'workflow replay smoke must preserve lifecycle_handoff_only boundary');
    const replayedIds = new Set((replaySmoke.results || []).map(result => result.workflowId));
    for (const id of REQUIRED_WORKFLOWS) {
      check(report, `replay-smoke-workflow:${id}`, replayedIds.has(id), `workflow replay smoke missing workflow: ${id}`);
    }
  }

  if (String(contract.runtimeTruth || '').includes('production Temporal worker is running')) {
    warnings.push('contract appears to claim production Temporal worker runtime');
  }

  report.summary.failures = failures.length;
  report.summary.warnings = warnings.length;
  report.warnings = warnings;
  return report;
}

function renderMarkdown(report) {
  const lines = [
    '# Workflow + Outbox Contract Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    `Contract: \`${report.contractPath}\``,
    '',
    `Contract SHA-256: \`${report.contractSha256}\``,
    '',
    '| Check | Result | Details |',
    '|---|---:|---|'
  ];
  for (const item of report.checks) {
    lines.push(`| ${item.name} | ${item.passed ? 'pass' : 'fail'} | ${String(item.details || '').replace(/\|/g, '/')} |`);
  }
  if (report.warnings?.length) {
    lines.push('', '## Warnings', '');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  return lines.join('\n');
}

const report = inspect();

if (report) {
  fs.mkdirSync(fullPath('evidence/workflow'), { recursive: true });
  fs.writeFileSync(fullPath(REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(fullPath(REPORT_MD), renderMarkdown(report));
}

console.log(`Workflow + Outbox Contract Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
