const crypto = require('crypto');
const DesignWorkspaceState = require('../../models/DesignWorkspaceState');
const BaseRepository = require('../../repositories/BaseRepository');
const dbLayer = require('../../db');

const SOURCE_SURFACES = new Set(['designer-workbench', 'rysnova-bim-workbench', 'technical-support-workbench']);
const STAGES = new Set(['draft', 'designing', 'quote-ready', 'rysnova-bim-ready', 'signed-handoff']);

class DesignWorkspaceService {
  constructor(options = {}) {
    this.memoryDb = options.db || options.memoryDb || null;
    this.workspaceRepo = options.workspaceRepo || new BaseRepository(DesignWorkspaceState);
    this.now = options.now || (() => new Date());
  }

  shouldUseMemoryMode() {
    return Boolean(this.memoryDb && !process.env.MONGODB_URI);
  }

  requireScope(scope) {
    if (!scope?.tenantId) {
      const err = new Error('tenantId is required for design workspace operations');
      err.status = 403;
      throw err;
    }
  }

  requireProjectId(projectId) {
    const value = String(projectId || '').trim();
    if (!value) {
      const err = new Error('projectId is required');
      err.status = 400;
      throw err;
    }
    return value;
  }

  hash(value) {
    return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex')}`;
  }

  normalizeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  normalizePayload(scope, projectId, data = {}, existing = null) {
    const canvasInput = data.canvas || data.project || data.state || {};
    const canvas = {
      walls: this.normalizeArray(canvasInput.walls),
      devices: this.normalizeArray(canvasInput.devices),
      pipes: this.normalizeArray(canvasInput.pipes),
      doors: this.normalizeArray(canvasInput.doors),
      windows: this.normalizeArray(canvasInput.windows),
      texts: this.normalizeArray(canvasInput.texts),
      viewport: canvasInput.viewport || data.viewport || {}
    };
    const bomItems = this.normalizeArray(data.bomItems || data.items);
    const bomSummary = {
      itemCount: Number(data.bomSummary?.itemCount ?? bomItems.length ?? 0),
      materialSubtotal: Number(data.bomSummary?.materialSubtotal ?? bomItems.reduce((sum, item) => sum + Number(item.total || 0), 0)),
      customerTotal: Number(data.bomSummary?.customerTotal ?? data.quoteSummary?.customerTotal ?? 0),
      currency: data.bomSummary?.currency || data.quoteSummary?.currency || 'CNY'
    };
    const sourceSurface = SOURCE_SURFACES.has(data.sourceSurface) ? data.sourceSurface : 'designer-workbench';
    const isRysnova = sourceSurface === 'rysnova-bim-workbench' || data.moduleNamespace === 'rysnova-bim';
    const quoteSummary = data.quoteSummary || data.quotationSummary || {};
    const stage = STAGES.has(data.stage) ? data.stage : (
      quoteSummary.customerTotal || bomSummary.customerTotal ? 'quote-ready' : 'designing'
    );

    const payload = {
      tenantId: scope.tenantId,
      dealerId: scope.dealerId || data.dealerId || null,
      storeId: scope.storeId || data.storeId || null,
      projectId,
      sourceSurface,
      name: data.name || canvasInput.name || existing?.name || '未命名项目',
      stage,
      moduleId: isRysnova ? 'rysnova-bim-engineering-support' : 'designer-workbench',
      moduleDeploymentMode: data.moduleDeploymentMode || existing?.moduleDeploymentMode || 'rhautt-portal-embedded',
      moduleNamespace: isRysnova ? 'rysnova-bim' : 'designer',
      dataNamespace: isRysnova ? 'rysnova-bim' : 'designer',
      canvas,
      bomSummary,
      quoteSummary: {
        quotationNo: quoteSummary.quotationNo || quoteSummary.quoteId,
        status: quoteSummary.status || (quoteSummary.customerTotal ? 'draft-ready' : undefined),
        customerTotal: Number(quoteSummary.customerTotal || quoteSummary.estimatedTotal || 0),
        monthlyPayment: Number(quoteSummary.monthlyPayment || 0),
        marginGuardStatus: quoteSummary.marginGuardStatus || quoteSummary.marginGuard?.status,
        source: quoteSummary.source
      },
      rysnovaBimReadiness: {
        visualReady: Boolean(data.rysnovaBimReadiness?.visualReady),
        deliverableReady: Boolean(data.rysnovaBimReadiness?.deliverableReady),
        customerPackageReady: Boolean(data.rysnovaBimReadiness?.customerPackageReady),
        handoffBoundary: 'lifecycle_handoff_only'
      },
      version: Number(existing?.version || 0) + 1,
      savedBy: scope.userId || null
    };
    payload.contentHash = this.hash({
      projectId,
      sourceSurface: payload.sourceSurface,
      canvas: payload.canvas,
      bomSummary: payload.bomSummary,
      quoteSummary: payload.quoteSummary,
      rysnovaBimReadiness: payload.rysnovaBimReadiness
    });
    return payload;
  }

  memoryItems() {
    this.memoryDb.designWorkspaceStates = this.memoryDb.designWorkspaceStates || [];
    return this.memoryDb.designWorkspaceStates;
  }

  async saveWorkspaceState(scope, projectIdInput, data = {}) {
    this.requireScope(scope);
    const projectId = this.requireProjectId(projectIdInput);

    if (this.shouldUseMemoryMode()) {
      dbLayer.requirePersistence('design.saveWorkspaceState');
      const items = this.memoryItems();
      const index = items.findIndex(item => (
        String(item.tenantId) === String(scope.tenantId) &&
        String(item.projectId) === String(projectId)
      ));
      const existing = index >= 0 ? items[index] : null;
      const now = this.now().toISOString();
      const payload = {
        id: existing?.id || `${scope.tenantId}:${projectId}`,
        ...this.normalizePayload(scope, projectId, data, existing),
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        storageMode: 'memory'
      };
      if (index >= 0) items[index] = payload;
      else items.push(payload);
      return payload;
    }

    const existing = await this.workspaceRepo.findOne(scope, { projectId });
    const payload = this.normalizePayload(scope, projectId, data, existing);
    if (existing?._id) {
      return this.workspaceRepo.updateById(scope, existing._id, payload);
    }
    return this.workspaceRepo.create(scope, payload);
  }

  async getWorkspaceState(scope, projectIdInput) {
    this.requireScope(scope);
    const projectId = this.requireProjectId(projectIdInput);

    if (this.shouldUseMemoryMode()) {
      return this.memoryItems().find(item => (
        String(item.tenantId) === String(scope.tenantId) &&
        String(item.projectId) === String(projectId)
      )) || null;
    }

    return this.workspaceRepo.findOne(scope, { projectId });
  }
}

module.exports = DesignWorkspaceService;
