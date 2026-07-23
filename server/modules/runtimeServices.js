function serviceStarted(result, service) {
  if (result && ['skipped', 'not_started'].includes(result.status)) return false;
  if (!service || typeof service.healthCheck !== 'function') return true;
  const health = service.healthCheck();
  return !['skipped', 'not_started'].includes(health?.status);
}

function logServiceStartup(logger, label, result, service) {
  if (serviceStarted(result, service)) logger.log(`OK ${label}`);
  else logger.log(`WARN ${label} skipped by runtime profile`);
}

function startPreListenServices({ engines, db, logger = console }) {
  logger.log('Starting 瑞诺瓦AI舒适家 runtime engines...');

  try {
    const result = engines.mqttBroker.start();
    logServiceStartup(logger, 'MQTT broker started (ports 1883/1884)', result, engines.mqttBroker);
  } catch (error) {
    logger.log('WARN MQTT broker startup skipped:', error.message);
  }

  try {
    const yjsPort = process.env.YJS_PORT || 5003;
    engines.yjsCollaboration.port = yjsPort;
    const result = engines.yjsCollaboration.start();
    logServiceStartup(logger, `Yjs collaboration server started (port ${yjsPort})`, result, engines.yjsCollaboration);
  } catch (error) {
    logger.log('WARN Yjs collaboration startup skipped:', error.message);
  }

  try {
    const result = engines.ragKnowledgeBase.initialize();
    logServiceStartup(logger, 'RAG knowledge base initialized', result, engines.ragKnowledgeBase);
  } catch (error) {
    logger.log('WARN RAG knowledge base startup skipped:', error.message);
  }

  try {
    const result = engines.dataBackup.startScheduledBackups(() => db);
    logServiceStartup(logger, 'backup scheduler started', result, engines.dataBackup);
  } catch (error) {
    logger.log('WARN backup scheduler startup skipped:', error.message);
  }

  try {
    const stats = engines.templateLibrary.getStats();
    logger.log(`OK template library loaded (${stats.totalTemplates} templates)`);
  } catch (error) {
    logger.log('WARN template library load skipped:', error.message);
  }

  try {
    const result = engines.monitoring.start();
    logServiceStartup(logger, 'monitoring system started', result, engines.monitoring);
  } catch (error) {
    logger.log('WARN monitoring system startup skipped:', error.message);
  }

  logger.log('OK feedback collector and deployment manager ready');
}

async function initializePostListenEngines({ engines, logger = console }) {
  logger.log('Initializing production runtime engines...');

  await engines.templateEngine.initialize();
  logger.log('OK template engine initialized');

  await engines.aiValidationEngineNew.initialize();
  logger.log('OK AI validation engine initialized');

  await engines.econetPricing.initialize();
  logger.log('OK Econet pricing engine initialized');

  await engines.econetSystem.initialize();
  logger.log(`OK Econet control system initialized (${engines.econetSystem.devices.size} device models)`);

  engines.workflowOrchestrator.__getTarget();
  logger.log('OK workflow orchestrator initialized');

  engines.selfCheckOrchestrator.__getTarget();
  logger.log('OK self-check orchestrator initialized');

  engines.agentCoordinator.__getTarget();
  engines.agentCoordinator.registerAgent('self-check-agent', {
    name: '自检Agent',
    type: 'SELF_CHECK',
    priority: 'background',
    interval: 3600000,
    onInterval: async () => {
      logger.log('Self-check agent running scheduled task...');
      const result = await engines.selfCheckOrchestrator.runCompleteSelfCheck();
      logger.log(`OK self-check complete, score: ${result.overallScore.toFixed(2)}%`);
    }
  });
  engines.agentCoordinator.startAgent('self-check-agent');
  logger.log('OK self-check agent started');

  logger.log('DB persistence engine status:', engines.database.getStatus());
  if (engines.evolution && engines.evolution.__isLazyEngine && !engines.evolution.__isLoaded()) {
    logger.log('Evolution mechanism status:', engines.evolution.healthCheck());
  } else {
    logger.log('Evolution mechanism status:', engines.evolution.getEvolutionStatus());
  }

  try {
    if (process.env.DISABLE_DRAWING_WS === 'true') {
      logger.log('WARN drawing collaboration WebSocket disabled by DISABLE_DRAWING_WS=true');
      return;
    }
    const drawingWsPort = Number(process.env.DRAWING_WS_PORT || 3002);
    const wsServer = engines.runtimeServiceFactories.drawingWebSocketServer(drawingWsPort);
    await wsServer.start();
    engines.drawingWebSocketServer = wsServer;
    logger.log(`OK drawing collaboration WebSocket started (port ${drawingWsPort})`);
  } catch (error) {
    logger.log('WARN drawing collaboration WebSocket startup skipped:', error.message);
  }
}

function startPostListenServices({ httpServer, engines, heartbeat, port, logger = console }) {
  try {
    engines.collaborationSync = engines.runtimeServiceFactories.collaborationSync(httpServer);
    logger.log('OK collaboration sync engine started');
  } catch (error) {
    logger.log('WARN collaboration sync startup skipped:', error.message);
  }

  logger.log('OK data backup restore system ready');
  logger.log('OK AI accuracy validation system ready');

  heartbeat.registerService('api-server', {
    name: 'API服务器',
    endpoint: `http://localhost:${port}`,
    type: 'http'
  });
  heartbeat.start();
}

function printStartupBanner({ port, host, httpsPort, useHttps, runtimeProfile, logger = console }) {
  logger.log('');
  logger.log('='.repeat(76));
  logger.log('瑞诺瓦AI舒适家 production runtime is ready');
  logger.log(`HTTP: http://${host || 'localhost'}:${port}`);
  if (useHttps) logger.log(`HTTPS: https://localhost:${httpsPort}`);
  logger.log(`Runtime profile: ${runtimeProfile || 'full'}`);
  logger.log('Core contracts: consultation, design, quote, BIM, lifecycle IoT, admin, heartbeat');
  logger.log('Production gates: route ownership, active-page API contracts, React candidate isolation');
  logger.log('='.repeat(76));
  logger.log('');
}

module.exports = {
  initializePostListenEngines,
  logServiceStartup,
  printStartupBanner,
  serviceStarted,
  startPostListenServices,
  startPreListenServices
};
