import { Router } from 'express';
import { hotWaterEngine } from '../engines/HotWaterCalculationEngine.js';

const router = Router();

/**
 * POST /api/calculations/hot-water
 * 热水负荷计算
 */
router.post('/hot-water', (req, res) => {
  try {
    const {
      buildingType,
      unitCount,
      coldWaterTemp,
      hotWaterTemp = 60,
      hourlyVariationCoeff,
      dailyWaterQuota,
    } = req.body;

    // 参数验证
    if (!buildingType || !unitCount || !coldWaterTemp || !hourlyVariationCoeff || !dailyWaterQuota) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['buildingType', 'unitCount', 'coldWaterTemp', 'hourlyVariationCoeff', 'dailyWaterQuota'],
      });
    }

    // 执行计算
    const result = hotWaterEngine.calculate({
      buildingType,
      buildingArea: req.body.buildingArea || 0,
      unitCount,
      coldWaterTemp,
      hotWaterTemp,
      hourlyVariationCoeff,
      dailyWaterQuota,
      usageType: req.body.usageType || 'allDay',
    });

    // 生成24小时曲线
    const curve = hotWaterEngine.generate24HourCurve({
      buildingType,
      buildingArea: req.body.buildingArea || 0,
      unitCount,
      coldWaterTemp,
      hotWaterTemp,
      hourlyVariationCoeff,
      dailyWaterQuota,
      usageType: req.body.usageType || 'allDay',
    });

    res.json({
      success: true,
      data: {
        ...result,
        curve24h: curve,
      },
    });
  } catch (error: any) {
    console.error('Hot water calculation error:', error);
    res.status(500).json({
      error: 'Calculation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/calculations/building-types
 * 获取支持的计算参数
 */
router.get('/building-types', (req, res) => {
  const buildingTypes = [
    { id: 'hotel', name: '酒店', unit: '间', icon: '🏨' },
    { id: 'hospital', name: '医院', unit: '床', icon: '🏥' },
    { id: 'school', name: '学校', unit: '人', icon: '🎓' },
    { id: 'gym', name: '健身房', unit: '人', icon: '🏋️' },
    { id: 'restaurant', name: '餐厅', unit: '人', icon: '🍽️' },
    { id: 'office', name: '办公楼', unit: '人', icon: '🏢' },
    { id: 'factory', name: '工厂', unit: '人', icon: '🏭' },
    { id: 'swimmingPool', name: '游泳馆', unit: '人', icon: '🏊' },
  ];

  res.json({
    success: true,
    data: buildingTypes,
  });
});

/**
 * GET /api/calculations/defaults/:buildingType
 * 获取建筑类型默认参数
 */
router.get('/defaults/:buildingType', (req, res) => {
  const { buildingType } = req.params;
  const defaults = hotWaterEngine.constructor.prototype.getBuildingTypeDefaults(buildingType);

  if (!defaults) {
    return res.status(404).json({
      error: 'Building type not found',
      availableTypes: ['hotel', 'hospital', 'school', 'gym', 'restaurant', 'office', 'factory', 'swimmingPool'],
    });
  }

  res.json({
    success: true,
    data: {
      buildingType,
      ...defaults,
    },
  });
});

export { router as calculationRoutes };
