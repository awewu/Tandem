#!/usr/bin/env node
/**
 * GEO 机器可读层守卫（宪章 5.6 / 第 7 章 GEO 门）
 * 校验对外站点每个页面满足：唯一 h1、lang、description、canonical、OG、Twitter Card、
 * JSON-LD（产品页须含 Product/ItemList/CollectionPage）、图片 alt 全覆盖；
 * 站点根须有 robots.txt（含 sitemap 指向）与 sitemap.xml（链接无死链）。
 * 缺失即红灯（exit 1）。仅用 Node 内置模块。
 * Run: node scripts/agent-guards/geo-readiness-check.js [--report]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REPORT = process.argv.includes('--report');

// 对外站点来自 brand-registry.json（单一事实源）。
// 宪章 5.6 管对外站：type ∈ {group, brand-site, consumer-app}。
// 内部工作台/平台（platform / workbench / console）不计入 GEO 门。
const OUTWARD_TYPES = new Set(['group', 'brand-site', 'consumer-app']);

function loadSites() {
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand-registry.json'), 'utf8'));
  const sites = [];
  for (const b of reg.brands || []) {
    if (!OUTWARD_TYPES.has(b.type)) continue;
    const dir = path.join(ROOT, b.app, 'public');
    sites.push({ id: b.slug, dir, app: b.app, domain: b.domain, type: b.type });
  }
  return sites;
}

const SITES = loadSites();

// 双下划线前缀的 HTML 是构建期产物、非可爬页面（如 Netlify 的 __forms.html：
// 内含全部 hidden 表单，仅供构建时探测表单名，用户与爬虫都不该访问）。
// 对它们要求 h1/OG/JSON-LD 无意义，故不计入 GEO 门。
const NON_PAGE_HTML = /^__/;

function listHtml(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listHtml(full));
    else if (ent.isFile() && ent.name.endsWith('.html') && !NON_PAGE_HTML.test(ent.name)) out.push(full);
  }
  return out;
}

function checkPage(file, siteDir) {
  const html = fs.readFileSync(file, 'utf8');
  const issues = [];
  const has = (re) => re.test(html);

  // lang
  if (!/<html[^>]+lang=["']zh/i.test(html)) issues.push('missing lang="zh*"');
  // unique h1
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1 === 0) issues.push('missing h1');
  if (h1 > 1) issues.push(`multiple h1 (${h1})`);
  // description
  if (!has(/<meta\s+name=["']description["']\s+content=["'][^"']+["']/i)) issues.push('missing meta description');
  // canonical
  if (!has(/<link\s+rel=["']canonical["']/i)) issues.push('missing canonical');
  // open graph
  for (const og of ['og:title', 'og:description', 'og:image', 'og:type', 'og:url']) {
    if (!has(new RegExp(`property=["']${og}["']`, 'i'))) issues.push(`missing ${og}`);
  }
  // twitter card
  if (!has(/name=["']twitter:card["']/i)) issues.push('missing twitter:card');
  // json-ld
  const ld = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi) || [];
  if (ld.length === 0) issues.push('missing JSON-LD');
  let blob = '';
  for (const tag of ld) {
    const body = tag.replace(/<[^>]+>/g, '');
    try { JSON.parse(body); } catch { issues.push('invalid JSON-LD'); }
    blob += body;
  }
  // product pages need a product-ish schema type
  const urlPath = '/' + path.relative(siteDir, file).split(path.sep).join('/').replace(/index\.html$/, '');
  if (/^\/products\//.test(urlPath) && !/(Product|ItemList|CollectionPage|ProductGroup)/.test(blob)) {
    issues.push('product page lacks Product/ItemList/CollectionPage schema');
  }
  // img alt coverage
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter(t => !/\salt=/i.test(t)).length;
  if (noAlt > 0) issues.push(`${noAlt}/${imgs.length} img without alt`);

  return issues;
}

function checkSiteRoot(site) {
  const issues = [];
  const robots = path.join(site.dir, 'robots.txt');
  const sitemap = path.join(site.dir, 'sitemap.xml');
  if (!fs.existsSync(robots)) issues.push('missing robots.txt');
  else if (!/Sitemap:\s*https?:\/\//i.test(fs.readFileSync(robots, 'utf8'))) issues.push('robots.txt missing Sitemap: directive');
  if (!fs.existsSync(sitemap)) { issues.push('missing sitemap.xml'); return issues; }

  // sitemap loc entries must map to a real local file (no dead links)
  const sm = fs.readFileSync(sitemap, 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(m => m[1]);
  if (locs.length === 0) issues.push('sitemap.xml has no <loc>');
  for (const loc of locs) {
    const p = loc.replace(/^https?:\/\/[^/]+/, '').replace(/\/$/, '');
    const candidate = path.join(site.dir, p, 'index.html');
    const candidate2 = path.join(site.dir, p + '.html');
    const root = p === '' && fs.existsSync(path.join(site.dir, 'index.html'));
    if (!root && !fs.existsSync(candidate) && !fs.existsSync(candidate2)) {
      issues.push(`sitemap dead link: ${loc}`);
    }
  }
  return issues;
}

const failures = [];
const summary = [];
const pending = []; // 对外站已登记但尚未建成 public（不算 failure，但必须显式追踪）
const unmeasured = []; // 有 public 但无可扫页面（如 Next 应用）：**未测量**，不得报 ready

for (const site of SITES) {
  if (!fs.existsSync(site.dir)) {
    pending.push(`[${site.id}] not built yet — no public dir ${path.relative(ROOT, site.dir)} (GEO 门将在建成时强制)`);
    summary.push({ site: site.id, type: site.type, domain: site.domain, pages: 0, clean: 0, rootIssues: 0, status: 'pending-not-built' });
    continue;
  }
  const rootIssues = checkSiteRoot(site);
  for (const i of rootIssues) failures.push(`[${site.id}] site-root: ${i}`);

  const pages = listHtml(site.dir);
  let ok = 0;
  for (const file of pages) {
    const rel = path.relative(ROOT, file);
    const issues = checkPage(file, site.dir);
    if (issues.length) {
      for (const i of issues) failures.push(`[${site.id}] ${rel}: ${i}`);
    } else ok++;
  }
  // 0 个可扫页面 ≠ 就绪。若该站是 Next 应用（页面在 src/app|app，不落 public/），
  // 本门禁**未测量**它，绝不可报 ready —— 那是假绿。显式标 unmeasured 并登记为缺口。
  let status;
  if (pages.length === 0) {
    const isNextApp = ['next.config.js', 'next.config.mjs', 'next.config.ts']
      .some((f) => fs.existsSync(path.join(ROOT, site.app, f)));
    status = isNextApp ? 'unmeasured-next-app' : 'unmeasured-no-pages';
    unmeasured.push(`[${site.id}] ${site.domain}: ${isNextApp
      ? `Next 应用（页面在 ${site.app}/src/app，不在 public/）—— 本门禁只扫静态 HTML，该站 GEO 就绪度**未被验证**`
      : `public/ 下无 HTML 页面 —— GEO 就绪度未被验证`}`);
  } else {
    status = (rootIssues.length === 0 && ok === pages.length) ? 'ready' : 'fail';
  }
  summary.push({ site: site.id, type: site.type, domain: site.domain, pages: pages.length, clean: ok, rootIssues: rootIssues.length, status });
}

console.log('GEO Readiness Check — Rhautt Nexus 宪章 5.6（对外站全覆盖）');
console.log(`outward sites (brand-registry) = ${SITES.length}`);
for (const s of summary) console.log(`- ${s.site} [${s.type} · ${s.domain}]: ${s.status} (pages=${s.pages}, clean=${s.clean}, site-root issues=${s.rootIssues})`);
if (pending.length) {
  console.log(`\npending (登记未建，不阻断上线门):`);
  for (const p of pending) console.log(`- ${p}`);
}
if (unmeasured.length) {
  console.warn(`\n⚠️  UNMEASURED (${unmeasured.length}) —— 这些对外站的 GEO 就绪度**未被本门禁验证**，不等于合格：`);
  for (const u of unmeasured) console.warn(`- ${u}`);
  console.warn('  处置：需为 Next 应用增加基于 metadata 导出/构建产物的 GEO 校验，否则集团站可见性长期无人守护。');
  try {
    require('../release/evidence-utils').updateReleaseEvidence('geoUnmeasuredSites', {
      command: 'npm run guard:geo',
      status: 'unmeasured-gap',
      sites: unmeasured,
      note: '本门禁只扫静态 HTML；Next 应用站点的 GEO 就绪度尚无校验手段',
    });
  } catch { /* 台账不可写不应阻断 */ }
}
console.log(`\nfailures = ${failures.length}`);

if (REPORT) {
  const dir = path.join(ROOT, 'evidence', 'geo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'geo-readiness-report.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), summary, pending, failures }, null, 2));
  console.log(`report -> evidence/geo/geo-readiness-report.json`);
}

if (failures.length) {
  for (const f of failures.slice(0, 60)) console.error(`- ${f}`);
  if (failures.length > 60) console.error(`... and ${failures.length - 60} more`);
  process.exit(1);
}
