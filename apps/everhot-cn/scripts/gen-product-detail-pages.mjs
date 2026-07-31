#!/usr/bin/env node
/**
 * Everhot 产品详情静态入口生成器。
 *
 * 数据来源保持前后端分离：fetch-products-from-nexus.mjs 先从 Nexus 公开 API
 * 重生成 public/js/products-data.js，本脚本只消费该构建产物，为每个产品生成
 * /products/detail/<slug>/index.html 的可爬取入口。运行时仍由 catalog.js 渲染完整详情。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const DATA_FILE = join(PUBLIC, 'js', 'products-data.js');
const DETAIL_ROOT = join(PUBLIC, 'products', 'detail');
const SITE = 'https://www.everhot.com.cn';

function loadProducts() {
  const code = readFileSync(DATA_FILE, 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: DATA_FILE });
  return Array.isArray(sandbox.window.EVERHOT_PRODUCTS) ? sandbox.window.EVERHOT_PRODUCTS : [];
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cleanSlug(s) {
  return String(s || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function productSchema(product, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku || product.slug,
    model: product.model || product.slug,
    brand: { '@type': 'Brand', name: 'Everhot 恒热' },
    category: product.websiteCategory || product.categoryPath || product.category || '',
    description: product.summary || product.tagline || '',
    image: product.image ? new URL(product.image, SITE).href : undefined,
    url,
    additionalProperty: Array.isArray(product.specs)
      ? product.specs.map((item) => ({ '@type': 'PropertyValue', name: item.k, value: item.v }))
      : [],
  };
}

function breadcrumb(product, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: '产品中心', item: `${SITE}/products/` },
      { '@type': 'ListItem', position: 3, name: product.name, item: url },
    ],
  };
}

function page(product) {
  const slug = cleanSlug(product.slug || product.sku);
  const title = `${product.name} | 恒热 Everhot`;
  const desc = product.summary || product.tagline || `${product.name} 产品详情、规格参数与选型支持。`;
  const url = `${SITE}/products/detail/${slug}/`;
  const image = product.image ? new URL(product.image, SITE).href : `${SITE}/assets/img/hero-poster-desktop.webp`;
  return `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="theme-color" content="#BF1924">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800;900&family=Mulish:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/css/everhot.css">
<!-- GEO:START -->
<link rel="canonical" href="${url}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Everhot 中国 Everhot China">
<meta property="og:locale" content="zh_CN">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<script type="application/ld+json">${JSON.stringify(productSchema(product, url))}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumb(product, url))}</script>
<!-- GEO:END -->
</head><body>
<div id="evNavMount"></div>
<div data-product-detail data-product-slug="${esc(slug)}">
  <section class="page-hero"><div class="container">
    <div class="eyebrow">产品详情 · PRODUCT</div>
    <h1>${esc(product.name)}</h1>
    <p>${esc(desc)}</p>
  </div></section>
</div>
<footer class="footer"><div class="container footer-grid">
  <div class="footer-brand"><div class="logo"><span class="logo-en">EVERHOT</span><span class="logo-cn">恒热</span></div><p>百年恒续 · 为爱恒热<br>瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营</p><p class="footer-slogan">EVERHOT FOR EVERLOVE</p></div>
  <div class="footer-col"><strong>家用产品 <span>Residential</span></strong><a href="/products/residential/water-heating/">燃气热水器</a><a href="/products/residential/water-heating/">空气能热水器</a><a href="/products/residential/heating-cooling/">中央采暖</a><a href="/products/residential/heating-cooling/">家用空调</a></div>
  <div class="footer-col"><strong>商用产品 <span>Commercial</span></strong><a href="/products/commercial/water-heating/">商用热水炉</a><a href="/products/commercial/water-heating/">商用空气能</a><a href="/products/commercial/heating-cooling/">楼宇热力站</a></div>
  <div class="footer-col"><strong>支持服务 <span>Support</span></strong><a href="/find-a-pro/">查找经销商</a><a href="/support/">支持与服务</a><a href="/warranty/">保修政策</a><a href="/faqs/">常见问题</a></div>
  <div class="footer-col"><strong>集团品牌 <span>Our Brands</span></strong><a href="/">恒热 Everhot</a><a href="https://www.rheem.com.cn">Rheem 瑞美</a><a href="https://www.ruud.com.cn">Ruud 瑞德</a><a href="https://rhautt.com">瑞合瑞德集团</a></div>
</div><div class="footer-bottom"><div class="container footer-bottom-inner">
  <span>&copy; 2026 Everhot 恒热 · 瑞合瑞德暖通科技集团 · Everhot 为注册商标</span>
  <nav class="footer-legal" aria-label="法律与合规"><a href="/privacy/">隐私政策</a><a href="/privacy/#cookie">Cookie 说明</a><a href="/privacy/#terms">法律声明</a><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">沪ICP备XXXXXXXX号</a></nav>
</div></div></footer>
<script src="/js/nav.js" defer></script>
<script src="/js/products-data.js" defer></script>
<script src="/js/product-images.js" defer></script>
<script src="/js/product-art.js" defer></script>
<script src="/js/catalog.js" defer></script>
</body></html>
`;
}

const products = loadProducts().filter((product) => cleanSlug(product.slug || product.sku));
for (const item of products) {
  const slug = cleanSlug(item.slug || item.sku);
  const dir = join(DETAIL_ROOT, slug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page({ ...item, slug }), 'utf8');
}

const valid = new Set(products.map((item) => cleanSlug(item.slug || item.sku)));
if (existsSync(DETAIL_ROOT)) {
  for (const dirent of readdirSync(DETAIL_ROOT, { withFileTypes: true })) {
    if (dirent.isDirectory() && !valid.has(dirent.name)) {
      rmSync(join(DETAIL_ROOT, dirent.name), { recursive: true, force: true });
    }
  }
}

console.log(`✓ 已生成 ${products.length} 个恒热产品静态详情入口 → public/products/detail/<slug>/`);
