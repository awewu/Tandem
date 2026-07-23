const express = require('express');
const HealthService = require('./health.service');

function createHealthRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new HealthService(options);

  router.get('/live', (req, res) => {
    const result = service.getLive();
    res.json(result);
  });

  router.get('/ready', (req, res) => {
    const result = service.getReadiness(process.env);
    res.status(result.success ? 200 : 503).json(result);
  });

  router.get('/heartbeat', (req, res) => {
    const result = service.getHeartbeat();
    res.json(result);
  });

  router.get('/observability', (req, res) => {
    const result = service.getObservability();
    res.json(result);
  });

  router.get('/db', (req, res) => {
    const result = service.getDatabaseReadiness(process.env);
    res.status(result.success ? 200 : 503).json(result);
  });

  return router;
}

module.exports = createHealthRoutes;
