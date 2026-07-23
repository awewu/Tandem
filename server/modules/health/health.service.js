const mongoose = require('mongoose');
const dbLayer = require('../../db');
const ObservabilityService = require('../observability/observability.service');
const { getRuntimeEngine } = require('../runtimeEngineAccess');

function createDefaultHeartbeat() {
  const heartbeat = getRuntimeEngine('heartbeatMonitor');
  heartbeat.config = {
    ...(heartbeat.config || {}),
    autoRecover: false
  };
  return heartbeat;
}

class HealthService {
  constructor(options = {}) {
    this.dbLayer = options.dbLayer || dbLayer;
    this.mongoose = options.mongoose || mongoose;
    this.heartbeat = options.heartbeat || createDefaultHeartbeat();
    this.observability = options.observability || new ObservabilityService(options.observabilityOptions || {});
    this.startedAt = options.startedAt || new Date();
    this.optionalDependencies = options.optionalDependencies || {
      redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
      objectStorage: process.env.OBJECT_STORAGE_ENDPOINT || process.env.S3_BUCKET ? 'configured' : 'not_configured',
      temporal: process.env.TEMPORAL_ADDRESS ? 'configured' : 'not_configured'
    };
  }

  getLive() {
    return {
      success: true,
      data: {
        service: 'rhautt-nexus',
        status: 'live',
        uptimeSeconds: Math.round((Date.now() - this.startedAt.getTime()) / 1000),
        timestamp: new Date().toISOString()
      }
    };
  }

  getDatabaseReadiness(env = process.env) {
    const mode = this.dbLayer.getMode();
    const connected = this.dbLayer.isConnected();
    const productionDatabaseRequired = this.dbLayer.isProductionDatabaseRequired
      ? this.dbLayer.isProductionDatabaseRequired(env)
      : env.NODE_ENV === 'production';
    const ready = productionDatabaseRequired ? mode === 'mongo' && connected : true;

    return {
      success: ready,
      data: {
        service: 'database',
        mode,
        connected,
        mongooseReadyState: this.mongoose.connection.readyState,
        productionDatabaseRequired,
        productionReady: ready,
        timestamp: new Date().toISOString()
      }
    };
  }

  getReadiness(env = process.env) {
    const database = this.getDatabaseReadiness(env);
    const required = {
      database: database.success
    };
    const ready = Object.values(required).every(Boolean);

    return {
      success: ready,
      data: {
        service: 'rhautt-nexus',
        status: ready ? 'ready' : 'not_ready',
        required,
        optionalDependencies: this.optionalDependencies,
        checks: {
          database: database.data
        },
        timestamp: new Date().toISOString()
      }
    };
  }

  getHeartbeat() {
    const report = this.heartbeat && typeof this.heartbeat.getStatusReport === 'function'
      ? this.heartbeat.getStatusReport()
      : { summary: { totalServices: 0, healthyServices: 0, totalAgents: 0, healthyAgents: 0 } };

    return {
      success: true,
      data: {
        service: 'rhautt-nexus',
        boundary: 'operational-heartbeat',
        report,
        timestamp: new Date().toISOString()
      }
    };
  }

  getObservability() {
    return this.observability.getSnapshot();
  }
}

module.exports = HealthService;
