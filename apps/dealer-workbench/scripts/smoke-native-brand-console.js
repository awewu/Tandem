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

  let sites = [
    {
      id: 'site-group', code: 'rhautt-group', nameCn: '瑞合瑞德暖通科技集团', nameEn: 'Rhautt Comfort', appKey: null,
      deliveryType: 'self_hosted', status: 'active', sortOrder: 0, deletedAt: null,
    },
    {
      id: 'site-rheem', code: 'rheem', nameCn: '瑞美', nameEn: 'Rheem', appKey: 'rheem-cn',
      deliveryType: 'self_hosted', status: 'active', sortOrder: 10, deletedAt: null,
    },
    {
      id: 'site-ruud', code: 'ruud', nameCn: '瑞德', nameEn: 'Ruud', appKey: 'ruud-cn',
      deliveryType: 'self_hosted', status: 'active', sortOrder: 20, deletedAt: null,
    },
    {
      id: 'site-nova', code: 'nova', nameCn: '新牌', nameEn: 'Nova', appKey: null,
      deliveryType: 'self_hosted', status: 'active', sortOrder: 25, deletedAt: null,
    },
    {
      id: 'site-everhot', code: 'everhot', nameCn: '恒热', nameEn: 'Everhot', appKey: 'everhot-cn',
      deliveryType: 'self_hosted', status: 'active', sortOrder: 30, deletedAt: null,
    },
    {
      id: 'site-inactive', code: 'inactive-brand', nameCn: '停用品牌', nameEn: 'Inactive', appKey: null,
      deliveryType: 'self_hosted', status: 'inactive', sortOrder: 5, deletedAt: null,
    },
    {
      id: 'site-archived', code: 'archived-brand', nameCn: '归档品牌', nameEn: 'Archived', appKey: null,
      deliveryType: 'self_hosted', status: 'active', sortOrder: 15, deletedAt: '2026-07-01T00:00:00.000Z',
    },
  ];

  await page.route('**/api/v2/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ role: 'platform_admin', permissions: [] }),
    });
  });

  let archivedDeleteCalled = false;

  await page.route('**/api/v2/brand-sites**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'DELETE' && url.pathname.endsWith('/api/v2/brand-sites/site-archived')) {
      archivedDeleteCalled = true;
      sites = sites.filter((site) => site.id !== 'site-archived');
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: { deleted: true, id: 'site-archived' } }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: sites,
        total: sites.length,
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/taxonomy**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        targetSegments: [{ code: 'home', label: '家庭' }],
        channels: [{ code: 'dealer', label: '经销商' }],
        assetRoles: [{ code: 'main', label: '主图' }],
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/devices**', async (route) => {
    const url = new URL(route.request().url());
    const brand = url.searchParams.get('brand');
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items:
          brand === 'everhot'
            ? [
                {
                  id: 'everhot-hp-200',
                  tenantId: 'tenant-everhot',
                  sku: 'EH-HP-200',
                  brand: 'everhot',
                  name: 'Everhot Heat Pump 200L',
                  category: 'hot_water',
                  status: 'active',
                  spec: { officialModel: 'HP-200', system: 'heat_pump_water' },
                  assetRefs: [{ role: 'main', artifactId: 'asset-main-1' }],
                  positioning: { targetSegments: ['home'] },
                  meta: {
                    everhot: {
                      slug: 'heat-pump-200l',
                      cat: '热泵热水器',
                      sys: '热水系统',
                      displayOrder: 12,
                      specs: [{ k: 'capacity', v: '200L' }],
                      features: [{ title: 'High efficiency', desc: 'COP optimized' }],
                      highlights: ['节能'],
                    },
                  },
                },
              ]
            : [],
        total: brand === 'everhot' ? 1 : 0,
      }),
    });
  });

  await page.goto(`${baseUrl}/comfort/sites`, { waitUntil: 'networkidle' });
  await page.locator('.workbench-section-header__title').filter({ hasText: '品牌官网管理' }).waitFor();
  const masterCrudVisible = await page.getByRole('button', { name: '新增官网', exact: true }).isVisible();
  const subnav = page.getByRole('navigation', { name: '品牌官网管理二级菜单' });
  const menuLabels = (await subnav.locator('a').allTextContents()).map((label) => label.trim());
  const menuHrefs = await subnav.locator('a').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href'))
  );
  const expectedLabels = ['品牌官网管理', '瑞合瑞德暖通科技集团 Rhautt Comfort', '瑞美 Rheem', '瑞德 Ruud', '新牌 Nova', '恒热 Everhot', '品牌运营'];
  const expectedHrefs = [
    '/comfort/sites',
    '/comfort/sites/rhautt-group',
    '/comfort/sites/rheem',
    '/comfort/sites/ruud',
    '/comfort/sites/nova',
    '/comfort/sites/everhot',
    '/brand',
  ];

  const archivedRow = page.locator('tr').filter({ hasText: 'archived-brand' });
  await archivedRow.waitFor({ state: 'visible' });
  const archivedDeleteVisible = await archivedRow.getByRole('button').nth(1).isVisible();
  await archivedRow.getByRole('button').nth(1).click();
  await page.getByPlaceholder('archived-brand').fill('archived-brand');
  await page.getByRole('button', { name: /永久删除/ }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('archived-brand'));
  const archivedDeletedFromList = await page.getByText('archived-brand').count() === 0;

  await subnav.locator('a[href="/comfort/sites/rhautt-group"]').click();
  await page.waitForURL('**/comfort/sites/rhautt-group');
  await page.waitForFunction(() => {
    return document.querySelector('.dealer-topbar-title p')?.textContent === '瑞合瑞德暖通科技集团 Rhautt Comfort';
  });
  const groupTopbarConsistent = await page.locator('.dealer-topbar-title p').textContent() === '瑞合瑞德暖通科技集团 Rhautt Comfort';

  await subnav.locator('a[href="/comfort/sites/nova"]').click();
  await page.waitForURL('**/comfort/sites/nova');
  await page.getByText('该品牌还没有官网产品', { exact: true }).waitFor();
  const newBrandNative = await page.locator('.brand-console-shell').isVisible();
  const newBrandScoped = await page.getByText('Nova website products', { exact: true }).isVisible();
  const emptyStateVisible = await page.getByText('该品牌还没有官网产品', { exact: true }).isVisible();
  const emptyActionVisible = await page.getByRole('link', { name: /打开产品目录/ }).isVisible();
  const leakedEverhotProduct = await page.getByText('EH-HP-200', { exact: true }).count();

  let iframeCount = await page.locator('iframe').count();
  const existingBrands = [
    { code: 'rheem', heading: 'Rheem website products' },
    { code: 'ruud', heading: 'Ruud website products' },
    { code: 'everhot', heading: 'Everhot website products' },
  ];
  const nativeBrandResults = {};
  for (const brand of existingBrands) {
    await page.goto(`${baseUrl}/comfort/sites/${brand.code}`, { waitUntil: 'networkidle' });
    await page.getByText(brand.heading, { exact: true }).waitFor();
    nativeBrandResults[brand.code] = await page.locator('.brand-console-shell').isVisible();
    iframeCount += await page.locator('iframe').count();
  }

  await page.getByText('EH-HP-200').waitFor({ state: 'visible' });
  const everhotSkuVisible = await page.getByText('EH-HP-200').isVisible();
  const everhotSlugVisible = await page.getByText('heat-pump-200l').isVisible();
  const usesWorkbenchVi = await page.locator('.brand-console-shell .page-container .table').isVisible();

  await browser.close();

  if (
    !masterCrudVisible
    || JSON.stringify(menuLabels) !== JSON.stringify(expectedLabels)
    || JSON.stringify(menuHrefs) !== JSON.stringify(expectedHrefs)
    || !archivedDeleteVisible
    || !archivedDeleteCalled
    || !archivedDeletedFromList
    || !groupTopbarConsistent
    || !newBrandNative
    || !newBrandScoped
    || !emptyStateVisible
    || !emptyActionVisible
    || leakedEverhotProduct !== 0
    || !Object.values(nativeBrandResults).every(Boolean)
    || !everhotSkuVisible
    || !everhotSlugVisible
    || !usesWorkbenchVi
    || iframeCount !== 0
  ) {
    throw new Error(
      JSON.stringify({
        masterCrudVisible,
        menuLabels,
        menuHrefs,
        archivedDeleteVisible,
        archivedDeleteCalled,
        archivedDeletedFromList,
        groupTopbarConsistent,
        newBrandNative,
        newBrandScoped,
        everhotSkuVisible,
        everhotSlugVisible,
        emptyStateVisible,
        emptyActionVisible,
        leakedEverhotProduct,
        nativeBrandResults,
        usesWorkbenchVi,
        iframeCount,
      })
    );
  }

  console.log(
    'native-brand-console smoke passed: CRUD, archived delete action, ordered dynamic menu, multi-brand native consoles, scoped empty state, VI and no iframe'
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
