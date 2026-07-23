const mongoose = require('mongoose')

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['quick', 'detailed'],
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'designing', 'review', 'completed', 'cancelled'],
    default: 'draft'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  designer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customer: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true,
      match: /^1[3-9]\d{9}$/
    },
    address: {
      type: String,
      required: true
    },
    requirements: {
      type: String
    }
  },
  property: {
    area: {
      type: Number,
      required: true
    },
    areaRange: {
      type: String,
      enum: ['small', 'medium', 'large', 'xlarge', 'xxlarge']
    },
    roomCount: {
      type: Number,
      required: true
    },
    orientation: {
      type: String,
      enum: ['south', 'north', 'east', 'west', 'south-north']
    },
    city: {
      type: String,
      required: true
    },
    structure: {
      type: String,
      enum: ['normal', 'good', 'excellent'],
      default: 'normal'
    }
  },
  needs: {
    coreNeeds: [{
      type: String,
      enum: ['constant-temp', 'whole-house-water', 'energy-heating', 'central-hot-water', 'fresh-air', 'dehumidification']
    }],
    residentCount: {
      type: String,
      enum: ['1-2', '3-4', '5+']
    },
    budgetRange: {
      type: String,
      enum: ['low', 'medium', 'high', 'luxury']
    }
  },
  floorplan: {
    type: {
      type: String,
      enum: ['handdrawn', 'cad', 'template', 'imported']
    },
    data: {
      walls: [{
        start: { x: Number, y: Number },
        end: { x: Number, y: Number },
        thickness: Number
      }],
      doors: [{
        position: { x: Number, y: Number },
        width: Number,
        type: String
      }],
      windows: [{
        position: { x: Number, y: Number },
        width: Number,
        height: Number
      }],
      rooms: [{
        name: String,
        area: Number,
        vertices: [{ x: Number, y: Number }]
      }]
    },
    image: String,
    cadFile: String
  },
  loadCalculation: {
    cooling: {
      total: Number,
      rooms: [{
        roomName: String,
        load: Number
      }]
    },
    heating: {
      total: Number,
      rooms: [{
        roomName: String,
        load: Number
      }]
    },
    freshAir: {
      total: Number,
      perPerson: Number
    },
    hotWater: {
      total: Number,
      perPerson: Number
    },
    report: String,
    parameters: {
      city: String,
      structure: String,
      standards: [String]
    }
  },
  devices: [{
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device'
    },
    quantity: {
      type: Number,
      default: 1
    },
    room: String,
    position: {
      x: Number,
      y: Number,
      z: Number
    },
    notes: String
  }],
  layout3D: {
    scene: String,
    devices: [{
      deviceId: String,
      position: { x: Number, y: Number, z: Number },
      rotation: { x: Number, y: Number, z: Number },
      scale: { x: Number, y: Number, z: Number }
    }],
    pipes: [{
      type: String,
      points: [{ x: Number, y: Number, z: Number }],
      diameter: Number,
      material: String
    }],
    renderings: [String]
  },
  materials: [{
    name: {
      type: String,
      required: true
    },
    model: String,
    specification: String,
    unit: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    },
    category: String,
    notes: String
  }],
  quotation: {
    materials: {
      type: Number,
      default: 0
    },
    labor: {
      type: Number,
      default: 0
    },
    subtotal: {
      type: Number,
      default: 0
    },
    promotions: [{
      type: {
        type: String,
        enum: ['discount', 'fullReduction', 'buyGift', 'package', 'points']
      },
      name: String,
      value: Number,
      description: String
    }],
    discount: {
      type: Number,
      default: 0
    },
    total: {
      type: Number,
      default: 0
    },
    template: String
  },
  versions: [{
    type: mongoose.Schema.Types.Mixed
  }],
  tags: [String],
  notes: String,
  shared: [{
    token: String,
    permissions: {
      type: String,
      enum: ['view', 'edit']
    },
    expiresAt: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
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
projectSchema.index({ designer: 1 })
projectSchema.index({ status: 1 })
projectSchema.index({ type: 1 })
projectSchema.index({ 'customer.phone': 1 })
projectSchema.index({ createdAt: -1 })
projectSchema.index({ updatedAt: -1 })

// 虚拟字段：是否可以编辑
projectSchema.virtual('isEditable').get(function() {
  return !['completed', 'cancelled'].includes(this.status)
})

// 中间件：保存前更新时间
projectSchema.pre('save', function(next) {
  this.updatedAt = new Date()
  next()
})

module.exports = mongoose.model('Project', projectSchema)
