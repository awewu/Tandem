/**
 * 报价系统API路由 - Quotations API Routes
 * 对标筑星云智能报价系统
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const Quotation = require('../models/Quotation');
const Material = require('../models/Material');
const { auth } = require('../middleware/auth');

// ========== 报价单管理 ==========

// 获取报价单列表
router.get('/', auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      projectId,
      customerId,
      status,
      package,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};
    if (projectId) query.projectId = projectId;
    if (customerId) query.customerId = customerId;
    if (status) query.status = status;
    if (package) query.package = package;
    if (minAmount || maxAmount) {
      query['summary.total'] = {};
      if (minAmount) query['summary.total'].$gte = parseFloat(minAmount);
      if (maxAmount) query['summary.total'].$lte = parseFloat(maxAmount);
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const quotations = await Quotation.find(query)
      .populate('projectId', 'name')
      .populate('createdBy', 'name')
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Quotation.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        quotations,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取报价单列表失败' });
  }
});

// 获取报价单详情
router.get('/:id', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('projectId')
      .populate('customerId')
      .populate('items.material');
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    res.json({ success: true, data: { quotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取报价单详情失败' });
  }
});

// 创建报价单
router.post('/', auth, async (req, res) => {
  try {
    const quotationData = {
      ...req.body,
      quotationNo: generateQuotationNo(),
      createdBy: req.user.userId
    };
    
    const quotation = new Quotation(quotationData);
    await quotation.save();
    
    res.status(201).json({ success: true, data: { quotation } });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// 更新报价单
router.put('/:id', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    res.json({ success: true, data: { quotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新报价单失败' });
  }
});

// 删除报价单
router.delete('/:id', auth, async (req, res) => {
  try {
    await Quotation.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: '报价单已删除' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除报价单失败' });
  }
});

// ========== 智能生成 ==========

// 根据设计方案自动生成报价
router.post('/generate-from-design', auth, async (req, res) => {
  try {
    const { designId, projectId, package = 'standard' } = req.body;
    
    // 模拟从设计方案获取数据
    const designData = await getDesignData(designId);
    
    // 基于设计参数自动选择材料
    const selectedMaterials = await autoSelectMaterials(designData, package);
    
    // 生成报价单
    const quotation = await generateQuotation(projectId, designData, selectedMaterials, package);
    
    res.json({
      success: true,
      data: { quotation }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '生成报价失败' });
  }
});

// 生成多方案对比报价
router.post('/generate-comparison', auth, async (req, res) => {
  try {
    const { designId, projectId } = req.body;
    const designData = await getDesignData(designId);
    
    // 生成三个档次的报价
    const packages = ['economy', 'standard', 'premium'];
    const quotations = [];
    
    for (const pkg of packages) {
      const materials = await autoSelectMaterials(designData, pkg);
      const quotation = await generateQuotation(projectId, designData, materials, pkg);
      quotations.push(quotation);
    }
    
    res.json({
      success: true,
      data: {
        quotations,
        comparison: {
          economy: { total: quotations[0].summary.finalTotal, highlight: '高性价比' },
          standard: { total: quotations[1].summary.finalTotal, highlight: '68%客户选择' },
          premium: { total: quotations[2].summary.finalTotal, highlight: '尊享体验' }
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '生成对比报价失败' });
  }
});

// ========== 报价项目操作 ==========

// 添加报价项目
router.post('/:id/items', auth, async (req, res) => {
  try {
    const { materialId, quantity, discount = 0, notes } = req.body;
    
    const material = await Material.findById(materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    await quotation.addItem({
      material: materialId,
      materialName: material.name,
      materialModel: material.model,
      materialBrand: material.brand,
      specifications: `${material.specifications.diameter || ''} ${material.specifications.material || ''}`,
      unit: material.specifications.unit,
      quantity,
      unitPrice: material.pricing.basePrice,
      laborCost: material.pricing.laborCost || 0,
      discount,
      notes,
      taxRate: material.pricing.taxRate
    });
    
    res.json({ success: true, data: { quotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '添加项目失败' });
  }
});

// 更新报价项目
router.put('/:id/items/:itemId', auth, async (req, res) => {
  try {
    const { quantity, discount, notes } = req.body;
    
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    const item = quotation.items.find(i => i.itemId === req.params.itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: '项目不存在' });
    }
    
    if (quantity) item.quantity = quantity;
    if (discount !== undefined) item.discount = discount;
    if (notes) item.notes = notes;
    
    await quotation.save();
    res.json({ success: true, data: { quotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新项目失败' });
  }
});

// 删除报价项目
router.delete('/:id/items/:itemId', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    quotation.items = quotation.items.filter(i => i.itemId !== req.params.itemId);
    await quotation.save();
    
    res.json({ success: true, data: { quotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除项目失败' });
  }
});

// ========== 报价流程 ==========

// 提交审批
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    quotation.status = 'sent';
    quotation.approval.submittedBy = req.user.userId;
    quotation.approval.submittedAt = new Date();
    
    await quotation.save();
    
    res.json({ success: true, data: { quotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '提交审批失败' });
  }
});

// 审批报价
router.post('/:id/approve', auth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const quotation = await Quotation.findById(req.params.id);
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    quotation.status = status;
    quotation.approval.approvedBy = req.user.userId;
    quotation.approval.approvedAt = new Date();
    quotation.approval.notes = notes;
    
    await quotation.save();
    
    res.json({ success: true, data: { quotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '审批失败' });
  }
});

// 克隆报价单
router.post('/:id/clone', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const original = await Quotation.findById(req.params.id);
    
    if (!original) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    const newQuotation = original.clone(reason);
    newQuotation.createdBy = req.user.userId;
    await newQuotation.save();
    
    res.json({ success: true, data: { quotation: newQuotation } });
  } catch (error) {
    res.status(500).json({ success: false, message: '克隆报价单失败' });
  }
});

// ========== 导出 ==========

// 获取PDF数据
router.get('/:id/pdf', auth, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('projectId')
      .populate('customerId')
      .populate('items.material');
    
    if (!quotation) {
      return res.status(404).json({ success: false, message: '报价单不存在' });
    }
    
    const pdfData = quotation.getPDFData();
    
    res.json({ success: true, data: { pdfData } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取PDF数据失败' });
  }
});

// ========== 统计 ==========

// 报价统计
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) dateQuery.createdAt.$lte = new Date(endDate);
    }
    
    const stats = await Quotation.aggregate([
      { $match: dateQuery },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalAmount: { $sum: '$summary.finalTotal' },
          avgAmount: { $avg: '$summary.finalTotal' },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          }
        }
      }
    ]);
    
    const byStatus = await Quotation.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$summary.finalTotal' } } }
    ]);
    
    const byPackage = await Quotation.aggregate([
      { $match: dateQuery },
      { $group: { _id: '$package', count: { $sum: 1 }, amount: { $sum: '$summary.finalTotal' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        summary: stats[0] || {},
        byStatus,
        byPackage
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取统计失败' });
  }
});

// ========== 辅助函数 ==========

function generateQuotationNo() {
  const date = new Date();
  const prefix = 'QT';
  const year = date.getFullYear().toString().substr(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}${year}${month}${day}-${random}`;
}

async function getDesignData(designId) {
  // 模拟从设计方案获取数据
  return {
    area: 200,
    rooms: 8,
    systems: ['空调', '采暖', '热水'],
    floors: 2,
    houseType: '别墅'
  };
}

async function autoSelectMaterials(designData, package) {
  const { systems, area, rooms } = designData;
  const materials = [];
  
  // 根据档次选择不同价格区间的材料
  const priceMultiplier = {
    economy: 0.7,
    standard: 1.0,
    premium: 1.5
  }[package];
  
  for (const system of systems) {
    const systemMaterials = await Material.find({
      applicableSystems: system,
      status: 'active',
      'pricing.basePrice': {
        $gte: 100 * priceMultiplier,
        $lte: 10000 * priceMultiplier
      }
    }).limit(10);
    
    materials.push(...systemMaterials.map(m => ({
      material: m,
      quantity: estimateQuantity(m, area, rooms),
      reason: `${system}系统推荐`
    })));
  }
  
  return materials;
}

function estimateQuantity(material, area, rooms) {
  switch(material.category) {
    case '管材': return Math.ceil(area / 10);
    case '设备': return Math.ceil(area / 50);
    case '管件': return Math.ceil(area / 20);
    case '阀门': return rooms;
    default: return 1;
  }
}

async function generateQuotation(projectId, designData, materials, package) {
  const packageNames = {
    economy: '经济方案',
    standard: '标准方案',
    premium: '尊享方案'
  };
  
  const quotation = new Quotation({
    quotationNo: generateQuotationNo(),
    projectId,
    package,
    packageName: packageNames[package],
    items: materials.map(m => ({
      material: m.material._id,
      materialName: m.material.name,
      materialModel: m.material.model,
      materialBrand: m.material.brand,
      specifications: `${m.material.specifications.diameter || ''} ${m.material.specifications.material || ''}`,
      unit: m.material.specifications.unit,
      quantity: m.quantity,
      unitPrice: m.material.pricing.basePrice,
      laborCost: m.material.pricing.laborCost || 0,
      taxRate: m.material.pricing.taxRate,
      notes: m.reason
    })),
    schedule: {
      estimatedDays: designData.area / 10,
      milestones: [
        { name: '进场准备', day: 1, description: '材料进场、现场交底' },
        { name: '隐蔽工程', day: 7, description: '管线铺设、设备安装' },
        { name: '调试交付', day: 14, description: '系统调试、客户验收' }
      ]
    },
    warranty: {
      years: package === 'premium' ? 5 : 2,
      coverage: package === 'premium' ? '整机延保+上门保养' : '整机质保'
    },
    createdBy: 'system'
  });
  
  await quotation.save();
  return quotation;
}

module.exports = router;
