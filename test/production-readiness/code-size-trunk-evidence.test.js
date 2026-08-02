const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('code size trunk evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/code-size-trunk-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('separates production runtime from legacy assets and generated evidence', () => {
    const report = readJson('audit/code-size-trunk-report.json');

    expect(report.status).toBe('pass-with-size-observations');
    expect(report.productionRuntimeLines).toBeGreaterThan(0);
    expect(report.productionRuntimeLines).toBeLessThan(report.totals.lines);
    expect(report.productionWebCoreLines).toBeGreaterThan(0);
    expect(report.productionWebCoreLines).toBeLessThanOrEqual(report.thresholds.warningProductionCountedLines);
    expect(report.productionCompatibilityRuntimeLines).toBeGreaterThan(0);
    expect(report.productionCompatibilityRuntimeLines).toBeLessThan(90000);
    expect(report.productionReachableCompatibilityLines).toBeGreaterThan(0);
    expect(report.productionReachableCompatibilityLines).toBeLessThan(15000);
    expect(report.productionReachableCompatibilityLines).toBeLessThan(report.productionCompatibilityRuntimeLines);
    expect(report.productionReachableCompatibilityFiles).toBeGreaterThan(0);
    expect(report.productionReachableCompatibilityFiles).toBeLessThan(40);
    expect(report.productionUnreachableCompatibilityInventoryLines).toBeGreaterThan(0);
    expect(report.productionUnreachableCompatibilityInventoryLines).toBeLessThan(report.productionCompatibilityRuntimeLines);
    expect(report.productionUnreachableCompatibilityInventoryFiles).toBeGreaterThan(0);
    expect(
      report.productionReachableCompatibilityLines + report.productionUnreachableCompatibilityInventoryLines
    ).toBe(report.productionCompatibilityRuntimeLines);
    expect(report.productionReachableRuntimeLines).toBeGreaterThan(report.productionEagerRuntimeLines);
    expect(report.productionReachableRuntimeLines).toBeLessThan(60000);
    expect(report.productionReachableRuntimeLines).toBeLessThan(report.productionRuntimeLines);
    expect(report.productionReachableRuntimeFiles).toBeGreaterThan(0);
    expect(report.productionReachableJsRuntimeLines).toBeGreaterThan(0);
    expect(report.productionReachableJsRuntimeLines).toBeLessThan(35000);
    expect(report.productionReachableJsRuntimeLines).toBeLessThanOrEqual(report.productionReachableRuntimeLines);
    expect(report.productionReachableJsRuntimeFiles).toBeGreaterThan(0);
    expect(report.productionEagerRuntimeLines).toBeLessThan(report.productionWebCoreLines);
    expect(report.productionEagerRuntimeLines).toBeLessThan(report.productionReachableRuntimeLines);
    expect(report.productionEagerRuntimeLines).toBeLessThan(20000);
    expect(report.productionReachableRuntimeLines - report.productionEagerRuntimeLines).toBeGreaterThan(10000);
    expect(report.productionEagerRuntimeFiles).toBeGreaterThan(10);
    expect(report.productionEagerRuntimeFiles).toBeLessThan(40);
    expect(report.productionEagerJsRuntimeLines).toBeGreaterThan(1000);
    expect(report.productionEagerJsRuntimeLines).toBeLessThan(5000);
    expect(report.productionEagerJsRuntimeFiles).toBeGreaterThan(10);
    expect(report.productionEagerJsRuntimeFiles).toBeLessThanOrEqual(report.productionEagerRuntimeFiles);
    expect(report.productionEagerRuntimeLines - report.productionEagerJsRuntimeLines).toBe(
      report.productionActivePageLines
    );
    expect(report.legacyDevServerReachableLines).toBeGreaterThan(report.productionEagerRuntimeLines);
    expect(report.legacyDevServerEagerLines).toBeGreaterThan(report.productionEagerRuntimeLines);
    expect(report.legacyDevServerEagerFiles).toBeGreaterThan(report.productionEagerRuntimeFiles);
    expect(report.productionRuntimeLines).toBe(
      report.productionWebCoreLines + report.productionCompatibilityRuntimeLines
    );
    expect(report.productionWebCoreLines).toBe(
      report.productionActivePageLines + report.productionTrunkLines
    );
    expect(report.legacyHtmlLines).toBe(0);
    expect(report.activeMismatch).toEqual([]);
    expect(report.sizeBudgetFailures).toEqual([]);
    expect(report.deliverySizeBudget).toEqual(expect.any(Array));
    expect(report.deliverySizeBudget.length).toBeGreaterThanOrEqual(6);
    for (const budget of report.deliverySizeBudget) {
      expect(budget.current).toBeLessThanOrEqual(budget.budget);
      expect(budget.status).toBe('pass');
      expect(budget.meaning).toEqual(expect.any(String));
    }
    expect(new Map(report.deliverySizeBudget.map(item => [item.metric, item])).get('productionEagerJsRuntimeLines')).toMatchObject({
      current: report.productionEagerJsRuntimeLines,
      budget: report.thresholds.maxProductionEagerJsRuntimeLines,
      status: 'pass'
    });

    expect(report.productionActivePageLines).toBe(0);
    expect(report.buckets['production-trunk'].lines).toBeGreaterThan(0);
    expect(report.buckets['production-compatibility-runtime'].lines).toBeGreaterThan(0);
    expect(report.buckets['generated-evidence'].lines).toBeGreaterThan(0);
    expect(report.buckets['archive-excluded'].lines).toBeGreaterThan(0);
    expect(report.buckets['data-fixtures'].lines).toBeGreaterThan(0);
  });

  test('largest generated and backup artifacts are not counted as production runtime code', () => {
    const report = readJson('audit/code-size-trunk-report.json');
    const byFile = new Map(report.topFiles.map(item => [item.file, item]));

    expect(byFile.get('evidence/sbom/rhautt-nexus-sbom.json').bucket).toBe('generated-evidence');
    expect(byFile.get('database/projects.json').bucket).toBe('data-fixtures');
    expect(byFile.get('test-data/200-user-scenarios.json').bucket).toBe('test-fixtures-and-tests');
  });

  test('compatibility inventory stays measurable without making retired engines mandatory', () => {
    const report = readJson('audit/code-size-trunk-report.json');
    const byFile = new Map(report.topFiles.map(item => [item.file, item]));

    expect(report.productionCompatibilityRuntimeLines).toBeGreaterThan(0);
    expect(report.productionEagerRuntimeLines).toBeLessThan(20000);
    expect(report.eagerRuntimeTopFiles.some(item => item.file === 'server/index.js')).toBe(false);
    expect(report.legacyDevServerEagerTopFiles.some(item => item.file === 'server/index.js')).toBe(true);
    expect(report.legacyDevServerEagerTopFiles.some(item => item.file === 'server/routes/products.js')).toBe(true);
    expect(report.eagerRuntimeTopFiles.some(item => item.file === 'server/core/WaterSystemEngine.js')).toBe(false);
    expect(report.productionUnreachableCompatibilityInventoryTopFiles).toEqual(expect.any(Array));
    expect(report.reachableRuntimeUnresolvedRequires).toEqual(expect.any(Array));
    expect(report.eagerRuntimeUnresolvedRequires).toEqual(expect.any(Array));
    expect(report.warnings).toContain(
      `production runtime lines exceed warning threshold: ${report.productionRuntimeLines}`
    );
  });
});
