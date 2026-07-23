// 截取 legacy-ui 关键产品页面，供培训 PPT 使用。
// 运行（在仓库根目录）：node training-ppt/capture.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'archive', 'legacy-ui', 'public');
const OUT = path.join(__dirname, 'shots');
const PORT = 4319;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

const PAGES = [
  { file: 'index.html',                name: 'portal' },
  { file: 'pain-diagnosis.html',       name: 'diagnosis' },
  { file: 'customer-view.html',        name: 'customer' },
  { file: 'designer.html',             name: 'designer' },
  { file: 'business-console.html',     name: 'console' },
  { file: 'rysnova-bim-designer.html', name: 'bim', wait: 6000, inject: () => {
      const ov = document.getElementById('loadingOverlay'); if (ov) ov.remove();
      const st = document.createElement('style');
      st.textContent = '*{opacity:1!important;animation:none!important;transition:none!important} .loading-overlay,#loadingOverlay{display:none!important}';
      document.head.appendChild(st);
  } },
];

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(SITE, p);
      if (!fp.startsWith(SITE) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(PORT, () => resolve(server));
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));

  for (const pg of PAGES) {
    const url = `http://127.0.0.1:${PORT}/${pg.file}`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(pg.wait || 2500);
      if (pg.inject) { await page.evaluate(pg.inject).catch(() => {}); await page.waitForTimeout(600); }
      await page.evaluate(() => window.scrollTo(0, 0));
      const dest = path.join(OUT, `${pg.name}.png`);
      await page.screenshot({ path: dest });
      console.log('OK  ', pg.name, '->', dest);
    } catch (e) {
      console.log('FAIL', pg.name, e.message);
    }
  }
  await browser.close();
  server.close();
  console.log('DONE');
})();
