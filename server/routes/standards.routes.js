const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createStandardsRouter(engines) {
  const router = express.Router();

  router.post('/api/standards/hot-water-compliance', (req, res) => {
    try {
      const result = engines.standardsLibrary.checkHotWaterCompliance(req.body || {});
      res.json({
        success: true,
        data: result,
        engine: 'ProfessionalStandardsLibrary v1.0',
        message: `热水合规检查完成 (${result.summary.complianceRate}, ${result.summary.grade}级)`
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/standards/doas-compliance', (req, res) => {
    try {
      const result = engines.standardsLibrary.checkDOASCompliance(req.body || {});
      res.json({
        success: true,
        data: result,
        engine: 'ProfessionalStandardsLibrary v1.0',
        message: `DOAS合规检查完成 (${result.summary.complianceRate}, ${result.summary.grade}级)`
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/standards/list', (req, res) => {
    try {
      res.json({ success: true, data: engines.standardsLibrary.listAllStandards() });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createStandardsRouter;
