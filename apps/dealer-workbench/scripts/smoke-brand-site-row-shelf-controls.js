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
  const createdAssignments = [];
  const publishedAssignments = [];
  const hiddenAssignments = [];
  const catalogWrites = [];
  const products = [
    {
      id: 'product-unlisted',
      tenantId: 'tenant-everhot',
      sku: 'EH-UNLISTED',
      brand: 'everhot',
      name: 'Everhot Unlisted',
      category: 'hot_water',
      status: 'inactive',
      spec: { officialModel: 'UN-100', system: 'water_heating' },
      meta: { everhot: { slug: 'everhot-unlisted', cat: '热水器', sys: '热水系统', displayOrder: 10 } },
    },
    {
      id: 'product-published',
      tenantId: 'tenant-everhot',
      sku: 'EH-PUBLISHED',
      brand: 'everhot',
      name: 'Everhot Published',
      category: 'hot_water',
      status: 'active',
      spec: { officialModel: 'PB-200', system: 'water_heating' },
      meta: { everhot: { slug: 'everhot-published', cat: '热水器', sys: '热水系统', displayOrder: 20 } },
    },
    {
      id: 'product-hidden',
      tenantId: 'tenant-everhot',
      sku: 'EH-HIDDEN',
      brand: 'everhot',
      name: 'Everhot Hidden',
      category: 'hot_water',
      status: 'active',
      spec: { officialModel: 'HD-300', system: 'water_heating' },
      meta: { everhot: { slug: 'everhot-hidden', cat: '热水器', sys: '热水系统', displayOrder: 30 } },
    },
  ];
  const assignments = [
    {
      id: 'assignment-published',
      productTenantId: 'tenant-everhot',
      productId: 'product-published',
      publicSlug: 'everhot-published',
      websiteCategory: '热水器',
      menuGroup: '热水系统',
      displayOrder: 20,
      isFeatured: false,
      status: 'published',
      siteTitle: null,
      siteSummary: null,
    },
    {
      id: 'assignment-hidden',
      productTenantId: 'tenant-everhot',
      productId: 'product-hidden',
      publicSlug: 'everhot-hidden',
      websiteCategory: '热水器',
      menuGroup: '热水系统',
      displayOrder: 30,
      isFeatured: false,
      status: 'hidden',
      siteTitle: null,
      siteSummary: null,
    },
  ];

  await page.route('**/api/v2/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ role: 'brand_admin', permissions: ['product-catalog:write'] }),
    });
  });

  await page.route('**/api/v2/brand-sites**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/product-assignments') && request.method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: assignments, total: assignments.length }) });
      return;
    }
    if (path.endsWith('/product-assignments') && request.method() === 'POST') {
      const body = request.postDataJSON();
      const created = { id: 'assignment-created', ...body, status: 'draft' };
      createdAssignments.push(body);
      assignments.push(created);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(created) });
      return;
    }
    if (path.endsWith('/publish') && request.method() === 'POST') {
      const id = path.split('/').at(-2);
      const assignment = assignments.find((item) => item.id === id);
      if (assignment) assignment.status = 'published';
      publishedAssignments.push(id);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    if (path.endsWith('/hide') && request.method() === 'POST') {
      const id = path.split('/').at(-2);
      const assignment = assignments.find((item) => item.id === id);
      if (assignment) assignment.status = 'hidden';
      hiddenAssignments.push(id);
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'site-everhot',
            code: 'everhot',
            nameCn: '恒热',
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
          },
        ],
        total: 1,
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/taxonomy', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ targetSegments: [], channels: [], assetRoles: [] }) });
  });

  await page.route('**/api/v2/product-catalog/devices**', async (route) => {
    if (route.request().method() !== 'GET') {
      catalogWrites.push({
        method: route.request().method(),
        url: route.request().url(),
        body: route.request().postData(),
      });
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: products, total: products.length }) });
  });

  await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
  await page.getByText('EH-UNLISTED').waitFor({ timeout: 15000 });

  const statusFor = (sku) => page.getByTestId(`website-shelf-status-${sku}`);
  await statusFor('EH-UNLISTED').filter({ hasText: '未上架' }).waitFor();
  await statusFor('EH-PUBLISHED').filter({ hasText: '已上架' }).waitFor();
  await statusFor('EH-HIDDEN').filter({ hasText: '已下架' }).waitFor();

  await page.getByTestId('website-shelf-action-EH-UNLISTED').click();
  await statusFor('EH-UNLISTED').filter({ hasText: '已上架' }).waitFor();
  if (products.find((product) => product.id === 'product-unlisted')?.status !== 'inactive') {
    throw new Error('website shelf publish must not mutate catalog active/inactive status');
  }

  await page.getByTestId('website-shelf-action-EH-PUBLISHED').click();
  await statusFor('EH-PUBLISHED').filter({ hasText: '已下架' }).waitFor();

  await browser.close();

  if (
    createdAssignments.length !== 1 ||
    createdAssignments[0].productId !== 'product-unlisted' ||
    publishedAssignments[0] !== 'assignment-created' ||
    hiddenAssignments[0] !== 'assignment-published' ||
    catalogWrites.length !== 0
  ) {
    throw new Error(JSON.stringify({ createdAssignments, publishedAssignments, hiddenAssignments, catalogWrites }));
  }

  console.log('brand site row shelf controls smoke passed: row labels rendered, publish/hide used assignment APIs, and catalog status stayed separate');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
