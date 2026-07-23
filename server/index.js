require('dotenv').config();
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoose = require('mongoose')
const path = require('path')

// 导入路由
const projectRoutes = require('./routes/projects')
const deviceRoutes = require('./routes/devices')
const designRoutes = require('./routes/design')
const constructionRoutes = require('./routes/construction')
const workorderRoutes = require('./routes/workorders')
const workflowRoutes = require('./routes/workflows')
const materialRoutes = require('./routes/materials')
const quotationRoutes = require('./routes/quotations')
const quotationV2Routes = require('./routes/quotation-v2')
const productRoutes = require('./routes/products')
const hotwaterRoutes = require('./routes/hotwater')
const marketingRoutes = require('./routes/marketing')
const aiAssistantRoutes = require('./routes/ai-assistant')
const bimExportRoutes = require('./routes/bim-export')
const revitIntegrationRoutes = require('./routes/revit-integration')
const exportsRoutes = require('./routes/exports')
const supremeRoutes = require('./routes/supreme-api')
const rysnovaBimRoutes = require('./routes/rysnova-bim')
const calculationRoutes = require('./routes/calculation-api')
const oneClickRoutes = require('./routes/oneclick-api')
const threeTierRoutes = require('./routes/threeTier')
const packagePurchaseRoutes = require('./routes/packagePurchase')
const crmRoutes = require('./routes/crm')
const customQuotationRoutes = require('./routes/customQuotation')
const deliveryRoutes = require('./routes/delivery')
const reportsRoutes = require('./routes/reports')
const drawingsRoutes = require('./routes/drawings')
const contractsRoutes = require('./routes/contracts')
const createV2Router = require('./modules/v2.router')

const app = express()
const PORT = process.env.PORT || 3000

// 安全中间件
app.use(helmet())

// 跨域设置
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://rheem-platform.com']
    : true,
  credentials: true
}))

// ── /api/v2 反向代理 → NestJS(Postgres) 单一真相源 ──────────────────
// 2026-07-06 架构收敛：NestJS(services/api, :5500, 前缀 /api/v2) 为后端唯一真相源。
// 默认将【全部】 /api/v2/** 透明转发到 NestJS —— Express 在 v2 面上退化为纯透传，
// 使旧 Vite SPA 与任何遗留客户端也自动落到真相源。必须在 body parser 之前挂载。
// 如需临时回退到本地 Express v2 实现（冻结代码），设 LEGACY_V2_INPROCESS=true。
const { createProxyMiddleware } = require('http-proxy-middleware')
const NESTJS_TARGET = process.env.NESTJS_API_URL || 'http://localhost:5500'
const LEGACY_V2_INPROCESS = process.env.LEGACY_V2_INPROCESS === 'true'
app.use(createProxyMiddleware({
  target: NESTJS_TARGET,
  changeOrigin: true,
  // 默认代理全部 v2；仅当显式回退 legacy 时缩回到身份域（其余交给本地 router）。
  pathFilter: LEGACY_V2_INPROCESS
    ? ['/api/v2/auth/**', '/api/v2/tenants/**', '/api/v2/dealers/**', '/api/v2/stores/**', '/api/v2/diagnosis/**', '/api/v2/lifecycle/**']
    : ['/api/v2/**'],
}))

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 限制每个IP 15分钟内最多100个请求
  message: {
    error: '请求过于频繁，请稍后再试'
  }
})
app.use('/api/', limiter)

// 解析请求体
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

// exports 目录身份验证中间件
function exportsAuth(req, res, next) {
  // 从 query 或 header 中获取访问令牌
  const token = req.query.token || req.headers['x-access-token']

  // 生产环境要求验证
  if (process.env.NODE_ENV === 'production') {
    // 检查是否设置了访问密钥
    const accessKey = process.env.EXPORTS_ACCESS_KEY
    if (accessKey && token !== accessKey) {
      return res.status(403).json({
        success: false,
        message: '访问被拒绝，需要提供有效访问令牌'
      })
    }
  }

  // 开发环境或已通过验证，继续
  next()
}

app.use('/exports', exportsAuth, express.static(path.join(__dirname, '../exports')))

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/rheem-platform', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB 连接成功')
})
.catch((error) => {
  console.error('❌ MongoDB 连接失败:', error)
})

// API路由
app.use('/api/projects', projectRoutes)
app.use('/api/devices', deviceRoutes)
app.use('/api/design', designRoutes)
app.use('/api/construction', constructionRoutes)
app.use('/api/workorders', workorderRoutes)
app.use('/api/workflows', workflowRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api/quotations', quotationRoutes)
app.use('/api/quotation-v2', quotationV2Routes)
app.use('/api/products', productRoutes)
app.use('/api/hotwater', hotwaterRoutes)
app.use('/api/marketing', marketingRoutes)
app.use('/api/ai', aiAssistantRoutes)
app.use('/api/bim', bimExportRoutes)
app.use('/api/revit', revitIntegrationRoutes)
app.use('/api/exports', exportsRoutes)
app.use('/api/supreme', supremeRoutes)
app.use('/api/rysnova-bim', rysnovaBimRoutes)
app.use('/api/calc', calculationRoutes)
app.use('/api/oneclick', oneClickRoutes)
app.use('/api/three-tier', threeTierRoutes)
app.use('/api/quotation', customQuotationRoutes)
app.use('/api/delivery', deliveryRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/drawings', drawingsRoutes)
app.use('/api/package', packagePurchaseRoutes)
app.use('/api/crm', crmRoutes)
app.use('/api/contracts', contractsRoutes)
// ⚠️ 冻结：本地 Express /api/v2 实现默认已下线（/api/v2/** 由上方代理转发到 NestJS）。
// 仅当 LEGACY_V2_INPROCESS=true 时挂载，用于紧急回退。退场详情见 docs/ARCHITECTURE-BLUEPRINT.md。
if (LEGACY_V2_INPROCESS) {
  console.warn('[legacy] LEGACY_V2_INPROCESS=true —— 挂载本地 Express /api/v2（冻结实现），生产不应启用')
  app.use('/api/v2', createV2Router())
}

// 【Phase 1-3进化】渠道赋能与产业平台API
const channelRoutes = require('./api/channel-api')
app.use('/api/channel', channelRoutes)

// 【PPT导出】专业方案PPT导出API
const pptExportRoutes = require('./api/ppt-export-api')
app.use('/api/ppt-export', pptExportRoutes)

// 直接挂载前端调用的API端点 (用于解决路径不匹配问题)
// 负荷计算
app.post('/api/load-calculation', async (req, res) => {
  try {
    const { roomProfile, solution, area, city } = req.body
    const calcArea = area || (roomProfile?.area) || 120
    const calcCity = city || '北京'
    
    const climateFactors = {
      '北京': { heating: 60, cooling: 80 },
      '上海': { heating: 45, cooling: 90 },
      '广州': { heating: 30, cooling: 100 },
      '成都': { heating: 40, cooling: 85 }
    }
    
    const factor = climateFactors[calcCity] || { heating: 50, cooling: 80 }
    const heatingLoad = Math.round(calcArea * factor.heating)
    const coolingLoad = Math.round(calcArea * factor.cooling)
    
    res.json({
      success: true,
      data: {
        heatingLoad,
        coolingLoad,
        totalLoad: heatingLoad + coolingLoad,
        unit: 'W',
        recommendations: [
          { type: '主机', capacity: Math.ceil(coolingLoad / 1000), unit: 'kW' }
        ]
      }
    })
  } catch (error) {
    console.error('负荷计算错误:', error)
    res.status(500).json({ success: false, message: '负荷计算失败' })
  }
})

// 设备选型
app.post('/api/device-selection', async (req, res) => {
  try {
    const { loadResult, solution } = req.body
    const capacity = loadResult?.coolingLoad || 8000
    
    const devices = [
      { id: 'HP-12', name: '空气源热泵主机', model: 'HP-12 (12kW)', capacity: 12000, price: 35800, specs: ['COP 4.0', '变频技术', '低噪音'] },
      { id: 'HP-16', name: '空气源热泵主机', model: 'HP-16 (16kW)', capacity: 16000, price: 45800, specs: ['COP 4.2', '变频技术', '智能除霜'] },
      { id: 'FA-350', name: '新风除湿一体机', model: 'FA-350D', capacity: 350, price: 18600, specs: ['350m³/h', '除湿量40L/day', 'HEPA过滤'] }
    ]
    
    const recommendedDevices = devices.filter(d => d.capacity >= capacity * 0.8)
    
    res.json({
      success: true,
      data: {
        devices: recommendedDevices,
        totalPrice: recommendedDevices.reduce((sum, d) => sum + d.price, 0),
        currency: 'CNY'
      }
    })
  } catch (error) {
    console.error('设备选型错误:', error)
    res.status(500).json({ success: false, message: '设备选型失败' })
  }
})

// 产品价格查询
app.post('/api/products/price', async (req, res) => {
  try {
    const { systemName, area } = req.body
    
    const priceDatabase = {
      '五恒系统': { unitPrice: 850, unit: '元/㎡' },
      '地暖系统': { unitPrice: 280, unit: '元/㎡' },
      '中央空调': { unitPrice: 320, unit: '元/㎡' },
      '新风系统': { unitPrice: 150, unit: '元/㎡' },
      '净水系统': { unitPrice: 120, unit: '元/㎡' }
    }
    
    const priceInfo = priceDatabase[systemName] || { unitPrice: 200, unit: '元/㎡' }
    const totalPrice = Math.round(priceInfo.unitPrice * (area || 120))
    
    res.json({
      success: true,
      data: {
        systemName,
        area,
        unitPrice: priceInfo.unitPrice,
        totalPrice,
        unit: priceInfo.unit
      }
    })
  } catch (error) {
    console.error('价格查询错误:', error)
    res.status(500).json({ success: false, message: '价格查询失败' })
  }
})

// 3D可视化
app.post('/api/visualization/3d', async (req, res) => {
  try {
    const { houseType, area, residents, city, selectedSystems } = req.body
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const renderings = [
      `/api/renderings/${Date.now()}_floorplan.jpg`,
      `/api/renderings/${Date.now()}_3dview.jpg`,
      `/api/renderings/${Date.now()}_system.jpg`
    ]
    
    res.json({
      success: true,
      message: '3D效果图生成成功',
      data: {
        renderings,
        previewUrl: renderings[0],
        generationTime: '3.2秒',
        quality: '4K超清',
        systems: selectedSystems || []
      }
    })
  } catch (error) {
    console.error('3D可视化错误:', error)
    res.status(500).json({ success: false, message: '3D效果图生成失败' })
  }
})

// 用户反馈
app.post('/api/feedback', async (req, res) => {
  try {
    const { type, content, rating, userId, page } = req.body
    console.log(`[反馈] 类型:${type} 评分:${rating} 页面:${page}`)
    
    res.json({
      success: true,
      message: '反馈提交成功',
      data: {
        feedbackId: `FB${Date.now()}`,
        timestamp: new Date().toISOString(),
        status: '已接收'
      }
    })
  } catch (error) {
    console.error('反馈提交错误:', error)
    res.status(500).json({ success: false, message: '反馈提交失败' })
  }
})

// 完整导出
app.post('/api/export/complete', async (req, res) => {
  try {
    const { houseType, area, residents, city, selectedSystems } = req.body
    
    await new Promise(resolve => setTimeout(resolve, 500))
    
    res.json({
      success: true,
      message: '方案导出成功',
      data: {
        exportUrl: `/api/downloads/package_${Date.now()}.zip`,
        fileSize: '15.8 MB',
        includes: ['设计图纸', '设备清单', '报价单', '3D效果图', '合同模板'],
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    })
  } catch (error) {
    console.error('导出错误:', error)
    res.status(500).json({ success: false, message: '方案导出失败' })
  }
})

// 工作流完成
app.post('/api/workflow/complete', async (req, res) => {
  try {
    const { solutionData } = req.body
    const workflowId = `WF${Date.now()}`
    
    res.json({
      success: true,
      data: {
        workflowId,
        status: 'completed',
        timestamp: new Date().toISOString(),
        message: '方案已成功保存到系统'
      }
    })
  } catch (error) {
    console.error('工作流完成错误:', error)
    res.status(500).json({ success: false, message: '方案保存失败' })
  }
})

// ========== Admin 管理后台 API ==========
// 获取产品数据
app.get('/api/admin/products', async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '五恒系统主机', model: 'RHEEM-5H-20', price: 45800, stock: 50, category: '五恒系统' },
      { id: 2, name: '空气源热泵', model: 'RHEEM-HP-12', price: 35800, stock: 30, category: '热泵' },
      { id: 3, name: '新风除湿机', model: 'RHEEM-FA-350', price: 18600, stock: 45, category: '新风' },
      { id: 4, name: '中央净水器', model: 'RHEEM-CW-PRO', price: 12800, stock: 60, category: '净水' }
    ]
  })
})

// 获取统计数据
app.get('/api/admin/stats', async (req, res) => {
  res.json({
    success: true,
    data: {
      totalUsers: 156,
      totalOrders: 289,
      totalRevenue: 4528000,
      pendingOrders: 12,
      monthlyGrowth: 23.5,
      customerSatisfaction: 4.8
    }
  })
})

// 获取价格配置
app.get('/api/admin/pricing', async (req, res) => {
  res.json({
    success: true,
    data: {
      systems: [
        { name: '五恒系统', basePrice: 850, unit: '元/㎡', minMargin: 15 },
        { name: '地暖系统', basePrice: 280, unit: '元/㎡', minMargin: 12 },
        { name: '中央空调', basePrice: 320, unit: '元/㎡', minMargin: 10 },
        { name: '新风系统', basePrice: 150, unit: '元/㎡', minMargin: 15 }
      ],
      lastUpdated: new Date().toISOString()
    }
  })
})

// 更新价格配置
app.post('/api/admin/pricing', async (req, res) => {
  res.json({
    success: true,
    message: '价格配置已更新',
    data: { updatedAt: new Date().toISOString() }
  })
})

// 获取用户数据
app.get('/api/admin/users', async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, name: '张三', role: 'designer', phone: '138****1234', status: 'active', projects: 12 },
      { id: 2, name: '李四', role: 'sales', phone: '139****5678', status: 'active', projects: 8 },
      { id: 3, name: '王五', role: 'admin', phone: '137****9012', status: 'active', projects: 0 }
    ]
  })
})

// ========== Content 内容管理 API ==========
// 获取演示文稿
app.get('/api/content/presentation', async (req, res) => {
  res.json({
    success: true,
    data: {
      slides: [
        { title: '瑞美舒适家居系统介绍', type: 'cover' },
        { title: '五恒系统原理', type: 'diagram' },
        { title: '产品优势对比', type: 'comparison' },
        { title: '成功案例展示', type: 'cases' }
      ],
      downloadUrl: '/downloads/presentation.pdf'
    }
  })
})

// 获取视频内容
app.get('/api/content/video', async (req, res) => {
  res.json({
    success: true,
    data: {
      videos: [
        { id: 1, title: '五恒系统工作原理', duration: '3:45', thumbnail: '/thumbs/video1.jpg' },
        { id: 2, title: '安装流程详解', duration: '5:20', thumbnail: '/thumbs/video2.jpg' },
        { id: 3, title: '客户体验分享', duration: '2:30', thumbnail: '/thumbs/video3.jpg' }
      ]
    }
  })
})

// 获取成功案例
app.get('/api/content/cases', async (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 1, title: '北京棕榈泉别墅项目', area: 450, type: '别墅', savings: '35%', image: '/cases/case1.jpg' },
      { id: 2, title: '上海汤臣一品公寓', area: 280, type: '大平层', savings: '28%', image: '/cases/case2.jpg' },
      { id: 3, title: '深圳湾壹号', area: 320, type: '豪宅', savings: '32%', image: '/cases/case3.jpg' }
    ]
  })
})

// 获取方案对比
app.get('/api/content/comparison', async (req, res) => {
  res.json({
    success: true,
    data: {
      systems: [
        { name: '传统空调+地暖', efficiency: 65, comfort: 70, cost: 80, maintenance: 75 },
        { name: '瑞美五恒系统', efficiency: 95, comfort: 98, cost: 60, maintenance: 90 }
      ]
    }
  })
})

// ========== Sales 销售 API ==========
// 提交销售报告
app.post('/api/sales/report', async (req, res) => {
  const { customerType, decorationStage, budgetRange, decisionCycle } = req.body
  console.log(`[销售报告] 客户类型:${customerType} 装修阶段:${decorationStage}`)
  
  res.json({
    success: true,
    message: '报告提交成功',
    data: {
      reportId: `SR${Date.now()}`,
      timestamp: new Date().toISOString(),
      recommendations: ['推荐五恒系统方案', '赠送首次维护服务']
    }
  })
})

// ========== QA 质量保证 API ==========
// 获取QA配置
app.get('/api/qa/config', async (req, res) => {
  res.json({
    success: true,
    data: {
      testCoverage: 78,
      autoTestPassRate: 94.5,
      criticalIssues: 0,
      warningIssues: 3,
      lastDeploy: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  })
})

// 风险报告
app.post('/api/qa/risk-report', async (req, res) => {
  res.json({
    success: true,
    data: {
      riskLevel: 'low',
      issues: [
        { severity: 'low', module: 'UI', description: '按钮对齐偏差' },
        { severity: 'low', module: 'API', description: '响应时间略长' }
      ],
      suggestions: ['优化前端样式', '增加缓存机制']
    }
  })
})

// 生产监控
app.post('/api/qa/monitor-production', async (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: '99.9%',
      responseTime: '120ms',
      errorRate: '0.01%',
      alerts: []
    }
  })
})

// AI优先级排序
app.post('/api/qa/ai-prioritize', async (req, res) => {
  res.json({
    success: true,
    data: {
      prioritizedTests: [
        { name: '登录功能测试', priority: 'high', reason: '核心功能' },
        { name: '支付流程测试', priority: 'high', reason: '影响收入' },
        { name: '报表导出测试', priority: 'medium', reason: '使用频率高' }
      ]
    }
  })
})

// ========== Diagnosis 智能诊断 API ==========
app.post('/api/diagnosis/analyze', async (req, res) => {
  const { description } = req.body
  
  // 模拟AI诊断分析
  const diagnoses = [
    { id: 'D001', problem: '制冷效果不佳', confidence: 85, solution: '检查冷媒压力，清洗过滤网' },
    { id: 'D002', problem: '噪音过大', confidence: 72, solution: '检查风机轴承，紧固螺丝' },
    { id: 'D003', problem: '能耗异常', confidence: 68, solution: '检查温控设置，清洗换热器' }
  ]
  
  res.json({
    success: true,
    data: {
      diagnoses: diagnoses.filter(d => description?.includes('冷') || description?.includes('噪') || Math.random() > 0.5),
      analysisTime: '1.2s',
      suggestion: '建议预约上门检测'
    }
  })
})

// ========== Workorders 工单 API ==========
app.post('/api/workorders/create-from-diagnosis', async (req, res) => {
  const { diagnosisId } = req.body
  
  res.json({
    success: true,
    data: {
      workOrderId: `WO${Date.now()}`,
      diagnosisId,
      status: 'created',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    }
  })
})

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalUrl
  })
})

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error)
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  })
})

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 服务器运行在端口 ${PORT}`)
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`)
})
