#!/usr/bin/env node
/**
 * Apply PMS tables only migration
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function loadEnv() {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) {
    console.error('❌ .env.local not found');
    process.exit(1);
  }
  
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    if (!key) continue;
    let value = valueParts.join('=').trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key.trim()] = value;
  }
}

loadEnv();

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  databaseUrl = databaseUrl.split('?')[0];
  console.log('🔗 Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const migrationPath = join(projectRoot, 'drizzle/migrations/pms-tables-only.sql');
    console.log(`📄 Reading PMS migration: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Executing PMS migration...\n');
    await sql.unsafe(migrationSQL);

    console.log('\n✅ PMS tables and indexes created successfully!');
    console.log('📊 28 tables + 87 indexes for world-class 百万级数据支持');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
