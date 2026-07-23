#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extractApiCalls } = require('../lib/apiContractAnalysis');
const { getProductionMountPrefixes, normalizeRoutePath } = require('../lib/routeMountAnalysis');
const { ROUTE_OWNERSHIP, ROUTE_FILE_OWNERSHIP } = require('../../server/modules/routeOwnership');

const ROOT = path.join(__dirname, '..', '..');
const SPEC_PATH = path.join(ROOT, 'contracts/openapi/rhautt-nexus-v2.openapi.json');
const SERVER_PRODUCTION = path.join(ROOT, 'server-production.js');
const ACTIVE_PAGES = [
  'archive/legacy-ui/public/index.html',
  'archive/legacy-ui/public/index-ready.html',
  'archive/legacy-ui/public/privacy.html',
  'archive/legacy-ui/public/consent.html'
];
const PRODUCTION_SHARED_FILES = [];
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const failures = [];
const warnings = [];

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
    if (['.git', 'node_modules', 'dist', 'build', 'coverage', 'backups', 'archive', '_archive'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else files.push(file);
  }
  return files;
}

function joinRoute(prefix, routePath) {
  if (!prefix || prefix === '/') return normalizeRoutePath(routePath);
  if (routePath === '/') return normalizeRoutePath(prefix);
  return normalizeRoutePath(prefix.replace(/\/$/, '') + '/' + routePath.replace(/^\//, ''));
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

function specRegexes() {
  const spec = JSON.parse(fs.readFileSync(SPEC_PATH, 'utf8'));
  return Object.entries(spec.paths || {}).flatMap(([routePath, item]) => (
    Object.keys(item)
      .filter(method => HTTP_METHODS.has(method))
      .map(method => ({
        method: method.toUpperCase(),
        routePath,
        regex: routePatternToRegex(routePath)
      }))
  ));
}

function isInOpenApi(call, openApiRegexes) {
  if (!call.path.startsWith('/api/v2/')) return true;
  return openApiRegexes.some(({ routePath, regex }) => (
    regex.test(call.path) ||
    (
      call.dynamicPrefix &&
      routePath.startsWith(`${call.path}/`) &&
      /\{[A-Za-z0-9_]+\}/.test(routePath.slice(call.path.length))
    )
  ));
}

function main() {
  if (!fs.existsSync(SPEC_PATH)) failures.push('missing OpenAPI spec for frontend API contract check');

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
  const openApiRegexes = failures.length ? [] : specRegexes();

  const activeCalls = ACTIVE_PAGES
    .map(file => path.join(ROOT, file))
    .filter(file => fs.existsSync(file))
    .flatMap(file => extractApiCalls(file, { relativeFile: rel }));
  const sharedCalls = PRODUCTION_SHARED_FILES
    .map(file => path.join(ROOT, file))
    .filter(file => fs.existsSync(file))
    .flatMap(file => extractApiCalls(file, { relativeFile: rel }));
  const productionCalls = [...activeCalls, ...sharedCalls];

  for (const call of productionCalls.filter(call => !isMatched(call, routeRegexes))) {
    failures.push(`active production API call is not matched by route catalog: ${call.file}:${call.line} ${call.path}`);
  }

  for (const call of productionCalls.filter(call => !isInOpenApi(call, openApiRegexes))) {
    failures.push(`active production /api/v2 call is missing from OpenAPI: ${call.file}:${call.line} ${call.path}`);
  }

  const reactServiceCalls = jsFiles
    .filter(file => rel(file).startsWith('src/services/'))
    .flatMap(file => extractApiCalls(file, { relativeFile: rel }));
  const reactV2Calls = reactServiceCalls.filter(call => call.path.startsWith('/api/v2/'));
  const reactV2Missing = reactV2Calls.filter(call => !isInOpenApi(call, openApiRegexes));
  if (reactV2Missing.length) {
    failures.push(...reactV2Missing.map(call => `React candidate /api/v2 call missing from OpenAPI: ${call.file}:${call.line} ${call.path}`));
  }

  if (reactServiceCalls.length) {
    warnings.push(`React service layer remains candidate surface with ${reactServiceCalls.length} API calls`);
  }

  console.log(`Frontend API Contract Check: activeCalls = ${activeCalls.length}, sharedCalls = ${sharedCalls.length}, reactServiceCalls = ${reactServiceCalls.length}, failures = ${failures.length}, warnings = ${warnings.length}`);

  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  for (const warning of warnings) console.warn(`- ${warning}`);
}

main();
