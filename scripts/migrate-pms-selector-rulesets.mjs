#!/usr/bin/env node
/**
 * PMS · 选型规则集表 pms_selector_rulesets (幂等 DDL)
 *
 * P3 选型配置器: inputFields(工况问卷) + rules(选型规则) 存 jsonb, 配置驱动。
 * 状态 draft/published/archived。软删 archivedAt。
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
CREATE TABLE IF NOT EXISTS pms_selector_rulesets (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "name" text NOT NULL,
  "category" text,
  "scenario" text,
  "description" text,
  "systemName" text,
  "version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'draft',
  "inputFields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  "publishedAt" timestamp(3),
  "archivedAt" timestamp(3)
);

CREATE INDEX IF NOT EXISTS pms_selector_status_idx ON pms_selector_rulesets ("tenantId", "status");
CREATE INDEX IF NOT EXISTS pms_selector_category_idx ON pms_selector_rulesets ("tenantId", "category");
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
    console.log('Applying pms_selector_rulesets migration (idempotent)...');
    await sql.unsafe(DDL);
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pms_selector_rulesets'
       ORDER BY ordinal_position`;
    console.log('OK. pms_selector_rulesets columns:', cols.map((c) => c.column_name).join(', '));
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
