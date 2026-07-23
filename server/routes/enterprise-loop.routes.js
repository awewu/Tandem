const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createEnterpriseLoopRouter(engines) {
  const router = express.Router();

  router.post('/api/enterprise-loop/run/:scenarioId', async (req, res) => {
    try {
      const scenario = engines.enterpriseLoop.scenarios.find(s => s.id === req.params.scenarioId);
      if (!scenario) return res.status(404).json({ success: false, error: '场景不存在' });
      const result = await engines.enterpriseLoop.runEnterpriseLoop(scenario);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/enterprise-loop/batch', async (req, res) => {
    try {
      const count = parseInt(req.body.count, 10) || 200;
      const summary = await engines.enterpriseLoop.runBatch(count);
      res.json({ success: true, data: summary });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/enterprise-loop/dashboard/:role', (req, res) => {
    try {
      res.json({ success: true, data: engines.enterpriseLoop.getRoleDashboard(req.params.role) });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/enterprise-loop/health', (req, res) => {
    res.json({ success: true, data: engines.enterpriseLoop.healthCheck() });
  });

  return router;
}

module.exports = createEnterpriseLoopRouter;
