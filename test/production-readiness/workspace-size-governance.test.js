const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('workspace size governance evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/workspace-size-governance-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('proves repository size is not production runtime size', () => {
    const report = readJson('audit/workspace-size-governance-report.json');

    expect(report.status).toBe('pass-with-repository-size-observations');
    expect(report.failures).toEqual([]);
    expect(report.workspace.totalScannedLines).toBeGreaterThan(report.production.reachableRuntimeLines);
    expect(report.workspace.totalScannedLines).toBeGreaterThan(report.production.eagerRuntimeLines);
    expect(report.workspace.linesOutsideReachableRuntime).toBeGreaterThan(0);
    expect(report.ratios.productionReachableRuntimeToWorkspace).toBeLessThan(0.1);
    expect(report.ratios.productionEagerRuntimeToWorkspace).toBeLessThan(0.05);
    expect(report.production.reachableCompatibilityLines).toBeLessThan(
      report.production.compatibilityInventoryLines
    );
    expect(report.observations.length).toBeGreaterThan(0);
    expect(report.requiredActions).toEqual(expect.arrayContaining([
      expect.stringContaining('Replace compatibility engines')
    ]));
    expect(report.bulkAssetGovernance).toEqual(expect.any(Array));
    expect(report.bulkAssetGovernance.map(item => item.bucket)).toEqual(expect.arrayContaining([
      'archive-excluded',
      'generated-evidence',
      'data-fixtures',
      'production-compatibility-runtime',
      'root-legacy-report'
    ]));
  });

  test('keeps production size budgets authoritative while repository observations are non-failing', () => {
    const report = readJson('audit/workspace-size-governance-report.json');
    const budgets = new Map(report.production.deliverySizeBudget.map(item => [item.metric, item]));

    expect(budgets.get('productionReachableRuntimeLines')).toMatchObject({ status: 'pass' });
    expect(budgets.get('productionEagerRuntimeLines')).toMatchObject({ status: 'pass' });
    expect(budgets.get('productionEagerJsRuntimeLines')).toMatchObject({ status: 'pass' });
    expect(report.majorBuckets.map(item => item.bucket)).toEqual(expect.arrayContaining([
      'production-reachable-runtime',
      'production-eager-runtime',
      'backup-excluded',
      'archive-excluded',
      'generated-evidence',
      'legacy-html'
    ]));
    for (const item of report.bulkAssetGovernance) {
      expect(item.owner).toEqual(expect.any(String));
      expect(item.retention).toEqual(expect.any(String));
      expect(item.migrationAction).toEqual(expect.any(String));
      expect(item.deletionGate).toEqual(expect.any(String));
      expect(item.targetEvidence).toEqual(expect.any(String));
      expect(item.files).toBeGreaterThan(0);
      expect(item.lines).toBeGreaterThan(0);
      expect(item.topFiles).toEqual(expect.any(Array));
    }
  });
});
