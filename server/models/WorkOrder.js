const mongoose = require('mongoose')

// 工单管理数据模型（运维售后）
const workOrderSchema = new mongoose.Schema({
  // 工单编号
  code: { type: String, unique: true, required: true },
  
  // 关联信息
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'ConstructionSite' },
  customer: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    address: String,
    wechat: String
  },
  
  // 工单类型
  type: {
    type: String,
    enum: ['installation', 'repair', 'maintenance', 'inspection', 'consultation', 'complaint'],
    required: true
  },
  
  // 工单来源
  source: {
    type: String,
    enum: ['phone', 'wechat', 'app', 'web', 'scheduled', 'internal'],
    default: 'phone'
  },
  
  // 问题描述
  problem: {
    category: String, // 问题分类
    description: { type: String, required: true },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    photos: [String], // 问题照片
    voiceUrl: String // 语音描述
  },
  
  // 设备信息
  equipment: {
    name: String,
    model: String,
    serialNumber: String,
    installDate: Date,
    warrantyStatus: { type: String, enum: ['in_warranty', 'out_warranty', 'extended'] }
  },
  
  // 工单状态
  status: {
    type: String,
    enum: ['pending', 'assigned', 'accepted', 'in_progress', 'paused', 'completed', 'closed', 'cancelled'],
    default: 'pending'
  },
  
  // 处理流程
  workflow: [{
    stage: String,
    status: String,
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: Date,
    completedAt: Date,
    duration: Number, // 耗时(分钟)
    remarks: String
  }],
  
  // 派单信息
  assignment: {
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    acceptedAt: Date,
    scheduledTime: Date // 预约上门时间
  },
  
  // 现场服务
  service: {
    arrivedAt: Date,
    completedAt: Date,
    duration: Number, // 服务时长(分钟)
    diagnosis: String, // 故障诊断
    solution: String, // 解决方案
    actions: [String], // 处理措施
    replacedParts: [{
      name: String,
      code: String,
      quantity: Number,
      price: Number
    }],
    photos: {
      before: [String],
      during: [String],
      after: [String]
    },
    customerSignature: String, // 客户签名
    customerRating: { type: Number, min: 1, max: 5 }, // 客户评价
    customerComment: String
  },
  
  // 费用信息
  cost: {
    labor: { type: Number, default: 0 }, // 人工费
    materials: { type: Number, default: 0 }, // 材料费
    parts: { type: Number, default: 0 }, // 配件费
    other: { type: Number, default: 0 }, // 其他费用
    total: { type: Number, default: 0 }, // 合计
    isCharged: { type: Boolean, default: false },
    paidAt: Date
  },
  
  // 回访记录
  followUp: {
    calledAt: Date,
    result: { type: String, enum: ['satisfied', 'unsatisfied', 'unreachable', 'refused'] },
    remarks: String,
    calledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  
  // SLA指标
  sla: {
    responseTime: Number, // 响应时间(分钟)
    resolveTime: Number, // 解决时间(分钟)
    isBreached: { type: Boolean, default: false }, // 是否超时
    breachReason: String
  },
  
  // 创建更新
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
})

// 索引
workOrderSchema.index({ code: 1 })
workOrderSchema.index({ status: 1 })
workOrderSchema.index({ 'assignment.technician': 1 })
workOrderSchema.index({ 'customer.phone': 1 })
workOrderSchema.index({ createdAt: -1 })

// 自动生成工单编号
workOrderSchema.pre('save', async function(next) {
  if (!this.code) {
    const date = new Date()
    const prefix = 'WO' + date.getFullYear().toString().slice(-2)
    const count = await mongoose.model('WorkOrder').countDocuments({
      createdAt: { $gte: new Date(date.getFullYear(), date.getMonth(), 1) }
    })
    this.code = `${prefix}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(4, '0')}`
  }
  next()
})

module.exports = mongoose.model('WorkOrder', workOrderSchema)
