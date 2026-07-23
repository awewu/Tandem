/**
 * 【Phase 1进化】渠道管理API路由
 * /api/channel/* - 渠道赋能全功能接口
 */

const express = require('express');
const router = express.Router();
const { getRuntimeEngine } = require('../runtimeEngineAccess');

const channelEngine = getRuntimeEngine('channelManagement');
const fissionEngine = getRuntimeEngine('fissionTracking');
const llmEngine = getRuntimeEngine('llmDiagnosis');
const industryEngine = getRuntimeEngine('industryPlatform');

// ==================== 渠道管理 ====================

/**
 * POST /api/channel/dealer/register
 * 经销商注册
 */
router.post('/dealer/register', async (req, res) => {
  try {
    const result = channelEngine.registerDealer(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/dealer/:id/health
 * 获取经销商健康度评分
 */
router.get('/dealer/:id/health', async (req, res) => {
  try {
    const score = channelEngine.calculateHealthScore(req.params.id);
    res.json({ success: true, score });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/dashboard/headquarter
 * 总部仪表盘数据
 */
router.get('/dashboard/headquarter', async (req, res) => {
  try {
    const dashboard = channelEngine.getHeadquarterDashboard();
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/dashboard/region/:id
 * 区域仪表盘数据
 */
router.get('/dashboard/region/:id', async (req, res) => {
  try {
    const dashboard = channelEngine.getRegionDashboard(req.params.id);
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/dashboard/store/:id
 * 门店仪表盘数据
 */
router.get('/dashboard/store/:id', async (req, res) => {
  try {
    const dashboard = channelEngine.getStoreDashboard(req.params.id);
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 培训系统 ====================

/**
 * GET /api/channel/training/:dealerId/progress
 * 获取培训进度
 */
router.get('/training/:dealerId/progress', async (req, res) => {
  try {
    const progress = channelEngine.getTrainingProgress(req.params.dealerId);
    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/training/courses
 * 获取课程列表
 */
router.get('/training/courses', async (req, res) => {
  try {
    const courses = channelEngine.trainingSystem.courses;
    res.json({ success: true, courses });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 裂变追踪 ====================

/**
 * POST /api/channel/fission/link/generate
 * 生成推广链接
 */
router.post('/fission/link/generate', async (req, res) => {
  try {
    const result = fissionEngine.generatePromotionLink(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/fission/track/click
 * 追踪点击
 */
router.post('/fission/track/click', async (req, res) => {
  try {
    const { trackingCode, visitorInfo } = req.body;
    const result = fissionEngine.trackClick(trackingCode, visitorInfo);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/fission/track/conversion
 * 追踪转化
 */
router.post('/fission/track/conversion', async (req, res) => {
  try {
    const { visitorId, conversionData } = req.body;
    const result = fissionEngine.trackConversion(visitorId, conversionData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/fission/dashboard/:promoterId
 * 推广者数据中心
 */
router.get('/fission/dashboard/:promoterId', async (req, res) => {
  try {
    const { period } = req.query;
    const dashboard = fissionEngine.getPromoterDashboard(req.params.promoterId, period);
    res.json({ success: true, dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/fission/analytics
 * 裂变数据分析 (总部视角)
 */
router.get('/fission/analytics', async (req, res) => {
  try {
    const { period } = req.query;
    const analytics = fissionEngine.getFissionAnalytics(period);
    res.json({ success: true, analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== LLM智能问诊 ====================

/**
 * POST /api/channel/llm/diagnosis/start
 * 开始LLM问诊
 */
router.post('/llm/diagnosis/start', async (req, res) => {
  try {
    const { sessionId, context } = req.body;
    const result = await llmEngine.startDiagnosis(sessionId || `DS${Date.now()}`, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/llm/diagnosis/reply
 * 处理用户回复
 */
router.post('/llm/diagnosis/reply', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    const result = await llmEngine.processReply(sessionId, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/llm/diagnosis/:sessionId/history
 * 获取对话历史
 */
router.get('/llm/diagnosis/:sessionId/history', async (req, res) => {
  try {
    const history = llmEngine.getConversationHistory(req.params.sessionId);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/llm/explanation
 * 生成方案讲解
 */
router.post('/llm/explanation', async (req, res) => {
  try {
    const { systemName, customerProfile } = req.body;
    const explanation = await llmEngine.generateExplanation(systemName, customerProfile);
    res.json({ success: true, explanation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/llm/comparison
 * 生成竞品对比
 */
router.post('/llm/comparison', async (req, res) => {
  try {
    const { competitor, ourSystem } = req.body;
    const comparison = await llmEngine.generateComparison(competitor, ourSystem);
    res.json({ success: true, comparison });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 产业平台 ====================

/**
 * POST /api/channel/platform/designer/register
 * 设计师注册
 */
router.post('/platform/designer/register', async (req, res) => {
  try {
    const result = industryEngine.registerDesigner(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/platform/designer/:id/rating
 * 获取设计师评级
 */
router.get('/platform/designer/:id/rating', async (req, res) => {
  try {
    const rating = industryEngine.calculateDesignerRating(req.params.id);
    res.json({ success: true, rating });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/platform/designer/match
 * 智能匹配设计师
 */
router.post('/platform/designer/match', async (req, res) => {
  try {
    const matches = industryEngine.matchDesignerToProject(req.body);
    res.json({ success: true, matches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/platform/installer/register
 * 安装商注册
 */
router.post('/platform/installer/register', async (req, res) => {
  try {
    const result = industryEngine.registerInstaller(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/platform/installer/schedule
 * 安装商调度
 */
router.post('/platform/installer/schedule', async (req, res) => {
  try {
    const schedule = industryEngine.scheduleInstallation(req.body.project, req.body.constraints);
    res.json({ success: true, schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/platform/trends
 * 行业趋势分析
 */
router.get('/platform/trends', async (req, res) => {
  try {
    const { region, period } = req.query;
    const trends = industryEngine.analyzeIndustryTrends(region, period);
    res.json({ success: true, trends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/channel/platform/demand-prediction
 * 需求预测
 */
router.get('/platform/demand-prediction', async (req, res) => {
  try {
    const { region, season } = req.query;
    const prediction = industryEngine.predictDemand(region, season);
    res.json({ success: true, prediction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/channel/platform/regional-strategy
 * 生成区域策略
 */
router.post('/platform/regional-strategy', async (req, res) => {
  try {
    const strategy = industryEngine.generateRegionalStrategy(req.body);
    res.json({ success: true, strategy });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
