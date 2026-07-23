const { chromium } = require('playwright');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dealerUrl = process.env.DEALER_WORKBENCH_URL || 'http://localhost:5000';
const everhotUrl = process.env.EVERHOT_SITE_URL || 'http://localhost:5011';
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const reportPath = path.join(repoRoot, 'runtime-logs', 'local-5011-e2e-smoke.json');
const failureScreenshot = path.join(repoRoot, 'runtime-logs', 'local-5011-e2e-smoke-failure.png');

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
];

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
  },
];

const mutationLog = {
  createdAssignments: [],
  publishedAssignments: [],
  hiddenAssignments: [],
  catalogWrites: [],
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
  const meta = product?.meta?.everhot || {};
  return {
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
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return { success: true, data: { items, total: items.length } };
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
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: assignments, total: assignments.length }) });
      return;
    }
    if (requestPath.endsWith('/product-assignments') && request.method() === 'POST') {
      const body = request.postDataJSON();
      const created = { id: `assignment-e2e-created-${assignments.length}`, ...body, status: 'draft' };
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
        }],
        total: 1,
      }),
    });
  });

  await page.route('**/api/v2/product-catalog/taxonomy**', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ targetSegments: [], channels: [], assetRoles: [] }) });
  });

  await page.route('**/api/v2/product-catalog/devices**', async (route) => {
    if (route.request().method() !== 'GET') {
      mutationLog.catalogWrites.push({
        method: route.request().method(),
        url: route.request().url(),
        body: route.request().postData(),
      });
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: products, total: products.length }) });
  });
}

async function routeEverhotRuntime(page, runtimeAvailable) {
  await page.route('**/api/v2/sites/everhot/products**', async (route) => {
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

async function writeReport(report) {
  await fs.promises.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.promises.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const startedSurfaces = await ensureLocalSurfaces();
  const browser = await chromium.launch(launchOptions());
  const control = await browser.newPage();
  const site = await browser.newPage();
  let runtimeAvailable = true;

  await routeControlPanel(control);
  await routeEverhotRuntime(site, () => runtimeAvailable);

  try {
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

    runtimeAvailable = false;
    await site.reload({ waitUntil: 'networkidle' });
    await site.waitForFunction(() => window.EVERHOT_PRODUCTS_STATUS === 'fallback', null, { timeout: 15000 });

    await browser.close();

    const created = mutationLog.createdAssignments[0];
    const passed =
      created?.productId === 'product-e2e-unlisted' &&
      mutationLog.publishedAssignments.some((id) => id.startsWith('assignment-e2e-created-')) &&
      mutationLog.hiddenAssignments.includes('assignment-e2e-published') &&
      mutationLog.catalogWrites.length === 0;
    if (!passed) throw new Error(JSON.stringify(mutationLog));

    const report = {
      ok: true,
      issue: 'docs/dev/brand-site-local-runtime-crud-issues/06-local-5011-e2e-smoke.md',
      targetUrls: { dealerWorkbench: dealerUrl, everhotSite: everhotUrl },
      proved: [
        '5000 control panel showed 已上架 / 未上架 / 已下架 shelf states.',
        'Operator action published a 未上架 Everhot product to the website shelf.',
        'Operator action hid an 已上架 Everhot product from the website shelf.',
        '5011 rendered only products currently published to the Everhot website shelf.',
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
    await site.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => {});
    await browser.close();
    stopLocalSurfaces(startedSurfaces);
    error.message = `${error.message}\nFailure screenshot: ${failureScreenshot}`;
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
