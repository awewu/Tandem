/**
 * 三档方案统一 API 路由
 * 所有入口（AI问诊/销售/设计师/模板库）都应调用本路由
 * 详见 docs/THREE-TIER-CONTRACT.md
 */

const express = require('express');
const router = express.Router();
const { errorResponse } = require('../utils/sanitize-error');
const { getRuntimeEngine } = require('../modules/runtimeEngineAccess');

// 单例引擎（无状态，可复用）
const engine = getRuntimeEngine('threeTier');

/**
 * POST /api/three-tier/generate
 * 统一三档方案生成
 * Body: { area, houseType?, city?, budget?, painPoints?, priorities?, residents?, hasElderly?, hasChildren?, hasPet? }
 * 注：本端点对外开放（匿名也可调用）——用于AI问诊的无登录试用场景
 */
router.post('/generate', async (req, res) => {
  try {
    const result = engine.generate(req.body || {});
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message && error.message.includes('必填')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return errorResponse(res, error);
  }
});

/**
 * POST /api/three-tier/quick
 * 快速套餐价预估（仅需 area + city）
 * 用于销售工作台一键报价
 */
router.post('/quick', async (req, res) => {
  try {
    const { area, city } = req.body || {};
    const result = engine.quickQuote({ area, city });
    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message && error.message.includes('必填')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return errorResponse(res, error);
  }
});

/**
 * GET /api/three-tier/pricing-matrix
 * 返回当前套餐定价配置（前端展示用）
 */
router.get('/pricing-matrix', (req, res) => {
  res.json({
    success: true,
    data: {
      packagePricing: engine.PACKAGE_PRICING,
      cityFactors: engine.CITY_FACTORS
    }
  });
});

module.exports = router;
