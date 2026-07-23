const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');

const { createProductionDemoDb } = require('../fixtures/productionDemoDb');
const { createProductionEngines } = require('./engineRegistry');
const { createAuthRuntime, resolveJwtSecret } = require('./authRuntime');
const { maskSensitiveData } = require('./dataMasking');
const {
  registerProductionErrorHandlers,
  registerProductionMiddleware
} = require('./productionMiddleware');
const { registerProductionRoutes } = require('./productionRouteRegistrar');

function createDefaultHeartbeat(options = { interval: 30000 }) {
  const engines = createProductionEngines({ runtimeProfile: 'safe' });
  engines.heartbeatMonitor.interval = options.interval;
  return engines.heartbeatMonitor;
}

function createProductionApp(options = {}) {
  const env = options.env || process.env;
  const app = options.app || express();
  const publicDir = options.publicDir || path.join(__dirname, '..', '..', 'archive', 'legacy-ui', 'public');
  const db = options.db || createProductionDemoDb(bcrypt);
  const runtimeProfile = options.runtimeProfile || options.engineProfile || 'safe';
  const engines = options.engines || createProductionEngines({ runtimeProfile });
  const heartbeat = options.heartbeat || createDefaultHeartbeat({ interval: 30000 });
  const jwtSecret = options.jwtSecret || resolveJwtSecret(env);
  const authRuntime = options.authRuntime || createAuthRuntime({ jwtSecret });
  const logger = options.logger || console;

  registerProductionMiddleware(app, {
    engines,
    env,
    publicDir
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index-ready.html'));
  });

  registerProductionRoutes(app, {
    db,
    engines,
    heartbeat,
    jwtSecret,
    authenticateToken: authRuntime.authenticateToken,
    checkRole: authRuntime.checkRole,
    maskSensitiveData,
    publicDir,
    logger
  });

  registerProductionErrorHandlers(app, { env });

  return {
    app,
    db,
    engines,
    heartbeat,
    jwtSecret,
    authenticateToken: authRuntime.authenticateToken,
    checkRole: authRuntime.checkRole,
    publicDir,
    runtimeProfile: engines.runtimeProfile || runtimeProfile
  };
}

module.exports = {
  createProductionApp
};
