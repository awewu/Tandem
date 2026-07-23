const mongoose = require('mongoose');

const outboxEventSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  aggregateType: { type: String, required: true, index: true },
  aggregateId: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  idempotencyKey: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'delivering', 'delivered', 'dead_letter'],
    default: 'pending',
    index: true
  },
  availableAt: { type: Date, default: Date.now, index: true },
  attempts: { type: Number, default: 0, min: 0 },
  lastError: String,
  lockedAt: Date,
  deliveredAt: Date,
  deadLetteredAt: Date,
  replayedAt: Date,
  replayReason: String,
  traceId: String,
  requestId: String
}, { timestamps: true });

outboxEventSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });
outboxEventSchema.index({ status: 1, availableAt: 1, attempts: 1 });
outboxEventSchema.index({ tenantId: 1, aggregateType: 1, aggregateId: 1, createdAt: -1 });

module.exports = mongoose.models.OutboxEvent || mongoose.model('OutboxEvent', outboxEventSchema);
