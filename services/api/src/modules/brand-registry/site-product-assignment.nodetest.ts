import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryRepository, makeFakeDataSource } from '../common/testing/fake-datasource';
import { BrandSiteEntity, SiteProductAssignmentEntity } from './brand-site.entity';
import {
  assertSiteProductBrandAllowed, normalizePublicSlug, normalizeSiteCode, projectSiteProductDisplay,
  resolvePublicSiteTenant, SiteProductAssignmentService,
} from './site-product-assignment.service';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVE_PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const HIDDEN_PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const DRAFT_PRODUCT_ID = '44444444-4444-4444-8444-444444444444';
const ARCHIVED_PRODUCT_ID = '55555555-5555-4555-8555-555555555555';
const RUUD_PRODUCT_ID = '66666666-6666-4666-8666-666666666666';
const UNASSIGNED_PRODUCT_ID = '77777777-7777-4777-8777-777777777777';

test('网站代码和公开 slug 统一转为小写', () => {
  assert.equal(normalizeSiteCode(' Rheem-CN '), 'rheem-cn');
  assert.equal(normalizePublicSlug(' PRO-TERRA-50 '), 'pro-terra-50');
});

test('网站代码和公开 slug 拒绝路径及空白字符', () => {
  assert.throws(() => normalizeSiteCode('../rheem'), /格式无效/);
  assert.throws(() => normalizePublicSlug('heat pump'), /小写字母/);
});

test('公开站点优先使用 SITE 前缀租户配置', () => {
  const previousSite = process.env.SITE_RHAUTT_GROUP_TENANT_ID;
  const previousBrand = process.env.RHAUTT_GROUP_TENANT_ID;
  process.env.SITE_RHAUTT_GROUP_TENANT_ID = '11111111-1111-4111-8111-111111111111';
  process.env.RHAUTT_GROUP_TENANT_ID = '22222222-2222-4222-8222-222222222222';
  try {
    assert.equal(resolvePublicSiteTenant('rhautt-group'), process.env.SITE_RHAUTT_GROUP_TENANT_ID);
  } finally {
    if (previousSite === undefined) delete process.env.SITE_RHAUTT_GROUP_TENANT_ID;
    else process.env.SITE_RHAUTT_GROUP_TENANT_ID = previousSite;
    if (previousBrand === undefined) delete process.env.RHAUTT_GROUP_TENANT_ID;
    else process.env.RHAUTT_GROUP_TENANT_ID = previousBrand;
  }
});

test('brand sites only accept products from the same brand', () => {
  assert.doesNotThrow(() => assertSiteProductBrandAllowed('rheem', 'rheem'));
  assert.doesNotThrow(() => assertSiteProductBrandAllowed('ruud', 'ruud'));
  assert.doesNotThrow(() => assertSiteProductBrandAllowed('everhot', 'everhot'));

  assert.throws(
    () => assertSiteProductBrandAllowed('rheem', 'ruud'),
    /rheem site only accepts rheem products/,
  );
  assert.throws(
    () => assertSiteProductBrandAllowed('ruud', 'rheem'),
    /ruud site only accepts ruud products/,
  );
  assert.throws(
    () => assertSiteProductBrandAllowed('everhot', 'rheem'),
    /everhot site only accepts everhot products/,
  );
});

test('group site accepts only supported product brands', () => {
  const supportedBrands = ['rheem', 'ruud', 'everhot', 'newbrand'];
  for (const brand of supportedBrands) {
    assert.doesNotThrow(() => assertSiteProductBrandAllowed('rhautt-group', brand, supportedBrands));
  }
  assert.doesNotThrow(() => assertSiteProductBrandAllowed('newbrand', 'newbrand', supportedBrands));
  assert.throws(
    () => assertSiteProductBrandAllowed('newbrand', 'rheem', supportedBrands),
    /newbrand site only accepts newbrand products/,
  );

  assert.throws(
    () => assertSiteProductBrandAllowed('rhautt-group', 'unknown', supportedBrands),
    /rhautt-group only accepts rheem, ruud, everhot, newbrand products/,
  );
  assert.throws(
    () => assertSiteProductBrandAllowed('rhautt-group', null, supportedBrands),
    /rhautt-group only accepts rheem, ruud, everhot, newbrand products/,
  );
});

test('group site assignment brands come from configured child brand codes', async () => {
  const user = { tenantId: TENANT_ID, userId: '99999999-9999-4999-8999-999999999999', role: 'hq_admin' } as any;
  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed(
    { ...brandSiteRecord('site-group', 'rhautt-group', 0), childBrandCodes: ['newbrand'] },
    brandSiteRecord('site-newbrand', 'newbrand', 10),
  );
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed({
    ...assignment(UNASSIGNED_PRODUCT_ID, 'draft', 'newbrand-product', 1),
    siteId: 'site-group',
    brand: 'newbrand',
  });
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);
  const products = {
    async get(productId: string, tenantId: string) {
      assert.equal(productId, UNASSIGNED_PRODUCT_ID);
      assert.equal(tenantId, TENANT_ID);
      return { success: true, data: { id: productId, productId, tenantId, brand: 'newbrand', status: 'active' } };
    },
  };

  const service = new SiteProductAssignmentService(ds, products as any);
  const saved = await service.setStatus(user, 'rhautt-group', 'assignment-newbrand-product', 'published');

  assert.equal(saved.brand, 'newbrand');
  assert.equal(saved.status, 'published');
});

test('inactive catalog products can still be published to website shelf', async () => {
  const user = { tenantId: TENANT_ID, userId: '99999999-9999-4999-8999-999999999999', role: 'brand_admin' } as any;
  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed(brandSiteRecord('site-everhot', 'everhot', 10));
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed({
    ...assignment(ACTIVE_PRODUCT_ID, 'draft', 'inactive-everhot-product', 1),
    siteId: 'site-everhot',
    brand: 'everhot',
  });
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);
  const products = {
    async get(productId: string, tenantId: string) {
      assert.equal(productId, ACTIVE_PRODUCT_ID);
      assert.equal(tenantId, TENANT_ID);
      return { success: true, data: { id: productId, productId, tenantId, brand: 'everhot', status: 'inactive' } };
    },
  };

  const service = new SiteProductAssignmentService(ds, products as any);
  const saved = await service.setStatus(user, 'everhot', 'assignment-inactive-everhot-product', 'published');

  assert.equal(saved.status, 'published');
});

test('batch publish reports row failures without stopping the whole batch', async () => {
  const user = { tenantId: TENANT_ID, userId: '99999999-9999-4999-8999-999999999999', role: 'brand_admin' } as any;
  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed(brandSiteRecord('site-everhot', 'everhot', 10));
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed({
    ...assignment(ACTIVE_PRODUCT_ID, 'draft', 'active-everhot-product', 1),
    siteId: 'site-everhot',
    brand: 'everhot',
  });
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);
  const products = {
    async get(productId: string, tenantId: string) {
      assert.equal(tenantId, TENANT_ID);
      return { success: true, data: { id: productId, productId, tenantId, brand: 'everhot', status: 'active' } };
    },
  };

  const service = new SiteProductAssignmentService(ds, products as any);
  const result = await service.batchPublish(user, 'everhot', {
    items: [
      { assignmentId: 'assignment-active-everhot-product', productId: ACTIVE_PRODUCT_ID, sku: 'OK-1' },
      { assignmentId: 'missing-assignment', productId: HIDDEN_PRODUCT_ID, sku: 'BAD-1' },
    ],
  });

  assert.equal(result.successCount, 1);
  assert.equal(result.failureCount, 1);
  assert.equal(result.success[0].assignmentId, 'assignment-active-everhot-product');
  assert.equal(result.failed[0].sku, 'BAD-1');
});

test('group site rejects products from child brands that were not selected', async () => {
  const user = { tenantId: TENANT_ID, userId: '99999999-9999-4999-8999-999999999999', role: 'hq_admin' } as any;
  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed(
    { ...brandSiteRecord('site-group', 'rhautt-group', 0), childBrandCodes: ['newbrand'] },
    brandSiteRecord('site-rheem', 'rheem', 10),
  );
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed({
    ...assignment(RUUD_PRODUCT_ID, 'draft', 'rheem-product', 1),
    siteId: 'site-group',
    brand: 'rheem',
  });
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);
  const products = {
    async get() {
      return { success: true, data: { id: RUUD_PRODUCT_ID, productId: RUUD_PRODUCT_ID, tenantId: TENANT_ID, brand: 'rheem', status: 'active' } };
    },
  };

  const service = new SiteProductAssignmentService(ds, products as any);

  await assert.rejects(
    () => service.setStatus(user, 'rhautt-group', 'assignment-rheem-product', 'published'),
    /rhautt-group only accepts newbrand products/,
  );
});

test('group site with no selected child brands rejects child-brand products', async () => {
  const user = { tenantId: TENANT_ID, userId: '99999999-9999-4999-8999-999999999999', role: 'hq_admin' } as any;
  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed(
    { ...brandSiteRecord('site-group', 'rhautt-group', 0), childBrandCodes: [] },
    brandSiteRecord('site-rheem', 'rheem', 10),
  );
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed({
    ...assignment(RUUD_PRODUCT_ID, 'draft', 'rheem-product', 1),
    siteId: 'site-group',
    brand: 'rheem',
  });
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);
  const products = {
    async get() {
      return { success: true, data: { id: RUUD_PRODUCT_ID, productId: RUUD_PRODUCT_ID, tenantId: TENANT_ID, brand: 'rheem', status: 'active' } };
    },
  };

  const service = new SiteProductAssignmentService(ds, products as any);

  await assert.rejects(
    () => service.setStatus(user, 'rhautt-group', 'assignment-rheem-product', 'published'),
    /rhautt-group only accepts configured child-brand products/,
  );
});

test('site product projection uses assignment overrides first', () => {
  const projected = projectSiteProductDisplay('rheem', {
    publicSlug: 'site-slug',
    siteTitle: 'Site title',
    siteSummary: 'Site summary',
    websiteCategory: 'Site category',
    menuGroup: 'Site menu',
    displayOrder: 12,
    isFeatured: true,
    siteMeta: { zone: 'hero' },
  }, {
    sku: 'RHM-001',
    slug: 'product-slug',
    name: 'Localized product name',
    tagline: 'Product tagline',
    category: 'Product category',
    websiteCategory: 'Product website category',
    sys: 'Product system',
    displayOrder: 88,
    image: '/brand-meta.png',
    costPrice: 12345,
  });

  assert.equal(projected.slug, 'site-slug');
  assert.equal(projected.name, 'Site title');
  assert.equal(projected.summary, 'Site summary');
  assert.equal(projected.websiteCategory, 'Site category');
  assert.equal(projected.menuGroup, 'Site menu');
  assert.equal(projected.displayOrder, 12);
  assert.equal(projected.isFeatured, true);
  assert.equal((projected.siteMeta as Record<string, unknown>).zone, 'hero');
  assert.equal('costPrice' in projected, false);
  assert.equal('privilegedMetadata' in projected, false);
});

test('site product projection falls back to public product fields', () => {
  const projected = projectSiteProductDisplay('rheem', {
    publicSlug: '',
    siteTitle: '',
    siteSummary: '',
    websiteCategory: null,
    menuGroup: null,
    displayOrder: 0,
    isFeatured: false,
  }, {
    sku: 'RHM-002',
    slug: 'product-meta-slug',
    name: 'Localized product name',
    tagline: 'Product tagline',
    category: 'Product category',
    websiteCategory: 'Product website category',
    sys: 'Hydronic system',
    displayOrder: 36,
    image: '/brand-meta.png',
    dealerPrice: 999,
  });

  assert.equal(projected.slug, 'product-meta-slug');
  assert.equal(projected.name, 'Localized product name');
  assert.equal(projected.summary, 'Product tagline');
  assert.equal(projected.websiteCategory, 'Product website category');
  assert.equal(projected.menuGroup, 'Hydronic system');
  assert.equal(projected.displayOrder, 36);
  assert.deepEqual(projected.mainImage, { role: 'main', url: '/brand-meta.png' });
  assert.equal('dealerPrice' in projected, false);
});

test('site product projection uses category, sku, and placeholder as final fallbacks', () => {
  const projected = projectSiteProductDisplay('rheem', {}, {
    sku: 'RHM-003',
    name: 'Base product name',
    category: 'Heating',
  });

  assert.equal(projected.slug, 'RHM-003');
  assert.equal(projected.name, 'Base product name');
  assert.equal(projected.summary, 'Heating');
  assert.equal(projected.websiteCategory, 'Heating');
  assert.equal(projected.menuGroup, '');
  assert.equal(projected.displayOrder, 0);
  assert.equal(typeof (projected.mainImage as Record<string, unknown>).url, 'string');
  assert.match(String((projected.mainImage as Record<string, unknown>).url), /^data:image\/svg\+xml/);
});

test('Everhot public site products return only published shelf assignments with website-safe fields', async () => {
  const previous = process.env.SITE_EVERHOT_TENANT_ID;
  process.env.SITE_EVERHOT_TENANT_ID = TENANT_ID;

  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed({
    id: 'site-everhot',
    tenantId: TENANT_ID,
    code: 'everhot',
    nameCn: 'Everhot',
    nameEn: 'Everhot',
    appKey: null,
    deliveryType: 'self_hosted',
    developmentUrl: 'http://localhost:5011/',
    productionUrl: 'https://www.everhot.example',
    logoArtifactId: null,
    sortOrder: 1,
    status: 'active',
    siteNote: null,
    childBrandCodes: [],
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed(
    assignment(ACTIVE_PRODUCT_ID, 'published', 'proterra-active', 1),
    assignment(HIDDEN_PRODUCT_ID, 'hidden', 'proterra-hidden', 2),
    assignment(DRAFT_PRODUCT_ID, 'draft', 'proterra-draft', 3),
    assignment(ARCHIVED_PRODUCT_ID, 'published', 'proterra-archived', 4),
    assignment(RUUD_PRODUCT_ID, 'published', 'ruud-cross-brand', 5),
    { ...assignment('88888888-8888-4888-8888-888888888888', 'published', 'deleted-assignment', 6), deletedAt: new Date('2026-01-02T00:00:00Z') },
  );
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);

  const hydratedProductIds: string[][] = [];
  const products = {
    async listPublicLocalizedByIds(ids: string[]) {
      hydratedProductIds.push(ids);
      assert.equal(ids.includes(HIDDEN_PRODUCT_ID), false, 'hidden shelf assignments must not be hydrated');
      assert.equal(ids.includes(DRAFT_PRODUCT_ID), false, 'draft shelf assignments must not be hydrated');
      assert.equal(ids.includes(UNASSIGNED_PRODUCT_ID), false, 'unassigned products must not be hydrated');
      return ids
        .filter((id) => id === ACTIVE_PRODUCT_ID)
        .map((id) => ({
          productId: id,
          brand: 'everhot',
          category: 'Hot Water',
          categoryLevel1Id: 'everhot-l1',
          categoryLevel2Id: 'everhot-l2',
          categoryLevel3Id: 'everhot-l3',
          categoryPath: '家用 / 热水系统 / 空气能热水器',
          sku: 'EH-200',
          slug: 'catalog-slug',
          name: 'Catalog product',
          tagline: 'Catalog summary',
          cost: 100,
          costPrice: 200,
          dealerPrice: 300,
          internalPrice: 400,
          priceListItems: [{ dealerPrice: 300 }],
          tenantId: TENANT_ID,
          privilegedMetadata: { workflow: 'internal' },
          workflowState: 'approved',
          deletedAt: new Date('2026-01-03T00:00:00Z'),
          meta: { private: true },
        }))
        .concat(ids
          .filter((id) => id === RUUD_PRODUCT_ID)
          .map((id) => ({
            productId: id,
            brand: 'ruud',
            category: 'Hot Water',
            sku: 'RUUD-200',
            slug: 'ruud-cross-brand',
            name: 'Ruud stale assignment',
            tagline: 'Should not render on Everhot',
          })));
    },
  };

  try {
    const service = new SiteProductAssignmentService(ds, products as any);
    const result = await service.publicList('everhot', 'zh-CN');
    const items = (result.data.items as Record<string, unknown>[]);

    assert.deepEqual(hydratedProductIds, [[ACTIVE_PRODUCT_ID, ARCHIVED_PRODUCT_ID, RUUD_PRODUCT_ID]]);
    assert.equal(result.success, true);
    assert.equal(result.data.total, 1);
    assert.deepEqual(items.map((item) => item.slug), ['proterra-active']);
    assert.equal(items[0].slug, 'proterra-active');
    assert.equal(items[0].siteCode, 'everhot');
    assert.equal(items[0].categoryLevel1Id, 'everhot-l1');
    assert.equal(items[0].categoryLevel2Id, 'everhot-l2');
    assert.equal(items[0].categoryLevel3Id, 'everhot-l3');
    assert.equal(items[0].categoryPath, '家用 / 热水系统 / 空气能热水器');
    for (const field of [
      'cost', 'costPrice', 'dealerPrice', 'internalPrice', 'priceListItems',
      'tenantId', 'privilegedMetadata', 'workflowState', 'deletedAt', 'meta',
    ]) {
      assert.equal(field in items[0], false, `${field} must not be exposed`);
    }
  } finally {
    if (previous === undefined) delete process.env.SITE_EVERHOT_TENANT_ID;
    else process.env.SITE_EVERHOT_TENANT_ID = previous;
  }
});

test('admin assignment list can include archived rows for row-level shelf state', async () => {
  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed(brandSite('everhot'));
  const active = assignment(ACTIVE_PRODUCT_ID, 'published', 'active-row', 1);
  const archived = {
    ...assignment(ARCHIVED_PRODUCT_ID, 'hidden', 'archived-row', 2),
    deletedAt: new Date('2026-01-02T00:00:00Z'),
  };
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed(active, archived);
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);
  const service = new SiteProductAssignmentService(ds, { get: async () => ({ data: {} }) } as any);
  const user = { tenantId: TENANT_ID, userId: TENANT_ID, role: 'brand_admin' } as any;

  const normal = await service.list(user, 'everhot');
  const withArchived = await service.list(user, 'everhot', true);

  assert.deepEqual(normal.items.map((item) => item.publicSlug), ['active-row']);
  assert.deepEqual(withArchived.items.map((item) => item.publicSlug), ['active-row', 'archived-row']);
});

test('publishing a stale cross-brand concrete-site assignment is rejected', async () => {
  const brandSites = new InMemoryRepository<BrandSiteEntity>().seed(brandSite('rheem'));
  const assignments = new InMemoryRepository<SiteProductAssignmentEntity>().seed({
    ...assignment(ACTIVE_PRODUCT_ID, 'draft', 'ruud-row-on-rheem', 1),
    siteId: 'site-rheem',
    brand: 'ruud',
  });
  const { ds } = makeFakeDataSource([
    [BrandSiteEntity, brandSites],
    [SiteProductAssignmentEntity, assignments],
  ]);
  const products = {
    async get() {
      return { data: { id: ACTIVE_PRODUCT_ID, status: 'active', brand: 'ruud' } };
    },
  };
  const service = new SiteProductAssignmentService(ds, products as any);
  const user = { tenantId: TENANT_ID, userId: TENANT_ID, role: 'brand_admin' } as any;

  await assert.rejects(
    () => service.setStatus(user, 'rheem', 'assignment-ruud-row-on-rheem', 'published'),
    /rheem site only accepts rheem products/,
  );
});

function brandSite(code: 'rheem' | 'ruud' | 'everhot'): BrandSiteEntity {
  return {
    id: `site-${code}`,
    tenantId: TENANT_ID,
    code,
    nameCn: code,
    nameEn: code,
    appKey: null,
    deliveryType: 'self_hosted',
    developmentUrl: null,
    productionUrl: null,
    logoArtifactId: null,
    sortOrder: 1,
    status: 'active',
    siteNote: null,
    childBrandCodes: [],
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

function assignment(
  productId: string,
  status: 'draft' | 'published' | 'hidden',
  publicSlug: string,
  displayOrder: number,
): SiteProductAssignmentEntity {
  return {
    id: `assignment-${publicSlug}`,
    tenantId: TENANT_ID,
    siteId: 'site-everhot',
    productTenantId: TENANT_ID,
    productId,
    brand: 'everhot',
    publicSlug,
    websiteCategory: null,
    menuGroup: null,
    displayOrder,
    isFeatured: false,
    status,
    siteTitle: null,
    siteSummary: null,
    siteMeta: {},
    publishedAt: status === 'published' ? new Date('2026-01-01T00:00:00Z') : null,
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    deletedAt: null,
    createdAt: new Date(`2026-01-01T00:00:0${displayOrder}Z`),
    updatedAt: new Date(`2026-01-01T00:00:0${displayOrder}Z`),
  };
}

function brandSiteRecord(id: string, code: string, sortOrder: number): BrandSiteEntity {
  return {
    id,
    tenantId: TENANT_ID,
    code,
    nameCn: code,
    nameEn: code,
    appKey: null,
    deliveryType: 'self_hosted',
    developmentUrl: null,
    productionUrl: null,
    logoArtifactId: null,
    sortOrder,
    status: 'active',
    siteNote: null,
    childBrandCodes: [],
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}
