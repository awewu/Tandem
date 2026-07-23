const BaseRepository = require('../../repositories/BaseRepository');
const AuditLog = require('../../models/AuditLog');

class AuditService {
  constructor(options = {}) {
    this.memoryDb = options.db || options.memoryDb || null;
    this.auditRepo = options.auditRepo || new BaseRepository(AuditLog);
  }

  shouldUseMemoryMode() {
    return Boolean(this.memoryDb && !process.env.MONGODB_URI);
  }

  normalizeEntry(scope = {}, entry = {}) {
    if (!scope.tenantId) {
      const err = new Error('tenantId is required for audit logging');
      err.status = 400;
      throw err;
    }
    if (!entry.action || !entry.resourceType) {
      const err = new Error('audit action and resourceType are required');
      err.status = 400;
      throw err;
    }

    return {
      tenantId: scope.tenantId,
      actorUserId: entry.actorUserId || scope.userId || null,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId ? String(entry.resourceId) : null,
      before: entry.before || null,
      after: entry.after || null,
      ip: entry.ip || null,
      userAgent: entry.userAgent || null
    };
  }

  async record(scope, entry = {}) {
    const payload = this.normalizeEntry(scope, entry);

    if (this.shouldUseMemoryMode()) {
      this.memoryDb.auditLogs = this.memoryDb.auditLogs || [];
      const item = {
        id: `AUD-${String(this.memoryDb.auditLogs.length + 1).padStart(6, '0')}`,
        ...payload,
        createdAt: new Date().toISOString(),
        storageMode: 'memory'
      };
      this.memoryDb.auditLogs.push(item);
      return item;
    }

    return this.auditRepo.create(scope, payload);
  }

  async list(scope, query = {}) {
    if (this.shouldUseMemoryMode()) {
      const items = (this.memoryDb.auditLogs || []).filter(item => {
        if (String(item.tenantId) !== String(scope.tenantId)) return false;
        if (query.action && item.action !== query.action) return false;
        if (query.resourceType && item.resourceType !== query.resourceType) return false;
        if (query.resourceId && String(item.resourceId) !== String(query.resourceId)) return false;
        if (query.actorUserId && String(item.actorUserId) !== String(query.actorUserId)) return false;
        return true;
      });
      return {
        items,
        pagination: {
          page: 1,
          limit: items.length,
          total: items.length,
          pages: 1
        },
        storageMode: 'memory'
      };
    }

    const q = {};
    if (query.action) q.action = query.action;
    if (query.resourceType) q.resourceType = query.resourceType;
    if (query.resourceId) q.resourceId = query.resourceId;
    if (query.actorUserId) q.actorUserId = query.actorUserId;
    return this.auditRepo.list(scope, q, {
      page: query.page,
      limit: query.limit,
      sort: { createdAt: -1 }
    });
  }
}

module.exports = AuditService;
