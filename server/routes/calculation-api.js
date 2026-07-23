/**
 * 五大系统设计计算API路由
 * /api/calc/* - 专业设计计算接口
 */

const express = require('express');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function createCalculationApiRouter(options = {}) {
const route = express.Router();
const calc = options.engine || getRuntimeEngine('calculation', options);

// ==================== 热水系统API ====================

// POST /api/calc/hot-water/demand - 热水用水量计算
route.post('/hot-water/demand', (req, res) => {
  try {
    const result = calc.calculateHotWaterDemand(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/calc/hot-water/heat - 热水热负荷计算
route.post('/hot-water/heat', (req, res) => {
  try {
    const result = calc.calculateHotWaterHeatLoad(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/calc/hot-water/equipment - 热水设备选型
route.post('/hot-water/equipment', (req, res) => {
  try {
    const result = calc.selectHotWaterEquipment(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== 净水系统API ====================

// POST /api/calc/water/flow - 净水流量计算
route.post('/water/flow', (req, res) => {
  try {
    const result = calc.calculateWaterTreatmentFlow(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/calc/water/system - 净水系统推荐
route.post('/water/system', (req, res) => {
  try {
    const result = calc.recommendWaterTreatmentSystem(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== 新风系统API ====================

// POST /api/calc/fresh-air/volume - 新风量计算
route.post('/fresh-air/volume', (req, res) => {
  try {
    const result = calc.calculateFreshAirVolume(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/calc/fresh-air/heat-recovery - 热回收计算
route.post('/fresh-air/heat-recovery', (req, res) => {
  try {
    const result = calc.calculateHeatRecovery(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/calc/fresh-air/duct - 风管阻力计算
route.post('/fresh-air/duct', (req, res) => {
  try {
    const result = calc.calculateDuctResistance(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== 制冷系统API ====================

// POST /api/calc/cooling/load - 冷负荷计算
route.post('/cooling/load', (req, res) => {
  try {
    const result = calc.calculateCoolingLoad(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/calc/cooling/equipment - 制冷设备选型
route.post('/cooling/equipment', (req, res) => {
  try {
    const result = calc.selectCoolingEquipment(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== DOAS专用API ====================

// POST /api/calc/doas/design - DOAS系统设计计算
route.post('/doas/design', (req, res) => {
  try {
    const result = calc.calculateDOAS(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== 完整项目计算API ====================

// POST /api/calc/project/complete - 完整项目计算
route.post('/project/complete', (req, res) => {
  try {
    const result = calc.calculateCompleteProject(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== 工具API ====================

// GET /api/calc/climate/:zone - 获取气候区参数
route.get('/climate/:zone', (req, res) => {
  try {
    const result = calc.getClimateParams(req.params.zone);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/calc/standards - 获取支持的计算标准
route.get('/standards', (req, res) => {
  res.json({
    success: true,
    data: {
      chinese: ['GB 50736', 'GB 50015', 'GB 50176', 'GB 21455', 'GB 20665'],
      international: ['ASHRAE 62.1', 'ASHRAE 90.1', 'ASHRAE 183', 'ISO 13790']
    }
  });
});

// GET /api/calc/version - 获取计算引擎版本
route.get('/version', (req, res) => {
  res.json({
    success: true,
    data: {
      version: calc.version,
      engine: 'CalculationEngine',
      modules: ['CALC-HS', 'CALC-WT', 'CALC-FA', 'CALC-AC', 'CALC-DOAS']
    }
  });
});

return route;
}

const router = createCalculationApiRouter();
router.createCalculationApiRouter = createCalculationApiRouter;

module.exports = router;
