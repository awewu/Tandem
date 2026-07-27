import test from 'node:test';
import assert from 'node:assert/strict';
import { ProductCatalogService } from './product-catalog.service';

function service() {
  return new ProductCatalogService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any) as any;
}

test('public product projection uses the current product brand metadata', () => {
  const projected = service().publicProductProjection({
    id: 'product-rheem-1',
    tenantId: 'tenant-rheem',
    sku: 'RHEEM-001',
    brand: 'rheem',
    category: 'base-category',
    status: 'active',
    spec: { officialModel: 'BASE-MODEL' },
    positioning: {},
    assetRefs: [],
    meta: {
      everhot: {
        slug: 'everhot-wrong-slug',
        name: 'Everhot wrong name',
        displayOrder: 99,
      },
      rheem: {
        slug: 'rheem-right-slug',
        name: 'Rheem right name',
        cat: 'Rheem website category',
        sys: 'Rheem website system',
        series: 'Rheem series',
        tagline: 'Rheem tagline',
        displayOrder: 12,
        categoryLevel1Id: 'rheem-l1',
        categoryLevel2Id: 'rheem-l2',
        categoryLevel3Id: 'rheem-l3',
        categoryPath: '家用 / 热水系统 / 空气能热水器',
        privateWorkflowNote: 'internal only',
      },
    },
    listPrice: 100,
    costPrice: 80,
    currency: 'CNY',
  }, 'zh-CN', null);

  assert.equal(projected.slug, 'rheem-right-slug');
  assert.equal(projected.name, 'Rheem right name');
  assert.equal(projected.displayOrder, 12);
  assert.equal(projected.cat, 'Rheem website category');
  assert.equal(projected.sys, 'Rheem website system');
  assert.equal(projected.series, 'Rheem series');
  assert.equal(projected.tagline, 'Rheem tagline');
  assert.equal(projected.categoryLevel1Id, 'rheem-l1');
  assert.equal(projected.categoryLevel2Id, 'rheem-l2');
  assert.equal(projected.categoryLevel3Id, 'rheem-l3');
  assert.equal(projected.categoryPath, '家用 / 热水系统 / 空气能热水器');
  for (const field of ['id', 'tenantId', 'meta', 'listPrice', 'costPrice', 'currency', 'privateWorkflowNote']) {
    assert.equal(field in projected, false, `${field} must not be exposed`);
  }
});
