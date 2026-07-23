#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const PREVIEW_PATH = path.join(ROOT, 'evidence', 'provenance', 'official-product-preview.json');
const RESULT_PATH = path.join(ROOT, 'evidence', 'provenance', 'official-product-import-result.json');

dotenv.config({ path: path.join(ROOT, '.env.nestjs'), quiet: true });
dotenv.config({ path: path.join(ROOT, '.env'), override: false, quiet: true });

const APPLY = process.argv.includes('--apply');
const BASE_ARG_INDEX = process.argv.indexOf('--base');
const BASE = BASE_ARG_INDEX >= 0
  ? process.argv[BASE_ARG_INDEX + 1]
  : process.env.OFFICIAL_PRODUCT_API_BASE || 'http://localhost:5500/api/v2';

const BRAND_CONFIG = Object.freeze({
  Rheem: { code: 'rheem', domain: 'rheem.com.cn' },
  Ruud: { code: 'ruud', domain: 'ruud.com.cn' },
  Everhot: { code: 'everhot', domain: 'everhot.com.cn' },
});

function buildClientConfig() {
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

function validatePreview(payload) {
  if (payload?.metadata?.mode !== 'dry-run-preview') throw new Error('输入不是官网产品 dry-run 预览');
  if (payload.metadata.databaseWrites !== false) throw new Error('预览元数据的 databaseWrites 必须为 false');
  if (payload.metadata.errors?.length) throw new Error('预览包含抓取错误，禁止导入');
  if (!Array.isArray(payload.products) || !payload.products.length) throw new Error('预览中没有产品');

  const seen = new Set();
  for (const product of payload.products) {
    const config = BRAND_CONFIG[product.brand];
    if (!config) throw new Error(`未允许的品牌：${product.brand}`);
    if (!product.sku || !product.name || seen.has(product.sku)) throw new Error(`SKU 缺失或重复：${product.sku}`);
    seen.add(product.sku);
    const source = new URL(product.meta?.sourceUrl || '');
    if (source.hostname !== config.domain) throw new Error(`${product.sku} 来源域名不合法：${source.hostname}`);
    if (product.meta?.officialPublicSource !== true) throw new Error(`${product.sku} 缺少官网公开来源标记`);
  }
  return payload.products;
}

function buildDto(product, tenantId, existing) {
  const config = BRAND_CONFIG[product.brand];
  return {
    tenantId,
    sku: product.sku,
    name: product.name,
    brand: config.code,
    category: product.category,
    spec: { ...(existing?.spec || {}), ...(product.spec || {}) },
    productKey: product.productKey,
    listPrice: Number(product.listPrice) || 0,
    currency: product.currency || 'CNY',
    status: 'active',
    meta: {
      ...(existing?.meta || {}),
      officialSource: {
        provider: product.brand,
        public: true,
        sourceDomain: product.meta.sourceDomain,
        sourceUrl: product.meta.sourceUrl,
        listingUrl: product.meta.listingUrl,
        sourceId: product.meta.sourceId,
        fetchedAt: product.meta.fetchedAt,
        importedAt: new Date().toISOString(),
        price: product.meta.price,
        documents: product.meta.documents,
        rawExtracted: product.meta.rawExtracted,
        dataQualityWarnings: product.meta.dataQualityWarnings,
        fieldCompleteness: product.meta.fieldCompleteness,
      },
    },
  };
}

async function loadBrandTenants(client) {
  const codes = Object.values(BRAND_CONFIG).map((config) => config.code);
  const { rows } = await client.query(
    `SELECT id::text, code, name, status
       FROM rhautt_nexus.tenants
      WHERE code = ANY($1::text[])
      ORDER BY code`,
    [codes]
  );
  const tenants = new Map(rows.map((row) => [row.code, row]));
  const missing = codes.filter((code) => !tenants.has(code));
  if (missing.length) throw new Error(`缺少品牌运营租户：${missing.join(', ')}；请先应用数据库迁移`);
  const inactive = rows.filter((row) => row.status !== 'active');
  if (inactive.length) throw new Error(`品牌运营租户未启用：${inactive.map((row) => row.code).join(', ')}`);
  return tenants;
}

function makeToken(tenantId) {
  if (!process.env.JWT_SECRET) throw new Error('缺少 JWT_SECRET，无法通过受保护产品写入接口');
  return jwt.sign({ userId: 'official-product-importer', tenantId, role: 'platform_admin' }, process.env.JWT_SECRET, {
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

async function listTenantProducts(tenantId, token) {
  const payload = await apiRequest(`/product-catalog/devices?tenantId=${encodeURIComponent(tenantId)}`, token);
  return payload?.data?.items || [];
}

async function main() {
  const preview = JSON.parse(fs.readFileSync(PREVIEW_PATH, 'utf8'));
  const products = validatePreview(preview);
  const client = new Client(buildClientConfig());
  await client.connect();
  let tenants;
  try {
    tenants = await loadBrandTenants(client);
  } finally {
    await client.end();
  }

  const plan = Object.entries(BRAND_CONFIG).map(([brand, config]) => ({
    brand,
    tenantId: tenants.get(config.code).id,
    products: products.filter((product) => product.brand === brand).length,
  }));
  console.table(plan);
  if (!APPLY) {
    console.log('Dry-run only. Pass --apply to write through the protected NestJS product-catalog API.');
    return;
  }

  const result = {
    startedAt: new Date().toISOString(),
    previewFetchedAt: preview.metadata.fetchedAt,
    apiBase: BASE,
    created: 0,
    updated: 0,
    failed: 0,
    brands: {},
    failures: [],
  };

  for (const item of plan) {
    const token = makeToken(item.tenantId);
    const before = await listTenantProducts(item.tenantId, token);
    const existingBySku = new Map(before.map((product) => [product.sku, product]));
    const brandProducts = products.filter((product) => product.brand === item.brand);
    const brandResult = { tenantId: item.tenantId, requested: brandProducts.length, created: 0, updated: 0, verified: 0 };

    for (const product of brandProducts) {
      const existing = existingBySku.get(product.sku);
      try {
        await apiRequest('/product-catalog/devices', token, {
          method: 'POST',
          body: JSON.stringify(buildDto(product, item.tenantId, existing)),
        });
        if (existing) {
          result.updated += 1;
          brandResult.updated += 1;
        } else {
          result.created += 1;
          brandResult.created += 1;
        }
      } catch (error) {
        result.failed += 1;
        result.failures.push({ brand: item.brand, sku: product.sku, message: error.message });
      }
    }

    const after = await listTenantProducts(item.tenantId, token);
    const afterBySku = new Map(after.map((product) => [product.sku, product]));
    brandResult.verified = brandProducts.filter((product) => {
      const stored = afterBySku.get(product.sku);
      return stored && stored.brand === BRAND_CONFIG[item.brand].code && stored.status === 'active';
    }).length;
    result.brands[item.brand] = brandResult;
  }

  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  console.log(`Result: ${RESULT_PATH}`);
  const requested = plan.reduce((sum, item) => sum + item.products, 0);
  const verified = Object.values(result.brands).reduce((sum, item) => sum + item.verified, 0);
  if (result.failed || verified !== requested) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { BRAND_CONFIG, buildDto, validatePreview };
