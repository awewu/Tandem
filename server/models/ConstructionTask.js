const mongoose = require('mongoose')

// 施工任务/工序管理数据模型
const constructionTaskSchema = new mongoose.Schema({
  // 基础信息
  name: { type: String, required: true },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'ConstructionSite', required: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  
  // 任务类型
  type: {
    type: String,
    enum: ['water_heating', 'heating', 'ventilation', 'water_treatment', 'smart_control', 'other'],
    required: true
  },
  
  // 任务分类
  category: {
    type: String,
    enum: ['installation', 'debugging', 'inspection', 'maintenance', 'repair'],
    required: true
  },
  
  // 工序标准
  procedure: {
    code: String, // 工序编码
    name: String,
    standard: String, // 施工标准
    acceptanceCriteria: [String] // 验收标准
  },
  
  // 状态
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'paused', 'completed', 'cancelled'],
    default: 'pending'
  },
  
  // 时间安排
  schedule: {
    plannedStart: Date,
    plannedEnd: Date,
    actualStart: Date,
    actualEnd: Date,
    duration: Number // 计划工期(天)
  },
  
  // 负责人
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // 施工团队
  
  // 前置任务
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ConstructionTask' }],
  
  // 资源需求
  resources: {
    materials: [{
      name: String,
      quantity: Number,
      unit: String,
      provided: { type: Boolean, default: false }
    }],
    tools: [String],
    equipment: [String]
  },
  
  // 验收信息
  acceptance: {
    status: { type: String, enum: ['pending', 'passed', 'failed', 'partial'] },
    inspectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    inspectedAt: Date,
    score: { type: Number, min: 0, max: 100 },
    issues: [{
      description: String,
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      status: { type: String, enum: ['open', 'in_progress', 'resolved'] },
      photos: [String],
      resolvedAt: Date
    }],
    remarks: String
  },
  
  // 现场记录
  siteLogs: [{
    date: Date,
    content: String,
    progress: Number,
    photos: [String],
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  
  // 质量检查
  qualityChecks: [{
    item: String,
    standard: String,
    result: { type: String, enum: ['pass', 'fail', 'na'] },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedAt: Date,
    photos: [String],
    remarks: String
  }],
  
  // 安全检查
  safetyChecks: [{
    item: String,
    result: { type: String, enum: ['pass', 'fail', 'na'] },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedAt: Date,
    remarks: String
  }],
  
  // 创建更新
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
})

// 索引
constructionTaskSchema.index({ site: 1 })
constructionTaskSchema.index({ project: 1 })
constructionTaskSchema.index({ status: 1 })
constructionTaskSchema.index({ assignee: 1 })
constructionTaskSchema.index({ 'schedule.plannedStart': 1 })

module.exports = mongoose.model('ConstructionTask', constructionTaskSchema)
