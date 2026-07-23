const mongoose = require('mongoose');
const {
  DEPLOYMENT_MODES,
  MODULE_IDS
} = require('../modules/productModules/product-module-registry');

const quotationV2CostBreakdownSchema = new mongoose.Schema({
  materialSubtotal: { type: Number, default: 0 },
  laborSubtotal: { type: Number, default: 0 },
  managementFee: { type: Number, default: 0 },
  warrantyReserve: { type: Number, default: 0 },
  riskReserve: { type: Number, default: 0 },
  directCost: { type: Number, default: 0 },
  targetBeforeTax: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  customerTotal: { type: Number, default: 0 },
  dealerMargin: { type: Number, default: 0 },
  monthlyPayment: { type: Number, default: 0 }
}, { _id: false });

const quotationV2ItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  model: String,
  brand: String,
  systemFamily: {
    type: String,
    enum: ['hot_water', 'heating', 'air', 'fresh_air', 'water_treatment', 'smart_control', 'service', 'other'],
    default: 'other',
    index: true
  },
  category: { type: String, required: true },
  unit: { type: String, default: '项' },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  cost: { type: Number, default: 0 },
  total: { type: Number, required: true, min: 0 },
  source: {
    type: String,
    enum: ['designer_bom', 'system_pack', 'manual', 'service_plan'],
    default: 'designer_bom'
  }
}, { _id: false });

const quotationV2Schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerV2', required: true, index: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  lifecycleLinkId: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleLink', index: true },
  ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
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

  quotationNo: { type: String, required: true },
  revision: { type: Number, default: 1 },
  source: {
    type: String,
    enum: ['designer-bom', 'system-pack', 'manual', 'migration'],
    default: 'designer-bom',
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'shared', 'approved', 'rejected', 'expired', 'contracted'],
    default: 'draft',
    index: true
  },

  project: {
    name: String,
    city: String,
    address: String,
    area: Number,
    floor: Number,
    rooms: Number
  },

  systemFamilies: [{
    type: String,
    enum: ['hot_water', 'heating', 'air', 'fresh_air', 'water_treatment', 'smart_control', 'service', 'other']
  }],
  items: [quotationV2ItemSchema],
  costBreakdown: quotationV2CostBreakdownSchema,
  marginGuard: {
    status: {
      type: String,
      enum: ['pass', 'floor_adjusted', 'blocked', 'not_checked'],
      default: 'not_checked'
    },
    minMarginRate: { type: Number, default: 0 },
    targetMarginRate: { type: Number, default: 0 },
    quoteFloor: { type: Number, default: 0 },
    adjustment: { type: Number, default: 0 }
  },
  deliverables: {
    bomUrl: String,
    quotePdfUrl: String,
    schematicUrl: String,
    effectViewUrl: String
  },
  lifecycleHandoff: {
    required: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['not_started', 'ready', 'linked', 'registered'],
      default: 'not_started',
      index: true
    },
    iotBridgeKey: String,
    servicePlanCode: String
  },
  assumptions: [{ type: String }]
}, { timestamps: true });

quotationV2Schema.index({ tenantId: 1, quotationNo: 1 }, { unique: true });
quotationV2Schema.index({ tenantId: 1, customerId: 1, status: 1, updatedAt: -1 });
quotationV2Schema.index({ tenantId: 1, dealerId: 1, status: 1, createdAt: -1 });
quotationV2Schema.index({ tenantId: 1, storeId: 1, status: 1, createdAt: -1 });
quotationV2Schema.index({ tenantId: 1, lifecycleLinkId: 1, lifecycleHandoff: 1 });
quotationV2Schema.index({ tenantId: 1, productModuleId: 1, productDeploymentMode: 1, updatedAt: -1 });
quotationV2Schema.index({ tenantId: 1, productDataNamespace: 1, productDeploymentMode: 1, updatedAt: -1 });

module.exports = mongoose.models.QuotationV2 || mongoose.model('QuotationV2', quotationV2Schema);
