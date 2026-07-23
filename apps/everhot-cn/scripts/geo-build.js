#!/usr/bin/env node
/**
 * Rhautt Nexus GEO 同源生成器（宪章 5.6，对外站全覆盖）
 * 从 brand-registry.json 发现全部对外站点（type ∈ group/brand-site/consumer-app），
 * 为各站 public/ 下全部页面注入机器可读层：canonical / Open Graph / Twitter Card /
 * Schema.org JSON-LD，并生成各站根 robots.txt 与 sitemap.xml（用各品牌自有生产域名）。
 *
 * 幂等：注入块以 <!-- GEO:START --> ... <!-- GEO:END --> 包裹，重复运行先剥离再写入。
 * 仅用 Node 内置模块。Run: node apps/everhot-cn/scripts/geo-build.js [--site <slug>]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..', '..');
const PARENT_ORG = 'Rhautt Comfort 瑞合瑞德暖通科技集团';
const OUTWARD_TYPES = new Set(['group', 'brand-site', 'consumer-app']);
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'Bytespider'];

const START = '<!-- GEO:START -->';
const END = '<!-- GEO:END -->';

// per-site context, set in buildSite() before page processing
let CTX = null;

function loadSites() {
  const reg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand-registry.json'), 'utf8'));
  const want = (() => { const i = process.argv.indexOf('--site'); return i > -1 ? process.argv[i + 1] : null; })();
  return (reg.brands || [])
    .filter(b => OUTWARD_TYPES.has(b.type))
    .filter(b => !want || b.slug === want)
    .map(b => ({
      slug: b.slug,
      dir: path.join(REPO_ROOT, b.app, 'public'),
      base: 'https://www.' + b.domain,
      brand: b.name_cn + (b.name_en ? ' ' + b.name_en : ''),
    }));
}

function listHtml(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listHtml(full));
    else if (ent.isFile() && ent.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// file path -> production URL path (strip index.html, ensure trailing slash)
function urlPathOf(file) {
  let rel = path.relative(CTX.dir, file).split(path.sep).join('/');
  rel = rel.replace(/index\.html$/, '');
  if (!rel.startsWith('/')) rel = '/' + rel;
  if (rel !== '/' && !rel.endsWith('/')) rel += '/';
  return rel;
}

function attr(html, re) {
  const m = html.match(re);
  return m ? m[1].trim() : '';
}

function deriveTitle(html, urlPath) {
  const t = attr(html, /<title>([^<]*)<\/title>/i);
  return t || CTX.brand;
}

function deriveDescription(html) {
  let d = attr(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  if (d) return d;
  // fall back to first hero paragraph
  const p = attr(html, /<p>([^<]{8,})<\/p>/i);
  return p || (CTX.brand + ' — 瑞合瑞德集团旗下品牌。');
}

function breadcrumb(urlPath) {
  const segs = urlPath.split('/').filter(Boolean);
  const items = [{ '@type': 'ListItem', position: 1, name: '首页', item: CTX.base + '/' }];
  let acc = '';
  segs.forEach((s, i) => {
    acc += '/' + s;
    items.push({ '@type': 'ListItem', position: i + 2, name: decodeURIComponent(s), item: CTX.base + acc + '/' });
  });
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

function pageSchemas(urlPath, title, desc) {
  const url = CTX.base + urlPath;
  const BASE = CTX.base, BRAND = CTX.brand, OG_IMAGE = CTX.ogImage;
  const schemas = [];

  if (urlPath === '/') {
    schemas.push({
      '@context': 'https://schema.org', '@type': 'Organization',
      name: BRAND, url: BASE, logo: OG_IMAGE,
      description: desc,
      parentOrganization: { '@type': 'Organization', name: PARENT_ORG, url: 'https://rhautt.com' },
      brand: { '@type': 'Brand', name: BRAND },
      sameAs: ['https://rhautt.com'],
    });
    schemas.push({
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: BRAND, url: BASE, inLanguage: 'zh-CN',
      publisher: { '@type': 'Organization', name: PARENT_ORG },
    });
  } else if (/^\/products\//.test(urlPath)) {
    // 产品列表/类目页：CollectionPage + ItemList（满足 GEO 门 product 页要求）
    schemas.push({
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: title, url, inLanguage: 'zh-CN', description: desc,
      isPartOf: { '@type': 'WebSite', name: BRAND, url: BASE },
      about: { '@type': 'ProductGroup', name: BRAND + ' 产品', brand: { '@type': 'Brand', name: BRAND } },
      mainEntity: {
        '@type': 'ItemList', name: title,
        itemListElement: [{ '@type': 'ListItem', position: 1, name: title, url }],
      },
    });
  } else {
    schemas.push({
      '@context': 'https://schema.org', '@type': 'WebPage',
      name: title, url, inLanguage: 'zh-CN', description: desc,
      isPartOf: { '@type': 'WebSite', name: BRAND, url: BASE },
    });
  }
  schemas.push(breadcrumb(urlPath));
  return schemas;
}

function buildBlock(urlPath, title, desc) {
  const url = CTX.base + urlPath;
  const BRAND = CTX.brand, OG_IMAGE = CTX.ogImage;
  const lines = [];
  lines.push('  ' + START);
  lines.push(`  <link rel="canonical" href="${url}">`);
  lines.push(`  <meta property="og:type" content="${urlPath === '/' ? 'website' : 'article'}">`);
  lines.push(`  <meta property="og:site_name" content="${BRAND}">`);
  lines.push(`  <meta property="og:locale" content="zh_CN">`);
  lines.push(`  <meta property="og:title" content="${escAttr(title)}">`);
  lines.push(`  <meta property="og:description" content="${escAttr(desc)}">`);
  lines.push(`  <meta property="og:url" content="${url}">`);
  lines.push(`  <meta property="og:image" content="${OG_IMAGE}">`);
  lines.push(`  <meta name="twitter:card" content="summary_large_image">`);
  lines.push(`  <meta name="twitter:title" content="${escAttr(title)}">`);
  lines.push(`  <meta name="twitter:description" content="${escAttr(desc)}">`);
  lines.push(`  <meta name="twitter:image" content="${OG_IMAGE}">`);
  for (const s of pageSchemas(urlPath, title, desc)) {
    lines.push(`  <script type="application/ld+json">${JSON.stringify(s)}</script>`);
  }
  lines.push('  ' + END);
  return lines.join('\n');
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripBlock(html) {
  const re = new RegExp('[\\t ]*' + START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\n?', 'g');
  return html.replace(re, '');
}

function ensureDescription(html, desc) {
  if (/<meta\s+name=["']description["']/i.test(html)) return html;
  // insert a description right after <title>
  return html.replace(/(<\/title>)/i, `$1\n  <meta name="description" content="${escAttr(desc)}">`);
}

function pickOgImage(site) {
  // prefer the hero poster if present, else first asset image, else a stable path
  const candidates = [
    'assets/img/hero-poster-desktop.webp',
    'assets/img/og-default.webp',
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(site.dir, c))) return site.base + '/' + c;
  }
  return site.base + '/assets/img/hero-poster-desktop.webp';
}

function buildSite(site) {
  if (!fs.existsSync(site.dir)) {
    console.log(`GEO build: [${site.slug}] skip — no public dir (${path.relative(REPO_ROOT, site.dir)})`);
    return { slug: site.slug, skipped: true };
  }
  CTX = { dir: site.dir, base: site.base, brand: site.brand, ogImage: pickOgImage(site) };
  const files = listHtml(site.dir);
  const urls = [];
  let injected = 0;

  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    const urlPath = urlPathOf(file);
    const title = deriveTitle(html, urlPath);
    const desc = deriveDescription(html);

    html = stripBlock(html);
    html = ensureDescription(html, desc);

    const block = buildBlock(urlPath, title, desc);
    if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, block + '\n</head>');
    } else {
      html = block + '\n' + html; // degenerate page without head
    }
    fs.writeFileSync(file, html);
    urls.push(urlPath);
    injected++;
  }

  // robots.txt
  const robots = [
    `# ${site.brand} — GEO 抓取策略（Rhautt Nexus 宪章 5.6）`,
    'User-agent: *',
    'Allow: /',
    '',
    ...AI_BOTS.flatMap(b => [`User-agent: ${b}`, 'Allow: /', '']),
    `Sitemap: ${site.base}/sitemap.xml`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(site.dir, 'robots.txt'), robots);

  // sitemap.xml
  const today = new Date().toISOString().slice(0, 10);
  const sm = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.sort().map(u => {
      const pri = u === '/' ? '1.0' : (u.split('/').filter(Boolean).length <= 1 ? '0.8' : '0.6');
      return `  <url><loc>${site.base}${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${pri}</priority></url>`;
    }),
    '</urlset>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(site.dir, 'sitemap.xml'), sm);

  console.log(`GEO build: [${site.slug}] injected ${injected} pages, robots.txt + sitemap.xml (${urls.length} urls).`);
  return { slug: site.slug, injected, urls: urls.length };
}

function main() {
  const sites = loadSites();
  if (sites.length === 0) { console.log('GEO build: no outward sites matched.'); return; }
  for (const site of sites) buildSite(site);
}

main();
