const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  contactPerson: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^1[3-9]\d{9}$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  region: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'designer', 'sales'],
    default: 'designer'
  },
  permissions: [{
    type: String
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
})

// 索引
userSchema.index({ phone: 1 })
userSchema.index({ storeName: 1 })
userSchema.index({ role: 1 })
userSchema.index({ status: 1 })

// 虚拟字段：是否被锁定
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now())
})

// 中间件：保存前更新时间
userSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

// 实例方法：增加登录失败次数
userSchema.methods.incLoginAttempts = function() {
  // 如果之前有锁定且已过期，重置计数器
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    })
  }
  
  const updates = { $inc: { loginAttempts: 1 } }
  
  // 如果达到锁定阈值且未被锁定，则锁定账户
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 } // 锁定30分钟
  }
  
  return this.updateOne(updates)
}

// 实例方法：重置登录失败次数
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  })
}

module.exports = mongoose.model('User', userSchema)
