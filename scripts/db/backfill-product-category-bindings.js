#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = 'rhautt_nexus';

process.env.TS_NODE_PROJECT =
  process.env.TS_NODE_PROJECT || path.join(__dirname, '..', '..', 'services', 'api', 'tsconfig.json');
require('ts-node/register/transpile-only');
const { planProductCategoryBackfill } = require('../../services/api/src/modules/product-catalog/product-category-backfill');

function parseArgs(argv) {
  const options = { apply: false, json: false, help: false, brand: null, tenant: null, aliases: null };
  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help') options.help = true;
    else if (arg.startsWith('--brand=')) options.brand = valueArg(arg, '--brand=').toLowerCase();
    else if (arg.startsWith('--tenant=')) options.tenant = valueArg(arg, '--tenant=');
    else if (arg.startsWith('--aliases=')) options.aliases = valueArg(arg, '--aliases=');
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function valueArg(arg, prefix) {
  const value = arg.slice(prefix.length).trim();
  if (!value) throw new Error(`${prefix.slice(0, -1)} requires a value`);
  return value;
}

function clientConfig(env) {
  const connectionString = env.DATABASE_URL || env.POSTGRES_URI;
  if (connectionString) return { connectionString };
  return {
    host: env.POSTGRES_HOST || '127.0.0.1',
    port: Number(env.POSTGRES_PORT || 5432),
    user: env.POSTGRES_USER || env.USER || 'rhautt',
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB || 'rhautt_nexus',
  };
}

function loadAliases(filePath) {
  if (!filePath) return [];
  const resolved = path.resolve(filePath);
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('--aliases must point to a JSON array');
  return parsed.map((row) => ({
    brandCode: String(row.brandCode || '').trim().toLowerCase(),
    legacyValue: String(row.legacyValue || '').trim(),
    categoryId: String(row.categoryId || '').trim(),
  })).filter((row) => row.brandCode && row.legacyValue && row.categoryId);
}

async function listCategories(client, brandCode) {
  const params = [];
  const brandSql = brandCode ? 'AND brand_code = $1' : '';
  if (brandCode) params.push(brandCode);
  const { rows } = await client.query(
    `SELECT id::text AS id,
            brand_code AS "brandCode",
            parent_id::text AS "parentId",
            level,
            code,
            name_cn AS "nameCn",
            name_en AS "nameEn",
            slug,
            sort_order AS "sortOrder",
            status,
            description,
            deleted_at AS "deletedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
       FROM ${SCHEMA}.brand_product_categories
      WHERE deleted_at IS NULL ${brandSql}
      ORDER BY brand_code, level, sort_order, name_cn`,
    params
  );
  return rows;
}

async function listProducts(client, options) {
  const where = ["status <> 'archived'"];
  const params = [];
  if (options.brand) {
    params.push(options.brand);
    where.push(`lower(brand) = $${params.length}`);
  }
  if (options.tenant) {
    params.push(options.tenant);
    where.push(`tenant_id = $${params.length}`);
  }
  const { rows } = await client.query(
    `SELECT id::text AS id,
            tenant_id AS "tenantId",
            sku,
            name,
            lower(brand) AS brand,
            category,
            spec,
            positioning,
            asset_refs AS "assetRefs",
            product_key AS "productKey",
            list_price AS "listPrice",
            cost_price AS "costPrice",
            currency,
            status,
            meta,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
       FROM ${SCHEMA}.products
      WHERE ${where.join(' AND ')}
      ORDER BY lower(brand), sku, id`,
    params
  );
  return rows;
}

async function applyCandidate(client, candidate) {
  const { rowCount } = await client.query(
    `UPDATE ${SCHEMA}.products
        SET meta = $2::jsonb,
            updated_at = now()
      WHERE id = $1::uuid
        AND COALESCE(NULLIF(meta -> $3 ->> 'categoryLevel1Id', ''), NULLIF(meta ->> 'categoryLevel1Id', '')) IS NULL
        AND COALESCE(NULLIF(meta -> $3 ->> 'categoryLevel2Id', ''), NULLIF(meta ->> 'categoryLevel2Id', '')) IS NULL`,
    [candidate.productId, JSON.stringify(candidate.meta), candidate.brandCode]
  );
  return rowCount === 1;
}

async function runBackfill({ client, options, aliases }) {
  const [products, categories] = await Promise.all([
    listProducts(client, options),
    listCategories(client, options.brand),
  ]);
  const plan = planProductCategoryBackfill(products, categories, aliases);
  let updated = 0;
  const writeConflicts = [];

  await client.query('BEGIN');
  try {
    if (options.apply) {
      for (const candidate of plan.matched) {
        if (await applyCandidate(client, candidate)) updated += 1;
        else writeConflicts.push({
          productId: candidate.productId,
          sku: candidate.sku,
          reason: 'concurrent-or-existing-binding',
        });
      }
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  return {
    mode: options.apply ? 'apply' : 'dry-run',
    brand: options.brand,
    tenant: options.tenant,
    scanned: plan.scanned,
    matched: plan.matched.length,
    updated,
    unmatched: plan.unmatched,
    alreadyBound: plan.alreadyBound,
    invalidExistingBindings: plan.invalidExistingBindings,
    crossBrand: plan.crossBrand,
    writeConflicts,
  };
}

function printReport(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Product category binding backfill (${report.mode})`);
  console.log(
    `scanned=${report.scanned} matched=${report.matched} updated=${report.updated} ` +
      `unmatched=${report.unmatched.length} alreadyBound=${report.alreadyBound.length} ` +
      `invalidExistingBindings=${report.invalidExistingBindings.length} crossBrand=${report.crossBrand.length}`
  );
  for (const row of report.unmatched) console.log(`unmatched ${JSON.stringify(row)}`);
  for (const row of report.invalidExistingBindings) console.log(`invalid-existing ${JSON.stringify(row)}`);
  for (const row of report.crossBrand) console.log(`cross-brand ${JSON.stringify(row)}`);
  for (const row of report.writeConflicts) console.log(`write-conflict ${JSON.stringify(row)}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/db/backfill-product-category-bindings.js [--apply] [--json] [--brand=everhot] [--tenant=UUID] [--aliases=aliases.json]');
    console.log('Default mode is dry-run. --apply is required for database writes.');
    console.log('Alias file shape: [{ "brandCode": "everhot", "legacyValue": "dhw", "categoryId": "..." }]');
    return;
  }

  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env.nestjs'), quiet: true });
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env'), override: false, quiet: true });
  const { Client } = require('pg');
  const client = new Client(clientConfig(process.env));
  await client.connect();
  try {
    const report = await runBackfill({ client, options, aliases: loadAliases(options.aliases) });
    printReport(report, options.json);
    if (report.invalidExistingBindings.length || report.crossBrand.length || report.writeConflicts.length) {
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Product category binding backfill failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  clientConfig,
  loadAliases,
  parseArgs,
  runBackfill,
};
