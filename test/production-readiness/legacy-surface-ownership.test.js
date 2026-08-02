const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('legacy surface ownership evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/legacy-surface-ownership-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('assigns every public HTML surface to an owner, action, target, and evidence gate', () => {
    const report = readJson('audit/legacy-surface-ownership-report.json');

    expect(report.summary.publicHtml).toBe(report.summary.manifestRows);
    expect(report.summary.ownerCoverage).toBe(report.summary.manifestRows);
    expect(report.summary.evidenceCoverage).toBe(report.summary.manifestRows);
    expect(report.summary.activeSurfaces).toBe(0);
    expect(report.summary.nonActiveGovernedAssets).toBe(report.summary.publicHtml);
    expect(report.summary.failures).toBe(0);
    expect(report.summary.warnings).toBe(0);
    expect(report.failures).toEqual([]);
    expect(report.warnings).toEqual([]);

    for (const surface of report.surfaces) {
      expect(surface.ownerAgent).toEqual(expect.any(String));
      expect(surface.domain).toEqual(expect.any(String));
      expect(surface.action).toEqual(expect.any(String));
      expect(surface.targetSurface).toEqual(expect.any(String));
      expect(surface.nextAction).toEqual(expect.any(String));
      expect(surface.replacementEvidence.length).toBeGreaterThanOrEqual(3);
      expect(surface.deletionGate).toEqual(expect.arrayContaining(report.policy.deletionGate));
      expect(surface.ownerAssignmentSource).not.toBe('fallback');
      expect(surface.deletionSafe).toBe(false);
    }
  });

  test('keeps every archived legacy asset under a non-active action', () => {
    const report = readJson('audit/legacy-surface-ownership-report.json');
    const active = report.surfaces.filter(surface => surface.manifestBucket === 'active');
    const nonActive = report.surfaces.filter(surface => surface.manifestBucket !== 'active');

    expect(active).toHaveLength(0);
    expect(nonActive).toHaveLength(report.summary.nonActiveGovernedAssets);
    expect(nonActive.every(surface => surface.action !== 'active')).toBe(true);
    expect(nonActive.map(surface => surface.migrationStatus)).toEqual(expect.arrayContaining([
      'migrate-owner-assigned',
      'archived-reference-guarded'
    ]));
  });

  test('production guard scripts include legacy surface ownership in both visual and nonvisual gates', () => {
    const pkg = readJson('package.json');

    expect(pkg.scripts['guard:legacy-surface-ownership']).toBe(
      'node scripts/agent-guards/legacy-surface-ownership-check.js'
    );
    expect(pkg.scripts['guard:all']).toContain('guard:legacy-surface-ownership');
    expect(pkg.scripts['guard:all:nonvisual']).toContain('guard:legacy-surface-ownership');
  });
});
