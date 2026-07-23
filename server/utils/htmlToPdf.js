/**
 * htmlToPdf - 使用 Playwright Chromium 把 HTML 文件渲染为真实 PDF
 * ───────────────────────────────────────────────────────────
 * 优先走文件→PDF（避免 headless 对相对资源解析的歧义）
 * 懒加载：只有真的需要时才引入 playwright，避免冷启动开销
 *
 * 首次使用前需执行：
 *   npx playwright install chromium
 *
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let _browser = null;   // 进程级复用（降低每次调用开销）
let _loading = null;
let _playwright = null;

async function getBrowser() {
  if (_browser) return _browser;
  if (_loading) return _loading;
  _loading = (async () => {
    if (!_playwright) {
      try {
        _playwright = require('playwright');
      } catch (e) {
        throw new Error('playwright 未安装。请在 package.json 中确认 "playwright" 并重新 npm install');
      }
    }
    try {
      _browser = await _playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    } catch (e) {
      throw new Error(
        'Chromium 内核未就绪（' + e.message + '）。' +
        '请先运行：npx playwright install chromium'
      );
    }
    _browser.on('disconnected', () => { _browser = null; });
    return _browser;
  })();
  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

/**
 * 将本地 HTML 文件渲染为 PDF
 * @param {string} htmlPath - 绝对路径
 * @param {string} pdfPath  - 输出绝对路径
 * @param {Object} opts     - { format='A4', printBackground=true, margin, landscape }
 * @returns {Promise<{pdfPath, sizeKB}>}
 */
async function renderFileToPdf(htmlPath, pdfPath, opts = {}) {
  if (!fs.existsSync(htmlPath)) throw new Error('HTML 文件不存在: ' + htmlPath);
  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle', timeout: 15000 });
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      format: opts.format || 'A4',
      printBackground: opts.printBackground !== false,
      landscape: !!opts.landscape,
      margin: opts.margin || { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
      preferCSSPageSize: true
    });
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }

  const sizeKB = Math.round(fs.statSync(pdfPath).size / 1024);
  return { pdfPath, sizeKB };
}

/** 关闭浏览器（进程退出时调用） */
async function shutdown() {
  if (_browser) {
    try { await _browser.close(); } catch (_) {}
    _browser = null;
  }
}

// 进程退出时清理
process.once('SIGINT', () => shutdown().then(() => process.exit(0)));
process.once('SIGTERM', () => shutdown().then(() => process.exit(0)));

module.exports = { renderFileToPdf, shutdown };
