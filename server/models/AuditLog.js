const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true, index: true },
  resourceId: { type: String, index: true },
  before: mongoose.Schema.Types.Mixed,
  after: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ tenantId: 1, resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ tenantId: 1, actorUserId: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
