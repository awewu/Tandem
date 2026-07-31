const { chromium } = require('playwright');
const fs = require('fs');

const baseUrl = process.env.DEALER_WORKBENCH_URL || 'http://localhost:5000';
const screenshotPath = process.env.GROWTH_COPY_SCREENSHOT;
const browsers = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

const items = Array.from({ length: 24 }, (_, index) => ({
  id: `copy-${index + 1}`,
  channel: index % 3 === 0 ? 'xiaohongshu' : index % 3 === 1 ? 'zhihu' : 'wechat',
  brandSlug: index % 2 ? 'Everhot' : 'Rheem',
  prompt: '生成家庭热水与舒适系统推广文案',
  draft: `【专业内容 · 草稿 · 待人工核准】家庭热水与舒适系统选购指南 ${index + 1}，包含真实体验、适用场景与产品选择建议。`,
  status: index % 5 === 0 ? 'rejected' : index % 4 === 0 ? 'approved' : 'draft',
  reviewer: index % 4 === 0 ? '超级管理员' : null,
  complianceFlags: [],
  createdAt: '2026-07-31T08:00:00.000Z',
  updatedAt: '2026-07-31T08:00:00.000Z',
}));

async function main() {
  const executablePath = browsers.find((candidate) => fs.existsSync(candidate));
  const browser = await chromium.launch(executablePath ? { headless: true, executablePath } : { headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.route('**/api/v2/auth/**', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'user-1', role: 'super_admin', permissions: [] } }),
  }));
  await page.route('**/api/v2/growth/copy', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ data: { items } }),
  }));

  await page.goto(`${baseUrl}/growth/copywriter`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: '文案库', exact: true }).waitFor({ timeout: 15_000 });
  const table = page.locator('.growth-copy-table');
  await table.locator('tbody tr').first().waitFor();
  const cells = table.locator('tbody tr').first().locator('td');
  const summaryBox = await cells.nth(1).boundingBox();
  const actionBox = await cells.nth(8).boundingBox();
  if (!summaryBox || summaryBox.width < 180) throw new Error(`copy summary column too narrow: ${summaryBox?.width}`);
  if (!actionBox || actionBox.width < 210) throw new Error(`actions column too narrow: ${actionBox?.width}`);
  if (await table.locator('thead th').count() !== 9) throw new Error('copy table must have 9 columns');
  await page.getByText('共 24 条', { exact: true }).waitFor();
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const overflow = await page.locator('.growth-copy-table-shell').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  if (overflow.scrollWidth <= overflow.clientWidth) throw new Error('mobile table should scroll horizontally');
  await browser.close();
  console.log('growth copy library smoke passed: restored 9-column layout, pagination, desktop widths and mobile scrolling');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
