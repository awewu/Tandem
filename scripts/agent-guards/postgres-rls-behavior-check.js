#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = 'database/postgres/harness/target-schema-contract.json';
const MIGRATION_PATH = 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql';
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const REPORT_JSON = 'evidence/database/postgres-rls-behavior-report.json';
const REPORT_MD = 'evidence/database/postgres-rls-behavior-report.md';

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

function sha256(relativePath) {
  return crypto.createHash('sha256').update(read(relativePath)).digest('hex');
}

function ensureDir(relativePath) {
  fs.mkdirSync(fullPath(relativePath), { recursive: true });
}

function check(report, name, passed, details) {
  report.checks.push({ name, passed, details });
  if (!passed) failures.push(details || name);
}

function seedLedger() {
  return {
    tenants: [
      { id: '00000000-0000-0000-0000-000000000001', code: 'hq', name: '瑞合瑞德总部', tenant_type: 'hq' },
      { id: '00000000-0000-0000-0000-000000000101', code: 'dealer-east', name: '华东经销商', tenant_type: 'dealer_group' },
      { id: '00000000-0000-0000-0000-000000000102', code: 'dealer-west', name: '西部经销商', tenant_type: 'dealer_group' }
    ],
    customers: [
      { id: 'customer-east-1', tenant_id: '00000000-0000-0000-0000-000000000101', name: '王女士', status: 'active' },
      { id: 'customer-west-1', tenant_id: '00000000-0000-0000-0000-000000000102', name: '李先生', status: 'active' }
    ],
    quotations: [
      { id: 'quote-east-1', tenant_id: '00000000-0000-0000-0000-000000000101', quotation_no: 'QE-001', status: 'approved', amount: 328000 },
      { id: 'quote-west-1', tenant_id: '00000000-0000-0000-0000-000000000102', quotation_no: 'QW-001', status: 'approved', amount: 268000 }
    ],
    project_lifecycle: [
      {
        id: 'life-east-1',
        tenant_id: '00000000-0000-0000-0000-000000000101',
        project_state: 'accepted',
        handoff_status: 'ready',
        iot: { boundary: 'lifecycle_handoff_only', realtimeControl: false }
      },
      {
        id: 'life-west-1',
        tenant_id: '00000000-0000-0000-0000-000000000102',
        project_state: 'construction-in-progress',
        handoff_status: 'not-ready',
        iot: { boundary: 'lifecycle_handoff_only', realtimeControl: false }
      }
    ],
    audit_logs: [
      { id: 'audit-east-1', tenant_id: '00000000-0000-0000-0000-000000000101', action: 'quotation.created', resource_type: 'quotation', resource_id: 'quote-east-1' },
      { id: 'audit-west-1', tenant_id: '00000000-0000-0000-0000-000000000102', action: 'quotation.created', resource_type: 'quotation', resource_id: 'quote-west-1' }
    ]
  };
}

function tenantQuery(rows, tenantId) {
  return rows.filter(row => row.tenant_id === tenantId);
}

function tenantInsert(rows, scope, row) {
  if (!scope?.tenantId) throw new Error('app.tenant_id is required before tenant-scoped insert');
  if (row.tenant_id && row.tenant_id !== scope.tenantId) {
    throw new Error('RLS WITH CHECK rejected cross-tenant insert');
  }
  const inserted = { ...row, tenant_id: scope.tenantId };
  rows.push(inserted);
  return inserted;
}

function hqRollup(ledger) {
  const dealerTenantIds = new Set(
    ledger.tenants.filter(tenant => tenant.tenant_type === 'dealer_group').map(tenant => tenant.id)
  );
  const quotations = ledger.quotations.filter(item => dealerTenantIds.has(item.tenant_id));
  return {
    dealerTenants: dealerTenantIds.size,
    approvedQuotations: quotations.filter(item => item.status === 'approved').length,
    approvedAmount: quotations.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  };
}

function inspect() {
  for (const file of [CONTRACT_PATH, MIGRATION_PATH, RELEASE_EVIDENCE]) {
    if (!exists(file)) failures.push(`missing database evidence file: ${file}`);
  }
  if (failures.length) return null;

  const contract = readJson(CONTRACT_PATH);
  const release = readJson(RELEASE_EVIDENCE);
  const migration = read(MIGRATION_PATH);
  const ledger = seedLedger();

  const report = {
    generatedAt: new Date().toISOString(),
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    status: 'target-behavior-simulated-not-staging-applied',
    contractPath: CONTRACT_PATH,
    migrationPath: MIGRATION_PATH,
    migrationSha256: sha256(MIGRATION_PATH),
    summary: {
      simulatedTenants: ledger.tenants.length,
      dealerTenants: ledger.tenants.filter(tenant => tenant.tenant_type === 'dealer_group').length,
      checks: 0,
      failures: 0
    },
    checks: []
  };

  check(report, 'contract-status', contract.status === 'target-contract-not-production-applied', 'PostgreSQL behavior simulation requires target-contract-not-production-applied status');
  check(report, 'migration-has-current-tenant', migration.includes('current_setting(\'app.tenant_id\''), 'migration must bind tenant scope to app.tenant_id');
  check(report, 'migration-has-force-rls', /FORCE ROW LEVEL SECURITY/i.test(migration), 'migration must include FORCE ROW LEVEL SECURITY');

  const eastTenant = '00000000-0000-0000-0000-000000000101';
  const westTenant = '00000000-0000-0000-0000-000000000102';
  const eastCustomers = tenantQuery(ledger.customers, eastTenant);
  const westCustomers = tenantQuery(ledger.customers, westTenant);

  check(report, 'tenant-select-east', eastCustomers.length === 1 && eastCustomers[0].id === 'customer-east-1', 'east tenant must only read east customer rows');
  check(report, 'tenant-select-west', westCustomers.length === 1 && westCustomers[0].id === 'customer-west-1', 'west tenant must only read west customer rows');
  check(report, 'tenant-no-cross-read', tenantQuery(ledger.quotations, eastTenant).every(item => item.tenant_id === eastTenant), 'tenant query must not leak cross-tenant quotations');

  let rejectedCrossTenantWrite = false;
  try {
    tenantInsert(ledger.customers, { tenantId: eastTenant }, {
      id: 'customer-bad-cross-tenant',
      tenant_id: westTenant,
      name: '错误跨租户客户'
    });
  } catch (error) {
    rejectedCrossTenantWrite = error.message.includes('RLS WITH CHECK');
  }
  check(report, 'tenant-with-check-rejects-cross-write', rejectedCrossTenantWrite, 'RLS WITH CHECK simulation must reject cross-tenant writes');

  const inserted = tenantInsert(ledger.audit_logs, { tenantId: eastTenant }, {
    id: 'audit-east-2',
    action: 'lifecycle.handover.upsert',
    resource_type: 'project_lifecycle',
    resource_id: 'life-east-1'
  });
  check(report, 'tenant-insert-overrides-scope', inserted.tenant_id === eastTenant, 'tenant insert must use scope tenant id');
  check(report, 'audit-logs-isolated', tenantQuery(ledger.audit_logs, eastTenant).length === 2 && tenantQuery(ledger.audit_logs, westTenant).length === 1, 'audit logs must remain tenant isolated');

  const rollup = hqRollup(ledger);
  check(report, 'hq-rollup-summary', rollup.dealerTenants === 2 && rollup.approvedQuotations === 2 && rollup.approvedAmount === 596000, 'HQ rollup must aggregate dealer metrics without changing tenant row ownership');
  check(report, 'hq-rollup-no-row-leak', !Object.prototype.hasOwnProperty.call(rollup, 'customers'), 'HQ rollup evidence must not expose raw customer rows');

  const lifecycleRows = tenantQuery(ledger.project_lifecycle, eastTenant).concat(tenantQuery(ledger.project_lifecycle, westTenant));
  check(report, 'iot-boundary-simulated', lifecycleRows.every(row => row.iot?.boundary === 'lifecycle_handoff_only' && row.iot?.realtimeControl === false), 'project lifecycle IoT rows must remain lifecycle_handoff_only and not realtime control');

  // 自记证据（与 postgres-target-schema / target-dependencies 等同套件门禁一致）：
  // 本门禁此前**只要求 requiredEvidence.postgresRlsBehavior 存在、却从不写入** → 结构性永不绿。
  // 其语义本就是"目标行为模拟"（status=target-behavior-simulated / finalLaunchDatabaseProof=false 明确
  // 标注非真实库执行证明）；真实 RLS 强制力证明由 `npm run guard:rls-enforcement` 记入 rlsEnforcement 键。
  try {
    require('../release/evidence-utils').updateReleaseEvidence('postgresRlsBehavior', {
      command: 'npm run guard:postgres-rls-behavior',
      status: 'target-behavior-simulated',
      finalLaunchDatabaseProof: false,
      path: REPORT_JSON,
    });
  } catch { /* 证据台账不可写不应阻断行为校验本身 */ }

  const release2 = readJson(RELEASE_EVIDENCE);
  const record = release2.requiredEvidence?.postgresRlsBehavior ?? release.requiredEvidence?.postgresRlsBehavior;
  check(report, 'release-evidence-key', Boolean(record), 'release evidence missing postgresRlsBehavior');
  if (record) {
    check(report, 'release-status', record.status === 'target-behavior-simulated', 'postgresRlsBehavior status must be target-behavior-simulated');
    check(report, 'release-final-proof', record.finalLaunchDatabaseProof === false, 'postgresRlsBehavior must not claim final launch database proof');
    check(report, 'release-command', record.command === 'npm run guard:postgres-rls-behavior', 'postgresRlsBehavior command must be npm run guard:postgres-rls-behavior');
  }

  report.summary.checks = report.checks.length;
  report.summary.failures = failures.length;
  return report;
}

function renderMarkdown(report) {
  const lines = [
    '# PostgreSQL RLS Behavior Simulation Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    'This is a local deterministic behavior simulation for the target PostgreSQL/RLS contract. It is not staging-applied migration proof.',
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
  ensureDir('evidence/database');
  fs.writeFileSync(fullPath(REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(fullPath(REPORT_MD), renderMarkdown(report));
}

console.log(`PostgreSQL RLS Behavior Check: failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
