/**
 * 智能报价API v2.0 - Quotation API
 * 多维度报价：产品+材料+施工+管理+面积+环境
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const QuotationService = require('../modules/quotation/quotation.service');
const { authenticateV2 } = require('../middleware/authenticateV2');
const { requireTenantScope } = require('../middleware/tenantScope');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

function createQuotationV2Routes(options = {}) {
const router = express.Router();
const engine = options.engine || getRuntimeEngine('quotationV2', options);
const quotationService = options.quotationService || new QuotationService({ engine });

/**
 * POST /api/quotation-v2/generate
 * 生成多维度智能报价
 */
router.post('/generate', async (req, res) => {
  try {
    const params = req.body;
    
    console.log('[Quotation API] 生成报价:', params);
    
    const quote = engine.generateMultiDimensionalQuote(params);
    
    res.json({
      success: true,
      message: '报价生成成功',
      data: quote
    });
  } catch (error) {
    console.error('[Quotation API] 错误:', error);
    return errorResponse(res, error);
  }
});

/**
 * POST /api/quotation-v2/quick-estimate
 * 快速估算
 */
router.post('/quick-estimate', async (req, res) => {
  try {
    const { area, systems, city } = req.body;
    
    const estimate = engine.quickEstimate(area, systems, city);
    
    res.json({
      success: true,
      message: '快速估算完成',
      data: estimate
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/quotation-v2/from-bom
 * 从设计师工作台 BOM 生成受控报价
 */
router.post('/from-bom', async (req, res) => {
  try {
    const quote = engine.generateQuoteFromBOM(req.body || {});

    res.json({
      success: true,
      message: 'BOM报价生成成功',
      data: quote
    });
  } catch (error) {
    return errorResponse(res, error, error.status || 500);
  }
});

/**
 * POST /api/quotation-v2/persist-from-bom
 * 从设计师工作台 BOM 生成并保存租户隔离的 v2 报价
 */
router.post('/persist-from-bom', authenticateV2, requireTenantScope, async (req, res) => {
  try {
    const result = await quotationService.persistFromBOM(req.scope, req.body || {});

    res.status(201).json({
      success: true,
      message: 'BOM报价已保存',
      data: {
        quotation: result.quotation,
        quote: result.quote
      }
    });
  } catch (error) {
    return errorResponse(res, error, error.status || 500);
  }
});

/**
 * GET /api/quotation-v2/persisted
 * 查询租户隔离的 v2 报价
 */
router.get('/persisted', authenticateV2, requireTenantScope, async (req, res) => {
  try {
    const result = await quotationService.list(req.scope, req.query || {});

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error, error.status || 500);
  }
});

/**
 * GET /api/quotation-v2/pricing-models
 * 获取定价模型清单
 */
router.get('/pricing-models', async (req, res) => {
  try {
    const models = engine.pricingModels;
    
    res.json({
      success: true,
      data: {
        models,
        comparison: {
          kujiale: '适合整装，按空间模块化',
          qijia: '适合透明报价，清单明细',
          tubatu: '适合快速成交，套餐+增项',
          rheem: '适合专业暖通，全系统覆盖'
        }
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/quotation-v2/region-factors
 * 获取地区系数
 */
router.get('/region-factors', async (req, res) => {
  try {
    const { city } = req.query;
    
    const factors = engine.regionFactors;
    
    // 如果指定城市，返回该城市系数
    let cityFactor = null;
    if (city) {
      if (factors.tier1.cities.includes(city)) {
        cityFactor = { tier: 1, ...factors.tier1 };
      } else if (factors.tier2.cities.includes(city)) {
        cityFactor = { tier: 2, ...factors.tier2 };
      } else {
        cityFactor = { tier: 3, ...factors.tier3 };
      }
    }
    
    res.json({
      success: true,
      data: {
        allFactors: factors,
        cityFactor
      }
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/quotation-v2/compare-versions
 * 对比不同版本报价
 */
router.post('/compare-versions', async (req, res) => {
  try {
    const { economy, standard, premium } = req.body;
    
    const comparison = {
      dimensions: ['总价', '每平米', '设备等级', '材料等级', '质保年限'],
      economy: {
        total: economy.amount,
        perSqm: economy.perSqm,
        equipment: '基础',
        material: '国产',
        warranty: '3年'
      },
      standard: {
        total: standard.amount,
        perSqm: standard.perSqm,
        equipment: '标准',
        material: '优质',
        warranty: '5年',
        recommended: true
      },
      premium: {
        total: premium.amount,
        perSqm: premium.perSqm,
        equipment: '旗舰',
        material: '进口',
        warranty: '8年'
      }
    };
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/quotation-v2/export
 * 导出报价单
 */
router.post('/export', async (req, res) => {
  try {
    const { quoteId, format = 'pdf' } = req.body;
    
    // 模拟导出
    const exportData = {
      quoteId,
      format,
      exportUrl: `/exports/quotation_${quoteId}.${format}`,
      generatedAt: new Date()
    };
    
    res.json({
      success: true,
      message: '报价单导出成功',
      data: exportData
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/quotation-v2/benchmark
 * 获取市场基准价
 */
router.get('/benchmark', async (req, res) => {
  try {
    const { area, systems, city } = req.query;
    
    // 模拟市场基准数据
    const benchmark = {
      marketAverage: {
        perSqm: 1200,
        total: area * 1200
      },
      competitors: [
        { name: '竞品A', perSqm: 1150, features: ['基础配置'] },
        { name: '竞品B', perSqm: 1350, features: ['智能控制'] },
        { name: '瑞美', perSqm: 1050, features: ['全系统', '5年质保'] }
      ],
      pricePosition: 'below_market',
      advantage: '较市场均价低12%'
    };
    
    res.json({
      success: true,
      data: benchmark
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/quotation-v2/feedback
 * 报价反馈（用于AI学习）
 */
router.post('/feedback', async (req, res) => {
  try {
    const { quoteId, converted, reason, customerFeedback } = req.body;
    
    // 记录学习数据
    const learningRecord = engine.learnFromConversion(
      { quoteId },
      { converted, reason, customerFeedback }
    );
    
    res.json({
      success: true,
      message: '反馈已记录，用于优化报价策略',
      data: learningRecord
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

return router;
}

const router = createQuotationV2Routes();
router.createQuotationV2Routes = createQuotationV2Routes;

module.exports = router;
