const express = require('express');
const SystemPacksService = require('./system-packs.service');

function createSystemPacksRoutes(options = {}) {
  const router = express.Router();
  const service = options.service || new SystemPacksService(options);

  router.get('/', (req, res) => {
    res.json({
      success: true,
      data: service.list(req.query)
    });
  });

  router.get('/:packId', (req, res) => {
    const pack = service.getPack(req.params.packId);
    if (!pack) return res.status(404).json({ success: false, error: '系统包不存在' });
    res.json({ success: true, data: pack });
  });

  router.post('/compose', (req, res) => {
    res.json({
      success: true,
      data: service.compose(req.body || {})
    });
  });

  router.post('/recommend', (req, res) => {
    res.json({
      success: true,
      data: service.recommend(req.body || {})
    });
  });

  return router;
}

module.exports = createSystemPacksRoutes;
