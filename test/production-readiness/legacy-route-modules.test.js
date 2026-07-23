const express = require('express');
const request = require('./helpers/in-process-request');

const createStandardsRouter = require('../../server/routes/standards.routes');
const createClosedLoopRouter = require('../../server/routes/closed-loop.routes');
const createEnterpriseLoopRouter = require('../../server/routes/enterprise-loop.routes');
const createEconetRouter = require('../../server/routes/econet.routes');

function makeApp(router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

describe('legacy production route modules', () => {
  test('standards routes delegate compliance checks to standards library', async () => {
    const engines = {
      standardsLibrary: {
        checkHotWaterCompliance: jest.fn().mockReturnValue({
          summary: { complianceRate: '98%', grade: 'A' }
        }),
        checkDOASCompliance: jest.fn(),
        listAllStandards: jest.fn().mockReturnValue([{ code: 'GB 55020' }])
      }
    };
    const app = makeApp(createStandardsRouter(engines));

    const compliance = await request(app)
      .post('/api/standards/hot-water-compliance')
      .send({ system: 'central-hot-water' })
      .expect(200);

    expect(compliance.body.success).toBe(true);
    expect(compliance.body.engine).toBe('ProfessionalStandardsLibrary v1.0');
    expect(engines.standardsLibrary.checkHotWaterCompliance).toHaveBeenCalledWith({ system: 'central-hot-water' });

    const list = await request(app)
      .get('/api/standards/list')
      .expect(200);

    expect(list.body.data).toEqual([{ code: 'GB 55020' }]);
  });

  test('closed-loop routes preserve template, scenario, run, batch, and health contracts', async () => {
    const engines = {
      closedLoop: {
        searchTemplates: jest.fn().mockReturnValue([{ id: 'tpl-1' }]),
        getTemplate: jest.fn().mockReturnValue(null),
        scenarios: [{ id: 'scenario-1' }, { id: 'scenario-2' }],
        getScenario: jest.fn().mockReturnValue({ id: 'scenario-1' }),
        runClosedLoop: jest.fn().mockResolvedValue({ score: 96 }),
        runBatch: jest.fn().mockResolvedValue({ count: 3 }),
        healthCheck: jest.fn().mockReturnValue({ status: 'healthy' })
      }
    };
    const app = makeApp(createClosedLoopRouter(engines));

    const list = await request(app)
      .get('/api/closed-loop/templates?stage=sales')
      .expect(200);

    expect(list.body.total).toBe(1);
    expect(engines.closedLoop.searchTemplates).toHaveBeenCalledWith(expect.objectContaining({ stage: 'sales' }));

    await request(app)
      .get('/api/closed-loop/templates/missing')
      .expect(404);

    const scenarios = await request(app)
      .get('/api/closed-loop/scenarios?limit=1')
      .expect(200);

    expect(scenarios.body.total).toBe(2);
    expect(scenarios.body.data).toHaveLength(1);

    const run = await request(app)
      .post('/api/closed-loop/run/scenario-1')
      .expect(200);

    expect(run.body.data.score).toBe(96);

    const batch = await request(app)
      .post('/api/closed-loop/batch')
      .send({ count: 3 })
      .expect(200);

    expect(batch.body.data.count).toBe(3);

    const health = await request(app)
      .get('/api/closed-loop/health')
      .expect(200);

    expect(health.body.data.status).toBe('healthy');
  });

  test('enterprise-loop routes preserve dashboard, run, batch, and health contracts', async () => {
    const engines = {
      enterpriseLoop: {
        scenarios: [{ id: 'enterprise-1' }],
        runEnterpriseLoop: jest.fn().mockResolvedValue({ completed: true }),
        runBatch: jest.fn().mockResolvedValue({ count: 5 }),
        getRoleDashboard: jest.fn().mockReturnValue({ role: 'designer' }),
        healthCheck: jest.fn().mockReturnValue({ status: 'healthy' })
      }
    };
    const app = makeApp(createEnterpriseLoopRouter(engines));

    await request(app)
      .post('/api/enterprise-loop/run/missing')
      .expect(404);

    const run = await request(app)
      .post('/api/enterprise-loop/run/enterprise-1')
      .expect(200);

    expect(run.body.data.completed).toBe(true);

    const batch = await request(app)
      .post('/api/enterprise-loop/batch')
      .send({ count: 5 })
      .expect(200);

    expect(batch.body.data.count).toBe(5);

    const dashboard = await request(app)
      .get('/api/enterprise-loop/dashboard/designer')
      .expect(200);

    expect(dashboard.body.data.role).toBe('designer');

    const health = await request(app)
      .get('/api/enterprise-loop/health')
      .expect(200);

    expect(health.body.data.status).toBe('healthy');
  });

  test('econet routes preserve IoT catalog, protected MQTT, scene, protocol, and pricing contracts', async () => {
    const device = {
      type: 'thermostat-t1',
      name: '温控面板',
      brand: 'Rhautt Comfort',
      category: 'control',
      protocols: ['mqtt', 'matter'],
      power: '5W',
      capabilities: ['temperature'],
      energyClass: 'A',
      mqttTopic: 'homes/1/thermostat'
    };
    const engines = {
      mqttBroker: {
        getDevices: jest.fn().mockReturnValue([{ id: 'dev-1' }]),
        sendControlCommand: jest.fn(),
        getStats: jest.fn().mockReturnValue({ connected: 1 })
      },
      econetSystem: {
        devices: new Map([[device.type, device]]),
        scenes: new Map([['sleep', { id: 'sleep', name: '睡眠', actions: [{ type: 'set' }] }]]),
        automations: new Map([['humidity', { id: 'humidity' }]])
      },
      econetPricing: {
        calculateEconetPremium: jest.fn().mockReturnValue({ premium: 1200 }),
        getDeviceTypes: jest.fn().mockReturnValue([{ type: 'thermostat' }]),
        getDeviceType: jest.fn().mockReturnValue({ type: 'thermostat' }),
        getPricingRules: jest.fn().mockReturnValue([{ id: 'rule-1' }])
      }
    };
    const authenticateToken = jest.fn((req, res, next) => {
      req.user = { id: 'user-1' };
      next();
    });
    const app = makeApp(createEconetRouter(engines, { authenticateToken }));

    const catalog = await request(app)
      .get('/api/econet/catalog?category=control')
      .expect(200);

    expect(catalog.body.total).toBe(1);
    expect(catalog.body.data.control[0]).toEqual(expect.objectContaining({
      type: 'thermostat-t1',
      mqttTopic: 'homes/1/thermostat'
    }));

    const devices = await request(app)
      .get('/api/econet/devices')
      .expect(200);

    expect(devices.body.data).toEqual([{ id: 'dev-1' }]);
    expect(authenticateToken).toHaveBeenCalled();

    await request(app)
      .post('/api/econet/device/dev-1/control')
      .send({ command: { power: 'on' } })
      .expect(200);

    expect(engines.mqttBroker.sendControlCommand).toHaveBeenCalledWith('dev-1', { power: 'on' });

    const protocols = await request(app)
      .get('/api/econet/protocols')
      .expect(200);

    expect(protocols.body.supportedProtocols).toEqual(expect.arrayContaining(['mqtt', 'matter']));

    const premium = await request(app)
      .post('/api/econet/premium')
      .send({ systems: ['hot-water'] })
      .expect(200);

    expect(premium.body.data.premium).toBe(1200);
    expect(engines.econetPricing.calculateEconetPremium).toHaveBeenCalledWith({ systems: ['hot-water'] });
  });
});
