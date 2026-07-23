/**
 * 产品数据库模型 - Product
 * 瑞美/美的/行业设备材料标准库
 */

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // 基础信息
  sku: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  category: { type: String, required: true, index: true }, // HVAC/Plumbing/Electrical
  subcategory: { type: String, required: true }, // indoor/outdoor/pipe/fitting等
  brand: { type: String, required: true, index: true }, // Rheem/Midea/行业通用
  series: { type: String }, // 系列名称
  
  // 产品描述
  description: { type: String },
  specifications: { type: Map, of: String }, // 规格参数键值对
  features: [{ type: String }], // 产品特点列表
  
  // 技术参数（数值型，用于计算）
  technicalParams: {
    capacity: { type: Number }, // 制冷量/制热量 W
    power: { type: Number }, // 功率 kW
    current: { type: Number }, // 电流 A
    voltage: { type: String }, // 电压 220V/380V
    airflow: { type: Number }, // 风量 m³/h
    pressure: { type: Number }, // 压力 Pa
    noise: { type: Number }, // 噪音 dB
    cop: { type: Number }, // 能效比
    weight: { type: Number }, // 重量 kg
    dimensions: {
      length: { type: Number }, // mm
      width: { type: Number },
      height: { type: Number }
    }
  },
  
  // 管道材料专用参数
  pipeParams: {
    diameter: { type: Number }, // mm 管径
    wallThickness: { type: Number }, // mm 壁厚
    material: { type: String }, // 材质 铜/PVC/PPR
    pressure: { type: Number }, // 承压 MPa
    tempRange: { // 温度范围
      min: { type: Number },
      max: { type: Number }
    }
  },
  
  // 价格信息
  pricing: {
    cost: { type: Number, required: true }, // 成本价
    retail: { type: Number, required: true }, // 零售价
    wholesale: { type: Number }, // 批发价
    currency: { type: String, default: 'CNY' },
    unit: { type: String, default: 'piece' } // piece/meter/set
  },
  
  // 库存信息
  inventory: {
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 10 },
    supplier: { type: String },
    leadTime: { type: Number } // 供货周期 天
  },
  
  // 适配信息
  compatibility: {
    systems: [{ type: String }], // 适用系统 hvac/plumbing等
    connections: [{ type: String }], // 连接方式
    brands: [{ type: String }] // 兼容品牌
  },
  
  // 标准规范
  standards: [{ type: String }], // 符合标准 GB/ISO等
  certifications: [{ type: String }], // 认证 3C/CE等
  
  // 数据来源
  dataSource: {
    type: { type: String, enum: ['scraped', 'manual', 'imported'], default: 'manual' },
    url: { type: String }, // 抓取来源URL
    scrapedAt: { type: Date },
    verified: { type: Boolean, default: false } // 数据已核实
  },
  
  // 状态
  status: { 
    type: String, 
    enum: ['active', 'discontinued', 'draft'], 
    default: 'active',
    index: true 
  },
  
  // 图片
  images: [{ type: String }], // 图片URL列表
  
  // 搜索标签
  tags: [{ type: String, index: true }]
  
}, {
  timestamps: true,
  collection: 'products'
});

// 索引优化
productSchema.index({ category: 1, subcategory: 1, brand: 1 });
productSchema.index({ 'technicalParams.capacity': 1 });
productSchema.index({ 'pipeParams.diameter': 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// 虚拟字段 - 完整型号
productSchema.virtual('fullModel').get(function() {
  return `${this.brand} ${this.series || ''} ${this.name}`.trim();
});

// 虚拟字段 - 规格摘要
productSchema.virtual('specSummary').get(function() {
  const params = [];
  if (this.technicalParams?.capacity) params.push(`${this.technicalParams.capacity}W`);
  if (this.pipeParams?.diameter) params.push(`Φ${this.pipeParams.diameter}mm`);
  if (this.technicalParams?.power) params.push(`${this.technicalParams.power}kW`);
  return params.join(' / ') || '规格待定';
});

// 静态方法 - 按系统查找
productSchema.statics.findBySystem = function(system, filters = {}) {
  return this.find({ 
    'compatibility.systems': system,
    status: 'active',
    ...filters 
  });
};

// 静态方法 - 按容量匹配
productSchema.statics.findByCapacity = function(minCapacity, maxCapacity) {
  return this.find({
    'technicalParams.capacity': { $gte: minCapacity, $lte: maxCapacity },
    status: 'active'
  }).sort({ 'technicalParams.capacity': 1 });
};

// 静态方法 - 按管径匹配
productSchema.statics.findByDiameter = function(diameter, tolerance = 5) {
  return this.find({
    'pipeParams.diameter': { $gte: diameter - tolerance, $lte: diameter + tolerance },
    status: 'active'
  });
};

module.exports = mongoose.model('Product', productSchema);
