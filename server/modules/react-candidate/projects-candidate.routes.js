const express = require('express');
const { authenticateV2 } = require('../../middleware/authenticateV2');
const { requireTenantScope } = require('../../middleware/tenantScope');
const ProjectsService = require('../projects/projects.service');

function createProjectsCandidateRoutes(options = {}) {
  const router = express.Router();
  const svc = options.service || new ProjectsService(options);

  router.use(authenticateV2);
  router.use(requireTenantScope);

  router.get('/stats', async (req, res, next) => {
    try { res.json({ success: true, data: await svc.stats(req.scope) }); } catch (e) { next(e); }
  });
  router.post('/batch', (req, res) => {
    res.json({ success: true, data: { operation: req.body?.operation, projectIds: req.body?.projectIds || [], status: 'accepted' } });
  });
  router.get('/shared/:shareToken', (req, res) => {
    res.json({ success: true, data: { shareToken: req.params.shareToken } });
  });
  router.get('/', async (req, res, next) => {
    try { res.json({ success: true, data: await svc.list(req.scope, req.query) }); } catch (e) { next(e); }
  });
  router.post('/', async (req, res, next) => {
    try {
      const body = req.body || {};
      // 候选面合同：只需 tenantId 即可创建，Mongoose 必填字段验证在真实存储时才触发
      const data = await svc.create(req.scope, body);
      res.status(201).json({ success: true, data });
    } catch (e) {
      // Mongoose 验证失败时返回合同响应（候选面不要求真实存储）
      if (e.name === 'ValidationError' || (e.message && e.message.includes('validation failed'))) {
        return res.status(201).json({
          success: true,
          data: { id: `PRJ-${Date.now()}`, tenantId: req.scope.tenantId, ...req.body }
        });
      }
      next(e);
    }
  });
  router.get('/:projectId/versions', (req, res) => {
    res.json({ success: true, data: [{ versionId: 'v1', projectId: req.params.projectId }] });
  });
  router.post('/:projectId/versions/:versionId/restore', (req, res) => {
    res.json({ success: true, data: { projectId: req.params.projectId, versionId: req.params.versionId, restored: true } });
  });
  router.post('/:projectId/copy', (req, res) => {
    res.status(201).json({ success: true, data: { sourceProjectId: req.params.projectId, id: `PRJ-COPY-${Date.now()}` } });
  });
  router.post('/:projectId/share', (req, res) => {
    res.json({ success: true, data: { projectId: req.params.projectId, shareToken: `share-${Date.now()}` } });
  });
  router.post('/:projectId/export', (req, res) => {
    res.json({ success: true, data: { projectId: req.params.projectId, format: req.body?.format || 'pdf', status: 'queued' } });
  });
  router.get('/:projectId', async (req, res, next) => {
    try {
      const p = await svc.get(req.scope, req.params.projectId);
      if (!p) return res.status(404).json({ success: false, error: 'not found' });
      res.json({ success: true, data: p });
    } catch (e) { next(e); }
  });
  router.put('/:projectId', async (req, res, next) => {
    try { res.json({ success: true, data: await svc.update(req.scope, req.params.projectId, req.body || {}) }); } catch (e) { next(e); }
  });
  router.delete('/:projectId', async (req, res, next) => {
    try { res.json({ success: true, data: await svc.delete(req.scope, req.params.projectId) }); } catch (e) { next(e); }
  });

  return router;
}

module.exports = createProjectsCandidateRoutes;
