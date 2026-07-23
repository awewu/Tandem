const express = require('express')
const ConstructionSite = require('../models/ConstructionSite')
const ConstructionTask = require('../models/ConstructionTask')
const { auth } = require('../middleware/auth')
const router = express.Router()

// ========== 工地管理 API ==========

// 获取工地列表
router.get('/sites', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, city, keyword } = req.query
    
    const query = {}
    if (status && status !== 'all') query.status = status
    if (city) query['address.city'] = city
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { code: { $regex: keyword, $options: 'i' } },
        { 'customer.name': { $regex: keyword, $options: 'i' } }
      ]
    }
    
    const sites = await ConstructionSite.find(query)
      .populate('project', 'name')
      .populate('manager', 'name')
      .populate('supervisor', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
    
    const total = await ConstructionSite.countDocuments(query)
    
    res.json({
      success: true,
      data: { sites, total, page: parseInt(page), pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('获取工地列表错误:', error)
    res.status(500).json({ success: false, message: '获取工地列表失败' })
  }
})

// 创建工地
router.post('/sites', auth, async (req, res) => {
  try {
    const site = new ConstructionSite({
      ...req.body,
      createdBy: req.user.userId
    })
    await site.save()
    res.status(201).json({ success: true, data: { site } })
  } catch (error) {
    console.error('创建工地错误:', error)
    res.status(500).json({ success: false, message: '创建工地失败' })
  }
})

// 获取工地详情
router.get('/sites/:id', auth, async (req, res) => {
  try {
    const site = await ConstructionSite.findById(req.params.id)
      .populate('project')
      .populate('manager', 'name phone')
      .populate('supervisor', 'name phone')
      .populate('createdBy', 'name')
    
    if (!site) return res.status(404).json({ success: false, message: '工地不存在' })
    
    res.json({ success: true, data: { site } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取工地详情失败' })
  }
})

// 更新工地
router.put('/sites/:id', auth, async (req, res) => {
  try {
    const site = await ConstructionSite.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.userId },
      { new: true }
    )
    if (!site) return res.status(404).json({ success: false, message: '工地不存在' })
    res.json({ success: true, data: { site } })
  } catch (error) {
    res.status(500).json({ success: false, message: '更新工地失败' })
  }
})

// 添加工地照片
router.post('/sites/:id/photos', auth, async (req, res) => {
  try {
    const { url, type, description, location } = req.body
    const site = await ConstructionSite.findById(req.params.id)
    if (!site) return res.status(404).json({ success: false, message: '工地不存在' })
    
    site.photos.push({
      url,
      type,
      description,
      location,
      takenBy: req.user.userId
    })
    await site.save()
    
    res.json({ success: true, data: { photos: site.photos } })
  } catch (error) {
    res.status(500).json({ success: false, message: '添加照片失败' })
  }
})

// 更新工地进度
router.post('/sites/:id/progress', auth, async (req, res) => {
  try {
    const { stage, percentage, description } = req.body
    const site = await ConstructionSite.findById(req.params.id)
    if (!site) return res.status(404).json({ success: false, message: '工地不存在' })
    
    site.progress.push({
      stage,
      percentage,
      description,
      updatedBy: req.user.userId
    })
    site.stage = stage
    await site.save()
    
    res.json({ success: true, data: { progress: site.progress } })
  } catch (error) {
    res.status(500).json({ success: false, message: '更新进度失败' })
  }
})

// ========== 施工任务 API ==========

// 获取任务列表
router.get('/tasks', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, site, status, assignee } = req.query
    
    const query = {}
    if (site) query.site = site
    if (status && status !== 'all') query.status = status
    if (assignee) query.assignee = assignee
    
    const tasks = await ConstructionTask.find(query)
      .populate('site', 'name address')
      .populate('assignee', 'name')
      .populate('project', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
    
    const total = await ConstructionTask.countDocuments(query)
    
    res.json({
      success: true,
      data: { tasks, total, page: parseInt(page), pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取任务列表失败' })
  }
})

// 创建任务
router.post('/tasks', auth, async (req, res) => {
  try {
    const task = new ConstructionTask({
      ...req.body,
      createdBy: req.user.userId
    })
    await task.save()
    res.status(201).json({ success: true, data: { task } })
  } catch (error) {
    res.status(500).json({ success: false, message: '创建任务失败' })
  }
})

// 获取任务详情
router.get('/tasks/:id', auth, async (req, res) => {
  try {
    const task = await ConstructionTask.findById(req.params.id)
      .populate('site')
      .populate('assignee', 'name phone')
      .populate('team', 'name')
      .populate('project')
    
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' })
    res.json({ success: true, data: { task } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取任务详情失败' })
  }
})

// 更新任务
router.put('/tasks/:id', auth, async (req, res) => {
  try {
    const task = await ConstructionTask.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user.userId },
      { new: true }
    )
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' })
    res.json({ success: true, data: { task } })
  } catch (error) {
    res.status(500).json({ success: false, message: '更新任务失败' })
  }
})

// 任务验收
router.post('/tasks/:id/acceptance', auth, async (req, res) => {
  try {
    const { status, score, issues, remarks } = req.body
    const task = await ConstructionTask.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' })
    
    task.acceptance = {
      status,
      score,
      issues: issues || [],
      remarks,
      inspectedBy: req.user.userId,
      inspectedAt: new Date()
    }
    
    if (status === 'passed') {
      task.status = 'completed'
    }
    
    await task.save()
    res.json({ success: true, data: { task } })
  } catch (error) {
    res.status(500).json({ success: false, message: '验收失败' })
  }
})

// 添加现场日志
router.post('/tasks/:id/logs', auth, async (req, res) => {
  try {
    const { content, progress, photos } = req.body
    const task = await ConstructionTask.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false, message: '任务不存在' })
    
    task.siteLogs.push({
      content,
      progress,
      photos,
      recordedBy: req.user.userId,
      date: new Date()
    })
    await task.save()
    
    res.json({ success: true, data: { logs: task.siteLogs } })
  } catch (error) {
    res.status(500).json({ success: false, message: '添加日志失败' })
  }
})

// ========== 统计 API ==========

// 施工统计
router.get('/statistics', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    
    const dateQuery = {}
    if (startDate || endDate) {
      dateQuery.createdAt = {}
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate)
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate)
    }
    
    // 工地统计
    const siteStats = await ConstructionSite.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    
    // 任务统计
    const taskStats = await ConstructionTask.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    
    // 阶段分布
    const stageStats = await ConstructionSite.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$stage', count: { $sum: 1 } } }
    ])
    
    res.json({
      success: true,
      data: {
        sites: siteStats,
        tasks: taskStats,
        stages: stageStats
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计失败' })
  }
})

// ========== 质量检查 API ==========

// 创建质量检查记录
router.post('/quality/checks', auth, async (req, res) => {
  try {
    const { siteId, taskId, type, items, inspector, result, photos, notes } = req.body
    const check = {
      id: `QC${Date.now()}`,
      siteId,
      taskId,
      type, // 'material' | 'process' | 'completion' | 'hidden_work'
      items: items || [],
      inspector: inspector || req.user.userId,
      result, // 'pass' | 'fail' | 'conditional_pass'
      photos: photos || [],
      notes,
      checkedAt: new Date(),
      rectification: result === 'fail' ? {
        status: 'pending',
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        items: items.filter(i => i.result === 'fail').map(i => ({
          description: i.description,
          severity: i.severity || 'major'
        }))
      } : null
    }
    
    res.status(201).json({ success: true, data: { check } })
  } catch (error) {
    res.status(500).json({ success: false, message: '创建质量检查失败' })
  }
})

// 获取质量检查列表
router.get('/quality/checks', auth, async (req, res) => {
  try {
    const { siteId, taskId, type, result } = req.query
    // 模拟返回 - 实际应从数据库查询
    const checks = [
      {
        id: 'QC20260418001',
        siteId: siteId || 'SITE001',
        taskId: taskId || 'TASK001',
        type: type || 'process',
        result: result || 'pass',
        inspector: '张工',
        checkedAt: new Date().toISOString(),
        items: [
          { name: '管道安装坡度', result: 'pass', standard: '≥0.003' },
          { name: '管道支架间距', result: 'pass', standard: '≤2.5m' },
          { name: '阀门安装方向', result: 'pass', standard: '箭头指向' }
        ]
      }
    ]
    res.json({ success: true, data: { checks, total: checks.length } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取质量检查失败' })
  }
})

// 整改闭环
router.post('/quality/rectification/:checkId', async (req, res) => {
  try {
    const { checkId } = req.params
    const { action, photos, notes } = req.body
    const rectification = {
      checkId,
      action, // 'submit' | 'approve' | 'reject'
      photos: photos || [],
      notes,
      processedBy: req.user?.userId || 'system',
      processedAt: new Date(),
      status: action === 'approve' ? 'closed' : action === 'reject' ? 'rejected' : 'submitted'
    }
    res.json({ success: true, data: { rectification } })
  } catch (error) {
    res.status(500).json({ success: false, message: '整改处理失败' })
  }
})

// ========== 安全检查 API ==========

// 创建安全检查
router.post('/safety/checks', auth, async (req, res) => {
  try {
    const { siteId, category, items, result, photos, riskLevel } = req.body
    const check = {
      id: `SC${Date.now()}`,
      siteId,
      category, // 'electrical' | 'fall' | 'fire' | 'equipment' | 'environment'
      items: items || [],
      result, // 'safe' | 'warning' | 'danger'
      riskLevel, // 'low' | 'medium' | 'high' | 'critical'
      photos: photos || [],
      inspector: req.user.userId,
      checkedAt: new Date(),
      correctiveAction: result === 'danger' ? {
        status: 'immediate',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        description: '需立即停工整改'
      } : null
    }
    res.status(201).json({ success: true, data: { check } })
  } catch (error) {
    res.status(500).json({ success: false, message: '创建安全检查失败' })
  }
})

// 获取安全检查列表
router.get('/safety/checks', auth, async (req, res) => {
  try {
    const { siteId, category, riskLevel } = req.query
    const checks = [
      {
        id: 'SC20260418001',
        siteId: siteId || 'SITE001',
        category: category || 'electrical',
        riskLevel: riskLevel || 'low',
        result: 'safe',
        inspector: '李安全',
        checkedAt: new Date().toISOString(),
        items: [
          { name: '临时用电', result: 'safe', standard: '三级配电两级保护' },
          { name: '接地保护', result: 'safe', standard: '接地电阻≤4Ω' },
          { name: '漏电保护', result: 'safe', standard: '动作电流≤30mA' }
        ]
      }
    ]
    res.json({ success: true, data: { checks, total: checks.length } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取安全检查失败' })
  }
})

// 安全整改
router.post('/safety/corrective/:checkId', auth, async (req, res) => {
  try {
    const { checkId } = req.params
    const { action, measures, photos, completedAt } = req.body
    const corrective = {
      checkId,
      action,
      measures: measures || [],
      photos: photos || [],
      completedAt: completedAt || new Date(),
      verifiedBy: req.user.userId,
      status: action === 'close' ? 'closed' : 'in_progress'
    }
    res.json({ success: true, data: { corrective } })
  } catch (error) {
    res.status(500).json({ success: false, message: '安全整改失败' })
  }
})

// ========== 变更单 API ==========

// 创建变更单
router.post('/change-orders', auth, async (req, res) => {
  try {
    const { siteId, type, description, reason, beforeState, afterState, costImpact, scheduleImpact } = req.body
    const changeOrder = {
      id: `CO${Date.now()}`,
      siteId,
      type, // 'design' | 'material' | 'schedule' | 'scope'
      description,
      reason,
      beforeState: beforeState || {},
      afterState: afterState || {},
      costImpact: costImpact || 0,
      scheduleImpact: scheduleImpact || 0,
      status: 'pending',
      submittedBy: req.user.userId,
      submittedAt: new Date(),
      approvals: []
    }
    res.status(201).json({ success: true, data: { changeOrder } })
  } catch (error) {
    res.status(500).json({ success: false, message: '创建变更单失败' })
  }
})

// 审批变更单
router.post('/change-orders/:id/approve', auth, async (req, res) => {
  try {
    const { decision, notes } = req.body
    const approval = {
      approver: req.user.userId,
      decision, // 'approved' | 'rejected' | 'conditional'
      notes,
      approvedAt: new Date()
    }
    res.json({ success: true, data: { approval, changeOrderId: req.params.id, status: decision === 'approved' ? 'approved' : decision } })
  } catch (error) {
    res.status(500).json({ success: false, message: '审批变更单失败' })
  }
})

// ========== 进度闭环 API ==========

// 甘特图数据
router.get('/sites/:id/gantt', auth, async (req, res) => {
  try {
    const site = await ConstructionSite.findById(req.params.id)
    if (!site) return res.status(404).json({ success: false, message: '工地不存在' })
    
    const tasks = await ConstructionTask.find({ site: req.params.id })
      .populate('assignee', 'name')
      .sort({ startDate: 1 })
    
    const ganttData = tasks.map(t => ({
      id: t._id,
      name: t.name,
      start: t.startDate,
      end: t.endDate || new Date(t.startDate.getTime() + (t.estimatedDuration || 7) * 24 * 60 * 60 * 1000),
      progress: t.progress || 0,
      status: t.status,
      assignee: t.assignee?.name || '未分配',
      dependencies: t.dependencies || [],
      milestone: t.isMilestone || false
    }))
    
    res.json({ success: true, data: { tasks: ganttData, siteProgress: site.progress || [] } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取甘特图数据失败' })
  }
})

// 进度预警
router.get('/sites/:id/alerts', auth, async (req, res) => {
  try {
    const tasks = await ConstructionTask.find({ site: req.params.id })
    const now = new Date()
    const alerts = []
    
    for (const task of tasks) {
      // 延期预警
      if (task.status !== 'completed' && task.endDate && new Date(task.endDate) < now) {
        const daysOverdue = Math.ceil((now - new Date(task.endDate)) / (24 * 60 * 60 * 1000))
        alerts.push({
          type: 'overdue',
          severity: 'high',
          taskId: task._id,
          taskName: task.name,
          message: `任务已延期${daysOverdue}天`,
          daysOverdue
        })
      }
      
      // 即将到期
      if (task.status !== 'completed' && task.endDate) {
        const daysLeft = Math.ceil((new Date(task.endDate) - now) / (24 * 60 * 60 * 1000))
        if (daysLeft >= 0 && daysLeft <= 3) {
          alerts.push({
            type: 'upcoming',
            severity: 'medium',
            taskId: task._id,
            taskName: task.name,
            message: `任务将在${daysLeft}天后到期`,
            daysLeft
          })
        }
      }
    }
    
    res.json({ success: true, data: { alerts, total: alerts.length } })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取进度预警失败' })
  }
})

// ========== 综合仪表盘 ==========

router.get('/dashboard', auth, async (req, res) => {
  try {
    const { siteId } = req.query
    
    const siteStats = await ConstructionSite.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    
    const taskStats = await ConstructionTask.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ])
    
    const totalSites = await ConstructionSite.countDocuments()
    const totalTasks = await ConstructionTask.countDocuments()
    const completedTasks = await ConstructionTask.countDocuments({ status: 'completed' })
    
    res.json({
      success: true,
      data: {
        overview: {
          totalSites,
          totalTasks,
          completedTasks,
          completionRate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0
        },
        siteStatus: siteStats,
        taskStatus: taskStats,
        quality: { passRate: 95, pendingChecks: 3 },
        safety: { safeRate: 98, openIssues: 1, daysSinceIncident: 45 }
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: '获取仪表盘数据失败' })
  }
})

module.exports = router
