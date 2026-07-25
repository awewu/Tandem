#!/usr/bin/env node
/**
 * PMS · 招投标 + 提交物 (Phase 2, 幂等 DDL)
 *   - pms_tenders     招投标记录 (FSM preparing→submitted→opened→won|lost)
 *   - pms_submittals  提交物/图纸版本管理 (supersedesId 链式)
 * 全部 CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS, 可重复执行。
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
    console.error('.env.local not found');
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

const DDL = `
CREATE TABLE IF NOT EXISTS pms_tenders (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "projectId" text NOT NULL,
  "tenderNo" text,
  "tenderName" text NOT NULL,
  "tenderType" text NOT NULL DEFAULT 'open',
  "status" text NOT NULL DEFAULT 'preparing',
  "bidAmount" numeric,
  "budgetAmount" numeric,
  "publishedAt" text,
  "submitDeadline" text,
  "submittedAt" text,
  "openedAt" text,
  "winnerName" text,
  "ourRank" integer,
  "result" text,
  "notes" text,
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  "archivedAt" timestamp(3)
);
CREATE INDEX IF NOT EXISTS pms_tender_project_idx ON pms_tenders ("projectId", "status");
CREATE INDEX IF NOT EXISTS pms_tender_tenant_idx ON pms_tenders ("tenantId");

CREATE TABLE IF NOT EXISTS pms_submittals (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "projectId" text NOT NULL,
  "tenderId" text,
  "docType" text NOT NULL DEFAULT 'drawing',
  "title" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "fileUrl" text,
  "status" text NOT NULL DEFAULT 'draft',
  "submittedTo" text,
  "submittedAt" text,
  "reviewedBy" text,
  "reviewedAt" text,
  "reviewNotes" text,
  "supersedesId" text,
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  "archivedAt" timestamp(3)
);
CREATE INDEX IF NOT EXISTS pms_submittal_project_idx ON pms_submittals ("projectId", "docType");
CREATE INDEX IF NOT EXISTS pms_submittal_tender_idx ON pms_submittals ("tenderId");
CREATE INDEX IF NOT EXISTS pms_submittal_tenant_idx ON pms_submittals ("tenantId");
`;

async function main() {
  let databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }
  databaseUrl = databaseUrl.split('?')[0];
  console.log('Connecting to database...');
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    console.log('Applying pms tenders + submittals migration (idempotent)...');
    await sql.unsafe(DDL);
    for (const tbl of ['pms_tenders', 'pms_submittals']) {
      const cols = await sql`
        SELECT column_name FROM information_schema.columns
         WHERE table_name = ${tbl}
         ORDER BY ordinal_position`;
      console.log(`OK ${tbl}:`, cols.map((c) => c.column_name).join(', '));
    }
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
