const mongoose = require('mongoose');

const paymentScheduleItemSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  ratio: { type: Number, default: 0 },
  amount: { type: Number, required: true, min: 0 },
  dueStage: String,
  dueDate: Date,
  status: {
    type: String,
    enum: ['pending', 'invoiced', 'paid', 'overdue', 'waived'],
    default: 'pending',
    index: true
  },
  paidAmount: { type: Number, default: 0 },
  paidAt: Date,
  method: String,
  receiptNo: String,
  note: String
}, { _id: false });

const contractV2Schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerV2', required: true, index: true },
  opportunityId: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', index: true },
  quotationId: { type: String, index: true },
  lifecycleLinkId: { type: String, index: true },

  contractNo: { type: String, required: true },
  source: {
    type: String,
    enum: ['quotation-v2', 'manual', 'migration'],
    default: 'quotation-v2',
    index: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'pending_signature', 'signed', 'delivery_started', 'cancelled', 'voided'],
    default: 'draft',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['not_started', 'partial', 'paid', 'overdue', 'waived'],
    default: 'not_started',
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
  pricingSnapshot: {
    quotationNo: String,
    quoteId: String,
    revision: Number,
    source: String,
    currency: { type: String, default: 'CNY' },
    customerTotal: { type: Number, default: 0 },
    directCost: { type: Number, default: 0 },
    dealerMargin: { type: Number, default: 0 },
    monthlyPayment: { type: Number, default: 0 },
    marginGuard: {
      status: String,
      minMarginRate: Number,
      targetMarginRate: Number,
      quoteFloor: Number,
      adjustment: Number
    }
  },
  paymentSchedule: [paymentScheduleItemSchema],

  approval: {
    required: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['not_required', 'pending', 'approved', 'rejected'],
      default: 'not_required',
      index: true
    },
    reason: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
    approvedAt: Date,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
    rejectedAt: Date
  },
  signature: {
    method: {
      type: String,
      enum: ['offline', 'electronic', 'customer_portal_confirmation', 'none'],
      default: 'none'
    },
    status: {
      type: String,
      enum: ['not_started', 'pending', 'signed', 'rejected'],
      default: 'not_started',
      index: true
    },
    customerSigner: String,
    companySigner: String,
    signedAt: Date,
    evidenceUrl: String,
    termsVersion: String,
    customerIp: String
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
    servicePlanCode: String,
    handoffBoundary: {
      type: String,
      enum: ['lifecycle_handoff_only'],
      default: 'lifecycle_handoff_only'
    }
  },
  deliverables: {
    quotePdfUrl: String,
    contractPdfUrl: String,
    eSignatureEvidenceUrl: String,
    customerPortalUrl: String
  },
  terms: {
    version: String,
    paymentTerms: String,
    warrantyTerms: String,
    changeOrderPolicy: String,
    cancellationPolicy: String
  },
  signedAt: Date,
  deliveryStartedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

contractV2Schema.index({ tenantId: 1, contractNo: 1 }, { unique: true });
contractV2Schema.index({ tenantId: 1, customerId: 1, status: 1, updatedAt: -1 });
contractV2Schema.index({ tenantId: 1, dealerId: 1, status: 1, createdAt: -1 });
contractV2Schema.index({ tenantId: 1, storeId: 1, status: 1, createdAt: -1 });
contractV2Schema.index({ tenantId: 1, quotationId: 1 });
contractV2Schema.index({ tenantId: 1, paymentStatus: 1, updatedAt: -1 });

module.exports = mongoose.models.ContractV2 || mongoose.model('ContractV2', contractV2Schema);
