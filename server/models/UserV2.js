const mongoose = require('mongoose');

const roles = [
  'platform_admin',
  'hq_admin',
  'regional_manager',
  'dealer_admin',
  'store_manager',
  'designer',
  'sales',
  'engineer',
  'installer',
  'customer'
];

const userV2Schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerV2', index: true },
  phone: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, enum: roles, required: true, index: true },
  permissions: [{ type: String }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  },
  lastLoginAt: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'UserV2' }
}, { timestamps: true });

userV2Schema.index({ phone: 1 }, { unique: true });
userV2Schema.index({ tenantId: 1, dealerId: 1, role: 1, status: 1 });
userV2Schema.index({ tenantId: 1, storeId: 1, status: 1 });
userV2Schema.index({ tenantId: 1, customerId: 1, role: 1, status: 1 });
userV2Schema.index({ tenantId: 1, updatedAt: -1 });

userV2Schema.virtual('isLocked').get(function isLocked() {
  return Boolean(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.models.UserV2 || mongoose.model('UserV2', userV2Schema);
