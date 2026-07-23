const fs = require('fs');
const path = require('path');
const { namespaceMatchesModule } = require('../../scripts/lib/apiModuleNamespaces');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('legacy HTML migration matrix evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/legacy-html-migration-matrix-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('maps every retained public HTML surface to target apps, API modules, and deletion gates', () => {
    const report = readJson('evidence/architecture/legacy-html-migration-matrix.json');

    expect(report.platform).toBe('Rhautt Nexus / 瑞合数智枢纽');
    expect(report.status).toBe('pass-matrix-contract-not-deletion-safe');
    expect(report.nonCompletionRule).toContain('not production implementation proof');
    expect(report.nonCompletionRule).toContain('not deletion approval');
    expect(report.nonCompletionRule).toContain('not Next/Nest runtime proof');
    expect(report.deletionSafe).toBe(false);
    expect(report.runtimeReplacementProof).toBe(false);
    expect(report.finalMigrationProof).toBe(false);
    expect(report.matrixSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.failures).toEqual([]);

    expect(report.summary.totalSurfaces).toBe(
      report.summary.activeSurfaces + report.summary.nonActiveSurfaces
    );
    expect(report.summary.activeSurfaces).toBe(4);
    expect(report.summary.nonActiveSurfaces).toBe(report.summary.totalSurfaces - 4);
    expect(report.summary.migrationCandidates + report.summary.archiveAndStaticRetained).toBe(
      report.summary.nonActiveSurfaces
    );

    expect(report.summary.targetFrontendApps).toEqual(expect.arrayContaining([
      'public-portal',
      'consumer-diagnosis',
      'customer-portal',
      'dealer-workbench',
      'designer-workbench',
      'rysnova-bim-workbench',
      'legacy-reference-archive',
      'shared-platform-package'
    ]));

    expect(report.summary.targetApiModules).toEqual(expect.arrayContaining([
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

    for (const surface of report.surfaces) {
      expect(surface.ownerAgent).toEqual(expect.any(String));
      expect(surface.targetFrontendApps.length).toBeGreaterThan(0);
      expect(surface.targetCapability).toEqual(expect.any(String));
      expect(surface.requiredDeletionGates).toEqual(expect.arrayContaining(report.requiredDeletionGates));
      expect(surface.replacementEvidence.length).toBeGreaterThanOrEqual(6);
      expect(surface.deletionSafe).toBe(false);
      expect(surface.implementationComplete).toBe(false);
      expect(surface.runtimeReplacementProof).toBe(false);
      expect(surface.finalArchiveOrRetirementProof).toBe(false);
      if (surface.apiRelevant) {
        expect(surface.targetApiModules.length).toBeGreaterThan(0);
        for (const moduleName of surface.targetApiModules) {
          expect(surface.targetApiNamespaces.some(namespace => namespaceMatchesModule(namespace, moduleName))).toBe(true);
        }
      }
    }
  });

  test('preserves product boundaries for 瑞诺瓦 and Rysnova migration surfaces', () => {
    const report = readJson('evidence/architecture/legacy-html-migration-matrix.json');
    const rysnova = report.surfaces.filter(surface => surface.sourceDomain === 'rysnova-diagnosis');
    const rysnovaBim = report.surfaces.filter(surface => surface.sourceDomain === 'rysnova-bim');

    expect(rysnova.length).toBeGreaterThan(0);
    expect(rysnovaBim.length).toBeGreaterThan(0);
    expect(rysnova.every(surface => surface.targetFrontendApps.includes('consumer-diagnosis'))).toBe(true);
    expect(rysnova.every(surface => surface.targetApiModules.includes('diagnosis'))).toBe(true);
    expect(rysnova.some(surface => String(surface.standaloneProductBoundary || '').includes('瑞诺瓦'))).toBe(true);
    expect(rysnovaBim.every(surface => surface.targetFrontendApps.includes('rysnova-bim-workbench'))).toBe(true);
    expect(rysnovaBim.every(surface => surface.targetApiModules.includes('rysnova-bim'))).toBe(true);
    expect(rysnovaBim.some(surface => String(surface.standaloneProductBoundary || '').includes('Rysnova'))).toBe(true);
  });

  test('wires legacy migration matrix into visual and nonvisual production guards', () => {
    const pkg = readJson('package.json');

    expect(pkg.scripts['guard:legacy-migration-matrix']).toBe(
      'node scripts/agent-guards/legacy-html-migration-matrix-check.js'
    );
    expect(pkg.scripts['guard:all']).toContain('guard:legacy-migration-matrix');
    expect(pkg.scripts['guard:all:nonvisual']).toContain('guard:legacy-migration-matrix');
  });
});
