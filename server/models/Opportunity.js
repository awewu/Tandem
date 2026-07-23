const mongoose = require('mongoose');
const {
  DEPLOYMENT_MODES,
  MODULE_IDS
} = require('../modules/productModules/product-module-registry');

const opportunitySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerV2', required: true, index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', index: true },
  productModuleId: {
    type: String,
    enum: Object.values(MODULE_IDS),
    default: MODULE_IDS.RHAUTT_SHARED_PLATFORM,
    index: true
  },
  productDeploymentMode: {
    type: String,
    enum: Object.values(DEPLOYMENT_MODES),
    default: DEPLOYMENT_MODES.SHARED_PLATFORM,
    index: true
  },
  productNamespace: { type: String, default: 'rhautt-shared', index: true },
  productDataNamespace: { type: String, default: 'rhautt_shared', index: true },
  stage: {
    type: String,
    enum: ['lead', 'qualified', 'diagnosed', 'quoted', 'contracted', 'won', 'lost'],
    default: 'lead',
    index: true
  },
  estimatedValue: { type: Number, default: 0 },
  probability: { type: Number, min: 0, max: 1, default: 0.1 },
  nextActionAt: Date,
  lostReason: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

opportunitySchema.index({ tenantId: 1, ownerUserId: 1, stage: 1, updatedAt: -1 });
opportunitySchema.index({ tenantId: 1, storeId: 1, stage: 1, updatedAt: -1 });
opportunitySchema.index({ tenantId: 1, customerId: 1 });
opportunitySchema.index({ tenantId: 1, nextActionAt: 1 });
opportunitySchema.index({ tenantId: 1, productModuleId: 1, productDeploymentMode: 1, updatedAt: -1 });
opportunitySchema.index({ tenantId: 1, productDataNamespace: 1, productDeploymentMode: 1, updatedAt: -1 });

module.exports = mongoose.models.Opportunity || mongoose.model('Opportunity', opportunitySchema);
