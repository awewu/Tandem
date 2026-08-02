const express = require('express');
const path = require('path');
const {
  DEPLOYMENT_MODES,
  MODULES,
  getModuleById
} = require('./product-module-registry');
const STANDALONE_MODULE_KEYS = ['rysnova'];

function resolveStandaloneModule(value) {
  const byKey = MODULES[value];
  const byNamespace = Object.values(MODULES).find(module => module.namespace === value);
  const module = byKey || byNamespace || getModuleById(value);
  if (!module || module === MODULES.sharedPlatform || !STANDALONE_MODULE_KEYS.some(key => MODULES[key].id === module.id)) {
    throw new Error(`unsupported standalone product module: ${value}`);
  }
  return module;
}

function sendModuleEntry(publicDir, module) {
  const entryFile = module.embeddedEntry.replace(/^\//, '');
  return (req, res) => {
    res.sendFile(path.join(publicDir, entryFile));
  };
}

function moduleMeta(module) {
  return {
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    moduleId: module.id,
    displayName: module.displayName,
    moduleKind: module.kind,
    moduleDeploymentMode: DEPLOYMENT_MODES.STANDALONE,
    moduleNamespace: module.namespace,
    dataNamespace: module.dataNamespace,
    apiNamespace: module.apiNamespace,
    embeddedEntry: module.embeddedEntry,
    standaloneAliases: module.standaloneAliases,
    poweredBy: module.poweredBy || 'Powered by Rhautt Comfort',
    productBoundary: module.ownershipModel || 'independent-product-domain',
    productIndependenceLevel: module.productIndependenceLevel,
    targetApp: module.targetApp,
    standaloneAppShellMode: module.standaloneAppShellMode,
    standaloneDomainStrategy: module.standaloneDomainStrategy,
    objectStoragePrefix: module.objectStoragePrefix,
    analyticsNamespace: module.analyticsNamespace,
    futureDatabaseStrategy: module.futureDatabaseStrategy,
    standalonePostgresSchema: module.standalonePostgresSchema,
    standaloneMongoDatabase: module.standaloneMongoDatabase,
    standaloneObjectStorageBucket: module.standaloneObjectStorageBucket,
    databaseIndependence: module.databaseIndependence,
    portalIntegration: module.portalIntegration,
    standaloneProductization: module.standaloneProductization,
    dataBoundary: module.dataBoundary,
    iotBoundary: 'lifecycle_handoff_only'
  };
}

function createProductModuleStandaloneApp(moduleKeyOrId, options = {}) {
  const module = resolveStandaloneModule(moduleKeyOrId);
  const app = options.app || express();
  const publicDir = options.publicDir || path.join(__dirname, '..', '..', '..', 'archive', 'legacy-ui', 'public');
  const meta = moduleMeta(module);
  const entry = sendModuleEntry(publicDir, module);

  app.use(express.json({ limit: '2mb' }));
  app.use('/images', express.static(path.join(publicDir, 'images'), { index: false }));
  app.use('/css', express.static(path.join(publicDir, 'css'), { index: false }));
  app.use('/js', express.static(path.join(publicDir, 'js'), { index: false }));
  app.use('/shared', express.static(path.join(publicDir, 'shared'), { index: false }));

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      standalone: true,
      ...meta
    });
  });

  app.get('/module-meta', (req, res) => {
    res.json({ success: true, ...meta });
  });

  app.get(`${module.apiNamespace}/health`, (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      standalone: true,
      ...meta
    });
  });

  app.get(`${module.apiNamespace}/module-meta`, (req, res) => {
    res.json({ success: true, ...meta });
  });

  app.get('/', entry);
  app.get('/index.html', entry);
  app.get(module.embeddedEntry, entry);
  for (const alias of module.standaloneAliases) {
    app.get(alias, entry);
  }

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Product module route not found',
      moduleId: module.id,
      moduleNamespace: module.namespace,
      path: req.path
    });
  });

  return {
    app,
    module,
    publicDir,
    meta,
    entryRoutes: ['/', '/index.html', module.embeddedEntry, ...module.standaloneAliases]
  };
}

module.exports = {
  createProductModuleStandaloneApp,
  moduleMeta,
  resolveStandaloneModule
};
