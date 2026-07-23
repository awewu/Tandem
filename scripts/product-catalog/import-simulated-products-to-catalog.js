#!/usr/bin/env node
const path = require('node:path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_PATH = path.join(ROOT, 'apps', 'dealer-workbench', 'src', 'lib', 'products-data.ts');

dotenv.config({ path: path.join(ROOT, '.env.nestjs'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), override: false, quiet: true });

const APPLY = process.argv.includes('--apply');
const BASE_ARG_INDEX = process.argv.indexOf('--base');
const BASE = BASE_ARG_INDEX >= 0
  ? process.argv[BASE_ARG_INDEX + 1]
  : process.env.PRODUCT_CATALOG_API_BASE || 'http://localhost:5500/api/v2';

const BRAND_CONFIG = Object.freeze({
  rheem: { code: 'rheem', label: 'Rheem', tenantCode: 'rheem', tenantEnv: 'RHEEM_TENANT_ID' },
  ruud: { code: 'ruud', label: 'Ruud', tenantCode: 'ruud', tenantEnv: 'RUUD_TENANT_ID' },
  everhot: { code: 'everhot', label: 'Everhot', tenantCode: 'everhot', tenantEnv: 'EVERHOT_TENANT_ID' },
});

const DRY_RUN_TENANTS = Object.freeze({
  rheem: '10000000-0000-4000-8000-000000000101',
  ruud: '10000000-0000-4000-8000-000000000102',
  everhot: '10000000-0000-4000-8000-000000000103',
});

function loadSimulatedProducts() {
  require('ts-node/register/transpile-only');
  const data = require(SOURCE_PATH);
  if (!Array.isArray(data.PRODUCTS) || !Array.isArray(data.CATEGORIES)) {
    throw new Error(`Invalid simulated product source: ${SOURCE_PATH}`);
  }
  return { products: data.PRODUCTS, categories: data.CATEGORIES };
}

function clientConfig(env = process.env) {
  const connectionString = env.DATABASE_URL || env.POSTGRES_URI;
  if (connectionString) return { connectionString };
  return {
    host: env.POSTGRES_HOST || '127.0.0.1',
    port: Number(env.POSTGRES_PORT || 5432),
    user: env.POSTGRES_USER || 'rhautt',
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB || 'rhautt_nexus',
  };
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveBrand(sourceBrand) {
  const text = String(sourceBrand || '').trim().toLowerCase();
  if (text.includes('rheem')) return BRAND_CONFIG.rheem;
  if (text.includes('ruud')) return BRAND_CONFIG.ruud;
  if (text.includes('everhot')) return BRAND_CONFIG.everhot;
  return BRAND_CONFIG.everhot;
}

function categoryLabels(categories) {
  return new Map(categories.map((category) => [category.key, category.label]));
}

function buildDto(product, tenantId, categories, index = 0, existing = null) {
  const brand = resolveBrand(product.brand);
  const sku = String(product.model || product.sku || product.id || '').trim();
  const category = String(product.category || 'uncategorized').trim();
  const specText = typeof product.spec === 'string' ? product.spec : '';
  const categoryLabel = categoryLabels(categories).get(category) || category;
  const slug = normalizeSlug(sku);
  if (!sku) throw new Error(`Simulated product is missing model/SKU: ${product.id || product.name}`);
  if (!product.name) throw new Error(`Simulated product is missing name: ${sku}`);

  const brandMetadata = {
    sourceBrand: product.brand || '',
    sourceId: product.id || '',
    sourcePath: path.relative(ROOT, SOURCE_PATH).replace(/\\/g, '/'),
    importedFrom: 'dealer-workbench-products-data',
    model: sku,
    slug,
    websiteCategory: category,
    categoryLabel,
    stock: product.stock || 'in',
    isNew: Boolean(product.isNew),
    badges: product.isNew ? ['new'] : [],
    displayOrder: index,
  };

  return {
    tenantId,
    sku,
    name: String(product.name),
    brand: brand.code,
    category,
    spec: {
      ...(existing?.spec || {}),
      text: specText,
      officialModel: sku,
      categoryLabel,
    },
    listPrice: Number(product.marketPrice) || 0,
    costPrice: Number(product.dealerPrice) || 0,
    currency: 'CNY',
    status: 'active',
    meta: {
      ...(existing?.meta || {}),
      stock: product.stock || 'in',
      isNew: Boolean(product.isNew),
      source: {
        type: 'simulated-product-data',
        path: brandMetadata.sourcePath,
        sourceId: brandMetadata.sourceId,
      },
      brandMetadata,
      [brand.code]: brandMetadata,
    },
  };
}

function buildSeedRecords(products, categories, tenantsByBrand) {
  return products.map((product, index) => {
    const brand = resolveBrand(product.brand);
    const tenantId = tenantsByBrand[brand.code];
    if (!tenantId) throw new Error(`Missing tenantId for brand ${brand.code}`);
    return buildDto(product, tenantId, categories, index);
  });
}

async function loadBrandTenants(client, env = process.env) {
  const codes = Object.values(BRAND_CONFIG).map((config) => config.tenantCode);
  const { rows } = await client.query(
    `SELECT id::text, lower(code) AS code, name, status
       FROM rhautt_nexus.tenants
      WHERE lower(code) = ANY($1::text[])
      ORDER BY code`,
    [codes]
  );
  const tenants = Object.fromEntries(rows.map((row) => [row.code, row.id]));
  for (const config of Object.values(BRAND_CONFIG)) {
    if (!tenants[config.code] && env[config.tenantEnv]) tenants[config.code] = env[config.tenantEnv];
  }
  return tenants;
}

async function listExistingProducts(client, tenantIds) {
  if (!tenantIds.length) return [];
  const { rows } = await client.query(
    `SELECT id::text, tenant_id AS "tenantId", sku, brand, status, spec, meta
       FROM rhautt_nexus.products
      WHERE tenant_id = ANY($1::text[])`,
    [tenantIds]
  );
  return rows;
}

function planImport(records, existingProducts) {
  const existingByKey = new Map(existingProducts.map((row) => [`${row.tenantId}\n${row.sku}`, row]));
  const duplicateKeys = new Set();
  const seen = new Set();
  const items = records.map((record) => {
    const key = `${record.tenantId}\n${record.sku}`;
    if (seen.has(key)) duplicateKeys.add(key);
    seen.add(key);
    const existing = existingByKey.get(key);
    return { record, action: existing ? 'update' : 'create', existingId: existing?.id || null };
  });
  if (duplicateKeys.size) {
    throw new Error(`Duplicate seed key(s): ${[...duplicateKeys].map((key) => key.replace('\n', ':')).join(', ')}`);
  }
  return {
    items,
    created: items.filter((item) => item.action === 'create').length,
    updated: items.filter((item) => item.action === 'update').length,
  };
}

function makeToken(tenantId) {
  if (!process.env.JWT_SECRET) throw new Error('Missing JWT_SECRET for protected product-catalog API import');
  return jwt.sign({ userId: 'simulated-product-importer', tenantId, role: 'platform_admin' }, process.env.JWT_SECRET, {
    expiresIn: '20m',
  });
}

async function apiRequest(pathname, token, options = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    ...options,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text.slice(0, 500) };
  }
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${pathname} -> ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function applyImport(plan) {
  const result = { created: 0, updated: 0, failed: 0, failures: [] };
  for (const item of plan.items) {
    const token = makeToken(item.record.tenantId);
    try {
      await apiRequest('/product-catalog/devices', token, {
        method: 'POST',
        body: JSON.stringify(item.record),
      });
      result[item.action === 'create' ? 'created' : 'updated'] += 1;
    } catch (error) {
      result.failed += 1;
      result.failures.push({
        tenantId: item.record.tenantId,
        sku: item.record.sku,
        message: error.message,
      });
    }
  }
  return result;
}

async function upsertProduct(client, record) {
  const { rows } = await client.query(
    `INSERT INTO rhautt_nexus.products
       (id, tenant_id, sku, name, brand, category, spec, list_price, cost_price,
        currency, status, meta, created_at, updated_at)
     VALUES
       (gen_random_uuid(), $1, $2, $3, $4, $5, $6::jsonb, $7, $8,
        $9, $10, $11::jsonb, now(), now())
     ON CONFLICT (tenant_id, sku) DO UPDATE SET
       name = EXCLUDED.name,
       brand = EXCLUDED.brand,
       category = EXCLUDED.category,
       spec = EXCLUDED.spec,
       list_price = EXCLUDED.list_price,
       cost_price = EXCLUDED.cost_price,
       currency = EXCLUDED.currency,
       status = EXCLUDED.status,
       meta = EXCLUDED.meta,
       updated_at = now()
     RETURNING id::text, (xmax = 0) AS inserted`,
    [
      record.tenantId,
      record.sku,
      record.name,
      record.brand,
      record.category,
      JSON.stringify(record.spec || {}),
      record.listPrice,
      record.costPrice,
      record.currency,
      record.status,
      JSON.stringify(record.meta || {}),
    ]
  );
  return rows[0];
}

async function applyImportToDatabase(client, plan) {
  const result = { created: 0, updated: 0, failed: 0, failures: [] };
  await client.query('BEGIN');
  try {
    for (const item of plan.items) {
      try {
        await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', item.record.tenantId]);
        const saved = await upsertProduct(client, item.record);
        result[saved?.inserted ? 'created' : 'updated'] += 1;
      } catch (error) {
        result.failed += 1;
        result.failures.push({
          tenantId: item.record.tenantId,
          sku: item.record.sku,
          message: error.message,
        });
      }
    }
    if (result.failed) {
      await client.query('ROLLBACK');
    } else {
      await client.query('COMMIT');
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
  return result;
}

async function main() {
  const source = loadSimulatedProducts();
  const client = new Client(clientConfig());
  const report = {
    mode: APPLY ? 'apply' : 'dry-run',
    source: path.relative(ROOT, SOURCE_PATH).replace(/\\/g, '/'),
    sourceProducts: source.products.length,
    mapping: {
      sku: 'model',
      name: 'name',
      category: 'category',
      status: 'active',
      spec: 'spec.text + model/category metadata',
      brandMetadata: 'meta.brandMetadata and meta.<brandCode>',
      idempotencyKey: 'tenantId + sku',
    },
    databaseAvailable: false,
    created: 0,
    updated: 0,
    failed: 0,
    failures: [],
  };

  try {
    await client.connect();
    const tenants = await loadBrandTenants(client);
    const records = buildSeedRecords(source.products, source.categories, tenants);
    const existing = await listExistingProducts(client, [...new Set(records.map((record) => record.tenantId))]);
    const plan = planImport(records, existing);
    report.databaseAvailable = true;
    report.tenants = Object.fromEntries(Object.entries(tenants).filter(([, value]) => value));
    report.created = plan.created;
    report.updated = plan.updated;
    report.records = records.map((record) => ({
      tenantId: record.tenantId,
      sku: record.sku,
      brand: record.brand,
      name: record.name,
      category: record.category,
      status: record.status,
    }));

    if (APPLY) {
      const applied = await applyImportToDatabase(client, plan);
      Object.assign(report, applied);
    }
  } catch (error) {
    if (APPLY) throw error;
    const fallbackTenants = Object.fromEntries(
      Object.values(BRAND_CONFIG)
        .map((config) => [config.code, process.env[config.tenantEnv] || DRY_RUN_TENANTS[config.code]])
        .filter(([, value]) => value)
    );
    report.databaseError = error.message;
    report.records = buildSeedRecords(source.products, source.categories, fallbackTenants).map((record) => ({
      tenantId: record.tenantId,
      sku: record.sku,
      brand: record.brand,
      name: record.name,
      category: record.category,
      status: record.status,
    }));
    report.created = report.records.length;
  } finally {
    await client.end().catch(() => {});
  }

  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  BRAND_CONFIG,
  buildDto,
  buildSeedRecords,
  loadSimulatedProducts,
  planImport,
  resolveBrand,
  applyImport,
  applyImportToDatabase,
};
