#!/usr/bin/env node
/**
 * 构建期拉取：Nexus 公开只读端点 → 重新生成 products-data.js 的
 * window.EVERHOT_PRODUCTS 数组（保留文件头注释与 window.EVERHOT_CATALOG 工具块）。
 * 站点保持纯静态与独立部署（EVERHOT-NEXUS-INTEGRATION-DESIGN §6）。
 *
 * 离线回退：端点不可达 / 返回空 时，保留现有 products-data.js 不动并告警，退出 0，
 * 保证构建不因后台不可用而中断（与站点 SVG 回退策略一致）。
 *
 * 运行：node apps/everhot-cn/scripts/fetch-products-from-nexus.mjs
 *      [--base http://localhost:5500/api/v2]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EVERHOT = join(SCRIPT_DIR, '..');
const DATA_FILE = join(EVERHOT, 'public', 'js', 'products-data.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const BASE = arg('base', process.env.EVERHOT_API_BASE || 'http://localhost:5500/api/v2');
const URLS = [`${BASE}/sites/everhot/products?locale=zh-CN`, `${BASE}/brand/everhot/products?locale=zh-CN`];

const PRODUCTS_MARKER = 'window.EVERHOT_PRODUCTS';
const CATALOG_MARKER = '/* 分类工具';

function bail(msg) {
  console.warn(`⚠️  ${msg}\n    → 离线回退：保留现有 products-data.js 不变。`);
  process.exit(0);
}

let json;
let lastError;
for (const url of URLS) {
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    json = await res.json();
    break;
  } catch (e) {
    lastError = `${url}: ${e.message}`;
  }
}
if (!json) bail(`无法连接产品公开接口：${lastError}`);

const items = json?.data?.items;
if (!Array.isArray(items)) bail('后台返回的产品目录格式无效');

if (!existsSync(DATA_FILE)) bail(`未找到 ${DATA_FILE}`);
const text = readFileSync(DATA_FILE, 'utf8');
const headerEnd = text.indexOf(PRODUCTS_MARKER);
const footerStart = text.indexOf(CATALOG_MARKER);
if (headerEnd < 0 || footerStart < 0 || footerStart < headerEnd) {
  bail('products-data.js 结构不符合预期（缺少 EVERHOT_PRODUCTS / 分类工具 标记）');
}

const header = text.slice(0, headerEnd);
const footer = text.slice(footerStart);
const body = `window.EVERHOT_PRODUCTS = ${JSON.stringify(items, null, 2)};\n\n`;
const stamp = `/* AUTO-GENERATED 自 Nexus 公开端点 ${new Date().toISOString()}；勿手改数组，改后台后重跑 fetch-products-from-nexus.mjs */\n`;

writeFileSync(DATA_FILE, header + stamp + body + footer, 'utf8');
console.log(`✓ 已用后台数据重生成 ${items.length} 个产品 → public/js/products-data.js`);
