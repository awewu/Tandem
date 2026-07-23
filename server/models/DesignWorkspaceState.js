const mongoose = require('mongoose');

const DesignWorkspaceStateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer' },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
  projectId: { type: String, required: true, trim: true },
  sourceSurface: {
    type: String,
    enum: ['designer-workbench', 'rysnova-bim-workbench', 'technical-support-workbench'],
    default: 'designer-workbench'
  },
  name: { type: String, default: '未命名项目' },
  stage: {
    type: String,
    enum: ['draft', 'designing', 'quote-ready', 'rysnova-bim-ready', 'signed-handoff'],
    default: 'designing'
  },
  moduleId: {
    type: String,
    enum: ['designer-workbench', 'rysnova-bim-engineering-support'],
    default: 'designer-workbench'
  },
  moduleDeploymentMode: {
    type: String,
    enum: ['rhautt-portal-embedded', 'standalone'],
    default: 'rhautt-portal-embedded'
  },
  moduleNamespace: {
    type: String,
    enum: ['designer', 'rysnova-bim'],
    default: 'designer'
  },
  dataNamespace: {
    type: String,
    enum: ['designer', 'rysnova-bim'],
    default: 'designer'
  },
  canvas: {
    walls: { type: [mongoose.Schema.Types.Mixed], default: [] },
    devices: { type: [mongoose.Schema.Types.Mixed], default: [] },
    pipes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    doors: { type: [mongoose.Schema.Types.Mixed], default: [] },
    windows: { type: [mongoose.Schema.Types.Mixed], default: [] },
    texts: { type: [mongoose.Schema.Types.Mixed], default: [] },
    viewport: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  bomSummary: {
    itemCount: { type: Number, default: 0 },
    materialSubtotal: { type: Number, default: 0 },
    customerTotal: { type: Number, default: 0 },
    currency: { type: String, default: 'CNY' }
  },
  quoteSummary: {
    quotationNo: String,
    status: String,
    customerTotal: Number,
    monthlyPayment: Number,
    marginGuardStatus: String,
    source: String
  },
  rysnovaBimReadiness: {
    visualReady: { type: Boolean, default: false },
    deliverableReady: { type: Boolean, default: false },
    customerPackageReady: { type: Boolean, default: false },
    handoffBoundary: { type: String, enum: ['lifecycle_handoff_only'], default: 'lifecycle_handoff_only' }
  },
  contentHash: { type: String, required: true },
  version: { type: Number, default: 1, min: 1 },
  savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

DesignWorkspaceStateSchema.index({ tenantId: 1, projectId: 1 }, { unique: true });
DesignWorkspaceStateSchema.index({ tenantId: 1, dealerId: 1, updatedAt: -1 });
DesignWorkspaceStateSchema.index({ tenantId: 1, moduleNamespace: 1, dataNamespace: 1, updatedAt: -1 });

module.exports = mongoose.models.DesignWorkspaceState ||
  mongoose.model('DesignWorkspaceState', DesignWorkspaceStateSchema);
