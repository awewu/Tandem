const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBackfillPlan,
  legacyDisplayOrder,
  normalizeSlug,
  parseArgs,
} = require('./backfill-site-product-assignments');

const site = {
  id: '10000000-0000-4000-8000-000000000001',
  tenantId: '10000000-0000-4000-8000-000000000002',
  brand: 'Everhot',
};

function product(overrides = {}) {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    tenant_id: '20000000-0000-4000-8000-000000000002',
    sku: 'EVERHOT-CN-10008',
    brand: 'Everhot',
    category: 'water-heating',
    meta: {},
    ...overrides,
  };
}

test('defaults to dry-run and requires explicit --apply for writes', () => {
  assert.deepEqual(parseArgs([]), { apply: false, json: false, help: false });
  assert.equal(parseArgs(['--apply']).apply, true);
  assert.throws(() => parseArgs(['--write']), /Unknown argument/);
});

test('migrates the legacy everhot slug and display order', () => {
  const source = product({
    meta: { everhot: { slug: ' EBS-Pro 50 ', displayOrder: '12' } },
  });
  const plan = buildBackfillPlan({ products: [source], existingAssignments: [], site });

  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.candidates[0].publicSlug, 'ebs-pro-50');
  assert.equal(plan.candidates[0].displayOrder, 12);
  assert.equal(plan.candidates[0].status, 'draft');
  assert.equal(plan.candidates[0].tenantId, site.tenantId);
  assert.equal(legacyDisplayOrder(product({ meta: { everhot: { displayOrder: -1 } } })), 0);
  assert.equal(normalizeSlug(' SKU / 20 '), 'sku-20');
});

test('reports duplicate product slugs and excludes all colliding candidates', () => {
  const products = [
    product({ id: 'p1', meta: { everhot: { slug: 'same-slug' } } }),
    product({ id: 'p2', sku: 'OTHER', meta: { everhot: { slug: 'SAME SLUG' } } }),
  ];
  const plan = buildBackfillPlan({ products, existingAssignments: [], site });

  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].type, 'duplicate-product-slug');
  assert.equal(plan.conflicts[0].slug, 'same-slug');
});

test('skips existing products and reports slugs owned by another assignment', () => {
  const products = [
    product({ id: 'existing-product' }),
    product({ id: 'new-product', sku: 'occupied' }),
  ];
  const existingAssignments = [
    { product_id: 'existing-product', public_slug: 'existing-product' },
    { product_id: 'other-product', public_slug: 'occupied' },
  ];
  const plan = buildBackfillPlan({ products, existingAssignments, site });

  assert.equal(plan.candidates.length, 0);
  assert.equal(plan.skipped[0].reason, 'already-assigned');
  assert.equal(plan.conflicts[0].type, 'existing-slug');
  assert.equal(plan.conflicts[0].existingProductId, 'other-product');
});
