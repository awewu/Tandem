const express = require('express')
const WorkOrder = require('../models/WorkOrder')
const { auth } = require('../middleware/auth')
const router = express.Router()

// 获取工单列表
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, priority, technician, keyword } = req.query
    
    const query = {}
    if (status && status !== 'all') query.status = status
    if (type && type !== 'all') query.type = type
    if (priority && priority !== 'all') query['problem.priority'] = priority
    if (technician) query['assignment.technician'] = technician
    if (keyword) {
      query.$or = [
        { code: { $regex: keyword, $options: 'i' } },
        { 'customer.name': { $regex: keyword, $options: 'i' } },
        { 'customer.phone': { $regex: keyword, $options: 'i' } },
        { 'problem.description': { $regex: keyword, $options: 'i' } }
      ]
    }
    
    const orders = await WorkOrder.find(query)
      .populate('project', 'name')
      .populate('assignment.technician', 'name phone')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
    
    const total = await WorkOrder.countDocuments(query)
    
    res.json({
      success: true,
      data: { orders, total, page: parseInt(page), pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('获取工单列表错误:', error)
    res.status(500).json({ success: false, message: '获取工单列表失败' })
  }
})

// 创建工单
router.post('/', auth, async (req, res) => {
  try {
    const order = new WorkOrder({
      ...req.body,
      createdBy: req.user.userId,
      status: 'pending'
    })
    await order.save()
    res.status(201).json({ success: true, data: { order } })
  } catch (error) {
    console.error('创建工单错误:', error)
    res.status(500).json({ success: false, message: '创建工单失败' })
  }
})

// 获取工单详情
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await WorkOrder.findById(req.params.id)
      .populate('project')
      .populate('site')
      .populate('assignment.technician', 'name phone')
      .populate('assignment.assignedBy', 'name')
      .populate('service.technician', 'name')
      .populate('followUp.calledBy', 'name')
      .populate('createdBy', 'name')
    
    if (!order) return res.status(404).json({ success: false, message: '工单不存在' })
    
    res.json({ success: true, data: { order } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取工单详情失败' })
  }
})

// 派单
router.post('/:id/assign', auth, async (req, res) => {
  try {
    const { technicianId, scheduledTime } = req.body
    const order = await WorkOrder.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: '工单不存在' })
    
    order.assignment = {
      technician: technicianId,
      assignedBy: req.user.userId,
      assignedAt: new Date(),
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null
    }
    order.status = 'assigned'
    order.workflow.push({
      stage: 'assign',
      status: 'completed',
      operator: req.user.userId,
      startedAt: new Date(),
      completedAt: new Date()
    })
    
    await order.save()
    res.json({ success: true, data: { order } })
  } catch (error) {
    res.status(500).json({ success: false, message: '派单失败' })
  }
})

// 接单
router.post('/:id/accept', auth, async (req, res) => {
  try {
    const order = await WorkOrder.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: '工单不存在' })
    
    order.assignment.acceptedAt = new Date()
    order.status = 'accepted'
    order.workflow.push({
      stage: 'accept',
      status: 'completed',
      operator: req.user.userId,
      startedAt: new Date(),
      completedAt: new Date()
    })
    
    await order.save()
    res.json({ success: true, data: { order } })
  } catch (error) {
    res.status(500).json({ success: false, message: '接单失败' })
  }
})

// 开始服务
router.post('/:id/start', auth, async (req, res) => {
  try {
    const order = await WorkOrder.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: '工单不存在' })
    
    order.service.arrivedAt = new Date()
    order.status = 'in_progress'
    order.workflow.push({
      stage: 'service',
      status: 'in_progress',
      operator: req.user.userId,
      startedAt: new Date()
    })
    
    await order.save()
    res.json({ success: true, data: { order } })
  } catch (error) {
    res.status(500).json({ success: false, message: '开始服务失败' })
  }
})

// 完成服务
router.post('/:id/complete', auth, async (req, res) => {
  try {
    const { diagnosis, solution, actions, replacedParts, photos, customerRating, customerComment } = req.body
    const order = await WorkOrder.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: '工单不存在' })
    
    const now = new Date()
    const duration = order.service.arrivedAt 
      ? Math.round((now - order.service.arrivedAt) / 60000) 
      : 0
    
    order.service = {
      ...order.service,
      completedAt: now,
      duration,
      diagnosis,
      solution,
      actions,
      replacedParts: replacedParts || [],
      photos: photos || {},
      customerRating,
      customerComment
    }
    order.status = 'completed'
    
    // 更新工作流
    const serviceStage = order.workflow.find(w => w.stage === 'service')
    if (serviceStage) {
      serviceStage.status = 'completed'
      serviceStage.completedAt = now
      serviceStage.duration = duration
    }
    
    await order.save()
    res.json({ success: true, data: { order } })
  } catch (error) {
    res.status(500).json({ success: false, message: '完成服务失败' })
  }
})

// 回访
router.post('/:id/followup', auth, async (req, res) => {
  try {
    const { result, remarks } = req.body
    const order = await WorkOrder.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: '工单不存在' })
    
    order.followUp = {
      calledAt: new Date(),
      result,
      remarks,
      calledBy: req.user.userId
    }
    order.status = 'closed'
    
    await order.save()
    res.json({ success: true, data: { order } })
  } catch (error) {
    res.status(500).json({ success: false, message: '回访失败' })
  }
})

// 更新费用
router.post('/:id/cost', auth, async (req, res) => {
  try {
    const { labor, materials, parts, other } = req.body
    const order = await WorkOrder.findById(req.params.id)
    if (!order) return res.status(404).json({ success: false, message: '工单不存在' })
    
    order.cost = {
      labor: labor || 0,
      materials: materials || 0,
      parts: parts || 0,
      other: other || 0,
      total: (labor || 0) + (materials || 0) + (parts || 0) + (other || 0)
    }
    
    await order.save()
    res.json({ success: true, data: { order } })
  } catch (error) {
    res.status(500).json({ success: false, message: '更新费用失败' })
  }
})

// 工单统计
router.get('/statistics/overview', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    
    const dateQuery = {}
    if (startDate || endDate) {
      dateQuery.createdAt = {}
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate)
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate)
    }
    
    // 状态分布
    const statusStats = await WorkOrder.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    
    // 类型分布
    const typeStats = await WorkOrder.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ])
    
    // 满意度统计
    const ratingStats = await WorkOrder.aggregate([
      { $match: { ...dateQuery, 'service.customerRating': { $exists: true } } },
      { $group: { _id: '$service.customerRating', count: { $sum: 1 } } }
    ])
    
    // SLA统计
    const slaStats = await WorkOrder.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$sla.isBreached', count: { $sum: 1 } } }
    ])
    
    res.json({
      success: true,
      data: {
        status: statusStats,
        type: typeStats,
        rating: ratingStats,
        sla: slaStats
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计失败' })
  }
})

// 我的工单（技术员视角）
router.get('/my/list', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query
    
    const query = { 'assignment.technician': req.user.userId }
    if (status && status !== 'all') query.status = status
    
    const orders = await WorkOrder.find(query)
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
    
    const total = await WorkOrder.countDocuments(query)
    
    res.json({
      success: true,
      data: { orders, total, page: parseInt(page), pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取我的工单失败' })
  }
})

module.exports = router
