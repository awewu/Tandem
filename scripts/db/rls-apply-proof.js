#!/usr/bin/env node
/**
 * LOCAL RLS apply proof — applies the curated core-ledger migration to a real
 * PostgreSQL instance and proves Row Level Security tenant isolation works at
 * the database layer, inside a single transaction that is ALWAYS rolled back
 * (nothing is persisted: no schema, no role, no rows).
 *
 * This is a LOCAL correctness proof, NOT staging launch proof. It deliberately
 * writes to evidence/database/local-rls-apply-proof.* and never claims
 * finalLaunchDatabaseProof — staging proof requires POSTGRES_STAGING_URL against
 * non-local infrastructure via `npm run release:postgres-staging:smoke`.
 *
 * Connection: RLS_PROOF_DATABASE_URL or DATABASE_URL, else local default.
 *   node scripts/db/rls-apply-proof.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..', '..');
const MIGRATION = path.join(ROOT, 'database', 'postgres', 'migrations', '001_rhautt_nexus_core_ledger.sql');
const REPORT_JSON = path.join(ROOT, 'evidence', 'database', 'local-rls-apply-proof.json');
const REPORT_MD = path.join(ROOT, 'evidence', 'database', 'local-rls-apply-proof.md');

const APP_ROLE = 'rhautt_nexus_local_rls_proof_app';
const TENANT_A = '10000000-0000-0000-0000-0000000000a1';
const TENANT_B = '10000000-0000-0000-0000-0000000000b2';
const ACTOR_A = '60000000-0000-0000-0000-0000000000a1';

const checks = [];
function record(name, passed, details = '') {
  checks.push({ name, passed, details });
}

function connConfig() {
  const url = process.env.RLS_PROOF_DATABASE_URL || process.env.DATABASE_URL;
  if (url) return { connectionString: url };
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || process.env.USER,
    database: process.env.RLS_PROOF_DB || 'postgres',
  };
}

async function expectReject(client, label, sql, params) {
  await client.query('SAVEPOINT sp_reject');
  try {
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT sp_reject');
    record(label, false, 'expected rejection but statement succeeded');
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT sp_reject');
    record(label, true, `rejected: ${err.code || err.message}`);
  }
}

async function main() {
  const migrationSql = fs.readFileSync(MIGRATION, 'utf8');
  const migrationSha = crypto.createHash('sha256').update(migrationSql).digest('hex');
  const client = new Client(connConfig());
  await client.connect();
  let connected = true;
  try {
    await client.query('BEGIN');

    // 1) Apply curated migration (rolled back at the end).
    await client.query(migrationSql);
    record('migration-applies', true, '001_rhautt_nexus_core_ledger.sql applied in transaction');

    // 2) App role that is subject to FORCE RLS (not table owner).
    await client.query(`DROP ROLE IF EXISTS ${APP_ROLE}`);
    await client.query(`CREATE ROLE ${APP_ROLE} NOLOGIN`);
    await client.query(`GRANT USAGE ON SCHEMA rhautt_nexus TO ${APP_ROLE}`);
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rhautt_nexus TO ${APP_ROLE}`);

    // 3) Seed two tenants as owner.
    await client.query(
      `INSERT INTO rhautt_nexus.tenants (id, code, name, tenant_type) VALUES ($1,'proof-a','Proof A','dealer_group'), ($2,'proof-b','Proof B','dealer_group')`,
      [TENANT_A, TENANT_B],
    );

    // 4) Enter app role + tenant A scope (the same set_config the app uses).
    await client.query(`SET LOCAL ROLE ${APP_ROLE}`);
    await client.query('SELECT set_config($1,$2,true)', ['app.tenant_id', TENANT_A]);
    await client.query('SELECT set_config($1,$2,true)', ['app.actor_id', ACTOR_A]);

    // 5) Insert a tenant-A customer (allowed by WITH CHECK).
    await client.query(
      `INSERT INTO rhautt_nexus.customers (tenant_id, phone_hash, phone_encrypted, name, status) VALUES ($1,'proof-hash-a','enc-a','Proof Customer A','active')`,
      [TENANT_A],
    );
    record('tenant-scoped-insert', true, 'tenant A insert accepted under RLS WITH CHECK');

    // 6) Tenant A sees exactly its own row.
    const aCount = await client.query('SELECT count(*)::int AS n FROM rhautt_nexus.customers');
    record('tenant-scoped-select', aCount.rows[0].n === 1, `tenant A visible customers = ${aCount.rows[0].n} (expected 1)`);

    // 7) Cross-tenant write is rejected by WITH CHECK.
    await expectReject(
      client,
      'cross-tenant-write-rejected',
      `INSERT INTO rhautt_nexus.customers (tenant_id, phone_hash, phone_encrypted, name, status) VALUES ($1,'proof-hash-bad','enc-bad','Bad Cross Tenant','active')`,
      [TENANT_B],
    );

    // 8) Switch to tenant B → cannot see tenant A rows (USING isolation).
    await client.query('SELECT set_config($1,$2,true)', ['app.tenant_id', TENANT_B]);
    const bCount = await client.query('SELECT count(*)::int AS n FROM rhautt_nexus.customers');
    record('cross-tenant-read-isolated', bCount.rows[0].n === 0, `tenant B visible customers = ${bCount.rows[0].n} (expected 0)`);

    // 9) FORCE RLS active on the critical tenant tables.
    await client.query('RESET ROLE');
    const force = await client.query(`
      SELECT count(*)::int AS n FROM pg_class c
      JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
      WHERE nsp.nspname = 'rhautt_nexus'
        AND c.relname IN ('customers','quotations','project_lifecycle','audit_logs','outbox_events','workflow_instances','workflow_steps')
        AND c.relrowsecurity = true AND c.relforcerowsecurity = true
    `);
    record('force-rls-critical-tables', force.rows[0].n === 7, `FORCE RLS critical tables = ${force.rows[0].n} (expected 7)`);

    await client.query('ROLLBACK');
  } catch (err) {
    record('execution', false, err.message);
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
  } finally {
    if (connected) await client.end().catch(() => {});
  }

  const failed = checks.filter((c) => !c.passed);
  const report = {
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    generatedAt: new Date().toISOString(),
    status: failed.length ? 'failed-local-apply' : 'passed-local-apply',
    mode: 'local-rls-apply-proof',
    scope: 'LOCAL correctness proof only — NOT staging/launch proof',
    migrationPath: 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql',
    migrationSha256: migrationSha,
    finalLaunchDatabaseProof: false,
    checks,
    note: 'Applied to a real PostgreSQL inside a rolled-back transaction; nothing persisted. Staging proof still requires POSTGRES_STAGING_URL against non-local infra.',
  };
  fs.mkdirSync(path.dirname(REPORT_JSON), { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(
    REPORT_MD,
    [
      '# Local RLS Apply Proof',
      '',
      `Generated: ${report.generatedAt}`,
      `Status: ${report.status}`,
      `Scope: ${report.scope}`,
      `Migration SHA-256: \`${report.migrationSha256}\``,
      '',
      '| Check | Result | Details |',
      '|---|---:|---|',
      ...checks.map((c) => `| ${c.name} | ${c.passed ? 'pass' : 'fail'} | ${String(c.details).replace(/\|/g, '/')} |`),
      '',
    ].join('\n'),
  );

  console.log(`Local RLS apply proof: ${report.status} (${checks.length - failed.length}/${checks.length} checks)`);
  for (const c of checks) console.log(`  ${c.passed ? 'PASS' : 'FAIL'} ${c.name} — ${c.details}`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(`rls-apply-proof error: ${err.message}`);
  process.exit(1);
});
