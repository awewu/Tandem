const fs = require('fs');
const path = require('path');

const {
  GATES,
  buildRunbook,
  renderMarkdown
} = require('../../scripts/release/rysnova-bim-launch-runbook');
const {
  PROOF_REQUIREMENTS
} = require('../../scripts/release/rysnova-bim-external-proof-preflight');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

describe('Rysnova production launch runbook', () => {
  test('defines every external production gate without claiming completion', () => {
    const runbook = buildRunbook();

    expect(runbook.module).toBe('Rysnova');
    expect(runbook.command).toBe('npm run release:rysnova-bim-launch-runbook');
    expect(runbook.finalLaunchRysnovaProof).toBe(false);
    expect(runbook.gates.map(item => item.id)).toEqual([
      'browser-visual-current-run',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime',
      'final-readiness',
      'guard-all'
    ]);
    expect(runbook.summary.gates).toBe(8);
    expect(runbook.completionRule).toContain('finalLaunchRysnovaProof=true');
    expect(runbook.completionRule).toContain('npm run guard:all');
    expect(runbook.nonCompletionRule).toContain('must never be used as final production proof by itself');
    expect(runbook.runOrder).toEqual(expect.arrayContaining([
      'npm run release:rysnova-bim-launch-runbook',
      'npm run release:rysnova-bim-external-proof-preflight',
      'npm run release:rysnova-bim-external-proof',
      'npm run release:rysnova-bim-final-readiness',
      'npm run guard:all'
    ]));
  });

  test('maps gate statuses to evidence paths and required final proof fields', () => {
    expect(GATES).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-object-storage',
        evidencePath: 'evidence/object-storage/rysnova-bim-object-storage-smoke.json',
        finalProofField: 'finalLaunchObjectStorageProof',
        finalProofRequired: true,
        requiredStatus: 'passed-external-current-run'
      }),
      expect.objectContaining({
        id: 'postgres-staging',
        evidencePath: 'evidence/database/postgres-staging-smoke-report.json',
        finalProofField: 'finalLaunchDatabaseProof',
        requiredStatus: 'passed-staging-current-run'
      }),
      expect.objectContaining({
        id: 'redis-runtime',
        evidencePath: 'evidence/cache/redis-runtime-smoke.json',
        finalProofField: 'finalLaunchRedisProof',
        requiredStatus: 'passed-runtime-current-run'
      }),
      expect.objectContaining({
        id: 'temporal-runtime',
        evidencePath: 'evidence/workflow/temporal-runtime-smoke.json',
        finalProofField: 'finalLaunchWorkflowProof',
        requiredStatus: 'passed-runtime-current-run'
      })
    ]));

    const runbook = buildRunbook();
    const browserGate = runbook.gates.find(item => item.id === 'browser-visual-current-run');
    const storageGate = runbook.gates.find(item => item.id === 'external-object-storage');
    expect(browserGate.acceptanceCriteria).toEqual(expect.arrayContaining([
      expect.stringContaining('10 active pages render')
    ]));
    expect(browserGate.cannotBeReplacedBy).toEqual(expect.arrayContaining([
      'stale screenshots'
    ]));
    expect(storageGate.acceptanceCriteria).toEqual(expect.arrayContaining([
      expect.stringContaining('External S3/OSS/MinIO-compatible adapter')
    ]));
    expect(storageGate.failureImpact).toContain('durable launch artifacts');
  });

  test('external gates stay aligned with preflight proof requirements', () => {
    const runbook = buildRunbook();
    const gateToRequirement = {
      'browser-visual-current-run': 'browser-visual',
      'staging-capacity': 'staging-capacity',
      'external-object-storage': 'external-object-storage',
      'postgres-staging': 'postgres-staging',
      'redis-runtime': 'redis-runtime',
      'temporal-runtime': 'temporal-runtime'
    };

    for (const [gateId, requirementId] of Object.entries(gateToRequirement)) {
      const gate = runbook.gates.find(item => item.id === gateId);
      const requirement = PROOF_REQUIREMENTS[requirementId];
      expect(gate).toEqual(expect.objectContaining({
        evidencePath: requirement.evidencePath,
        requiredStatus: requirement.requiredStatus,
        finalProofField: requirement.finalProofField,
        owner: requirement.owner
      }));
      expect(gate.acceptanceCriteria).toEqual(requirement.acceptanceCriteria);
      expect(gate.cannotBeReplacedBy).toEqual(requirement.cannotBeReplacedBy);
    }
  });

  test('renders an operator-readable markdown checklist with environment profile', () => {
    const runbook = buildRunbook();
    const markdown = renderMarkdown(runbook);

    expect(markdown).toContain('# Rysnova Production Launch Runbook');
    expect(markdown).toContain('| browser-visual-current-run |');
    expect(markdown).toContain('POSTGRES_STAGING_URL');
    expect(markdown).toContain('REDIS_STAGING_URL');
    expect(markdown).toContain('TEMPORAL_ADDRESS');
    expect(markdown).toContain('OBJECT_STORAGE_EXTERNAL_PROVIDER');
    expect(markdown).toContain('Acceptance Criteria');
    expect(markdown).toContain('Cannot be replaced by');
    expect(markdown).toContain('local filesystem adapter');
    expect(markdown).toContain('deterministic local workflow replay');
    expect(markdown).toContain('Completion Rule');
    expect(markdown).toContain('Non-Completion Rule');
  });

  test('package scripts and release evidence include the launch runbook gate', () => {
    const pkg = readJson('package.json');
    const release = readJson('evidence/release-evidence.json');

    expect(pkg.scripts['release:rysnova-bim-launch-runbook'])
      .toBe('node scripts/release/rysnova-bim-launch-runbook.js');
    expect(pkg.scripts['release:evidence'])
      .toContain('npm run release:rysnova-bim-launch-runbook');
    expect(release.requiredEvidence.rysnovaBimLaunchRunbook).toEqual(expect.objectContaining({
      command: 'npm run release:rysnova-bim-launch-runbook',
      path: 'evidence/rysnova-bim/rysnova-bim-launch-runbook.json',
      summaryPath: 'evidence/rysnova-bim/rysnova-bim-launch-runbook.md',
      finalLaunchRysnovaProof: false
    }));
    expect(release.requiredEvidence.rysnovaBimLaunchRunbook.note)
      .toContain('must never be used as final production proof by itself');
  });
});
