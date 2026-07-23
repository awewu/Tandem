const mongoose = require('mongoose')

/**
 * 6大系统一键计算结果模型
 * 存储完整的设计计算结果
 */
const calculationResultSchema = new mongoose.Schema({
  // 项目关联
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  
  // 项目基本信息
  projectInfo: {
    name: { type: String, required: true },
    buildingType: { type: String, required: true },
    area: { type: Number, required: true },
    city: { type: String, required: true },
    climateZone: { type: String },
    people: { type: Number },
    rooms: [{ name: String, type: String, area: Number, people: Number }]
  },
  
  // 热水系统计算结果
  hotwater: {
    enabled: { type: Boolean, default: true },
    demand: {
      dailyWater: Number,
      hourlyWater: Number,
      hotWaterHourly: Number
    },
    heat: {
      load: Number,
      unit: { type: String, default: 'kW' }
    },
    equipment: {
      type: String,
      power: String,
      description: String,
      price: Number
    },
    cost: {
      equipment: Number,
      installation: Number,
      total: Number
    },
    standard: { type: String, default: 'GB 50015-2019' }
  },
  
  // 净水系统计算结果
  water: {
    enabled: { type: Boolean, default: true },
    flow: {
      dailyWater: Number,
      hourlyWater: Number,
      unit: { type: String, default: 'L' }
    },
    system: {
      type: String,
      stages: [String],
      flowRate: String
    },
    cost: {
      equipment: Number,
      installation: Number,
      total: Number
    },
    standard: { type: String, default: 'GB 50015-2019' }
  },
  
  // 新风系统计算结果
  freshair: {
    enabled: { type: Boolean, default: true },
    freshAir: {
      total: Number,
      byACH: Number,
      unit: { type: String, default: 'm³/h' }
    },
    rooms: [{
      name: String,
      type: String,
      freshAir: Number
    }],
    heatRecovery: {
      type: String,
      sre: String,
      lre: String
    },
    equipment: {
      capacity: Number,
      model: String,
      price: Number
    },
    cost: {
      equipment: Number,
      installation: Number,
      total: Number
    },
    standard: { type: String, default: 'GB 50736-2012' }
  },
  
  // 制冷系统计算结果
  cooling: {
    enabled: { type: Boolean, default: true },
    load: {
      total: Number,
      design: Number,
      unit: { type: String, default: 'W' },
      diversity: { type: Number, default: 0.85 }
    },
    rooms: [{
      name: String,
      area: Number,
      load: Number,
      equipment: String
    }],
    equipment: {
      outdoorUnit: String,
      indoorUnits: Number,
      iplv: Number,
      model: String,
      price: Number
    },
    cost: {
      equipment: Number,
      installation: Number,
      total: Number
    },
    standard: { type: String, default: 'GB 50736-2012' }
  },
  
  // DOAS系统计算结果
  doas: {
    enabled: { type: Boolean, default: false },
    freshAir: {
      flow: Number,
      unit: { type: String, default: 'm³/h' }
    },
    design: {
      supplyTemp: { type: Number, default: 22 },
      dewPoint: { type: Number, default: 10 },
      humidity: { type: Number, default: 50 }
    },
    heatRecovery: {
      type: String,
      sre: String,
      lre: String
    },
    reheat: {
      load: Number,
      source: String,
      unit: { type: String, default: 'kW' }
    },
    coordination: {
      radiantSurfaceTemp: Number,
      tempDifference: String,
      safe: Boolean
    },
    compliance: {
      supplyTemp: Boolean,
      sre: Boolean,
      lre: Boolean,
      dewPoint: Boolean,
      coordination: Boolean,
      overall: Boolean
    },
    equipment: {
      model: String,
      price: Number
    },
    cost: {
      equipment: Number,
      installation: Number,
      total: Number
    },
    energy: {
      savingRate: String
    },
    standard: { type: String, default: 'ASHRAE 62.1/90.1' }
  },
  
  // 供暖系统计算结果
  heating: {
    enabled: { type: Boolean, default: true },
    load: {
      total: Number,
      unit: { type: String, default: 'W' },
      factor: Number
    },
    floorHeating: {
      pipeSpacing: String,
      pipeLength: Number,
      unit: { type: String, default: 'm' },
      circuits: Number,
      collector: String
    },
    equipment: {
      heatSource: String,
      capacity: String,
      price: Number
    },
    cost: {
      equipment: Number,
      pipeMaterial: Number,
      installation: Number,
      total: Number
    },
    standard: { type: String, default: 'GB 50736-2012' }
  },
  
  // 控制系统计算结果
  control: {
    enabled: { type: Boolean, default: true },
    points: {
      temperature: Number,
      humidity: Number,
      co2: Number,
      pm25: Number,
      total: Number
    },
    strategies: [String],
    equipment: {
      type: String,
      panels: Number,
      price: Number
    },
    cost: {
      equipment: Number,
      installation: Number,
      total: Number
    },
    features: [String]
  },
  
  // 费用汇总
  summary: {
    cost: {
      equipment: Number,
      installation: Number,
      total: Number
    },
    systems: Number,
    completion: { type: String, default: '100%' }
  },
  
  // 元数据
  metadata: {
    version: { type: String, default: '1.0.0' },
    calculationTime: Number,
    timestamp: { type: Date, default: Date.now },
    engine: { type: String, default: 'OneClickCalculationEngine' }
  },
  
  // 状态
  status: {
    type: String,
    enum: ['calculated', 'approved', 'exported', 'archived'],
    default: 'calculated'
  }
}, {
  timestamps: true
})

// 索引优化
calculationResultSchema.index({ project: 1, createdAt: -1 })
calculationResultSchema.index({ 'projectInfo.city': 1, 'metadata.timestamp': -1 })

module.exports = mongoose.model('CalculationResult', calculationResultSchema)
