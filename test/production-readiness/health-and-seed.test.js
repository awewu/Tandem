const express = require('express');
const request = require('./helpers/in-process-request');

const createHealthRoutes = require('../../server/modules/health/health.routes');
const HealthService = require('../../server/modules/health/health.service');
const ObservabilityService = require('../../server/modules/observability/observability.service');
const {
  createRequestContext,
  getRequestMetrics
} = require('../../server/middleware/requestContext');
const { createProductionApp } = require('../../server/modules/productionAppFactory');
const dbLayer = require('../../server/db');
const { assertSeedAllowed } = require('../../scripts/seed-production-demo');

jest.mock('../../server/db', () => ({
  getMode: jest.fn(),
  isConnected: jest.fn(),
  isProductionDatabaseRequired: jest.fn()
}));

function makeApp() {
  const app = express();
  app.use('/api/v2/health', createHealthRoutes());
  return app;
}

function makeObservedApp() {
  const app = express();
  app.use(createRequestContext({ serviceName: 'rhautt-nexus-test', slowMs: 100, criticalMs: 1000 }));
  app.get('/observed-ok', (req, res) => res.json({ success: true, requestId: req.requestId, traceId: req.traceId }));
  app.use('/api/v2/health', createHealthRoutes({
    service: new HealthService({
      dbLayer,
      observability: new ObservabilityService({ service: 'rhautt-nexus-test' })
    })
  }));
  return app;
}

describe('production health and seed guardrails', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.clearAllMocks();
    dbLayer.isProductionDatabaseRequired.mockImplementation((env) => env.NODE_ENV === 'production');
  });

  beforeEach(() => {
    dbLayer.isProductionDatabaseRequired.mockImplementation((env) => env.NODE_ENV === 'production');
  });

  test('db readiness is healthy in production only when MongoDB is connected', async () => {
    process.env.NODE_ENV = 'production';
    dbLayer.getMode.mockReturnValue('mongo');
    dbLayer.isConnected.mockReturnValue(true);

    const res = await request(makeApp())
      .get('/api/v2/health/db')
      .expect(200);

    expect(res.body.data.productionReady).toBe(true);
    expect(res.body.data.productionDatabaseRequired).toBe(true);
    expect(res.body.data.mode).toBe('mongo');
  });

  test('v2 liveness reports process-level live status', async () => {
    dbLayer.getMode.mockReturnValue('memory');
    dbLayer.isConnected.mockReturnValue(false);

    const res = await request(makeApp())
      .get('/api/v2/health/live')
      .expect(200);

    expect(res.body).toEqual(expect.objectContaining({ success: true }));
    expect(res.body.data).toEqual(expect.objectContaining({
      service: 'rhautt-nexus',
      status: 'live',
      uptimeSeconds: expect.any(Number)
    }));
  });

  test('v2 readiness separates required database state from optional dependencies', async () => {
    process.env.NODE_ENV = 'production';
    dbLayer.getMode.mockReturnValue('mongo');
    dbLayer.isConnected.mockReturnValue(true);

    const res = await request(makeApp())
      .get('/api/v2/health/ready')
      .expect(200);

    expect(res.body.data).toEqual(expect.objectContaining({
      service: 'rhautt-nexus',
      status: 'ready',
      required: { database: true },
      optionalDependencies: expect.objectContaining({
        redis: expect.any(String),
        objectStorage: expect.any(String),
        temporal: expect.any(String)
      })
    }));
  });

  test('v2 readiness fails when production database is not ready', async () => {
    process.env.NODE_ENV = 'production';
    dbLayer.getMode.mockReturnValue('memory');
    dbLayer.isConnected.mockReturnValue(false);

    const res = await request(makeApp())
      .get('/api/v2/health/ready')
      .expect(503);

    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('not_ready');
    expect(res.body.data.required.database).toBe(false);
  });

  test('v2 heartbeat exposes operational heartbeat report', () => {
    const service = new HealthService({
      dbLayer,
      heartbeat: {
        getStatusReport: () => ({
          summary: {
            totalServices: 2,
            healthyServices: 2,
            totalAgents: 3,
            healthyAgents: 3
          }
        })
      }
    });

    const heartbeat = service.getHeartbeat();

    expect(heartbeat).toEqual(expect.objectContaining({ success: true }));
    expect(heartbeat.data).toEqual(expect.objectContaining({
      service: 'rhautt-nexus',
      boundary: 'operational-heartbeat',
      report: expect.objectContaining({
        summary: expect.objectContaining({
          totalServices: 2,
          healthyAgents: 3
        })
      })
    }));
  });

  test('request context emits request and trace identifiers and observability snapshot exposes SLO metrics', async () => {
    dbLayer.getMode.mockReturnValue('memory');
    dbLayer.isConnected.mockReturnValue(false);
    const app = makeObservedApp();

    const observed = await request(app)
      .get('/observed-ok')
      .set('X-Request-ID', 'req-observe-1')
      .set('X-Trace-ID', 'trace-observe-1')
      .expect(200);

    expect(observed.headers['x-request-id']).toBe('req-observe-1');
    expect(observed.headers['x-trace-id']).toBe('trace-observe-1');
    expect(observed.body).toEqual(expect.objectContaining({
      requestId: 'req-observe-1',
      traceId: 'trace-observe-1'
    }));

    const metrics = getRequestMetrics({ limit: 20, recentLimit: 5 });
    expect(metrics.requests.total).toBeGreaterThanOrEqual(1);
    expect(metrics.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({
        service: 'rhautt-nexus-test',
        requestId: 'req-observe-1',
        traceId: 'trace-observe-1',
        durationMs: expect.any(Number)
      })
    ]));

    const snapshot = await request(app)
      .get('/api/v2/health/observability')
      .expect(200);

    expect(snapshot.body.data).toEqual(expect.objectContaining({
      service: 'rhautt-nexus-test',
      boundary: 'observability-baseline',
      signals: expect.objectContaining({
        logs: 'structured-http-events',
        traces: 'request-id-and-trace-id',
        metrics: 'in-process-http-window'
      }),
      slo: expect.objectContaining({
        status: expect.stringMatching(/within_slo|slo_risk/),
        availability: expect.any(Number)
      }),
      metrics: expect.objectContaining({
        requests: expect.objectContaining({
          total: expect.any(Number)
        }),
        latencyMs: expect.objectContaining({
          p95: expect.any(Number)
        })
      })
    }));
  });

  test('db readiness rejects production memory fallback', async () => {
    process.env.NODE_ENV = 'production';
    dbLayer.getMode.mockReturnValue('memory');
    dbLayer.isConnected.mockReturnValue(false);

    const res = await request(makeApp())
      .get('/api/v2/health/db')
      .expect(503);

    expect(res.body.success).toBe(false);
    expect(res.body.data.productionReady).toBe(false);
  });

  test('db readiness can require MongoDB outside production for staging gates', async () => {
    process.env.NODE_ENV = 'development';
    dbLayer.isProductionDatabaseRequired.mockReturnValue(true);
    dbLayer.getMode.mockReturnValue('memory');
    dbLayer.isConnected.mockReturnValue(false);

    const res = await request(makeApp())
      .get('/api/v2/health/db')
      .expect(503);

    expect(res.body.success).toBe(false);
    expect(res.body.data.productionDatabaseRequired).toBe(true);
  });

  test('production app composition mounts legacy and v2 health probes', async () => {
    dbLayer.getMode.mockReturnValue('memory');
    dbLayer.isConnected.mockReturnValue(false);
    dbLayer.isProductionDatabaseRequired.mockReturnValue(false);

    const runtime = createProductionApp({
      runtimeProfile: 'safe',
      env: {
        NODE_ENV: 'test',
        CORS_ORIGINS: '*',
        GLOBAL_RATE_LIMIT_MAX: '10000',
        AUTH_RATE_LIMIT_MAX: '10000'
      },
      logger: { log: jest.fn(), error: jest.fn() }
    });

    const legacyHealth = await request(runtime.app)
      .get('/api/health')
      .expect(200);

    expect(legacyHealth.body).toEqual(expect.objectContaining({
      success: true,
      status: 'healthy',
      version: '1.0.0'
    }));
    expect(legacyHealth.body.engines).toEqual(expect.objectContaining({
      monitoring: expect.any(String),
      templateLibraryEngine: expect.any(String)
    }));

    const live = await request(runtime.app)
      .get('/api/v2/health/live')
      .expect(200);

    expect(live.body.data).toEqual(expect.objectContaining({
      service: 'rhautt-nexus',
      status: 'live'
    }));

    const ready = await request(runtime.app)
      .get('/api/v2/health/ready')
      .expect(200);

    expect(ready.body.data).toEqual(expect.objectContaining({
      service: 'rhautt-nexus',
      status: 'ready',
      required: { database: true }
    }));
  });

  test('production demo seed refuses to run without explicit demo mode', () => {
    expect(() => assertSeedAllowed({
      NODE_ENV: 'production',
      MONGODB_URI: 'mongodb://localhost:27017/rhautt',
      DEMO_MODE: 'false'
    })).toThrow('Refusing to seed demo users in production');
  });

  test('production demo seed requires MongoDB URI', () => {
    expect(() => assertSeedAllowed({
      NODE_ENV: 'development'
    })).toThrow('MONGODB_URI is required');
  });
});
