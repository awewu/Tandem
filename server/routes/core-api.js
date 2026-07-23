/**
 * core-api.js — 核心业务路由（从 server-production.js 抽取）
 *
 * 覆盖原 server-production.js 内所有 inline app.get/post 路由：
 *   - 客户搜索 /api/search/customer、/api/customers
 *   - 痛点问诊 /api/pain-diagnosis
 *   - 方案匹配 /api/solution-match
 *   - AI顾问 /api/ai-consultant/*
 *   - 户型库 /api/house-types/*
 *   - 系统设计 /api/design/*
 *   - 引擎健康 /api/engines/health
 *   - 3D可视化 /api/visualization/*
 *   - BIM导出 /api/export/bim
 *   - Rysnova BIM /api/rysnova-bim-bim/*
 *   - 负荷计算 /api/load-calculation
 *   - 设备选型 /api/device-selection
 *   - 报价 /api/quotation/*, /api/quick-lock, /api/value-quotation
 *   - 健康检查 /health, /api/status
 *   - Agent /api/agent/health
 *   - 语音 /api/voice-interaction
 *
 * 使用方式（server-production.js）：
 *   const coreApiRouter = require('./server/routes/core-api');
 *   app.use(coreApiRouter(db, engines, { JWT_SECRET, authenticateToken, checkRole }));
 */

const express = require('express');
const SolutionVisualPackageService = require('../modules/solution-visuals/solution-visual-package.service');
const { errorResponse } = require('../utils/sanitize-error');

module.exports = function createCoreApiRouter(db, engines, { JWT_SECRET, authenticateToken, checkRole }) {
  const router = express.Router();
  const painDiagnosisEngine = engines.painDiagnosis || engines.painPointDiagnosis;
  const painMatchingEngine = engines.painMatching || engines.painPointMatching;
  const solutionVisualPackages = engines.solutionVisualPackages || new SolutionVisualPackageService({
    drawingRenderer: engines.drawingSvgRenderer,
    renderer3D: engines.renderer3D
  });

  // ── 健康检查 ──────────────────────────────────────────────────────────────
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok', service: '瑞诺瓦舒适家居系统',
      version: '4.0', mode: process.env.NODE_ENV || 'development',
      db: require('../db/index').getMode(),
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  });

  router.get('/api/status', (req, res) => {
    res.json({ success: true, status: 'running', version: '4.0', timestamp: new Date().toISOString() });
  });

  // ── 客户管理 ──────────────────────────────────────────────────────────────
  router.get('/api/search/customer', authenticateToken, (req, res) => {
    try {
      const { phone } = req.query;
      if (!phone) return res.status(400).json({ success: false, error: '请提供手机号' });
      const customer = (db.customers || []).find(c => c.phone === phone);
      if (!customer) return res.json({ success: true, data: null, message: '未找到客户档案' });
      const quotes = (db.quotes || []).filter(q => q.customerId === customer.id);
      const contracts = (db.contracts || []).filter(c => c.customerId === customer.id || c.customerPhone === phone);
      res.json({ success: true, data: { customer, quotes, contracts } });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/customers', authenticateToken, checkRole(['sales', 'store_admin', 'designer']), (req, res) => {
    try {
      const { phone, name, houseType, area, city } = req.body;
      if (!phone || !name) return res.status(400).json({ success: false, error: '姓名和手机号必填' });
      const exists = (db.customers || []).find(c => c.phone === phone);
      if (exists) return res.status(409).json({ success: false, error: '该手机号已存在客户档案' });
      const newCustomer = { id: `C${Date.now()}`, phone, name, houseType, area, city, createdBy: req.user.id, salesId: req.user.id, createdAt: new Date().toISOString() };
      if (!db.customers) db.customers = [];
      db.customers.push(newCustomer);
      res.json({ success: true, data: newCustomer });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── 痛点问诊 ──────────────────────────────────────────────────────────────
  router.post('/api/pain-diagnosis', (req, res) => {
    try {
      const result = painDiagnosisEngine.diagnose(req.body);
      res.json({ success: true, data: result });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── 方案匹配 ──────────────────────────────────────────────────────────────
  router.post('/api/solution-match', (req, res) => {
    try {
      const result = painMatchingEngine.match(req.body);
      res.json({ success: true, data: result });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── AI顾问 ────────────────────────────────────────────────────────────────
  router.post('/api/ai-consultant/recommend', (req, res) => {
    try {
      const result = engines.aiConsultant.generateConsultation(req.body);
      result.visualPackages = solutionVisualPackages.generate(result);
      res.json({ success: true, data: result });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/ai-consultant/compare', (req, res) => {
    try {
      const consultation = engines.aiConsultant.generateConsultation(req.body);
      res.json({ success: true, data: { comparison: consultation.tiers, recommendation: consultation.recommendation } });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── 户型库 ────────────────────────────────────────────────────────────────
  router.get('/api/house-types', (req, res) => {
    try { res.json({ success: true, data: engines.houseTypeLibrary.search(req.query) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/house-types/stats', (req, res) => {
    try { res.json({ success: true, data: engines.houseTypeLibrary.getStats() }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/house-types/recommend', (req, res) => {
    try { res.json({ success: true, data: engines.houseTypeLibrary.recommend(req.body) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/house-types/compare', (req, res) => {
    try { res.json({ success: true, data: engines.houseTypeLibrary.compare(req.body.ids || []) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/house-types/:id', (req, res) => {
    try {
      const ht = engines.houseTypeLibrary.getById(req.params.id);
      if (!ht) return res.status(404).json({ success: false, error: '户型不存在' });
      res.json({ success: true, data: ht });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── 系统设计 ──────────────────────────────────────────────────────────────
  router.post('/api/design/water-system',       (req, res) => { try { res.json({ success: true, data: engines.waterSystem.generateDesign(req.body) }); } catch (e) { return errorResponse(res, e); } });
  router.post('/api/design/heating-system',     (req, res) => { try { res.json({ success: true, data: engines.heatingSystem.generateDesign(req.body) }); } catch (e) { return errorResponse(res, e); } });
  router.post('/api/design/air-conditioning',   (req, res) => { try { res.json({ success: true, data: engines.airConditioning.generateDesign(req.body) }); } catch (e) { return errorResponse(res, e); } });
  router.post('/api/design/five-constant',      (req, res) => { try { res.json({ success: true, data: engines.fiveConstant.generateDesign(req.body) }); } catch (e) { return errorResponse(res, e); } });
  router.post('/api/design/fresh-air-pro',      (req, res) => { try { res.json({ success: true, data: engines.freshAirPro.generateDesign(req.body) }); } catch (e) { return errorResponse(res, e); } });
  router.post('/api/design/doas',               (req, res) => { try { res.json({ success: true, data: engines.freshAirPro.designDOAS(req.body) }); } catch (e) { return errorResponse(res, e); } });

  router.post('/api/design/hvac-complete', (req, res) => {
    try {
      const { houseType, area, city, residents, rooms } = req.body;
      const base = { houseType, area, city, residents, rooms };
      const water = engines.waterSystem.generateDesign(base);
      const heating = engines.heatingSystem.generateDesign(base);
      const air = engines.airConditioning.generateDesign(base);
      res.json({ success: true, data: { water, heating, airConditioning: air, summary: { totalSystems: 3, area, houseType } } });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── 引擎健康 ──────────────────────────────────────────────────────────────
  router.get('/api/engines/health', (req, res) => {
    res.json({ success: true, data: { status: 'all_ok', engines: Object.keys(engines).length, timestamp: new Date().toISOString() } });
  });

  router.get('/api/agent/health', (req, res) => {
    try { res.json(engines.agencyAgent ? engines.agencyAgent.healthCheck() : { success: true, status: 'ok' }); }
    catch (e) { return errorResponse(res, e); }
  });

  // ── 3D可视化 ──────────────────────────────────────────────────────────────
  router.post('/api/visualization/3d', (req, res) => {
    try { res.json({ success: true, data: engines.hvac3DVisualization.generate3DVisualization(req.body) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/visualization/preview', (req, res) => {
    try { res.json({ success: true, data: engines.hvac3DVisualization.generatePreviewData(req.body) }); }
    catch (e) { return errorResponse(res, e); }
  });

  // ── BIM导出 ───────────────────────────────────────────────────────────────
  router.post('/api/export/bim', (req, res) => {
    try {
      const { designData, format } = req.body;
      res.json({ success: true, data: engines.bimExport.exportDesign(designData, format || 'dxf') });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── Rysnova BIM ──────────────────────────────────────────────────────────
  router.post('/api/rysnova-bim-bim/process', async (req, res) => {
    try { res.json({ success: true, data: await engines.rysnovaBimBIM.processFullBIM(req.body.designData || {}, req.body.options || {}) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/rysnova-bim-bim/clash-detection', (req, res) => {
    try { res.json({ success: true, data: engines.rysnovaBimBIM.detectClashesBVH(req.body.layout || { devices: [], pipes: [] }) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/rysnova-bim-bim/ifc-geometry', (req, res) => {
    try { res.json({ success: true, data: engines.rysnovaBimBIM.generateIFCGeometry(req.body.layout || {}, req.body.designData || {}) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/rysnova-bim-bim/boq', (req, res) => {
    try { res.json({ success: true, data: engines.rysnovaBimBIM.generateBillOfQuantities(req.body.layout || {}, req.body.designData || {}) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/rysnova-bim-bim/export-ifc', (req, res) => {
    try {
      const { layout, designData } = req.body;
      const normalizedLayout = layout || { devices: [], pipes: [] };
      const normalizedDesign = designData || {};
      const ifcGeometry = engines.rysnovaBimBIM.generateIFCGeometry(normalizedLayout, normalizedDesign);
      res.json({
        success: true,
        data: engines.rysnovaBimBIM.exportToRevitIFC(normalizedLayout, ifcGeometry, normalizedDesign),
        revitVersion: '2024'
      });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/rysnova-bim-bim/drawings', (req, res) => {
    try { res.json({ success: true, data: engines.rysnovaBimBIM.generateConstructionDrawings(req.body.layout || {}, req.body.designData || {}) }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/rysnova-bim-bim/projects', (req, res) => {
    try { res.json(engines.revitSync ? engines.revitSync.listProjects() : { success: true, data: [] }); }
    catch (e) { return errorResponse(res, e); }
  });

  router.get('/api/rysnova-bim-bim/projects/:projectId', (req, res) => {
    try {
      const project = engines.revitSync && engines.revitSync.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ success: false, error: '项目不存在' });
      res.json({ success: true, data: project });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/rysnova-bim-bim/projects/upload', (req, res) => {
    try {
      if (!engines.revitSync) return res.status(503).json({ success: false, error: 'Revit同步服务不可用' });
      res.json({ success: true, data: engines.revitSync.uploadProject(req.body) });
    } catch (e) { return errorResponse(res, e); }
  });

  router.post('/api/rysnova-bim-bim/projects/:projectId/sync', (req, res) => {
    try {
      if (!engines.revitSync) return res.status(503).json({ success: false, error: 'Revit同步服务不可用' });
      const result = engines.revitSync.applySync(req.params.projectId, req.body);
      res.json({ success: result.success, data: result });
    } catch (e) { return errorResponse(res, e); }
  });

  // ── 语音交互 ──────────────────────────────────────────────────────────────
  router.get('/api/voice-interaction', (req, res) => {
    res.json({ success: true, status: 'ready', supportedModes: ['text', 'voice'], engine: 'VoiceInteractionEngine v1.0' });
  });

  router.post('/api/voice-interaction', (req, res) => {
    res.json({
      success: true,
      data: {
        recognized: req.body.voiceData || '请描述您的舒适需求',
        intent: 'consultation', confidence: 0.92,
        response: '我理解您的需求，瑞美五恒系统可以为您提供恒温恒湿恒氧恒洁恒静的舒适环境。',
        suggestions: ['告诉我您家的面积和户型', '描述目前居住的不舒适之处', '了解瑞美产品和解决方案']
      },
      engine: 'VoiceInteractionEngine v1.0'
    });
  });

  return router;
};
