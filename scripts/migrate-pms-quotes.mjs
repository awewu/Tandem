#!/usr/bin/env node
/**
 * PMS · 报价单表 pms_quotes (幂等 DDL)
 *
 * 三层文档模型: 方案(单头) → 系统[] → 明细[], systems/terms 存 jsonb。
 * 报价即凭证: 改价=新版本(version+1, 旧版 superseded)。
 * 验真: verifyCode 唯一 (NULL 允许多个=草稿), 公开查询只回真伪+授权经销商。
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
CREATE TABLE IF NOT EXISTS pms_quotes (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "orgId" text NOT NULL,
  "dealerOrgId" text NOT NULL,
  "opportunityId" text NOT NULL,
  "projectId" text,
  "issuerId" text NOT NULL,
  "title" text NOT NULL,
  "customerName" text NOT NULL,
  "customerContact" text,
  "scenario" text,
  "systems" jsonb DEFAULT '[]'::jsonb,
  "currency" text NOT NULL DEFAULT 'CNY',
  "equipmentTotal" numeric DEFAULT '0',
  "materialTotal" numeric DEFAULT '0',
  "installTotal" numeric DEFAULT '0',
  "freightTotal" numeric DEFAULT '0',
  "taxTotal" numeric DEFAULT '0',
  "serviceTotal" numeric DEFAULT '0',
  "otherTotal" numeric DEFAULT '0',
  "totalAmount" numeric DEFAULT '0',
  "terms" jsonb,
  "validUntil" timestamp(3),
  "version" integer NOT NULL DEFAULT 1,
  "status" text NOT NULL DEFAULT 'draft',
  "verifyCode" text,
  "supersededById" text,
  "issuedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pms_quote_opportunity_idx ON pms_quotes ("opportunityId", "status");
CREATE INDEX IF NOT EXISTS pms_quote_dealer_idx ON pms_quotes ("dealerOrgId", "status", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS pms_quote_verify_idx ON pms_quotes ("verifyCode");
CREATE INDEX IF NOT EXISTS pms_quote_tenant_idx ON pms_quotes ("tenantId");
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
    console.log('Applying pms_quotes migration (idempotent)...');
    await sql.unsafe(DDL);
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
       WHERE table_name = 'pms_quotes'
       ORDER BY ordinal_position`;
    console.log('OK. pms_quotes columns:', cols.map((c) => c.column_name).join(', '));
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
