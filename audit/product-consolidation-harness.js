#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extractApiCalls } = require('../scripts/lib/apiContractAnalysis');
const {
  getProductionMountPrefixes,
  joinRoute,
  normalizeRoutePath
} = require('../scripts/lib/routeMountAnalysis');
const {
  ROUTE_FILE_OWNERSHIP,
  ROUTE_OWNERSHIP,
  getRouteOwnerForRoute
} = require('../server/modules/routeOwnership');
const {
  PHASE1_BACKEND_CLEANUP_MATRIX
} = require('../server/modules/productionRouteCatalog');

const ROOT = path.join(__dirname, '..');
const SERVER_PRODUCTION = path.join(ROOT, 'server-production.js');
const REPORT_JSON = path.join(__dirname, 'product-consolidation-report.json');
const REPORT_MD = path.join(__dirname, 'product-consolidation-report.md');

const ACTIVE_PAGES = [
  'archive/legacy-ui/public/index.html',
  'archive/legacy-ui/public/index-ready.html',
  'archive/legacy-ui/public/privacy.html',
  'archive/legacy-ui/public/consent.html'
];

const RETAINED_API_CALLS = [
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/auth/login'],
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/auth/me'],
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/auth/admin/users'],
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/product-catalog/devices'],
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/brand'],
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/brand/sync'],
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/brand-sites'],
  ['apps/dealer-workbench/src/lib/api.ts', '/api/v2/brand-sites/:id/logo'],
  ['apps/nexus-console/src/components/DamLibraryManager.tsx', '/api/v2/file-artifact/upload-base64'],
  ['apps/nexus-console/src/components/DamLibraryManager.tsx', '/api/v2/product-catalog/devices'],
  ['apps/nexus-console/src/components/BrandPublishManager.tsx', '/api/v2/product-catalog/content/publish-due'],
  ['apps/nexus-console/src/components/GeoAnalyzer.tsx', '/api/v2/growth/geo/probe'],
  ['apps/brand-console/src/app/api/publish/route.ts', '/api/v2/product-catalog/content/publish-due']
];

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function walk(dir, files = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', 'backups', 'archive', '_archive'].includes(entry.name)) {
      continue;
    }
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else files.push(file);
  }
  return files;
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function extractRoutes(file, mountPrefix = '') {
  const content = read(file);
  const routes = [];
  const routeRegex = /\b(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g;
  let match;

  while ((match = routeRegex.exec(content))) {
    const localPath = normalizeRoutePath(match[3]);
    routes.push({
      file: rel(file),
      method: match[2].toUpperCase(),
      path: joinRoute(match[1] === 'router' ? mountPrefix : '', localPath),
      localPath,
      line: lineForIndex(content, match.index)
    });
  }
  return routes;
}

function effectiveRoutePath(route) {
  if (route.file === 'server-production.js') return route.path;
  if (route.path.startsWith('/api/') || route.path === '/health') return route.path;

  const byFile = ROUTE_FILE_OWNERSHIP.find(entry => entry.file === route.file);
  if (!byFile || byFile.mountPrefix === '/') return route.path;
  return joinRoute(byFile.mountPrefix, route.localPath || route.path);
}

function routePatternToRegex(routePath) {
  const escaped = routePath
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{[A-Za-z0-9_]+\\\}/g, '[^/]+')
    .replace(/:([A-Za-z0-9_]+)/g, '[^/]+');
  return new RegExp('^' + escaped + '$');
}

function isOwnedProductionRoute(call) {
  return ROUTE_OWNERSHIP.some(entry => (
    entry.prefix !== '/' &&
    (call.path === entry.prefix || call.path.startsWith(`${entry.prefix}/`))
  ));
}

function isMatched(call, routeRegexes) {
  if (!call.path) return true;
  if (routeRegexes.some(({ regex }) => regex.test(call.path))) return true;
  if (isOwnedProductionRoute(call)) return true;
  if (!call.dynamicPrefix) return false;
  return routeRegexes.some(({ route }) => (
    route.effectivePath === call.path ||
    route.effectivePath.startsWith(`${call.path}/:`)
  ));
}

function retainedCall(file, apiPath) {
  const absolute = path.join(ROOT, file);
  const content = read(absolute);
  const index = content.indexOf(apiPath.replace('/:id', ''));
  return {
    file,
    kind: 'retained-contract',
    method: 'UNKNOWN',
    raw: apiPath,
    path: normalizeRoutePath(apiPath),
    dynamicPrefix: apiPath.includes(':'),
    line: index >= 0 ? lineForIndex(content, index) : 1
  };
}

function main() {
  const allFiles = walk(ROOT);
  const jsFiles = allFiles.filter(file => /\.(js|jsx|ts|tsx|cjs|mjs)$/.test(file));
  const routeSourceFiles = [
    SERVER_PRODUCTION,
    ...jsFiles.filter(file => {
      const r = rel(file);
      return r.startsWith('server/routes/') || r.startsWith('server/modules/');
    })
  ].filter(file => fs.existsSync(file));

  const mountPrefixes = getProductionMountPrefixes({ root: ROOT, entryFile: SERVER_PRODUCTION }).byFile;
  const productionMountedFiles = new Set(['server-production.js', ...mountPrefixes.keys()]);
  const routes = routeSourceFiles.flatMap(file => {
    const fileRel = rel(file);
    if (fileRel !== 'server-production.js' && !productionMountedFiles.has(fileRel)) return [];
    const prefixes = mountPrefixes.get(fileRel);
    if (prefixes && prefixes.length) return prefixes.flatMap(prefix => extractRoutes(file, prefix));
    return extractRoutes(file);
  }).map(route => ({
    ...route,
    effectivePath: effectiveRoutePath(route)
  }));

  const routeRegexes = routes.map(route => ({ route, regex: routePatternToRegex(route.effectivePath) }));
  const routeGroups = new Map();
  for (const route of routes) {
    const key = `${route.method} ${route.effectivePath}`;
    const group = routeGroups.get(key) || [];
    group.push(route);
    routeGroups.set(key, group);
  }

  const duplicateRouteGroups = [...routeGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, routes: group }));

  const ownedRoutes = routes.map(route => ({
    ...route,
    owner: getRouteOwnerForRoute({ ...route, path: route.effectivePath })
  }));
  const unassignedRouteGroups = ownedRoutes
    .filter(route => route.owner.owner === 'unassigned')
    .map(route => ({
      method: route.method,
      path: route.effectivePath,
      file: route.file,
      line: route.line
    }));

  const extractedActiveCalls = ACTIVE_PAGES
    .map(file => path.join(ROOT, file))
    .filter(file => fs.existsSync(file))
    .flatMap(file => extractApiCalls(file, { relativeFile: rel }));
  const retainedCalls = RETAINED_API_CALLS.map(([file, apiPath]) => retainedCall(file, apiPath));
  const activeFrontendApiCalls = [...extractedActiveCalls, ...retainedCalls];
  const unmatchedActiveFrontendApiCalls = activeFrontendApiCalls.filter(call => !isMatched(call, routeRegexes));

  const summary = {
    activePages: ACTIVE_PAGES.filter(file => fs.existsSync(path.join(ROOT, file))).length,
    routeDefinitions: routes.length,
    duplicateRouteGroups: duplicateRouteGroups.length,
    unassignedRouteGroups: unassignedRouteGroups.length,
    activeFrontendApiCalls: activeFrontendApiCalls.length,
    unmatchedActiveFrontendApiCalls: unmatchedActiveFrontendApiCalls.length,
    reactServiceApiCalls: retainedCalls.length,
    unmatchedReactServiceApiCalls: unmatchedActiveFrontendApiCalls.filter(call => call.kind === 'retained-contract').length
  };

  const report = {
    generatedAt: new Date().toISOString(),
    summary,
    routeMounts: [...mountPrefixes.entries()].map(([file, prefixes]) => ({ file, prefixes })),
    routes: ownedRoutes,
    duplicateRouteGroups,
    unassignedRouteGroups,
    activeFrontendApiCalls,
    unmatchedActiveFrontendApiCalls,
    phase1BackendCleanupMatrix: PHASE1_BACKEND_CLEANUP_MATRIX,
    consolidation: {
      productionOrphanEngines: []
    }
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD, [
    '# Product Consolidation Route Surface',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Active pages: ${summary.activePages}`,
    `- Route definitions: ${summary.routeDefinitions}`,
    `- Duplicate route groups: ${summary.duplicateRouteGroups}`,
    `- Unassigned route groups: ${summary.unassignedRouteGroups}`,
    `- Active frontend API calls: ${summary.activeFrontendApiCalls}`,
    `- Unmatched active frontend API calls: ${summary.unmatchedActiveFrontendApiCalls}`,
    '',
    '## Phase 1 Backend Cleanup Matrix',
    '',
    ...PHASE1_BACKEND_CLEANUP_MATRIX.map(item => (
      `- ${item.category}: ${item.id} (${item.action})`
    )),
    ''
  ].join('\n'));

  console.log(`Product Consolidation Harness: routes = ${summary.routeDefinitions}, activeCalls = ${summary.activeFrontendApiCalls}, duplicates = ${summary.duplicateRouteGroups}, unassigned = ${summary.unassignedRouteGroups}, unmatched = ${summary.unmatchedActiveFrontendApiCalls}`);
}

main();
