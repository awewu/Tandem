const mongoose = require('mongoose')

const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  isRheem: {
    type: Boolean,
    default: true
  },
  system: {
    type: String,
    enum: ['五恒系统', '采暖系统', '净水系统', '热水系统', '新风系统', '除湿系统'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  specs: {
    // 通用规格
    power: String,
    voltage: String,
    weight: String,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    
    // 空调规格
    coolingCapacity: String,
    heatingCapacity: String,
    efficiency: String,
    noise: String,
    
    // 新风规格
    airFlow: String,
    filterEfficiency: String,
    
    // 净水规格
    flowRate: String,
    filterAccuracy: String,
    filterLife: String,
    
    // 热水规格
    capacity: String,
    heatingPower: String,
    temperatureRange: String,
    
    // 其他规格
    [String]: String
  },
  price: {
    factory: {
      type: Number,
      required: true
    },
    retail: {
      type: Number,
      required: true
    }
  },
  images: [{
    type: String
  }],
  description: {
    type: String,
    required: true
  },
  features: [{
    type: String
  }],
  applications: {
    type: String
  },
  technicalParams: {
    type: mongoose.Schema.Types.Mixed
  },
  installation: {
    requirements: String,
    space: String,
    tools: [String],
    manual: String
  },
  warranty: {
    period: String,
    coverage: String,
    service: String
  },
  certification: [{
    name: String,
    number: String,
    expiryDate: Date
  }],
  status: {
    type: String,
    enum: ['active', 'pending', 'rejected', 'discontinued'],
    default: 'active'
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewNotes: {
    type: String
  },
  tags: [{
    type: String
  }],
  relatedDevices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  compatibility: {
    systems: [String],
    devices: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device'
    }]
  },
  inventory: {
    stock: {
      type: Number,
      default: 0
    },
    reserved: {
      type: Number,
      default: 0
    },
    available: {
      type: Number,
      default: 0
    }
  },
  submittedAt: {
    type: Date
  },
  reviewedAt: {
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
deviceSchema.index({ name: 1 })
deviceSchema.index({ model: 1 })
deviceSchema.index({ brand: 1 })
deviceSchema.index({ system: 1 })
deviceSchema.index({ category: 1 })
deviceSchema.index({ isRheem: 1 })
deviceSchema.index({ status: 1 })
deviceSchema.index({ submittedBy: 1 })

// 虚拟字段：是否可用
deviceSchema.virtual('isAvailable').get(function() {
  return this.status === 'active' && this.inventory.available > 0
})

// 虚拟字段：价格范围
deviceSchema.virtual('priceRange').get(function() {
  return `¥${this.price.factory} - ¥${this.price.retail}`
})

// 中间件：保存前更新时间和库存
deviceSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  
  // 自动计算可用库存
  if (this.inventory) {
    this.inventory.available = this.inventory.stock - this.inventory.reserved
  }
  
  next()
})

// 静态方法：根据系统获取设备
deviceSchema.statics.getBySystem = function(system) {
  return this.find({ system, status: 'active' }).sort({ isRheem: -1, name: 1 })
}

// 静态方法：搜索设备
deviceSchema.statics.search = function(query, options = {}) {
  const {
    system,
    category,
    brand,
    priceRange,
    features,
    page = 1,
    limit = 20
  } = options

  const searchQuery = { status: 'active' }
  
  if (system) searchQuery.system = system
  if (category) searchQuery.category = category
  if (brand) searchQuery.brand = brand
  if (priceRange) {
    searchQuery['price.retail'] = {
      $gte: priceRange.min,
      $lte: priceRange.max
    }
  }
  if (features && features.length > 0) {
    searchQuery.features = { $in: features }
  }
  
  if (query) {
    searchQuery.$or = [
      { name: { $regex: query, $options: 'i' } },
      { model: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { features: { $in: [new RegExp(query, 'i')] } }
    ]
  }

  return this.find(searchQuery)
    .sort({ isRheem: -1, name: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit)
}

module.exports = mongoose.model('Device', deviceSchema)
