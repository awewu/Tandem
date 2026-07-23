const { chromium } = require('playwright');
const fs = require('fs');

const baseUrl = process.env.DEALER_WORKBENCH_URL || 'http://localhost:5000';

const SYSTEM_BROWSERS = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function launchOptions() {
  const executablePath = SYSTEM_BROWSERS.find((candidate) => fs.existsSync(candidate));
  return executablePath ? { headless: true, executablePath } : { headless: true };
}

function productPayload(product) {
  return { items: [product], total: 1 };
}

async function main() {
  let product = {
    id: 'everhot-hp-200',
    tenantId: 'tenant-everhot',
    sku: 'EH-HP-200',
    brand: 'everhot',
    name: 'Everhot Heat Pump 200L',
    category: 'hot_water',
    status: 'active',
    spec: { officialModel: 'HP-200', system: 'heat_pump_water' },
    assetRefs: [
      { role: 'detail', artifactId: 'asset-detail-1', filename: 'detail-a.jpg', sortOrder: 0 },
      { role: 'detail', artifactId: 'asset-detail-2', filename: 'detail-b.jpg', sortOrder: 1 },
    ],
    positioning: { targetSegments: ['home'] },
    meta: {
      everhot: {
        slug: 'heat-pump-200l',
        cat: 'Hot water',
        sys: 'Hot water system',
        displayOrder: 12,
        specs: [{ k: 'capacity', v: '200L' }],
        features: [{ title: 'High efficiency', desc: 'COP optimized' }],
        highlights: ['Energy saving'],
      },
    },
  };
  const uploads = [];
  const patches = [];
  const deletes = [];
  const leaked5012 = [];

  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage();
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('5012') || url.includes('/api/images')) leaked5012.push(url);
  });

  await page.route('**/api/v2/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ role: 'brand_admin', tenantId: 'tenant-everhot', permissions: [] }),
    });
  });

  await page.route('**/api/v2/brand-sites**', async (route) => {
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
          developmentUrl: 'http://localhost:5011',
          productionUrl: 'https://www.everhot.com.cn',
          resolvedUrl: 'http://localhost:5011',
          resolvedEnvironment: 'development',
          status: 'active',
          sortOrder: 30,
          siteNote: null,
          deletedAt: null,
          updatedAt: null,
        }],
        total: 1,
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/taxonomy**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ assetRoles: [{ code: 'main' }, { code: 'detail' }] }),
    });
  });

  await page.route('**/api/v2/file-artifact/upload-base64', async (route) => {
    const body = route.request().postDataJSON();
    const id = `asset-main-${uploads.length + 1}`;
    uploads.push(body);
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id,
          fileKey: `tenant-everhot/product-image/${id}.png`,
          originalName: body.filename,
          mimeType: body.mimeType,
        },
      }),
    });
  });

  await page.route('**/api/v2/file-artifact/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      deletes.push(route.request().url());
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v2/product-catalog/devices/*', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON();
      patches.push(body);
      product = {
        ...product,
        assetRefs: body.assetRefs || product.assetRefs,
        meta: body.meta || product.meta,
      };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: product }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: product }) });
  });

  await page.route('**/api/v2/product-catalog/devices?**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(productPayload(product)) });
  });

  await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
  await page.getByText('EH-HP-200').waitFor({ state: 'visible' });
  const iframeCount = await page.locator('iframe').count();

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p94AAAAASUVORK5CYII=',
    'base64'
  );
  await page.getByTestId('main-image-input-EH-HP-200').setInputFiles({
    name: 'main-one.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await page.getByText('EH-HP-200 main image saved.').waitFor({ state: 'visible' });

  await page.getByTestId('main-image-input-EH-HP-200').setInputFiles({
    name: 'main-two.png',
    mimeType: 'image/png',
    buffer: png,
  });
  await page.getByText('EH-HP-200 main image saved.').waitFor({ state: 'visible' });

  await page.getByTestId('delete-main-image-EH-HP-200').click();
  await page.getByText('EH-HP-200 main image deleted.').waitFor({ state: 'visible' });

  await browser.close();

  const firstPatch = patches[0] || {};
  const secondPatch = patches[1] || {};
  const deletePatch = patches[2] || {};
  const firstMain = (firstPatch.assetRefs || []).find((ref) => ref.role === 'main');
  const secondMains = (secondPatch.assetRefs || []).filter((ref) => ref.role === 'main');
  const deletedMains = (deletePatch.assetRefs || []).filter((ref) => ref.role === 'main' || ref.role === 'card');
  const scoped =
    patches.length === 3 &&
    patches.every((patch) => patch.tenantId === 'tenant-everhot') &&
    uploads.every((upload) => upload.entityType === 'product-image' && upload.entityId === 'EH-HP-200');
  const replaced = firstMain?.artifactId === 'asset-main-1' && secondMains.length === 1 && secondMains[0].artifactId === 'asset-main-2';
  const deleted = deletedMains.length === 0 && deletes.some((url) => url.endsWith('/asset-main-2'));

  if (iframeCount !== 0 || leaked5012.length || uploads.length !== 2 || !scoped || !replaced || !deleted) {
    throw new Error(JSON.stringify({ iframeCount, leaked5012, uploads, patches, deletes, scoped, replaced, deleted }, null, 2));
  }

  console.log('native-brand-console image smoke passed: upload, replace, delete, scoped Nexus APIs, no iframe');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
