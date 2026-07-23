const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('repository bulk retention evidence', () => {
  beforeAll(() => {
    execFileSync(process.execPath, ['scripts/agent-guards/repository-bulk-retention-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  });

  test('inventories backup and archive bulk without claiming it is deletion-safe', () => {
    const report = readJson('evidence/operations/repository-bulk-retention-manifest.json');

    expect(report.platform).toBe('Rhautt Nexus / 瑞合数智枢纽');
    expect(report.status).toBe('pass-manifest-only-not-deletion-safe');
    expect(report.mode).toBe('local-retention-manifest');
    expect(report.externalizationState).toBe('manifested-local-assets-not-yet-externalized');
    expect(report.deletionSafe).toBe(false);
    expect(report.failures).toEqual([]);
    expect(report.totals.files).toBeGreaterThan(0);
    expect(report.totals.bytes).toBeGreaterThan(0);
    expect(report.totals.textLines).toBeGreaterThan(0);
    expect(report.manifestSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.files.length).toBe(report.totals.files);

    const buckets = new Set(report.summary.byBucket.map(item => item.bucket));
    expect(buckets).toContain('backup-excluded');
    expect(buckets).toContain('archive-excluded');

    const owners = new Set(report.summary.byBucket.map(item => item.owner));
    expect(owners).toContain('sre-guardian');
    expect(owners).toContain('legacy-fusion-migrator');

    for (const file of report.files) {
      expect(file.file).toEqual(expect.any(String));
      expect(file.root).toEqual(expect.any(String));
      expect(file.bucket).toEqual(expect.any(String));
      expect(file.owner).toEqual(expect.any(String));
      expect(file.bytes).toBeGreaterThanOrEqual(0);
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  test('keeps deletion gates explicit for every retained bulk root', () => {
    const report = readJson('evidence/operations/repository-bulk-retention-manifest.json');
    const gates = new Map(report.deletionGates.map(item => [item.root, item]));

    for (const root of ['backups', '_archive', 'archive', 'server/archive', 'commercial-hvac-design']) {
      expect(gates.has(root)).toBe(true);
      expect(gates.get(root)).toMatchObject({
        deletionSafe: false
      });
      expect(gates.get(root).requiredBeforeDeletion).toEqual(expect.arrayContaining([
        expect.stringContaining('checksum manifest'),
        expect.stringContaining('production-trunk-isolation'),
        expect.stringContaining('workspace-size'),
        expect.stringContaining('rollback note')
      ]));
    }

    expect(gates.get('backups')).toMatchObject({
      owner: 'sre-guardian',
      retentionAction: 'externalize'
    });
    expect(gates.get('_archive')).toMatchObject({
      owner: 'legacy-fusion-migrator',
      retentionAction: 'external-archive'
    });
    expect(gates.get('backups').externalArtifactUri.env).toBe('BACKUP_ARCHIVE_EXTERNAL_URI');
    expect(gates.get('_archive').externalArtifactUri.env).toBe('LEGACY_ARCHIVE_EXTERNAL_URI');
  });

  test('wires repository bulk retention into all guard gates', () => {
    const pkg = readJson('package.json');

    expect(pkg.scripts['guard:repository-bulk-retention']).toBe(
      'node scripts/agent-guards/repository-bulk-retention-check.js'
    );
    expect(pkg.scripts['guard:all']).toContain('guard:repository-bulk-retention');
    expect(pkg.scripts['guard:all:nonvisual']).toContain('guard:repository-bulk-retention');
  });
});
