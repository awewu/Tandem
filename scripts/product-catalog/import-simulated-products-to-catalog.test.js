const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDto,
  buildSeedRecords,
  loadSimulatedProducts,
  planImport,
  resolveBrand,
} = require('./import-simulated-products-to-catalog');

const tenants = {
  rheem: '10000000-0000-4000-8000-000000000101',
  ruud: '10000000-0000-4000-8000-000000000102',
  everhot: '10000000-0000-4000-8000-000000000103',
};

test('maps current dealer-workbench simulated products into product-catalog seed records', () => {
  const source = loadSimulatedProducts();
  const records = buildSeedRecords(source.products, source.categories, tenants);
  assert.equal(records.length, 10);
  assert.equal(records[0].tenantId, tenants.rheem);
  assert.equal(records[0].brand, 'rheem');
  assert.equal(records[0].sku, 'RP-16kW-INV');
  assert.equal(records[0].status, 'active');
  assert.equal(records[0].spec.officialModel, 'RP-16kW-INV');
  assert.equal(records[0].meta.brandMetadata.importedFrom, 'dealer-workbench-products-data');
  assert.equal(records.some((record) => record.brand === 'ruud'), true);
  assert.equal(records.filter((record) => record.brand === 'everhot').length, 6);
});

test('normalizes unsupported legacy simulated brands to Everhot while preserving source brand metadata', () => {
  const product = {
    id: 'fa1',
    category: 'fresh_air',
    brand: 'Rhautt',
    model: 'FA-350-HR',
    name: 'Fresh air',
    spec: '350m3/h',
    marketPrice: 18000,
    dealerPrice: 12600,
    stock: 'in',
  };
  assert.equal(resolveBrand(product.brand).code, 'everhot');
  const dto = buildDto(product, tenants.everhot, [{ key: 'fresh_air', label: 'Fresh air' }]);
  assert.equal(dto.brand, 'everhot');
  assert.equal(dto.meta.brandMetadata.sourceBrand, 'Rhautt');
  assert.equal(dto.meta.everhot.websiteCategory, 'fresh_air');
});

test('plans idempotent create/update by tenantId plus sku and rejects duplicate seed keys', () => {
  const records = [
    { tenantId: tenants.rheem, sku: 'RP-16kW-INV' },
    { tenantId: tenants.ruud, sku: 'RU-20kW' },
  ];
  const plan = planImport(records, [{ id: 'existing-1', tenantId: tenants.rheem, sku: 'RP-16kW-INV' }]);
  assert.equal(plan.created, 1);
  assert.equal(plan.updated, 1);
  assert.throws(
    () => planImport([records[0], { ...records[0] }], []),
    /Duplicate seed key/
  );
});
