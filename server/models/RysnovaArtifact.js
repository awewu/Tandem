const mongoose = require('mongoose');
const {
  DEPLOYMENT_MODES,
  MODULES
} = require('../modules/productModules/product-module-registry');

const standardEvidenceSchema = new mongoose.Schema({
  code: { type: String, required: true },
  level: {
    type: String,
    enum: ['mandatory-general-code', 'domain-design-standard', 'international-reference', 'internal-policy'],
    required: true
  },
  edition: { type: String, required: true },
  softwareCheck: {
    type: String,
    enum: ['passed', 'warning', 'failed', 'not-applicable'],
    default: 'not-applicable'
  },
  note: String
}, { _id: false });

const rysnovaBimArtifactSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  moduleId: {
    type: String,
    enum: [MODULES.rysnovaBim.id],
    default: MODULES.rysnovaBim.id,
    index: true
  },
  moduleDeploymentMode: {
    type: String,
    enum: [DEPLOYMENT_MODES.RHAUTT_PORTAL_EMBEDDED, DEPLOYMENT_MODES.STANDALONE],
    default: MODULES.rysnovaBim.defaultDeploymentMode,
    index: true
  },
  moduleNamespace: {
    type: String,
    default: MODULES.rysnovaBim.namespace,
    index: true
  },
  dataNamespace: {
    type: String,
    default: MODULES.rysnovaBim.dataNamespace,
    index: true
  },
  projectId: { type: String, required: true, index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerV2', index: true },
  source: {
    type: String,
    enum: ['designer', 'rysnova-bim', 'quote', 'delivery', 'lifecycle'],
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'concept-effect-view',
      'principle-diagram',
      'construction-drawing',
      'bim-model',
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ],
    required: true,
    index: true
  },
  version: { type: Number, default: 1, min: 1 },
  status: {
    type: String,
    enum: ['draft', 'reviewing', 'approved', 'shared', 'superseded', 'archived'],
    default: 'draft',
    index: true
  },
  objectKey: { type: String, required: true },
  contentHash: { type: String, required: true },
  inputsHash: { type: String, required: true },
  standards: [standardEvidenceSchema],
  permissions: {
    customerVisible: { type: Boolean, default: false },
    dealerVisible: { type: Boolean, default: true },
    headquartersVisible: { type: Boolean, default: true }
  },
  metadata: mongoose.Schema.Types.Mixed,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  approvedAt: Date
}, { timestamps: true });

rysnovaBimArtifactSchema.index({ tenantId: 1, projectId: 1, type: 1, version: -1 });
rysnovaBimArtifactSchema.index({ tenantId: 1, moduleId: 1, moduleDeploymentMode: 1, updatedAt: -1 });
rysnovaBimArtifactSchema.index({ tenantId: 1, dataNamespace: 1, moduleDeploymentMode: 1, updatedAt: -1 });
rysnovaBimArtifactSchema.index({ tenantId: 1, customerId: 1, type: 1, updatedAt: -1 });
rysnovaBimArtifactSchema.index({ tenantId: 1, customerId: 1, projectId: 1, status: 1, 'permissions.customerVisible': 1, updatedAt: -1 });
rysnovaBimArtifactSchema.index({ tenantId: 1, dataNamespace: 1, 'metadata.storage.integrityPassed': 1, updatedAt: -1 });
rysnovaBimArtifactSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });
rysnovaBimArtifactSchema.index({ tenantId: 1, objectKey: 1 }, { unique: true });

module.exports = mongoose.models.RysnovaArtifact || mongoose.model('RysnovaArtifact', rysnovaBimArtifactSchema);
