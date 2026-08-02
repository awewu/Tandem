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

function startPreListenServices({ engines, logger = console }) {
  logger.log('Starting Rhautt Nexus runtime engines...');

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

  logger.log('DB persistence engine status:', engines.database.getStatus());
}

function startPostListenServices({ logger = console } = {}) {
  logger.log('OK AI accuracy validation system ready');
}

function printStartupBanner({ port, host, httpsPort, useHttps, runtimeProfile, logger = console }) {
  logger.log('');
  logger.log('='.repeat(76));
  logger.log('Rhautt Nexus production runtime is ready');
  logger.log(`HTTP: http://${host || 'localhost'}:${port}`);
  if (useHttps) logger.log(`HTTPS: https://localhost:${httpsPort}`);
  logger.log(`Runtime profile: ${runtimeProfile || 'full'}`);
  logger.log('Core contracts: consultation, design, quote, BIM, lifecycle IoT, admin');
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
