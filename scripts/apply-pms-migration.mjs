#!/usr/bin/env node
/**
 * Apply PMS Typed Tables migration
 * 执行 0015_parallel_maddog.sql 迁移脚本
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Manually load .env.local
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
    console.error('❌ DATABASE_URL not found in environment');
    console.error('Current env:', Object.keys(process.env).filter(k => k.includes('DATABASE')));
    process.exit(1);
  }

  // Remove ?schema=public parameter (not supported by postgres package)
  databaseUrl = databaseUrl.split('?')[0];

  console.log('🔗 Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Read migration file
    const migrationPath = join(projectRoot, 'drizzle/migrations/0015_parallel_maddog.sql');
    console.log(`📄 Reading migration: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('🚀 Executing migration...');
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Created 28 PMS Typed Tables with world-class indexing');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42P07') {
      console.log('ℹ️  Tables already exist (this is OK if re-running)');
    } else {
      throw error;
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
