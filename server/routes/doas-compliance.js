const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createDoasComplianceRouter(engines) {
  const router = express.Router();

  router.post('/api/doas/validate', (req, res) => {
    try {
      const { design } = req.body;
      if (!design) {
        return res.status(400).json({ success: false, error: '缺少设计参数' });
      }

      const result = engines.doasCompliance.checkDOASCompliance(design);
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/doas/compliance-check', (req, res) => {
    try {
      const { design, standards } = req.body;
      if (!design) {
        return res.status(400).json({ success: false, error: '缺少设计参数' });
      }

      const result = engines.doasCompliance.checkDOASCompliance(design, { standards });
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/doas/standards', (req, res) => {
    try {
      const standards = {
        doas: engines.doasCompliance.DOAS_STANDARDS,
        ashrae: engines.doasCompliance.ASHRAE_STANDARDS,
        version: engines.doasCompliance.version
      };

      res.json({
        success: true,
        data: standards
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/doas/compare', (req, res) => {
    try {
      const comparison = engines.doasCompliance.compareModes();
      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/doas/report', (req, res) => {
    try {
      const { design } = req.body;
      if (!design) {
        return res.status(400).json({ success: false, error: '缺少设计参数' });
      }

      const compliance = engines.doasCompliance.checkDOASCompliance(design);
      const report = engines.doasCompliance.generateReport(design, compliance);
      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/doas/recommendations', (req, res) => {
    try {
      const { design } = req.body;
      if (!design) {
        return res.status(400).json({ success: false, error: '缺少设计参数' });
      }

      const compliance = engines.doasCompliance.checkDOASCompliance(design);
      res.json({
        success: true,
        score: compliance.score,
        level: compliance.level,
        issues: compliance.issues,
        recommendations: compliance.recommendations,
        nextSteps: engines.doasCompliance.generateNextSteps(compliance)
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/doas/health', (req, res) => {
    try {
      const result = engines.doasCompliance.healthCheck();
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createDoasComplianceRouter;
