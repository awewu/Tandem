#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  updateReleaseEvidence
} = require('../release/evidence-utils');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = 'database/postgres/harness/target-schema-contract.json';
const MIGRATION_PATH = 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql';
const REPORT_JSON = 'evidence/database/postgres-target-schema-report.json';
const REPORT_MD = 'evidence/database/postgres-target-schema-report.md';

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

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function tableCreatePattern(table) {
  return new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+rhautt_nexus\\.${table}\\s*\\(`, 'i');
}

function tableBlock(sql, table) {
  const start = sql.search(tableCreatePattern(table));
  if (start < 0) return '';
  const rest = sql.slice(start);
  const end = rest.search(/\n\);\s*\n/);
  return end < 0 ? rest : rest.slice(0, end + 3);
}

function assertIncludes(source, token, label) {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
}

function assertRegex(source, pattern, label) {
  if (!pattern.test(source)) failures.push(label);
}

function inspect() {
  if (!exists(CONTRACT_PATH)) failures.push(`missing ${CONTRACT_PATH}`);
  if (!exists(MIGRATION_PATH)) failures.push(`missing ${MIGRATION_PATH}`);
  if (failures.length) return null;

  const contract = readJson(CONTRACT_PATH);
  const sql = read(MIGRATION_PATH);
  const normalized = normalizeSql(sql);
  const report = {
    generatedAt: new Date().toISOString(),
    platform: contract.platform,
    status: contract.status,
    contractPath: CONTRACT_PATH,
    migrationPath: MIGRATION_PATH,
    migrationSha256: sha256(sql),
    summary: {
      requiredTables: contract.requiredTables?.length || 0,
      tenantScopedTables: contract.tenantScopedTables?.length || 0,
      capabilities: contract.requiredCapabilities?.length || 0,
      failures: 0,
      warnings: 0
    },
    checks: []
  };

  function check(name, passed, details = '') {
    report.checks.push({ name, passed, details });
    if (!passed) failures.push(details || name);
  }

  check(
    'platform-name',
    contract.platform === 'Rhautt Nexus / 瑞合数智枢纽',
    'target schema contract platform must be Rhautt Nexus / 瑞合数智枢纽'
  );
  check(
    'target-contract-status',
    contract.status === 'target-contract-not-production-applied',
    'PostgreSQL schema evidence must remain target-contract-not-production-applied until staging migration proof exists'
  );
  check(
    'migration-reference',
    contract.migration === MIGRATION_PATH,
    `target schema contract migration must be ${MIGRATION_PATH}`
  );

  for (const token of [
    'create extension if not exists pgcrypto',
    'create schema if not exists rhautt_nexus',
    'current_tenant_id()',
    'current_actor_id()',
    'lifecycle_handoff_only'
  ]) {
    check(`global-token:${token}`, normalized.includes(token), `migration missing global token: ${token}`);
  }

  for (const table of contract.requiredTables || []) {
    const block = tableBlock(sql, table);
    check(`table:${table}`, Boolean(block), `migration missing required table: ${table}`);
    if (!block) continue;

    if ((contract.tenantScopedTables || []).includes(table)) {
      check(`tenant-id:${table}`, /\btenant_id\s+uuid\s+not\s+null\b/i.test(block), `${table}: tenant_id uuid not null is required`);
    }
    check(`created-at:${table}`, /\bcreated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(block), `${table}: created_at timestamptz default now() is required`);
  }

  for (const table of contract.tenantScopedTables || []) {
    check(
      `enable-rls:${table}`,
      new RegExp(`alter\\s+table\\s+rhautt_nexus\\.${table}\\s+enable\\s+row\\s+level\\s+security`, 'i').test(sql),
      `${table}: missing ENABLE ROW LEVEL SECURITY`
    );
    check(
      `force-rls:${table}`,
      new RegExp(`alter\\s+table\\s+rhautt_nexus\\.${table}\\s+force\\s+row\\s+level\\s+security`, 'i').test(sql),
      `${table}: missing FORCE ROW LEVEL SECURITY`
    );
    check(
      `policy:${table}`,
      new RegExp(`create\\s+policy\\s+[a-z0-9_]+tenant_isolation\\s+on\\s+rhautt_nexus\\.${table}[\\s\\S]*?using\\s*\\(\\s*tenant_id\\s*=\\s*rhautt_nexus\\.current_tenant_id\\(\\)\\s*\\)[\\s\\S]*?with\\s+check\\s*\\(\\s*tenant_id\\s*=\\s*rhautt_nexus\\.current_tenant_id\\(\\)\\s*\\)`, 'i').test(sql),
      `${table}: missing tenant isolation policy with USING and WITH CHECK`
    );
  }

  const uniqueTenantBusinessKeys = [
    ['dealers', /unique\s*\(\s*tenant_id\s*,\s*code\s*\)/i],
    ['stores', /unique\s*\(\s*tenant_id\s*,\s*dealer_id\s*,\s*code\s*\)/i],
    ['users', /unique\s*\(\s*tenant_id\s*,\s*phone_hash\s*\)/i],
    ['customers', /unique\s*\(\s*tenant_id\s*,\s*phone_hash\s*\)/i],
    ['quotations', /unique\s*\(\s*tenant_id\s*,\s*quotation_no\s*,\s*version\s*\)/i],
    ['contracts', /unique\s*\(\s*tenant_id\s*,\s*contract_no\s*\)/i],
    ['file_artifacts', /unique\s*\(\s*tenant_id\s*,\s*object_key\s*\)/i],
    ['outbox_events', /unique\s*\(\s*tenant_id\s*,\s*idempotency_key\s*\)/i],
    ['workflow_instances', /unique\s*\(\s*tenant_id\s*,\s*temporal_workflow_id\s*\)/i]
  ];

  for (const [table, pattern] of uniqueTenantBusinessKeys) {
    check(`tenant-unique-key:${table}`, pattern.test(sql), `${table}: unique business key must include tenant_id`);
  }

  for (const [table, tokens] of Object.entries({
    product_modules: [
      'module_namespace text not null unique',
      'data_namespace text not null unique',
      'api_namespace text not null',
      'embedded_entry text not null',
      'standalone_aliases text[] not null',
      'embedded_in_rhautt_portal boolean not null',
      'standalone_launchable boolean not null',
      'product_independence_level text not null',
      'standalone_domain_strategy text not null',
      'standalone_app_shell_mode text not null',
      'future_database_strategy text not null',
      'current_data_mode text not null',
      'future_data_mode text not null',
      'standalone_postgres_schema text not null',
      'standalone_mongodb_database text not null',
      'standalone_object_storage_bucket text not null',
      'future_standalone_product_ready boolean not null',
      'extraction_proof_required boolean not null',
      'extraction_plan text not null',
      'object_storage_prefix text not null',
      'analytics_namespace text not null'
    ],
    product_module_deployments: [
      'product_module_id text not null',
      'deployment_mode text not null',
      'route_base text not null',
      'target_app text not null',
      'embedded_entry text not null',
      'standalone_aliases text[] not null',
      'launchable boolean not null',
      'external_domain_proof_required boolean not null',
      'standalone_app_shell_mode text not null',
      'standalone_domain_strategy text not null',
      'standalone_domain_targets text[] not null'
    ],
    product_module_data_partitions: [
      'product_module_id text not null',
      'module_namespace text not null',
      'data_namespace text not null',
      'product_namespace text not null',
      'product_data_namespace text not null',
      'postgres_partition_key text not null',
      'mongodb_namespace text not null',
      'object_storage_prefix text not null',
      'analytics_namespace text not null',
      'current_data_mode text not null',
      'future_data_mode text not null',
      'product_independence_level text not null',
      'standalone_domain_strategy text not null',
      'standalone_app_shell_mode text not null',
      'standalone_postgres_schema text not null',
      'standalone_mongodb_database text not null',
      'standalone_object_storage_bucket text not null',
      'standalone_database_target text not null',
      'extraction_plan text not null',
      'extraction_proof_required boolean not null',
      'future_standalone_product_ready boolean not null',
      'independent_database_ready boolean not null'
    ],
    audit_logs: ['actor_user_id', 'action text not null', 'resource_type text not null', 'request_id text', 'trace_id text'],
    outbox_events: ['aggregate_type text not null', 'event_type text not null', 'idempotency_key text not null', 'dead_letter'],
    workflow_instances: ['workflow_type text not null', 'temporal_workflow_id text not null', 'aggregate_type text not null'],
    workflow_steps: ['workflow_instance_id uuid not null', 'step_type text not null', 'attempt integer not null'],
    project_lifecycle: ['handoff_status text not null', 'installed_assets jsonb', 'service_plan jsonb', '"boundary":"lifecycle_handoff_only"'],
    file_artifacts: [
      'artifact_type text not null',
      "'principle-diagram'",
      "'construction-drawing'",
      "'bim-model'",
      "'bom'",
      "'quantity-takeoff'",
      "'standards-check'",
      "'customer-report'",
      'artifact_status text not null',
      "artifact_status in ('draft', 'reviewing', 'approved', 'shared', 'superseded', 'archived')",
      'object_key text not null',
      'content_hash text not null',
      'visibility text not null',
      "visibility in ('internal', 'dealer', 'customer')",
      'customer_visible boolean not null',
      'storage_provider text',
      'storage_integrity_passed boolean not null',
      'storage_integrity_checked_at timestamptz',
      "customer_visible = false or artifact_status in ('approved', 'shared')",
      'storage_integrity_passed = false or storage_integrity_checked_at is not null',
      'approved_by uuid',
      'approved_at timestamptz',
      'updated_at timestamptz not null default now()'
    ]
  })) {
    const block = normalizeSql(tableBlock(sql, table));
    for (const token of tokens) {
      check(`capability:${table}:${token}`, block.includes(token), `${table}: missing capability token ${token}`);
    }
  }

  for (const [table, tokens] of Object.entries({
    customers: ['product_module_id text not null', 'product_deployment_mode text not null', 'product_namespace text not null', 'product_data_namespace text not null'],
    opportunities: ['product_module_id text not null', 'product_deployment_mode text not null', 'product_namespace text not null', 'product_data_namespace text not null'],
    quotations: ['product_module_id text not null', 'product_deployment_mode text not null', 'product_namespace text not null', 'product_data_namespace text not null'],
    file_artifacts: ['module_id text not null', 'module_deployment_mode text not null', 'module_namespace text not null', 'data_namespace text not null']
  })) {
    const block = normalizeSql(tableBlock(sql, table));
    for (const token of tokens) {
      check(`product-domain:${table}:${token}`, block.includes(token), `${table}: missing product-domain token ${token}`);
    }
  }

  const destructivePatterns = [
    /drop\s+schema/i,
    /drop\s+table/i,
    /truncate\s+table/i
  ];
  for (const pattern of destructivePatterns) {
    if (pattern.test(sql)) warnings.push(`migration contains destructive-looking pattern: ${pattern}`);
  }

  for (const capability of contract.requiredCapabilities || []) {
    const token = capability.replace(/_/g, ' ');
    const directMatch = normalized.includes(capability.toLowerCase()) || normalized.includes(token);
    const accepted = directMatch ||
      capability === 'row_level_security' ||
      capability === 'force_row_level_security' ||
      capability === 'tenant_isolation_policy' ||
      (capability === 'product_module_registry' && normalized.includes('rhautt_nexus.product_modules')) ||
      (capability === 'product_module_deployment_registry' && normalized.includes('rhautt_nexus.product_module_deployments')) ||
      (capability === 'product_module_data_partition_registry' && normalized.includes('rhautt_nexus.product_module_data_partitions')) ||
      (capability === 'namespace_extractable_shared_ledger' && normalized.includes('namespace-extractable-shared-ledger')) ||
      (capability === 'shared_foundation_product_domain_partitioned' && normalized.includes('shared-foundation-product-domain-partitioned')) ||
      (capability === 'standalone_database_extractable' && normalized.includes('standalone-database-extractable'));
    check(`contract-capability:${capability}`, accepted, `contract capability not represented in migration: ${capability}`);
  }

  assertIncludes(normalized, 'create index if not exists audit_tenant_resource_idx', 'audit index');
  assertIncludes(normalized, 'create index if not exists outbox_delivery_idx', 'outbox delivery index');
  assertIncludes(normalized, 'create index if not exists workflow_tenant_status_idx', 'workflow status index');
  assertIncludes(normalized, 'create index if not exists product_modules_namespace_idx', 'product module namespace index');
  assertIncludes(normalized, 'create index if not exists product_modules_launch_idx', 'product module launch index');
  assertIncludes(normalized, 'create index if not exists product_module_deployments_launch_idx', 'product module deployment launch index');
  assertIncludes(normalized, 'create index if not exists product_module_data_partitions_extract_idx', 'product module data partition extraction index');
  assertIncludes(normalized, 'create index if not exists customers_tenant_product_namespace_idx', 'customers product namespace index');
  assertIncludes(normalized, 'create index if not exists opportunities_tenant_product_namespace_idx', 'opportunities product namespace index');
  assertIncludes(normalized, 'create index if not exists quotations_tenant_product_namespace_idx', 'quotations product namespace index');
  assertIncludes(normalized, 'create index if not exists artifacts_tenant_data_namespace_idx', 'artifact data namespace index');
  assertIncludes(normalized, 'create index if not exists artifacts_tenant_customer_package_idx', 'Rysnova/customer artifact package query index');
  assertIncludes(normalized, 'create index if not exists artifacts_tenant_customer_signoff_idx', 'Rysnova/customer signoff artifact query index');
  assertIncludes(normalized, 'create index if not exists artifacts_tenant_storage_integrity_idx', 'artifact storage integrity query index');
  assertRegex(sql, /CHECK\s*\(\s*status\s+IN\s*\('pending',\s*'delivering',\s*'delivered',\s*'dead_letter'\)\s*\)/i, 'outbox_events: status check must include dead_letter');

  for (const [moduleId, tokens] of Object.entries({
    'rysnova-consumer-system': [
      "'瑞诺瓦'",
      "'consumer-comfort-system-brand'",
      "'rysnova'",
      "'/api/v2/diagnosis'",
      "'/pain-diagnosis.html'",
      "'/rysnova-ai'",
      "'namespace-extractable-shared-ledger'",
      "'shared-foundation-product-domain-partitioned'",
      "'standalone-database-extractable'",
      "'portal-embedded-and-standalone-extractable'",
      "'dedicated-domain-or-subdomain-required'",
      "'independent-product-app-shell'",
      "'rysnova_documents'",
      "'rysnova-product-artifacts'",
      "'extract-by-product_data_namespace-modulenamespace-datanamespace-objectstorageprefix'",
      "'rysnova-owned-postgres-schema-plus-mongodb-namespace'",
      "'rysnova/'",
      "'consumer-diagnosis-product-owner'"
    ],
    'rysnova-bim-engineering-support': [
      "'Rysnova'",
      "'engineering-bim-technical-support'",
      "'rysnova-bim'",
      "'/api/v2/rysnova-bim'",
      "'/rysnova-bim-designer.html'",
      "'/rysnova-bim-workbench'",
      "'namespace-extractable-shared-ledger'",
      "'shared-foundation-product-domain-partitioned'",
      "'standalone-database-extractable'",
      "'portal-embedded-and-standalone-extractable'",
      "'dedicated-domain-or-subdomain-required'",
      "'independent-product-app-shell'",
      "'rysnova-bim_documents'",
      "'rysnova-bim-product-artifacts'",
      "'extract-by-data_namespace-modulenamespace-objectstorageprefix-artifacthashes'",
      "'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace'",
      "'rysnova-bim/'",
      "'solution-design-rysnova-bim-director'"
    ]
  })) {
    check(`product-module-seed:${moduleId}`, normalized.includes(`'${moduleId}'`), `product_modules seed missing ${moduleId}`);
    for (const token of tokens) {
      check(`product-module-seed:${moduleId}:${token}`, normalized.includes(token.toLowerCase()), `product_modules seed ${moduleId} missing ${token}`);
    }
  }

  report.summary.failures = failures.length;
  report.summary.warnings = warnings.length;
  report.warnings = warnings;
  return report;
}

function renderMarkdown(report) {
  const lines = [
    '# PostgreSQL Target Schema Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    `Migration: \`${report.migrationPath}\``,
    '',
    `Migration SHA-256: \`${report.migrationSha256}\``,
    '',
    '| Check | Result | Details |',
    '|---|---:|---|'
  ];
  for (const check of report.checks) {
    lines.push(`| ${check.name} | ${check.passed ? 'pass' : 'fail'} | ${String(check.details || '').replace(/\|/g, '/')} |`);
  }
  if (report.warnings?.length) {
    lines.push('', '## Warnings', '');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  return lines.join('\n');
}

const report = inspect();

if (report) {
  fs.mkdirSync(fullPath('evidence/database'), { recursive: true });
  fs.writeFileSync(fullPath(REPORT_JSON), JSON.stringify(report, null, 2));
  fs.writeFileSync(fullPath(REPORT_MD), renderMarkdown(report));
  updateReleaseEvidence('postgresTargetSchema', {
    command: 'npm run guard:postgres-target-schema',
    status: 'target-contract-guarded',
    path: REPORT_JSON,
    summaryPath: REPORT_MD,
    contractPath: CONTRACT_PATH,
    migrationPath: MIGRATION_PATH,
    tables: report.summary.requiredTables,
    tenantScopedTables: report.summary.tenantScopedTables,
    capabilities: readJson(CONTRACT_PATH).requiredCapabilities || [],
    note: 'Target PostgreSQL/RLS ledger contract only. This is not staging-applied migration proof.'
  });
}

console.log(`PostgreSQL Target Schema Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
