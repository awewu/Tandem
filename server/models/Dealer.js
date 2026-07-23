const mongoose = require('mongoose');

const dealerSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  province: { type: String, index: true },
  city: { type: String, index: true },
  contact: {
    name: String,
    phone: String,
    email: String
  },
  contractLevel: {
    type: String,
    enum: ['standard', 'gold', 'platinum', 'strategic'],
    default: 'standard'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

dealerSchema.index({ tenantId: 1, code: 1 }, { unique: true });
dealerSchema.index({ tenantId: 1, status: 1 });
dealerSchema.index({ tenantId: 1, province: 1, city: 1 });

module.exports = mongoose.models.Dealer || mongoose.model('Dealer', dealerSchema);
