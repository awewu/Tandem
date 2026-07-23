#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const REPORT_JSON = 'evidence/database/postgres-staging-smoke-report.json';
const REPORT_MD = 'evidence/database/postgres-staging-smoke-report.md';
const MIGRATION_PATH = 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql';
const SCRIPT_PATH = 'scripts/release/postgres-staging-smoke.js';

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

for (const file of [RELEASE_EVIDENCE, REPORT_JSON, REPORT_MD, MIGRATION_PATH, SCRIPT_PATH, 'package.json']) {
  if (!exists(file)) fail(`missing PostgreSQL staging smoke file: ${file}`);
}

if (!failures.length) {
  const release = readJson(RELEASE_EVIDENCE);
  const report = readJson(REPORT_JSON);
  const packageJson = readJson('package.json');
  const script = read(SCRIPT_PATH);
  const record = release.requiredEvidence?.postgresStagingSmoke;

  if (packageJson.scripts?.['release:postgres-staging:smoke'] !== 'node scripts/release/postgres-staging-smoke.js') {
    fail('package.json release:postgres-staging:smoke must run node scripts/release/postgres-staging-smoke.js');
  }

  if (!record) {
    fail('release evidence missing postgresStagingSmoke');
  } else {
    if (record.command !== 'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke') {
      fail('postgresStagingSmoke command must document POSTGRES_STAGING_URL launch gate');
    }
    if (record.path !== REPORT_JSON) fail(`postgresStagingSmoke path must be ${REPORT_JSON}`);
    if (record.summaryPath !== REPORT_MD) fail(`postgresStagingSmoke summaryPath must be ${REPORT_MD}`);
    if (record.migrationPath !== MIGRATION_PATH) fail(`postgresStagingSmoke migrationPath must be ${MIGRATION_PATH}`);
  }

  if (report.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    fail('PostgreSQL staging smoke report platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  if (report.migrationPath !== MIGRATION_PATH) {
    fail(`PostgreSQL staging smoke report migrationPath must be ${MIGRATION_PATH}`);
  }
  if (report.migrationSha256 !== fileSha256(MIGRATION_PATH)) {
    fail('PostgreSQL staging smoke report is stale; rerun npm run release:postgres-staging:smoke');
  }

  const acceptedStatuses = ['missing-staging-run', 'passed-staging-current-run', 'failed-staging-current-run'];
  if (!acceptedStatuses.includes(report.status)) {
    fail(`PostgreSQL staging smoke status is invalid: ${report.status}`);
  }

  if (report.status === 'passed-staging-current-run') {
    if (report.finalLaunchDatabaseProof !== true) {
      fail('passed staging PostgreSQL smoke must set finalLaunchDatabaseProof true');
    }
    if (record?.status !== 'passed-staging-current-run') {
      fail('release evidence postgresStagingSmoke status must match passed-staging-current-run');
    }
    if (record?.finalLaunchDatabaseProof !== true) {
      fail('release evidence postgresStagingSmoke must set finalLaunchDatabaseProof true only after staging pass');
    }
    for (const check of report.checks || []) {
      if (check.passed !== true) fail(`PostgreSQL staging smoke failed check: ${check.name}`);
    }
    const checksByName = new Map((report.checks || []).map(check => [check.name, check]));
    for (const checkName of [
      'rysnovaBimCustomerPackageReadyOutbox',
      'rysnovaBimCustomerSignoffConfirmedOutbox',
      'rysnovaBimCustomerSignoffWorkflow',
      'rysnovaBimCustomerSignoffSanitizedReceipt'
    ]) {
      if (checksByName.get(checkName)?.passed !== true) {
        fail(`passed PostgreSQL staging smoke must prove ${checkName}`);
      }
    }
  }

  if (report.status === 'missing-staging-run') {
    if (report.finalLaunchDatabaseProof !== false) {
      fail('missing PostgreSQL staging smoke must not claim finalLaunchDatabaseProof');
    }
    if (record?.status !== 'missing-staging-run') {
      fail('release evidence postgresStagingSmoke status must remain missing-staging-run');
    }
    if (record?.finalLaunchDatabaseProof !== false) {
      fail('release evidence postgresStagingSmoke must not claim final launch proof while missing staging run');
    }
    if (!String(report.reason || '').includes('POSTGRES_STAGING_URL') && !String(report.reason || '').includes('psql')) {
      fail('missing PostgreSQL staging smoke report must explain POSTGRES_STAGING_URL or psql blocker');
    }
    warnings.push(`PostgreSQL staging smoke is missing: ${report.reason}`);
  }

  if (report.status === 'failed-staging-current-run') {
    if (report.finalLaunchDatabaseProof !== false) {
      fail('failed PostgreSQL staging smoke must not claim finalLaunchDatabaseProof');
    }
    fail('PostgreSQL staging smoke has a failed staging current run');
  }

  for (const token of [
    'POSTGRES_STAGING_URL',
    'psql',
    'BEGIN;',
    'ROLLBACK;',
    'SET LOCAL ROLE',
    'SET LOCAL app.tenant_id',
    'cross-tenant write was not rejected',
    'lifecycle_handoff_only',
    'rysnova-bim.customer_package.ready',
    'rysnova-bim.customer_signoff.confirmed',
    'rysnova-bim-customer-signoff-workflow',
    'rawSensitiveEvidenceOmitted',
    'FORCE RLS',
    'finalLaunchDatabaseProof'
  ]) {
    if (!script.includes(token)) fail(`postgres staging smoke script missing token: ${token}`);
  }
}

console.log(`PostgreSQL Staging Smoke Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
