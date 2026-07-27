import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blankNewProductDraft,
  buildBrandProductListQuery,
  buildBrandStructuredContentUpdatePayload,
  buildBrandProductUpdatePayload,
  buildNewBrandProductPayload,
  canWriteBrandProducts,
  draftFromProductRow,
  getBrandMenuGroupOptions,
  isDirtyStructuredContentDraft,
  isDirtyProductDraft,
  loadBrandProductConsoleData,
  resolveBrandSiteEnvironmentLinks,
  structuredDraftFromProductRow,
  type BrandProductRow,
} from './brand-product-adapter';

const row: BrandProductRow = {
  id: 'product-001',
  sku: 'EVH-OLD',
  materialCode: 'EVH-OLD',
  publicSlug: 'old-slug',
  name: 'Old name',
  model: 'OLD-MODEL',
  category: 'water-heater',
  materialCategory: 'water-heater',
  productLine: 'legacy-line',
  categoryLevel1Id: 'cat-l1',
  categoryLevel2Id: 'cat-l2',
  categoryLevel3Id: null,
  categoryPath: '家用 / 热水系统',
  applicationScenarios: [],
  system: 'hot-water',
  websiteMenuCategory: 'legacy-menu',
  status: 'active',
  sortOrder: 10,
  imageState: {
    hasMainImage: true,
    mainImageUrl: '/main.png',
    mainArtifactId: 'artifact-1',
    mainRef: { role: 'main', artifactId: 'artifact-1', url: '/main.png' },
    detailRefs: [],
    galleryCount: 2,
    label: 'main image ready',
  },
  metadataReadiness: { ready: false, score: 60, missing: ['features'] },
  raw: {
    id: 'product-001',
    tenantId: 'tenant-everhot',
    sku: 'EVH-OLD',
    brand: 'everhot',
    name: 'Old name',
    category: 'water-heater',
    spec: {
      voltage: '220V',
      officialModel: 'OLD-MODEL',
    },
    meta: {
      untouchedGlobal: 'keep',
      rheem: {
        slug: 'rheem-slug',
        name: 'Rheem row',
      },
      everhot: {
        slug: 'old-slug',
        name: 'Old name',
        model: 'OLD-MODEL',
        cat: 'legacy-menu',
        sys: 'hot-water',
        displayOrder: 10,
        tagline: 'Old tagline',
        specs: [{ k: 'capacity', v: '180L' }],
        features: [{ title: 'Old feature', description: 'Keep warm' }],
        highlights: [{ label: 'Warranty', value: '3 years' }],
        certs: ['CE'],
        faqs: [{ q: 'Old question', a: 'Old answer' }],
        gallery: [{ url: '/old-gallery.jpg', alt: 'Old gallery' }],
        retainedNested: { keep: true },
      },
    },
    positioning: {
      targetSegments: ['residential'],
      channels: ['dealer'],
      retainedPositioning: ['keep'],
    },
  },
};

test('brand product update payload preserves unrelated metadata while updating selected brand fields', () => {
  const draft = {
    ...draftFromProductRow(row),
    publicSlug: 'New Slug',
    name: 'New name',
    model: 'NEW-MODEL',
    category: 'tankless',
    system: 'hot-water-plus',
    websiteMenuCategory: 'commercial',
    sortOrder: '8',
    tagline: 'Official site copy',
    badges: 'New, Efficient',
  };

  assert.equal(isDirtyProductDraft(row, draft), true);

  const payload = buildBrandProductUpdatePayload('everhot', row, draft) as any;
  assert.equal(payload.tenantId, 'tenant-everhot');
  assert.equal(payload.name, 'New name');
  assert.equal(payload.category, 'tankless');
  assert.equal(payload.spec.voltage, '220V');
  assert.equal(payload.spec.officialModel, 'NEW-MODEL');
  assert.equal(payload.meta.untouchedGlobal, 'keep');
  assert.deepEqual(payload.meta.rheem, { slug: 'rheem-slug', name: 'Rheem row' });
  assert.deepEqual(payload.meta.everhot.retainedNested, { keep: true });
  assert.equal(payload.meta.everhot.slug, 'new-slug');
  assert.equal(payload.meta.everhot.displayOrder, 8);
  assert.deepEqual(payload.meta.everhot.badges, ['New', 'Efficient']);
});

test('new brand product payload creates an inactive publishable skeleton for selected brand', () => {
  const draft = {
    ...blankNewProductDraft('everhot'),
    publicSlug: 'matrix-one',
    name: 'Matrix One',
    model: 'MX-1',
    category: 'water-heater',
    system: 'hot-water',
    websiteMenuCategory: 'commercial',
    tagline: 'Ready for official website',
  };

  const payload = buildNewBrandProductPayload('everhot', draft) as any;
  assert.equal(payload.brand, 'everhot');
  assert.equal(payload.status, 'inactive');
  assert.equal(payload.sku, 'EVERHOT-MX-1');
  assert.equal(payload.spec.officialModel, 'MX-1');
  assert.equal(payload.meta.everhot.slug, 'matrix-one');
  assert.deepEqual(payload.meta.everhot.specs, []);
  assert.deepEqual(payload.meta.everhot.features, []);
  assert.deepEqual(payload.meta.everhot.highlights, []);
});

test('brand product writes fail closed for read-only sessions', () => {
  assert.equal(canWriteBrandProducts(null), false);
  assert.equal(canWriteBrandProducts({ role: 'sales', permissions: [] }), false);
  assert.equal(canWriteBrandProducts({ role: 'brand_admin', permissions: [] }), true);
  assert.equal(canWriteBrandProducts({ role: 'viewer', permissions: ['product-catalog:write'] }), true);
});

test('brand site environment links use exact labels and Everhot local fallback', () => {
  const links = resolveBrandSiteEnvironmentLinks(
    { code: 'everhot', developmentUrl: null, productionUrl: 'https://www.everhot.com.cn' },
    'everhot'
  );

  assert.deepEqual(
    links.map((link) => link.label),
    ['测试环境', '生产环境']
  );
  assert.equal(links.find((link) => link.key === 'testing')?.url, 'http://localhost:5011/');
  assert.equal(links.find((link) => link.key === 'production')?.url, 'https://www.everhot.com.cn/');
});

test('brand site environment links prefer current site development URL over fallback', () => {
  const links = resolveBrandSiteEnvironmentLinks(
    { code: 'rheem', developmentUrl: 'http://localhost:5999', productionUrl: null },
    'rheem'
  );

  assert.equal(links.find((link) => link.key === 'testing')?.url, 'http://localhost:5999/');
  assert.equal(links.find((link) => link.key === 'production')?.url, 'https://www.rheem.com.cn/');
});

test('brand product list query preserves brand scope and pagination filters', () => {
  const query = buildBrandProductListQuery(' Everhot ', {
    page: 3,
    pageSize: 500,
    keyword: ' Matrix ',
    status: 'active',
    category: 'water-heater',
    categoryLevel1Id: 'level-1',
    categoryLevel2Id: 'level-2',
    categoryLevel3Id: 'level-3',
  });

  assert.equal(query.brand, 'everhot');
  assert.equal(query.page, '3');
  assert.equal(query.pageSize, '100');
  assert.equal(query.keyword, 'Matrix');
  assert.equal(query.status, 'active');
  assert.equal(query.category, 'water-heater');
  assert.equal(query.categoryLevel1Id, 'level-1');
  assert.equal(query.categoryLevel2Id, 'level-2');
  assert.equal(query.categoryLevel3Id, 'level-3');
  assert.equal(query.tenantId, 'e5e40000-0000-4000-8000-000000000001');
});

test('category-filtered brand product console data requests only the current page', async () => {
  const queries: Array<Record<string, string> | undefined> = [];
  const data = await loadBrandProductConsoleData('everhot', {
    page: 4,
    pageSize: 7,
    categoryLevel1Id: 'level-1',
    categoryLevel2Id: 'level-2',
  }, {
    brandSites: {
      async list() {
        return { items: [brandSite('everhot')] };
      },
    },
    products: {
      async taxonomy() {
        return {};
      },
      async list(query) {
        queries.push(query);
        return {
          data: {
            items: [product('everhot-004', 'everhot', 'EVH-004', 'Everhot filtered', 4)],
            total: 29,
            page: Number(query?.page),
            pageSize: Number(query?.pageSize),
            pages: 5,
            facets: { categories: [], statuses: [] },
          },
        };
      },
    },
  });

  assert.equal(queries.length, 1);
  assert.equal(queries[0]?.brand, 'everhot');
  assert.equal(queries[0]?.page, '4');
  assert.equal(queries[0]?.pageSize, '7');
  assert.equal(queries[0]?.categoryLevel1Id, 'level-1');
  assert.equal(queries[0]?.categoryLevel2Id, 'level-2');
  assert.equal(data.page, 4);
  assert.equal(data.pageSize, 7);
  assert.equal(data.products.length, 1);
  assert.equal(data.total, 29);
});

test('brand menu group options expose Everhot navigation and preserve existing values', () => {
  const everhotOptions = getBrandMenuGroupOptions('everhot');

  assert.deepEqual(everhotOptions.map((option) => option.value), [
    '家用中央空调',
    '地暖系统',
    '全热新风',
    '热水系统',
    '燃气冷凝壁挂炉',
    '零冷水燃气热水器',
    '空气能热水器',
    '容积式燃气热水器',
    '电热水器',
    '采暖热水两联供',
  ]);

  const preserved = getBrandMenuGroupOptions('everhot', 'legacy-menu');
  assert.equal(preserved[0].value, 'legacy-menu');
  assert.equal(preserved[0].label, 'legacy-menu（当前值）');

  const residential = getBrandMenuGroupOptions('everhot', 'residential');
  assert.equal(residential[0].value, 'residential');
  assert.equal(residential[0].label, '家用（当前值）');
});

test('Rheem and Ruud menu group options have clear local fallback sets', () => {
  assert.deepEqual(getBrandMenuGroupOptions('rheem').map((option) => option.value), [
    '中央热水系统',
    '采暖系统',
    '全空气系统',
    '智能控制系统',
  ]);
  assert.deepEqual(getBrandMenuGroupOptions('ruud').map((option) => option.value), [
    '中央空调',
    '空气源热泵',
    '全热新风',
    '采暖系统',
  ]);
});

test('brand product console data returns product pagination metadata', async () => {
  const data = await loadBrandProductConsoleData('everhot', { page: 2, pageSize: 10, keyword: 'matrix' }, {
    brandSites: {
      async list() {
        return { items: [brandSite('everhot')] };
      },
    },
    products: {
      async taxonomy() {
        return {};
      },
      async list() {
        return {
          data: {
            items: [product('everhot-001', 'everhot', 'EVH-001', 'Everhot heater', 20)],
            total: 23,
            page: 2,
            pageSize: 10,
            pages: 3,
            facets: {
              categories: [{ value: 'water-heater', count: 23 }],
              statuses: [{ value: 'active', count: 21 }],
            },
          },
        };
      },
    },
  });

  assert.equal(data.total, 23);
  assert.equal(data.page, 2);
  assert.equal(data.pageSize, 10);
  assert.equal(data.pages, 3);
  assert.deepEqual(data.facets.categories, [{ value: 'water-heater', count: 23 }]);
});

test('Everhot brand site console lists only Everhot product catalog records', async () => {
  const queries: Array<Record<string, string> | undefined> = [];
  const data = await loadBrandProductConsoleData('everhot', {}, {
    brandSites: {
      async list() {
        return { items: [brandSite('everhot')] };
      },
    },
    products: {
      async taxonomy() {
        return { categories: ['water-heater'] };
      },
      async list(query) {
        queries.push(query);
        return {
          items: [
            product('everhot-001', 'everhot', 'EVH-001', 'Everhot heater', 20),
            product('rheem-001', 'rheem', 'RHM-001', 'Rheem heater', 10),
          ],
          total: 2,
        };
      },
    },
  });

  assert.equal(queries.length, 1);
  assert.equal(queries[0]?.brand, 'everhot');
  assert.equal(queries[0]?.tenantId, 'e5e40000-0000-4000-8000-000000000001');
  assert.deepEqual(data.products.map((item) => item.sku), ['EVH-001']);
  assert.equal(data.products[0].raw.brand, 'everhot');
  assert.equal(data.emptyState, null);
});

test('Rheem brand site console does not require selecting a brand and excludes other brands', async () => {
  const queries: Array<Record<string, string> | undefined> = [];
  const data = await loadBrandProductConsoleData(' Rheem ', {}, {
    brandSites: {
      async list() {
        return { items: [brandSite('rheem')] };
      },
    },
    products: {
      async taxonomy() {
        return {};
      },
      async list(query) {
        queries.push(query);
        return {
          items: [
            product('ruud-001', 'ruud', 'RUD-001', 'Ruud heater', 1),
            product('rheem-001', 'rheem', 'RHM-001', 'Rheem heater', 2),
          ],
          total: 2,
        };
      },
    },
  });

  assert.equal(data.brandCode, 'rheem');
  assert.equal(queries[0]?.brand, 'rheem');
  assert.equal(queries[0]?.page, '1');
  assert.equal(queries[0]?.pageSize, '20');
  assert.equal(queries[0]?.tenantId, '4aee0000-0000-4000-8000-000000000001');
  assert.deepEqual(data.products.map((item) => item.sku), ['RHM-001']);
});

test('group brand site console lists products from selected child brands', async () => {
  const queries: Array<Record<string, string> | undefined> = [];
  const data = await loadBrandProductConsoleData('rhautt-group', {}, {
    brandSites: {
      async list() {
        return {
          items: [
            brandSite('rhautt-group', ['rheem', 'everhot']),
            brandSite('rheem'),
            brandSite('everhot'),
            brandSite('ruud'),
          ],
        };
      },
    },
    products: {
      async taxonomy() {
        return {};
      },
      async list(query) {
        queries.push(query);
        if (query?.brand === 'rheem') return { items: [product('rheem-001', 'rheem', 'RHM-001', 'Rheem heater', 2)] };
        if (query?.brand === 'everhot') return { items: [product('everhot-001', 'everhot', 'EVH-001', 'Everhot heater', 1)] };
        return { items: [product('ruud-001', 'ruud', 'RUD-001', 'Ruud heater', 1)] };
      },
    },
  });

  assert.deepEqual(queries.map((query) => query?.brand), ['rheem', 'everhot']);
  assert.deepEqual(data.products.map((item) => item.sku), ['EVH-001', 'RHM-001']);
  assert.equal(data.total, 2);
  assert.equal(data.emptyState, null);
});

test('group brand site console can defer child product aggregation', async () => {
  const queries: Array<Record<string, string> | undefined> = [];
  const data = await loadBrandProductConsoleData('rhautt-group', { deferGroupProducts: true }, {
    brandSites: {
      async list() {
        return {
          items: [
            brandSite('rhautt-group', ['rheem', 'everhot']),
            brandSite('rheem'),
            brandSite('everhot'),
          ],
        };
      },
    },
    products: {
      async taxonomy() {
        return {};
      },
      async list(query) {
        queries.push(query);
        return { items: [product('rheem-001', 'rheem', 'RHM-001', 'Rheem heater', 2)] };
      },
    },
  });

  assert.deepEqual(queries, []);
  assert.deepEqual(data.products, []);
  assert.equal(data.emptyState, null);
});

test('group brand site console asks for child-brand binding before loading products', async () => {
  const queries: Array<Record<string, string> | undefined> = [];
  const data = await loadBrandProductConsoleData('rhautt-group', {}, {
    brandSites: {
      async list() {
        return { items: [brandSite('rhautt-group', [])] };
      },
    },
    products: {
      async taxonomy() {
        return {};
      },
      async list(query) {
        queries.push(query);
        return { items: [] };
      },
    },
  });

  assert.deepEqual(queries, []);
  assert.equal(data.emptyState?.kind, 'no-products');
  assert.match(data.emptyState?.title || '', /集团站点尚未绑定子品牌/);
});

test('brand site console empty state points operators to product catalog records', async () => {
  const data = await loadBrandProductConsoleData('ruud', {}, {
    brandSites: {
      async list() {
        return { items: [brandSite('ruud')] };
      },
    },
    products: {
      async taxonomy() {
        return {};
      },
      async list() {
        return { items: [], total: 0 };
      },
    },
  });

  assert.equal(data.emptyState?.kind, 'no-products');
  assert.match(data.emptyState?.title || '', /产品目录记录/);
  assert.match(data.emptyState?.description || '', /产品目录/);
  assert.equal(data.emptyState?.actionHref, '/products?module=catalog');
});

test('structured website content payload edits rich fields and preserves unrelated metadata shape', () => {
  const draft = structuredDraftFromProductRow(row, 'everhot');
  const edited = {
    ...draft,
    tagline: 'Fresh official tagline',
    officialCopy: 'Official product website copy',
    websiteTitle: 'Everhot Matrix',
    websiteDescription: 'Display-ready water heating product',
    icon: '/icons/matrix.svg',
    image: '/images/matrix.jpg',
    specImage: '/images/matrix-spec.jpg',
    badges: ['New', 'Premium'],
    specs: [
      { key: 'capacity', value: '200L' },
      { key: 'power', value: '3kW' },
    ],
    features: [{ title: 'Stable hot water', description: 'Designed for daily comfort.' }],
    highlights: [{ key: 'Warranty', value: '5 years' }],
    certs: ['CE', 'WaterMark'],
    faqs: [{ question: 'Can it be installed indoors?', answer: 'Yes.' }],
    gallery: [{ url: '/gallery/matrix-1.jpg', alt: 'Installed product' }],
    positioning: {
      ...draft.positioning,
      targetSegments: ['commercial'],
      markets: ['AU'],
      applicationScenarios: ['hotel'],
    },
  };

  assert.equal(isDirtyStructuredContentDraft(row, 'everhot', edited), true);

  const payload = buildBrandStructuredContentUpdatePayload('everhot', row, edited) as any;
  assert.equal(payload.tenantId, 'tenant-everhot');
  assert.equal(payload.meta.untouchedGlobal, 'keep');
  assert.deepEqual(payload.meta.rheem, { slug: 'rheem-slug', name: 'Rheem row' });
  assert.deepEqual(payload.meta.everhot.retainedNested, { keep: true });
  assert.equal(payload.meta.everhot.slug, 'old-slug');
  assert.equal(payload.meta.everhot.tagline, 'Fresh official tagline');
  assert.equal(payload.meta.everhot.officialCopy, 'Official product website copy');
  assert.deepEqual(payload.meta.everhot.specs, [
    { k: 'capacity', v: '200L' },
    { k: 'power', v: '3kW' },
  ]);
  assert.deepEqual(payload.meta.everhot.features, [
    { title: 'Stable hot water', description: 'Designed for daily comfort.' },
  ]);
  assert.deepEqual(payload.meta.everhot.highlights, [{ label: 'Warranty', value: '5 years' }]);
  assert.deepEqual(payload.meta.everhot.certs, ['CE', 'WaterMark']);
  assert.deepEqual(payload.meta.everhot.faqs, [{ question: 'Can it be installed indoors?', answer: 'Yes.' }]);
  assert.deepEqual(payload.meta.everhot.gallery, [{ url: '/gallery/matrix-1.jpg', alt: 'Installed product' }]);
  assert.deepEqual(payload.positioning.retainedPositioning, ['keep']);
  assert.deepEqual(payload.positioning.channels, ['dealer']);
  assert.deepEqual(payload.positioning.targetSegments, ['commercial']);
  assert.deepEqual(payload.positioning.markets, ['AU']);
  assert.deepEqual(payload.positioning.applicationScenarios, ['hotel']);

  const echoed = structuredDraftFromProductRow(
    {
      ...row,
      raw: {
        ...row.raw,
        meta: payload.meta,
        positioning: payload.positioning,
      },
    },
    'everhot',
  );
  assert.deepEqual(echoed.specs, edited.specs);
  assert.deepEqual(echoed.features, edited.features);
  assert.deepEqual(echoed.gallery, edited.gallery);
});

function brandSite(code: string, childBrandCodes: string[] = []) {
  return {
    id: `site-${code}`,
    code,
    nameCn: code.toUpperCase(),
    nameEn: code,
    appKey: `${code}-cn`,
    status: 'active',
    sortOrder: 1,
    childBrandCodes,
    deletedAt: null,
  };
}

function product(id: string, brand: string, sku: string, name: string, displayOrder: number) {
  return {
    id,
    tenantId: `tenant-${brand}`,
    brand,
    sku,
    name,
    category: 'water-heater',
    status: 'active',
    spec: { officialModel: sku, system: 'hot-water' },
    meta: {
      [brand]: {
        slug: sku.toLowerCase(),
        name,
        displayOrder,
        websiteMenuCategory: 'water-heater',
        sys: 'hot-water',
      },
    },
  };
}
