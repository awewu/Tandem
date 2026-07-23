const express = require('express');
const GovernanceService = require('./governance.service');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');

function createGovernanceRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new GovernanceService(options);

  router.use(authenticateV2);
  router.use(requireTenantScope);

  router.get('/agent-progress', async (req, res, next) => {
    try {
      const data = await service.getAgentProgress(req.scope);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createGovernanceRoutes;
