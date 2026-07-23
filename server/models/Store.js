const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  city: { type: String, index: true },
  address: String,
  managerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

storeSchema.index({ tenantId: 1, dealerId: 1, code: 1 }, { unique: true });
storeSchema.index({ tenantId: 1, dealerId: 1, status: 1 });
storeSchema.index({ tenantId: 1, city: 1, status: 1 });

module.exports = mongoose.models.Store || mongoose.model('Store', storeSchema);
