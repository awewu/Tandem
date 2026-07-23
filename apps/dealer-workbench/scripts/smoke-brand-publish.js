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
  const observedRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) observedRequests.push(`${request.method()} ${request.url()}`);
  });
  let role = 'brand_admin';
  let publishMode = 'success';
  let publishRequests = 0;

  const supported = {
    supported: true,
    mode: 'static-backup',
    label: '生成静态备份',
    reason: '从 Nexus 重生成 Everhot 产品数据和产品图片静态快照',
  };
  const unsupported = {
    supported: false,
    mode: 'unsupported',
    label: '暂不支持发布',
    reason: '品牌 rheem 尚未配置服务端静态备份流程',
  };
  const sites = [
    {
      id: 'site-everhot', code: 'everhot', nameCn: '恒热', nameEn: 'Everhot',
      appKey: 'everhot-cn', deliveryType: 'self_hosted', status: 'active',
      sortOrder: 30, deletedAt: null, publishCapability: supported,
    },
    {
      id: 'site-rheem', code: 'rheem', nameCn: '瑞美', nameEn: 'Rheem',
      appKey: 'rheem-cn', deliveryType: 'self_hosted', status: 'active',
      sortOrder: 10, deletedAt: null, publishCapability: unsupported,
    },
  ];

  await page.route('**/api/v2/auth/me', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ role, permissions: [] }) })
  );
  await page.route('**/api/v2/brand-sites**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/publish')) {
      publishRequests += 1;
      if (!['platform_admin', 'hq_admin', 'brand_admin'].includes(role)) {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ message: '当前角色无品牌发布权限' }),
        });
        return;
      }
      if (publishMode === 'failure') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            message: '品牌静态备份执行失败',
            error: 'script failed',
            log: '[刷新公开产品数据]\nnetwork unavailable',
          }),
        });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          brandCode: 'everhot',
          mode: 'static-backup',
          log: '[刷新公开产品数据]\n完成 18 个产品\n[刷新 DAM 产品图片]\n完成 12 张图片',
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: sites, total: sites.length }),
    });
  });
  await page.route('**/api/v2/product-catalog/taxonomy**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ categories: [] }) })
  );
  await page.route('**/api/v2/product-catalog/devices**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) })
  );
  await page.route('**/api/v2/sites/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) })
  );

  await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
  const publishButton = page.getByRole('button', { name: '生成静态备份', exact: true });
  try {
    await publishButton.waitFor({ timeout: 8000 });
  } catch (error) {
    throw new Error(`${error.message}\nRequests:\n${observedRequests.join('\n')}\nRendered body:\n${await page.locator('body').innerText()}`);
  }
  await publishButton.click();
  await page.getByText('静态备份完成', { exact: true }).waitFor();
  await page.getByText('完成 12 张图片', { exact: false }).waitFor();

  publishMode = 'failure';
  await publishButton.click();
  await page.getByText('静态备份失败', { exact: true }).waitFor();
  await page.getByText('network unavailable', { exact: false }).waitFor();

  const requestsBeforeUnsupported = publishRequests;
  await page.goto(`${baseUrl}/comfort/sites/rheem`, { waitUntil: 'networkidle' });
  const unsupportedButton = page.getByRole('button', { name: '暂不支持发布', exact: true });
  await unsupportedButton.waitFor();
  const unsupportedDisabled = await unsupportedButton.isDisabled();
  const unsupportedReasonVisible = await page.getByText(unsupported.reason, { exact: true }).isVisible();
  const unsupportedDidNotPublish = publishRequests === requestsBeforeUnsupported;

  role = 'brand_viewer';
  publishMode = 'success';
  await page.goto(`${baseUrl}/comfort/sites/everhot`, { waitUntil: 'networkidle' });
  await page.getByText('Everhot website products').waitFor();
  const readOnlyPublishButtons = await page
    .getByRole('button', { name: /生成静态备份|暂不支持发布|Publish/i })
    .count();
  const unauthorizedStatus = await page.evaluate(async () => {
    const response = await fetch('/api/v2/brand-sites/site-everhot/publish', { method: 'POST' });
    return response.status;
  });
  const iframeCount = await page.locator('iframe').count();

  await browser.close();
  if (
    !unsupportedDisabled
    || !unsupportedReasonVisible
    || !unsupportedDidNotPublish
    || readOnlyPublishButtons !== 0
    || unauthorizedStatus !== 403
    || iframeCount !== 0
  ) {
    throw new Error(JSON.stringify({
      unsupportedDisabled,
      unsupportedReasonVisible,
      unsupportedDidNotPublish,
      readOnlyPublishButtons,
      unauthorizedStatus,
      iframeCount,
      publishRequests,
    }));
  }

  console.log('brand publish smoke passed: writer action, unsupported state, success/failure logs, RBAC and no iframe');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
