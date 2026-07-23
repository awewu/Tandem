const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createOpsRuntimeRouter({ db, engines, heartbeat, authenticateToken, checkRole }) {
  const router = express.Router();
  const auth = authenticateToken || ((req, res, next) => next());
  const role = checkRole || (() => (req, res, next) => next());

  router.get('/api/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      heartbeat: heartbeat && typeof heartbeat.getStatusReport === 'function'
        ? heartbeat.getStatusReport()
        : null,
      engines: {
        loadCalc: 'active',
        deviceSelect: 'active',
        quotation: 'active',
        layout3D: 'active',
        drawing: 'active',
        renderer3D: 'active',
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
        cadRecognizer: engines.cadRecognizer ? 'active' : 'inactive',
        cadImporter: engines.cadImporter ? 'active' : 'inactive',
        floorPlanRecognition: engines.floorPlanRecognition ? 'active' : 'inactive',
        mqttBroker: engines.mqttBroker ? 'active' : 'inactive',
        ragKnowledgeBase: engines.ragKnowledgeBase ? 'active' : 'inactive',
        collaborationSync: engines.collaborationSync ? 'active' : 'pending',
        templateLibraryEngine: engines.templateLibraryEngine ? 'active' : 'inactive',
        dataBackupRestore: engines.dataBackupRestore ? 'active' : 'inactive',
        aiAccuracyValidator: engines.aiAccuracyValidator ? 'active' : 'inactive'
      },
      newFeatures: {
        realTimeCollaboration: true,
        cadImport: true,
        floorPlanRecognition: true,
        econetIntegration: true,
        aiEnhancement: true,
        dataBackup: true,
        aiValidation: true,
        templateLibrary: true,
        collaborationSync: !!engines.collaborationSync,
        dataBackupRestore: !!engines.dataBackupRestore,
        aiAccuracyValidation: !!engines.aiAccuracyValidator
      }
    });
  });

  router.get('/api/monitor/status', auth, role(['store_admin', 'rheem_admin']), (req, res) => {
    const status = heartbeat && typeof heartbeat.getStatusReport === 'function'
      ? heartbeat.getStatusReport()
      : { status: 'unavailable' };
    res.json({ success: true, data: status });
  });

  router.get('/api/collaboration/rooms', auth, (req, res) => {
    try {
      if (!engines.collaborationSync || typeof engines.collaborationSync.getRoomStats !== 'function') {
        return res.json({ success: true, data: { rooms: [], status: 'not_initialized' } });
      }
      res.json({ success: true, data: engines.collaborationSync.getRoomStats() });
    } catch (error) {
      return errorResponse(res, error);
    }
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

  router.get('/api/backup/list', auth, role(['store_admin', 'rheem_admin']), async (req, res) => {
    try {
      const backups = await engines.dataBackupRestore.getBackupList();
      res.json({ success: true, data: backups });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/backup/trigger', auth, role(['store_admin', 'rheem_admin']), async (req, res) => {
    try {
      const data = db || { timestamp: new Date().toISOString(), type: 'manual' };
      const result = await engines.dataBackupRestore.createBackup(data, { type: 'manual' });
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/backup/restore', auth, role(['rheem_admin']), async (req, res) => {
    try {
      const { backupId } = req.body || {};
      const restoreBackup = engines.dataBackupRestore.restoreBackup.bind(engines.dataBackupRestore);
      const result = restoreBackup.length >= 2
        ? await restoreBackup(backupId, db)
        : await restoreBackup(backupId);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/backup/stats', auth, role(['store_admin', 'rheem_admin']), async (req, res) => {
    try {
      const stats = await engines.dataBackupRestore.getStats();
      res.json({ success: true, data: stats });
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
