#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PRODUCTION_ROUTE_CATALOG } = require('../../server/modules/productionRouteCatalog');
const { namespaceMatchesModule } = require('../lib/apiModuleNamespaces');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = 'contracts/architecture/production-route-target-module-map.json';
const MODULE_BOUNDARY_PATH = 'services/api/src/modules/module-boundary.ts';
const REPORT_JSON = 'evidence/architecture/production-route-target-map-report.json';
const REPORT_MD = 'evidence/architecture/production-route-target-map-report.md';

const failures = [];
const warnings = [];

function fullPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(fullPath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function fail(message) {
  failures.push(message);
  return false;
}

function routeKey(groupId, route) {
  return `${groupId}:${route.id}`;
}

function catalogRoutes() {
  return PRODUCTION_ROUTE_CATALOG.flatMap(group => (group.routes || []).map(route => ({
    key: routeKey(group.id, route),
    groupId: group.id,
    currentDomain: group.domain,
    currentStatus: route.status || group.status,
    owner: group.owner,
    id: route.id,
    prefix: route.prefix || '/',
    modulePath: route.modulePath || null,
    middleware: route.middleware || null,
    optional: Boolean(route.optional)
  })));
}

function contractRoutes(contract) {
  return (contract.routeGroups || []).flatMap(group => (group.routes || []).map(route => ({
    key: routeKey(group.groupId, route),
    groupId: group.groupId,
    currentDomain: group.currentDomain,
    currentStatus: route.currentStatus || group.currentStatus,
    ownerAgent: route.ownerAgent || group.ownerAgent,
    migrationAction: route.migrationAction || group.defaultMigrationAction,
    targetModules: route.targetModules || group.defaultTargetModules || [],
    targetApiNamespaces: route.targetApiNamespaces || [],
    id: route.id,
    prefix: route.prefix || '/',
    modulePath: route.modulePath || null,
    middleware: route.middleware || null
  })));
}

function moduleBoundaryNames() {
  const source = read(MODULE_BOUNDARY_PATH);
  const match = source.match(/export const apiModuleBoundary = \[([\s\S]*?)\] as const;/);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function renderMarkdown(report) {
  const lines = [
    '# Production Route Target Module Map Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    `Contract: \`${report.contract.path}\``,
    '',
    `Contract SHA-256: \`${report.contract.sha256}\``,
    '',
    `Catalog routes: ${report.summary.catalogRoutes}`,
    '',
    `Mapped routes: ${report.summary.mappedRoutes}`,
    '',
    `Target modules referenced: ${report.summary.targetModulesReferenced}`,
    '',
    `Deletion safe: ${report.deletionSafe}`,
    '',
    `Failures: ${report.failures.length}`,
    '',
    '## Group Coverage',
    '',
    '| Group | Catalog Routes | Mapped Routes | Action | Owner Agent |',
    '|---|---:|---:|---|---|'
  ];

  for (const group of report.groupCoverage) {
    lines.push(`| ${group.groupId} | ${group.catalogRoutes} | ${group.mappedRoutes} | ${group.defaultMigrationAction} | ${group.ownerAgent} |`);
  }

  lines.push(
    '',
    '## Route Coverage',
    '',
    '| Route Key | Current | Target Modules | Target Namespaces | Action |',
    '|---|---|---|---|---|'
  );
  for (const route of report.routes) {
    lines.push(`| ${route.key} | ${route.currentStatus} ${route.modulePath || route.middleware || ''} | ${route.targetModules.join(', ')} | ${route.targetApiNamespaces.join(', ')} | ${route.migrationAction} |`);
  }

  if (report.failures.length) {
    lines.push('', '## Failures', '');
    for (const failure of report.failures) lines.push(`- ${failure}`);
  }

  lines.push(
    '',
    '## Policy',
    '',
    '- Every production route catalog mount, including middleware-only mounts, must map to at least one target NestJS/Fastify module.',
    '- Legacy compatibility routes are not deletion-safe until dependencies are installed, boot smoke passes, OpenAPI/generated client coverage exists, behavior tests pass, and rollback notes reference the removed route.',
    '- This report is replacement intent and boundary evidence, not runtime boot proof.',
    ''
  );

  return lines.join('\n');
}

function main() {
  if (!exists(CONTRACT_PATH)) fail(`missing ${CONTRACT_PATH}`);
  if (!exists(MODULE_BOUNDARY_PATH)) fail(`missing ${MODULE_BOUNDARY_PATH}`);
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  const contractSource = read(CONTRACT_PATH);
  const contract = JSON.parse(contractSource);
  const catalog = catalogRoutes();
  const mapped = contractRoutes(contract);
  const catalogByKey = new Map(catalog.map(route => [route.key, route]));
  const mappedByKey = new Map(mapped.map(route => [route.key, route]));
  const moduleNames = new Set(moduleBoundaryNames());

  if (contract.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    fail('route target map platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  if (contract.status !== 'target-route-migration-contract-not-runtime-proof') {
    fail('route target map must not claim runtime proof');
  }
  if (!String(contract.nonCompletionRule || '').includes('not NestJS/Fastify runtime boot proof')) {
    fail('route target map nonCompletionRule must state it is not runtime boot proof');
  }
  if (!Array.isArray(contract.requiredEvidenceBeforeRetiringLegacyRoute) || contract.requiredEvidenceBeforeRetiringLegacyRoute.length < 7) {
    fail('route target map must define required evidence before retiring legacy routes');
  }
  for (const token of [
    'target dependencies locked and installed',
    'NestJS/Fastify boot smoke passes',
    'OpenAPI contract covers replacement namespace',
    'generated client covers replacement call',
    'rollback note names the removed compatibility route'
  ]) {
    if (!contract.requiredEvidenceBeforeRetiringLegacyRoute.some(item => String(item).includes(token))) {
      fail(`requiredEvidenceBeforeRetiringLegacyRoute missing ${token}`);
    }
  }

  for (const route of catalog) {
    const match = mappedByKey.get(route.key);
    if (!match) {
      fail(`missing target module mapping for catalog route ${route.key}`);
      continue;
    }
    if (route.modulePath && match.modulePath !== route.modulePath) {
      fail(`${route.key}: modulePath mismatch contract=${match.modulePath} catalog=${route.modulePath}`);
    }
    if (route.middleware && match.middleware !== route.middleware) {
      fail(`${route.key}: middleware mismatch contract=${match.middleware} catalog=${route.middleware}`);
    }
    if ((match.prefix || '/') !== route.prefix) {
      fail(`${route.key}: prefix mismatch contract=${match.prefix || '/'} catalog=${route.prefix}`);
    }
    if (!match.ownerAgent) fail(`${route.key}: missing ownerAgent`);
    if (!match.migrationAction) fail(`${route.key}: missing migrationAction`);
    if (!Array.isArray(match.targetModules) || !match.targetModules.length) {
      fail(`${route.key}: missing targetModules`);
    }
    if (!Array.isArray(match.targetApiNamespaces) || !match.targetApiNamespaces.length) {
      fail(`${route.key}: missing targetApiNamespaces`);
    }
    for (const moduleName of match.targetModules || []) {
      if (!moduleNames.has(moduleName)) fail(`${route.key}: target module ${moduleName} is not in ${MODULE_BOUNDARY_PATH}`);
      const hasMatchingNamespace = (match.targetApiNamespaces || []).some(namespace => namespaceMatchesModule(namespace, moduleName));
      if (!hasMatchingNamespace) {
        fail(`${route.key}: target module ${moduleName} has no matching /api/v2 namespace`);
      }
    }
  }

  for (const route of mapped) {
    if (!catalogByKey.has(route.key)) warnings.push(`mapped route not present in production catalog: ${route.key}`);
  }

  const groupCoverage = PRODUCTION_ROUTE_CATALOG.map(group => {
    const mappedGroup = (contract.routeGroups || []).find(item => item.groupId === group.id);
    const catalogRouteCount = group.routes.length;
    const mappedRouteCount = mapped.filter(route => route.groupId === group.id).length;
    if (!mappedGroup) fail(`missing route group mapping: ${group.id}`);
    if (mappedRouteCount !== catalogRouteCount) {
      fail(`${group.id}: mapped route count ${mappedRouteCount} does not match catalog route count ${catalogRouteCount}`);
    }
    return {
      groupId: group.id,
      currentDomain: group.domain,
      catalogRoutes: catalogRouteCount,
      mappedRoutes: mappedRouteCount,
      defaultMigrationAction: mappedGroup?.defaultMigrationAction || null,
      ownerAgent: mappedGroup?.ownerAgent || null
    };
  });

  const targetModulesReferenced = [...new Set(mapped.flatMap(route => route.targetModules))].sort();
  const routes = mapped
    .filter(route => catalogByKey.has(route.key))
    .sort((a, b) => a.key.localeCompare(b.key));
  const report = {
    platform: contract.platform,
    generatedAt: new Date().toISOString(),
    status: failures.length ? 'blocked-route-target-map' : 'pass-target-route-migration-contract',
    deletionSafe: false,
    finalLaunchArchitectureProof: false,
    runtimeBootProof: false,
    contract: {
      path: CONTRACT_PATH,
      sha256: sha256(contractSource)
    },
    catalogSource: contract.catalogSource,
    targetModuleSource: contract.targetModuleSource,
    summary: {
      catalogRoutes: catalog.length,
      mappedRoutes: routes.length,
      targetModulesReferenced: targetModulesReferenced.length,
      warnings: warnings.length
    },
    targetModulesReferenced,
    groupCoverage,
    routes,
    warnings,
    failures,
    requiredEvidenceBeforeRetiringLegacyRoute: contract.requiredEvidenceBeforeRetiringLegacyRoute
  };

  fs.mkdirSync(fullPath(path.dirname(REPORT_JSON)), { recursive: true });
  fs.writeFileSync(fullPath(REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(fullPath(REPORT_MD), renderMarkdown(report));

  console.log(JSON.stringify({
    status: report.status,
    outputPath: REPORT_JSON,
    markdownPath: REPORT_MD,
    catalogRoutes: report.summary.catalogRoutes,
    mappedRoutes: report.summary.mappedRoutes,
    targetModulesReferenced: report.summary.targetModulesReferenced,
    failures
  }, null, 2));

  if (failures.length) process.exit(1);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (require.main === module) {
  main();
}
