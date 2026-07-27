import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import {
  PriceListItemEntity,
  ProductContentEntity,
  ProductContentEventEntity,
  ProductEntity,
} from './product-catalog.entity';
import { BrandProductCategoryEntity } from '../brand-product-category/brand-product-category.entity';
import { ProductCatalogService } from './product-catalog.service';

const TENANT_ID = '4aee0000-0000-4000-8000-000000000001';
const ACTOR = { userId: 'operator-1', role: 'brand_admin' };

test('product update accepts valid brand category binding and read returns category path', async () => {
  const { service } = serviceFixture({
    categories: [
      category('l1', 'everhot', 1, null, 'Residential'),
      category('l2', 'everhot', 2, 'l1', 'Water Heating'),
      category('l3', 'everhot', 3, 'l2', 'Tankless'),
      category('l4', 'everhot', 4, 'l3', 'Ultra Deep'),
    ],
    products: [product('p1', 'everhot')],
  });

  const updated = await service.update('p1', TENANT_ID, {
    primaryCategoryId: 'l4',
  }, ACTOR);
  const meta = (updated.data.meta as any).everhot;

  assert.equal(meta.primaryCategoryId, 'l4');
  assert.equal(meta.categoryLevel1Id, 'l1');
  assert.equal(meta.categoryLevel2Id, 'l2');
  assert.equal(meta.categoryLevel3Id, 'l3');
  assert.equal(meta.categoryPath, 'Residential / Water Heating / Tankless / Ultra Deep');
  assert.equal(meta.categoryBindings[0].categoryId, 'l4');

  const read = await service.get('p1', TENANT_ID);
  assert.equal((read.data as any).primaryCategoryId, 'l4');
  assert.equal((read.data as any).categoryLevel1Id, 'l1');
  assert.equal((read.data as any).categoryLevel2Id, 'l2');
  assert.equal((read.data as any).categoryLevel3Id, 'l3');
  assert.equal((read.data as any).categoryPath, 'Residential / Water Heating / Tankless / Ultra Deep');
  assert.equal((read.data as any).categoryAncestry.length, 4);
});

test('product update accepts root and intermediate category bindings', async () => {
  const { service } = serviceFixture({
    categories: [
      category('l1', 'everhot', 1, null, 'Residential'),
      category('l2', 'everhot', 2, 'l1', 'Water Heating'),
    ],
    products: [product('root-bound', 'everhot'), product('mid-bound', 'everhot')],
  });

  const root = await service.update('root-bound', TENANT_ID, { primaryCategoryId: 'l1' }, ACTOR);
  const mid = await service.update('mid-bound', TENANT_ID, { categoryId: 'l2' }, ACTOR);

  assert.equal((root.data.meta as any).everhot.categoryLevel1Id, 'l1');
  assert.equal((root.data.meta as any).everhot.categoryLevel2Id, undefined);
  assert.equal((mid.data.meta as any).everhot.primaryCategoryId, 'l2');
  assert.equal((mid.data.meta as any).everhot.categoryPath, 'Residential / Water Heating');
});

test('product update rejects category bindings from another brand', async () => {
  const { service } = serviceFixture({
    categories: [
      category('ruud-l1', 'ruud', 1, null, 'Residential'),
      category('ruud-l2', 'ruud', 2, 'ruud-l1', 'Water Heating'),
    ],
    products: [product('p1', 'everhot')],
  });

  await assert.rejects(
    () => service.update('p1', TENANT_ID, {
      primaryCategoryId: 'ruud-l2',
    }, ACTOR),
    /must belong to the product brand/,
  );
});

test('product update rejects inconsistent legacy hierarchy hints', async () => {
  const { service } = serviceFixture({
    categories: [
      category('l1', 'everhot', 1, null, 'Residential'),
      category('other-l1', 'everhot', 1, null, 'Commercial'),
      category('l2', 'everhot', 2, 'other-l1', 'Water Heating'),
    ],
    products: [product('p1', 'everhot')],
  });

  await assert.rejects(
    () => service.update('p1', TENANT_ID, {
      primaryCategoryId: 'l2',
      categoryLevel1Id: 'l1',
      categoryLevel2Id: 'l2',
    }, ACTOR),
    /must match the selected primary category ancestry/,
  );
});

test('products without new category IDs keep old fields and remain editable', async () => {
  const { service } = serviceFixture({
    products: [
      product('p1', 'everhot', {
        category: 'legacy-category',
        meta: { everhot: { websiteMenuCategory: 'Legacy menu', system: 'Legacy system' } },
      }),
    ],
  });

  await service.update('p1', TENANT_ID, { name: 'Renamed legacy product' }, ACTOR);
  const read = await service.get('p1', TENANT_ID);

  assert.equal((read.data as any).name, 'Renamed legacy product');
  assert.equal((read.data as any).category, 'legacy-category');
  assert.equal((read.data as any).categoryLevel1Id, null);
  assert.equal((read.data as any).categoryLevel2Id, null);
  assert.equal((read.data as any).categoryLevel3Id, null);
  assert.equal((read.data as any).categoryPath, 'Legacy menu / Legacy system');
});

function serviceFixture({
  categories = [],
  products = [],
}: {
  categories?: BrandProductCategoryEntity[];
  products?: ProductEntity[];
}) {
  const productRepo = new InMemoryRepository<ProductEntity>().seed(...products);
  const categoryRepo = new InMemoryRepository<BrandProductCategoryEntity>().seed(...categories);
  const priceRepo = new InMemoryRepository<PriceListItemEntity>();
  const contentRepo = new InMemoryRepository<ProductContentEntity>();
  const eventRepo = new InMemoryRepository<ProductContentEventEntity>();
  const { ds } = makeFakeDataSource([
    [ProductEntity, productRepo],
    [BrandProductCategoryEntity, categoryRepo],
    [PriceListItemEntity, priceRepo],
    [ProductContentEntity, contentRepo],
    [ProductContentEventEntity, eventRepo],
  ]);
  const eventBus = { publishInTx: async () => undefined };
  const fileArtifacts = {};
  return {
    service: new ProductCatalogService(
      ds,
      productRepo as any,
      priceRepo as any,
      contentRepo as any,
      eventBus as any,
      fileArtifacts as any,
      categoryRepo as any,
    ),
    products: productRepo,
    categories: categoryRepo,
  };
}

function category(
  id: string,
  brandCode: string,
  level: number,
  parentId: string | null,
  nameCn: string,
): BrandProductCategoryEntity {
  return {
    id,
    brandCode,
    parentId,
    level,
    code: id,
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
    tenantId: TENANT_ID,
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
