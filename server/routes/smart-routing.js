/**
 * 智能布线API路由 - Smart Routing API
 * 对标并超越优筑家智能布线功能
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function getEngine() {
  return getRuntimeEngine('smartRouting');
}

/**
 * POST /api/rysnova-bim/smart-route
 * 智能布线主接口 - 超越优筑家的核心功能
 */
router.post('/smart-route', async (req, res) => {
  try {
    const { system, devices, building, routingType = 'auto' } = req.body;
    
    console.log(`[SmartRouting API] 收到${system}布线请求，设备数量: ${devices?.length || 0}`);
    
    // 参数验证
    if (!system || !devices || !Array.isArray(devices)) {
      return res.status(400).json({
        success: false,
        message: '参数错误：需要system和devices数组'
      });
    }
    
    // 调用智能布线引擎
    const result = getEngine().route({
      system,
      devices,
      building,
      routingType
    });
    
    res.json({
      success: true,
      message: `${system}智能布线完成`,
      data: result,
      advantages: [
        '水力自动计算（超越优筑家）',
        '碰撞自动检测（超越优筑家）',
        '材料自动统计（超越优筑家）',
        '多专业集成（超越优筑家）'
      ],
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[SmartRouting API] 错误:', error);
    return errorResponse(res, error);
  }
});

/**
 * GET /api/rysnova-bim/smart-route/systems
 * 获取支持的系统类型
 */
router.get('/smart-route/systems', (req, res) => {
  res.json({
    success: true,
    data: {
      systems: [
        {
          id: 'hvac',
          name: '中央空调',
          icon: '❄️',
          features: ['冷媒管布线', '冷凝水管布线', '水力计算', '材料统计'],
          vsYouzhujia: '超越：水力计算+碰撞检测'
        },
        {
          id: 'plumbing',
          name: '水系统',
          icon: '💧',
          features: ['供水管布线', '回水管布线', '压力损失计算', '泵选型'],
          vsYouzhujia: '超越：专业暖通水系统'
        },
        {
          id: 'freshAir',
          name: '新风系统',
          icon: '🌪️',
          features: ['新风管布线', '排风管布线', '风量平衡', '消声器布置'],
          vsYouzhujia: '新增：优筑家没有'
        },
        {
          id: 'floorHeating',
          name: '地暖系统',
          icon: '🔥',
          features: ['盘管布线', '回路平衡', '热负荷分配', '分集水器布置'],
          vsYouzhujia: '新增：优筑家没有'
        },
        {
          id: 'electrical',
          name: '电系统',
          icon: '⚡',
          features: ['强电布线', '弱电布线', '负载计算', '电压降计算'],
          vsYouzhujia: '对标：功能持平'
        },
        {
          id: 'all',
          name: '全专业协同',
          icon: '🔧',
          features: ['多专业集成', '碰撞检测', '材料汇总', '施工统筹'],
          vsYouzhujia: '超越：全专业协同'
        }
      ]
    }
  });
});

/**
 * POST /api/rysnova-bim/smart-route/collision-detect
 * 碰撞检测接口
 */
router.post('/smart-route/collision-detect', (req, res) => {
  try {
    const { pipes } = req.body;
    
    if (!pipes || !Array.isArray(pipes)) {
      return res.status(400).json({
        success: false,
        message: '需要pipes数组'
      });
    }
    
    const collisions = getEngine().detectCollisions(pipes);
    
    res.json({
      success: true,
      data: {
        collisions,
        count: collisions.length,
        pass: collisions.length === 0,
        message: collisions.length === 0 ? '✅ 未发现碰撞' : `⚠️ 发现${collisions.length}处碰撞，请调整`
      }
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/rysnova-bim/smart-route/hydraulic-calc
 * 水力计算接口
 */
router.post('/smart-route/hydraulic-calc', (req, res) => {
  try {
    const { pipes, flowRate } = req.body;
    
    const hydraulicResult = getEngine().calculateHydraulics(pipes || [], []);
    
    // 添加泵选型
    const pumpSuggestion = getEngine().suggestPump(hydraulicResult);
    
    res.json({
      success: true,
      data: {
        ...hydraulicResult,
        pumpSuggestion,
        recommendations: [
          `管路总长度: ${hydraulicResult.totalLength.toFixed(1)}m`,
          `建议水泵: ${pumpSuggestion.model}`,
          `水泵功率: ${pumpSuggestion.power}kW`,
          `预留20%扬程余量`
        ]
      }
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/rysnova-bim/smart-route/materials
 * 材料统计接口
 */
router.post('/smart-route/materials', (req, res) => {
  try {
    const { pipes } = req.body;
    
    const materials = getEngine().calculateMaterials(pipes || []);
    
    // 计算总价（模拟）
    let totalPrice = 0;
    Object.entries(materials.pipes).forEach(([key, length]) => {
      const pricePerMeter = key.includes('9.52') ? 45 : 65;
      totalPrice += length * pricePerMeter;
    });
    
    res.json({
      success: true,
      data: {
        materials,
        summary: {
          totalPrice: Math.round(totalPrice),
          currency: 'CNY',
          itemCount: Object.keys(materials.pipes).length +
                    Object.keys(materials.insulation).length +
                    Object.keys(materials.fittings).length
        }
      }
    });
    
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/rysnova-bim/smart-route/capabilities
 * 获取引擎能力清单
 */
router.get('/smart-route/capabilities', (req, res) => {
  res.json({
    success: true,
    data: {
      engine: {
        name: engine.name,
        version: engine.version,
        capabilities: engine.capabilities
      },
      comparison: {
        youzhujia: ['中央空调布线', '水电布线'],
        rheem: [
          '中央空调布线 + 水力计算',
          '水系统布线 + 压力损失',
          '新风系统布线（新增）',
          '地暖系统布线（新增）',
          '电系统布线 + 电压降',
          '碰撞检测（超越）',
          '材料统计（超越）',
          '全专业协同（超越）'
        ],
        advantage: '瑞美：5大系统+7项专业计算，优筑家：2大系统基础布线'
      }
    }
  });
});

module.exports = router;
