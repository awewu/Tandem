const fs = require('fs');
const path = require('path');

const DEFAULT_LEDGER_PATH = path.join(__dirname, '..', '..', '..', 'governance', 'agent-runs.json');

const ALLOWED_ROLES = new Set(['platform_admin', 'hq_admin']);

class GovernanceService {
  constructor(options = {}) {
    this.ledgerPath = options.ledgerPath || DEFAULT_LEDGER_PATH;
  }

  getAgentProgress(scope = {}) {
    if (!ALLOWED_ROLES.has(scope.role)) {
      const error = new Error('开发组进度仅允许总部或平台管理员查看');
      error.status = 403;
      throw error;
    }

    const ledger = this.readLedger();
    const lanes = (ledger.runs || []).map(run => ({
      owner: run.owner,
      lane: run.lane,
      status: run.status,
      updatedAt: run.updatedAt,
      progress: run.progress,
      guards: run.guards || [],
      harnesses: run.harnesses || [],
      blockers: run.blockers || [],
      openRisks: run.openRisks || [],
      nextActions: run.nextActions || []
    }));

    const averageProgress = lanes.length
      ? Math.round(lanes.reduce((sum, lane) => sum + Number(lane.progress?.percent || 0), 0) / lanes.length)
      : 0;
    const blockedLanes = lanes.filter(lane => lane.blockers.length || /blocked|pending|missing/i.test(lane.progress?.stage || ''));

    return {
      platform: ledger.platform,
      status: ledger.status,
      generatedAt: new Date().toISOString(),
      ledgerUpdatedAt: ledger.updatedAt,
      truth: 'auditable-progress-not-production-completion-proof',
      scope: {
        tenantId: scope.tenantId,
        role: scope.role,
        visibility: scope.role === 'platform_admin' || scope.role === 'hq_admin' ? 'tenant-wide-governance' : 'restricted'
      },
      summary: {
        totalLanes: lanes.length,
        averageProgress,
        activeLanes: lanes.filter(lane => lane.status === 'active').length,
        blockedLanes: blockedLanes.length,
        highestProgress: lanes.reduce((max, lane) => Math.max(max, Number(lane.progress?.percent || 0)), 0),
        lowestProgress: lanes.reduce((min, lane) => Math.min(min, Number(lane.progress?.percent || 0)), lanes.length ? 100 : 0)
      },
      remainingProductionGaps: ledger.remainingProductionGaps || [],
      lanes
    };
  }

  readLedger() {
    const ledger = JSON.parse(fs.readFileSync(this.ledgerPath, 'utf8'));
    if (!Array.isArray(ledger.runs)) {
      throw new Error('agent run ledger is missing runs');
    }
    return ledger;
  }
}

module.exports = GovernanceService;
