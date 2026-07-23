const express = require('express');
const request = require('./helpers/in-process-request');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const createDesignRuntimeRouter = require('../../server/routes/design-runtime.routes');
const createContentSalesRouter = require('../../server/routes/content-sales.routes');
const createEnergyCarbonRouter = require('../../server/routes/energy-carbon.routes');
const createPlatformRuntimeRouter = require('../../server/routes/platform-runtime.routes');

function makeApp(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found', path: req.path });
  });
  return app;
}

describe('runtime route modules extracted from post-404 legacy block', () => {
  test('design runtime routes keep active-page calculation, selection, price, and heartbeat contracts reachable', async () => {
    const engines = {
      templateLibrary: {
        getAllTemplates: jest.fn().mockReturnValue([{ id: 'tpl-1' }])
      },
      loadCalc: {
        generateCalculationReport: jest.fn().mockReturnValue({ coolingLoad: 9000, heatingLoad: 7000 })
      },
      deviceSelect: {
        selectDevices: jest.fn().mockReturnValue({ systems: [{ systemName: '中央空调系统' }], totalPrice: 35000 })
      }
    };
    const heartbeat = {
      getStatusReport: jest.fn().mockReturnValue({ isRunning: true, summary: { totalServices: 1 } })
    };
    const app = makeApp(createDesignRuntimeRouter(engines, { heartbeat }));

    const load = await request(app)
      .post('/api/load-calculation')
      .send({ roomProfile: { area: 120 }, city: '上海' })
      .expect(200);
    expect(load.body.data.coolingLoad).toBe(9000);
    expect(engines.loadCalc.generateCalculationReport).toHaveBeenCalledWith(expect.objectContaining({ area: 120 }), '上海');

    const selection = await request(app)
      .post('/api/device-selection')
      .send({ loadResult: { coolingLoad: 9, heatingLoad: 7 }, roomProfile: { area: 120 } })
      .expect(200);
    expect(selection.body.data.totalPrice).toBe(35000);
    expect(engines.deviceSelect.selectDevices).toHaveBeenCalled();

    const price = await request(app)
      .post('/api/products/price')
      .send({ systemName: '五恒系统', area: 160 })
      .expect(200);
    expect(price.body.data.totalPrice).toBe(136000);

    const heartbeatRes = await request(app)
      .get('/api/heartbeat')
      .expect(200);
    expect(heartbeatRes.body.data.isRunning).toBe(true);

    const templates = await request(app)
      .get('/api/template-library')
      .expect(200);
    expect(templates.body.data).toEqual([{ id: 'tpl-1' }]);
  });

  test('content and sales routes preserve workorder, diagnosis, and content contracts', async () => {
    const app = makeApp(createContentSalesRouter());

    const presentation = await request(app)
      .get('/api/content/presentation')
      .expect(200);
    expect(presentation.body.data.slides[0].title).toContain('Rhautt Comfort');

    const sales = await request(app)
      .post('/api/sales/report')
      .send({ customerType: 'villa', decorationStage: 'design' })
      .expect(200);
    expect(sales.body.data.reportId).toMatch(/^SR/);

    const diagnosis = await request(app)
      .post('/api/diagnosis/analyze')
      .send({ description: '制冷效果不好' })
      .expect(200);
    expect(diagnosis.body.data.diagnoses.length).toBeGreaterThan(0);

    const workorder = await request(app)
      .post('/api/workorders/create-from-diagnosis')
      .send({ diagnosisId: 'D001' })
      .expect(200);
    expect(workorder.body.data.workOrderId).toMatch(/^WO/);
  });

  test('energy and carbon routes preserve analysis, comparison, realtime, and catalog contracts', async () => {
    const app = makeApp(createEnergyCarbonRouter());

    const systems = await request(app)
      .get('/api/energy/systems')
      .expect(200);
    expect(systems.body.data.map(s => s.name)).toContain('五恒系统');

    const analysis = await request(app)
      .post('/api/energy/analysis')
      .send({ systemType: '五恒系统', area: 180, city: '北京' })
      .expect(200);
    expect(analysis.body.data.annualEnergy.total).toBeGreaterThan(0);
    expect(analysis.body.data.efficiency.rating).toBeTruthy();

    const comparison = await request(app)
      .post('/api/energy/compare')
      .send({ solutions: ['传统空调+地暖', '五恒系统'], area: 180, city: '北京' })
      .expect(200);
    expect(comparison.body.data.comparison).toHaveLength(2);
    expect(comparison.body.data.winners.energyEfficiency.systemType).toBeTruthy();

    const carbon = await request(app)
      .post('/api/carbon/calculate')
      .send({ systemType: '五恒系统', area: 180, city: '北京' })
      .expect(200);
    expect(carbon.body.data.carbonEmissions.annualTotal).toBeGreaterThan(0);

    const realtime = await request(app)
      .post('/api/energy/realtime')
      .send({ systemType: '五恒系统', area: 180 })
      .expect(200);
    expect(realtime.body.data.hourlyData).toHaveLength(24);
  });

  test('platform runtime routes expose system health, performance, cache, and agent APIs before 404', async () => {
    const engines = {
      performanceMonitor: {
        getPerformanceReport: jest.fn().mockReturnValue({ summary: { totalApiCalls: 1 } }),
        resetMetrics: jest.fn(),
        healthCheck: jest.fn().mockReturnValue({ status: 'ok' })
      },
      cache: {
        get: jest.fn().mockResolvedValue({ cached: true }),
        set: jest.fn().mockResolvedValue(true),
        delete: jest.fn().mockResolvedValue(true),
        clear: jest.fn().mockResolvedValue(true),
        getStats: jest.fn().mockReturnValue({ hits: 1 }),
        healthCheck: jest.fn().mockResolvedValue({ status: 'ok' })
      },
      agencyAgent: {
        executeTask: jest.fn().mockResolvedValue({ success: true, taskId: 'task-1' }),
        getAgentStatus: jest.fn().mockReturnValue([{ id: 'agent-1' }]),
        getTaskHistory: jest.fn().mockReturnValue([{ id: 'task-1' }])
      },
      customEngine: {
        healthCheck: jest.fn().mockReturnValue({ status: 'ok' })
      }
    };
    const app = makeApp(createPlatformRuntimeRouter(engines));

    const systemHealth = await request(app)
      .get('/api/system/health')
      .expect(200);
    expect(systemHealth.body.data.engines.customEngine.status).toBe('ok');

    const perf = await request(app)
      .get('/api/performance/report?timeRange=24h')
      .expect(200);
    expect(perf.body.data.summary.totalApiCalls).toBe(1);

    const cacheGet = await request(app)
      .get('/api/cache/get?key=quote&namespace=test')
      .expect(200);
    expect(cacheGet.body.hit).toBe(true);

    await request(app)
      .post('/api/cache/set')
      .send({ key: 'quote', value: { id: 1 }, namespace: 'test' })
      .expect(200);

    const agent = await request(app)
      .post('/api/agent/execute')
      .send({ task: '生成五恒方案' })
      .expect(200);
    expect(agent.body.data.taskId).toBe('task-1');
  });

  test('production error handler module does not register direct API routes after the API 404 guard', () => {
    const serverFile = path.join(__dirname, '..', '..', 'server-production.js');
    const factoryFile = path.join(__dirname, '..', '..', 'server', 'modules', 'productionAppFactory.js');
    const middlewareFile = path.join(__dirname, '..', '..', 'server', 'modules', 'productionMiddleware.js');
    const serverSource = fs.readFileSync(serverFile, 'utf8');
    const factorySource = fs.readFileSync(factoryFile, 'utf8');
    const middlewareSource = fs.readFileSync(middlewareFile, 'utf8');

    expect(`${serverSource}\n${factorySource}`).toMatch(/registerProductionErrorHandlers\(\s*app\b/);
    const guardIndex = middlewareSource.indexOf("app.use('/api/*'");
    expect(guardIndex).toBeGreaterThan(0);

    const afterGuard = middlewareSource.slice(guardIndex);
    const directRouteAfterGuard = /\bapp\.(get|post|put|patch|delete)\s*\(\s*['"`]\/api\//.exec(afterGuard);
    expect(directRouteAfterGuard).toBeNull();
  });

  test('legacy business route modules use runtime registry access instead of direct compatibility requires', () => {
    const routeFiles = [
      'server/routes/delivery.js',
      'server/routes/packagePurchase.js',
      'server/routes/dxfRoutes.js',
      'server/routes/workflows.js',
      'server/routes/journey.routes.js'
    ];
    const forbiddenRequires = [
      "require('../core/TechnicalDeliveryGenerator')",
      "require('../core/PackagePurchaseFlow')",
      "require('../services/DXFParserService')",
      "require('../core/WorkflowEngine')",
      "require('../core/CustomerJourneyStore')",
      "require('../core/CustomerJourneyStoreMongo')",
      "require('../services/JourneySimulator')"
    ];

    for (const relativePath of routeFiles) {
      const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
      for (const forbiddenRequire of forbiddenRequires) {
        expect(source).not.toContain(forbiddenRequire);
      }
    }
  });

  test('production route catalog points migrated legacy APIs at module owners, not server/api wrappers', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server/modules/productionRouteCatalog.js'), 'utf8');

    expect(source).toContain("modulePath: './legacy-api/new-features.routes'");
    expect(source).toContain("modulePath: './legacy-api/channel.routes'");
    expect(source).toContain("modulePath: './legacy-api/ppt-export.routes'");
    expect(source).toContain("modulePath: './legacy-api/v9.routes'");
    expect(source).not.toContain("modulePath: '../api/new-features'");
    expect(source).not.toContain("modulePath: '../api/channel-api'");
    expect(source).not.toContain("modulePath: '../api/ppt-export-api'");
    expect(source).not.toContain("modulePath: '../v9/v9-api'");
  });
});
