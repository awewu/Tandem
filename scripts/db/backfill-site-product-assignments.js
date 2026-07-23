#!/usr/bin/env node
const path = require('node:path');

const SCHEMA = 'rhautt_nexus';
const BRAND_SITES = [
  { brandCode: 'rheem', brand: 'Rheem', tenantEnv: 'SITE_RHEEM_TENANT_ID' },
  { brandCode: 'ruud', brand: 'Ruud', tenantEnv: 'SITE_RUUD_TENANT_ID' },
  { brandCode: 'everhot', brand: 'Everhot', tenantEnv: 'SITE_EVERHOT_TENANT_ID' },
];

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function legacyWebsiteMetadata(product) {
  const everhot = product?.meta?.everhot;
  return everhot && typeof everhot === 'object' && !Array.isArray(everhot) ? everhot : {};
}

function legacyDisplayOrder(product) {
  const value = Number(legacyWebsiteMetadata(product).displayOrder ?? 0);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function buildBackfillPlan({ products, existingAssignments, site }) {
  const existingByProduct = new Map(
    existingAssignments.map((assignment) => [String(assignment.product_id), assignment])
  );
  const slugOwners = new Map();
  for (const assignment of existingAssignments) {
    const slug = normalizeSlug(assignment.public_slug);
    if (slug) slugOwners.set(slug, String(assignment.product_id));
  }

  const candidates = [];
  const skipped = [];
  const conflicts = [];
  const pendingBySlug = new Map();

  for (const product of products) {
    const productId = String(product.id);
    if (existingByProduct.has(productId)) {
      skipped.push({ productId, sku: product.sku, reason: 'already-assigned' });
      continue;
    }

    const legacy = legacyWebsiteMetadata(product);
    const slug = normalizeSlug(legacy.slug || product.sku);
    if (!slug) {
      conflicts.push({
        type: 'invalid-slug',
        productId,
        sku: product.sku,
        sourceSlug: legacy.slug || product.sku || null,
      });
      continue;
    }

    const existingOwner = slugOwners.get(slug);
    if (existingOwner && existingOwner !== productId) {
      conflicts.push({
        type: 'existing-slug',
        slug,
        productId,
        sku: product.sku,
        existingProductId: existingOwner,
      });
      continue;
    }

    const candidate = {
      tenantId: site.tenantId,
      siteId: site.id,
      productTenantId: product.tenant_id,
      productId,
      brand: product.brand || site.brand,
      publicSlug: slug,
      websiteCategory: product.category || null,
      displayOrder: legacyDisplayOrder(product),
      status: 'draft',
    };
    candidates.push(candidate);
    const pending = pendingBySlug.get(slug) || [];
    pending.push(candidate);
    pendingBySlug.set(slug, pending);
  }

  const duplicateIds = new Set();
  for (const [slug, rows] of pendingBySlug.entries()) {
    if (rows.length < 2) continue;
    for (const row of rows) duplicateIds.add(row.productId);
    conflicts.push({
      type: 'duplicate-product-slug',
      slug,
      products: rows.map((row) => ({ productId: row.productId })),
    });
  }

  return {
    candidates: candidates.filter((candidate) => !duplicateIds.has(candidate.productId)),
    skipped,
    conflicts,
  };
}

function parseArgs(argv) {
  const allowed = new Set(['--apply', '--json', '--help']);
  const unknown = argv.filter((arg) => !allowed.has(arg));
  if (unknown.length) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);
  return {
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
    help: argv.includes('--help'),
  };
}

function clientConfig(env) {
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

async function findProductTenant(client, brandCode) {
  const { rows } = await client.query(
    `SELECT id::text AS id FROM ${SCHEMA}.tenants WHERE lower(code) = $1 LIMIT 1`,
    [brandCode]
  );
  return rows[0]?.id;
}

async function findSite(client, tenantId, siteCode) {
  const { rows } = await client.query(
    `SELECT id::text AS id, tenant_id::text AS tenant_id, code
       FROM ${SCHEMA}.tenant_brand_sites
      WHERE tenant_id = $1::uuid AND lower(code) = $2
        AND status = 'active' AND deleted_at IS NULL
      LIMIT 1`,
    [tenantId, siteCode]
  );
  return rows[0];
}

async function listProducts(client, productTenantId) {
  const { rows } = await client.query(
    `SELECT id::text AS id, tenant_id, sku, name, brand, category, meta
       FROM ${SCHEMA}.products
      WHERE tenant_id = $1 AND status = 'active'
      ORDER BY sku, id`,
    [productTenantId]
  );
  return rows;
}

async function listAssignments(client, tenantId, siteId) {
  const { rows } = await client.query(
    `SELECT product_id::text AS product_id, public_slug
       FROM ${SCHEMA}.site_product_assignments
      WHERE tenant_id = $1::uuid AND site_id = $2::uuid AND deleted_at IS NULL`,
    [tenantId, siteId]
  );
  return rows;
}

async function insertCandidate(client, candidate) {
  const { rowCount } = await client.query(
    `INSERT INTO ${SCHEMA}.site_product_assignments
       (tenant_id, site_id, product_tenant_id, product_id, brand, public_slug,
        website_category, display_order, status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9)
     ON CONFLICT DO NOTHING`,
    [
      candidate.tenantId,
      candidate.siteId,
      candidate.productTenantId,
      candidate.productId,
      candidate.brand,
      candidate.publicSlug,
      candidate.websiteCategory,
      candidate.displayOrder,
      candidate.status,
    ]
  );
  return rowCount === 1;
}

async function processBrandSite(client, config, env, apply) {
  const siteCode = String(env[`SITE_${config.brandCode.toUpperCase()}_CODE`] || config.brandCode)
    .trim()
    .toLowerCase();
  const siteTenantId = env[config.tenantEnv];
  if (!siteTenantId) {
    return {
      brand: config.brand,
      siteCode,
      error: `Missing backend environment variable ${config.tenantEnv}`,
    };
  }

  await client.query('BEGIN');
  try {
    await client.query('SELECT set_config($1, $2, true)', ['app.tenant_id', siteTenantId]);
    const productTenantId = await findProductTenant(client, config.brandCode);
    if (!productTenantId) throw new Error(`Product tenant not found: ${config.brandCode}`);

    const site = await findSite(client, siteTenantId, siteCode);
    if (!site) throw new Error(`Active site not found: ${siteCode} (${siteTenantId})`);
    site.tenantId = siteTenantId;
    site.brand = config.brand;

    const [products, existingAssignments] = await Promise.all([
      listProducts(client, productTenantId),
      listAssignments(client, siteTenantId, site.id),
    ]);
    const plan = buildBackfillPlan({ products, existingAssignments, site });
    let inserted = 0;
    const writeConflicts = [];
    if (apply) {
      for (const candidate of plan.candidates) {
        if (await insertCandidate(client, candidate)) inserted += 1;
        else writeConflicts.push({
          type: 'concurrent-conflict',
          productId: candidate.productId,
          slug: candidate.publicSlug,
        });
      }
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }

    return {
      brand: config.brand,
      siteCode,
      siteTenantId,
      productTenantId,
      scanned: products.length,
      planned: plan.candidates.length,
      inserted,
      skipped: plan.skipped,
      conflicts: [...plan.conflicts, ...writeConflicts],
    };
  } catch (error) {
    await client.query('ROLLBACK');
    return { brand: config.brand, siteCode, error: error.message };
  }
}

async function runBackfill({ client, env, apply }) {
  const sites = [];
  for (const config of BRAND_SITES) {
    sites.push(await processBrandSite(client, config, env, apply));
  }
  return {
    mode: apply ? 'apply' : 'dry-run',
    groupSite: {
      code: env.SITE_RHAUTT_GROUP_CODE || 'rhautt-group',
      action: 'excluded',
      reason: 'Group products require explicit operator selection',
    },
    sites,
  };
}

function printReport(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(`Site product assignment backfill (${report.mode})`);
  for (const site of report.sites) {
    if (site.error) {
      console.log(`- ${site.brand}/${site.siteCode}: ERROR ${site.error}`);
      continue;
    }
    console.log(
      `- ${site.brand}/${site.siteCode}: scanned=${site.scanned} planned=${site.planned} ` +
        `inserted=${site.inserted} skipped=${site.skipped.length} conflicts=${site.conflicts.length}`
    );
    for (const conflict of site.conflicts) console.log(`  conflict ${JSON.stringify(conflict)}`);
  }
  console.log(`- ${report.groupSite.code}: excluded (explicit operator selection required)`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/db/backfill-site-product-assignments.js [--apply] [--json]');
    console.log('Default mode is dry-run. --apply is required for database writes.');
    return;
  }

  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env.nestjs'), quiet: true });
  require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env'), override: false, quiet: true });
  const { Client } = require('pg');
  const client = new Client(clientConfig(process.env));
  await client.connect();
  try {
    const report = await runBackfill({ client, env: process.env, apply: options.apply });
    printReport(report, options.json);
    if (report.sites.some((site) => site.error)) process.exitCode = 2;
    else if (report.sites.some((site) => site.conflicts.length > 0)) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Site product assignment backfill failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  BRAND_SITES,
  buildBackfillPlan,
  clientConfig,
  legacyDisplayOrder,
  normalizeSlug,
  parseArgs,
  runBackfill,
};
