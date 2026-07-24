#!/usr/bin/env node
/**
 * One-shot: insert PMS launchpad tile into existing database (idempotent).
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function loadEnv() {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) { console.error('.env.local not found'); process.exit(1); }
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

const dbUrl = (process.env.DATABASE_URL || '').replace(/\?schema=.*$/, '');
const sql = postgres(dbUrl);

async function main() {
  const existing = await sql`SELECT id FROM "LaunchpadApp" WHERE url = '/pms' AND "tenantId" = 'default' LIMIT 1`;
  if (existing.length > 0) {
    console.log('[skip] PMS launchpad tile already exists:', existing[0].id);
    await sql.end();
    process.exit(0);
  }

  const id = 'lp-pms-' + Date.now().toString(36);
  await sql`
    INSERT INTO "LaunchpadApp" (
      "id", "category", "name", "description", "iconUrl", "url",
      "ssoMode", "ssoConfig", "visibleTo", "visibleToRoles",
      "order", "recommendKeywords", "unreadAdapter", "status", "tenantId"
    ) VALUES (
      ${id}, 'business', ${'销售商机 PMS'}, ${'项目报备 · 智能查重 · 全生命周期跟进'}, NULL, '/pms',
      'none', NULL, ARRAY[]::text[], ARRAY[]::text[],
      9, ARRAY['销售','商机','pms','经销商','合同','交付'], NULL, 'active', 'default'
    )
  `;
  console.log('[done] PMS launchpad tile inserted:', id);
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('[error]', err);
  sql.end().then(() => process.exit(1));
});
