const mongoose = require('mongoose');
const {
  DEPLOYMENT_MODES,
  MODULES
} = require('../modules/productModules/product-module-registry');

const diagnosisReportSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  moduleId: {
    type: String,
    enum: [MODULES.rysnova.id],
    default: MODULES.rysnova.id,
    index: true
  },
  moduleDeploymentMode: {
    type: String,
    enum: [DEPLOYMENT_MODES.RHAUTT_PORTAL_EMBEDDED, DEPLOYMENT_MODES.STANDALONE],
    default: MODULES.rysnova.defaultDeploymentMode,
    index: true
  },
  moduleNamespace: {
    type: String,
    default: MODULES.rysnova.namespace,
    index: true
  },
  dataNamespace: {
    type: String,
    default: MODULES.rysnova.dataNamespace,
    index: true
  },
  reportId: { type: String, required: true, index: true },
  shareTokenHash: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['active', 'revoked', 'expired'],
    default: 'active',
    index: true
  },
  source: {
    type: String,
    enum: [MODULES.rysnova.source, ...MODULES.rysnova.legacySources],
    default: MODULES.rysnova.source,
    index: true
  },
  channel: { type: String, default: MODULES.rysnova.channel, index: true },
  sourceSurface: String,
  customerId: { type: String, index: true },
  opportunityId: { type: String, index: true },
  customer: mongoose.Schema.Types.Mixed,
  opportunity: mongoose.Schema.Types.Mixed,
  project: mongoose.Schema.Types.Mixed,
  diagnosis: mongoose.Schema.Types.Mixed,
  solutions: [mongoose.Schema.Types.Mixed],
  recommendedTierId: {
    type: String,
    enum: ['essential', 'balanced', 'premium'],
    default: 'balanced',
    index: true
  },
  visualPackages: mongoose.Schema.Types.Mixed,
  quotationSummary: mongoose.Schema.Types.Mixed,
  customerReport: mongoose.Schema.Types.Mixed,
  nextActions: [{ type: String }],
  iotBoundary: {
    type: String,
    enum: ['lifecycle_handoff_only'],
    default: 'lifecycle_handoff_only'
  },
  requestContext: mongoose.Schema.Types.Mixed,
  expiresAt: Date
}, { timestamps: true });

diagnosisReportSchema.index({ tenantId: 1, reportId: 1 }, { unique: true });
diagnosisReportSchema.index({ tenantId: 1, shareTokenHash: 1 });
diagnosisReportSchema.index({ tenantId: 1, moduleId: 1, moduleDeploymentMode: 1, updatedAt: -1 });
diagnosisReportSchema.index({ tenantId: 1, dataNamespace: 1, moduleDeploymentMode: 1, updatedAt: -1 });
diagnosisReportSchema.index({ tenantId: 1, customerId: 1, updatedAt: -1 });
diagnosisReportSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.models.DiagnosisReport || mongoose.model('DiagnosisReport', diagnosisReportSchema);
