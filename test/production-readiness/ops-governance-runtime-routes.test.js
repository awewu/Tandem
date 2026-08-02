const express = require('express');
const request = require('./helpers/in-process-request');

const createOpsRuntimeRouter = require('../../server/routes/ops-runtime.routes');

function passthroughAuth(req, res, next) {
  req.user = { id: 'u-1', role: 'rheem_admin' };
  next();
}

describe('ops runtime route module', () => {
  test('preserves health, templates, and AI validation contracts', async () => {
    const engines = {
      monitoring: {},
      templateLibraryEngine: {
        searchTemplates: jest.fn().mockReturnValue([{ id: 'tpl-1' }]),
        createProjectFromTemplate: jest.fn().mockReturnValue({ id: 'project-1' }),
        recommendTemplates: jest.fn().mockReturnValue([{ id: 'tpl-2' }])
      },
      aiAccuracyValidator: {
        validateSolution: jest.fn().mockReturnValue({ accuracy: 0.93 }),
        getValidationHistory: jest.fn().mockReturnValue([{ accuracy: '93.0%' }])
      }
    };
    const app = express();
    app.use(express.json());
    app.use(createOpsRuntimeRouter({
      engines,
      authenticateToken: passthroughAuth,
      checkRole: () => (req, res, next) => next()
    }));

    const health = await request(app).get('/api/health').expect(200);
    expect(health.body.status).toBe('healthy');

    const library = await request(app).get('/api/templates/library?query=villa').expect(200);
    expect(library.body.data).toEqual([{ id: 'tpl-1' }]);

    const project = await request(app)
      .post('/api/templates/use')
      .send({ templateId: 'tpl-1', customerInfo: { name: 'Wang' } })
      .expect(200);
    expect(project.body.data.id).toBe('project-1');

    const recommended = await request(app)
      .post('/api/templates/recommend')
      .send({ roomProfile: { area: 160 } })
      .expect(200);
    expect(recommended.body.data[0].id).toBe('tpl-2');

    const validation = await request(app)
      .post('/api/ai/validate-accuracy')
      .send({ solution: {}, roomProfile: {} })
      .expect(200);
    expect(validation.body.data.accuracy).toBe(0.93);

    const history = await request(app).get('/api/ai/validation-history?limit=1').expect(200);
    expect(history.body.data[0].accuracy).toBe('93.0%');
  });
});
