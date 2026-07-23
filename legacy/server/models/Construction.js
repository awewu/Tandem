/**
 * 施工管理模型 - Construction Management Model
 * 对标筑星云施工管理能力
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  taskId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['installation', 'inspection', 'material_delivery', 'testing', 'commissioning'],
    required: true 
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'delayed', 'cancelled'],
    default: 'pending'
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  
  // 时间安排
  plannedStart: { type: Date, required: true },
  plannedEnd: { type: Date, required: true },
  actualStart: { type: Date },
  actualEnd: { type: Date },
  
  // 负责人
  assignedTo: {
    workerId: { type: String, ref: 'Worker' },
    name: { type: String },
    phone: { type: String }
  },
  
  // 工作量
  estimatedHours: { type: Number, default: 0 },
  actualHours: { type: Number, default: 0 },
  
  // 位置
  location: {
    floor: { type: Number },
    room: { type: String },
    description: { type: String }
  },
  
  // 前置任务
  dependencies: [{ type: String, ref: 'Task' }],
  
  // 质量检查清单
  qualityChecklist: [{
    item: { type: String, required: true },
    standard: { type: String, required: true },
    checked: { type: Boolean, default: false },
    passed: { type: Boolean, default: false },
    checkedBy: { type: String },
    checkedAt: { type: Date },
    photoUrl: { type: String },
    notes: { type: String }
  }],
  
  // 安全检查
  safetyChecklist: [{
    item: { type: String, required: true },
    checked: { type: Boolean, default: false },
    checkedAt: { type: Date },
    checkedBy: { type: String }
  }],
  
  // 物料需求
  materials: [{
    materialId: { type: String, ref: 'Material' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    delivered: { type: Boolean, default: false },
    deliveredAt: { type: Date }
  }],
  
  // 问题追踪
  issues: [{
    issueId: { type: String },
    type: { type: String, enum: ['quality', 'safety', 'delay', 'material', 'other'] },
    description: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    status: { type: String, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' },
    reportedBy: { type: String },
    reportedAt: { type: Date, default: Date.now },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    photos: [{ type: String }]
  }],
  
  // 进度照片
  progressPhotos: [{
    url: { type: String, required: true },
    takenAt: { type: Date, default: Date.now },
    takenBy: { type: String },
    description: { type: String }
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const constructionSchema = new mongoose.Schema({
  projectId: { type: String, required: true, ref: 'Project', index: true },
  
  // 基本信息
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'],
    default: 'planning'
  },
  
  // 合同信息
  contract: {
    contractNo: { type: String },
    signedDate: { type: Date },
    startDate: { type: Date, required: true },
    plannedEndDate: { type: Date, required: true },
    actualEndDate: { type: Date },
    totalValue: { type: Number, default: 0 },
    paymentTerms: { type: String }
  },
  
  // 施工班组
  teams: [{
    teamId: { type: String },
    name: { type: String, required: true },
    leader: {
      workerId: { type: String },
      name: { type: String },
      phone: { type: String },
      certification: { type: String }
    },
    workers: [{ type: String, ref: 'Worker' }],
    specialty: { type: String, enum: ['hvac', 'plumbing', 'electrical', 'general'] },
    rating: { type: Number, min: 1, max: 5 }
  }],
  
  // 甘特图任务
  tasks: [taskSchema],
  
  // 里程碑
  milestones: [{
    name: { type: String, required: true },
    plannedDate: { type: Date, required: true },
    actualDate: { type: Date },
    status: { type: String, enum: ['pending', 'reached', 'missed'], default: 'pending' },
    deliverables: [{ type: String }],
    approvedBy: { type: String },
    notes: { type: String }
  }],
  
  // 进度统计
  progress: {
    totalTasks: { type: Number, default: 0 },
    completedTasks: { type: Number, default: 0 },
    inProgressTasks: { type: Number, default: 0 },
    delayedTasks: { type: Number, default: 0 },
    overallPercentage: { type: Number, default: 0, min: 0, max: 100 },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // 质量统计
  quality: {
    totalChecks: { type: Number, default: 0 },
    passedChecks: { type: Number, default: 0 },
    failedChecks: { type: Number, default: 0 },
    issuesOpen: { type: Number, default: 0 },
    issuesResolved: { type: Number, default: 0 },
    lastInspection: { type: Date }
  },
  
  // 安全统计
  safety: {
    totalChecks: { type: Number, default: 0 },
    incidents: { type: Number, default: 0 },
    nearMisses: { type: Number, default: 0 },
    lastInspection: { type: Date },
    safetyScore: { type: Number, default: 100, min: 0, max: 100 }
  },
  
  // 物料统计
  materials: {
    totalItems: { type: Number, default: 0 },
    deliveredItems: { type: Number, default: 0 },
    pendingItems: { type: Number, default: 0 },
    totalValue: { type: Number, default: 0 }
  },
  
  // 变更管理
  changeOrders: [{
    changeId: { type: String },
    type: { type: String, enum: ['design', 'material', 'scope', 'delay'] },
    description: { type: String, required: true },
    reason: { type: String },
    impactCost: { type: Number, default: 0 },
    impactSchedule: { type: Number, default: 0 }, // days
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'implemented'], default: 'pending' },
    requestedBy: { type: String },
    requestedAt: { type: Date, default: Date.now },
    approvedBy: { type: String },
    approvedAt: { type: Date }
  }],
  
  // 文档
  documents: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['drawing', 'permit', 'inspection_report', 'photo', 'contract', 'other'] },
    url: { type: String, required: true },
    uploadedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  // 沟通记录
  communications: [{
    type: { type: String, enum: ['meeting', 'call', 'email', 'site_visit', 'other'] },
    date: { type: Date, default: Date.now },
    participants: [{ type: String }],
    summary: { type: String },
    actionItems: [{ type: String }],
    recordedBy: { type: String }
  }],
  
  createdBy: { type: String, required: true, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// 索引
constructionSchema.index({ projectId: 1, status: 1 });
constructionSchema.index({ 'contract.startDate': 1 });
constructionSchema.index({ 'tasks.assignedTo.workerId': 1 });

// 更新钩子
constructionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // 自动计算进度统计
  if (this.tasks && this.tasks.length > 0) {
    this.progress.totalTasks = this.tasks.length;
    this.progress.completedTasks = this.tasks.filter(t => t.status === 'completed').length;
    this.progress.inProgressTasks = this.tasks.filter(t => t.status === 'in_progress').length;
    this.progress.delayedTasks = this.tasks.filter(t => t.status === 'delayed').length;
    this.progress.overallPercentage = Math.round(
      (this.progress.completedTasks / this.progress.totalTasks) * 100
    );
  }
  
  next();
});

// 方法：获取甘特图数据
constructionSchema.methods.getGanttData = function() {
  return this.tasks.map(task => ({
    id: task.taskId,
    name: task.name,
    start: task.plannedStart,
    end: task.plannedEnd,
    actualStart: task.actualStart,
    actualEnd: task.actualEnd,
    progress: task.status === 'completed' ? 100 : 
                task.status === 'in_progress' ? 50 : 0,
    status: task.status,
    dependencies: task.dependencies,
    assignee: task.assignedTo?.name
  }));
};

// 方法：获取关键路径
constructionSchema.methods.getCriticalPath = function() {
  // 简化的关键路径计算
  const incompleteTasks = this.tasks.filter(t => t.status !== 'completed');
  const criticalTasks = incompleteTasks.filter(t => 
    t.dependencies.length === 0 || 
    t.dependencies.some(depId => {
      const dep = this.tasks.find(dt => dt.taskId === depId);
      return dep && dep.status !== 'completed';
    })
  );
  return criticalTasks.map(t => t.taskId);
};

module.exports = mongoose.model('Construction', constructionSchema);
