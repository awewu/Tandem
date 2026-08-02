#!/usr/bin/env node
/**
 * PMS · 选型规则集版本快照表 pms_selector_ruleset_versions (幂等 DDL)
 *
 * P3 治理: 每次 publish 冻结一份 inputFields+rules 快照, 供审计追溯 / 回滚参考。
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
CREATE TABLE IF NOT EXISTS pms_selector_ruleset_versions (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "rulesetId" text NOT NULL,
  "version" integer NOT NULL,
  "name" text NOT NULL,
  "category" text,
  "scenario" text,
  "systemName" text,
  "inputFields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "rules" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "publishedBy" text NOT NULL,
  "publishedAt" timestamp(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pms_selector_version_ruleset_idx ON pms_selector_ruleset_versions ("tenantId", "rulesetId");
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
    console.log('Applying pms_selector_ruleset_versions migration (idempotent)...');
    await sql.unsafe(DDL);
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pms_selector_ruleset_versions'
       ORDER BY ordinal_position`;
    console.log('OK. pms_selector_ruleset_versions columns:', cols.map((c) => c.column_name).join(', '));
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
