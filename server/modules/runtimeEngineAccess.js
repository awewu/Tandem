const { createProductionEngines } = require('./engineRegistry');

let sharedSafeEngines;

function getSharedSafeEngines() {
  if (!sharedSafeEngines) sharedSafeEngines = createProductionEngines({ runtimeProfile: 'safe' });
  return sharedSafeEngines;
}

function resolveRuntimeEngines(options = {}) {
  return options.engines || getSharedSafeEngines();
}

function getRuntimeEngine(name, options = {}) {
  const engines = resolveRuntimeEngines(options);
  const engine = engines[name];
  if (!engine) throw new Error(`Runtime engine is not registered: ${name}`);
  return engine;
}

module.exports = {
  getRuntimeEngine,
  getSharedSafeEngines,
  resolveRuntimeEngines
};
