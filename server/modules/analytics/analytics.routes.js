const express = require('express');
const AnalyticsService = require('./analytics.service');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');

function createAnalyticsRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new AnalyticsService(options);

  router.use(authenticateV2);
  router.use(requireTenantScope);

  router.get('/overview', async (req, res, next) => {
    try {
      const data = await service.getOverview(req.scope, {
        dealerId: req.query.dealerId,
        storeId: req.query.storeId
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createAnalyticsRoutes;
