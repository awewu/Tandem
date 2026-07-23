const express = require('express');
const AuditService = require('./audit.service');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');

function createAuditRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new AuditService(options);

  router.use(authenticateV2);
  router.use(requireTenantScope);

  router.get('/events', async (req, res, next) => {
    try {
      const result = await service.list(req.scope, req.query || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createAuditRoutes;
