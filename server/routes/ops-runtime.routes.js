const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createOpsRuntimeRouter({ engines, authenticateToken, checkRole }) {
  const router = express.Router();
  const auth = authenticateToken || ((req, res, next) => next());
  const role = checkRole || (() => (req, res, next) => next());

  router.get('/api/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      engines: {
        loadCalc: 'active',
        deviceSelect: 'active',
        quotation: 'active',
        painDiagnosis: 'active',
        painMatching: 'active',
        quickLock: 'active',
        valueQuote: 'active',
        visuals: 'active',
        monitoring: engines.monitoring ? 'active' : 'inactive',
        feedback: engines.feedback ? 'active' : 'inactive',
        deployment: engines.deployment ? 'active' : 'inactive',
        aiValidation: engines.aiValidation ? 'active' : 'inactive',
        templateLibrary: engines.templateLibrary ? 'active' : 'inactive',
        templateLibraryEngine: engines.templateLibraryEngine ? 'active' : 'inactive',
        aiAccuracyValidator: engines.aiAccuracyValidator ? 'active' : 'inactive'
      },
      newFeatures: {
        econetIntegration: true,
        aiValidation: true,
        templateLibrary: true,
        aiAccuracyValidation: !!engines.aiAccuracyValidator
      }
    });
  });

  router.get('/api/templates/library', auth, (req, res) => {
    try {
      const query = req.query.query || '';
      const filters = {
        category: req.query.category,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : undefined,
        minRating: req.query.minRating ? parseFloat(req.query.minRating) : undefined,
        sortBy: req.query.sortBy || 'usageCount'
      };

      const result = engines.templateLibraryEngine.searchTemplates(query, filters);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/templates/use', auth, (req, res) => {
    try {
      const { templateId, customerInfo, customizations } = req.body || {};
      const project = engines.templateLibraryEngine.createProjectFromTemplate(templateId, customerInfo, customizations);
      res.json({ success: true, data: project });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/templates/recommend', auth, (req, res) => {
    try {
      const { roomProfile, options } = req.body || {};
      const recommendations = engines.templateLibraryEngine.recommendTemplates(roomProfile, options);
      res.json({ success: true, data: recommendations });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/ai/validate-accuracy', auth, role(['rheem_admin']), async (req, res) => {
    try {
      const { solution, roomProfile } = req.body || {};
      const validator = engines.aiAccuracyValidator;
      if (validator && typeof validator.validateSolution === 'function') {
        return res.json({ success: true, data: validator.validateSolution(solution, roomProfile) });
      }
      if (validator && typeof validator.runValidationTest === 'function') {
        return res.json({ success: true, data: await validator.runValidationTest() });
      }
      res.status(503).json({ success: false, error: 'AI精度验证器未初始化' });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/ai/validation-history', auth, role(['rheem_admin']), (req, res) => {
    try {
      const validator = engines.aiAccuracyValidator;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
      let history = [];

      if (validator && typeof validator.getValidationHistory === 'function') {
        history = validator.getValidationHistory(req.query.solutionId, limit);
      } else if (validator && typeof validator.getStats === 'function') {
        history = [validator.getStats()].filter(Boolean);
      }

      res.json({ success: true, data: Array.isArray(history) ? history.slice(0, limit) : history });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createOpsRuntimeRouter;
