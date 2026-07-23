const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('runtime service resilience', () => {
  test('safe runtime pre-listen services are logged as skipped instead of falsely started', () => {
    const { createProductionEngines } = require('../../server/modules/engineRegistry');
    const { startPreListenServices } = require('../../server/modules/runtimeServices');
    const logs = [];
    const logger = { log: (...args) => logs.push(args.join(' ')) };
    const engines = createProductionEngines({ runtimeProfile: 'safe' });

    startPreListenServices({ engines, db: {}, logger });

    const output = logs.join('\n');
    expect(output).toContain('WARN MQTT broker started (ports 1883/1884) skipped by runtime profile');
    expect(output).toContain('WARN Yjs collaboration server started');
    expect(output).toContain('WARN RAG knowledge base initialized skipped by runtime profile');
    expect(output).toContain('WARN backup scheduler started skipped by runtime profile');
    expect(output).toContain('WARN monitoring system started skipped by runtime profile');
    expect(output).not.toContain('OK MQTT broker started (ports 1883/1884)');
    expect(output).not.toContain('OK Yjs collaboration server started');
  });

  test('drawing WebSocket startup is awaited and can degrade without killing HTTP runtime', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server/modules/runtimeServices.js'), 'utf8');

    expect(source).toContain("process.env.DISABLE_DRAWING_WS === 'true'");
    expect(source).toMatch(/await\s+wsServer\.start\(\)/);
    expect(source).toContain('WARN drawing collaboration WebSocket startup skipped');
    expect(source).toContain('engines.runtimeServiceFactories.drawingWebSocketServer');
    expect(source).not.toContain("require('../../websocket-server')");
  });

  test('post-listen service startup uses engine registry facades instead of route-local hard requires', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server/modules/runtimeServices.js'), 'utf8');

    expect(source).toContain('engines.workflowOrchestrator.__getTarget()');
    expect(source).toContain('engines.selfCheckOrchestrator.__getTarget()');
    expect(source).toContain('engines.agentCoordinator.__getTarget()');
    expect(source).toContain('engines.runtimeServiceFactories.collaborationSync(httpServer)');
    expect(source).not.toContain("require('../core/WorkflowOrchestrator')");
    expect(source).not.toContain("require('../core/SelfCheckOrchestrator')");
    expect(source).not.toContain("require('../core/AgentCoordinator')");
    expect(source).not.toContain("require('../engines/CollaborationSyncEngine')");
  });

  test('standalone drawing WebSocket entry handles startup rejection explicitly', () => {
    const source = fs.readFileSync(path.join(ROOT, 'websocket-server.js'), 'utf8');

    expect(source).toMatch(/wsServer\.start\(\)\.catch/);
    expect(source).toMatch(/this\.wss\.once\('error',\s*onError\)/);
    expect(source).toMatch(/this\.server\.once\('error',\s*onError\)/);
  });
});
