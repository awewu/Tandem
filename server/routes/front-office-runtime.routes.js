const express = require('express');
const { errorResponse } = require('../utils/sanitize-error');

function createFrontOfficeRuntimeRouter({ db, engines, authenticateToken, checkRole }) {
  const router = express.Router();
  const auth = authenticateToken || ((req, res, next) => next());
  const role = checkRole || (() => (req, res, next) => next());

  db.templates = db.templates || [];

  router.post('/api/quick-session/start', auth, role(['sales', 'store_admin']), (req, res) => {
    const { customerInfo } = req.body || {};
    const salesProfile = db.users.find(u => u.id === req.user.id);
    const session = engines.quickLock.startSession(customerInfo, salesProfile);
    res.json({ success: true, data: session });
  });

  router.post('/api/quick-session/step1', auth, (req, res) => {
    const { roomProfile } = req.body || {};
    res.json({
      success: true,
      step: 1,
      roomProfile,
      nextStep: '痛点勾选'
    });
  });

  router.post('/api/quick-session/step2', auth, (req, res) => {
    const { painPoints } = req.body || {};
    res.json({
      success: true,
      step: 2,
      painPoints,
      nextStep: 'AI匹配'
    });
  });

  router.post('/api/quick-session/step3', auth, (req, res) => {
    const { roomProfile, painPoints = {} } = req.body || {};
    try {
      const diagnosis = engines.painDiagnosis.diagnose(roomProfile, painPoints.selected || []);
      const matchResult = engines.painMatching.match(diagnosis, roomProfile);
      res.json({
        success: true,
        step: 3,
        solution: matchResult,
        nextStep: '报价'
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/quick-session/step4', auth, (req, res) => {
    const { solution, diagnosis, roomProfile } = req.body || {};
    try {
      const quote = engines.valueQuote.generateValueQuote(solution, diagnosis, roomProfile);
      res.json({
        success: true,
        step: 4,
        complete: true,
        quote
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/design/3d-layout', auth, role(['designer', 'store_admin']), (req, res) => {
    const { buildingParams, deviceSelection } = req.body || {};
    try {
      const result = engines.layout3D.generateLayout(buildingParams, deviceSelection);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/design/drawings', auth, role(['designer', 'store_admin']), (req, res) => {
    const { project, deviceSelection } = req.body || {};
    try {
      const result = engines.drawing.generateDrawingSet(project, deviceSelection.systems);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/design/3d-render', auth, role(['designer', 'store_admin']), (req, res) => {
    const { buildingParams, layout3D, mode = 'preview' } = req.body || {};
    try {
      const result = engines.renderer3D.render(mode, buildingParams, layout3D);
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/quotation/generate', auth, (req, res) => {
    const { solution, diagnosis, roomProfile } = req.body || {};
    try {
      const quote = engines.valueQuote.generateValueQuote(solution, diagnosis, roomProfile);
      res.json({ success: true, data: quote });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/quotation/export-pdf', auth, (req, res) => {
    const { quote } = req.body || {};
    try {
      const pdfData = engines.valueQuote.exportPDF(quote);
      res.json({ success: true, data: pdfData });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/templates', auth, role(['designer', 'store_admin']), (req, res) => {
    const { name, projectData } = req.body || {};
    const template = {
      id: `TPL-${Date.now()}`,
      name,
      data: projectData,
      createdBy: req.user.id,
      createdAt: new Date().toISOString()
    };
    db.templates.push(template);
    res.json({ success: true, data: template });
  });

  router.get('/api/templates', auth, (req, res) => {
    res.json({ success: true, data: db.templates });
  });

  router.get('/api/templates/categories', (req, res) => {
    const categories = engines.templateEngine.getCategories();
    res.json({ success: true, data: categories });
  });

  router.get('/api/templates/popular', (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 10;
    const templates = engines.templateEngine.getPopularTemplates(limit);
    res.json({ success: true, data: templates });
  });

  router.get('/api/templates/:id', async (req, res) => {
    try {
      const template = await engines.templateEngine.loadTemplate(req.params.id);
      res.json({ success: true, data: template });
    } catch (error) {
      res.status(404).json({ success: false, error: error.message });
    }
  });

  router.delete('/api/templates/:id', async (req, res) => {
    try {
      await engines.templateEngine.deleteTemplate(req.params.id);
      res.json({ success: true });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/visuals/principle-diagrams', auth, (req, res) => {
    const { diagnosis, matchResult, session } = req.body || {};
    try {
      const presentationPackage = engines.visuals.generatePresentationPackage(diagnosis, matchResult, session);
      res.json({ success: true, data: presentationPackage });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/field-state', (req, res) => {
    const roomProfile = req.body || {};
    try {
      const fieldState = engines.conditionalField.generateFieldStateConfig(roomProfile);
      res.json({ success: true, data: fieldState });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/ai/detect-pain-points', (req, res) => {
    const { roomProfile, selectedTags } = req.body || {};
    try {
      const aiResult = engines.conditionalField.aiRecognizeHiddenPainPoints(roomProfile, selectedTags || []);
      res.json({ success: true, data: aiResult });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/ai/validate-solution', auth, (req, res) => {
    const { solution, roomProfile } = req.body || {};
    try {
      const validation = engines.aiValidation.validateSolution(solution, roomProfile);
      res.json({ success: true, data: validation });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/cad/import', auth, role(['designer', 'store_admin']), (req, res) => {
    const { fileData, fileType } = req.body || {};
    try {
      if (fileType !== 'dxf') {
        return res.status(400).json({ success: false, error: '不支持的文件格式，目前仅支持DXF' });
      }
      const result = engines.cadImporter.parseDXF(Buffer.from(fileData || '', 'base64'));
      res.json({ success: true, data: result });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/floorplan/recognize', auth, (req, res) => {
    const { imageData } = req.body || {};
    try {
      const result = engines.floorPlanRecognition.recognizeFloorPlan(Buffer.from(imageData || '', 'base64'));
      res.json(result);
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.post('/api/ai/enhanced-diagnosis', auth, async (req, res) => {
    const { roomProfile, basicDiagnosis } = req.body || {};
    try {
      const enhanced = await engines.ragKnowledgeBase.generateEnhancedDiagnosis(roomProfile, basicDiagnosis);
      res.json({ success: true, data: enhanced });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/knowledge-base/stats', auth, (req, res) => {
    res.json({ success: true, data: engines.ragKnowledgeBase.getStats() });
  });

  router.get('/api/collaboration/sessions', auth, (req, res) => {
    res.json({
      success: true,
      data: {
        activeSessions: engines.yjsCollaboration.getActiveSessions(),
        stats: engines.yjsCollaboration.getStats()
      }
    });
  });

  router.post('/api/ai-validation/test', async (req, res) => {
    try {
      const testId = req.body.testId;
      const results = await engines.aiValidationEngineNew.runValidationTest(testId);
      res.json({ success: true, data: results });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  router.get('/api/ai-validation/test/:id/report', async (req, res) => {
    try {
      const report = await engines.aiValidationEngineNew.generateReport(req.params.id);
      res.json({ success: true, data: report });
    } catch (error) {
      res.status(404).json({ success: false, error: error.message });
    }
  });

  router.get('/api/ai-validation/stats', (req, res) => {
    const stats = engines.aiValidationEngineNew.getStats();
    res.json({ success: true, data: stats });
  });

  router.post('/api/feedback', async (req, res) => {
    try {
      const feedbackData = {
        title: req.body.title,
        content: req.body.content,
        category: req.body.category,
        satisfaction: req.body.satisfaction,
        contact: req.body.contact,
        userId: req.user?.id || 'anonymous',
        userRole: req.user?.role || 'guest',
        browser: req.headers['user-agent'],
        os: req.headers['sec-ch-ua-platform'] || 'unknown'
      };
      const feedback = await engines.feedbackCollector.collectFeedback(feedbackData);
      res.json({ success: true, data: { id: feedback.id } });
    } catch (error) {
      return errorResponse(res, error);
    }
  });

  return router;
}

module.exports = createFrontOfficeRuntimeRouter;
