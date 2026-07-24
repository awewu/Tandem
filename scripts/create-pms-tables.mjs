#!/usr/bin/env node
/**
 * Create PMS Typed Tables only
 * 只创建 PMS 表，跳过已存在的其他表
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
  console.log('🔗 Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Read full migration file
    const migrationPath = join(projectRoot, 'drizzle/migrations/0015_parallel_maddog.sql');
    console.log(`📄 Reading migration: ${migrationPath}`);
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    // Extract only PMS table statements
    const statements = migrationSQL.split('-->statement-breakpoint');
    const pmsStatements = statements.filter(stmt => 
      stmt.includes('CREATE TABLE "pms_') || stmt.includes('CREATE INDEX') && stmt.includes('pms_') || stmt.includes('CREATE UNIQUE INDEX') && stmt.includes('pms_')
    );

    console.log(`🚀 Found ${pmsStatements.length} PMS-related statements`);
    console.log('📊 Creating PMS tables and indexes...\n');

    let created = 0;
    let skipped = 0;

    for (const stmt of pmsStatements) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;

      try {
        await sql.unsafe(trimmed);
        
        // Extract table/index name for logging
        const match = trimmed.match(/CREATE (?:UNIQUE )?(?:TABLE|INDEX) "?([^"\s(]+)"?/);
        if (match) {
          console.log(`✅ Created: ${match[1]}`);
          created++;
        }
      } catch (error) {
        if (error.code === '42P07' || error.code === '42710') {
          // Table or index already exists
          const match = trimmed.match(/CREATE (?:UNIQUE )?(?:TABLE|INDEX) "?([^"\s(]+)"?/);
          if (match) {
            console.log(`⏭️  Skipped (exists): ${match[1]}`);
            skipped++;
          }
        } else {
          console.error(`❌ Error in statement:`, error.message);
          console.error('Statement:', trimmed.substring(0, 100) + '...');
          throw error;
        }
      }
    }

    console.log(`\n✅ Migration completed!`);
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${created + skipped}`);

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
