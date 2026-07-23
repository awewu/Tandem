const { chromium } = require('playwright');
const fs = require('fs');

const baseUrl = process.env.DEALER_WORKBENCH_URL || 'http://localhost:5000';
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

async function main() {
  const browser = await chromium.launch(launchOptions());
  const page = await browser.newPage();
  let role = 'brand_admin';
  let status = 'active';
  let archived = false;
  let failNextStatusChange = true;
  const mutations = [];

  await page.route('**/api/v2/auth/me', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ role, permissions: [] }) })
  );
  await page.route('**/api/v2/brand-sites**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 'site-everhot', code: 'everhot', nameCn: '恒热', nameEn: 'Everhot',
          appKey: 'everhot-cn', deliveryType: 'self_hosted', status: 'active',
          sortOrder: 30, deletedAt: null,
        }],
        total: 1,
      }),
    })
  );
  await page.route('**/api/v2/product-catalog/taxonomy**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ categories: [] }) })
  );
  await page.route('**/api/v2/product-catalog/devices**', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'DELETE') {
      if (!['platform_admin', 'hq_admin', 'brand_admin'].includes(role)) {
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: '当前角色无权维护产品库' }) });
        return;
      }
      if (method === 'PATCH') {
        const body = route.request().postDataJSON();
        mutations.push({ method, body });
        if (failNextStatusChange) {
          failNextStatusChange = false;
          await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: '后端策略拒绝状态变更' }) });
          return;
        }
        status = body.status;
      } else {
        mutations.push({ method });
        archived = true;
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'product-everhot-1', status: archived ? 'archived' : status }) });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: archived ? [] : [{
          id: 'product-everhot-1', tenantId: 'tenant-everhot', sku: 'EH-HP-200',
          brand: 'everhot', name: 'Everhot Heat Pump 200L', category: 'hot_water', status,
          spec: { officialModel: 'HP-200', system: 'heat_pump_water' },
          meta: { everhot: { slug: 'heat-pump-200l', cat: '热泵热水器', sys: '热水系统' } },
        }],
        total: archived ? 0 : 1,
      }),
    });
  });

  await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
  try {
    await page.getByLabel('Brand product rows').getByText('Active', { exact: true }).waitFor({ timeout: 8000 });
  } catch (error) {
    throw new Error(`${error.message}\nRendered body:\n${await page.locator('body').innerText()}`);
  }

  await page.getByRole('button', { name: '下架', exact: true }).click();
  await page.getByText('后端策略拒绝状态变更').waitFor();
  await page.getByRole('button', { name: '下架', exact: true }).click();
  await page.getByText('EH-HP-200 status changed to inactive.').waitFor();
  await page.getByText('Inactive', { exact: true }).waitFor();

  await page.getByRole('button', { name: '上架', exact: true }).click();
  await page.getByText('EH-HP-200 status changed to active.').waitFor();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '归档', exact: true }).click();
  await page.getByText('EH-HP-200 archived.').waitFor();

  archived = false;
  status = 'active';
  role = 'brand_viewer';
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByText('只读', { exact: true }).waitFor();
  const readOnlyMutationButtons = await page.getByRole('button', { name: /^(上架|下架|归档)$/ }).count();
  const unauthorizedStatus = await page.evaluate(async () => {
    const response = await fetch('/api/v2/product-catalog/devices/product-everhot-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: 'tenant-everhot', status: 'inactive' }),
    });
    return response.status;
  });

  await browser.close();
  const statusMutations = mutations.filter((item) => item.method === 'PATCH');
  const archiveMutations = mutations.filter((item) => item.method === 'DELETE');
  if (statusMutations.length !== 3 || archiveMutations.length !== 1 || readOnlyMutationButtons !== 0 || unauthorizedStatus !== 403) {
    throw new Error(JSON.stringify({ statusMutations, archiveMutations, readOnlyMutationButtons, unauthorizedStatus }));
  }
  console.log('brand product status/RBAC smoke passed: failure feedback, shelf toggles, confirmed archive, read-only UI and API denial');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
