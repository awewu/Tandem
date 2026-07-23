/**
 * 促销引擎 Router (factory pattern)
 * 挂载前缀: /api/promotions
 * 依赖: promotionEngine (来自 engines.promotion), promotionMatchService
 * 2026-04-22 从 server-production.js 抽出
 */
const { errorResponse } = require('../utils/sanitize-error');
const express = require('express');
const PromotionMatchService = require('../services/PromotionMatchService');

/**
 * 创建 promotion router
 * @param {Object} promotionEngine - engines.promotion 实例
 * @returns {express.Router}
 */
module.exports = function createPromotionRouter(promotionEngine) {
  const router = express.Router();
  const matchService = new PromotionMatchService(promotionEngine);

  // 获取所有可用促销
  router.get('/all', (req, res) => {
    try {
      const promotions = promotionEngine.getAllPromotions();
      res.json({ success: true, data: promotions });
    } catch (error) { return errorResponse(res, error); }
  });

  // 应用促销
  router.post('/apply', (req, res) => {
    try {
      const { order, userProfile } = req.body;
      const result = promotionEngine.applyPromotions(order, userProfile);
      res.json({ success: true, data: result });
    } catch (error) { return errorResponse(res, error); }
  });

  // 更新用户档案
  router.post('/user-profile', (req, res) => {
    try {
      const { userId, profile } = req.body;
      promotionEngine.updateUserProfile(userId, profile);
      res.json({ success: true, message: '用户档案更新成功' });
    } catch (error) { return errorResponse(res, error); }
  });

  // 获取用户档案
  router.get('/user-profile/:userId', (req, res) => {
    try {
      const profile = promotionEngine.getUserProfile(req.params.userId);
      res.json({ success: true, data: profile });
    } catch (error) { return errorResponse(res, error); }
  });

  // 获取促销历史
  router.get('/history/:userId', (req, res) => {
    try {
      const history = promotionEngine.getPromotionHistory(req.params.userId);
      res.json({ success: true, data: history });
    } catch (error) { return errorResponse(res, error); }
  });

  // 智能匹配推荐（销售端核心接口）
  router.post('/match', (req, res) => {
    try {
      const result = matchService.match(req.body || {});
      res.json(result);
    } catch (error) {
      console.error('[promotions/match] error:', error);
      res.status(500).json({ success: false, error: '服务暂时不可用' });
    }
  });

  return router;
};
