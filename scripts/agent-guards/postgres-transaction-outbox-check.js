#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  updateReleaseEvidence
} = require('../release/evidence-utils');

const ROOT = path.join(__dirname, '..', '..');
const MIGRATION_PATH = 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql';
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const REPORT_JSON = 'evidence/database/postgres-transaction-outbox-report.json';
const REPORT_MD = 'evidence/database/postgres-transaction-outbox-report.md';

const failures = [];

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

function sha256(relativePath) {
  return crypto.createHash('sha256').update(read(relativePath)).digest('hex');
}

function hashValue(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex')}`;
}

function check(report, name, passed, details) {
  report.checks.push({ name, passed, details });
  if (!passed) failures.push(details || name);
}

function createLedger() {
  return {
    quotations: [],
    contracts: [],
    project_lifecycle: [],
    file_artifacts: [],
    audit_logs: [],
    outbox_events: [],
    workflow_instances: [],
    workflow_steps: []
  };
}

function cloneLedger(ledger) {
  return JSON.parse(JSON.stringify(ledger));
}

function applySnapshot(target, snapshot) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, snapshot);
}

function requireTenant(scope = {}) {
  if (!scope.tenantId) throw new Error('app.tenant_id is required for target PostgreSQL transaction');
}

function tenantWrite(scope, table, row) {
  requireTenant(scope);
  if (row.tenant_id && row.tenant_id !== scope.tenantId) {
    throw new Error(`RLS WITH CHECK rejected cross-tenant write on ${table}`);
  }
  return {
    ...row,
    tenant_id: scope.tenantId,
    created_at: row.created_at || '2026-06-06T00:00:00.000Z',
    updated_at: row.updated_at || '2026-06-06T00:00:00.000Z'
  };
}

function insertUniqueOutbox(ledger, scope, event) {
  const row = tenantWrite(scope, 'outbox_events', {
    id: event.id,
    tenant_id: event.tenant_id,
    aggregate_type: event.aggregate_type,
    aggregate_id: event.aggregate_id,
    event_type: event.event_type,
    payload: event.payload || {},
    idempotency_key: event.idempotency_key,
    status: event.status || 'pending',
    available_at: '2026-06-06T00:00:00.000Z',
    attempts: 0
  });
  const duplicate = ledger.outbox_events.find(item => (
    item.tenant_id === row.tenant_id &&
    item.idempotency_key === row.idempotency_key
  ));
  if (duplicate) return duplicate;
  ledger.outbox_events.push(row);
  return row;
}

function runTransaction(ledger, scope, operations) {
  const snapshot = cloneLedger(ledger);
  try {
    const result = operations({
      insert: (table, row) => {
        const target = ledger[table];
        if (!Array.isArray(target)) throw new Error(`unknown table: ${table}`);
        const next = tenantWrite(scope, table, row);
        target.push(next);
        return next;
      },
      outbox: event => insertUniqueOutbox(ledger, scope, event)
    });
    return { committed: true, result };
  } catch (error) {
    applySnapshot(ledger, snapshot);
    return { committed: false, error: error.message };
  }
}

function quoteApprovalWrite(tx, scope, aggregateId) {
  const quote = tx.insert('quotations', {
    id: aggregateId,
    customer_id: 'customer-1',
    quotation_no: 'Q-ATOM-001',
    version: 1,
    status: 'approved',
    bom: [],
    cost_snapshot: {},
    price_snapshot: {},
    margin_snapshot: {},
    approval_state: { approved: true }
  });
  tx.insert('audit_logs', {
    id: 'audit-quote-1',
    actor_user_id: scope.actorId,
    action: 'quote.approved',
    resource_type: 'quotation',
    resource_id: aggregateId,
    after_state: { status: 'approved' },
    request_id: scope.requestId,
    trace_id: scope.traceId
  });
  tx.insert('workflow_instances', {
    id: 'workflow-quote-1',
    workflow_type: 'quote-approval-workflow',
    temporal_workflow_id: `local:${scope.tenantId}:quote-approval:${aggregateId}`,
    aggregate_type: 'quotation',
    aggregate_id: aggregateId,
    status: 'running',
    input: { quotationId: aggregateId },
    state: { step: 'emit-outbox' },
    started_at: '2026-06-06T00:00:00.000Z'
  });
  tx.insert('workflow_steps', {
    id: 'workflow-step-quote-1',
    workflow_instance_id: 'workflow-quote-1',
    step_type: 'emit-outbox',
    status: 'completed',
    attempt: 1,
    input: {},
    output: {}
  });
  const outbox = tx.outbox({
    id: 'outbox-quote-1',
    aggregate_type: 'quotation',
    aggregate_id: aggregateId,
    event_type: 'quote.approved',
    idempotency_key: `${scope.tenantId}:quote-approval-workflow:${aggregateId}:quote.approved`,
    payload: { quotationId: quote.id, workflowType: 'quote-approval-workflow' }
  });
  return { quote, outbox };
}

function lifecycleHandoffWrite(tx, scope, aggregateId) {
  const lifecycle = tx.insert('project_lifecycle', {
    id: aggregateId,
    customer_id: 'customer-1',
    contract_id: 'contract-1',
    quotation_id: 'quote-1',
    lifecycle_stage: 'iot_handover',
    project_state: 'lifecycle-handoff-ready',
    handoff_status: 'ready',
    installed_assets: [{ assetId: 'asset-1', category: 'central-hot-water' }],
    service_plan: { status: 'prepared' },
    iot: {
      boundary: 'lifecycle_handoff_only',
      controlBoundary: 'lifecycle_handoff_only',
      realtimeControl: false
    }
  });
  tx.insert('audit_logs', {
    id: 'audit-life-1',
    actor_user_id: scope.actorId,
    action: 'lifecycle.handover.upsert',
    resource_type: 'project_lifecycle',
    resource_id: aggregateId,
    after_state: { handoff_status: 'ready', boundary: 'lifecycle_handoff_only' },
    request_id: scope.requestId,
    trace_id: scope.traceId
  });
  tx.outbox({
    id: 'outbox-life-1',
    aggregate_type: 'lifecycle_link',
    aggregate_id: aggregateId,
    event_type: 'iot.handoff.submitted',
    idempotency_key: `${scope.tenantId}:iot-handoff-workflow:${aggregateId}:iot.handoff.submitted`,
    payload: {
      lifecycleId: lifecycle.id,
      handoffBoundary: 'lifecycle_handoff_only',
      controlBoundary: 'lifecycle_handoff_only'
    }
  });
  return lifecycle;
}

const RYSNOVA_CUSTOMER_SIGNOFF_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report'
];

function rysnovaBimCustomerPackageReadyWrite(tx, scope, projectId) {
  const artifacts = RYSNOVA_CUSTOMER_SIGNOFF_TYPES.map((artifactType, index) => tx.insert('file_artifacts', {
    id: `rysnova-bim-artifact-${index + 1}`,
    project_id: projectId,
    customer_id: 'customer-1',
    module_id: 'rysnova-bim-engineering-support',
    module_deployment_mode: 'rhautt-portal-embedded',
    module_namespace: 'rysnova-bim',
    data_namespace: 'rysnova-bim',
    artifact_type: artifactType,
    artifact_status: 'shared',
    object_key: `rysnova-bim/${scope.tenantId}/${projectId}/${artifactType}/v1/${artifactType}.json`,
    content_hash: `sha256:${artifactType}`,
    inputs_hash: `sha256:inputs-${artifactType}`,
    version: 1,
    visibility: 'customer',
    customer_visible: true,
    storage_provider: 's3-compatible-object-storage',
    storage_integrity_passed: true,
    storage_integrity_checked_at: '2026-06-06T00:00:00.000Z',
    metadata: { customerSignoffRequired: true }
  }));
  tx.insert('audit_logs', {
    id: 'audit-rysnova-bim-package-ready-1',
    actor_user_id: scope.actorId,
    action: 'rysnova-bim.customer_package.ready',
    resource_type: 'rysnova-bim_customer_package',
    resource_id: projectId,
    after_state: {
      artifactTypes: RYSNOVA_CUSTOMER_SIGNOFF_TYPES,
      count: artifacts.length,
      customerSignoffReady: true
    },
    request_id: scope.requestId,
    trace_id: scope.traceId
  });
  tx.outbox({
    id: 'outbox-rysnova-bim-package-ready-1',
    aggregate_type: 'rysnova-bim_customer_package',
    aggregate_id: projectId,
    event_type: 'rysnova-bim.customer_package.ready',
    idempotency_key: `${scope.tenantId}:rysnova-bim_customer_package:${projectId}:ready:v${RYSNOVA_CUSTOMER_SIGNOFF_TYPES.join('.')}`,
    payload: {
      projectId,
      requiredTypes: RYSNOVA_CUSTOMER_SIGNOFF_TYPES,
      missingTypes: [],
      count: artifacts.length,
      customerVisible: true,
      customerSignoffReady: true
    }
  });
  return artifacts;
}

function rysnovaBimCustomerPackageReady(ledger, scope, projectId) {
  const rows = ledger.file_artifacts.filter(row => (
    row.tenant_id === scope.tenantId &&
    row.data_namespace === 'rysnova-bim' &&
    row.project_id === projectId &&
    row.customer_visible === true &&
    ['approved', 'shared'].includes(row.artifact_status) &&
    row.storage_integrity_passed === true
  ));
  const types = new Set(rows.map(row => row.artifact_type));
  return RYSNOVA_CUSTOMER_SIGNOFF_TYPES.every(type => types.has(type));
}

function rysnovaBimCustomerSignoffConfirmedWrite(tx, scope, projectId) {
  const confirmedAt = '2026-06-06T00:00:00.000Z';
  const receiptNo = 'LITH-SIGNOFF-POSTGRES-TARGET-001';
  const receipt = {
    receiptNo,
    packageType: 'rysnova-bim-customer-signoff-receipt',
    status: 'customer-signed',
    artifactCount: RYSNOVA_CUSTOMER_SIGNOFF_TYPES.length,
    artifactTypes: RYSNOVA_CUSTOMER_SIGNOFF_TYPES,
    requiredTypes: RYSNOVA_CUSTOMER_SIGNOFF_TYPES,
    acknowledgements: [
      'solution-scope-reviewed',
      'quotation-summary-reviewed',
      'engineering-deliverables-received',
      'standards-precheck-reviewed',
      'lifecycle-handoff-boundary-reviewed'
    ],
    signerMobileHash: hashValue('13800000000'),
    evidenceHash: hashValue('raw-signature-evidence'),
    rawSensitiveEvidenceOmitted: true,
    lifecycleHandoff: {
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false
    },
    boundary: {
      customerSafe: true,
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      noRealtimeControlGranted: true
    },
    confirmedAt
  };
  tx.insert('audit_logs', {
    id: 'audit-rysnova-bim-customer-signoff-1',
    actor_user_id: scope.actorId,
    action: 'rysnova-bim.customer_signoff.confirmed',
    resource_type: 'rysnova-bim_customer_signoff',
    resource_id: projectId,
    after_state: {
      projectId,
      receiptNo,
      receipt,
      customerSignoffConfirmed: true
    },
    request_id: scope.requestId,
    trace_id: scope.traceId
  });
  tx.insert('workflow_instances', {
    id: 'workflow-rysnova-bim-customer-signoff-1',
    workflow_type: 'rysnova-bim-customer-signoff-workflow',
    temporal_workflow_id: `local:${scope.tenantId}:rysnova-bim-customer-signoff:${projectId}`,
    aggregate_type: 'rysnova-bim_customer_signoff',
    aggregate_id: projectId,
    status: 'running',
    input: { projectId, receiptNo },
    state: {
      step: 'emit-customer-signoff-outbox',
      lifecycleHandoffBoundary: 'lifecycle_handoff_only'
    },
    started_at: confirmedAt
  });
  tx.insert('workflow_steps', {
    id: 'workflow-step-rysnova-bim-customer-signoff-1',
    workflow_instance_id: 'workflow-rysnova-bim-customer-signoff-1',
    step_type: 'emit-customer-signoff-outbox',
    status: 'completed',
    attempt: 1,
    input: { projectId },
    output: { eventType: 'rysnova-bim.customer_signoff.confirmed', receiptNo },
    completed_at: confirmedAt
  });
  const outbox = tx.outbox({
    id: 'outbox-rysnova-bim-customer-signoff-1',
    aggregate_type: 'rysnova-bim_customer_signoff',
    aggregate_id: projectId,
    event_type: 'rysnova-bim.customer_signoff.confirmed',
    idempotency_key: `${scope.tenantId}:rysnova-bim_customer_signoff:${projectId}:${receiptNo}`,
    payload: {
      projectId,
      receipt,
      customerSignoffConfirmed: true,
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false
    }
  });
  return { receipt, outbox };
}

function rysnovaBimCustomerSignoffConfirmed(ledger, scope, projectId) {
  const audit = ledger.audit_logs.find(row => (
    row.tenant_id === scope.tenantId &&
    row.action === 'rysnova-bim.customer_signoff.confirmed' &&
    row.resource_id === projectId
  ));
  const outbox = ledger.outbox_events.find(row => (
    row.tenant_id === scope.tenantId &&
    row.aggregate_type === 'rysnova-bim_customer_signoff' &&
    row.event_type === 'rysnova-bim.customer_signoff.confirmed' &&
    row.aggregate_id === projectId
  ));
  const workflow = ledger.workflow_instances.find(row => (
    row.tenant_id === scope.tenantId &&
    row.workflow_type === 'rysnova-bim-customer-signoff-workflow' &&
    row.aggregate_id === projectId
  ));
  const serialized = JSON.stringify({ audit, outbox, workflow });
  const receipt = outbox?.payload?.receipt || {};
  return Boolean(
    audit &&
      outbox &&
      workflow &&
      /^LITH-SIGNOFF-/.test(String(receipt.receiptNo || '')) &&
      receipt.packageType === 'rysnova-bim-customer-signoff-receipt' &&
      receipt.status === 'customer-signed' &&
      receipt.artifactCount === RYSNOVA_CUSTOMER_SIGNOFF_TYPES.length &&
      receipt.rawSensitiveEvidenceOmitted === true &&
      /^sha256:/.test(String(receipt.signerMobileHash || '')) &&
      /^sha256:/.test(String(receipt.evidenceHash || '')) &&
      receipt.lifecycleHandoff?.handoffBoundary === 'lifecycle_handoff_only' &&
      receipt.lifecycleHandoff?.realtimeControl === false &&
      receipt.boundary?.noRealtimeControlGranted === true &&
      !serialized.includes('13800000000') &&
      !serialized.includes('raw-signature-evidence') &&
      !outbox.payload?.controlCommand
  );
}

function inspect() {
  for (const file of [MIGRATION_PATH, RELEASE_EVIDENCE]) {
    if (!exists(file)) failures.push(`missing database transaction evidence file: ${file}`);
  }
  if (failures.length) return null;

  const migration = read(MIGRATION_PATH);
  const release = readJson(RELEASE_EVIDENCE);
  const ledger = createLedger();
  const tenantA = '00000000-0000-0000-0000-000000000101';
  const tenantB = '00000000-0000-0000-0000-000000000102';
  const scopeA = {
    tenantId: tenantA,
    actorId: '00000000-0000-0000-0000-000000001001',
    requestId: 'req-postgres-transaction-outbox',
    traceId: 'trace-postgres-transaction-outbox'
  };

  const report = {
    generatedAt: new Date().toISOString(),
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    status: 'target-transaction-simulated-not-staging-applied',
    migrationPath: MIGRATION_PATH,
    migrationSha256: sha256(MIGRATION_PATH),
    finalLaunchDatabaseProof: false,
    summary: {
      checks: 0,
      failures: 0,
      committedTransactions: 0,
      rolledBackTransactions: 0,
      businessRows: 0,
      auditRows: 0,
      outboxRows: 0,
      workflowRows: 0
    },
    checks: []
  };

  check(report, 'migration-has-outbox-table', /CREATE TABLE IF NOT EXISTS rhautt_nexus\.outbox_events/i.test(migration), 'migration must define outbox_events');
  check(report, 'migration-has-workflow-instance-table', /CREATE TABLE IF NOT EXISTS rhautt_nexus\.workflow_instances/i.test(migration), 'migration must define workflow_instances');
  check(report, 'migration-has-workflow-step-table', /CREATE TABLE IF NOT EXISTS rhautt_nexus\.workflow_steps/i.test(migration), 'migration must define workflow_steps');
  check(report, 'migration-has-tenant-idempotency-unique-key', /UNIQUE\s*\(\s*tenant_id\s*,\s*idempotency_key\s*\)/i.test(migration), 'outbox_events must have tenant_id + idempotency_key unique key');
  check(report, 'migration-has-dead-letter-status', /'dead_letter'/i.test(migration), 'outbox_events must support dead_letter status');

  const success = runTransaction(ledger, scopeA, tx => quoteApprovalWrite(tx, scopeA, 'quote-atomic-1'));
  if (success.committed) report.summary.committedTransactions += 1;
  check(report, 'commit-business-audit-workflow-outbox', success.committed, 'quote approval transaction must commit');
  check(report, 'commit-created-business-row', ledger.quotations.length === 1, 'committed transaction must write quotation');
  check(report, 'commit-created-audit-row', ledger.audit_logs.length === 1, 'committed transaction must write audit log');
  check(report, 'commit-created-workflow-rows', ledger.workflow_instances.length === 1 && ledger.workflow_steps.length === 1, 'committed transaction must write workflow rows');
  check(report, 'commit-created-outbox-row', ledger.outbox_events.length === 1, 'committed transaction must write outbox event');

  const beforeRollback = cloneLedger(ledger);
  const failed = runTransaction(ledger, scopeA, tx => {
    tx.insert('quotations', {
      id: 'quote-rollback-1',
      customer_id: 'customer-1',
      quotation_no: 'Q-ROLLBACK-001',
      version: 1,
      status: 'approved'
    });
    tx.outbox({
      id: 'outbox-cross-tenant',
      tenant_id: tenantB,
      aggregate_type: 'quotation',
      aggregate_id: 'quote-rollback-1',
      event_type: 'quote.approved',
      idempotency_key: `${tenantB}:quote-rollback-1:quote.approved`,
      payload: {}
    });
  });
  if (!failed.committed) report.summary.rolledBackTransactions += 1;
  check(report, 'rollback-cross-tenant-outbox-write', failed.committed === false && failed.error.includes('RLS WITH CHECK'), 'cross-tenant outbox write must roll back the whole transaction');
  check(report, 'rollback-no-partial-business-row', JSON.stringify(ledger) === JSON.stringify(beforeRollback), 'failed transaction must leave no partial business/audit/outbox rows');

  const duplicate = runTransaction(ledger, scopeA, tx => {
    tx.outbox({
      id: 'outbox-quote-duplicate',
      aggregate_type: 'quotation',
      aggregate_id: 'quote-atomic-1',
      event_type: 'quote.approved',
      idempotency_key: `${scopeA.tenantId}:quote-approval-workflow:quote-atomic-1:quote.approved`,
      payload: { duplicate: true }
    });
  });
  if (duplicate.committed) report.summary.committedTransactions += 1;
  check(report, 'idempotency-prevents-duplicate-outbox', duplicate.committed && ledger.outbox_events.length === 1, 'duplicate idempotency key must not create another outbox row');

  const lifecycle = runTransaction(ledger, scopeA, tx => lifecycleHandoffWrite(tx, scopeA, 'life-atomic-1'));
  if (lifecycle.committed) report.summary.committedTransactions += 1;
  check(report, 'lifecycle-handoff-transaction-commits', lifecycle.committed, 'lifecycle handoff transaction must commit');
  check(report, 'lifecycle-handoff-outbox-created', ledger.project_lifecycle.length === 1 && ledger.outbox_events.length === 2, 'lifecycle handoff must write business row and outbox event');
  check(report, 'lifecycle-handoff-boundary', ledger.project_lifecycle.every(row => row.iot?.boundary === 'lifecycle_handoff_only' && row.iot?.realtimeControl === false), 'lifecycle rows must remain lifecycle_handoff_only');
  check(report, 'outbox-handoff-boundary', ledger.outbox_events.every(row => !row.payload?.controlCommand), 'outbox payloads must not include real-time IoT control commands');

  const rysnovaBimPackage = runTransaction(ledger, scopeA, tx => rysnovaBimCustomerPackageReadyWrite(tx, scopeA, '00000000-0000-0000-0000-00000000f001'));
  if (rysnovaBimPackage.committed) report.summary.committedTransactions += 1;
  check(report, 'rysnova-bim-customer-package-transaction-commits', rysnovaBimPackage.committed, 'Rysnova customer package ready transaction must commit');
  check(report, 'rysnova-bim-customer-package-seven-artifacts', ledger.file_artifacts.length === 7, 'Rysnova customer package must write 7 file_artifacts rows');
  check(report, 'rysnova-bim-customer-package-required-types', rysnovaBimCustomerPackageReady(ledger, scopeA, '00000000-0000-0000-0000-00000000f001'), 'Rysnova customer package must include all 7 required customer-visible integrity-passed artifact types');
  check(report, 'rysnova-bim-customer-package-ready-outbox', ledger.outbox_events.some(row => row.event_type === 'rysnova-bim.customer_package.ready'), 'Rysnova customer package transaction must write customer_package.ready outbox event');
  check(report, 'rysnova-bim-customer-package-ready-audit', ledger.audit_logs.some(row => row.action === 'rysnova-bim.customer_package.ready'), 'Rysnova customer package transaction must write audit log');

  const rysnovaBimSignoff = runTransaction(ledger, scopeA, tx => rysnovaBimCustomerSignoffConfirmedWrite(tx, scopeA, '00000000-0000-0000-0000-00000000f001'));
  if (rysnovaBimSignoff.committed) report.summary.committedTransactions += 1;
  check(report, 'rysnova-bim-customer-signoff-transaction-commits', rysnovaBimSignoff.committed, 'Rysnova customer signoff confirmation transaction must commit');
  check(report, 'rysnova-bim-customer-signoff-confirmed-outbox', ledger.outbox_events.some(row => row.event_type === 'rysnova-bim.customer_signoff.confirmed'), 'Rysnova customer signoff transaction must write customer_signoff.confirmed outbox event');
  check(report, 'rysnova-bim-customer-signoff-confirmed-audit', ledger.audit_logs.some(row => row.action === 'rysnova-bim.customer_signoff.confirmed'), 'Rysnova customer signoff transaction must write audit log');
  check(report, 'rysnova-bim-customer-signoff-workflow', ledger.workflow_instances.some(row => row.workflow_type === 'rysnova-bim-customer-signoff-workflow'), 'Rysnova customer signoff transaction must write workflow instance');
  check(report, 'rysnova-bim-customer-signoff-sanitized-receipt', rysnovaBimCustomerSignoffConfirmed(ledger, scopeA, '00000000-0000-0000-0000-00000000f001'), 'Rysnova customer signoff receipt must be hash-only, lifecycle_handoff_only, and free of raw mobile/signature evidence');

  const releaseRecord = release.requiredEvidence?.postgresTransactionOutbox;
  check(report, 'release-evidence-key', Boolean(releaseRecord), 'release evidence missing postgresTransactionOutbox');
  if (releaseRecord) {
    check(report, 'release-status', releaseRecord.status === 'target-transaction-simulated', 'postgresTransactionOutbox status must be target-transaction-simulated');
    check(report, 'release-final-proof', releaseRecord.finalLaunchDatabaseProof === false, 'postgresTransactionOutbox must not claim final launch database proof');
    check(report, 'release-command', releaseRecord.command === 'npm run guard:postgres-transaction-outbox', 'postgresTransactionOutbox command must be npm run guard:postgres-transaction-outbox');
  }

  report.summary.checks = report.checks.length;
  report.summary.failures = failures.length;
  report.summary.businessRows = ledger.quotations.length + ledger.project_lifecycle.length + ledger.file_artifacts.length;
  report.summary.auditRows = ledger.audit_logs.length;
  report.summary.outboxRows = ledger.outbox_events.length;
  report.summary.workflowRows = ledger.workflow_instances.length + ledger.workflow_steps.length;
  report.ledgerDigest = crypto.createHash('sha256').update(JSON.stringify(ledger)).digest('hex');
  return report;
}

function renderMarkdown(report) {
  const lines = [
    '# PostgreSQL Transaction + Outbox Simulation Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    'This is a local deterministic simulation for target PostgreSQL transaction/outbox behavior. It is not staging-applied migration proof.',
    '',
    `Final launch database proof: ${report.finalLaunchDatabaseProof ? 'yes' : 'no'}`,
    '',
    '| Check | Result | Details |',
    '|---|---:|---|'
  ];
  for (const item of report.checks) {
    lines.push(`| ${item.name} | ${item.passed ? 'pass' : 'fail'} | ${String(item.details || '').replace(/\|/g, '/')} |`);
  }
  return lines.join('\n');
}

const report = inspect();

if (report) {
  writeJson(REPORT_JSON, report);
  fs.writeFileSync(fullPath(REPORT_MD), renderMarkdown(report));
  updateReleaseEvidence('postgresTransactionOutbox', {
    command: 'npm run guard:postgres-transaction-outbox',
    status: 'target-transaction-simulated',
    path: REPORT_JSON,
    summaryPath: REPORT_MD,
    migrationPath: MIGRATION_PATH,
    capabilities: [
      'businessWriteOutboxAtomicity',
      'rollbackNoPartialRows',
      'tenantScopedIdempotencyKey',
      'crossTenantWithCheckRejects',
      'auditAndWorkflowRowsInTransaction',
      'lifecycleHandoffOnlyBoundary',
      'rysnovaBimCustomerSignoffConfirmedOutbox',
      'rysnovaBimCustomerSignoffSanitizedReceipt'
    ],
    finalLaunchDatabaseProof: false,
    note: 'Local deterministic simulation for target PostgreSQL transaction + outbox atomicity, including Rysnova customer signoff confirmation. This is not staging-applied PostgreSQL transaction proof.'
  });
}

console.log(`PostgreSQL Transaction + Outbox Check: failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
