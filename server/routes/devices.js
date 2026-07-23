const express = require('express')
const Device = require('../models/Device')
const { auth } = require('../middleware/auth')
const router = express.Router()

// 获取设备列表
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      system, 
      brand, 
      category, 
      search,
      status = 'active',
      isFavorite 
    } = req.query

    // 构建查询条件
    const query = {}
    
    if (system && system !== 'all') {
      query.system = system
    }
    
    if (brand && brand !== 'all') {
      if (brand === 'rheem') {
        query.isRheem = true
      } else if (brand === 'third') {
        query.isRheem = false
      }
    }
    
    if (category && category !== 'all') {
      query.category = category
    }
    
    if (status && status !== 'all') {
      query.status = status
    }
    
    if (isFavorite === 'true') {
      // 这里需要根据用户收藏来过滤，简化处理
      query.isFavorite = true
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    const devices = await Device.find(query)
      .sort({ isRheem: -1, name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Device.countDocuments(query)

    res.json({
      success: true,
      data: {
        devices,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    console.error('获取设备列表错误:', error)
    res.status(500).json({
      success: false,
      message: '获取设备列表失败'
    })
  }
})

// 获取设备详情
router.get('/:id', auth, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      })
    }

    res.json({
      success: true,
      data: { device }
    })
  } catch (error) {
    console.error('获取设备详情错误:', error)
    res.status(500).json({
      success: false,
      message: '获取设备详情失败'
    })
  }
})

// 添加第三方设备（需要审核）
router.post('/', auth, async (req, res) => {
  try {
    const deviceData = {
      ...req.body,
      isRheem: false,
      status: 'pending',
      submittedBy: req.user.userId,
      submittedAt: new Date()
    }

    const device = new Device(deviceData)
    await device.save()

    res.status(201).json({
      success: true,
      message: '设备提交成功，等待审核',
      data: { device }
    })
  } catch (error) {
    console.error('添加设备错误:', error)
    res.status(500).json({
      success: false,
      message: '添加设备失败'
    })
  }
})

// 更新设备（仅瑞美设备或审核通过的第三方设备）
router.put('/:id', auth, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      })
    }

    // 权限检查
    if (!device.isRheem && device.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: '无权修改此设备'
      })
    }

    // 如果是第三方设备，修改后需要重新审核
    if (!device.isRheem) {
      req.body.status = 'pending'
    }

    Object.assign(device, req.body)
    device.updatedAt = new Date()

    await device.save()

    res.json({
      success: true,
      message: '设备更新成功',
      data: { device }
    })
  } catch (error) {
    console.error('更新设备错误:', error)
    res.status(500).json({
      success: false,
      message: '更新设备失败'
    })
  }
})

// 删除设备
router.delete('/:id', auth, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      })
    }

    // 权限检查
    if (!device.isRheem && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权删除此设备'
      })
    }

    await Device.findByIdAndDelete(req.params.id)

    res.json({
      success: true,
      message: '设备删除成功'
    })
  } catch (error) {
    console.error('删除设备错误:', error)
    res.status(500).json({
      success: false,
      message: '删除设备失败'
    })
  }
})

// 审核第三方设备（管理员权限）
router.put('/:id/review', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权审核设备'
      })
    }

    const { status, reviewNotes } = req.body
    const device = await Device.findById(req.params.id)

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      })
    }

    if (device.isRheem) {
      return res.status(400).json({
        success: false,
        message: '瑞美设备无需审核'
      })
    }

    device.status = status
    device.reviewNotes = reviewNotes
    device.reviewedBy = req.user.userId
    device.reviewedAt = new Date()

    await device.save()

    res.json({
      success: true,
      message: `设备${status === 'active' ? '审核通过' : '审核驳回'}`,
      data: { device }
    })
  } catch (error) {
    console.error('审核设备错误:', error)
    res.status(500).json({
      success: false,
      message: '审核设备失败'
    })
  }
})

// 收藏/取消收藏设备
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const device = await Device.findById(req.params.id)

    if (!device) {
      return res.status(404).json({
        success: false,
        message: '设备不存在'
      })
    }

    device.isFavorite = !device.isFavorite
    await device.save()

    res.json({
      success: true,
      message: device.isFavorite ? '已收藏' : '已取消收藏',
      data: { isFavorite: device.isFavorite }
    })
  } catch (error) {
    console.error('收藏设备错误:', error)
    res.status(500).json({
      success: false,
      message: '收藏设备失败'
    })
  }
})

// 获取设备分类统计
router.get('/stats/categories', auth, async (req, res) => {
  try {
    const stats = await Device.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          rheem: {
            $sum: { $cond: ['$isRheem', 1, 0] }
          },
          third: {
            $sum: { $cond: ['$isRheem', 0, 1] }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ])

    res.json({
      success: true,
      data: { stats }
    })
  } catch (error) {
    console.error('获取设备统计错误:', error)
    res.status(500).json({
      success: false,
      message: '获取设备统计失败'
    })
  }
})

module.exports = router
