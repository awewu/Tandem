const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('production trunk isolation evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/production-trunk-isolation-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('keeps production reachable runtime separated from archive, backup, evidence, and candidate surfaces', () => {
    const report = readJson('audit/production-trunk-isolation-report.json');

    expect(report.status).toBe('pass');
    expect(report.failures).toEqual([]);
    expect(report.reachableRuntime.files).toBeGreaterThan(0);
    expect(report.eagerRuntime.files).toBeGreaterThan(0);
    expect(report.reachableRuntime.disallowed).toEqual([]);
    expect(report.eagerRuntime.disallowed).toEqual([]);
    expect(report.reachableRuntime.compatibilityFiles).toBeLessThanOrEqual(
      report.policy.maxReachableCompatibilityFiles
    );

    for (const bucket of Object.keys(report.reachableRuntime.buckets)) {
      expect(report.policy.allowedReachableBuckets).toContain(bucket);
      expect(report.policy.forbiddenProductionBuckets).not.toContain(bucket);
    }

    for (const bucket of Object.keys(report.eagerRuntime.buckets)) {
      expect(report.policy.allowedEagerBuckets).toContain(bucket);
      expect(report.policy.forbiddenProductionBuckets).not.toContain(bucket);
    }
  });

  test('production guard scripts include trunk isolation in both visual and nonvisual gates', () => {
    const pkg = readJson('package.json');

    expect(pkg.scripts['guard:production-trunk-isolation']).toBe(
      'node scripts/agent-guards/production-trunk-isolation-check.js'
    );
    expect(pkg.scripts['guard:workspace-size']).toBe(
      'node scripts/agent-guards/workspace-size-governance-check.js'
    );
    expect(pkg.scripts['guard:all']).toContain('guard:production-trunk-isolation');
    expect(pkg.scripts['guard:all:nonvisual']).toContain('guard:production-trunk-isolation');
    expect(pkg.scripts['guard:all']).toContain('guard:workspace-size');
    expect(pkg.scripts['guard:all:nonvisual']).toContain('guard:workspace-size');
  });
});
