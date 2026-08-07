#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { PRODUCTION_ROUTE_CATALOG, getProductionRouteCatalogMountMetadata } = require('../../server/modules/productionRouteCatalog');

const failures = [];
const warnings = [];
const VALID_STATUSES = new Set(['production', 'production-candidate', 'legacy-compat']);
// 止于售前边界（charter §1.2 / §5.3 冻结册）：交付执行（engineering-delivery：
// delivery·contracts·dispatch）与运维/售后（comfort-home-domain 内的 lifecycle-iot·
// aftersales）已冻结，其生产路由组已从 PRODUCTION_ROUTE_CATALOG 中移出。故门禁不再
// 要求这两个冻结域存在——留在必需域清单里会强迫重新挂载冻结项，违反宪章边界。
// 保留 lifecycle-iot-front-office（售前前台生命周期，非冻结的终身运维）。
const REQUIRED_DOMAINS = [
  // 'quote-calculation' 已于退场波2a(2026-08-06)移出：报价/计算属"客户赋能"独立产品线(D5)，
  // 不再要求营销中台生产入口挂载。
  'lifecycle-iot-front-office',
  'admin-governance',
  'platform-core'
];

function read(relativePath) {
  try {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  } catch {
    return '';
  }
}

for (const group of PRODUCTION_ROUTE_CATALOG) {
  if (!group.id) failures.push('route catalog group missing id');
  if (!group.domain) failures.push(`${group.id}: missing domain`);
  if (!group.owner) failures.push(`${group.id}: missing owner`);
  if (!VALID_STATUSES.has(group.status)) failures.push(`${group.id}: invalid status ${group.status}`);
  if (!Array.isArray(group.routes) || group.routes.length === 0) failures.push(`${group.id}: missing routes`);

  for (const route of group.routes || []) {
    if (!route.id) failures.push(`${group.id}: route missing id`);
    if (!route.modulePath && !route.middleware) failures.push(`${group.id}/${route.id}: missing modulePath or middleware`);
    if (route.modulePath && route.middleware) failures.push(`${group.id}/${route.id}: route cannot declare both modulePath and middleware`);
    if (route.status && !VALID_STATUSES.has(route.status)) failures.push(`${group.id}/${route.id}: invalid status ${route.status}`);
  }
}

const domains = new Set(PRODUCTION_ROUTE_CATALOG.map(group => group.domain));
for (const domain of REQUIRED_DOMAINS) {
  if (!domains.has(domain)) failures.push(`route catalog missing required domain: ${domain}`);
}

const registrarSource = read('server/modules/productionRouteRegistrar.js');
const directUseCount = (registrarSource.match(/\bapp\.use\s*\(/g) || []).length;
if (directUseCount > 0) {
  failures.push(`productionRouteRegistrar.js contains ${directUseCount} direct app.use calls; use productionRouteCatalog instead`);
}

const metadata = getProductionRouteCatalogMountMetadata();
const keys = new Map();
for (const entry of metadata) {
  const key = `${entry.prefix} ${entry.modulePath}`;
  if (!keys.has(key)) keys.set(key, []);
  keys.get(key).push(entry);
}
for (const [key, hits] of keys.entries()) {
  if (hits.length > 1 && !key.includes('../routes/reports')) {
    warnings.push(`duplicate catalog mount metadata: ${key}`);
  }
}

console.log(`Route Catalog Boundary Check: groups = ${PRODUCTION_ROUTE_CATALOG.length}, mounts = ${metadata.length}, failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
