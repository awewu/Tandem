const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.DEALER_WORKBENCH_URL || 'http://localhost:5000';
const failureScreenshot = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'runtime-logs',
  'smoke-brand-product-status-rbac-failure.png'
);
const systemBrowsers = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function launchOptions() {
  const executablePath = systemBrowsers.find((candidate) => fs.existsSync(candidate));
  return executablePath ? { headless: true, executablePath } : { headless: true };
}

function productFor(brand) {
  const labels = {
    rheem: ['tenant-rheem', 'product-rheem-1', 'RH-HP-160', 'Rheem Heat Pump 16kW'],
    ruud: ['tenant-ruud', 'product-ruud-1', 'RD-FUR-90', 'Ruud Furnace 90'],
    everhot: ['tenant-everhot', 'product-everhot-1', 'EH-HP-200', 'Everhot Heat Pump 200L'],
  };
  const [tenantId, id, sku, name] = labels[brand] || labels.everhot;
  return {
    id,
    tenantId,
    sku,
    brand,
    name,
    category: brand === 'ruud' ? 'furnace' : 'heat_pump',
    status: 'active',
    spec: { officialModel: sku.replace(/^[A-Z]+-/, ''), system: brand === 'ruud' ? 'heating' : 'heat_pump_water' },
    meta: {
      [brand]: {
        slug: `${brand}-original-slug`,
        cat: brand === 'ruud' ? 'Heating' : 'Hot Water',
        websiteCategory: brand === 'ruud' ? 'Heating' : 'Hot Water',
        websiteMenuCategory: brand === 'ruud' ? 'Heating' : 'Hot Water',
        series: `${brand.toUpperCase()} Series`,
        tagline: `${brand} original tagline`,
        en: name,
        displayOrder: 7,
        badges: ['Original'],
      },
    },
  };
}

async function main() {
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage();
  let role = 'brand_admin';
  let everhotProduct = productFor('everhot');
  const mutations = [];
  const assignmentCreates = [];
  const productListBrands = [];

  await page.route('**/api/v2/auth/me', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ role, permissions: [] }) })
  );
  await page.route('**/api/v2/brand-sites**', (route) => {
    if (route.request().url().includes('/product-assignments')) return route.fallback();
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { id: 'site-rheem', code: 'rheem', nameCn: 'Rheem', nameEn: 'Rheem', appKey: 'rheem-cn', deliveryType: 'self_hosted', status: 'active', sortOrder: 10, deletedAt: null },
          { id: 'site-ruud', code: 'ruud', nameCn: 'Ruud', nameEn: 'Ruud', appKey: 'ruud-cn', deliveryType: 'self_hosted', status: 'active', sortOrder: 20, deletedAt: null },
          { id: 'site-everhot', code: 'everhot', nameCn: 'Everhot', nameEn: 'Everhot', appKey: 'everhot-cn', deliveryType: 'self_hosted', status: 'active', sortOrder: 30, deletedAt: null },
        ],
        total: 3,
      }),
    });
  });
  await page.route('**/api/v2/product-catalog/taxonomy**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ categories: [] }) })
  );
  await page.route('**/api/v2/product-catalog/devices/*', async (route) => {
    const method = route.request().method();
    if (!['PATCH', 'DELETE'].includes(method)) return route.fallback();
    if (!['platform_admin', 'hq_admin', 'brand_admin'].includes(role)) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) });
      return;
    }
    if (method === 'PATCH') {
      const body = route.request().postDataJSON();
      mutations.push({ method, body });
      everhotProduct = { ...everhotProduct, ...body, meta: body.meta || everhotProduct.meta, spec: body.spec || everhotProduct.spec };
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(everhotProduct) });
      return;
    }
    mutations.push({ method });
    everhotProduct = { ...everhotProduct, status: 'archived' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(everhotProduct) });
  });
  await page.route('**/api/v2/product-catalog/devices?**', async (route) => {
    const url = new URL(route.request().url());
    const brand = url.searchParams.get('brand') || 'everhot';
    productListBrands.push(brand);
    const item = brand === 'everhot' ? everhotProduct : productFor(brand);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [item], total: 1 }) });
  });
  await page.route('**/api/v2/product-catalog/devices', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [everhotProduct], total: 1 }) });
      return;
    }
    if (!['platform_admin', 'hq_admin', 'brand_admin'].includes(role)) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) });
      return;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'created-product' }) });
  });
  await page.route('**/api/v2/brand-sites/*/product-assignments', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
      return;
    }
    if (!['platform_admin', 'hq_admin', 'brand_admin'].includes(role)) {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Forbidden' }) });
      return;
    }
    const body = route.request().postDataJSON();
    assignmentCreates.push(body);
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: `assignment-${assignmentCreates.length}`, ...body }) });
  });

  try {
    await page.goto(`${baseUrl}/products?module=catalog`, { waitUntil: 'networkidle' });
    await page.getByText('EH-HP-200').waitFor({ timeout: 15000 });
    const catalogRow = page.locator('article').filter({ hasText: 'EH-HP-200' }).first();
    await catalogRow.getByRole('button').first().click();
    await page.getByLabel('公开路径').fill('official-everhot-200');
    await page.getByLabel('系列').fill('Commercial Prestige');
    await page.getByLabel('宣传语').fill('Quiet high efficiency hot water');
    await page.getByLabel('官网分类').fill('Commercial Hot Water');
    await page.getByLabel('展示排序').fill('42');
    await page.getByLabel('标签').fill('New, Premium');
    await page.getByLabel('官方英文名').fill('Everhot Commercial Heat Pump 200L');
    await page.locator('form').filter({ hasText: '公开路径' }).locator('button[type="submit"]').click();
    await page.waitForFunction(() => document.body.innerText.includes('official-everhot-200'), null, { timeout: 15000 });

    const metadataPatch = mutations.find((entry) => entry.method === 'PATCH' && entry.body?.meta?.everhot?.slug === 'official-everhot-200');
    if (!metadataPatch) throw new Error('metadata PATCH was not captured');
    const meta = metadataPatch.body.meta.everhot;
    if (
      meta.series !== 'Commercial Prestige' ||
      meta.tagline !== 'Quiet high efficiency hot water' ||
      meta.websiteCategory !== 'Commercial Hot Water' ||
      meta.displayOrder !== 42 ||
      meta.en !== 'Everhot Commercial Heat Pump 200L' ||
      JSON.stringify(meta.badges) !== JSON.stringify(['New', 'Premium'])
    ) {
      throw new Error(`metadata PATCH fields mismatch: ${JSON.stringify(meta)}`);
    }

    await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
    await page.waitForFunction(
      () => Array.from(document.querySelectorAll('input')).some((input) => input.value === 'official-everhot-200'),
      null,
      { timeout: 15000 }
    );

    await page.goto(`${baseUrl}/comfort/sites/rhautt-group/library`, { waitUntil: 'networkidle' });
    await page.locator('.site-shelf-head-actions .btn-brand').click();
    const groupBrandButtons = page.locator('.site-shelf-brand-picker button');
    if ((await groupBrandButtons.count()) !== 3) throw new Error('rhautt-group brand picker did not expose three brands');
    for (const brand of ['rheem', 'ruud', 'everhot']) {
      await page.locator('.site-shelf-brand-picker button').filter({ hasText: brand === 'rheem' ? 'Rheem' : brand === 'ruud' ? 'Ruud' : 'Everhot' }).click();
      await page.waitForTimeout(350);
      await page.locator('.site-shelf-product-option').filter({ hasText: productFor(brand).sku }).first().click();
    }

    await page.goto(`${baseUrl}/comfort/sites/rheem/library`, { waitUntil: 'networkidle' });
    await page.locator('.site-shelf-head-actions .btn-brand').click();
    if ((await page.locator('.site-shelf-brand-picker button').count()) !== 0) {
      throw new Error('brand site exposed cross-brand picker');
    }
    await page.locator('.site-shelf-product-option').filter({ hasText: 'RH-HP-160' }).first().waitFor({ timeout: 15000 });

    role = 'brand_viewer';
    await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
    await page.getByText(/只读|鍙/).first().waitFor({ timeout: 15000 });
    const readOnlyMutationButtons = await page.locator('.product-status-actions button, button.btn-brand:has-text("保存")').count();
    const unauthorizedStatus = await page.evaluate(async () => {
      const response = await fetch('/api/v2/product-catalog/devices/product-everhot-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-everhot', status: 'inactive' }),
      });
      return response.status;
    });

    await browser.close();
    const requiredBrands = ['rheem', 'ruud', 'everhot'];
    const missingPickerBrands = requiredBrands.filter((brand) => !productListBrands.includes(brand));
    if (missingPickerBrands.length || readOnlyMutationButtons !== 0 || unauthorizedStatus !== 403) {
      throw new Error(JSON.stringify({ missingPickerBrands, readOnlyMutationButtons, unauthorizedStatus, assignmentCreates }));
    }
    console.log('brand product catalog metadata/site picker/RBAC smoke passed: metadata editor persisted, brand page reflected metadata, rhautt-group switched Rheem/Ruud/Everhot, brand site stayed single-brand, read-only UI and API denial held');
  } catch (error) {
    await fs.promises.mkdir(path.dirname(failureScreenshot), { recursive: true });
    await page.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => {});
    await browser.close();
    error.message = `${error.message}\nFailure screenshot: ${failureScreenshot}`;
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
