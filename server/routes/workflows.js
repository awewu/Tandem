/**
 * 【BW2/BW3交付物】工作流API路由
 * 提供流程定义、实例管理、任务处理接口
 */

const express = require('express')
const { Workflow, WorkflowInstance } = require('../models/Workflow')
const { auth } = require('../middleware/auth')
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess')
const router = express.Router()

let hooksRegistered = false

function getEngine() {
  const engine = getRuntimeEngine('workflowEngine')
  if (!hooksRegistered) {
    registerDefaultHooks(engine)
    hooksRegistered = true
  }
  return engine
}

function registerDefaultHooks(workflowEngine) {
// 注册默认钩子
workflowEngine.registerHook('notifyAssignee', async (instance, context) => {
  console.log(`[Hook] Notifying assignee: ${context.assignee} for task ${context.node.name}`)
  
  // 实现通知逻辑（邮件/短信/推送）
  try {
    // 邮件通知
    if (context.assignee.email) {
      await sendEmailNotification({
        to: context.assignee.email,
        subject: `任务分配: ${context.node.name}`,
        body: `您被分配了新任务: ${context.node.name}\n工作流: ${instance.workflow.name}\n实例ID: ${instance.id}`
      })
    }
    
    // 短信通知
    if (context.assignee.phone) {
      await sendSMSNotification({
        to: context.assignee.phone,
        message: `您被分配了新任务: ${context.node.name}`
      })
    }
    
    // 推送通知
    if (context.assignee.pushToken) {
      await sendPushNotification({
        to: context.assignee.pushToken,
        title: `任务分配: ${context.node.name}`,
        body: `您被分配了新任务`
      })
    }
  } catch (error) {
    console.error('[Hook] 通知发送失败:', error)
    // 不阻塞工作流，仅记录错误
  }
})

workflowEngine.registerHook('logAction', async (instance, context) => {
  console.log(`[Hook] Action logged for workflow ${instance._id}`)
})
}

// ========== 流程定义API ==========

// 获取流程列表
router.get('/', auth, async (req, res) => {
  try {
    const { category, status = 'published' } = req.query
    
    const query = { status, isLatest: true }
    if (category) query.category = category
    
    const workflows = await Workflow.find(query)
      .select('name code category description version createdAt')
      .sort({ createdAt: -1 })
    
    res.json({ success: true, data: { workflows } })
  } catch (error) {
    console.error('获取流程列表错误:', error)
    res.status(500).json({ success: false, message: '获取流程列表失败' })
  }
})

// 创建流程定义
router.post('/', auth, async (req, res) => {
  try {
    const workflowData = {
      ...req.body,
      createdBy: req.user.userId,
      version: 1,
      isLatest: true
    }
    
    const workflow = new Workflow(workflowData)
    await workflow.save()
    
    res.status(201).json({ success: true, data: { workflow } })
  } catch (error) {
    console.error('创建流程错误:', error)
    res.status(500).json({ success: false, message: '创建流程失败' })
  }
})

// 获取流程详情
router.get('/:id', auth, async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) {
      return res.status(404).json({ success: false, message: '流程不存在' })
    }
    
    res.json({ success: true, data: { workflow } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取流程详情失败' })
  }
})

// 更新流程
router.put('/:id', auth, async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) {
      return res.status(404).json({ success: false, message: '流程不存在' })
    }
    
    // 如果流程已发布，创建新版本
    if (workflow.status === 'published') {
      const newVersion = workflow.version + 1
      const newWorkflow = new Workflow({
        ...workflow.toObject(),
        ...req.body,
        _id: undefined,
        version: newVersion,
        status: 'draft',
        createdBy: req.user.userId
      })
      await newWorkflow.save()
      
      // 更新旧版本
      workflow.isLatest = false
      await workflow.save()
      
      return res.json({ success: true, data: { workflow: newWorkflow } })
    }
    
    // 草稿状态直接更新
    Object.assign(workflow, req.body)
    workflow.updatedBy = req.user.userId
    await workflow.save()
    
    res.json({ success: true, data: { workflow } })
  } catch (error) {
    res.status(500).json({ success: false, message: '更新流程失败' })
  }
})

// 发布流程
router.post('/:id/publish', auth, async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) {
      return res.status(404).json({ success: false, message: '流程不存在' })
    }
    
    workflow.status = 'published'
    workflow.updatedBy = req.user.userId
    await workflow.save()
    
    res.json({ success: true, data: { workflow } })
  } catch (error) {
    res.status(500).json({ success: false, message: '发布流程失败' })
  }
})

// ========== 流程实例API ==========

// 启动流程实例
router.post('/:id/start', auth, async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
    if (!workflow) {
      return res.status(404).json({ success: false, message: '流程不存在' })
    }
    
    if (workflow.status !== 'published') {
      return res.status(400).json({ success: false, message: '流程未发布' })
    }
    
    const { businessType, businessId, title, description, variables } = req.body
    
    // 使用工作流引擎启动实例
    const instanceData = await getEngine().startInstance(workflow, {
      type: businessType,
      id: businessId,
      title,
      description,
      initiator: req.user.userId,
      variables
    })
    
    // 保存实例到数据库
    const instance = new WorkflowInstance(instanceData)
    await instance.save()
    
    res.status(201).json({ success: true, data: { instance } })
  } catch (error) {
    console.error('启动流程实例错误:', error)
    res.status(500).json({ success: false, message: error.message || '启动流程实例失败' })
  }
})

// 获取流程实例列表
router.get('/instances/list', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      businessType,
      initiator 
    } = req.query
    
    const query = {}
    if (status) query.status = status
    if (businessType) query.businessType = businessType
    if (initiator) query.initiator = initiator
    
    const instances = await WorkflowInstance.find(query)
      .populate('workflow', 'name code')
      .populate('initiator', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
    
    const total = await WorkflowInstance.countDocuments(query)
    
    res.json({
      success: true,
      data: { instances, total, page: parseInt(page), pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('获取流程实例列表错误:', error)
    res.status(500).json({ success: false, message: '获取流程实例列表失败' })
  }
})

// 获取流程实例详情
router.get('/instances/:id', auth, async (req, res) => {
  try {
    const instance = await WorkflowInstance.findById(req.params.id)
      .populate('workflow')
      .populate('initiator', 'name')
      .populate('tasks.assignee', 'name')
    
    if (!instance) {
      return res.status(404).json({ success: false, message: '流程实例不存在' })
    }
    
    res.json({ success: true, data: { instance } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取流程实例详情失败' })
  }
})

// 获取我的待办任务
router.get('/tasks/my', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    
    const instances = await WorkflowInstance.find({
      'tasks.assignee': req.user.userId,
      'tasks.status': 'pending'
    })
      .populate('workflow', 'name code')
      .populate('initiator', 'name')
      .sort({ 'tasks.createdAt': -1 })
    
    // 提取待办任务
    const tasks = []
    instances.forEach(instance => {
      instance.tasks
        .filter(t => t.assignee?.toString() === req.user.userId && t.status === 'pending')
        .forEach(t => {
          tasks.push({
            _id: `${instance._id}_${t.nodeId}`,
            instanceId: instance._id,
            workflow: instance.workflow,
            businessType: instance.businessType,
            businessId: instance.businessId,
            title: instance.title,
            nodeId: t.nodeId,
            nodeName: t.nodeName,
            status: t.status,
            createdAt: t.createdAt
          })
        })
    })
    
    // 分页
    const total = tasks.length
    const paginatedTasks = tasks.slice((page - 1) * limit, page * limit)
    
    res.json({
      success: true,
      data: { tasks: paginatedTasks, total, page: parseInt(page) }
    })
  } catch (error) {
    console.error('获取待办任务错误:', error)
    res.status(500).json({ success: false, message: '获取待办任务失败' })
  }
})

// 完成任务
router.post('/instances/:id/complete', auth, async (req, res) => {
  try {
    const { nodeId, formData } = req.body
    
    const instance = await WorkflowInstance.findById(req.params.id)
    if (!instance) {
      return res.status(404).json({ success: false, message: '流程实例不存在' })
    }
    
    const workflow = await Workflow.findById(instance.workflow)
    
    // 使用引擎完成任务
    await getEngine().completeTask(instance, workflow, nodeId, formData, req.user.userId)
    
    // 保存更新后的实例
    await instance.save()
    
    res.json({ success: true, data: { instance } })
  } catch (error) {
    console.error('完成任务错误:', error)
    res.status(500).json({ success: false, message: error.message || '完成任务失败' })
  }
})

// 转交任务
router.post('/instances/:id/transfer', auth, async (req, res) => {
  try {
    const { nodeId, newAssignee } = req.body
    
    const instance = await WorkflowInstance.findById(req.params.id)
    if (!instance) {
      return res.status(404).json({ success: false, message: '流程实例不存在' })
    }
    
    const task = instance.tasks.find(t => t.nodeId === nodeId)
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' })
    }
    
    task.assignee = newAssignee
    task.status = 'transferred'
    await instance.save()
    
    res.json({ success: true, data: { instance } })
  } catch (error) {
    res.status(500).json({ success: false, message: '转交任务失败' })
  }
})

// 终止流程
router.post('/instances/:id/terminate', auth, async (req, res) => {
  try {
    const { reason } = req.body
    
    const instance = await WorkflowInstance.findById(req.params.id)
    if (!instance) {
      return res.status(404).json({ success: false, message: '流程实例不存在' })
    }
    
    instance.status = 'terminated'
    instance.terminateReason = reason
    instance.completedAt = new Date()
    await instance.save()
    
    res.json({ success: true, data: { instance } })
  } catch (error) {
    res.status(500).json({ success: false, message: '终止流程失败' })
  }
})

module.exports = router
