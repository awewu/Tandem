const BaseRepository = require('../../repositories/BaseRepository');
const OutboxEvent = require('../../models/OutboxEvent');
const dbLayer = require('../../db');

const OUTBOX_STATUSES = new Set(['pending', 'delivering', 'delivered', 'dead_letter']);
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 15 * 60 * 1000;

class OutboxService {
  constructor(options = {}) {
    this.memoryDb = options.db || options.memoryDb || (!process.env.MONGODB_URI ? {} : null);
    this.outboxRepo = options.outboxRepo || new BaseRepository(OutboxEvent);
    this.now = options.now || (() => new Date());
    this.maxAttempts = Number(options.maxAttempts || DEFAULT_MAX_ATTEMPTS);
    this.baseDelayMs = Number(options.baseDelayMs || DEFAULT_BASE_DELAY_MS);
    this.maxDelayMs = Number(options.maxDelayMs || DEFAULT_MAX_DELAY_MS);
  }

  shouldUseMemoryMode() {
    return Boolean(this.memoryDb && !process.env.MONGODB_URI);
  }

  requireTenant(scope = {}) {
    if (!scope.tenantId) {
      const err = new Error('tenantId is required for outbox events');
      err.status = 400;
      throw err;
    }
    return scope.tenantId;
  }

  normalizeEvent(scope = {}, event = {}) {
    const tenantId = this.requireTenant(scope);
    for (const field of ['aggregateType', 'aggregateId', 'eventType']) {
      if (!event[field]) {
        const err = new Error(`${field} is required for outbox events`);
        err.status = 400;
        throw err;
      }
    }

    const aggregateId = String(event.aggregateId);
    const idempotencyKey = event.idempotencyKey || [
      tenantId,
      event.aggregateType,
      aggregateId,
      event.eventType
    ].join(':');

    const status = event.status || 'pending';
    if (!OUTBOX_STATUSES.has(status)) {
      const err = new Error(`unsupported outbox status: ${status}`);
      err.status = 400;
      throw err;
    }

    return {
      tenantId,
      aggregateType: event.aggregateType,
      aggregateId,
      eventType: event.eventType,
      payload: event.payload || {},
      idempotencyKey,
      status,
      availableAt: event.availableAt || this.now(),
      attempts: Number(event.attempts || 0),
      lastError: event.lastError,
      lockedAt: event.lockedAt,
      deliveredAt: event.deliveredAt,
      deadLetteredAt: event.deadLetteredAt,
      replayedAt: event.replayedAt,
      replayReason: event.replayReason,
      traceId: event.traceId || scope.traceId,
      requestId: event.requestId || scope.requestId
    };
  }

  getEventId(event = {}) {
    return String(event.id || event._id || '');
  }

  toDate(value) {
    return value instanceof Date ? value : new Date(value);
  }

  nextAvailableAt(attempts) {
    const delay = Math.min(
      this.baseDelayMs * Math.pow(2, Math.max(Number(attempts || 1) - 1, 0)),
      this.maxDelayMs
    );
    return new Date(this.now().getTime() + delay);
  }

  isAvailable(event, now = this.now()) {
    return !event.availableAt || this.toDate(event.availableAt) <= now;
  }

  memoryEvents() {
    this.memoryDb.outboxEvents = this.memoryDb.outboxEvents || [];
    return this.memoryDb.outboxEvents;
  }

  findMemoryEvent(scope, eventId) {
    this.requireTenant(scope);
    return this.memoryEvents().find(item => (
      String(item.tenantId) === String(scope.tenantId) &&
      this.getEventId(item) === String(eventId)
    ));
  }

  async publish(scope, event = {}, options = {}) {
    const payload = this.normalizeEvent(scope, event);

    if (this.shouldUseMemoryMode()) {
      // 生产环境禁止写入内存（dbLayer 会抛错）
      dbLayer.requirePersistence('outbox.publish');
      const events = this.memoryEvents();
      const existing = events.find(item => (
        String(item.tenantId) === String(payload.tenantId) &&
        item.idempotencyKey === payload.idempotencyKey
      ));
      if (existing) return existing;

      const item = {
        id: `OUT-${String(events.length + 1).padStart(6, '0')}`,
        ...payload,
        createdAt: this.now().toISOString(),
        updatedAt: this.now().toISOString(),
        storageMode: 'memory'
      };
      events.push(item);
      return item;
    }

    const existing = await this.outboxRepo.findOne(scope, { idempotencyKey: payload.idempotencyKey });
    if (existing) return existing;
    return this.outboxRepo.create(scope, payload, options);
  }

  list(scope, query = {}, options = {}) {
    this.requireTenant(scope);
    if (this.shouldUseMemoryMode()) {
      const items = (this.memoryDb.outboxEvents || []).filter(item => {
        if (String(item.tenantId) !== String(scope.tenantId)) return false;
        if (query.eventType && item.eventType !== query.eventType) return false;
        if (query.aggregateType && item.aggregateType !== query.aggregateType) return false;
        if (query.status && item.status !== query.status) return false;
        return true;
      });
      return {
        items,
        pagination: { page: 1, limit: items.length, total: items.length, pages: 1 },
        storageMode: 'memory'
      };
    }
    return this.outboxRepo.list(scope, query, {
      page: options.page || query.page,
      limit: options.limit || query.limit,
      sort: { createdAt: -1 }
    });
  }

  async claimPending(scope, options = {}) {
    this.requireTenant(scope);
    const limit = Math.max(1, Math.min(Number(options.limit || 20), 100));
    const now = this.now();

    if (this.shouldUseMemoryMode()) {
      const claimed = [];
      for (const item of this.memoryEvents()) {
        if (claimed.length >= limit) break;
        if (String(item.tenantId) !== String(scope.tenantId)) continue;
        if (item.status !== 'pending') continue;
        if (!this.isAvailable(item, now)) continue;

        item.status = 'delivering';
        item.lockedAt = now.toISOString();
        item.updatedAt = now.toISOString();
        item.workerId = options.workerId || scope.workerId;
        claimed.push(item);
      }
      return { items: claimed, storageMode: 'memory' };
    }

    const query = {
      status: 'pending',
      availableAt: { $lte: now }
    };
    const result = await this.outboxRepo.list(scope, query, {
      limit,
      sort: { availableAt: 1, createdAt: 1 },
      lean: false
    });
    const claimed = [];
    for (const event of result.items || []) {
      const updated = await OutboxEvent.findOneAndUpdate(
        {
          _id: event._id,
          tenantId: scope.tenantId,
          status: 'pending'
        },
        {
          status: 'delivering',
          lockedAt: now,
          workerId: options.workerId || scope.workerId,
          updatedAt: now
        },
        { new: true }
      ).lean();
      if (updated) claimed.push(updated);
    }
    return { items: claimed, storageMode: 'mongo' };
  }

  async markDelivered(scope, eventId) {
    this.requireTenant(scope);
    const now = this.now();

    if (this.shouldUseMemoryMode()) {
      const event = this.findMemoryEvent(scope, eventId);
      if (!event) return null;
      event.status = 'delivered';
      event.deliveredAt = now.toISOString();
      event.lastError = undefined;
      event.updatedAt = now.toISOString();
      return event;
    }

    return OutboxEvent.findOneAndUpdate(
      { _id: eventId, tenantId: scope.tenantId },
      { status: 'delivered', deliveredAt: now, lastError: undefined, updatedAt: now },
      { new: true }
    ).lean();
  }

  async markFailed(scope, eventId, error, options = {}) {
    this.requireTenant(scope);
    const now = this.now();
    const message = error instanceof Error ? error.message : String(error || 'outbox delivery failed');
    const maxAttempts = Number(options.maxAttempts || this.maxAttempts);

    if (this.shouldUseMemoryMode()) {
      const event = this.findMemoryEvent(scope, eventId);
      if (!event) return null;
      const attempts = Number(event.attempts || 0) + 1;
      const status = attempts >= maxAttempts ? 'dead_letter' : 'pending';
      event.attempts = attempts;
      event.status = status;
      event.lastError = message;
      event.availableAt = status === 'pending' ? this.nextAvailableAt(attempts).toISOString() : event.availableAt;
      event.deadLetteredAt = status === 'dead_letter' ? now.toISOString() : event.deadLetteredAt;
      event.updatedAt = now.toISOString();
      return event;
    }

    const event = await OutboxEvent.findOne({ _id: eventId, tenantId: scope.tenantId }).lean();
    if (!event) return null;
    const attempts = Number(event.attempts || 0) + 1;
    const status = attempts >= maxAttempts ? 'dead_letter' : 'pending';
    return OutboxEvent.findOneAndUpdate(
      { _id: eventId, tenantId: scope.tenantId },
      {
        attempts,
        status,
        lastError: message,
        availableAt: status === 'pending' ? this.nextAvailableAt(attempts) : event.availableAt,
        deadLetteredAt: status === 'dead_letter' ? now : event.deadLetteredAt,
        updatedAt: now
      },
      { new: true }
    ).lean();
  }

  async replay(scope, eventId, options = {}) {
    this.requireTenant(scope);
    const now = this.now();

    if (this.shouldUseMemoryMode()) {
      const event = this.findMemoryEvent(scope, eventId);
      if (!event) return null;
      event.status = 'pending';
      event.availableAt = now.toISOString();
      event.lockedAt = undefined;
      event.deliveredAt = undefined;
      event.deadLetteredAt = undefined;
      event.replayedAt = now.toISOString();
      event.replayReason = options.reason || 'manual-replay';
      event.lastError = undefined;
      event.updatedAt = now.toISOString();
      return event;
    }

    return OutboxEvent.findOneAndUpdate(
      { _id: eventId, tenantId: scope.tenantId },
      {
        status: 'pending',
        availableAt: now,
        lockedAt: undefined,
        deliveredAt: undefined,
        deadLetteredAt: undefined,
        replayedAt: now,
        replayReason: options.reason || 'manual-replay',
        lastError: undefined,
        updatedAt: now
      },
      { new: true }
    ).lean();
  }
}

module.exports = OutboxService;
module.exports.OUTBOX_STATUSES = OUTBOX_STATUSES;
module.exports.DEFAULT_MAX_ATTEMPTS = DEFAULT_MAX_ATTEMPTS;
