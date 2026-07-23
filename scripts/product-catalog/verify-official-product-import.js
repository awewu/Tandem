#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const RESULT_PATH = path.join(ROOT, 'evidence', 'provenance', 'official-product-db-verification.json');

dotenv.config({ path: path.join(ROOT, '.env.nestjs'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), override: false, quiet: true });

function clientConfig() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URI;
  if (connectionString) return { connectionString };
  return {
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || 'rhautt',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || 'rhautt_nexus',
  };
}

async function main() {
  const client = new Client(clientConfig());
  await client.connect();
  try {
    const { rows: summary } = await client.query(`
      SELECT t.code AS tenant_code,
             p.tenant_id,
             p.brand,
             count(*)::int AS products,
             count(*) FILTER (WHERE p.status = 'active')::int AS active,
             count(*) FILTER (WHERE p.list_price > 0)::int AS with_public_price,
             count(*) FILTER (WHERE p.cost_price > 0)::int AS with_cost_price,
             count(*) FILTER (WHERE NULLIF(p.spec->>'officialModel', '') IS NOT NULL)::int AS with_model,
             count(*) FILTER (WHERE p.meta->'officialSource'->>'public' = 'true')::int AS with_official_source
        FROM rhautt_nexus.products p
        JOIN rhautt_nexus.tenants t ON t.id::text = p.tenant_id
       WHERE t.code IN ('rheem', 'ruud', 'everhot')
         AND p.sku ~ '^(RHEEM|RUUD|EVERHOT)-CN-'
       GROUP BY t.code, p.tenant_id, p.brand
       ORDER BY t.code
    `);
    const { rows: duplicates } = await client.query(`
      SELECT tenant_id, sku, count(*)::int AS copies
        FROM rhautt_nexus.products
       WHERE sku ~ '^(RHEEM|RUUD|EVERHOT)-CN-'
       GROUP BY tenant_id, sku
      HAVING count(*) > 1
    `);
    const { rows: invalidSources } = await client.query(`
      SELECT sku, meta->'officialSource'->>'sourceDomain' AS source_domain
        FROM rhautt_nexus.products
       WHERE sku ~ '^(RHEEM|RUUD|EVERHOT)-CN-'
         AND COALESCE(meta->'officialSource'->>'sourceDomain', '') NOT IN
             ('rheem.com.cn', 'ruud.com.cn', 'everhot.com.cn')
    `);
    const total = summary.reduce((sum, row) => sum + row.products, 0);
    const verified = summary.reduce((sum, row) => sum + row.with_official_source, 0);
    const result = {
      verifiedAt: new Date().toISOString(),
      total,
      summary,
      duplicateTenantSkus: duplicates,
      invalidSources,
      passed: total === 69 && verified === 69 && duplicates.length === 0 && invalidSources.length === 0,
    };
    fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
    console.log(`Result: ${RESULT_PATH}`);
    if (!result.passed) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
