const express = require('express');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');
const LoadCalculationEngineV3 = require('../../core/LoadCalculationEngineV3');
const { FreshAirProEngine } = require('../../core/FreshAirProEngine');
const { WaterSystemEngine } = require('../../core/WaterSystemEngine');
const { AirConditioningEngine } = require('../../core/AirConditioningEngine');
const SmartRoutingEngine = require('../../core/SmartRoutingEngine');
const DevicePositioningEngine = require('../../core/DevicePositioningEngine');
const visualization3DEngine = require('../../core/Visualization3DEngine'); // 单例
const Visualization3DEngine = require('../../core/Visualization3DEngine');
const LocationService = require('../../core/LocationService');

const _loadEngine = new LoadCalculationEngineV3();
let _freshAirEngine, _waterEngine, _acEngine, _routingEngine, _positionEngine, _locationSvc;
function getFreshAirEngine() { return _freshAirEngine || (_freshAirEngine = new FreshAirProEngine()); }
function getWaterEngine()    { return _waterEngine    || (_waterEngine    = new WaterSystemEngine()); }
function getAcEngine()       { return _acEngine       || (_acEngine       = new AirConditioningEngine()); }
function getRoutingEngine()  { return _routingEngine  || (_routingEngine  = new SmartRoutingEngine()); }
function getPositionEngine() { return _positionEngine || (_positionEngine = new DevicePositioningEngine()); }
function getLocationSvc()    { return _locationSvc    || (_locationSvc    = new LocationService()); }

function createDesignCandidateRoutes(options = {}) {
  const router = express.Router();
  const auth = options.requireAuth === false ? (req, res, next) => next() : authenticateV2;
  const scope = options.requireAuth === false ? (req, res, next) => {
    req.scope = req.scope || { tenantId: 'candidate-tenant', userId: 'candidate-user', role: 'candidate' };
    next();
  } : requireTenantScope;

  router.use(auth);
  router.use(scope);

  router.post('/quick/estimate', (req, res) => {
    const area = Number(req.body?.area || req.body?.roomProfile?.area || 120);
    res.json({
      success: true,
      data: {
        estimateId: `EST-${Date.now()}`,
        area,
        systems: ['hot-water', 'heating', 'fresh-air-doas', 'air-conditioning', 'water-quality', 'smart-control'],
        budgetRange: {
          low: Math.round(area * 650),
          high: Math.round(area * 1450)
        },
        candidateSurface: true
      }
    });
  });

  router.post('/load/calculation', async (req, res, next) => {
    try {
      const { area, city = '上海', buildingType = 'residential', mode = 'quick' } = req.body || {};
      if (!area) return res.status(400).json({ success: false, error: 'area is required' });
      const result = mode === 'quick'
        ? _loadEngine.quickEstimate(Number(area), city, buildingType)
        : (() => { _loadEngine.validateParams(req.body); return _loadEngine.calculateHybrid(req.body, city); })();
      res.json({ success: true, data: { ...result, standardBasis: ['GB 55015-2021', 'GB 50736-2012', 'ASHRAE 55-2023'] } });
    } catch (err) { next(err); }
  });

  router.post('/equipment/recommendation', (req, res) => {
    res.json({
      success: true,
      data: {
        systems: [
          { system: 'central-hot-water', brand: 'Rheem', priority: 'production-pack' },
          { system: 'whole-air', brand: 'Ruud', priority: 'production-pack' },
          { system: 'water-quality', brand: '瑞诺瓦', priority: 'production-pack' }
        ],
        preferences: req.body?.preferences || {}
      }
    });
  });

  router.post('/layout/generate', (req, res) => {
    res.json({
      success: true,
      data: {
        layoutId: `LAY-${Date.now()}`,
        zones: req.body?.zones || [],
        status: 'generated'
      }
    });
  });

  // 新风系统设计（接入FreshAirProEngine）
  router.post('/fresh-air/design', async (req, res, next) => {
    try {
      const body = req.body || {};
      // rooms 可传数组或数字（数字时按默认房型展开）
      if (typeof body.rooms === 'number') {
        const n = body.rooms;
        body.rooms = Array.from({ length: n }, (_, i) => ({ name: `房间${i+1}`, type: 'bedroom', area: (body.area || 100) / n }));
      }
      if (!Array.isArray(body.rooms)) body.rooms = [];
      const engine = getFreshAirEngine();
      const result = engine.generateDesign(body);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // 水系统设计（接入WaterSystemEngine）
  router.post('/water/design', async (req, res, next) => {
    try {
      const result = getWaterEngine().generateDesign(req.body || {});
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // 空调设计（接入AirConditioningEngine）
  router.post('/ac/design', async (req, res, next) => {
    try {
      const engine = getAcEngine();
      const { area = 100, city = '上海', buildingType = 'residential' } = req.body || {};
      const result = engine.generateDesign({ area, city, buildingType });
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // 智能布线（接入SmartRoutingEngine）
  router.post('/routing', async (req, res, next) => {
    try {
      const engine = getRoutingEngine();
      const { devices = [], building = {}, routingType = 'hvac' } = req.body || {};
      const result = engine.routeHVAC(devices, building, routingType);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // 设备定位（接入DevicePositioningEngine）
  router.post('/device-positioning', async (req, res, next) => {
    try {
      const engine = getPositionEngine();
      const { devices = [], rooms = [] } = req.body || {};
      // validateDevicePositions 验证并推荐位置
      const result = engine.validateDevicePositions ? engine.validateDevicePositions(devices) : { positions: devices };
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // 城市/位置服务（接入LocationService）
  router.get('/cities', async (req, res, next) => {
    try {
      const svc = getLocationSvc();
      const provinceCode = req.query.province || '';
      const provinces = svc.getProvinces();
      const cities = provinceCode ? svc.getCities(provinceCode) : [];
      res.json({ success: true, data: { provinces, cities } });
    } catch (err) { next(err); }
  });

  router.post('/materials/generate', (req, res) => {
    res.json({
      success: true,
      data: {
        bomId: `BOM-${Date.now()}`,
        items: req.body?.items || [],
        pricingOwner: '/api/quotation-v2/from-bom'
      }
    });
  });

  router.post('/export', (req, res) => {
    res.json({
      success: true,
      data: {
        exportId: `EXP-${Date.now()}`,
        format: req.body?.format || 'pdf',
        status: 'queued'
      }
    });
  });

  router.post('/projects/:projectId/progress', (req, res) => {
    res.json({ success: true, data: { projectId: req.params.projectId, saved: true, progress: req.body || {} } });
  });

  router.get('/projects/:projectId/progress', (req, res) => {
    res.json({ success: true, data: { projectId: req.params.projectId, progress: { step: 'candidate-ready' } } });
  });

  router.post('/projects/:projectId/autosave', (req, res) => {
    res.json({ success: true, data: { projectId: req.params.projectId, autosavedAt: new Date().toISOString() } });
  });

  router.get('/templates', (req, res) => {
    res.json({ success: true, data: [{ id: 'tpl-comfort-default', name: 'Rhautt Comfort 标准模板', type: req.query.type || 'default' }] });
  });

  router.post('/templates/:templateId/use', (req, res) => {
    res.json({ success: true, data: { templateId: req.params.templateId, project: req.body || {} } });
  });

  router.post('/cad/upload', (req, res) => {
    res.json({ success: true, data: { fileId: `CAD-${Date.now()}`, status: 'uploaded' } });
  });

  router.post('/cad/parse', (req, res) => {
    res.json({ success: true, data: { fileId: req.body?.fileId, entities: [], status: 'parsed' } });
  });

  router.post('/3d/render', (req, res) => {
    res.status(202).json({ success: true, data: { renderId: `RND-${Date.now()}`, status: 'queued', quality: req.body?.quality || 'normal' } });
  });

  router.get('/3d/render/:renderId/status', (req, res) => {
    res.json({ success: true, data: { renderId: req.params.renderId, status: 'ready', outputType: '3d-render-probe' } });
  });

  router.post('/layout/collision', (req, res) => {
    res.json({ success: true, data: { collisions: [], checkedAt: new Date().toISOString() } });
  });

  router.post('/layout/optimize-pipes', (req, res) => {
    res.json({ success: true, data: { optimized: true, routes: req.body?.routes || [] } });
  });

  return router;
}

module.exports = createDesignCandidateRoutes;
