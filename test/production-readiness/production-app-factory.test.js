const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('production app factory boundary', () => {
  test('server-production only starts runtime services inside startProductionServer', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server-production.js'), 'utf8');
    const startIndex = source.indexOf('async function startProductionServer');
    const preListenIndex = source.indexOf('startPreListenServices({ engines, db })', startIndex);
    const resolvedRuntimeIndex = source.indexOf('const runtimeProfile = resolveRuntimeProfile(options);', startIndex);
    const runtimeUseIndex = source.indexOf('getRuntime({ runtimeProfile })', startIndex);
    const listenPromiseIndex = source.indexOf('httpServer = await new Promise', startIndex);
    const listenErrorIndex = source.indexOf("server.once('error', onError)", startIndex);

    expect(source).toContain("require('./server/modules/productionAppFactory')");
    expect(startIndex).toBeGreaterThan(-1);
    expect(preListenIndex).toBeGreaterThan(startIndex);
    expect(resolvedRuntimeIndex).toBeGreaterThan(startIndex);
    expect(runtimeUseIndex).toBeGreaterThan(startIndex);
    expect(listenPromiseIndex).toBeGreaterThan(startIndex);
    expect(listenErrorIndex).toBeGreaterThan(listenPromiseIndex);
    expect(source).not.toContain("getRuntime({ runtimeProfile: 'full' })");
    expect(source.slice(0, startIndex)).not.toContain('startPreListenServices({ engines, db })');
    expect(source.slice(0, startIndex)).not.toContain('createProductionApp()');
  });

  test('production app composition remains route-catalog governed and root portal owned by factory', () => {
    const factorySource = fs.readFileSync(path.join(ROOT, 'server', 'modules', 'productionAppFactory.js'), 'utf8');
    const registrySource = fs.readFileSync(path.join(ROOT, 'server', 'modules', 'engineRegistry.js'), 'utf8');

    expect(factorySource).toContain('function createProductionApp');
    expect(factorySource).toContain("runtimeProfile = options.runtimeProfile || options.engineProfile || 'safe'");
    expect(registrySource).toContain('function createProductionEngines(options = {})');
    expect(registrySource).toContain("runtimeProfile === 'full'");
    expect(registrySource).toContain('createBaseProductionEngines');
    expect(factorySource).toContain('registerProductionRoutes(app');
    expect(factorySource).toContain("app.get('/',");
    expect(factorySource).toContain('index-ready.html');
    expect(factorySource).toContain('registerProductionErrorHandlers(app');
  });

  test('importing server-production does not eagerly create the production runtime', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server-production.js'), 'utf8');
    const startIndex = source.indexOf('async function startProductionServer');
    const beforeStart = source.slice(0, startIndex);

    expect(beforeStart).toContain('let runtime;');
    expect(beforeStart).toContain('function getRuntime(options = {})');
    expect(beforeStart).not.toMatch(/const\s+runtime\s*=\s*createProductionApp/);
    expect(beforeStart).not.toMatch(/const\s+\{\s*app,\s*db,\s*engines,\s*heartbeat\s*\}\s*=\s*runtime/);
  });

  test('server-production honors explicit runtime profile and loopback bind host for visual checks', () => {
    const server = require('../../server-production');
    const previousProfile = process.env.RHAUTT_RUNTIME_PROFILE;
    const previousHost = process.env.HOST;
    const previousBindHost = process.env.BIND_HOST;

    try {
      process.env.RHAUTT_RUNTIME_PROFILE = 'safe';
      process.env.HOST = '127.0.0.1';
      delete process.env.BIND_HOST;

      expect(server.resolveRuntimeProfile()).toBe('safe');
      expect(server.resolveRuntimeProfile({ runtimeProfile: 'full' })).toBe('full');
      expect(server.resolveListenHost()).toBe('127.0.0.1');
      expect(server.getRuntime({ runtimeProfile: 'safe', reset: true }).runtimeProfile).toBe('safe');
      expect(server.getRuntime({ runtimeProfile: 'full' }).runtimeProfile).toBe('full');

      delete process.env.HOST;
      process.env.BIND_HOST = 'localhost';
      expect(server.resolveListenHost()).toBe('localhost');
    } finally {
      if (previousProfile === undefined) delete process.env.RHAUTT_RUNTIME_PROFILE;
      else process.env.RHAUTT_RUNTIME_PROFILE = previousProfile;
      if (previousHost === undefined) delete process.env.HOST;
      else process.env.HOST = previousHost;
      if (previousBindHost === undefined) delete process.env.BIND_HOST;
      else process.env.BIND_HOST = previousBindHost;
    }
  });

  test('safe production engine registry keeps heavy compatibility engines lazy until first use', () => {
    const { createProductionEngines } = require('../../server/modules/engineRegistry');
    const engines = createProductionEngines({ runtimeProfile: 'safe' });

    expect(engines.__lazyRuntime.getLazyEngineNames()).toEqual(expect.arrayContaining([
      'rysnovaBimBIM',
      'bimExport',
      'freshAirPro',
      'waterSystem',
      'standardsLibrary',
      'agencyAgent',
      'econetSystem',
      'workflowOrchestrator',
      'selfCheckOrchestrator',
      'agentCoordinator'
    ]));
    expect(engines.__lazyRuntime.getLoadedEngineNames()).toEqual([]);

    expect(engines.waterSystem.healthCheck()).toEqual(expect.objectContaining({
      status: 'lazy',
      loaded: false,
      name: 'waterSystem'
    }));
    expect(engines.__lazyRuntime.getLoadedEngineNames()).toEqual([]);

    const design = engines.waterSystem.generateDesign({ area: 120, residents: 3, bathrooms: 2 });
    expect(design).toEqual(expect.objectContaining({
      systems: expect.any(Object),
      summary: expect.any(Object)
    }));
    expect(engines.__lazyRuntime.getLoadedEngineNames()).toEqual(['waterSystem']);
  });

  test('full production engine registry still defers background service implementations until service startup', () => {
    const { createProductionEngines } = require('../../server/modules/engineRegistry');
    const engines = createProductionEngines({ runtimeProfile: 'full' });

    expect(engines.__lazyRuntime.getLazyEngineNames()).toEqual(expect.arrayContaining([
      'monitoring',
      'dataBackup',
      'dataBackupRestore',
      'yjsCollaboration',
      'mqttBroker',
      'ragKnowledgeBase',
      'evolution',
      'enterpriseLoop'
    ]));
    expect(engines.__lazyRuntime.getLoadedEngineNames()).toEqual([]);

    expect(engines.ragKnowledgeBase.healthCheck()).toEqual(expect.objectContaining({
      status: 'lazy',
      loaded: false,
      name: 'ragKnowledgeBase',
      runtimeProfile: 'full'
    }));
    expect(engines.__lazyRuntime.getLoadedEngineNames()).toEqual([]);
  });
});
