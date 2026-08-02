#!/usr/bin/env node
/**
 * PMS · 报价方案模板表 pms_quote_templates (幂等 DDL)
 *
 * 常用系统方案(系统+明细+条款)存为模板, systems/terms 存 jsonb。
 * 归属: tenantId + orgId; isShared=true → 租户内跨组织共享。软删 archivedAt。
 *
 * 全部 IF NOT EXISTS 守卫, 可重复执行。绝不 drizzle-kit push。
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { loadPmsEnv } from './pms-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

loadPmsEnv(projectRoot);

const DDL = `
CREATE TABLE IF NOT EXISTS pms_quote_templates (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "orgId" text NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "scenario" text,
  "description" text,
  "systems" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "terms" jsonb,
  "isShared" boolean NOT NULL DEFAULT false,
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  "archivedAt" timestamp(3)
);

CREATE INDEX IF NOT EXISTS pms_quote_tpl_org_idx ON pms_quote_templates ("tenantId", "orgId");
CREATE INDEX IF NOT EXISTS pms_quote_tpl_shared_idx ON pms_quote_templates ("tenantId", "isShared");
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
    console.log('Applying pms_quote_templates migration (idempotent)...');
    await sql.unsafe(DDL);
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pms_quote_templates'
       ORDER BY ordinal_position`;
    console.log('OK. pms_quote_templates columns:', cols.map((c) => c.column_name).join(', '));
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
