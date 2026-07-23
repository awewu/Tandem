import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blankNewProductDraft,
  buildBrandStructuredContentUpdatePayload,
  buildBrandProductUpdatePayload,
  buildNewBrandProductPayload,
  canWriteBrandProducts,
  draftFromProductRow,
  isDirtyStructuredContentDraft,
  isDirtyProductDraft,
  resolveBrandSiteEnvironmentLinks,
  structuredDraftFromProductRow,
  type BrandProductRow,
} from './brand-product-adapter';

const row: BrandProductRow = {
  id: 'product-001',
  sku: 'EVH-OLD',
  publicSlug: 'old-slug',
  name: 'Old name',
  model: 'OLD-MODEL',
  category: 'water-heater',
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
