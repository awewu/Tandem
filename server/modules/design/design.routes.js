const express = require('express');
const DesignWorkspaceService = require('./design-workspace.service');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');

function createDesignRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new DesignWorkspaceService(options);

  router.use(authenticateV2);
  router.use(requireTenantScope);

  router.post('/projects/:projectId/workspace-state', async (req, res, next) => {
    try {
      const result = await service.saveWorkspaceState(req.scope, req.params.projectId, req.body || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:projectId/workspace-state', async (req, res, next) => {
    try {
      const result = await service.getWorkspaceState(req.scope, req.params.projectId);
      if (!result) return res.status(404).json({ success: false, error: 'design workspace state not found' });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createDesignRoutes;
