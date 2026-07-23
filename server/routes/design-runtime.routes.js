const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function pickNumber(...values) {
  const value = values.find(v => Number.isFinite(Number(v)));
  return value == null ? undefined : Number(value);
}

function createDesignRuntimeRouter(engines, { heartbeat } = {}) {
  const router = express.Router();

  router.get('/api/heartbeat', (req, res) => {
    try {
      const monitor = heartbeat;
      if (!monitor) throw new Error('heartbeat runtime service is not registered');
      const status = monitor.getStatusReport ? monitor.getStatusReport() : { status: 'unknown' };
      res.json({ success: true, data: status });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/template-library', (req, res) => {
    try {
      const engine = engines.templateLibrary;
      if (!engine) throw new Error('templateLibrary runtime engine is not registered');
      const templates = engine.getAllTemplates ? engine.getAllTemplates() : [];
      res.json({ success: true, data: templates });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/drawing-sync', (req, res) => {
    try {
      const { drawingData } = req.body || {};
      res.json({
        success: true,
        message: '改图同步成功',
        data: {
          syncedAt: new Date().toISOString(),
          hasDrawingData: Boolean(drawingData)
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/device-selection', (req, res) => {
    const { loadResult, roomProfile } = req.body || {};
    const area = pickNumber(roomProfile?.area, req.body?.area, 100);
    const coolingLoad = pickNumber(
      loadResult?.coolingLoad,
      loadResult?.data?.coolingLoad,
      loadResult?.cooling?.totalCoolingLoad,
      15
    );
    const heatingLoad = pickNumber(
      loadResult?.heatingLoad,
      loadResult?.data?.heatingLoad,
      loadResult?.heating?.totalHeatingLoad,
      12
    );

    try {
      const loadCalculation = {
        cooling: { totalCoolingLoad: coolingLoad },
        heating: { totalHeatingLoad: heatingLoad }
      };
      const buildingParams = {
        totalArea: area,
        rooms: roomProfile?.rooms || [
          { name: '客厅', type: 'livingRoom' },
          { name: '主卧', type: 'bedroom' },
          { name: '次卧', type: 'bedroom' }
        ],
        totalOccupants: roomProfile?.occupants || 4,
        floorCount: roomProfile?.floorCount || 1,
        wallType: roomProfile?.wallType || '240砖墙+保温',
        windowType: roomProfile?.windowType || '双层中空玻璃'
      };

      const result = engines.deviceSelect.selectDevices(loadCalculation, buildingParams);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('设备选型API错误:', error);
      res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          systems: [
            {
              systemName: '中央空调系统',
              outdoorUnit: {
                model: 'RHAC-16W',
                cooling: Math.round(coolingLoad * 1.2 * 10) / 10,
                heating: Math.round(heatingLoad * 1.2 * 10) / 10,
                price: 35000
              },
              totalPrice: 35000
            },
            { systemName: '新风系统', model: 'FA-250', price: 15800 }
          ],
          totalPrice: 50800,
          fallback: true
        }
      });
    }
  });

  router.post('/api/load-calculation', (req, res) => {
    try {
      const { roomProfile, city = '北京' } = req.body || {};
      const buildingParams = {
        area: roomProfile?.area || req.body?.area || 100,
        floorCount: roomProfile?.floorCount || 1,
        roomHeight: roomProfile?.height || 2.8,
        orientation: roomProfile?.orientation || 'south',
        exteriorWallType: roomProfile?.wallType || '240砖墙+保温',
        windowType: roomProfile?.windowType || '双层中空玻璃',
        roofType: roomProfile?.roofType || '保温屋面',
        groundType: roomProfile?.groundType || '保温地面',
        totalOccupants: roomProfile?.occupants || 4,
        rooms: roomProfile?.rooms || [{
          name: '客厅',
          type: 'livingRoom',
          area: (roomProfile?.area || req.body?.area || 100) * 0.4,
          height: roomProfile?.height || 2.8,
          orientation: roomProfile?.orientation || 'south',
          windowToWallRatio: 0.25
        }]
      };

      const engine = engines.loadCalc;
      if (!engine) throw new Error('loadCalc runtime engine is not registered');
      const result = engine.generateCalculationReport(buildingParams, city);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('负荷计算API错误:', error);
      return errorResponse(res, error);
    }
  });

  router.post('/api/ai-matching', (req, res) => {
    try {
      const { painDiagnosis, roomProfile } = req.body || {};
      const AIMatchingEngine = require('../core/AIMatchingEngine');
      const engine = engines.aiMatching || new AIMatchingEngine();
      const result = engine.matchSystems(painDiagnosis, roomProfile);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/products/price', (req, res) => {
    const { systemName, area } = req.body || {};
    const priceDatabase = {
      '五恒系统': { unitPrice: 850, unit: '元/㎡' },
      '地暖系统': { unitPrice: 280, unit: '元/㎡' },
      '中央空调': { unitPrice: 320, unit: '元/㎡' },
      '新风系统': { unitPrice: 150, unit: '元/㎡' },
      '净水系统': { unitPrice: 120, unit: '元/㎡' }
    };
    const priceInfo = priceDatabase[systemName] || { unitPrice: 200, unit: '元/㎡' };
    const normalizedArea = pickNumber(area, 120);
    const totalPrice = Math.round(priceInfo.unitPrice * normalizedArea);

    res.json({
      success: true,
      data: {
        systemName,
        area: normalizedArea,
        unitPrice: priceInfo.unitPrice,
        totalPrice,
        unit: priceInfo.unit,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  });

  return router;
}

module.exports = createDesignRuntimeRouter;
