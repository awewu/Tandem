const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDto, validatePreview } = require('./import-official-product-preview');

function previewProduct() {
  return {
    sku: 'RHEEM-CN-91',
    name: '瑞美7.5L小厨宝',
    brand: 'Rheem',
    category: 'water-heating',
    spec: { officialModel: 'CSFL07.5-UA' },
    productKey: 'rheem:cn:91',
    listPrice: 698,
    currency: 'CNY',
    meta: {
      officialPublicSource: true,
      sourceDomain: 'rheem.com.cn',
      sourceUrl: 'https://rheem.com.cn/product/9/91.html',
      fetchedAt: '2026-07-16T00:00:00.000Z',
      imageUrls: [],
      documents: [],
      rawExtracted: {},
      dataQualityWarnings: [],
      fieldCompleteness: { score: 88, present: 7, total: 8 },
    },
  };
}

test('validates official source domain and unique SKU', () => {
  const product = previewProduct();
  const payload = {
    metadata: { mode: 'dry-run-preview', databaseWrites: false, errors: [] },
    products: [product],
  };
  assert.equal(validatePreview(payload).length, 1);
  payload.products = [product, product];
  assert.throws(() => validatePreview(payload), /重复/);
});

test('builds active API DTO without overwriting authored fields', () => {
  const dto = buildDto(previewProduct(), '4aee0000-0000-4000-8000-000000000001', {
    spec: { manuallyVerified: true },
    meta: { operatorNote: 'keep' },
    positioning: { valueProposition: 'keep' },
    assetRefs: [{ id: 'keep' }],
    costPrice: 123,
  });
  assert.equal(dto.brand, 'rheem');
  assert.equal(dto.status, 'active');
  assert.equal(dto.spec.manuallyVerified, true);
  assert.equal(dto.meta.operatorNote, 'keep');
  assert.equal(dto.meta.officialSource.sourceUrl, 'https://rheem.com.cn/product/9/91.html');
  assert.equal('positioning' in dto, false);
  assert.equal('assetRefs' in dto, false);
  assert.equal('costPrice' in dto, false);
});
