const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createAirControlRouter(engines) {
  const router = express.Router();

  router.post('/api/coordination/calculate', (req, res) => {
    try {
      const result = engines.systemCoordination.coordinateControl(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/coordination/anti-condensation', (req, res) => {
    try {
      const { radiantSurfaceTemp, supplyAirTemp } = req.body;
      if (!radiantSurfaceTemp || !supplyAirTemp) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }

      const safetyLimits = engines.systemCoordination.calculateAntiCondensationLimits(radiantSurfaceTemp);
      const tempDiff = supplyAirTemp - radiantSurfaceTemp;
      const isSafe = tempDiff >= 3;
      res.json({
        success: true,
        isSafe,
        tempDiff,
        safetyLimits,
        message: isSafe ? '✅ 安全，无结露风险' : '⚠️ 存在结露风险，建议调整'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/coordination/realtime', (req, res) => {
    try {
      const result = engines.systemCoordination.realTimeControl(req.body);
      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/coordination/load-distribution', (req, res) => {
    try {
      const { season, indoorTemp, outdoorTemp } = req.body;
      if (!season || !indoorTemp || !outdoorTemp) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }

      const loadDistribution = engines.systemCoordination.calculateLoadDistribution(season, indoorTemp, outdoorTemp);
      res.json({
        success: true,
        data: loadDistribution
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/coordination/health', (req, res) => {
    try {
      const result = engines.systemCoordination.healthCheck();
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/reheat/calculate-power', (req, res) => {
    try {
      const { airflow, inletTemp, targetTemp, inletHumidity } = req.body;
      if (!airflow || !inletTemp || !targetTemp) {
        return res.status(400).json({ success: false, error: '缺少必要参数' });
      }

      const result = engines.reheatModule.calculateReheatPower({
        airflow,
        inletTemp,
        targetTemp,
        inletHumidity
      });
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/reheat/select-method', (req, res) => {
    try {
      const { powerRequirement, availableSources } = req.body;
      const result = engines.reheatModule.selectReheatMethod(
        powerRequirement,
        availableSources || { hotWater: true, electric: true }
      );
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/reheat/optimize', (req, res) => {
    try {
      const result = engines.reheatModule.optimizeControl(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/reheat/coordinate-with-waterheater', (req, res) => {
    try {
      const result = engines.reheatModule.coordinateWithRheemWaterHeater(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/reheat/health', (req, res) => {
    try {
      const result = engines.reheatModule.healthCheck();
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createAirControlRouter;
