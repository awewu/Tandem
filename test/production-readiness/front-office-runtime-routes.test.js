const express = require('express');
const request = require('./helpers/in-process-request');

const createFrontOfficeRuntimeRouter = require('../../server/routes/front-office-runtime.routes');

function makeApp(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

function makeHarness() {
  const db = {
    users: [{ id: 'user-1', role: 'designer', name: '设计师' }],
    templates: []
  };
  const engines = {
    quickLock: { startSession: jest.fn().mockReturnValue({ id: 'session-1' }) },
    painDiagnosis: { diagnose: jest.fn().mockReturnValue({ score: 88 }) },
    painMatching: { match: jest.fn().mockReturnValue({ systems: ['五恒系统'] }) },
    valueQuote: {
      generateValueQuote: jest.fn().mockReturnValue({ total: 100000 }),
      exportPDF: jest.fn().mockReturnValue({ url: '/exports/quote.pdf' })
    },
    layout3D: { generateLayout: jest.fn().mockReturnValue({ devices: [] }) },
    drawing: { generateDrawingSet: jest.fn().mockReturnValue({ drawings: ['plan'] }) },
    renderer3D: { render: jest.fn().mockReturnValue({ image: '/render.png' }) },
    templateEngine: {
      getCategories: jest.fn().mockReturnValue(['villa']),
      getPopularTemplates: jest.fn().mockReturnValue([{ id: 'popular-1' }]),
      loadTemplate: jest.fn().mockResolvedValue({ id: 'tpl-1' }),
      deleteTemplate: jest.fn().mockResolvedValue(true)
    },
    visuals: { generatePresentationPackage: jest.fn().mockReturnValue({ diagrams: 3 }) },
    conditionalField: {
      generateFieldStateConfig: jest.fn().mockReturnValue({ visibleFields: ['area'] }),
      aiRecognizeHiddenPainPoints: jest.fn().mockReturnValue({ tags: ['hot-water-wait'] })
    },
    aiValidation: { validateSolution: jest.fn().mockReturnValue({ valid: true }) },
    cadImporter: { parseDXF: jest.fn().mockReturnValue({ rooms: 2 }) },
    floorPlanRecognition: { recognizeFloorPlan: jest.fn().mockReturnValue({ success: true, rooms: [] }) },
    ragKnowledgeBase: {
      generateEnhancedDiagnosis: jest.fn().mockResolvedValue({ enhanced: true }),
      getStats: jest.fn().mockReturnValue({ documents: 8 })
    },
    yjsCollaboration: {
      getActiveSessions: jest.fn().mockReturnValue(['doc-1']),
      getStats: jest.fn().mockReturnValue({ sessions: 1 })
    },
    aiValidationEngineNew: {
      runValidationTest: jest.fn().mockResolvedValue({ passRate: 0.95 }),
      generateReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
      getStats: jest.fn().mockReturnValue({ tests: 3 })
    },
    feedbackCollector: {
      collectFeedback: jest.fn().mockResolvedValue({ id: 'fb-1' })
    }
  };
  const authenticateToken = jest.fn((req, res, next) => {
    req.user = { id: 'user-1', role: 'designer' };
    next();
  });
  const checkRole = jest.fn(() => (req, res, next) => next());
  const app = makeApp(createFrontOfficeRuntimeRouter({ db, engines, authenticateToken, checkRole }));
  return { app, db, engines, authenticateToken };
}

describe('front-office runtime route module', () => {
  test('preserves quick-session, design, quotation, and visual contracts', async () => {
    const { app, engines } = makeHarness();

    const session = await request(app)
      .post('/api/quick-session/start')
      .send({ customerInfo: { name: '王先生' } })
      .expect(200);
    expect(session.body.data.id).toBe('session-1');

    await request(app).post('/api/quick-session/step1').send({ roomProfile: { area: 120 } }).expect(200);
    await request(app).post('/api/quick-session/step2').send({ painPoints: { selected: ['hot'] } }).expect(200);

    const step3 = await request(app)
      .post('/api/quick-session/step3')
      .send({ roomProfile: { area: 120 }, painPoints: { selected: ['hot'] } })
      .expect(200);
    expect(step3.body.solution.systems).toContain('五恒系统');

    const quote = await request(app)
      .post('/api/quotation/generate')
      .send({ solution: {}, diagnosis: {}, roomProfile: {} })
      .expect(200);
    expect(quote.body.data.total).toBe(100000);

    const layout = await request(app)
      .post('/api/design/3d-layout')
      .send({ buildingParams: {}, deviceSelection: {} })
      .expect(200);
    expect(layout.body.data.devices).toEqual([]);

    const visuals = await request(app)
      .post('/api/visuals/principle-diagrams')
      .send({ diagnosis: {}, matchResult: {}, session: {} })
      .expect(200);
    expect(visuals.body.data.diagrams).toBe(3);
    expect(engines.valueQuote.generateValueQuote).toHaveBeenCalled();
  });

  test('keeps template static routes ahead of template id route', async () => {
    const { app, db, engines } = makeHarness();

    const created = await request(app)
      .post('/api/templates')
      .send({ name: '别墅模板', projectData: { area: 220 } })
      .expect(200);
    expect(created.body.data.id).toMatch(/^TPL-/);
    expect(db.templates).toHaveLength(1);

    const list = await request(app)
      .get('/api/templates')
      .expect(200);
    expect(list.body.data).toHaveLength(1);

    const categories = await request(app)
      .get('/api/templates/categories')
      .expect(200);
    expect(categories.body.data).toEqual(['villa']);
    expect(engines.templateEngine.loadTemplate).not.toHaveBeenCalledWith('categories');

    const popular = await request(app)
      .get('/api/templates/popular?limit=5')
      .expect(200);
    expect(popular.body.data).toEqual([{ id: 'popular-1' }]);

    const loaded = await request(app)
      .get('/api/templates/tpl-1')
      .expect(200);
    expect(loaded.body.data.id).toBe('tpl-1');
  });

  test('preserves AI, CAD, RAG, collaboration, validation, and feedback contracts', async () => {
    const { app } = makeHarness();

    const fieldState = await request(app)
      .post('/api/field-state')
      .send({ area: 120 })
      .expect(200);
    expect(fieldState.body.data.visibleFields).toContain('area');

    const hidden = await request(app)
      .post('/api/ai/detect-pain-points')
      .send({ roomProfile: {}, selectedTags: [] })
      .expect(200);
    expect(hidden.body.data.tags).toContain('hot-water-wait');

    const cad = await request(app)
      .post('/api/cad/import')
      .send({ fileType: 'dxf', fileData: Buffer.from('dxf').toString('base64') })
      .expect(200);
    expect(cad.body.data.rooms).toBe(2);

    const enhanced = await request(app)
      .post('/api/ai/enhanced-diagnosis')
      .send({ roomProfile: {}, basicDiagnosis: {} })
      .expect(200);
    expect(enhanced.body.data.enhanced).toBe(true);

    const stats = await request(app)
      .get('/api/knowledge-base/stats')
      .expect(200);
    expect(stats.body.data.documents).toBe(8);

    const sessions = await request(app)
      .get('/api/collaboration/sessions')
      .expect(200);
    expect(sessions.body.data.activeSessions).toEqual(['doc-1']);

    const validation = await request(app)
      .post('/api/ai-validation/test')
      .send({ testId: 'case-1' })
      .expect(200);
    expect(validation.body.data.passRate).toBe(0.95);

    const feedback = await request(app)
      .post('/api/feedback')
      .send({ title: '体验', content: 'ok' })
      .expect(200);
    expect(feedback.body.data.id).toBe('fb-1');
  });
});
