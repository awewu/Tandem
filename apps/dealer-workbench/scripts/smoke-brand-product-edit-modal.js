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

async function main() {
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage();
  let patchCount = 0;
  let latestProductName = 'Everhot Matrix 200';
  let patchPayload = null;

  const product = () => ({
    id: 'product-edit-modal',
    tenantId: 'tenant-everhot',
    sku: 'EH-MODAL-200',
    brand: 'everhot',
    name: latestProductName,
    category: 'water-heater',
    status: 'active',
    spec: { officialModel: 'MX-200', system: 'hot-water' },
    meta: {
      everhot: {
        slug: 'matrix-200',
        name: latestProductName,
        model: 'MX-200',
        cat: '热水系统',
        sys: 'hot-water',
        displayOrder: 20,
        tagline: 'Old tagline',
        specs: [{ k: 'capacity', v: '200L' }],
        features: [{ title: 'Comfort', description: 'Stable hot water' }],
        faqs: [{ q: 'Indoor?', a: 'Yes.' }],
      },
    },
    positioning: { targetSegments: ['home'] },
  });

  await page.route('**/api/v2/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ role: 'brand_admin', permissions: ['product-catalog:write'] }),
    });
  });

  await page.route('**/api/v2/brand-sites**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/product-assignments')) {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'site-everhot',
          code: 'everhot',
          nameCn: '恒热',
          nameEn: 'Everhot',
          appKey: 'everhot-cn',
          deliveryType: 'self_hosted',
          status: 'active',
          sortOrder: 30,
          deletedAt: null,
        }],
        total: 1,
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/taxonomy**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        targetSegments: [{ code: 'home', label: '家庭' }],
        channels: [{ code: 'dealer', label: '经销商' }],
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/devices**', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH') {
      patchCount += 1;
      patchPayload = request.postDataJSON();
      await page.waitForTimeout(250);
      if (patchCount === 1) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'simulated product save failure' }),
        });
        return;
      }
      latestProductName = patchPayload.name || latestProductName;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(product()) });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [product()],
        total: 1,
        page: 1,
        pageSize: 20,
        pages: 1,
        facets: { categories: [{ value: 'water-heater', count: 1 }], statuses: [{ value: 'active', count: 1 }] },
      }),
    });
  });

  await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
  await page.getByText('EH-MODAL-200').waitFor({ timeout: 15000 });

  await page.getByTestId('brand-product-edit-EH-MODAL-200').click();
  let modal = page.getByTestId('brand-product-edit-modal');
  await modal.waitFor();
  await modal.getByRole('heading', { name: '基础信息', exact: true }).waitFor();
  await modal.getByRole('heading', { name: '官网展示', exact: true }).waitFor();
  await modal.getByRole('heading', { name: '图片 / 素材', exact: true }).waitFor();
  await modal.getByRole('heading', { name: '官网货架', exact: true }).waitFor();
  await modal.getByRole('heading', { name: '规格、卖点 / FAQ', exact: true }).waitFor();

  await modal.locator('.product-create-field').filter({ hasText: '名称' }).locator('input').fill('Cancel Should Not Persist');
  await modal.getByRole('button', { name: /取消/ }).click();
  await modal.waitFor({ state: 'hidden' });
  await page.getByText('Everhot Matrix 200').waitFor();
  if (await page.getByText('Cancel Should Not Persist').count()) {
    throw new Error('cancel should close the modal without changing the rendered product row');
  }

  await page.getByTestId('brand-product-edit-EH-MODAL-200').click();
  modal = page.getByTestId('brand-product-edit-modal');
  await modal.waitFor();
  await modal.locator('.product-create-field').filter({ hasText: '名称' }).locator('input').fill('');
  await modal.getByText('产品名称不能为空。').waitFor();
  const disabledForValidation = await page.getByTestId('brand-product-edit-save').isDisabled();

  await modal.locator('.product-create-field').filter({ hasText: '名称' }).locator('input').fill('Everhot Matrix 300');
  await page.getByTestId('brand-product-edit-save').click();
  await page.getByTestId('brand-product-edit-save').filter({ hasText: '保存中...' }).waitFor();
  await modal.getByText('simulated product save failure').waitFor();

  await page.getByTestId('brand-product-edit-save').click();
  await page.getByText('Everhot Matrix 300').waitFor();
  await modal.getByRole('button', { name: /关闭产品编辑/ }).click();
  await modal.waitFor({ state: 'hidden' });

  await browser.close();

  if (!disabledForValidation || patchCount !== 2 || patchPayload?.name !== 'Everhot Matrix 300') {
    throw new Error(JSON.stringify({ disabledForValidation, patchCount, patchPayload }));
  }

  console.log('brand product edit modal smoke passed: open/cancel/validation/error/loading/save/refresh behavior verified');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
