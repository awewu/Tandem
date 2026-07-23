#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ACTIVE_PAGES = new Set([
  'index.html',
  'index-ready.html',
  'privacy.html',
  'consent.html'
]);
const ACTIVE_PAGE_PATHS = [...ACTIVE_PAGES].map(page => `archive/legacy-ui/public/${page}`);
// Navigable production surfaces: real pages the工作入口 (D1 品牌管理 / D2 产品 /
// D4 客户与赋能) links to. They are allowed as link targets but are NOT held to
// the full active-page static-acceptance spec, so they are not added to
// FILES_TO_SCAN (no cascade). Registering them here clears the hub navigation
// while keeping each brand/product site an independent surface.
const NAVIGABLE_SURFACES = new Set([
  'login.html',            // legacy auth compatibility target
  'staff-portal.html',     // legacy staff portal compatibility target
  'index-ready.html',        // 集团官网 (D1)
  'rheem-platform-v3.html',  // Rheem 中国站 (D1)
  'four-brand-demo.html',    // Ruud 中国站 / 品牌矩阵 (D1)
  'products.html'            // 产品中心 (D2)
]);
const PRODUCTION_SHARED_FILES = [];
const FILES_TO_SCAN = [...ACTIVE_PAGE_PATHS, ...PRODUCTION_SHARED_FILES];
const REACT_NAVIGATION_FILES = {
  hub: 'apps/dealer-workbench/src/app/hub/page.tsx',
  dealerNav: 'apps/dealer-workbench/src/components/DealerNav.tsx'
};
const REQUIRED_HUB_MODULE_KEYS = [
  'brand-console',
  'growth',
  'product',
  'public',
  'comfort',
  'accounts'
];
const HIDDEN_HUB_MODULE_KEYS = [
  'diagnosis',
  'crm',
  'bim',
  'bim-deepen',
  'nexus-ops',
  'customer'
];
const HIDDEN_HUB_PATHS = [
  '/crm',
  '/design',
  '/bim',
  '/projects',
  '/analytics',
  '/finance',
  '/aftersales',
  '/team',
  '/dashboard',
  '/enablement'
];
const REQUIRED_DEALER_NAV_HREFS = [
  '/products',
  '/brand',
  '/accounts'
];
const HIDDEN_DEALER_NAV_HREFS = [
  '/dashboard',
  '/crm',
  '/design',
  '/bim',
  '/bim/deepen-queue',
  '/bim/artifacts',
  '/projects',
  '/analytics',
  '/finance',
  '/aftersales',
  '/team',
  '/mobile'
];
const ALLOWED_STATIC_PREFIXES = [
  '/css/',
  '/images/',
  '/js/',
  '/shared/',
  '/everhot/',   // Everhot 恒热官网 (D1) — 完整子站目录
  '/favicon.ico',
  '/manifest.json',
  '/icon-192.png',
  '/inline-styles-refactored.css',
  '/dual-brand.css'
];
const failures = [];

function read(file) {
  try {
    return fs.readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

function isAllowedRef(ref) {
  if (!ref) return true;
  if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(ref)) return true;
  if (ref.startsWith('${')) return true;
  if (ref === '/') return true;
  if (ALLOWED_STATIC_PREFIXES.some(prefix => ref.startsWith(prefix))) return true;

  const pathOnly = ref.split('#')[0].split('?')[0].replace(/^\//, '');
  if (!pathOnly) return true;
  const base = path.basename(pathOnly);
  if (ACTIVE_PAGES.has(base)) return true;
  if (NAVIGABLE_SURFACES.has(base)) return true;

  return false;
}

for (const page of FILES_TO_SCAN) {
  const html = read(page);
  const regex = /\b(?:href|src)\s*=\s*["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html))) {
    const ref = match[1];
    if (!isAllowedRef(ref)) failures.push(`${page}: active navigation references non-active surface ${ref}`);
  }
}

const hubSource = read(REACT_NAVIGATION_FILES.hub);
const dealerNavSource = read(REACT_NAVIGATION_FILES.dealerNav);

for (const key of REQUIRED_HUB_MODULE_KEYS) {
  if (!hubSource.includes(`key: '${key}'`)) {
    failures.push(`${REACT_NAVIGATION_FILES.hub}: retained hub module key is missing: ${key}`);
  }
}

for (const key of HIDDEN_HUB_MODULE_KEYS) {
  if (hubSource.includes(`key: '${key}'`)) {
    failures.push(`${REACT_NAVIGATION_FILES.hub}: hidden Phase 1 module is still visible: ${key}`);
  }
}

for (const hiddenPath of HIDDEN_HUB_PATHS) {
  if (hubSource.includes(`path: '${hiddenPath}'`)) {
    failures.push(`${REACT_NAVIGATION_FILES.hub}: hidden Phase 1 hub path is still visible: ${hiddenPath}`);
  }
}

for (const href of REQUIRED_DEALER_NAV_HREFS) {
  if (!dealerNavSource.includes(`href: '${href}'`)) {
    failures.push(`${REACT_NAVIGATION_FILES.dealerNav}: retained workbench nav href is missing: ${href}`);
  }
}

for (const href of HIDDEN_DEALER_NAV_HREFS) {
  if (dealerNavSource.includes(`href: '${href}'`)) {
    failures.push(`${REACT_NAVIGATION_FILES.dealerNav}: hidden Phase 1 nav href is still visible: ${href}`);
  }
}

console.log(`Active Navigation Check: files = ${FILES_TO_SCAN.length}, failures = ${failures.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
