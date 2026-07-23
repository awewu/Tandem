/**
 * 【BW1/BW2交付物】工作流引擎数据模型
 * 复刻自 ferry 工单系统核心
 * 适配HVAC行业施工流程
 */

const mongoose = require('mongoose')

// 流程定义
const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, required: true },
  category: { 
    type: String, 
    enum: ['construction', 'workorder', 'crm', 'other'],
    required: true 
  },
  description: String,
  
  // 流程节点
  nodes: [{
    id: String,           // 节点ID
    name: String,         // 节点名称
    type: {               // 节点类型
      type: String,
      enum: ['start', 'task', 'approval', 'gateway', 'end']
    },
    position: { x: Number, y: Number },  // 画布位置
    
    // 任务节点配置
    config: {
      assigneeType: {     // 处理人类型
        type: String,
        enum: ['user', 'role', 'variable', 'auto']
      },
      assignee: String,   // 处理人ID/角色/变量名
      formId: String,     // 关联表单
      duration: Number,   // 预计处理时长(小时)
      
      // 网关配置
      conditions: [{      // 条件分支
        expression: String,
        targetNode: String
      }]
    },
    
    // hooks - 任务钩子
    hooks: {
      onEnter: [String],  // 进入时触发
      onExecute: [String], // 执行时触发
      onExit: [String]    // 退出时触发
    }
  }],
  
  // 流程连线
  edges: [{
    id: String,
    source: String,       // 起点节点ID
    target: String,       // 终点节点ID
    label: String,        // 连线标签
    condition: String     // 条件表达式
  }],
  
  // 流程变量定义
  variables: [{
    name: String,
    type: { type: String, enum: ['string', 'number', 'boolean', 'date'] },
    defaultValue: mongoose.Schema.Types.Mixed,
    required: Boolean
  }],
  
  // 状态
  status: {
    type: String,
    enum: ['draft', 'published', 'deprecated'],
    default: 'draft'
  },
  
  // 版本控制
  version: { type: Number, default: 1 },
  isLatest: { type: Boolean, default: true },
  
  // 创建更新
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

// 流程实例
const workflowInstanceSchema = new mongoose.Schema({
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  workflowVersion: Number,
  
  // 业务关联
  businessType: { type: String, required: true },  // 'construction', 'workorder'
  businessId: { type: mongoose.Schema.Types.ObjectId, required: true },
  
  // 流程标题
  title: { type: String, required: true },
  description: String,
  
  // 发起人
  initiator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // 流程变量值
  variables: [{
    name: String,
    value: mongoose.Schema.Types.Mixed
  }],
  
  // 当前状态
  status: {
    type: String,
    enum: ['running', 'completed', 'terminated', 'suspended'],
    default: 'running'
  },
  
  // 当前节点
  currentNode: String,
  
  // 节点执行历史
  history: [{
    nodeId: String,
    nodeName: String,
    action: { type: String, enum: ['enter', 'execute', 'exit'] },
    operator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    duration: Number,        // 执行时长(分钟)
    formData: mongoose.Schema.Types.Mixed,
    remarks: String,
    nextNode: String
  }],
  
  // 待办任务
  tasks: [{
    nodeId: String,
    nodeName: String,
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { 
      type: String, 
      enum: ['pending', 'processing', 'completed', 'transferred'],
      default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    completedAt: Date,
    formData: mongoose.Schema.Types.Mixed,
    remarks: String
  }],
  
  // 时间记录
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  
  // SLA监控
  sla: {
    deadline: Date,
    warningTime: Date,
    isBreached: { type: Boolean, default: false }
  }
}, { timestamps: true })

// 索引
workflowSchema.index({ code: 1, version: -1 })
workflowSchema.index({ category: 1, status: 1 })
workflowSchema.index({ isLatest: 1 })

workflowInstanceSchema.index({ workflow: 1 })
workflowInstanceSchema.index({ businessType: 1, businessId: 1 })
workflowInstanceSchema.index({ initiator: 1 })
workflowInstanceSchema.index({ status: 1 })
workflowInstanceSchema.index({ 'tasks.assignee': 1, 'tasks.status': 1 })

module.exports = {
  Workflow: mongoose.model('Workflow', workflowSchema),
  WorkflowInstance: mongoose.model('WorkflowInstance', workflowInstanceSchema)
}
