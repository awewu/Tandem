const mongoose = require('mongoose');

const interactionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerV2', required: true, index: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', index: true },
  type: {
    type: String,
    enum: ['call', 'wechat', 'meeting', 'share_view', 'site_visit', 'note'],
    default: 'note'
  },
  content: String,
  nextAction: String,
  nextActionAt: Date
}, { timestamps: { createdAt: true, updatedAt: false } });

interactionSchema.index({ tenantId: 1, customerId: 1, createdAt: -1 });
interactionSchema.index({ tenantId: 1, actorUserId: 1, createdAt: -1 });
interactionSchema.index({ tenantId: 1, nextActionAt: 1 });

module.exports = mongoose.models.Interaction || mongoose.model('Interaction', interactionSchema);
