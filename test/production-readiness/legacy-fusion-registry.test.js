const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('legacy fusion registry evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['audit/product-consolidation-harness.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
    execFileSync(process.execPath, ['audit/legacy-fusion-harness.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('keeps current orphan engine debt separate from resolved historical entries', () => {
    const consolidation = readJson('audit/product-consolidation-report.json');
    const registry = readJson('audit/legacy-fusion-registry.json');
    const report = readJson('audit/legacy-fusion-report.json');

    const orphanFiles = new Set(
      consolidation.consolidation.productionOrphanEngines.map(engine => engine.file)
    );
    const activeRegistryFiles = Object.keys(registry.engineAssets);
    const resolvedRegistryFiles = Object.keys(registry.resolvedEngineAssets);

    expect(report.summary.failures).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.summary.orphanEngines).toBe(orphanFiles.size);
    expect(report.summary.registeredEngineAssets).toBe(activeRegistryFiles.length);
    expect(report.summary.registeredEngineAssets).toBe(orphanFiles.size);
    expect(report.summary.resolvedEngineAssets).toBe(resolvedRegistryFiles.length);
    expect(resolvedRegistryFiles.length).toBeGreaterThan(0);

    for (const file of activeRegistryFiles) {
      expect(orphanFiles.has(file)).toBe(true);
    }
    for (const file of resolvedRegistryFiles) {
      expect(orphanFiles.has(file)).toBe(false);
      expect(registry.resolvedEngineAssets[file].resolvedStatus).toBe('no-longer-production-orphan');
      expect(registry.resolvedEngineAssets[file].resolutionEvidence).toEqual(expect.arrayContaining([
        'audit/product-consolidation-report.json',
        'audit/legacy-fusion-report.json'
      ]));
    }
  });
});
