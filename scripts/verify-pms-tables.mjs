#!/usr/bin/env node
/**
 * Verify PMS Typed Tables exist
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
    console.error('❌ DATABASE_URL not found');
    process.exit(1);
  }

  databaseUrl = databaseUrl.split('?')[0];
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('🔍 Checking PMS tables...\n');

    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE 'pms_%'
      ORDER BY table_name
    `;

    if (tables.length === 0) {
      console.log('❌ No PMS tables found!');
      process.exit(1);
    }

    console.log(`✅ Found ${tables.length} PMS tables:\n`);
    tables.forEach((t, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${t.table_name}`);
    });

    // Check indexes
    console.log('\n🔍 Checking indexes...\n');
    const indexes = await sql`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename LIKE 'pms_%'
      ORDER BY tablename, indexname
    `;

    console.log(`✅ Found ${indexes.length} indexes on PMS tables\n`);

    // Group by table
    const byTable = {};
    indexes.forEach(idx => {
      if (!byTable[idx.tablename]) byTable[idx.tablename] = [];
      byTable[idx.tablename].push(idx.indexname);
    });

    Object.entries(byTable).forEach(([table, idxs]) => {
      console.log(`${table}: ${idxs.length} indexes`);
    });

    console.log('\n✅ PMS Typed Tables verification complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
