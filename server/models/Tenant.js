const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  type: {
    type: String,
    enum: ['hq', 'regional', 'dealer_group'],
    default: 'dealer_group',
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },
  settings: {
    pricingPolicy: { type: String, default: 'standard' },
    allowedBrands: [{ type: String }],
    featureFlags: { type: Map, of: Boolean, default: {} }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

tenantSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.models.Tenant || mongoose.model('Tenant', tenantSchema);
