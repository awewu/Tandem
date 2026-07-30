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
import { ProductCatalogService } from './product-catalog.service';

const TENANT_ID = '4aee0000-0000-4000-8000-000000000001';

test('product content upsert persists and readback returns official detail html', async () => {
  const { service } = serviceFixture();
  const html = '<p>Official detail</p><img src="/uploads/detail-750.jpg" />';
  const sanitized = '<p>Official detail</p><img src="/uploads/detail-750.jpg" alt="" loading="lazy">';

  const saved = await service.upsertContent('product-1', {
    tenantId: TENANT_ID,
    locale: 'zh-CN',
    status: 'draft',
    officialDetailHtml: html,
  });
  const read = await service.listContent('product-1', TENANT_ID);

  assert.equal(saved.data.officialDetailHtml, sanitized);
  assert.equal(read.data.total, 1);
  assert.equal(read.data.items[0].officialDetailHtml, sanitized);
});

test('public product projection exposes official detail html from published content', () => {
  const html = '<p>Official detail</p><img src="/api/v2/file-artifact/11111111-1111-4111-8111-111111111111/content" />';
  const projected = (serviceFixture().service as any).publicProductProjection(
    product('product-1', 'everhot'),
    'zh-CN',
    content('product-1', html),
    { includeOfficialDetail: true },
  );

  assert.equal(
    projected.officialDetailHtml,
    '<p>Official detail</p><img src="/api/v2/brand/everhot/products/product-1/images/11111111-1111-4111-8111-111111111111" />',
  );
  assert.equal(projected.name, 'product-1');
});

test('public product projection only uses uploaded main asset, not legacy meta image fallback', () => {
  const legacyOnly = product('product-1', 'everhot');
  legacyOnly.meta = { everhot: { image: 'http://localhost:4017/assets/img/products/old.webp' } };

  const withoutUpload = (serviceFixture().service as any).publicProductProjection(legacyOnly, 'zh-CN', null);
  assert.equal(withoutUpload.image, '');
  assert.equal(withoutUpload.mainImage, null);

  const withUpload = product('product-2', 'everhot');
  withUpload.meta = { everhot: { image: 'http://localhost:4017/assets/img/products/old.webp' } };
  withUpload.assetRefs = [{
    role: 'main',
    artifactId: '22222222-2222-4222-8222-222222222222',
    filename: 'current.jpg',
    mimeType: 'image/jpeg',
  }];
  const projected = (serviceFixture().service as any).publicProductProjection(withUpload, 'zh-CN', null);

  assert.equal(projected.image, '/api/v2/brand/everhot/products/product-2/images/22222222-2222-4222-8222-222222222222');
  assert.equal(projected.mainImage.url, '/api/v2/brand/everhot/products/product-2/images/22222222-2222-4222-8222-222222222222');
});

test('product content upsert rewrites protected artifact image urls to public product image urls', async () => {
  const { service, productRepo } = serviceFixture();
  productRepo.seed(product('product-1', 'everhot'));

  const saved = await service.upsertContent('product-1', {
    tenantId: TENANT_ID,
    locale: 'zh-CN',
    status: 'published',
    officialDetailHtml: '<img src="/api/v2/file-artifact/33333333-3333-4333-8333-333333333333/content" alt="Detail">',
  });

  assert.equal(
    saved.data.officialDetailHtml,
    '<img src="/api/v2/brand/everhot/products/product-1/images/33333333-3333-4333-8333-333333333333" alt="Detail" loading="lazy">',
  );
});

test('public product projection returns empty official detail html without content', () => {
  const projected = (serviceFixture().service as any).publicProductProjection(
    product('product-1', 'rheem'),
    'zh-CN',
    null,
    { includeOfficialDetail: true },
  );

  assert.equal(projected.officialDetailHtml, '');
});

test('product content upsert can clear official detail html', async () => {
  const { service } = serviceFixture();

  await service.upsertContent('product-1', {
    tenantId: TENANT_ID,
    locale: 'zh-CN',
    officialDetailHtml: '<p>Initial detail</p>',
  });
  const cleared = await service.upsertContent('product-1', {
    tenantId: TENANT_ID,
    locale: 'zh-CN',
    officialDetailHtml: '',
  });
  const read = await service.listContent('product-1', TENANT_ID);

  assert.equal(cleared.data.officialDetailHtml, '');
  assert.equal(read.data.items[0].officialDetailHtml, '');
});

test('product content upsert sanitizes official detail html before persistence', async () => {
  const { service } = serviceFixture();
  const malicious = [
    '<h2 onclick="alert(1)">Safe title</h2>',
    '<script>alert(1)</script>',
    '<p>Visible <strong>copy</strong><iframe src="/evil"></iframe></p>',
    '<a href="javascript:alert(1)" onmouseover="alert(2)">bad link</a>',
    '<a href="https://example.com/detail" onclick="alert(3)">good link</a>',
    '<img src="/uploads/detail-750.jpg" onerror="alert(4)" style="width:9999px" alt="Detail">',
    '<img src="data:image/png;base64,abc">',
    '<img src="blob:https://example.com/abc">',
    '<video src="/uploads/movie.mp4">video text</video>',
  ].join('');

  await service.upsertContent('product-1', {
    tenantId: TENANT_ID,
    locale: 'zh-CN',
    officialDetailHtml: malicious,
  });
  const read = await service.listContent('product-1', TENANT_ID);
  const html = read.data.items[0].officialDetailHtml || '';

  assert.match(html, /<h2>Safe title<\/h2>/);
  assert.match(html, /<strong>copy<\/strong>/);
  assert.match(html, /<a>bad link<\/a>/);
  assert.match(html, /<a href="https:\/\/example\.com\/detail" rel="noopener noreferrer" target="_blank">good link<\/a>/);
  assert.match(html, /<img src="\/uploads\/detail-750\.jpg" alt="Detail" loading="lazy">/);
  assert.match(html, /video text/);
  assert.doesNotMatch(html, /script|iframe|onerror|onclick|onmouseover|javascript:|data:image|blob:|style=|<video/i);
});

test('public product list projection omits official detail html by default', () => {
  const projected = (serviceFixture().service as any).publicProductProjection(
    product('product-1', 'rheem'),
    'zh-CN',
    content('product-1', '<p>Long detail</p>'),
  );

  assert.equal('officialDetailHtml' in projected, false);
});

function serviceFixture() {
  const productRepo = new InMemoryRepository<ProductEntity>();
  const priceRepo = new InMemoryRepository<PriceListItemEntity>();
  const contentRepo = new InMemoryRepository<ProductContentEntity>();
  const eventBus = { publishInTx: async () => undefined };
  const fileArtifacts = {};
  const { ds } = makeFakeDataSource([
    [ProductEntity, productRepo],
    [PriceListItemEntity, priceRepo],
    [ProductContentEntity, contentRepo],
    [ProductContentEventEntity, new InMemoryRepository<ProductContentEventEntity>()],
  ]);
  return {
    service: new ProductCatalogService(
      ds,
      productRepo as any,
      priceRepo as any,
      contentRepo as any,
      eventBus as any,
      fileArtifacts as any,
    ),
    productRepo,
  };
}

function product(id: string, brand: string): ProductEntity {
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
  };
}

function content(productId: string, officialDetailHtml: string): ProductContentEntity {
  return {
    id: 'content-1',
    tenantId: TENANT_ID,
    productId,
    locale: 'zh-CN',
    name: null,
    displayCurrency: 'CNY',
    seo: {} as any,
    gtin: null,
    mpn: null,
    marketing: {} as any,
    officialDetailHtml,
    status: 'published',
    publishedAt: new Date('2026-01-01T00:00:00Z'),
    scheduledAt: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}
