const fs = require('fs');
const path = require('path');
const GovernanceService = require('../../server/modules/governance/governance.service');
const {
  BOARD_PATH,
  LEDGER_PATH,
  renderProgressBoard
} = require('../../scripts/agent-guards/agent-run-ledger-check');

const ROOT = path.join(__dirname, '../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('governance agent progress evidence', () => {
  test('agent progress board is generated from the current ledger without drift', () => {
    const ledger = readJson(LEDGER_PATH);
    const expectedBoard = renderProgressBoard(ledger);

    expect(read(BOARD_PATH)).toBe(expectedBoard);
    expect(expectedBoard).toContain(`Generated: ${ledger.updatedAt}`);
    expect(expectedBoard).toContain('rheem-vi-strict-pass-visual-proof-pending');
    expect(expectedBoard).toContain('audit/rheem-vi-production-triage.json');
    expect(expectedBoard).toContain('Rheem VI strict production audit passes with 0 findings');
    expect(expectedBoard).toContain('browser visual proof is still required');
    expect(expectedBoard).toContain('not proof of independent parallel model execution or production completion');
  });

  test('governance service exposes real ledger progress for headquarters users', () => {
    const service = new GovernanceService({
      ledgerPath: path.join(ROOT, LEDGER_PATH)
    });

    const data = service.getAgentProgress({
      tenantId: '64f000000000000000000201',
      role: 'hq_admin'
    });

    expect(data.truth).toBe('auditable-progress-not-production-completion-proof');
    expect(data.scope.visibility).toBe('tenant-wide-governance');
    expect(data.summary.totalLanes).toBe(19);
    expect(data.summary.activeLanes).toBe(19);
    expect(data.summary.highestProgress).toBeGreaterThanOrEqual(72);
    expect(data.remainingProductionGaps).toEqual(expect.arrayContaining([
      expect.stringContaining('guard:all'),
      expect.stringContaining('Rheem VI strict production audit now passes with 0 findings')
    ]));

    const uiLane = data.lanes.find(lane => lane.owner === 'ui-vi-director');
    expect(uiLane).toEqual(expect.objectContaining({
      lane: 'ui-vi-system-and-visual-acceptance',
      status: 'active'
    }));
    expect(uiLane.progress).toEqual(expect.objectContaining({
      percent: 60,
      stage: 'rheem-vi-strict-pass-visual-proof-pending',
      latestEvidence: 'audit/rheem-vi-production-triage.json'
    }));
    expect(uiLane.progress.blockerSummary).toContain('browser visual launch proof');
    expect(uiLane.nextActions).toEqual(expect.arrayContaining([
      expect.stringContaining('Wait for user confirmation')
    ]));
  });

  test('rheem vi production triage proves strict audit is clear while visual proof remains separate', () => {
    const triage = readJson('audit/rheem-vi-production-triage.json');

    expect(triage.status).toBe('pass');
    expect(triage.requiredGates).toEqual(expect.arrayContaining([
      'npm run guard:rheem-vi-production',
      'npm run guard:rheem-vi-production:strict'
    ]));
    expect(triage.unclassifiedFindings).toBe(0);
    expect(triage.audit.counts.total).toBe(0);

    const activeBucket = triage.summary.byBucket.find(bucket => bucket.bucket === 'active');
    expect(activeBucket).toBeUndefined();

    const migrationBucket = triage.summary.byBucket.find(bucket => bucket.bucket === 'migration-candidate');
    expect(migrationBucket).toBeUndefined();
    const affectedFiles = triage.summary.topFiles.map(file => file.file);
    expect(affectedFiles).not.toContain('public/pain-diagnosis.html');
    expect(affectedFiles).not.toContain('public/customer-share.html');
  });

  test('governance service rejects non-headquarters progress access', () => {
    const service = new GovernanceService({
      ledgerPath: path.join(ROOT, LEDGER_PATH)
    });

    expect(() => service.getAgentProgress({
      tenantId: '64f000000000000000000201',
      role: 'dealer_admin'
    })).toThrow('开发组进度仅允许总部或平台管理员查看');
  });
});
