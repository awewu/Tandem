/**
 * 材料库API路由 - Materials API Routes
 * 对标筑星云材料报价系统
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const Material = require('../models/Material');
const { auth } = require('../middleware/auth');

// ========== 公开测试端点 (无需认证) ==========

// 内存材料数据（当MongoDB不可用时）
const inMemoryMaterials = [
  { _id: '1', name: 'Rheem 多联机室外机 8kW', code: 'RHEEM-VRF-008', category: '空调系统', brand: 'Rheem', pricing: { basePrice: 28500, currency: 'CNY', unit: '台' }, specifications: { coolingCapacity: 8000, heatingCapacity: 9000 }, status: 'active' },
  { _id: '2', name: 'Ruud 风管机 5kW', code: 'RUUD-DUCT-005', category: '空调系统', brand: 'Ruud', pricing: { basePrice: 12800, currency: 'CNY', unit: '台' }, specifications: { coolingCapacity: 5000 }, status: 'active' },
  { _id: '3', name: 'Rheem 空气源热泵 12kW', code: 'RHEEM-HP-012', category: '采暖系统', brand: 'Rheem', pricing: { basePrice: 35800, currency: 'CNY', unit: '台' }, specifications: { heatingCapacity: 12000 }, status: 'active' },
  { _id: '4', name: '美的 壁挂炉 24kW', code: 'MIDEA-BOILER-024', category: '采暖系统', brand: '美的', pricing: { basePrice: 8500, currency: 'CNY', unit: '台' }, specifications: { heatingCapacity: 24000 }, status: 'active' },
  { _id: '5', name: 'Rheem 空气能热水器 200L', code: 'RHEEM-WH-200', category: '热水系统', brand: 'Rheem', pricing: { basePrice: 8800, currency: 'CNY', unit: '台' }, specifications: { capacity: 200 }, status: 'active' },
  { _id: '6', name: 'Ruud 全热交换新风机 350', code: 'RUUD-ERV-350', category: '新风系统', brand: 'Ruud', pricing: { basePrice: 12800, currency: 'CNY', unit: '台' }, specifications: { airFlow: 350 }, status: 'active' },
  { _id: '7', name: 'PPR 给水管 S4 dn25', code: 'PPR-S4-25', category: '管道材料', brand: '联塑', pricing: { basePrice: 28, currency: 'CNY', unit: '米' }, specifications: { diameter: 25 }, status: 'active' },
  { _id: '8', name: '橡塑保温棉 30mm', code: 'INS-30', category: '保温材料', brand: '华美', pricing: { basePrice: 45, currency: 'CNY', unit: '平方米' }, specifications: { thickness: 30 }, status: 'active' }
];

// 公开材料列表 - 用于测试和演示
router.get('/public', async (req, res) => {
  try {
    const { limit = 10, category } = req.query;
    let materials;
    let source;
    
    try {
      // 尝试从数据库查询
      const query = { status: 'active' };
      if (category) query.category = category;
      materials = await Material.find(query).sort({ createdAt: -1 }).limit(parseInt(limit));
      source = 'database';
    } catch (dbError) {
      // 数据库失败时使用内存数据
      console.log('[Materials API] MongoDB未连接，使用内存数据');
      materials = inMemoryMaterials.slice(0, parseInt(limit));
      if (category) {
        materials = materials.filter(m => m.category === category);
      }
      source = 'memory';
    }
    
    res.json({
      success: true,
      message: '公开材料列表 (测试模式)',
      data: {
        materials,
        total: materials.length,
        source,
        note: source === 'memory' ? '使用演示数据 (MongoDB未连接)' : '来自数据库'
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// 公开推荐端点
router.get('/public/recommend', async (req, res) => {
  try {
    const { system = 'hvac', area = 100 } = req.query;
    
    // 模拟推荐逻辑 - 实际应该基于算法
    const recommendations = [
      { type: 'chiller', category: '空调系统', reason: '面积匹配', confidence: 95 },
      { type: 'heat_pump', category: '采暖系统', reason: '地区推荐', confidence: 90 },
      { type: 'water_heater', category: '热水系统', reason: '家庭必备', confidence: 88 }
    ];
    
    res.json({
      success: true,
      data: {
        system,
        area,
        recommendations,
        note: '公开推荐接口 (测试模式)'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '推荐失败' });
  }
});

// ========== 材料库管理 (需要认证) ==========

// 获取材料列表（支持搜索、筛选）
router.get('/', auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category,
      subcategory,
      keyword,
      minPrice,
      maxPrice,
      brand,
      system,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;
    
    const query = { status: 'active' };
    
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (brand) query.brand = brand;
    if (system) query.applicableSystems = system;
    if (minPrice || maxPrice) {
      query['pricing.basePrice'] = {};
      if (minPrice) query['pricing.basePrice'].$gte = parseFloat(minPrice);
      if (maxPrice) query['pricing.basePrice'].$lte = parseFloat(maxPrice);
    }
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { brand: { $regex: keyword, $options: 'i' } },
        { model: { $regex: keyword, $options: 'i' } }
      ];
    }
    
    const sortOption = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const materials = await Material.find(query)
      .sort(sortOption)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Material.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        materials,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// 获取材料详情
router.get('/:id', auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    res.json({ success: true, data: { material } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取材料详情失败' });
  }
});

// 创建材料
router.post('/', auth, async (req, res) => {
  try {
    const materialData = {
      ...req.body,
      materialId: `MAT${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      createdBy: req.user.userId
    };
    
    const material = new Material(materialData);
    await material.save();
    
    res.status(201).json({ success: true, data: { material } });
  } catch (error) {
    return errorResponse(res, error);
  }
});

// 更新材料
router.put('/:id', auth, async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true }
    );
    
    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    res.json({ success: true, data: { material } });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新材料失败' });
  }
});

// 删除材料
router.delete('/:id', auth, async (req, res) => {
  try {
    const material = await Material.findByIdAndUpdate(
      req.params.id,
      { status: 'discontinued', updatedAt: Date.now() },
      { new: true }
    );
    
    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    res.json({ success: true, message: '材料已停用' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除材料失败' });
  }
});

// ========== 智能推荐 ==========

// 根据设计方案推荐材料
router.post('/recommend', auth, async (req, res) => {
  try {
    const { designData, budget, preferences = {} } = req.body;
    
    // 基于设计参数推荐材料
    const recommendedMaterials = await recommendMaterials(designData, budget, preferences);
    
    res.json({
      success: true,
      data: {
        recommendations: recommendedMaterials,
        totalEstimate: calculateTotalEstimate(recommendedMaterials)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '推荐材料失败' });
  }
});

// 获取替代材料
router.get('/:id/alternatives', auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    // 查找同类别相似价格的其他材料
    const alternatives = await Material.find({
      _id: { $ne: material._id },
      category: material.category,
      subcategory: material.subcategory,
      status: 'active',
      'pricing.basePrice': {
        $gte: material.pricing.basePrice * 0.8,
        $lte: material.pricing.basePrice * 1.2
      }
    }).limit(5);
    
    res.json({ success: true, data: { alternatives } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取替代材料失败' });
  }
});

// ========== 价格管理 ==========

// 更新材料价格
router.post('/:id/price', auth, async (req, res) => {
  try {
    const { price, supplier, source } = req.body;
    const material = await Material.findById(req.params.id);
    
    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    await material.recordPrice(price, supplier, source);
    
    res.json({ success: true, data: { material } });
  } catch (error) {
    res.status(500).json({ success: false, message: '更新价格失败' });
  }
});

// 获取价格历史
router.get('/:id/price-history', auth, async (req, res) => {
  try {
    const material = await Material.findById(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: '材料不存在' });
    }
    
    res.json({
      success: true,
      data: {
        priceHistory: material.priceHistory,
        currentPrice: material.pricing.basePrice,
        priceTrend: calculatePriceTrend(material.priceHistory)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取价格历史失败' });
  }
});

// ========== 分类和筛选选项 ==========

// 获取分类列表
router.get('/meta/categories', auth, async (req, res) => {
  try {
    const categories = await Material.distinct('category', { status: 'active' });
    const subcategories = await Material.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: { category: '$category', subcategory: '$subcategory' }, count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      data: {
        categories,
        subcategories: subcategories.map(s => ({
          category: s._id.category,
          subcategory: s._id.subcategory,
          count: s.count
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取分类失败' });
  }
});

// 获取品牌列表
router.get('/meta/brands', auth, async (req, res) => {
  try {
    const brands = await Material.distinct('brand', { status: 'active' });
    res.json({ success: true, data: { brands: brands.filter(b => b) } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取品牌列表失败' });
  }
});

// ========== 辅助函数 ==========

async function recommendMaterials(designData, budget, preferences) {
  // 简化的推荐算法
  const { area, systems = [], rooms = [] } = designData;
  
  const recommendations = {
    bySystem: {},
    byCategory: {}
  };
  
  // 为每个系统推荐材料
  for (const system of systems) {
    const materials = await Material.find({
      applicableSystems: system,
      status: 'active'
    }).sort({ 'usageStats.quoteCount': -1 }).limit(10);
    
    recommendations.bySystem[system] = materials.map(m => ({
      material: m,
      estimatedQty: estimateQty(m, area, rooms),
      estimatedCost: estimateCost(m, area, rooms)
    }));
  }
  
  return recommendations;
}

function estimateQty(material, area, rooms) {
  // 简化估算逻辑
  switch(material.category) {
    case '管材':
      return Math.ceil(area / 10); // 每10平米需要1单位
    case '设备':
      return Math.ceil(area / 50); // 每50平米需要1台
    default:
      return 1;
  }
}

function estimateCost(material, area, rooms) {
  const qty = estimateQty(material, area, rooms);
  const price = material.getPriceWithTax(qty);
  return price.total;
}

function calculateTotalEstimate(recommendations) {
  let total = 0;
  for (const system in recommendations.bySystem) {
    for (const item of recommendations.bySystem[system]) {
      total += item.estimatedCost;
    }
  }
  return total;
}

function calculatePriceTrend(priceHistory) {
  if (priceHistory.length < 2) return 'stable';
  
  const recent = priceHistory.slice(-3);
  const avgRecent = recent.reduce((sum, p) => sum + p.price, 0) / recent.length;
  const older = priceHistory.slice(-6, -3);
  const avgOlder = older.reduce((sum, p) => sum + p.price, 0) / older.length;
  
  const change = (avgRecent - avgOlder) / avgOlder;
  if (change > 0.05) return 'rising';
  if (change < -0.05) return 'falling';
  return 'stable';
}

module.exports = router;
