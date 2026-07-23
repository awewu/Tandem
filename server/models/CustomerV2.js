const mongoose = require('mongoose');
const {
  DEPLOYMENT_MODES,
  MODULE_IDS
} = require('../modules/productModules/product-module-registry');

const customerV2Schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', index: true },
  phoneHash: { type: String, required: true },
  phoneEncrypted: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  city: { type: String, index: true },
  address: String,
  source: { type: String, default: 'unknown', index: true },
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
  tags: [{ type: String }],
  profile: {
    houseType: String,
    area: Number,
    rooms: Number,
    familyMembers: Number,
    budgetRange: String
  },
  status: {
    type: String,
    enum: ['lead', 'active', 'won', 'lost', 'archived'],
    default: 'lead',
    index: true
  },
  lastInteractionAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

customerV2Schema.index({ tenantId: 1, phoneHash: 1 }, { unique: true });
customerV2Schema.index({ tenantId: 1, ownerUserId: 1, status: 1, updatedAt: -1 });
customerV2Schema.index({ tenantId: 1, storeId: 1, status: 1, lastInteractionAt: -1 });
customerV2Schema.index({ tenantId: 1, source: 1, createdAt: -1 });
customerV2Schema.index({ tenantId: 1, productModuleId: 1, productDeploymentMode: 1, updatedAt: -1 });
customerV2Schema.index({ tenantId: 1, productDataNamespace: 1, productDeploymentMode: 1, updatedAt: -1 });

module.exports = mongoose.models.CustomerV2 || mongoose.model('CustomerV2', customerV2Schema);
