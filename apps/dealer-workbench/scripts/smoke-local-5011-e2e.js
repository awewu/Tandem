const { chromium } = require('playwright');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dealerUrl = process.env.DEALER_WORKBENCH_URL || 'http://localhost:5000';
const everhotUrl = process.env.EVERHOT_SITE_URL || 'http://localhost:5011';
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const reportPath = path.join(repoRoot, 'runtime-logs', 'local-5011-e2e-smoke.json');
const failureScreenshot = path.join(repoRoot, 'runtime-logs', 'local-5011-e2e-smoke-failure.png');
const controlFailureScreenshot = path.join(repoRoot, 'runtime-logs', 'local-5011-e2e-control-failure.png');
const uploadFixturePath = path.join(repoRoot, 'runtime-logs', 'local-5011-e2e-upload.png');
const SHELF_UNLISTED = '\u672a\u4e0a\u67b6';
const SHELF_PUBLISHED = '\u5df2\u4e0a\u67b6';
const SHELF_HIDDEN = '\u5df2\u4e0b\u67b6';

const SYSTEM_BROWSERS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const products = [
  {
    id: 'product-e2e-unlisted',
    tenantId: 'tenant-everhot',
    sku: 'EH-E2E-UNLISTED',
    brand: 'everhot',
    name: 'Everhot Local 5011 Unlisted Smoke',
    category: 'hot_water',
    status: 'active',
    spec: { officialModel: 'UN-5011', system: 'water_heating' },
    meta: {
      everhot: {
        slug: 'everhot-local-5011-unlisted-smoke',
        cat: 'residential',
        sys: 'water-heating',
        series: 'Local 5011 Smoke',
        tagline: 'Should stay off the public Everhot site until published',
        displayOrder: 10,
      },
    },
  },
  {
    id: 'product-e2e-published',
    tenantId: 'tenant-everhot',
    sku: 'EH-E2E-PUBLISHED',
    brand: 'everhot',
    name: 'Everhot Local 5011 Published Smoke',
    category: 'hot_water',
    status: 'active',
    spec: { officialModel: 'PB-5011', system: 'water_heating' },
    meta: {
      everhot: {
        slug: 'everhot-local-5011-published-smoke',
        cat: 'residential',
        sys: 'water-heating',
        series: 'Local 5011 Smoke',
        tagline: 'Should appear on the public Everhot site',
        displayOrder: 20,
      },
    },
  },
  {
    id: 'product-e2e-hidden',
    tenantId: 'tenant-everhot',
    sku: 'EH-E2E-HIDDEN',
    brand: 'everhot',
    name: 'Everhot Local 5011 Hidden Smoke',
    category: 'hot_water',
    status: 'active',
    spec: { officialModel: 'HD-5011', system: 'water_heating' },
    meta: {
      everhot: {
        slug: 'everhot-local-5011-hidden-smoke',
        cat: 'residential',
        sys: 'water-heating',
        series: 'Local 5011 Smoke',
        tagline: 'Should stay hidden from the public Everhot site',
        displayOrder: 30,
      },
    },
  },
  {
    id: 'product-e2e-rheem',
    tenantId: 'tenant-rheem',
    sku: 'RHM-E2E-PUBLISHED',
    brand: 'rheem',
    name: 'Rheem Local 5011 Wrong Brand Smoke',
    category: 'hot_water',
    status: 'active',
    spec: { officialModel: 'RHM-5011', system: 'water_heating' },
    meta: {
      rheem: {
        slug: 'rheem-local-5011-wrong-brand-smoke',
        cat: 'residential',
        sys: 'water-heating',
        series: 'Local 5011 Smoke',
        tagline: 'Should never appear on the public Everhot site',
        displayOrder: 40,
      },
    },
  },
  {
    id: 'product-e2e-ruud',
    tenantId: 'tenant-ruud',
    sku: 'RUUD-E2E-PUBLISHED',
    brand: 'ruud',
    name: 'Ruud Local 5011 Wrong Brand Smoke',
    category: 'hot_water',
    status: 'active',
    spec: { officialModel: 'RUUD-5011', system: 'water_heating' },
    meta: {
      ruud: {
        slug: 'ruud-local-5011-wrong-brand-smoke',
        cat: 'residential',
        sys: 'water-heating',
        series: 'Local 5011 Smoke',
        tagline: 'Should never appear on the public Everhot site',
        displayOrder: 50,
      },
    },
  },
];

for (let index = 1; index <= 22; index += 1) {
  products.push({
    id: `product-e2e-everhot-page-${index}`,
    tenantId: 'tenant-everhot',
    sku: `EH-E2E-PAGE-${String(index).padStart(2, '0')}`,
    brand: 'everhot',
    name: `Everhot Pagination Smoke ${String(index).padStart(2, '0')}`,
    category: index % 2 === 0 ? 'hot_water' : 'air_conditioning',
    status: index === 22 ? 'inactive' : 'active',
    spec: { officialModel: `PG-5011-${index}`, system: index % 2 === 0 ? 'water_heating' : 'comfort' },
    meta: {
      everhot: {
        slug: `everhot-pagination-smoke-${String(index).padStart(2, '0')}`,
        cat: index % 2 === 0 ? 'residential' : 'commercial',
        sys: index % 2 === 0 ? 'water-heating' : 'air-conditioning',
        series: 'Pagination Smoke',
        tagline: 'Should only load on the requested console page',
        displayOrder: 100 + index,
      },
    },
  });
}

const assignments = [
  {
    id: 'assignment-e2e-published',
    productTenantId: 'tenant-everhot',
    productId: 'product-e2e-published',
    publicSlug: 'everhot-local-5011-published-smoke',
    websiteCategory: 'residential',
    menuGroup: 'water-heating',
    displayOrder: 20,
    isFeatured: true,
    status: 'published',
    siteTitle: null,
    siteSummary: null,
    siteCode: 'everhot',
  },
  {
    id: 'assignment-e2e-hidden',
    productTenantId: 'tenant-everhot',
    productId: 'product-e2e-hidden',
    publicSlug: 'everhot-local-5011-hidden-smoke',
    websiteCategory: 'residential',
    menuGroup: 'water-heating',
    displayOrder: 30,
    isFeatured: false,
    status: 'hidden',
    siteTitle: null,
    siteSummary: null,
    siteCode: 'everhot',
  },
  {
    id: 'assignment-e2e-rheem',
    productTenantId: 'tenant-rheem',
    productId: 'product-e2e-rheem',
    publicSlug: 'rheem-local-5011-wrong-brand-smoke',
    websiteCategory: 'residential',
    menuGroup: 'water-heating',
    displayOrder: 40,
    isFeatured: false,
    status: 'published',
    siteTitle: null,
    siteSummary: null,
    siteCode: 'rheem',
  },
  {
    id: 'assignment-e2e-ruud',
    productTenantId: 'tenant-ruud',
    productId: 'product-e2e-ruud',
    publicSlug: 'ruud-local-5011-wrong-brand-smoke',
    websiteCategory: 'residential',
    menuGroup: 'water-heating',
    displayOrder: 50,
    isFeatured: false,
    status: 'published',
    siteTitle: null,
    siteSummary: null,
    siteCode: 'ruud',
  },
];

const mutationLog = {
  createdAssignments: [],
  publishedAssignments: [],
  hiddenAssignments: [],
  catalogWrites: [],
  catalogReads: [],
  catalogReadDetails: [],
  uploadedArtifacts: [],
  deletedArtifacts: [],
  runtimeRequests: [],
};

function launchOptions() {
  const executablePath = SYSTEM_BROWSERS.find((candidate) => fs.existsSync(candidate));
  return executablePath ? { headless: true, executablePath } : { headless: true };
}

async function isReachable(url) {
  try {
    const signal = AbortSignal.timeout(2000);
    const response = await fetch(url, { signal });
    return response.status < 500;
  } catch {
    return false;
  }
}

function startSurface(label, args) {
  const child = spawn('pnpm.cmd', args, {
    cwd: repoRoot,
    shell: process.platform === 'win32',
    stdio: 'ignore',
    windowsHide: true,
  });
  return { label, child };
}

async function waitForSurface(label, url) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await isReachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`${label} did not become reachable: ${url}`);
}

async function ensureLocalSurfaces() {
  const started = [];
  if (!(await isReachable(`${dealerUrl}/comfort/sites/everhot`))) {
    started.push(startSurface('dealer-workbench', ['--filter', 'dealer-workbench', 'dev']));
    await waitForSurface('dealer-workbench', `${dealerUrl}/comfort/sites/everhot`);
  }
  if (!(await isReachable(everhotUrl))) {
    started.push(startSurface('everhot-cn', ['--dir', 'apps/everhot-cn', 'run', 'dev']));
    await waitForSurface('everhot-cn', everhotUrl);
  }
  return started;
}

function stopLocalSurfaces(started) {
  for (const { child } of started) {
    if (!child.pid || child.killed) continue;
    if (process.platform === 'win32') {
      spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
}

function productById(id) {
  return products.find((product) => product.id === id);
}

function projectPublicProduct(assignment) {
  const product = productById(assignment.productId);
  if (!product || product.brand !== 'everhot') return null;
  const meta = product?.meta?.everhot || {};
  return {
    brand: 'everhot',
    slug: assignment.publicSlug || meta.slug || product?.sku,
    sku: product?.sku,
    name: product?.name,
    cat: assignment.websiteCategory || meta.cat || 'residential',
    sys: assignment.menuGroup || meta.sys || 'water-heating',
    series: meta.series || '',
    tagline: assignment.siteSummary || meta.tagline || '',
    displayOrder: assignment.displayOrder || meta.displayOrder || 0,
    badges: ['Smoke'],
  };
}

function publicProductsPayload() {
  const items = assignments
    .filter((assignment) => assignment.status === 'published')
    .map(projectPublicProduct)
    .filter(Boolean)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return { success: true, data: { items, total: items.length } };
}

function siteCodeFromPath(requestPath) {
  const match = requestPath.match(/\/api\/v2\/brand-sites\/([^/]+)\//);
  return match ? decodeURIComponent(match[1]) : '';
}

function productBrand(product) {
  return String(product.brand || '').trim().toLowerCase();
}

function matchesKeyword(product, keyword) {
  if (!keyword) return true;
  const brand = productBrand(product);
  const haystack = [
    product.sku,
    product.name,
    product.category,
    product.status,
    product.spec?.officialModel,
    product.spec?.system,
    product.meta?.[brand]?.slug,
  ].join(' ').toLowerCase();
  return haystack.includes(keyword.toLowerCase());
}

function facet(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, count }));
}

function productCatalogPayload(url) {
  const brand = String(url.searchParams.get('brand') || '').toLowerCase();
  const keyword = String(url.searchParams.get('keyword') || '').trim();
  const status = String(url.searchParams.get('status') || '').trim();
  const category = String(url.searchParams.get('category') || '').trim();
  const page = Math.max(Number(url.searchParams.get('page')) || 1, 1);
  const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize')) || 20, 1), 100);
  const scoped = products.filter((product) => !brand || productBrand(product) === brand);
  const filtered = scoped.filter((product) =>
    matchesKeyword(product, keyword) &&
    (!status || product.status === status) &&
    (!category || product.category === category)
  );
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  mutationLog.catalogReadDetails.push({
    brand,
    page,
    pageSize,
    keyword,
    status,
    category,
    returned: items.length,
    total: filtered.length,
  });
  return {
    items,
    total: filtered.length,
    page,
    pageSize,
    pages: Math.max(Math.ceil(filtered.length / pageSize), 1),
    facets: {
      categories: facet(scoped.map((product) => product.category)),
      statuses: facet(scoped.map((product) => product.status)),
    },
  };
}

function applyProductPatch(productId, patch) {
  const index = products.findIndex((product) => product.id === productId);
  if (index < 0) return null;
  products[index] = {
    ...products[index],
    ...patch,
    spec: { ...(products[index].spec || {}), ...(patch.spec || {}) },
    meta: { ...(products[index].meta || {}), ...(patch.meta || {}) },
  };
  return products[index];
}

async function ensureUploadFixture() {
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
  await fs.promises.mkdir(path.dirname(uploadFixturePath), { recursive: true });
  await fs.promises.writeFile(uploadFixturePath, Buffer.from(pngBase64, 'base64'));
}

async function routeControlPanel(page) {
  await page.route('**/api/v2/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ role: 'brand_admin', permissions: ['product-catalog:write'] }),
    });
  });

  await page.route('**/api/v2/brand-sites**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const requestPath = url.pathname;
    if (requestPath.endsWith('/product-assignments') && request.method() === 'GET') {
      const siteCode = siteCodeFromPath(requestPath);
      const siteAssignments = assignments.filter((assignment) => !siteCode || assignment.siteCode === siteCode);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: siteAssignments, total: siteAssignments.length }) });
      return;
    }
    if (requestPath.endsWith('/product-assignments') && request.method() === 'POST') {
      const body = request.postDataJSON();
      const created = { id: `assignment-e2e-created-${assignments.length}`, ...body, status: 'draft', siteCode: siteCodeFromPath(requestPath) };
      mutationLog.createdAssignments.push(body);
      assignments.push(created);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(created) });
      return;
    }
    if (requestPath.endsWith('/publish') && request.method() === 'POST') {
      const id = requestPath.split('/').at(-2);
      const assignment = assignments.find((item) => item.id === id);
      if (assignment) assignment.status = 'published';
      mutationLog.publishedAssignments.push(id);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    if (requestPath.endsWith('/hide') && request.method() === 'POST') {
      const id = requestPath.split('/').at(-2);
      const assignment = assignments.find((item) => item.id === id);
      if (assignment) assignment.status = 'hidden';
      mutationLog.hiddenAssignments.push(id);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'site-everhot',
          code: 'everhot',
          nameCn: 'Everhot',
          nameEn: 'Everhot',
          appKey: 'everhot-cn',
          deliveryType: 'self_hosted',
          developmentUrl: 'http://localhost:5011/',
          productionUrl: 'https://www.everhot.com.cn/',
          resolvedUrl: 'http://localhost:5011/',
          resolvedEnvironment: 'development',
          status: 'active',
          sortOrder: 30,
          deletedAt: null,
        }, {
          id: 'site-rheem',
          code: 'rheem',
          nameCn: 'Rheem',
          nameEn: 'Rheem',
          appKey: 'rheem-cn',
          deliveryType: 'self_hosted',
          developmentUrl: 'http://localhost:5014/',
          productionUrl: 'https://www.rheem.com.cn/',
          resolvedUrl: 'http://localhost:5014/',
          resolvedEnvironment: 'development',
          status: 'active',
          sortOrder: 10,
          deletedAt: null,
        }, {
          id: 'site-ruud',
          code: 'ruud',
          nameCn: 'Ruud',
          nameEn: 'Ruud',
          appKey: 'ruud-cn',
          deliveryType: 'self_hosted',
          developmentUrl: 'http://localhost:5015/',
          productionUrl: 'https://www.ruud.com.cn/',
          resolvedUrl: 'http://localhost:5015/',
          resolvedEnvironment: 'development',
          status: 'active',
          sortOrder: 20,
          deletedAt: null,
        }],
        total: 3,
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/taxonomy**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ targetSegments: [], channels: [], assetRoles: [] }) });
  });

  await page.route('**/api/v2/file-artifact/upload-base64', async (route) => {
    const body = route.request().postDataJSON();
    const id = `artifact-e2e-${mutationLog.uploadedArtifacts.length + 1}`;
    const artifact = {
      id,
      artifactId: id,
      fileKey: `tenant-smoke/${body.entityType}/${id}-${body.filename}`,
      originalName: body.filename,
      mimeType: body.mimeType,
      sizeBytes: Buffer.from(String(body.dataBase64 || ''), 'base64').length,
      entityType: body.entityType,
      entityId: body.entityId,
      status: 'active',
    };
    mutationLog.uploadedArtifacts.push(artifact);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(artifact) });
  });

  await page.route('**/api/v2/file-artifact/**', async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      mutationLog.deletedArtifacts.push(decodeURIComponent(new URL(request.url()).pathname.split('/').pop() || ''));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v2/product-catalog/devices/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const id = decodeURIComponent(url.pathname.split('/').pop() || '');
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON();
      const updated = applyProductPatch(id, body);
      mutationLog.catalogWrites.push({
        method: request.method(),
        url: request.url(),
        productId: id,
        body,
      });
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(updated || { id, ...body }) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v2/product-catalog/devices*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') {
      mutationLog.catalogReads.push(request.url());
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(productCatalogPayload(url)) });
      return;
    }
    mutationLog.catalogWrites.push({
      method: request.method(),
      url: request.url(),
      body: request.postData(),
    });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: products, total: products.length }) });
  });
}

async function routeEverhotRuntime(page, runtimeAvailable) {
  await page.route('**/api/v2/sites/everhot/products**', async (route) => {
    mutationLog.runtimeRequests.push(route.request().url());
    if (!runtimeAvailable()) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'runtime unavailable' }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(publicProductsPayload()) });
  });
  await page.route('**/api/v2/brand/everhot/products**', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'legacy runtime unavailable' }) });
  });
}

async function expectVisibleText(page, text, label) {
  try {
    await page.getByText(text, { exact: true }).waitFor({ timeout: 15000 });
  } catch (error) {
    throw new Error(`${label} was not visible: ${text}\n${error.message}`);
  }
}

async function expectMissingText(page, text, label) {
  const count = await page.getByText(text, { exact: true }).count();
  if (count !== 0) throw new Error(`${label} was unexpectedly visible: ${text}`);
}

async function assertShelfStatus(page, sku, status) {
  await page.getByTestId(`website-shelf-status-${sku}`).filter({ hasText: status }).waitFor({ timeout: 15000 });
}

async function expectConsoleBrandIsolation(page, brand, visibleSku, hiddenSkus) {
  await page.goto(`${dealerUrl}/comfort/sites/${brand}`, { waitUntil: 'networkidle' });
  await expectVisibleText(page, visibleSku, `${brand} matching product`);
  for (const sku of hiddenSkus) await expectMissingText(page, sku, `${brand} wrong-brand product`);
}

async function assertNoDesktopHorizontalScroll(page) {
  await page.setViewportSize({ width: 1366, height: 900 });
  const metrics = await page.locator('.brand-product-table-wrap').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: window.getComputedStyle(element).overflowX,
    bodyClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.documentElement.scrollWidth,
  }));
  if (metrics.scrollWidth > metrics.clientWidth || metrics.bodyScrollWidth > metrics.bodyClientWidth) {
    throw new Error(`desktop table has horizontal overflow: ${JSON.stringify(metrics)}`);
  }
}

async function assertConsoleEditPersists(page) {
  await page.goto(`${dealerUrl}/comfort/sites/rheem`, { waitUntil: 'networkidle' });
  await page.getByTestId('brand-product-edit-RHM-E2E-PUBLISHED').click();
  const modal = page.getByTestId('brand-product-edit-modal');
  await modal.waitFor({ timeout: 15000 });
  const editedName = 'Rheem Local 5011 Edited Catalog Smoke';
  await modal.getByLabel('名称').fill(editedName);
  await page.getByTestId('brand-product-edit-save').click();
  await expectVisibleText(page, editedName, 'edited Rheem catalog product');
}

async function waitForCondition(label, predicate) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function assertImageUploadPersists(page) {
  await page.goto(`${dealerUrl}/comfort/sites/rheem`, { waitUntil: 'networkidle' });
  await page.getByTestId('main-image-input-RHM-E2E-PUBLISHED').setInputFiles(uploadFixturePath);
  await waitForCondition('main image assetRef', () =>
    (productById('product-e2e-rheem')?.assetRefs || []).some((ref) => ref.role === 'main' && ref.artifactId)
  );
  await page.getByTestId('detail-image-input-RHM-E2E-PUBLISHED').setInputFiles(uploadFixturePath);
  await waitForCondition('detail image assetRef', () =>
    (productById('product-e2e-rheem')?.assetRefs || []).some((ref) => ref.role === 'detail' && ref.artifactId)
  );

  const refs = productById('product-e2e-rheem')?.assetRefs || [];
  const hasMain = refs.some((ref) => ref.role === 'main' && ref.artifactId);
  const hasDetail = refs.some((ref) => ref.role === 'detail' && ref.artifactId);
  if (!hasMain || !hasDetail) throw new Error(`image upload did not persist assetRefs: ${JSON.stringify(refs)}`);
}

async function assertPaginationSearchFilter(page) {
  await page.goto(`${dealerUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
  await assertNoDesktopHorizontalScroll(page);
  await page.getByLabel('Products per page').selectOption('10');
  await expectVisibleText(page, 'EH-E2E-PAGE-07', 'first paginated Everhot page');
  await expectMissingText(page, 'EH-E2E-PAGE-22', 'first paginated Everhot page should not load all rows');
  await page.locator('.brand-product-pagination').getByRole('button', { name: 'Next', exact: true }).click();
  await expectVisibleText(page, 'EH-E2E-PAGE-08', 'second paginated Everhot page');
  await page.locator('.brand-product-search input').fill('Published Smoke');
  await expectVisibleText(page, 'EH-E2E-PUBLISHED', 'keyword-filtered Everhot product');
  await expectMissingText(page, 'EH-E2E-PAGE-08', 'keyword-filtered Everhot product');
  await page.getByLabel('Product status filter').selectOption('inactive');
  await expectMissingText(page, 'EH-E2E-PUBLISHED', 'keyword plus status filter');
  await page.locator('.brand-product-search input').fill('');
  await expectVisibleText(page, 'EH-E2E-PAGE-22', 'inactive status-filtered Everhot product');
  await page.getByLabel('Product category filter').selectOption('hot_water');
  await expectVisibleText(page, 'EH-E2E-PAGE-22', 'category-filtered inactive Everhot product');
}

async function writeReport(report) {
  await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  await ensureUploadFixture();
  const startedSurfaces = await ensureLocalSurfaces();
  const browser = await chromium.launch(launchOptions());
  const control = await browser.newPage();
  const site = await browser.newPage();
  let runtimeAvailable = true;

  await routeControlPanel(control);
  await routeEverhotRuntime(site, () => runtimeAvailable);

  try {
    await expectConsoleBrandIsolation(control, 'rheem', 'RHM-E2E-PUBLISHED', ['EH-E2E-PUBLISHED', 'RUUD-E2E-PUBLISHED']);
    await expectConsoleBrandIsolation(control, 'ruud', 'RUUD-E2E-PUBLISHED', ['EH-E2E-PUBLISHED', 'RHM-E2E-PUBLISHED']);
    await assertConsoleEditPersists(control);
    await assertImageUploadPersists(control);
    await assertPaginationSearchFilter(control);

    await control.goto(`${dealerUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
    await expectVisibleText(control, 'EH-E2E-UNLISTED', 'unlisted control-panel product');
    await assertShelfStatus(control, 'EH-E2E-UNLISTED', '未上架');
    await assertShelfStatus(control, 'EH-E2E-PUBLISHED', '已上架');
    await assertShelfStatus(control, 'EH-E2E-HIDDEN', '已下架');

    await control.getByTestId('website-shelf-action-EH-E2E-UNLISTED').click();
    await assertShelfStatus(control, 'EH-E2E-UNLISTED', '已上架');
    await control.getByTestId('website-shelf-action-EH-E2E-PUBLISHED').click();
    await assertShelfStatus(control, 'EH-E2E-PUBLISHED', '已下架');

    await site.goto(everhotUrl, { waitUntil: 'networkidle' });
    await site.waitForFunction(() => window.EVERHOT_PRODUCTS_STATUS === 'runtime', null, { timeout: 15000 });
    await expectVisibleText(site, 'Everhot Local 5011 Unlisted Smoke', 'newly published 5011 product');
    await expectMissingText(site, 'Everhot Local 5011 Published Smoke', 'hidden formerly published 5011 product');
    await expectMissingText(site, 'Everhot Local 5011 Hidden Smoke', 'hidden 5011 product');
    await expectMissingText(site, 'Rheem Local 5011 Wrong Brand Smoke', 'Rheem wrong-brand 5011 product');
    await expectMissingText(site, 'Ruud Local 5011 Wrong Brand Smoke', 'Ruud wrong-brand 5011 product');

    runtimeAvailable = false;
    await site.reload({ waitUntil: 'networkidle' });
    await site.waitForFunction(() => window.EVERHOT_PRODUCTS_STATUS === 'fallback', null, { timeout: 15000 });

    await browser.close();

    const created = mutationLog.createdAssignments[0];
    const rheemWrite = mutationLog.catalogWrites.find((write) => write.productId === 'product-e2e-rheem');
    const pagedRequest = mutationLog.catalogReadDetails.find((read) =>
      read.brand === 'everhot' && read.page === 2 && read.pageSize === 10 && read.returned <= 10 && read.total > read.returned
    );
    const keywordRequest = mutationLog.catalogReadDetails.find((read) =>
      read.brand === 'everhot' && read.keyword === 'Published Smoke' && read.page === 1 && read.pageSize === 10
    );
    const filteredRequest = mutationLog.catalogReadDetails.find((read) =>
      read.brand === 'everhot' && read.status === 'inactive' && read.category === 'hot_water' && read.returned <= read.pageSize
    );
    const rheemRefs = productById('product-e2e-rheem')?.assetRefs || [];
    const passed =
      created?.productId === 'product-e2e-unlisted' &&
      mutationLog.publishedAssignments.some((id) => id.startsWith('assignment-e2e-created-')) &&
      mutationLog.hiddenAssignments.includes('assignment-e2e-published') &&
      rheemWrite?.body?.name === 'Rheem Local 5011 Edited Catalog Smoke' &&
      productById('product-e2e-rheem')?.name === 'Rheem Local 5011 Edited Catalog Smoke' &&
      rheemRefs.some((ref) => ref.role === 'main') &&
      rheemRefs.some((ref) => ref.role === 'detail') &&
      Boolean(pagedRequest) &&
      Boolean(keywordRequest) &&
      Boolean(filteredRequest) &&
      mutationLog.runtimeRequests.some((url) => url.includes('/api/v2/sites/everhot/products'));
    if (!passed) throw new Error(JSON.stringify(mutationLog));

    const report = {
      ok: true,
      issue: 'docs/dev/brand-site-unified-product-catalog-issues/08-e2e-smoke-and-regression.md',
      targetUrls: { dealerWorkbench: dealerUrl, everhotSite: everhotUrl },
      proved: [
        '5000 control panel showed Rheem, Ruud, and Everhot catalog records only on matching concrete brand pages.',
        'Brand-page editing patched the same product catalog record and reloaded the edited value.',
        'Brand-page image upload persisted main and detail image assetRefs to the same product catalog record.',
        '5000 control panel showed published, unlisted, and hidden shelf states.',
        'Operator action published an unlisted Everhot product to the website shelf.',
        'Operator action hid a published Everhot product from the website shelf.',
        'Pagination, keyword, status, and category changes issued scoped page requests without returning every matching product at once.',
        'Normal desktop brand product table had no horizontal overflow.',
        '5000 control panel showed 已上架 / 未上架 / 已下架 shelf states.',
        'Operator action published a 未上架 Everhot product to the website shelf.',
        'Operator action hid an 已上架 Everhot product from the website shelf.',
        '5011 rendered only products currently published to the Everhot website shelf.',
        '5011 excluded stale Rheem/Ruud assignments from the Everhot public product payload.',
        '5011 requested /api/v2/sites/everhot/products during local runtime loading.',
        '5011 switched to static fallback when runtime and legacy endpoints were unavailable.',
      ],
      mutationLog,
      publicProductsAfterOperatorActions: publicProductsPayload().data.items.map((item) => item.sku),
    };
    await writeReport(report);
    stopLocalSurfaces(startedSurfaces);
    console.log(`local 5011 e2e smoke passed: ${reportPath}`);
  } catch (error) {
    await fs.promises.mkdir(path.dirname(failureScreenshot), { recursive: true });
    await control.screenshot({ path: controlFailureScreenshot, fullPage: true }).catch(() => {});
    await site.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => {});
    await browser.close();
    stopLocalSurfaces(startedSurfaces);
    error.message = `${error.message}\nMutation log: ${JSON.stringify(mutationLog, null, 2)}\nControl screenshot: ${controlFailureScreenshot}\nFailure screenshot: ${failureScreenshot}`;
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
