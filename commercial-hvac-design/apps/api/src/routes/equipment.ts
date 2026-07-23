import { Router } from 'express';

const router = Router();

// 空气源热泵产品库 (MVP简化版)
const heatPumpDatabase = [
  {
    id: 'hp-001',
    brand: 'Rheem',
    model: 'KFXRS-19II',
    type: '常温型',
    heatingPower: 19, // kW
    copHeating: 4.2,
    maxWaterTemp: 60,
    ambientTempRange: '-7~43',
    price: 28000,
  },
  {
    id: 'hp-002',
    brand: 'Rheem',
    model: 'KFXRS-38II',
    type: '常温型',
    heatingPower: 38,
    copHeating: 4.0,
    maxWaterTemp: 60,
    ambientTempRange: '-7~43',
    price: 48000,
  },
  {
    id: 'hp-003',
    brand: 'Rheem',
    model: 'KFXRS-19II-L',
    type: '低温型',
    heatingPower: 17,
    copHeating: 3.8,
    maxWaterTemp: 60,
    ambientTempRange: '-15~43',
    price: 32000,
  },
  {
    id: 'hp-004',
    brand: 'Rheem',
    model: 'KFXRS-76II-L',
    type: '低温型',
    heatingPower: 76,
    copHeating: 3.6,
    maxWaterTemp: 60,
    ambientTempRange: '-15~43',
    price: 85000,
  },
  {
    id: 'hp-005',
    brand: 'Ruud',
    model: 'Ultra-30P',
    type: '超低温型',
    heatingPower: 30,
    copHeating: 3.2,
    maxWaterTemp: 65,
    ambientTempRange: '-30~43',
    price: 45000,
  },
  {
    id: 'hp-006',
    brand: 'Ruud',
    model: 'Ultra-60P',
    type: '超低温型',
    heatingPower: 60,
    copHeating: 3.0,
    maxWaterTemp: 65,
    ambientTempRange: '-30~43',
    price: 78000,
  },
];

/**
 * GET /api/equipment/heat-pumps
 * 获取热泵列表
 */
router.get('/heat-pumps', (req, res) => {
  const { type, minPower, maxPrice } = req.query;
  
  let filtered = [...heatPumpDatabase];
  
  if (type) {
    filtered = filtered.filter(item => item.type === type);
  }
  
  if (minPower) {
    filtered = filtered.filter(item => item.heatingPower >= Number(minPower));
  }
  
  if (maxPrice) {
    filtered = filtered.filter(item => item.price <= Number(maxPrice));
  }
  
  res.json({
    success: true,
    count: filtered.length,
    data: filtered,
  });
});

/**
 * GET /api/equipment/heat-pumps/:id
 * 获取热泵详情
 */
router.get('/heat-pumps/:id', (req, res) => {
  const { id } = req.params;
  const equipment = heatPumpDatabase.find(item => item.id === id);
  
  if (!equipment) {
    return res.status(404).json({ error: 'Equipment not found' });
  }
  
  res.json({
    success: true,
    data: equipment,
  });
});

/**
 * POST /api/equipment/recommend
 * 智能推荐设备
 */
router.post('/recommend', (req, res) => {
  const { 
    heatConsumption,     // kW
    ambientTemp,         // 环境温度
    budget,              // 预算
    redundancy = 1.1,    // 冗余系数
  } = req.body;
  
  if (!heatConsumption) {
    return res.status(400).json({
      error: 'Missing required parameter: heatConsumption',
    });
  }
  
  const requiredPower = heatConsumption * redundancy;
  
  // 选择策略
  let selected = heatPumpDatabase.filter(item => item.heatingPower >= requiredPower);
  
  // 根据环境温度筛选
  if (ambientTemp && Number(ambientTemp) < -15) {
    selected = selected.filter(item => item.type === '超低温型');
  } else if (ambientTemp && Number(ambientTemp) < -7) {
    selected = selected.filter(item => item.type === '低温型' || item.type === '超低温型');
  }
  
  // 预算限制
  if (budget) {
    selected = selected.filter(item => item.price <= Number(budget));
  }
  
  // 生成推荐方案
  const schemes = [
    {
      name: '经济型',
      description: '性价比最优方案',
      equipment: selected.length > 0 ? [selected[0]] : [],
      totalPower: selected.length > 0 ? selected[0].heatingPower : 0,
      totalPrice: selected.length > 0 ? selected[0].price : 0,
    },
    {
      name: '标准型',
      description: 'N+1备份，可靠性高',
      equipment: selected.length > 0 
        ? [selected[0], { ...selected[0], id: selected[0].id + '-backup', note: '备用机组' }]
        : [],
      totalPower: selected.length > 0 ? selected[0].heatingPower * 2 : 0,
      totalPrice: selected.length > 0 ? selected[0].price * 2 : 0,
    },
    {
      name: '豪华型',
      description: '超低温型，全气候适应',
      equipment: selected.filter(item => item.type === '超低温型').slice(0, 2),
      totalPower: selected
        .filter(item => item.type === '超低温型')
        .slice(0, 2)
        .reduce((sum, item) => sum + item.heatingPower, 0),
      totalPrice: selected
        .filter(item => item.type === '超低温型')
        .slice(0, 2)
        .reduce((sum, item) => sum + item.price, 0),
    },
  ];
  
  res.json({
    success: true,
    data: {
      requiredPower: Math.round(requiredPower * 100) / 100,
      schemes: schemes.filter(s => s.equipment.length > 0),
      availableEquipment: selected,
    },
  });
});

/**
 * GET /api/equipment/types
 * 获取设备类型列表
 */
router.get('/types', (req, res) => {
  res.json({
    success: true,
    data: {
      heatPumpTypes: ['常温型', '低温型', '超低温型', '高温型'],
      brands: ['Rheem', 'Ruud', 'Haier', 'Midea', 'Gree'],
    },
  });
});

export { router as equipmentRoutes };
