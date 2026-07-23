const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createClosedLoopRouter(engines) {
  const router = express.Router();

  router.get('/api/closed-loop/templates', (req, res) => {
    try {
      const filtered = engines.closedLoop.searchTemplates(req.query);
      res.json({ success: true, total: filtered.length, data: filtered });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/closed-loop/templates/:id', (req, res) => {
    try {
      const tpl = engines.closedLoop.getTemplate(req.params.id);
      if (!tpl) return res.status(404).json({ success: false, error: '模板不存在' });
      res.json({ success: true, data: tpl });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/closed-loop/scenarios', (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 50;
      res.json({
        success: true,
        total: engines.closedLoop.scenarios.length,
        data: engines.closedLoop.scenarios.slice(0, limit)
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/closed-loop/run/:scenarioId', async (req, res) => {
    try {
      const scenario = engines.closedLoop.getScenario(req.params.scenarioId);
      if (!scenario) return res.status(404).json({ success: false, error: '场景不存在' });
      const result = await engines.closedLoop.runClosedLoop(scenario);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/closed-loop/batch', async (req, res) => {
    try {
      const count = parseInt(req.body.count, 10) || 50;
      const summary = await engines.closedLoop.runBatch(count);
      res.json({ success: true, data: summary });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/closed-loop/health', (req, res) => {
    res.json({ success: true, data: engines.closedLoop.healthCheck() });
  });

  return router;
}

module.exports = createClosedLoopRouter;
