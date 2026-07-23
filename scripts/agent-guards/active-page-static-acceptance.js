#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_JSON = path.join(ROOT, 'audit', 'active-page-static-acceptance-report.json');
const REPORT_MD = path.join(ROOT, 'audit', 'active-page-static-acceptance-report.md');

const pages = [
  { path: '/index.html', title: /工作入口|数智枢纽/, requiredText: ['瑞合瑞德数智枢纽', '品牌管理', '客户与赋能', '瑞合瑞德暖通科技集团'] },
  { path: '/index-ready.html', title: /瑞合瑞德集团/, requiredText: ['瑞合瑞德集团', '瑞诺瓦舒适家', 'Rheem', 'Ruud', 'Everhot'] }
];

const brandMarketingNavigationSmoke = {
  sources: [
    'apps/dealer-workbench/src/app/hub/page.tsx',
    'apps/dealer-workbench/src/app/hub-console/page.tsx',
    'apps/dealer-workbench/src/components/DealerNav.tsx'
  ],
  nexusConsoleBoardSource: 'apps/nexus-console/src/lib/boards.ts',
  nexusConsolePageSource: 'apps/nexus-console/src/app/[board]/[[...section]]/page.tsx',
  requiredLabels: [
    '品牌运营控制台',
    '产品库',
    '产品目录',
    '产品资料管理',
    'DAM / 素材库',
    '内容资产',
    '市场物料',
    '品牌官网管理',
    '上新 / 发布',
    '市场营销 · 增长引擎'
  ],
  requiredPaths: [
    '/brand',
    '/products',
    '/accounts',
    '/growth',
    '/growth/geo',
    '/growth/copywriter',
    '/growth/sentiment',
    '/growth/automation',
    '/comfort',
    '/comfort/sites',
    '/comfort/dam',
    '/comfort/catalog',
    '/comfort/publish'
  ],
  requiredBoardSections: [
    "id: 'comfort'",
    "key: 'sites'",
    "key: 'dam'",
    "key: 'catalog'",
    "key: 'publish'",
    "id: 'growth'",
    "key: 'geo'",
    "key: 'copywriter'",
    "key: 'sentiment'",
    "key: 'automation'"
  ],
  requiredRenderedSections: [
    "board === 'growth' && sectionKey === 'geo'",
    "board === 'comfort' && sectionKey === 'sites'",
    "board === 'comfort' && sectionKey === 'catalog'",
    "board === 'comfort' && sectionKey === 'dam'",
    "board === 'comfort' && sectionKey === 'publish'"
  ],
  forbiddenDeepLinks: [
    "key: 'diagnosis'",
    "key: 'crm'",
    "key: 'bim'",
    "key: 'bim-deepen'",
    "key: 'nexus-ops'",
    "key: 'customer'",
    "path: '/crm'",
    "path: '/design'",
    "path: '/bim'",
    "path: '/projects'",
    "path: '/analytics'",
    "path: '/finance'",
    "path: '/aftersales'",
    "path: '/team'",
    "path: '/dashboard'",
    "path: '/enablement'",
    "href: '/crm'",
    "href: '/design'",
    "href: '/bim'",
    "href: '/projects'",
    "href: '/analytics'",
    "href: '/finance'",
    "href: '/aftersales'",
    "href: '/team'",
    "href: '/dashboard'",
    "href: '/enablement'"
  ]
};

const forbiddenVisiblePatterns = [
  /AI\s*推荐/i,
  /AI智能/i,
  /智能问诊/i,
  /机器人/i,
  /🤖/,
  /立即体验/,
  /免费/,
  /60\s*秒/,
  /1\s*分钟/,
  /全网/,
  /最强/,
  /一键生成/,
  /魔法/,
  /舒适岛/,
  /锁客/
];

const forbiddenSourcePatterns = [
  /待命名软件平台/,
  /Rhautt Comfort\s*=\s*数字化软件生产主干/,
  /Rhautt Comfort\s*完全重构/,
  /\bRenova\b/
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(read(relativePath)).digest('hex');
}

function visibleTextFrom(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  for (const selector of ['script', 'style', 'noscript', 'template']) {
    for (const node of document.querySelectorAll(selector)) node.remove();
  }
  return document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function titleFrom(html) {
  const dom = new JSDOM(html);
  return dom.window.document.title || '';
}

function inspectPage(spec) {
  const relativePath = `archive/legacy-ui/public${spec.path}`;
  const fullPath = path.join(ROOT, relativePath);
  const exists = fs.existsSync(fullPath);
  const html = exists ? read(relativePath) : '';
  const visibleText = exists ? visibleTextFrom(html) : '';
  const title = exists ? titleFrom(html) : '';
  const requiredMatches = (spec.requiredText || []).map(text => ({
    text,
    matched: visibleText.includes(text) || html.includes(text) || Boolean(spec.optionalText?.includes(text))
  }));
  const forbiddenVisible = forbiddenVisiblePatterns
    .filter(pattern => pattern.test(visibleText))
    .map(pattern => String(pattern));
  const forbiddenSource = forbiddenSourcePatterns
    .filter(pattern => pattern.test(html))
    .map(pattern => String(pattern));

  const passed = exists &&
    spec.title.test(title) &&
    requiredMatches.every(item => item.matched) &&
    forbiddenVisible.length === 0 &&
    forbiddenSource.length === 0;

  return {
    path: spec.path,
    sourcePath: relativePath,
    sourceSha256: exists ? sha256(relativePath) : null,
    exists,
    title,
    requiredMatches,
    forbiddenVisible,
    forbiddenSource,
    passed
  };
}

function inspectBrandMarketingNavigation() {
  const sourceFiles = brandMarketingNavigationSmoke.sources.map(file => ({
    file,
    source: read(file)
  }));
  const combined = sourceFiles.map(item => item.source).join('\n');
  const boardSource = read(brandMarketingNavigationSmoke.nexusConsoleBoardSource);
  const pageSource = read(brandMarketingNavigationSmoke.nexusConsolePageSource);
  const missingLabels = brandMarketingNavigationSmoke.requiredLabels.filter(label => !combined.includes(label));
  const missingPaths = brandMarketingNavigationSmoke.requiredPaths.filter(targetPath => !combined.includes(`'${targetPath}'`));
  const missingBoardSections = brandMarketingNavigationSmoke.requiredBoardSections.filter(token => !boardSource.includes(token));
  const missingRenderedSections = brandMarketingNavigationSmoke.requiredRenderedSections.filter(token => !pageSource.includes(token));
  const forbiddenDeepLinks = brandMarketingNavigationSmoke.forbiddenDeepLinks
    .filter(token => combined.includes(token));
  return {
    name: 'brand-marketing-retained-navigation',
    sources: sourceFiles.map(item => item.file),
    requiredLabels: brandMarketingNavigationSmoke.requiredLabels.map(label => ({
      label,
      matched: !missingLabels.includes(label)
    })),
    requiredPaths: brandMarketingNavigationSmoke.requiredPaths.map(targetPath => ({
      path: targetPath,
      matched: !missingPaths.includes(targetPath)
    })),
    missingBoardSections,
    missingRenderedSections,
    forbiddenDeepLinks,
    passed: missingLabels.length === 0 &&
      missingPaths.length === 0 &&
      missingBoardSections.length === 0 &&
      missingRenderedSections.length === 0 &&
      forbiddenDeepLinks.length === 0
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Active Page Static Acceptance Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This is a static HTML acceptance gate for active pages. It does not replace browser visual acceptance.',
    '',
    '| Page | Title | Required Text | Forbidden Visible | Forbidden Source | Result |',
    '|---|---|---:|---:|---:|---:|'
  ];
  for (const result of report.results) {
    lines.push(`| ${result.path} | ${String(result.title).replace(/\|/g, '/')} | ${result.requiredMatches.filter(item => item.matched).length}/${result.requiredMatches.length} | ${result.forbiddenVisible.length} | ${result.forbiddenSource.length} | ${result.passed ? 'pass' : 'fail'} |`);
  }
  lines.push('', '## Focused Navigation Smoke', '');
  for (const smoke of report.navigationSmokes) {
    lines.push(`- ${smoke.name}: ${smoke.passed ? 'pass' : 'fail'}`);
    if (!smoke.passed) {
      lines.push(`  - labels: ${smoke.requiredLabels.filter(item => item.matched).length}/${smoke.requiredLabels.length}`);
      lines.push(`  - paths: ${smoke.requiredPaths.filter(item => item.matched).length}/${smoke.requiredPaths.length}`);
      lines.push(`  - missing board sections: ${smoke.missingBoardSections.length}`);
      lines.push(`  - missing rendered sections: ${smoke.missingRenderedSections.length}`);
      lines.push(`  - forbidden deep links: ${smoke.forbiddenDeepLinks.length}`);
    }
  }
  return lines.join('\n');
}

const results = pages.map(inspectPage);
const navigationSmokes = [inspectBrandMarketingNavigation()];
const report = {
  generatedAt: new Date().toISOString(),
  mode: 'static-html-prd-vi-acceptance',
  summary: {
    pages: results.length,
    passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length,
    navigationSmokes: navigationSmokes.length,
    navigationSmokesPassed: navigationSmokes.filter(result => result.passed).length,
    navigationSmokesFailed: navigationSmokes.filter(result => !result.passed).length
  },
  results,
  navigationSmokes
};

fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
fs.writeFileSync(REPORT_MD, renderMarkdown(report));

console.log(`Active page static acceptance: ${report.summary.passed}/${report.summary.pages} pages passed; ${report.summary.navigationSmokesPassed}/${report.summary.navigationSmokes} navigation smokes passed`);
if (report.summary.failed || report.summary.navigationSmokesFailed) {
  for (const result of results.filter(item => !item.passed)) {
    console.error(`- ${result.path}: title=${result.title}; required=${result.requiredMatches.filter(item => item.matched).length}/${result.requiredMatches.length}; forbiddenVisible=${result.forbiddenVisible.length}; forbiddenSource=${result.forbiddenSource.length}`);
  }
  for (const smoke of navigationSmokes.filter(item => !item.passed)) {
    console.error(`- ${smoke.name}: labels=${smoke.requiredLabels.filter(item => item.matched).length}/${smoke.requiredLabels.length}; paths=${smoke.requiredPaths.filter(item => item.matched).length}/${smoke.requiredPaths.length}; missingBoardSections=${smoke.missingBoardSections.length}; missingRenderedSections=${smoke.missingRenderedSections.length}; forbiddenDeepLinks=${smoke.forbiddenDeepLinks.length}`);
    for (const token of smoke.forbiddenDeepLinks) console.error(`  forbidden: ${token}`);
  }
  process.exit(1);
}
