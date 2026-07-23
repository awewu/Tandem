const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { namespaceMatchesModule } = require('../../scripts/lib/apiModuleNamespaces');
const { PRODUCTION_ROUTE_CATALOG } = require('../../server/modules/productionRouteCatalog');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('production route to target module migration map', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/production-route-target-map-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('maps every production route catalog mount to target NestJS/Fastify modules', () => {
    const report = readJson('evidence/architecture/production-route-target-map-report.json');
    const catalogRouteCount = PRODUCTION_ROUTE_CATALOG.reduce((sum, group) => sum + group.routes.length, 0);

    expect(report.status).toBe('pass-target-route-migration-contract');
    expect(report.failures).toEqual([]);
    expect(report.deletionSafe).toBe(false);
    expect(report.finalLaunchArchitectureProof).toBe(false);
    expect(report.runtimeBootProof).toBe(false);
    expect(report.summary.catalogRoutes).toBe(catalogRouteCount);
    expect(report.summary.mappedRoutes).toBe(catalogRouteCount);
    expect(report.routes).toHaveLength(catalogRouteCount);
    expect(report.summary.targetModulesReferenced).toBe(15);
    expect(report.targetModulesReferenced).toEqual(expect.arrayContaining([
      'auth',
      'tenant',
      'crm',
      'diagnosis',
      'product-catalog',
      'quote',
      'design',
      'rysnova-bim',
      'delivery',
      'lifecycle',
      'analytics',
      'governance',
      'file-artifact',
      'notification',
      'workflow'
    ]));

    for (const route of report.routes) {
      expect(route.key).toMatch(/^[a-z0-9-]+:[a-z0-9-]+/);
      expect(route.ownerAgent).toEqual(expect.any(String));
      expect(route.migrationAction).toEqual(expect.any(String));
      expect(route.targetModules.length).toBeGreaterThan(0);
      expect(route.targetApiNamespaces.length).toBeGreaterThan(0);
      for (const moduleName of route.targetModules) {
        expect(route.targetApiNamespaces.some(namespace => namespaceMatchesModule(namespace, moduleName))).toBe(true);
      }
    }
  });

  test('keeps legacy route retirement evidence gates explicit', () => {
    const report = readJson('evidence/architecture/production-route-target-map-report.json');

    expect(report.requiredEvidenceBeforeRetiringLegacyRoute).toEqual(expect.arrayContaining([
      'target dependencies locked and installed',
      'NestJS/Fastify boot smoke passes',
      'OpenAPI contract covers replacement namespace',
      'generated client covers replacement call',
      'tenant isolation and audit behavior are tested',
      'E2E or contract test covers replacement route behavior',
      'production route catalog no longer mounts the legacy route',
      'rollback note names the removed compatibility route'
    ]));

    const replacementGroups = report.groupCoverage.filter(group => group.defaultMigrationAction === 'replace-with-target-module');
    expect(replacementGroups.map(group => group.groupId)).toEqual(expect.arrayContaining([
      'legacy-foundation',
      'quote-calculation',
      'engineering-delivery',
      'ai-channel',
      'pages-and-governance',
      'comfort-home-domain-runtime'
    ]));
  });

  test('wires route target map into guard gates', () => {
    const pkg = readJson('package.json');

    expect(pkg.scripts['guard:route-target-map']).toBe(
      'node scripts/agent-guards/production-route-target-map-check.js'
    );
    expect(pkg.scripts['guard:all']).toContain('guard:route-target-map');
    expect(pkg.scripts['guard:all:nonvisual']).toContain('guard:route-target-map');
  });
});
