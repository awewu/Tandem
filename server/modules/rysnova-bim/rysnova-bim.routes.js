const express = require('express');
const RysnovaArtifactService = require('./rysnova-bim-artifact.service');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');

function createRysnovaRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new RysnovaArtifactService(options);

  router.use(authenticateV2);
  router.use(requireTenantScope);

  router.post('/artifacts', async (req, res, next) => {
    try {
      const result = await service.createArtifact(req.scope, req.body || {});
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/artifacts', async (req, res, next) => {
    try {
      const result = await service.listArtifacts(req.scope, req.query || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/artifacts/:artifactId/approval', async (req, res, next) => {
    try {
      const result = await service.approveArtifact(req.scope, req.params.artifactId, req.body || {});
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/artifacts/:artifactId/integrity', async (req, res, next) => {
    try {
      const result = await service.verifyArtifactIntegrity(req.scope, req.params.artifactId, null, { publishEvent: false });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/artifacts/:artifactId/download', async (req, res, next) => {
    try {
      const result = await service.prepareArtifactDownload(req.scope, req.params.artifactId, {
        ttlSeconds: req.query?.ttlSeconds
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/artifacts/:artifactId/download/content', async (req, res, next) => {
    try {
      const result = await service.downloadArtifactContent(req.scope, req.params.artifactId, {
        ttlSeconds: req.query?.ttlSeconds
      });
      res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
      res.setHeader('Content-Length', String(result.sizeBytes));
      res.setHeader('ETag', `"${String(result.contentHash).replace(/^sha256:/, '')}"`);
      res.setHeader('X-Content-SHA256', result.contentHash);
      res.setHeader('X-Rysnova-Artifact-Id', result.artifactId);
      res.setHeader('X-Rysnova-Artifact-Type', result.type);
      res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
      res.send(result.bytes);
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:projectId/customer-package', async (req, res, next) => {
    try {
      const result = await service.buildCustomerPackage(req.scope, req.params.projectId, { publishEvent: false });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects/:projectId/customer-signoff', async (req, res, next) => {
    try {
      const result = await service.confirmCustomerSignoff(req.scope, req.params.projectId, req.body || {});
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects/:projectId/visual-artifacts', async (req, res, next) => {
    try {
      const result = await service.generateVisualArtifacts(req.scope, req.params.projectId, req.body || {});
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects/:projectId/deliverable-artifacts', async (req, res, next) => {
    try {
      const result = await service.generateDeliverableArtifacts(req.scope, req.params.projectId, req.body || {});
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/projects/:projectId/signoff-package', async (req, res, next) => {
    try {
      const result = await service.generateSignoffPackage(req.scope, req.params.projectId, req.body || {});
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get('/projects/:projectId/deepening-package', async (req, res, next) => {
    try {
      const result = await service.buildDeepeningPackage(req.scope, req.params.projectId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = createRysnovaRoutes;
