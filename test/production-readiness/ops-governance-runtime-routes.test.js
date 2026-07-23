const express = require('express');
const request = require('./helpers/in-process-request');

const createOpsRuntimeRouter = require('../../server/routes/ops-runtime.routes');
const createGovernanceRuntimeRouter = require('../../server/routes/governance-runtime.routes');

function makeApp(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found', path: req.path });
  });
  return app;
}

function passthroughAuth(req, res, next) {
  req.user = { id: 'u-1', role: 'rheem_admin' };
  next();
}

function passthroughRole() {
  return (req, res, next) => next();
}

describe('ops runtime route module', () => {
  test('preserves health, monitor, collaboration, templates, backup, and AI validation contracts', async () => {
    const db = { customers: [{ id: 'c-1' }] };
    const engines = {
      monitoring: {},
      templateLibraryEngine: {
        searchTemplates: jest.fn().mockReturnValue([{ id: 'tpl-1' }]),
        createProjectFromTemplate: jest.fn().mockReturnValue({ id: 'project-1' }),
        recommendTemplates: jest.fn().mockReturnValue([{ id: 'tpl-2' }])
      },
      collaborationSync: {
        getRoomStats: jest.fn().mockReturnValue({ activeRooms: 2 })
      },
      dataBackupRestore: {
        getBackupList: jest.fn().mockResolvedValue([{ id: 'backup-1' }]),
        createBackup: jest.fn().mockResolvedValue({ id: 'backup-2' }),
        restoreBackup: jest.fn().mockResolvedValue({ success: true }),
        getStats: jest.fn().mockResolvedValue({ totalBackups: 2 })
      },
      aiAccuracyValidator: {
        validateSolution: jest.fn().mockReturnValue({ accuracy: 0.93 }),
        getValidationHistory: jest.fn().mockReturnValue([{ accuracy: '93.0%' }])
      }
    };
    const heartbeat = {
      getStatusReport: jest.fn().mockReturnValue({ status: 'ok' })
    };
    const app = makeApp(createOpsRuntimeRouter({
      db,
      engines,
      heartbeat,
      authenticateToken: passthroughAuth,
      checkRole: passthroughRole
    }));

    const health = await request(app).get('/api/health').expect(200);
    expect(health.body.status).toBe('healthy');
    expect(health.body.engines.templateLibraryEngine).toBe('active');

    const monitor = await request(app).get('/api/monitor/status').expect(200);
    expect(monitor.body.data.status).toBe('ok');

    const rooms = await request(app).get('/api/collaboration/rooms').expect(200);
    expect(rooms.body.data.activeRooms).toBe(2);

    const library = await request(app).get('/api/templates/library?query=villa').expect(200);
    expect(library.body.data).toEqual([{ id: 'tpl-1' }]);

    const project = await request(app)
      .post('/api/templates/use')
      .send({ templateId: 'tpl-1', customerInfo: { name: '王先生' } })
      .expect(200);
    expect(project.body.data.id).toBe('project-1');

    const recommended = await request(app)
      .post('/api/templates/recommend')
      .send({ roomProfile: { area: 160 } })
      .expect(200);
    expect(recommended.body.data[0].id).toBe('tpl-2');

    const backups = await request(app).get('/api/backup/list').expect(200);
    expect(backups.body.data[0].id).toBe('backup-1');

    await request(app).post('/api/backup/trigger').send({}).expect(200);
    expect(engines.dataBackupRestore.createBackup).toHaveBeenCalledWith(db, { type: 'manual' });

    await request(app).post('/api/backup/restore').send({ backupId: 'backup-1' }).expect(200);

    const stats = await request(app).get('/api/backup/stats').expect(200);
    expect(stats.body.data.totalBackups).toBe(2);

    const validation = await request(app)
      .post('/api/ai/validate-accuracy')
      .send({ solution: {}, roomProfile: {} })
      .expect(200);
    expect(validation.body.data.accuracy).toBe(0.93);

    const history = await request(app).get('/api/ai/validation-history?limit=1').expect(200);
    expect(history.body.data[0].accuracy).toBe('93.0%');
  });
});

describe('governance runtime route module', () => {
  test('runs complete workflow through compatible production engine names', async () => {
    const engines = {
      workflowOrchestrator: null,
      painDiagnosis: {
        diagnose: jest.fn().mockReturnValue({ allTags: ['hot-water-wait'] })
      },
      painMatching: {
        match: jest.fn().mockReturnValue({ systems: ['中央热水系统'], features: ['恒温供水'] })
      },
      loadCalc: {
        generateCalculationReport: jest.fn().mockReturnValue({
          cooling: { totalCoolingLoad: 12000 },
          heating: { totalHeatingLoad: 9000 }
        })
      },
      deviceSelect: {
        selectDevices: jest.fn().mockReturnValue({ systems: [{ name: 'heat-pump' }], totalPrice: 88000 })
      },
      valueQuote: {
        generateValueQuote: jest.fn().mockReturnValue({ totalPrice: 98000 })
      },
      selfCheckOrchestrator: {
        runCompleteSelfCheck: jest.fn().mockResolvedValue({ overallScore: 100 }),
        getStatus: jest.fn().mockReturnValue({ status: 'ready' }),
        setAutoFix: jest.fn(function setAutoFix(enabled) {
          this.autoFixEnabled = enabled;
        }),
        autoFixEnabled: true
      },
      evolution: {
        getEvolutionStatus: jest.fn().mockReturnValue({ currentRound: 1 }),
        runFullSelfCheck: jest.fn().mockReturnValue({ score: 100 }),
        runClosedLoopImprovement: jest.fn().mockResolvedValue({ fixes: [] }),
        runEvolution: jest.fn().mockResolvedValue({ completedRounds: [1] })
      }
    };

    const app = makeApp(createGovernanceRuntimeRouter(engines));

    const complete = await request(app)
      .post('/api/workflow/complete')
      .send({ roomProfile: { area: 120, city: '上海' }, selectedPainPoints: ['hot-water-wait'] })
      .expect(200);
    expect(complete.body.data.finalSolution.summary.totalPrice).toBe(98000);
    expect(engines.loadCalc.generateCalculationReport).toHaveBeenCalled();
    expect(engines.deviceSelect.selectDevices).toHaveBeenCalled();

    const selfCheck = await request(app).post('/api/self-check/run').send({}).expect(200);
    expect(selfCheck.body.data.overallScore).toBe(100);

    const status = await request(app).get('/api/evolution/status').expect(200);
    expect(status.body.data.currentRound).toBe(1);

    const evolution = await request(app).post('/api/evolution/start').send({}).expect(200);
    expect(evolution.body.data.completedRounds).toEqual([1]);
  });
});
