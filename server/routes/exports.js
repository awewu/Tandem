/**
 * 全业务导出API - Exports API
 * 支持：报价/设计方案/问诊/锁客/材料/图纸/销售方案书/分析报表
 */

const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

const exportEngine = getRuntimeEngine('exportEngine');
const analyticsEngine = getRuntimeEngine('analyticsEngine');

/**
 * POST /api/exports/quotation
 * 导出报价单
 */
router.post('/quotation', async (req, res) => {
  try {
    const { data, format = 'excel' } = req.body;
    
    console.log('[Exports API] 导出报价单:', format);
    
    const result = exportEngine.exportQuotation(data, format);
    
    res.json({
      success: true,
      message: '报价单导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/design
 * 导出设计方案包
 */
router.post('/design', async (req, res) => {
  try {
    const { data, format = 'full' } = req.body;
    
    console.log('[Exports API] 导出设计方案:', format);
    
    const result = exportEngine.exportDesign(data, format);
    
    res.json({
      success: true,
      message: '设计方案导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/diagnosis
 * 导出问诊诊断报告
 */
router.post('/diagnosis', async (req, res) => {
  try {
    const { data, format = 'pdf' } = req.body;
    
    console.log('[Exports API] 导出诊断报告');
    
    const result = exportEngine.exportDiagnosis(data, format);
    
    res.json({
      success: true,
      message: '诊断报告导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/contract
 * 导出合同文档包
 */
router.post('/contract', async (req, res) => {
  try {
    const { data, format = 'pdf' } = req.body;
    
    console.log('[Exports API] 导出合同文档');
    
    const result = exportEngine.exportContract(data, format);
    
    res.json({
      success: true,
      message: '合同文档导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/materials
 * 导出材料清单
 */
router.post('/materials', async (req, res) => {
  try {
    const { data, format = 'excel' } = req.body;
    
    console.log('[Exports API] 导出材料清单');
    
    const result = exportEngine.exportMaterialList(data, format);
    
    res.json({
      success: true,
      message: '材料清单导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/drawings
 * 导出施工图纸
 */
router.post('/drawings', async (req, res) => {
  try {
    const { data, format = 'pdf' } = req.body;
    
    console.log('[Exports API] 导出施工图纸');
    
    const result = exportEngine.exportConstructionDrawings(data, format);
    
    res.json({
      success: true,
      message: '施工图纸导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/proposal
 * 导出销售方案书
 */
router.post('/proposal', async (req, res) => {
  try {
    const { data, format = 'pptx' } = req.body;
    
    console.log('[Exports API] 导出销售方案书');
    
    const result = exportEngine.exportSalesProposal(data, format);
    
    res.json({
      success: true,
      message: '销售方案书导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/analytics/dashboard
 * 业务仪表盘数据
 */
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    console.log('[Analytics API] 获取仪表盘数据:', timeRange);
    
    const result = analyticsEngine.getBusinessDashboard(timeRange);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/analytics/customers
 * 客户洞察分析
 */
router.get('/analytics/customers', async (req, res) => {
  try {
    const result = analyticsEngine.getCustomerAnalytics();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/analytics/design
 * 设计效率分析
 */
router.get('/analytics/design', async (req, res) => {
  try {
    const result = analyticsEngine.getDesignAnalytics();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/analytics/sales
 * 销售转化分析
 */
router.get('/analytics/sales', async (req, res) => {
  try {
    const result = analyticsEngine.getSalesAnalytics();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/analytics/construction
 * 施工运营分析
 */
router.get('/analytics/construction', async (req, res) => {
  try {
    const result = analyticsEngine.getConstructionAnalytics();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/analytics/finance
 * 财务分析
 */
router.get('/analytics/finance', async (req, res) => {
  try {
    const result = analyticsEngine.getFinancialAnalytics();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/analytics/insights
 * 智能预警与洞察
 */
router.get('/analytics/insights', async (req, res) => {
  try {
    const result = analyticsEngine.getInsightsAndAlerts();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/analytics/report
 * 导出分析报表
 */
router.post('/analytics/report', async (req, res) => {
  try {
    const { data, format = 'excel' } = req.body;
    
    console.log('[Analytics API] 导出分析报表');
    
    const result = exportEngine.exportAnalyticsReport(data, format);
    
    res.json({
      success: true,
      message: '分析报表导出成功',
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/analytics/custom
 * 自定义报表
 */
router.post('/analytics/custom', async (req, res) => {
  try {
    const { config } = req.body;
    
    const result = analyticsEngine.generateCustomReport(config);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * POST /api/exports/analytics/compare
 * 周期对比分析
 */
router.post('/analytics/compare', async (req, res) => {
  try {
    const { periodA, periodB } = req.body;
    
    const result = analyticsEngine.comparePeriods(periodA, periodB);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    return errorResponse(res, error);
  }
});

/**
 * GET /api/exports/formats
 * 获取支持的导出格式
 */
router.get('/formats', async (req, res) => {
  res.json({
    success: true,
    data: {
      quotation: ['excel', 'pdf', 'json'],
      design: ['bim', 'cad', 'pdf', 'materials', 'full-package'],
      diagnosis: ['pdf', 'html', 'json'],
      contract: ['pdf', 'docx', 'full-package'],
      materials: ['excel', 'csv', 'json'],
      drawings: ['pdf', 'dwg', 'dxf'],
      proposal: ['pptx', 'html', 'pdf'],
      analytics: ['excel', 'pdf', 'json', 'html']
    }
  });
});

module.exports = router;
