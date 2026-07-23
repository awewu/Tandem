/**
 * 热水系统API - Hot Water System API
 * 热水负荷计算、设备选型、管路设计
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const engine = getRuntimeEngine('hotWater');

/**
 * POST /api/hotwater/residential
 * 住宅热水计算
 */
router.post('/residential', (req, res) => {
  try {
    const { rooms, persons, bathrooms, hasBathtub, buildingType = 'apartment' } = req.body;
    
    console.log('[HotWater API] 住宅热水计算:', { rooms, persons, bathrooms });
    
    if (!rooms || !persons) {
      return res.status(400).json({
        success: false,
        message: '参数错误：需要rooms和persons'
      });
    }
    
    const result = engine.calculateResidential({
      rooms: parseInt(rooms),
      persons: parseInt(persons),
      bathrooms: parseInt(bathrooms) || 1,
      hasBathtub: hasBathtub || false,
      buildingType
    });
    
    res.json({
      success: true,
      message: '住宅热水计算完成',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[HotWater API] 计算失败:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /api/hotwater/commercial
 * 商业热水计算
 */
router.post('/commercial', (req, res) => {
  try {
    const { buildingType, beds, seats, area } = req.body;
    
    console.log('[HotWater API] 商业热水计算:', { buildingType, beds, seats, area });
    
    if (!buildingType || (!beds && !seats && !area)) {
      return res.status(400).json({
        success: false,
        message: '参数错误：需要buildingType和beds/seats/area'
      });
    }
    
    const result = engine.calculateCommercial({
      buildingType,
      beds: parseInt(beds) || 0,
      seats: parseInt(seats) || 0,
      area: parseInt(area) || 0
    });
    
    res.json({
      success: true,
      message: '商业热水计算完成',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[HotWater API] 计算失败:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /api/hotwater/quick-estimate
 * 快速估算
 */
router.post('/quick-estimate', (req, res) => {
  try {
    const { buildingType, area, persons } = req.body;
    
    const result = engine.quickEstimate(
      buildingType || 'residential',
      parseInt(area) || 100,
      parseInt(persons) || 3
    );
    
    res.json({
      success: true,
      message: '快速估算完成',
      data: result,
      buildingType,
      area,
      persons
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/hotwater/heater-types
 * 获取热水器类型清单
 */
router.get('/heater-types', (req, res) => {
  res.json({
    success: true,
    data: {
      residential: [
        { type: '即热式燃气', pros: ['即开即热', '节省空间'], cons: ['需燃气管道', '水压要求高'] },
        { type: '储水式电', pros: ['安装简单', '水温稳定'], cons: ['体积较大', '热水量有限'] },
        { type: '空气能', pros: ['节能环保', '大水量'], cons: ['初投资高', '占用空间'] },
        { type: '壁挂炉', pros: ['供暖热水两用'], cons: ['需配合供暖系统'] }
      ],
      commercial: [
        { type: '容积式电热水器', capacity: '100-500L', pros: ['安装灵活'], cons: ['能耗较高'] },
        { type: '燃气锅炉', capacity: '500-5000L', pros: ['成本低', '大容量'], cons: ['需燃气管道'] },
        { type: '空气能热泵', capacity: '1000-10000L', pros: ['最节能'], cons: ['初投资最高'] }
      ]
    }
  });
});

/**
 * GET /api/hotwater/standards
 * 获取用水标准
 */
router.get('/standards', (req, res) => {
  res.json({
    success: true,
    data: {
      residential: {
        '普通住宅': { perPerson: 60, unit: 'L/人·天' },
        '别墅': { perPerson: 80, unit: 'L/人·天' },
        '公寓': { perPerson: 50, unit: 'L/人·天' }
      },
      commercial: {
        '酒店客房': { perUnit: 120, unit: 'L/床·天' },
        '医院病房': { perUnit: 150, unit: 'L/床·天' },
        '健身房': { perUnit: 50, unit: 'L/淋浴位·天' },
        '餐厅': { perUnit: 15, unit: 'L/餐位·天' },
        '办公楼': { perUnit: 5, unit: 'L/m²·天' }
      },
      temperatures: {
        coldWater: 10,
        hotWater: 60,
        useTemperature: 40,
        deltaT: 50
      }
    }
  });
});

module.exports = router;
