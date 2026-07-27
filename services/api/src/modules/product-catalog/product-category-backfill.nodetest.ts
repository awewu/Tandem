import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { ProductEntity } from './product-catalog.entity';
import type { BrandProductCategoryEntity } from '../brand-product-category/brand-product-category.entity';
import { planProductCategoryBackfill } from './product-category-backfill';

test('backfill matches legacy fields to a brand-scoped category path', () => {
  const report = planProductCategoryBackfill(
    [
      product('p1', 'everhot', {
        category: 'commercial',
        meta: { everhot: { websiteMenuCategory: '商用', system: '热水系统' } },
      }),
    ],
    [
      category('everhot-l1', 'everhot', 1, null, '商用', 'commercial'),
      category('everhot-l2', 'everhot', 2, 'everhot-l1', '热水系统', 'hot-water-system'),
    ],
  );

  assert.equal(report.scanned, 1);
  assert.equal(report.matched.length, 1);
  assert.equal(report.matched[0].categoryLevel1Id, 'everhot-l1');
  assert.equal(report.matched[0].categoryLevel2Id, 'everhot-l2');
  assert.equal((report.matched[0].meta as any).everhot.categoryPath, '商用 / 热水系统');
});

test('backfill reports unmatched products without corrupting metadata', () => {
  const source = product('p1', 'everhot', {
    meta: { everhot: { websiteMenuCategory: '未识别菜单', system: '未知系统' } },
  });
  const report = planProductCategoryBackfill(
    [source],
    [category('everhot-l2', 'everhot', 2, 'everhot-l1', '热水系统', 'hot-water-system')],
  );

  assert.equal(report.matched.length, 0);
  assert.equal(report.unmatched.length, 1);
  assert.equal(report.unmatched[0].reason, 'unmatched');
  assert.equal(report.unmatched[0].meta, null);
  assert.deepEqual(source.meta, { everhot: { websiteMenuCategory: '未识别菜单', system: '未知系统' } });
});

test('backfill does not overwrite an existing valid category binding', () => {
  const existingMeta = {
    everhot: {
      categoryLevel1Id: 'everhot-l1',
      categoryLevel2Id: 'everhot-l2',
      categoryPath: '商用 / 热水系统',
      websiteMenuCategory: '商用',
      system: '采暖系统',
    },
  };
  const report = planProductCategoryBackfill(
    [product('p1', 'everhot', { meta: existingMeta })],
    [
      category('everhot-l1', 'everhot', 1, null, '商用', 'commercial'),
      category('everhot-l2', 'everhot', 2, 'everhot-l1', '热水系统', 'hot-water-system'),
      category('everhot-l2-other', 'everhot', 2, 'everhot-l1', '采暖系统', 'heating-system'),
    ],
  );

  assert.equal(report.alreadyBound.length, 1);
  assert.equal(report.alreadyBound[0].meta, null);
  assert.equal((existingMeta as any).everhot.categoryLevel2Id, 'everhot-l2');
});

test('backfill remains brand-scoped and reports cross-brand matches', () => {
  const report = planProductCategoryBackfill(
    [product('p1', 'everhot', { meta: { everhot: { websiteMenuCategory: '家用', system: 'Ruud 热水系统' } } })],
    [
      category('ruud-l1', 'ruud', 1, null, '家用', 'home'),
      category('ruud-l2', 'ruud', 2, 'ruud-l1', 'Ruud 热水系统', 'ruud-hot-water'),
    ],
  );

  assert.equal(report.matched.length, 0);
  assert.equal(report.crossBrand.length, 1);
  assert.equal(report.crossBrand[0].meta, null);
});

test('backfill reports invalid existing bindings instead of rewriting them', () => {
  const report = planProductCategoryBackfill(
    [product('p1', 'everhot', { meta: { everhot: { categoryLevel1Id: 'missing', categoryLevel2Id: 'everhot-l2' } } })],
    [
      category('everhot-l1', 'everhot', 1, null, '商用', 'commercial'),
      category('everhot-l2', 'everhot', 2, 'everhot-l1', '热水系统', 'hot-water-system'),
    ],
  );

  assert.equal(report.invalidExistingBindings.length, 1);
  assert.match(report.invalidExistingBindings[0].message || '', /does not resolve/);
  assert.equal(report.invalidExistingBindings[0].meta, null);
});

test('backfill supports configured aliases when legacy text is not an exact category label', () => {
  const report = planProductCategoryBackfill(
    [product('p1', 'everhot', { meta: { everhot: { system: 'dhw' } } })],
    [
      category('everhot-l1', 'everhot', 1, null, '商用', 'commercial'),
      category('everhot-l2', 'everhot', 2, 'everhot-l1', '热水系统', 'hot-water-system'),
    ],
    [{ brandCode: 'everhot', legacyValue: 'dhw', categoryId: 'everhot-l2' }],
  );

  assert.equal(report.matched.length, 1);
  assert.equal(report.matched[0].categoryLevel2Id, 'everhot-l2');
});

function category(
  id: string,
  brandCode: string,
  level: 1 | 2 | 3,
  parentId: string | null,
  nameCn: string,
  code = id,
): BrandProductCategoryEntity {
  return {
    id,
    brandCode,
    parentId,
    level,
    code,
    nameCn,
    nameEn: null,
    slug: null,
    sortOrder: 0,
    status: 'active',
    description: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function product(
  id: string,
  brand: string,
  overrides: Partial<ProductEntity> = {},
): ProductEntity {
  return {
    id,
    tenantId: 'tenant-1',
    sku: id,
    name: id,
    brand,
    category: null,
    spec: {},
    positioning: {} as any,
    assetRefs: [],
    productKey: null,
    listPrice: 0,
    costPrice: 0,
    currency: 'CNY',
    status: 'active',
    meta: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}
