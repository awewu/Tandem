#!/usr/bin/env node
/**
 * PMS · 项目型销售骨架 (Phase 1, 幂等 DDL)
 *
 * 新建三张表 + 给 pms_opportunities 增加 projectId:
 *   - pms_projects              工程项目 (核心父对象)
 *   - pms_project_stakeholders  项目干系人 (决策链地图)
 *   - pms_spec_positions        规格指定矩阵 (spec-in tracking)
 *
 * 全部 CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS,
 * 可重复执行, 不触碰既有列/数据。
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
CREATE TABLE IF NOT EXISTS pms_projects (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "orgId" text NOT NULL,
  "projectCode" text NOT NULL,
  "projectName" text NOT NULL,
  "projectType" text NOT NULL DEFAULT 'new_construction',
  "customerName" text,
  "customerAccountId" text,
  "region" text,
  "channel" text,
  "address" text,
  "addressGeo" jsonb,
  "designInstitute" text,
  "stage" text NOT NULL DEFAULT 'lead',
  "status" text NOT NULL DEFAULT 'active',
  "estimatedValue" numeric,
  "ownerId" text,
  "expectedTenderDate" text,
  "expectedAwardDate" text,
  "detectedAt" text,
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  "archivedAt" timestamp(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS pms_project_code_idx ON pms_projects ("tenantId", "projectCode");
CREATE INDEX IF NOT EXISTS pms_project_org_stage_idx ON pms_projects ("orgId", "stage", "status");
CREATE INDEX IF NOT EXISTS pms_project_region_idx ON pms_projects ("tenantId", "region", "stage");
CREATE INDEX IF NOT EXISTS pms_project_tenant_idx ON pms_projects ("tenantId");

CREATE TABLE IF NOT EXISTS pms_project_stakeholders (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "projectId" text NOT NULL,
  "role" text NOT NULL,
  "name" text NOT NULL,
  "company" text,
  "title" text,
  "phone" text,
  "email" text,
  "influence" text NOT NULL DEFAULT 'medium',
  "isChampion" boolean NOT NULL DEFAULT false,
  "isEconomicBuyer" boolean NOT NULL DEFAULT false,
  "notes" text,
  "createdBy" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  "archivedAt" timestamp(3)
);
CREATE INDEX IF NOT EXISTS pms_stakeholder_project_idx ON pms_project_stakeholders ("projectId", "role");
CREATE INDEX IF NOT EXISTS pms_stakeholder_tenant_idx ON pms_project_stakeholders ("tenantId");

CREATE TABLE IF NOT EXISTS pms_spec_positions (
  "id" text PRIMARY KEY,
  "tenantId" text NOT NULL DEFAULT 'default',
  "projectId" text NOT NULL,
  "equipmentFamily" text NOT NULL,
  "ourBrandStatus" text NOT NULL DEFAULT 'not_specified',
  "ourProductSeriesCode" text,
  "ourProductModel" text,
  "competitorBrand" text,
  "competitorModel" text,
  "estimatedValue" numeric,
  "specStage" text NOT NULL DEFAULT 'design',
  "notes" text,
  "createdBy" text NOT NULL,
  "updatedBy" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
  "archivedAt" timestamp(3)
);
CREATE INDEX IF NOT EXISTS pms_spec_project_idx ON pms_spec_positions ("projectId", "equipmentFamily");
CREATE INDEX IF NOT EXISTS pms_spec_status_idx ON pms_spec_positions ("tenantId", "ourBrandStatus");
CREATE INDEX IF NOT EXISTS pms_spec_tenant_idx ON pms_spec_positions ("tenantId");

ALTER TABLE pms_opportunities ADD COLUMN IF NOT EXISTS "projectId" text;
CREATE INDEX IF NOT EXISTS pms_opp_project_idx ON pms_opportunities ("projectId");
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
    console.log('Applying pms projects skeleton migration (idempotent)...');
    await sql.unsafe(DDL);
    for (const tbl of ['pms_projects', 'pms_project_stakeholders', 'pms_spec_positions']) {
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
