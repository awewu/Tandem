import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BRAND_PRODUCT_CATEGORY_SEEDS,
  assertBrandProductCategoryLevel,
  flattenBrandProductCategorySeeds,
  planIdempotentBrandProductCategorySeeds,
} from './brand-product-category.seed';

test('brand product category seeds are scoped by brand', () => {
  const rows = flattenBrandProductCategorySeeds();
  const brands = new Set(rows.map((row) => row.brandCode));
  assert.deepEqual([...brands].sort(), ['everhot', 'rheem', 'ruud']);

  const homeRows = rows.filter((row) => row.code === 'home' && row.parentCode === null);
  assert.equal(homeRows.length, 3);
  assert.deepEqual(homeRows.map((row) => row.brandCode).sort(), ['everhot', 'rheem', 'ruud']);
});

test('default seeds provide active level-1 and level-2 categories for every supported brand', () => {
  const rows = flattenBrandProductCategorySeeds(DEFAULT_BRAND_PRODUCT_CATEGORY_SEEDS);

  for (const brandCode of ['everhot', 'rheem', 'ruud']) {
    const brandRows = rows.filter((row) => row.brandCode === brandCode);
    const level1 = brandRows.filter((row) => row.level === 1);
    const level2 = brandRows.filter((row) => row.level === 2);

    assert.ok(level1.length >= 1, `${brandCode} should have default level-1 categories`);
    assert.ok(level2.length >= 1, `${brandCode} should have default level-2 categories`);
    assert.equal(brandRows.every((row) => row.status === 'active'), true);
    assert.equal(level2.every((row) => Boolean(row.parentCode)), true);
  }
});

test('brand product category model allows unbounded positive levels', () => {
  assert.doesNotThrow(() => assertBrandProductCategoryLevel(1));
  assert.doesNotThrow(() => assertBrandProductCategoryLevel(2));
  assert.doesNotThrow(() => assertBrandProductCategoryLevel(3));
  assert.doesNotThrow(() => assertBrandProductCategoryLevel(4));
  assert.throws(() => assertBrandProductCategoryLevel(0), /positive integer/);
  assert.doesNotThrow(() =>
    flattenBrandProductCategorySeeds({
      test: [{ code: 'a', nameCn: 'A', sortOrder: 1, children: [{ code: 'b', nameCn: 'B', sortOrder: 1, children: [{ code: 'c', nameCn: 'C', sortOrder: 1, children: [{ code: 'd', nameCn: 'D', sortOrder: 1 }] }] }] }],
    }),
  );
});

test('default Everhot seeds include current website example categories', () => {
  const rows = flattenBrandProductCategorySeeds(DEFAULT_BRAND_PRODUCT_CATEGORY_SEEDS);
  const everhot = rows.filter((row) => row.brandCode === 'everhot');
  const byParent = new Map<string, string[]>();
  for (const row of everhot) {
    byParent.set(row.parentCode ?? 'root', [...(byParent.get(row.parentCode ?? 'root') ?? []), row.nameCn]);
  }

  assert.deepEqual(byParent.get('root'), ['家用', '商用']);
  assert.deepEqual(byParent.get('home'), ['家用中央空调', '地暖系统', '全热新风']);
  assert.deepEqual(byParent.get('commercial'), [
    '热水系统',
    '燃气冷凝壁挂炉',
    '零冷水燃气热水器',
    '空气能热水器',
    '容积式燃气热水器',
    '电热水器',
    '采暖热水两联供',
  ]);
});

test('default seed planning is idempotent for brand-parent-code and brand-parent-name', () => {
  const seeds = flattenBrandProductCategorySeeds();
  assert.equal(planIdempotentBrandProductCategorySeeds([], seeds).length, seeds.length);
  assert.equal(planIdempotentBrandProductCategorySeeds(seeds, seeds).length, 0);

  const planned = planIdempotentBrandProductCategorySeeds(
    [{ brandCode: 'everhot', parentCode: null, code: 'different-code', nameCn: '家用' }],
    seeds,
  );
  assert.equal(planned.some((row) => row.brandCode === 'everhot' && row.parentCode === null && row.nameCn === '家用'), false);
  assert.equal(planned.some((row) => row.brandCode === 'rheem' && row.parentCode === null && row.nameCn === '家用'), true);
});
