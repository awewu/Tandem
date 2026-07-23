/**
 * 报价单模型 - Quotation Model
 * 对标筑星云智能报价系统
 */

const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  
  // 材料信息
  material: { type: String, ref: 'Material' },
  materialName: { type: String, required: true },
  materialModel: { type: String },
  materialBrand: { type: String },
  
  // 规格
  specifications: { type: String },
  unit: { type: String, required: true },
  
  // 数量
  quantity: { type: Number, required: true, min: 0 },
  
  // 价格
  unitPrice: { type: Number, required: true }, // 不含税单价
  laborCost: { type: Number, default: 0 }, // 人工费
  taxRate: { type: Number, default: 0.13 },
  
  // 折扣
  discount: { type: Number, default: 0 }, // 折扣率 0-1
  
  // 小计计算
  materialSubtotal: { type: Number }, // 材料小计
  laborSubtotal: { type: Number }, // 人工小计
  subtotal: { type: Number }, // 合计（税前）
  taxAmount: { type: Number }, // 税额
  total: { type: Number }, // 含税总价
  
  // 来源
  source: { 
    type: String, 
    enum: ['system', 'manual', 'template', 'ai_recommend'],
    default: 'system'
  },
  
  // 备注
  notes: { type: String },
  
  // 替代方案
  alternatives: [{
    materialId: { type: String },
    name: { type: String },
    price: { type: Number },
    reason: { type: String }
  }]
});

// 自动计算小计
quotationItemSchema.pre('save', function(next) {
  this.materialSubtotal = this.unitPrice * this.quantity * (1 - this.discount);
  this.laborSubtotal = this.laborCost * this.quantity;
  this.subtotal = this.materialSubtotal + this.laborSubtotal;
  this.taxAmount = this.subtotal * this.taxRate;
  this.total = this.subtotal + this.taxAmount;
  next();
});

const quotationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  dealerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Dealer', index: true },
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', index: true },

  // 基本信息
  quotationNo: { type: String, required: true },
  version: { type: Number, default: 1 },
  
  // 关联
  projectId: { type: String, required: true, ref: 'Project' },
  customerId: { type: String, ref: 'Customer' },
  designId: { type: String, ref: 'Design' },
  
  // 报价类型
  type: {
    type: String,
    enum: ['initial', 'formal', 'revised', 'supplement'],
    default: 'initial'
  },
  
  // 报价档次
  package: {
    type: String,
    enum: ['economy', 'standard', 'premium', 'custom'],
    default: 'standard'
  },
  packageName: { type: String, default: '标准方案' },
  
  // 有效期
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date },
  
  // 报价项目
  items: [quotationItemSchema],
  
  // 分类汇总
  categories: [{
    name: { type: String, required: true },
    items: [{ type: String }], // itemIds
    materialSubtotal: { type: Number, default: 0 },
    laborSubtotal: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  }],
  
  // 系统分类
  systems: [{
    name: { type: String, required: true }, // 空调/采暖/热水等
    items: [{ type: String }],
    description: { type: String },
    materialSubtotal: { type: Number, default: 0 },
    laborSubtotal: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  }],
  
  // 费用汇总
  summary: {
    materialTotal: { type: Number, default: 0 }, // 材料合计
    laborTotal: { type: Number, default: 0 }, // 人工合计
    subtotal: { type: Number, default: 0 }, // 税前合计
    taxAmount: { type: Number, default: 0 }, // 税额
    total: { type: Number, default: 0 }, // 含税总价
    
    // 优惠
    discountAmount: { type: Number, default: 0 },
    discountReason: { type: String },
    finalTotal: { type: Number, default: 0 }, // 最终价格
    
    // 分期
    deposit: { type: Number, default: 0 }, // 定金
    progressPayment: { type: Number, default: 0 }, // 进度款
    finalPayment: { type: Number, default: 0 } // 尾款
  },
  
  // 工期
  schedule: {
    estimatedDays: { type: Number, default: 30 },
    startDate: { type: Date },
    endDate: { type: Date },
    milestones: [{
      name: { type: String },
      day: { type: Number },
      description: { type: String }
    }]
  },
  
  // 质保
  warranty: {
    years: { type: Number, default: 2 },
    coverage: { type: String, default: '整机质保' },
    terms: { type: String }
  },
  
  // 状态
  status: {
    type: String,
    enum: ['draft', 'sent', 'viewed', 'negotiating', 'approved', 'rejected', 'expired'],
    default: 'draft'
  },
  
  // 审批
  approval: {
    submittedBy: { type: String, ref: 'User' },
    submittedAt: { type: Date },
    approvedBy: { type: String, ref: 'User' },
    approvedAt: { type: Date },
    notes: { type: String }
  },
  
  // 客户反馈
  customerFeedback: {
    viewedAt: { type: Date },
    viewedCount: { type: Number, default: 0 },
    response: { type: String },
    respondedAt: { type: Date },
    acceptedItems: [{ type: String }],
    rejectedItems: [{ type: String }],
    negotiatedItems: [{
      itemId: { type: String },
      request: { type: String },
      counterOffer: { type: Number }
    }]
  },
  
  // 关联历史
  history: [{
    version: { type: Number },
    quotationNo: { type: String },
    createdAt: { type: Date },
    reason: { type: String }
  }],
  
  // 文档
  documents: {
    pdfUrl: { type: String },
    generatedAt: { type: Date },
    sentAt: { type: Date },
    emailSubject: { type: String },
    emailBody: { type: String }
  },
  
  // AI分析
  aiAnalysis: {
    competitiveness: { type: Number, min: 0, max: 100 }, // 竞争力评分
    profitMargin: { type: Number }, // 利润率
    marketComparison: { type: String }, // 市场对比
    suggestions: [{ type: String }]
  },
  
  // 创建/更新
  createdBy: { type: String, required: true, ref: 'User' },
  salesRep: { type: String, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
quotationSchema.index({ tenantId: 1, quotationNo: 1 }, { unique: true });
quotationSchema.index({ tenantId: 1, dealerId: 1, status: 1, createdAt: -1 });
quotationSchema.index({ tenantId: 1, storeId: 1, status: 1, createdAt: -1 });
quotationSchema.index({ projectId: 1, status: 1 });
quotationSchema.index({ quotationNo: 1 });
quotationSchema.index({ customerId: 1 });
quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ 'summary.total': 1 });

// 更新钩子
quotationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // 自动计算汇总
  if (this.items && this.items.length > 0) {
    this.summary.materialTotal = this.items.reduce((sum, item) => sum + item.materialSubtotal, 0);
    this.summary.laborTotal = this.items.reduce((sum, item) => sum + item.laborSubtotal, 0);
    this.summary.subtotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
    this.summary.taxAmount = this.items.reduce((sum, item) => sum + item.taxAmount, 0);
    this.summary.total = this.items.reduce((sum, item) => sum + item.total, 0);
    this.summary.finalTotal = this.summary.total - this.summary.discountAmount;
  }
  
  // 计算分期
  this.summary.deposit = this.summary.finalTotal * 0.3;
  this.summary.progressPayment = this.summary.finalTotal * 0.6;
  this.summary.finalPayment = this.summary.finalTotal * 0.1;
  
  // 有效期默认30天
  if (!this.validUntil) {
    this.validUntil = new Date(this.validFrom.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  
  next();
});

// 方法：添加项目
quotationSchema.methods.addItem = function(itemData) {
  const item = {
    itemId: `ITEM${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    ...itemData
  };
  this.items.push(item);
  return this.save();
};

// 方法：克隆报价
quotationSchema.methods.clone = function(reason) {
  const newQuotation = new this.constructor({
    ...this.toObject(),
    _id: undefined,
    quotationNo: `${this.quotationNo}-V${this.version + 1}`,
    version: this.version + 1,
    type: 'revised',
    status: 'draft',
    history: [...this.history, {
      version: this.version,
      quotationNo: this.quotationNo,
      createdAt: this.createdAt,
      reason
    }],
    createdAt: Date.now()
  });
  return newQuotation;
};

// 方法：生成PDF数据
quotationSchema.methods.getPDFData = function() {
  return {
    quotationNo: this.quotationNo,
    version: this.version,
    date: this.createdAt.toLocaleDateString('zh-CN'),
    validUntil: this.validUntil.toLocaleDateString('zh-CN'),
    package: this.packageName,
    customer: this.customerId,
    project: this.projectId,
    items: this.items.map(item => ({
      name: item.materialName,
      model: item.materialModel,
      spec: item.specifications,
      unit: item.unit,
      qty: item.quantity,
      unitPrice: item.unitPrice,
      laborCost: item.laborCost,
      discount: item.discount * 100,
      total: item.total
    })),
    summary: this.summary,
    schedule: this.schedule,
    warranty: this.warranty
  };
};

module.exports = mongoose.model('Quotation', quotationSchema);
