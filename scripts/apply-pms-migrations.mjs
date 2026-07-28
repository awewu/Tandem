#!/usr/bin/env node
/**
 * Apply PMS compatibility migrations after deployment.
 *
 * These scripts are idempotent. Run after the normal drizzle migration when
 * production reports missing PMS columns/tables.
 */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { loadPmsEnv } from './pms-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

loadPmsEnv(projectRoot);
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment or .env files');
  process.exit(1);
}

const scripts = [
  'add-opportunity-fields.mjs',
  'migrate-pms-opportunity-product.mjs',
  'migrate-pms-performance-targets-multidim.mjs',
  'migrate-pms-projects.mjs',
  'migrate-pms-tenders.mjs',
  'pms-db-verify.mjs',
];

for (const script of scripts) {
  console.log(`\n==> ${script}`);
  const result = spawnSync(process.execPath, [join(__dirname, script)], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    console.error(`PMS migration step failed: ${script}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\nPMS migrations complete.');
