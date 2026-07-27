import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import { ProductEntity } from '../product-catalog/product-catalog.entity';
import { BrandProductCategoryEntity } from './brand-product-category.entity';
import { BrandProductCategoryService } from './brand-product-category.service';

test('lists selected brand category tree ordered by sortOrder', async () => {
  const { service } = serviceFixture([
    category('l2-b', 'everhot', 2, 'root', 'floor', 20),
    category('root', 'everhot', 1, null, 'home', 10),
    category('l2-a', 'everhot', 2, 'root', 'water', 5),
    category('ruud-root', 'ruud', 1, null, 'home', 1),
  ]);

  const result = await service.list('everhot');

  assert.equal(result.data.total, 3);
  assert.deepEqual(result.data.items.map((item) => item.code), ['home', 'water', 'floor']);
  assert.deepEqual(result.data.tree.map((item) => item.code), ['home']);
  assert.deepEqual(result.data.tree[0].children.map((item) => item.code), ['water', 'floor']);
});

test('lazy category list returns only root rows with tree-table metadata', async () => {
  const { service } = serviceFixture(
    [
      category('root', 'everhot', 1, null, 'home', 10),
      category('child', 'everhot', 2, 'root', 'water', 10),
      category('other-root', 'everhot', 1, null, 'commercial', 20),
    ],
    [
      product('p-root', 'everhot', { primaryCategoryId: 'root' }),
      product('p-child', 'everhot', { primaryCategoryId: 'child' }),
    ],
  );

  const result = await service.list('everhot', 'root');

  assert.deepEqual(result.data.items.map((item: any) => item.id), ['root', 'other-root']);
  assert.equal((result.data.items[0] as any).hasChildren, true);
  assert.equal((result.data.items[0] as any).directProductCount, 1);
  assert.equal((result.data.items[0] as any).descendantProductCount, 1);
});

test('lazy category list returns direct children for parentId only', async () => {
  const { service } = serviceFixture([
    category('root-id', 'everhot', 1, null, 'home', 10),
    category('child', 'everhot', 2, 'root-id', 'water', 10),
    category('grandchild', 'everhot', 3, 'child', 'tankless', 10),
  ]);

  const result = await service.list('everhot', 'root-id');

  assert.deepEqual(result.data.items.map((item: any) => item.id), ['child']);
  assert.equal((result.data.items[0] as any).hasChildren, true);
  assert.equal((result.data.items[0] as any).childCategoryCount, 1);
});

test('lazy category metrics count legacy product knowledge fields before id backfill', async () => {
  const { service } = serviceFixture(
    [
      category('root', 'everhot', 1, null, 'home', 10),
      category('child', 'everhot', 2, 'root', 'water', 10),
      category('other-root', 'everhot', 1, null, 'commercial', 20),
    ],
    [
      { ...product('p-home', 'everhot', {}), category: 'home' },
      product('p-menu', 'everhot', { everhot: { websiteMenuCategory: 'commercial' } }),
      product('p-system', 'everhot', { everhot: { system: 'water' } }),
      { ...product('p-archived', 'everhot', { everhot: { system: 'water' } }), status: 'archived' },
      product('p-cross-brand', 'ruud', { ruud: { system: 'water' } }),
    ],
  );

  const result = await service.list('everhot', 'root');

  assert.equal((result.data.items[0] as any).directProductCount, 1);
  assert.equal((result.data.items[0] as any).descendantProductCount, 1);
  assert.equal((result.data.items[1] as any).directProductCount, 1);
});

test('public category tree is brand-scoped and exposes only website-safe fields', async () => {
  const deleted = category('deleted', 'everhot', 1, null, 'deleted', 30);
  deleted.deletedAt = new Date('2026-01-02T00:00:00Z');
  const inactive = category('inactive', 'everhot', 1, null, 'inactive', 20);
  inactive.status = 'inactive';
  inactive.description = 'operator-only note';
  const { service } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
    category('child', 'everhot', 2, 'root', 'water', 5),
    inactive,
    deleted,
    category('ruud-root', 'ruud', 1, null, 'home', 1),
  ]);

  const result = await service.publicList('everhot');
  const items = result.data.items as Array<Record<string, unknown>>;

  assert.equal(result.data.brandCode, 'everhot');
  assert.deepEqual(items.map((item) => item.code), ['home', 'water']);
  assert.deepEqual(result.data.tree.map((item) => item.code), ['home']);
  assert.deepEqual(result.data.tree[0].children.map((item) => item.code), ['water']);
  assert.ok(items.every((item) => item.brandCode === 'everhot'));
  for (const item of items) {
    for (const field of ['description', 'deletedAt', 'createdAt', 'updatedAt']) {
      assert.equal(field in item, false, `${field} must not be exposed`);
    }
  }
});

test('public category tree rejects invalid brand codes', async () => {
  const { service } = serviceFixture();

  await assert.rejects(
    () => service.publicList('../everhot'),
    /brandCode must use lowercase letters/,
  );
});

test('creates categories beyond three levels without a depth limit', async () => {
  const { service, categories } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
    category('child', 'everhot', 2, 'root', 'water', 10),
    category('grandchild', 'everhot', 3, 'child', 'tankless', 10),
  ]);

  const root = await service.create({
    brandCode: 'everhot',
    level: 1,
    code: 'commercial',
    nameCn: 'Commercial',
  });
  const child = await service.create({
    brandCode: 'everhot',
    parentId: 'root',
    level: 2,
    code: 'floor-heating',
    nameCn: 'Floor heating',
  });
  const deep = await service.create({
    brandCode: 'everhot',
    parentId: 'grandchild',
    code: 'heat-pump',
    nameCn: 'Heat pump',
  });

  assert.equal(root.data.level, 1);
  assert.equal(child.data.parentId, 'root');
  assert.equal(deep.data.level, 4);
  assert.equal(categories.rows.length, 6);
});

test('rejects invalid root and parent-level mismatches but not deep parents', async () => {
  const { service } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
    category('child', 'everhot', 2, 'root', 'water', 10),
    category('leaf', 'everhot', 3, 'child', 'tankless', 10),
  ]);

  await assert.rejects(
    () => service.create({ brandCode: 'everhot', level: 2, code: 'orphan', nameCn: 'Orphan' }),
    /Root categories must use level 1/,
  );
  await assert.rejects(
    () => service.create({ brandCode: 'everhot', parentId: 'root', level: 3, code: 'wrong-level', nameCn: 'Wrong' }),
    /must be 2/,
  );
  await assert.doesNotReject(
    () => service.create({ brandCode: 'everhot', parentId: 'leaf', code: 'level-4', nameCn: 'Level 4' }),
  );
});

test('prevents duplicate code under the same brand and parent', async () => {
  const { service } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
    category('other-root', 'ruud', 1, null, 'home', 10),
  ]);

  await assert.rejects(
    () => service.create({ brandCode: 'everhot', level: 1, code: 'home', nameCn: 'Duplicate' }),
    /already exists/,
  );
  await assert.doesNotReject(
    () => service.create({ brandCode: 'ruud', parentId: 'other-root', level: 2, code: 'home', nameCn: 'Allowed child' }),
  );
});

test('updates category fields and disables through status patch', async () => {
  const { service } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
  ]);

  const result = await service.update('root', {
    nameCn: 'Home Comfort',
    code: 'home-comfort',
    slug: 'home-comfort',
    sortOrder: 3,
    status: 'inactive',
    description: 'Disabled from new bindings',
  });

  assert.equal(result.data.nameCn, 'Home Comfort');
  assert.equal(result.data.code, 'home-comfort');
  assert.equal(result.data.status, 'inactive');
  assert.equal(result.data.sortOrder, 3);
});

test('moves categories and rejects cycles', async () => {
  const { service } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
    category('child', 'everhot', 2, 'root', 'water', 10),
    category('leaf', 'everhot', 3, 'child', 'tankless', 10),
    category('other', 'everhot', 1, null, 'commercial', 20),
  ]);

  const moved = await service.update('child', { parentId: 'other' });

  assert.equal(moved.data.parentId, 'other');
  assert.equal(moved.data.level, 2);
  await assert.rejects(
    () => service.update('other', { parentId: 'leaf' }),
    /cycle/,
  );
});

test('soft deletes categories without bound products', async () => {
  const { service, categories } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
  ]);

  const result = await service.delete('root');

  assert.equal(result.data.deleted, true);
  assert.ok(categories.rows[0].deletedAt instanceof Date);
  const list = await service.list('everhot');
  assert.equal(list.data.total, 0);
});

test('delete rejects categories with child categories', async () => {
  const { service } = serviceFixture([
    category('root', 'everhot', 1, null, 'home', 10),
    category('child', 'everhot', 2, 'root', 'water', 10),
  ]);

  const usage = await service.usage('root');

  assert.equal(usage.data.childCategoryCount, 1);
  await assert.rejects(
    () => service.delete('root'),
    /child category/,
  );
});

test('usage returns bound product count and delete rejects bound categories', async () => {
  const { service } = serviceFixture(
    [category('root', 'everhot', 1, null, 'home', 10)],
    [
      product('p1', 'everhot', { categoryLevel1Id: 'root' }),
      product('p2', 'everhot', { categoryLevel2Id: 'other' }),
      product('p3', 'ruud', { categoryLevel1Id: 'root' }),
      { ...product('p4', 'everhot', { categoryLevel1Id: 'root' }), status: 'archived' },
    ],
  );

  const usage = await service.usage('root');

  assert.equal(usage.data.boundProductCount, 1);
  assert.equal(usage.data.descendantBoundProductCount, 1);
  await assert.rejects(
    () => service.delete('root'),
    /Move or clear product category bindings first/,
  );
});

test('usage boundProductCount follows the existing frontend category-level filters', async () => {
  const { service } = serviceFixture(
    [
      category('root', 'everhot', 1, null, 'home', 10),
      category('mid', 'everhot', 2, 'root', 'water', 10),
      category('leaf', 'everhot', 3, 'mid', 'tankless', 10),
      category('deep', 'everhot', 4, 'leaf', 'deep', 10),
    ],
    [
      product('p-root', 'everhot', { categoryLevel1Id: 'root', primaryCategoryId: 'root' }),
      product('p-deep', 'everhot', {
        categoryLevel1Id: 'root',
        categoryLevel2Id: 'mid',
        categoryLevel3Id: 'leaf',
        primaryCategoryId: 'deep',
        categoryBindings: [{ categoryId: 'deep', role: 'primary' }],
      }),
    ],
  );

  const root = await service.usage('root');
  const mid = await service.usage('mid');
  const deep = await service.usage('deep');

  assert.equal(root.data.boundProductCount, 2);
  assert.equal(root.data.currentProductCount, 2);
  assert.equal(root.data.exactBoundProductCount, 1);
  assert.equal(mid.data.boundProductCount, 1);
  assert.equal(mid.data.exactBoundProductCount, 0);
  assert.equal(deep.data.boundProductCount, 1);
  assert.equal(deep.data.exactBoundProductCount, 1);
});

test('brand product category API surface has route ownership', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getRouteOwner } = require('../../../../../server/modules/routeOwnership');

  assert.equal(
    getRouteOwner('/api/v2/brand-product-categories').owner,
    'services/api/src/modules/brand-product-category',
  );
  assert.equal(
    getRouteOwner('/api/v2/brand-product-categories/root/usage').owner,
    'services/api/src/modules/brand-product-category',
  );
});

function serviceFixture(
  categoryRows: BrandProductCategoryEntity[] = [],
  productRows: ProductEntity[] = [],
) {
  const categories = new InMemoryRepository<BrandProductCategoryEntity>().seed(...categoryRows);
  const products = new InMemoryRepository<ProductEntity>().seed(...productRows);
  const { ds } = makeFakeDataSource([
    [BrandProductCategoryEntity, categories],
    [ProductEntity, products],
  ]);
  return {
    service: new BrandProductCategoryService(ds, categories as any, products as any),
    categories,
    products,
  };
}

function category(
  id: string,
  brandCode: string,
  level: number,
  parentId: string | null,
  code: string,
  sortOrder: number,
): BrandProductCategoryEntity {
  return {
    id,
    brandCode,
    parentId,
    level,
    code,
    nameCn: code,
    nameEn: null,
    slug: null,
    sortOrder,
    status: 'active',
    description: null,
    deletedAt: null,
    createdAt: new Date(`2026-01-01T00:00:${String(sortOrder).padStart(2, '0')}Z`),
    updatedAt: new Date(`2026-01-01T00:00:${String(sortOrder).padStart(2, '0')}Z`),
  };
}

function product(id: string, brand: string, meta: Record<string, unknown>): ProductEntity {
  return {
    id,
    tenantId: 'rhautt_shared',
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
    meta,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}
