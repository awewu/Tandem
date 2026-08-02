const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('runtime service retirement', () => {
  test('pre-listen startup keeps monitoring without retired background services', () => {
    const { createProductionEngines } = require('../../server/modules/engineRegistry');
    const { startPreListenServices } = require('../../server/modules/runtimeServices');
    const logs = [];
    const logger = { log: (...args) => logs.push(args.join(' ')) };
    const engines = createProductionEngines({ runtimeProfile: 'safe' });

    startPreListenServices({ engines, logger });

    const output = logs.join('\n');
    expect(output).toContain('WARN monitoring system started skipped by runtime profile');
    expect(output).not.toMatch(/MQTT|Yjs|RAG|backup scheduler|drawing collaboration|self-check/i);
  });

  test('runtime startup source does not register retired services', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server/modules/runtimeServices.js'), 'utf8');

    expect(source).not.toMatch(/workflowOrchestrator|evolution|mqttBroker|yjsCollaboration|ragKnowledgeBase|dataBackup|heartbeat|selfCheckOrchestrator|drawingWebSocketServer|collaborationSync/);
    expect(fs.existsSync(path.join(ROOT, 'websocket-server.js'))).toBe(false);
  });

  test('post-listen startup accepts the production entrypoint no-argument call', () => {
    const { startPostListenServices } = require('../../server/modules/runtimeServices');
    expect(() => startPostListenServices()).not.toThrow();
  });
});
