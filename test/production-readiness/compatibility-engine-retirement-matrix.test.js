const fs = require('fs');
const path = require('path');
const { namespaceMatchesModule } = require('../../scripts/lib/apiModuleNamespaces');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('compatibility engine retirement matrix evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/compatibility-engine-retirement-matrix-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('maps every current orphan engine to target modules, evidence, and retirement gates', () => {
    const report = readJson('evidence/architecture/compatibility-engine-retirement-matrix.json');

    expect(report.platform).toBe('Rhautt Nexus / 瑞合数智枢纽');
    expect(report.status).toBe('pass-engine-retirement-matrix-not-deletion-safe');
    expect(report.nonCompletionRule).toContain('not deletion approval');
    expect(report.nonCompletionRule).toContain('not NestJS/Fastify runtime proof');
    expect(report.nonCompletionRule).toContain('not implementation completion proof');
    expect(report.deletionSafe).toBe(false);
    expect(report.runtimeReplacementProof).toBe(false);
    expect(report.finalRetirementProof).toBe(false);
    expect(report.matrixSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.failures).toEqual([]);
    expect(report.warnings).toEqual([]);

    expect(report.summary.currentOrphanEngines).toBe(report.engines.length);
    expect(report.summary.currentOrphanEngines).toBeGreaterThanOrEqual(14);
    expect(report.summary.currentOrphanEngineLines).toBeGreaterThan(1000);
    expect(report.summary.resolvedHistoricalEngines).toBeGreaterThan(0);
    expect(report.summary.actionCounts).toEqual(expect.objectContaining({
      migrate: expect.any(Number),
      wrap: expect.any(Number),
      archive: expect.any(Number),
      retire: expect.any(Number)
    }));
    expect(report.summary.priorityCounts).toEqual(expect.objectContaining({
      P0: expect.any(Number),
      P1: expect.any(Number),
      P2: expect.any(Number)
    }));
    expect(report.summary.targetApiModules).toEqual(expect.arrayContaining([
      'auth',
      'tenant',
      'crm',
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

    for (const engine of report.engines) {
      expect(engine.file).toMatch(/^server\/core\//);
      expect(engine.lines).toBeGreaterThan(0);
      expect(engine.productionRefs).toBe(0);
      expect(engine.ownerAgent).toEqual(expect.any(String));
      expect(engine.registryAction).toMatch(/^(migrate|wrap|archive|retire)$/);
      expect(engine.priority).toMatch(/^P[0-2]$/);
      expect(engine.requiredRetirementGates).toEqual(expect.arrayContaining(report.requiredRetirementGates));
      expect(engine.replacementEvidence.length).toBeGreaterThanOrEqual(6);
      expect(engine.deletionSafe).toBe(false);
      expect(engine.implementationComplete).toBe(false);
      expect(engine.runtimeReplacementProof).toBe(false);
      expect(engine.retirementProof).toBe(false);
      if (engine.apiRelevant) {
        expect(engine.targetApiModules.length).toBeGreaterThan(0);
        for (const moduleName of engine.targetApiModules) {
          expect(engine.targetApiNamespaces.some(namespace => namespaceMatchesModule(namespace, moduleName))).toBe(true);
        }
      }
    }
  });

  test('prioritizes largest and P0 engines without making them deletion-safe', () => {
    const report = readJson('evidence/architecture/compatibility-engine-retirement-matrix.json');
    const byFile = new Map(report.engines.map(engine => [engine.file, engine]));

    expect(byFile.get('server/core/Hammer.js')).toMatchObject({
      registryDomain: 'quality',
      registryAction: 'wrap',
      deletionSafe: false
    });
    expect(byFile.get('server/core/CRMSalesManager.js')).toMatchObject({
      registryDomain: 'crm',
      registryAction: 'migrate',
      priority: 'P0',
      deletionSafe: false
    });
    expect(byFile.get('server/core/ConstructionManager.js')).toMatchObject({
      registryDomain: 'delivery',
      registryAction: 'migrate',
      priority: 'P0',
      deletionSafe: false
    });
    expect(byFile.get('server/core/DataEncryption.js')).toMatchObject({
      registryDomain: 'security',
      registryAction: 'migrate',
      priority: 'P0',
      partialExtractionStatus: 'target-module-behavior-proven-not-deletion-safe',
      partialExtractionEvidence: expect.arrayContaining([
        'server/modules/security/crypto.service.js',
        'server/modules/crm/crm.service.js',
        'test/production-readiness/repository-and-crm.test.js'
      ]),
      deletionSafe: false
    });
    expect(byFile.get('server/core/CommercialTaxEngine.js')).toMatchObject({
      registryDomain: 'quote-cost',
      registryAction: 'migrate',
      priority: 'P0',
      partialExtractionStatus: 'target-module-behavior-proven-not-deletion-safe',
      partialExtractionEvidence: expect.arrayContaining([
        'server/modules/quotation/quotation.service.js',
        'test/production-readiness/quotation-v2-persistence.test.js'
      ]),
      deletionSafe: false
    });
    expect(byFile.get('server/core/QuoteEngine.js')).toMatchObject({
      registryDomain: 'quote-cost',
      registryAction: 'migrate',
      priority: 'P0',
      partialExtractionStatus: 'target-module-behavior-proven-not-deletion-safe',
      partialExtractionEvidence: expect.arrayContaining([
        'server/modules/quotation/quotation.service.js',
        'test/production-readiness/quotation-v2-persistence.test.js'
      ]),
      deletionSafe: false
    });
    expect(byFile.get('server/core/UnifiedDatabase.js')).toMatchObject({
      registryDomain: 'shared-platform',
      registryAction: 'retire',
      deletionSafe: false
    });
    expect(byFile.get('server/core/ChinaClimateDB.js')).toMatchObject({
      registryDomain: 'standards-calculation',
      registryAction: 'migrate',
      priority: 'P0',
      partialExtractionStatus: 'reference-dataset-identified-not-deletion-safe',
      partialExtractionEvidence: expect.arrayContaining([
        'server/core/ChinaClimateDB.js',
        'docs/_archive/COMFORT-HOME-STANDARDS-MATRIX.md',
        'server/modules/system-packs/system-packs.service.js',
        'test/production-readiness/system-packs.test.js'
      ]),
      deletionSafe: false
    });
    expect(byFile.get('server/core/HydraulicEngine.js')).toMatchObject({
      registryDomain: 'standards-calculation',
      registryAction: 'migrate',
      priority: 'P0',
      partialExtractionStatus: 'reference-algorithm-identified-not-deletion-safe',
      partialExtractionEvidence: expect.arrayContaining([
        'server/core/HydraulicEngine.js',
        'docs/_archive/COMFORT-HOME-STANDARDS-MATRIX.md',
        'server/routes/rysnova-bim.js',
        'server/routes/smart-routing.js',
        'server/modules/system-packs/system-packs.service.js',
        'test/production-readiness/system-packs.test.js'
      ]),
      deletionSafe: false
    });
  });

  test('wires compatibility engine matrix into visual and nonvisual production guards', () => {
    const pkg = readJson('package.json');

    expect(pkg.scripts['guard:compat-engine-matrix']).toBe(
      'node scripts/agent-guards/compatibility-engine-retirement-matrix-check.js'
    );
    expect(pkg.scripts['guard:all']).toContain('guard:compat-engine-matrix');
    expect(pkg.scripts['guard:all:nonvisual']).toContain('guard:compat-engine-matrix');
  });
});
