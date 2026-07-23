const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = process.env.DEALER_WORKBENCH_URL || 'http://localhost:5000';
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const screenshotPath = path.join(repoRoot, 'audit', 'product-catalog-no-horizontal-scroll.png');

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

function productFor(brand) {
  return {
    id: `${brand}-smoke-product`,
    tenantId: `tenant-${brand}`,
    sku: `${brand.toUpperCase()}-SMOKE-LONG-SKU-WITH-WRAPPING-20260723`,
    brand,
    name: `${brand} Product Catalog smoke row with a deliberately long name`,
    category: 'heat_pump',
    status: 'active',
    spec: {
      officialModel: `${brand.toUpperCase()}-MODEL-WITH-LONG-VALUE`,
      model: `${brand.toUpperCase()}-MODEL-WITH-LONG-VALUE`,
      system: 'Comfort system',
    },
    meta: {
      [brand]: {
        slug: `${brand}-smoke-product`,
        websiteCategory: 'Smoke category',
        displayOrder: 1,
        badges: ['Smoke'],
      },
    },
  };
}

async function main() {
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const deviceRequests = [];

  await page.route('**/api/v2/auth/me', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ role: 'brand_viewer', permissions: [] }),
    });
  });

  await page.route('**/api/v2/product-catalog/devices**', async (route) => {
    const url = new URL(route.request().url());
    const brand = url.searchParams.get('brand') || 'unknown';
    deviceRequests.push({
      brand,
      tenantId: url.searchParams.get('tenantId') || '',
      url: route.request().url(),
    });
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: brand === 'unknown' ? [] : [productFor(brand)],
        total: brand === 'unknown' ? 0 : 1,
      }),
    });
  });

  await page.goto(`${baseUrl}/products?module=catalog`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const body = document.body;
    const doc = document.documentElement;
    const viewportWidth = window.innerWidth;
    const maxScrollWidth = Math.max(body.scrollWidth, doc.scrollWidth);
    const wideElements = Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className: String(element.className || ''),
          width: Math.round(rect.width),
          right: Math.round(rect.right),
        };
      })
      .filter((item) => item.width > viewportWidth + 1 || item.right > viewportWidth + 1)
      .slice(0, 5);
    return {
      viewportWidth,
      bodyClientWidth: body.clientWidth,
      bodyScrollWidth: body.scrollWidth,
      docClientWidth: doc.clientWidth,
      docScrollWidth: doc.scrollWidth,
      maxScrollWidth,
      hasHorizontalOverflow: maxScrollWidth > viewportWidth + 1,
      wideElements,
    };
  });

  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  const brands = new Set(deviceRequests.map((request) => request.brand));
  const missingBrands = ['rheem', 'ruud', 'everhot'].filter((brand) => !brands.has(brand));
  if (missingBrands.length) {
    throw new Error(`Product Catalog All brands did not request: ${missingBrands.join(', ')}`);
  }
  if (deviceRequests.some((request) => !request.tenantId)) {
    throw new Error(`Product Catalog brand requests must include tenantId: ${JSON.stringify(deviceRequests)}`);
  }
  if (metrics.hasHorizontalOverflow) {
    throw new Error(`Product Catalog page overflowed horizontally: ${JSON.stringify(metrics)}`);
  }

  console.log(JSON.stringify({ ok: true, deviceRequests, metrics, screenshotPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
