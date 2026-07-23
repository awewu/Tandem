/**
 * 材料库模型 - Material Database Model
 * 对标筑星云材料报价系统
 */

const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  price: { type: Number, required: true },
  supplier: { type: String },
  source: { type: String }
});

const supplierSchema = new mongoose.Schema({
  supplierId: { type: String, required: true },
  name: { type: String, required: true },
  contact: { type: String },
  price: { type: Number, required: true },
  minOrderQty: { type: Number, default: 1 },
  leadTime: { type: Number, default: 7 }, // days
  rating: { type: Number, min: 1, max: 5 },
  isPreferred: { type: Boolean, default: false }
});

const materialSchema = new mongoose.Schema({
  // 基本信息
  materialId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['管材', '管件', '阀门', '设备', '保温材料', '电气', '工具', '其他']
  },
  subcategory: { type: String },
  brand: { type: String },
  model: { type: String },
  
  // 规格参数
  specifications: {
    diameter: { type: Number }, // mm
    length: { type: Number }, // m
    thickness: { type: Number }, // mm
    material: { type: String }, // 材质
    pressure: { type: String }, // 压力等级
    temperature: { type: String }, // 温度范围
    color: { type: String },
    weight: { type: Number }, // kg
    unit: { type: String, required: true, default: '个' }
  },
  
  // 价格信息
  pricing: {
    basePrice: { type: Number, required: true }, // 基础单价
    marketPrice: { type: Number }, // 市场价
    costPrice: { type: Number }, // 成本价
    laborCost: { type: Number, default: 0 }, // 人工安装费
    currency: { type: String, default: 'CNY' },
    taxRate: { type: Number, default: 0.13 }, // 税率
    validUntil: { type: Date }
  },
  
  // 多供应商
  suppliers: [supplierSchema],
  
  // 价格历史
  priceHistory: [priceHistorySchema],
  
  // 库存
  inventory: {
    currentStock: { type: Number, default: 0 },
    safetyStock: { type: Number, default: 10 },
    reorderPoint: { type: Number, default: 20 },
    warehouse: { type: String }
  },
  
  // 适用系统
  applicableSystems: [{
    type: String,
    enum: ['空调', '采暖', '热水', '新风', '净水', '智能家居']
  }],
  
  // 适用场景
  applicableScenes: [{
    type: String,
    enum: ['住宅', '别墅', '公寓', '商业', '办公', '酒店']
  }],
  
  // 技术参数
  technical: {
    datasheet: { type: String }, // 数据手册URL
    certifications: [{ type: String }], // 认证
    warranty: { type: Number, default: 12 }, // 质保月数
    lifespan: { type: Number }, // 设计寿命年数
    efficiency: { type: String } // 效率等级
  },
  
  // 图片
  images: [{
    url: { type: String, required: true },
    type: { type: String, enum: ['product', 'installation', 'detail'] },
    isPrimary: { type: Boolean, default: false }
  }],
  
  // 替代材料
  alternatives: [{ type: String, ref: 'Material' }],
  
  // 状态
  status: { 
    type: String, 
    enum: ['active', 'discontinued', 'draft'],
    default: 'active'
  },
  
  // 使用统计
  usageStats: {
    quoteCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    totalUsedQty: { type: Number, default: 0 },
    lastUsed: { type: Date }
  },
  
  // 创建/更新
  createdBy: { type: String, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
materialSchema.index({ category: 1, subcategory: 1 });
materialSchema.index({ name: 'text', brand: 'text', model: 'text' });
materialSchema.index({ 'pricing.basePrice': 1 });
materialSchema.index({ applicableSystems: 1 });
materialSchema.index({ status: 1 });

// 更新钩子
materialSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // 如果没有市场价，使用基础价
  if (!this.pricing.marketPrice) {
    this.pricing.marketPrice = this.pricing.basePrice;
  }
  
  next();
});

// 方法：获取含税价格
materialSchema.methods.getPriceWithTax = function(qty = 1) {
  const base = this.pricing.basePrice;
  const tax = base * this.pricing.taxRate;
  return {
    unit: base,
    tax: tax,
    total: (base + tax) * qty,
    qty: qty
  };
};

// 方法：获取最优供应商
materialSchema.methods.getBestSupplier = function(minQty = 1) {
  const available = this.suppliers.filter(s => 
    s.price > 0 && s.minOrderQty <= minQty
  );
  
  if (available.length === 0) return null;
  
  // 优先选择价格最低且评级高的
  return available.sort((a, b) => {
    const scoreA = (a.rating || 3) * 10 - a.price;
    const scoreB = (b.rating || 3) * 10 - b.price;
    return scoreB - scoreA;
  })[0];
};

// 方法：添加价格历史
materialSchema.methods.recordPrice = function(price, supplier, source) {
  this.priceHistory.push({ price, supplier, source });
  
  // 只保留最近100条记录
  if (this.priceHistory.length > 100) {
    this.priceHistory = this.priceHistory.slice(-100);
  }
  
  this.pricing.basePrice = price;
  return this.save();
};

module.exports = mongoose.model('Material', materialSchema);
