const mongoose = require('mongoose');

const handoverDeviceSchema = new mongoose.Schema({
  sourceDeviceId: String,
  brand: String,
  productId: String,
  name: String,
  model: String,
  system: String,
  serialNumber: String,
  installLocation: String,
  iotDeviceId: String,
  capabilities: [{ type: String }],
  status: {
    type: String,
    enum: ['planned', 'installed', 'bound', 'online', 'offline', 'service_required'],
    default: 'planned'
  }
}, { _id: false });

const installedAssetSchema = new mongoose.Schema({
  assetId: { type: String, required: true },
  sourceDeviceId: String,
  productId: String,
  brand: String,
  category: {
    type: String,
    enum: [
      'central-hot-water',
      'heating',
      'whole-air',
      'fresh-air',
      'air-conditioning',
      'water-treatment',
      'smart-control',
      'unknown'
    ],
    default: 'unknown'
  },
  name: String,
  model: String,
  serialNumber: String,
  installLocation: String,
  iotDeviceId: String,
  capabilities: [{ type: String }],
  status: {
    type: String,
    enum: ['planned', 'installed', 'bound', 'online', 'offline', 'service_required'],
    default: 'planned'
  },
  warranty: {
    startDate: Date,
    endDate: Date,
    warrantyMonths: Number,
    registrationStatus: {
      type: String,
      enum: ['pending', 'registered', 'expired', 'unknown'],
      default: 'pending'
    }
  },
  servicePlanCode: String
}, { _id: false });

const capabilityRegistrySchema = new mongoose.Schema({
  assetId: String,
  category: String,
  iotDeviceId: String,
  capabilities: [{ type: String }],
  bindingStatus: {
    type: String,
    enum: ['not_started', 'prepared', 'partial', 'bound', 'failed'],
    default: 'prepared'
  },
  controlBoundary: {
    type: String,
    enum: ['lifecycle_handoff_only', 'external_realtime_iot'],
    default: 'lifecycle_handoff_only'
  }
}, { _id: false });

const lifecycleLinkSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerV2', required: true, index: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  contractId: { type: String, required: true },
  designId: String,
  quoteId: String,
  projectAddress: String,
  projectState: {
    type: String,
    enum: [
      'lead-created',
      'diagnosis-in-progress',
      'solution-drafted',
      'design-in-progress',
      'quote-drafted',
      'quote-approved',
      'contract-pending',
      'construction-planning',
      'construction-in-progress',
      'acceptance-pending',
      'accepted',
      'lifecycle-handoff-ready',
      'lifecycle-active',
      'service-event-open'
    ],
    default: 'lead-created',
    index: true
  },
  customerVisibleState: String,
  progressPercent: { type: Number, min: 0, max: 100, default: 0 },
  currentMilestone: String,
  designPackageId: String,
  systems: [{ type: String }],
  lifecycleStage: {
    type: String,
    enum: ['contracted', 'installing', 'accepted', 'iot_handover', 'operating', 'service'],
    default: 'contracted',
    index: true
  },
  handoverStatus: {
    type: String,
    enum: ['pending', 'ready', 'sent', 'accepted', 'failed'],
    default: 'pending',
    index: true
  },
  iot: {
    platform: { type: String, default: 'rhautt-iot' },
    homeId: String,
    accountId: String,
    bindingStatus: {
      type: String,
      enum: ['not_started', 'prepared', 'partial', 'bound', 'failed'],
      default: 'not_started'
    },
    handoffBoundary: {
      type: String,
      enum: ['lifecycle_handoff_only', 'external_realtime_iot'],
      default: 'lifecycle_handoff_only'
    },
    capabilityRegistry: [capabilityRegistrySchema],
    boundAt: Date
  },
  devices: [handoverDeviceSchema],
  installedAssets: [installedAssetSchema],
  servicePlan: {
    planId: String,
    status: {
      type: String,
      enum: ['draft', 'prepared', 'active', 'paused', 'expired'],
      default: 'draft'
    },
    warrantyMonths: { type: Number, default: 24 },
    maintenanceCadence: { type: String, default: 'quarterly' },
    sla: { type: String, default: '24h_response_48h_onsite' },
    dealerServiceOwner: String,
    startDate: Date,
    nextMaintenanceAt: Date
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  acceptedAt: Date,
  lastSyncedAt: Date
}, { timestamps: true });

lifecycleLinkSchema.index({ tenantId: 1, contractId: 1 }, { unique: true });
lifecycleLinkSchema.index({ tenantId: 1, customerId: 1, lifecycleStage: 1, updatedAt: -1 });
lifecycleLinkSchema.index({ tenantId: 1, customerId: 1, projectState: 1, updatedAt: -1 });
lifecycleLinkSchema.index({ tenantId: 1, 'iot.homeId': 1 });
lifecycleLinkSchema.index({ tenantId: 1, 'installedAssets.assetId': 1 });
lifecycleLinkSchema.index({ tenantId: 1, handoverStatus: 1, updatedAt: -1 });

module.exports = mongoose.models.LifecycleLink || mongoose.model('LifecycleLink', lifecycleLinkSchema);
