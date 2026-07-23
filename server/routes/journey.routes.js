/**
 * 客户全生命周期闭环追踪 Router
 * 挂载前缀: /api/journey
 * 2026-04-22 从 server-production.js 抽出
 */
const express = require('express');
const { asyncRoute, errorResponse } = require('../utils/sanitize-error');
const { getSharedSafeEngines } = require('../modules/runtimeEngineAccess');

// 根据 USE_MONGO env 选择 Store 实现（两个 Store 方法签名一致）
const USE_MONGO = process.env.USE_MONGO === 'true';
const router = express.Router();
let journeyStore;

function createJourneyStore() {
  const engines = getSharedSafeEngines();
  const createStore = USE_MONGO
    ? engines.runtimeServiceFactories.customerJourneyStoreMongo
    : engines.runtimeServiceFactories.customerJourneyStore;
  const store = createStore();
  console.log('✅ Journey Store: ' + (USE_MONGO ? 'MongoDB' : 'JSON file'));
  return store;
}

function getJourneyStore() {
  if (!journeyStore) journeyStore = createJourneyStore();
  return journeyStore;
}

function getJourneySimulator() {
  return getSharedSafeEngines().runtimeServiceFactories.journeySimulator();
}

// 列表查询（支持 status/stage/phone/city/q + 分页 page/pageSize）
router.get('/list', asyncRoute(async (req, res) => {
  const all = await getJourneyStore().list(req.query);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  res.json({ success: true, total: all.length, page, pageSize, totalPages: Math.ceil(all.length / pageSize), items });
}));

// 统计面板
router.get('/stats', asyncRoute(async (req, res) => {
  const store = getJourneyStore();
  const stats = await store.stats();
  res.json({ success: true, stats, dbPath: store.getDbPath(), storage: USE_MONGO ? 'mongo' : 'json' });
}));

// 批量执行10案例自检（写入DB）—— 必须在 /:caseId 之前
router.post('/simulate/run-all', asyncRoute(async (req, res) => {
  // JourneySimulator 同步 API, 仅支持 JSON store
  if (USE_MONGO) return errorResponse(res, new Error('Simulator 暂不支持 Mongo 后端'), 400, '请切换到 JSON 后端再运行模拟器');
  const result = getJourneySimulator().runAll({ reset: req.body?.reset === true, store: getJourneyStore() });
  res.json(result);
}));

// 单客户详情
router.get('/:caseId', asyncRoute(async (req, res) => {
  const j = await getJourneyStore().get(req.params.caseId);
  if (!j) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, journey: j });
}));

// 新建客户
router.post('/', asyncRoute(async (req, res) => {
  res.json({ success: true, journey: await getJourneyStore().create(req.body) });
}));

// 更新阶段
router.patch('/:caseId/stage/:stage', asyncRoute(async (req, res) => {
  res.json({ success: true, journey: await getJourneyStore().updateStage(req.params.caseId, req.params.stage, req.body) });
}));

// 记录沟通
router.post('/:caseId/communication', asyncRoute(async (req, res) => {
  res.json({ success: true, communication: await getJourneyStore().addCommunication(req.params.caseId, req.body) });
}));

// 关闭旅程
router.post('/:caseId/close', asyncRoute(async (req, res) => {
  res.json({ success: true, journey: await getJourneyStore().close(req.params.caseId, req.body.status, req.body.reason) });
}));

module.exports = router;
module.exports.getJourneyStore = getJourneyStore;
Object.defineProperty(module.exports, 'journeyStore', {
  enumerable: true,
  get: getJourneyStore
});
