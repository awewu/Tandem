const express = require('express')
const Project = require('../models/Project')
const { auth } = require('../middleware/auth')
const router = express.Router()

// 获取项目列表
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query
    const userId = req.user.userId

    // 构建查询条件
    const query = { designer: userId }
    if (status && status !== 'all') {
      query.status = status
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ]
    }

    const projects = await Project.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('devices.device', 'name model brand price')

    const total = await Project.countDocuments(query)

    res.json({
      success: true,
      data: {
        projects,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('获取项目列表错误:', error)
    res.status(500).json({
      success: false,
      message: '获取项目列表失败'
    })
  }
})

// 创建项目
router.post('/', auth, async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      designer: req.user.userId,
      status: 'draft'
    }

    const project = new Project(projectData)
    await project.save()

    res.status(201).json({
      success: true,
      message: '项目创建成功',
      data: { project }
    })
  } catch (error) {
    console.error('创建项目错误:', error)
    res.status(500).json({
      success: false,
      message: '创建项目失败'
    })
  }
})

// 获取项目详情
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('devices.device')
      .populate('designer', 'name storeName')

    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      })
    }

    // 检查权限
    if (project.designer._id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权访问此项目'
      })
    }

    res.json({
      success: true,
      data: { project }
    })
  } catch (error) {
    console.error('获取项目详情错误:', error)
    res.status(500).json({
      success: false,
      message: '获取项目详情失败'
    })
  }
})

// 更新项目
router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)

    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      })
    }

    // 检查权限
    if (project.designer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权修改此项目'
      })
    }

    // 创建新版本
    const newVersion = {
      ...project.toObject(),
      _id: undefined,
      version: project.versions.length + 1,
      createdAt: new Date()
    }
    project.versions.push(newVersion)

    // 更新项目
    Object.assign(project, req.body)
    project.updatedAt = new Date()

    await project.save()

    res.json({
      success: true,
      message: '项目更新成功',
      data: { project }
    })
  } catch (error) {
    console.error('更新项目错误:', error)
    res.status(500).json({
      success: false,
      message: '更新项目失败'
    })
  }
})

// 删除项目
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)

    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      })
    }

    // 检查权限
    if (project.designer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权删除此项目'
      })
    }

    await Project.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: '项目删除成功'
    })
  } catch (error) {
    console.error('删除项目错误:', error)
    res.status(500).json({
      success: false,
      message: '删除项目失败'
    })
  }
})

// 复制项目
router.post('/:id/copy', auth, async (req, res) => {
  try {
    const originalProject = await Project.findById(req.params.id)

    if (!originalProject) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      })
    }

    // 检查权限
    if (originalProject.designer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权复制此项目'
      })
    }

    // 创建副本
    const projectData = {
      ...originalProject.toObject(),
      _id: undefined,
      name: `${originalProject.name} - 副本`,
      status: 'draft',
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const newProject = new Project(projectData)
    await newProject.save()

    res.status(201).json({
      success: true,
      message: '项目复制成功',
      data: { project: newProject }
    })
  } catch (error) {
    console.error('复制项目错误:', error)
    res.status(500).json({
      success: false,
      message: '复制项目失败'
    })
  }
})

// 分享项目
router.post('/:id/share', auth, async (req, res) => {
  try {
    const { expiresIn = 7, permissions = 'view' } = req.body
    const project = await Project.findById(req.params.id)

    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      })
    }

    // 检查权限
    if (project.designer.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权分享此项目'
      })
    }

    // 生成分享链接
    const shareToken = require('crypto').randomBytes(32).toString('hex')
    const shareData = {
      token: shareToken,
      project: project._id,
      permissions,
      expiresAt: new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000),
      createdBy: req.user.userId
    }

    // 保存分享信息（实际应使用Redis）
    // 这里简化处理，直接返回分享链接

    res.json({
      success: true,
      message: '分享链接生成成功',
      data: {
        shareUrl: `${process.env.FRONTEND_URL}/shared/${shareToken}`,
        expiresAt: shareData.expiresAt
      }
    })
  } catch (error) {
    console.error('分享项目错误:', error)
    res.status(500).json({
      success: false,
      message: '分享项目失败'
    })
  }
})

// ==================== 100组测试数据API (开发测试用) ====================

const fs = require('fs')
const path = require('path')

// 读取JSON文件辅助函数
function readJsonFile(filename) {
  try {
    const filePath = path.join(__dirname, '../../database', filename)
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`读取 ${filename} 失败:`, error)
    return []
  }
}

// 获取所有测试项目 (100组)
router.get('/test-data/all', async (req, res) => {
  try {
    const projects = readJsonFile('projects.json')
    const customers = readJsonFile('customers.json')
    const users = readJsonFile('users.json')
    const stores = readJsonFile('stores.json')

    // 关联数据
    const enrichedProjects = projects.map(project => {
      const customer = customers.find(c => c.id === project.customerId)
      const sales = users.find(u => u.id === project.salesId)
      const designer = users.find(u => u.id === project.designerId)
      const constructionMgr = users.find(u => u.id === project.constructionMgrId)
      const store = stores.find(s => s.id === project.customer?.assignedStoreId)

      return {
        ...project,
        customerInfo: customer,
        salesInfo: sales ? { id: sales.id, name: sales.name, phone: sales.phone } : null,
        designerInfo: designer ? { id: designer.id, name: designer.name, phone: designer.phone } : null,
        constructionMgrInfo: constructionMgr ? { id: constructionMgr.id, name: constructionMgr.name } : null,
        storeInfo: store ? { id: store.id, name: store.name, city: store.city } : null
      }
    })

    res.json({
      success: true,
      data: {
        total: enrichedProjects.length,
        projects: enrichedProjects,
        stats: {
          byStatus: enrichedProjects.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1
            return acc
          }, {}),
          byStage: {
            diagnosis: enrichedProjects.filter(p => p.diagnosis).length,
            design: enrichedProjects.filter(p => p.design).length,
            quotation: enrichedProjects.filter(p => p.quotation).length,
            construction: enrichedProjects.filter(p => p.construction).length
          }
        }
      }
    })
  } catch (error) {
    console.error('获取测试项目失败:', error)
    res.status(500).json({
      success: false,
      message: '获取测试项目失败'
    })
  }
})

// 获取单个测试项目详情
router.get('/test-data/:id', async (req, res) => {
  try {
    const projects = readJsonFile('projects.json')
    const project = projects.find(p => p.id === parseInt(req.params.id))

    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      })
    }

    // 关联完整数据
    const customers = readJsonFile('customers.json')
    const users = readJsonFile('users.json')
    const stores = readJsonFile('stores.json')

    const customer = customers.find(c => c.id === project.customerId)
    const sales = users.find(u => u.id === project.salesId)
    const designer = users.find(u => u.id === project.designerId)
    const store = stores.find(s => project.customer?.assignedStoreId && s.id === project.customer.assignedStoreId)

    const enrichedProject = {
      ...project,
      customerInfo: customer,
      salesInfo: sales,
      designerInfo: designer,
      storeInfo: store
    }

    res.json({
      success: true,
      data: enrichedProject
    })
  } catch (error) {
    console.error('获取测试项目详情失败:', error)
    res.status(500).json({
      success: false,
      message: '获取测试项目详情失败'
    })
  }
})

// 数据闭环验证API - 检查项目完整性
router.get('/test-data/:id/validate', async (req, res) => {
  try {
    const projects = readJsonFile('projects.json')
    const project = projects.find(p => p.id === parseInt(req.params.id))

    if (!project) {
      return res.status(404).json({
        success: false,
        message: '项目不存在'
      })
    }

    // 验证数据完整性
    const validation = {
      hasCustomer: !!project.customerId,
      hasDiagnosis: !!project.diagnosis && project.diagnosis.painPoints?.length > 0,
      hasDesign: !!project.design && project.design.equipment,
      hasQuotation: !!project.quotation && project.quotation.total > 0,
      hasConstruction: !!project.construction,
      timelineComplete: project.timeline && project.timeline.length >= 3
    }

    const completionRate = Object.values(validation).filter(v => v).length / Object.values(validation).length * 100

    res.json({
      success: true,
      data: {
        projectId: project.id,
        projectNo: project.projectNo,
        status: project.status,
        validation,
        completionRate: Math.round(completionRate),
        isComplete: completionRate === 100,
        missingData: Object.entries(validation)
          .filter(([_, v]) => !v)
          .map(([k]) => k.replace('has', '').replace('timelineComplete', '完整时间线'))
      }
    })
  } catch (error) {
    console.error('验证项目数据失败:', error)
    res.status(500).json({
      success: false,
      message: '验证项目数据失败'
    })
  }
})

// 经营统计分析API
router.get('/admin/stats/overview', async (req, res) => {
  try {
    const projects = readJsonFile('projects.json')
    const customers = readJsonFile('customers.json')
    const stores = readJsonFile('stores.json')

    // 计算经营指标
    const totalRevenue = projects
      .filter(p => p.quotation?.total)
      .reduce((sum, p) => sum + p.quotation.total, 0)

    const totalCost = projects
      .filter(p => p.quotation?.items)
      .reduce((sum, p) => {
        const cost = p.quotation.items.reduce((itemSum, item) => {
          return itemSum + (item.products?.reduce((pSum, prod) => pSum + (prod.costPrice || prod.unitPrice * 0.6), 0) || 0)
        }, 0)
        return sum + cost
      }, 0)

    const grossProfit = totalRevenue - totalCost
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue * 100).toFixed(1) : 0

    // 按门店统计
    const storeStats = stores.map(store => {
      const storeProjects = projects.filter(p => {
        const customer = customers.find(c => c.id === p.customerId)
        return customer?.assignedStoreId === store.id
      })

      const storeRevenue = storeProjects
        .filter(p => p.quotation?.total)
        .reduce((sum, p) => sum + p.quotation.total, 0)

      return {
        storeId: store.id,
        storeName: store.name,
        city: store.city,
        projectCount: storeProjects.length,
        revenue: storeRevenue
      }
    }).sort((a, b) => b.revenue - a.revenue)

    res.json({
      success: true,
      data: {
        overview: {
          totalProjects: projects.length,
          totalCustomers: customers.length,
          totalRevenue,
          totalCost: Math.round(totalCost),
          grossProfit: Math.round(grossProfit),
          profitMargin: parseFloat(profitMargin),
          activeStores: stores.length
        },
        byStatus: projects.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1
          return acc
        }, {}),
        storeStats
      }
    })
  } catch (error) {
    console.error('获取经营统计失败:', error)
    res.status(500).json({
      success: false,
      message: '获取经营统计失败'
    })
  }
})

module.exports = router
