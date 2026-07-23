// 截取正在运行的 Next.js 应用真实界面（视口图 + 整页长图）。
// 运行（仓库根目录）：node training-ppt/capture-live.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, 'shots', 'live');

const TARGETS = [
  { name: 'portal',    url: 'http://localhost:4005/', wait: 3500, full: true },
  { name: 'dealer',    url: 'http://localhost:4000/', wait: 3000 },
  { name: 'customer',  url: 'http://localhost:4002/', wait: 3000 },
  { name: 'designer',  url: 'http://localhost:4003/', wait: 4500 },
  { name: 'console',   url: 'http://localhost:4010/', wait: 3500 },
  { name: 'brand',     url: 'http://localhost:4012/', wait: 3500, full: true },
  { name: 'diagnosis', url: 'http://localhost:4001/', wait: 3500, full: true },
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));

  for (const t of TARGETS) {
    try {
      const resp = await page.goto(t.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => null);
      await page.waitForTimeout(t.wait || 3000);
      await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
      const dest = path.join(OUT, `${t.name}.png`);
      await page.screenshot({ path: dest });
      let extra = '';
      if (t.full) {
        const fdest = path.join(OUT, `${t.name}-full.png`);
        await page.screenshot({ path: fdest, fullPage: true });
        extra = ' (+full)';
      }
      console.log('OK  ', t.name.padEnd(10), resp ? resp.status() : '???', '->', dest + extra);
    } catch (e) {
      console.log('FAIL', t.name.padEnd(10), e.message);
    }
  }
  await browser.close();
  console.log('DONE');
})();
