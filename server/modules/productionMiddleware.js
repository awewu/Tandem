const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { createRequestContext } = require('../middleware/requestContext');
const { createProductionStaticSurfaceGuard } = require('../middleware/productionStaticSurfaceGuard');

// 已完全迁移到 NestJS 的域（PostgreSQL 实体完整，路由全覆盖）
const NESTJS_TARGET = process.env.NESTJS_URL || 'http://localhost:5500';
const NESTJS_MIGRATED_PREFIXES = [
  '/api/v2/auth',
  '/api/v2/tenants',
  '/api/v2/dealers',
  '/api/v2/stores',
  '/api/v2/crm',
  '/api/v2/diagnosis',
  '/api/v2/quotation',
  '/api/v2/entitlement',
  // Retained brand, catalog, file, and growth APIs remain on NestJS.
  '/api/v2/brand',
  '/api/v2/brands',
  '/api/v2/brand-sites',
  '/api/v2/product-catalog',
  '/api/v2/file-artifact',
  '/api/v2/growth',
];

// P1 架构收敛（2026-07-06）：默认把【全部】 /api/v2/** 反向代理到 NestJS 单一真相源。
// 该代理挂载在 bodyParser 之前，body stream 原样转发，POST 安全。
// 需临时回退（未迁移域走本地 Express）时设 LEGACY_V2_INPROCESS=true，仅代理上表已迁移前缀。
const LEGACY_V2_INPROCESS = process.env.LEGACY_V2_INPROCESS === 'true';

function isNestJSMigrated(path) {
  if (!LEGACY_V2_INPROCESS) return path.startsWith('/api/v2/') || path === '/api/v2';
  return NESTJS_MIGRATED_PREFIXES.some(p => path.startsWith(p));
}

function loadProxyFactory() {
  try {
    const proxyModule = require('http-proxy-middleware');
    return proxyModule.createProxyMiddleware || proxyModule.default?.createProxyMiddleware || proxyModule.default;
  } catch (error) {
    return null;
  }
}

function createNestJsProxyMiddleware({ target = NESTJS_TARGET, logger = console } = {}) {
  const createProxyMiddleware = loadProxyFactory();
  if (typeof createProxyMiddleware !== 'function') {
    return (req, res, next) => {
      if (!isNestJSMigrated(req.path)) return next();
      res.status(503).json({
        success: false,
        error: 'NestJS target proxy is unavailable in this runtime',
        path: req.path,
        targetConfigured: Boolean(target)
      });
    };
  }

  try {
    return createProxyMiddleware({
      target,
      changeOrigin: true,
      on: {
        error: (_err, _req, _res, next) => { if (typeof next === 'function') next(); }
      }
    });
  } catch (error) {
    logger.log?.('WARN NestJS proxy middleware disabled:', error.message);
    return (req, res, next) => {
      if (!isNestJSMigrated(req.path)) return next();
      res.status(503).json({
        success: false,
        error: 'NestJS target proxy failed to initialize',
        path: req.path,
        targetConfigured: Boolean(target)
      });
    };
  }
}

function shouldBypassRateLimit(req, bypassToken) {
  return Boolean(
    bypassToken &&
    req.get('X-Rhautt-Capacity-Token') === bypassToken
  );
}

function createCorsOptions({ allowedOrigins, isProd }) {
  const devLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  return {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
      if (!isProd && devLocalOrigin.test(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true
  };
}

function registerProductionMiddleware(app, options = {}) {
  const {
    engines,
    env = process.env,
    publicDir = path.join(__dirname, '..', '..', 'archive', 'legacy-ui', 'public')
  } = options;

  const allowedOrigins = (env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000')
    .split(',')
    .map(origin => origin.trim());
  const isProd = env.NODE_ENV === 'production';
  const rateLimitWindowMs = Number(env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
  const globalRateLimitMax = Number(env.GLOBAL_RATE_LIMIT_MAX || 1000);
  const authRateLimitMax = Number(env.AUTH_RATE_LIMIT_MAX || 10);
  const rateLimitBypassToken = env.RATE_LIMIT_BYPASS_TOKEN || '';

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  app.use(cors(createCorsOptions({ allowedOrigins, isProd })));

  app.use(createRequestContext({
    serviceName: 'rhautt-nexus-production',
    slowMs: Number(env.SLOW_REQUEST_MS || 1000),
    criticalMs: Number(env.CRITICAL_REQUEST_MS || 5000)
  }));

  app.use('/api', rateLimit({
    windowMs: rateLimitWindowMs,
    max: globalRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => shouldBypassRateLimit(req, rateLimitBypassToken),
    message: { success: false, error: '请求过于频繁，请稍后再试' }
  }));

  app.use(['/api/login', '/api/auth/login', '/api/v2/auth/login', '/api/register', '/api/reset-password'], rateLimit({
    windowMs: rateLimitWindowMs,
    max: authRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => shouldBypassRateLimit(req, rateLimitBypassToken),
    message: { success: false, error: '登录尝试过多，请15分钟后再试' }
  }));

  // NestJS 反向代理必须在 bodyParser 之前，否则 body stream 已被消耗。
  // The proxy package is loaded lazily so health/static compatibility routes can
  // still boot in CommonJS test runtimes when the installed proxy package is ESM.
  const nestjsProxy = createNestJsProxyMiddleware({
    target: env.NESTJS_URL || NESTJS_TARGET
  });
  app.use((req, res, next) => {
    if (isNestJSMigrated(req.path)) return nestjsProxy(req, res, next);
    next();
  });

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

  if (engines?.performanceMonitor) {
    app.use((req, res, next) => {
      const start = Date.now();

      res.on('finish', () => {
        engines.performanceMonitor.monitorAPI(
          req.path,
          Date.now() - start,
          res.statusCode
        );
      });

      next();
    });
  }

  app.use(createProductionStaticSurfaceGuard());
  app.use(express.static(publicDir, { index: false }));

  // 遗留路由 Deprecation 提示头（/api/* 但非 /api/v2/*）
  app.use(/^\/api(?!\/v2)/, (req, res, next) => {
    res.set('Deprecation', 'true');
    res.set('Link', '</api/v2>; rel="successor-version"');
    next();
  });
}

function registerProductionErrorHandlers(app, options = {}) {
  const env = options.env || process.env;

  app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found', path: req.path });
  });

  app.use((err, req, res, next) => {
    const isProd = env.NODE_ENV === 'production';
    const errId = `ERR-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    console.error(`[${errId}] ${err.stack || err.message || err}`);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).json({
      success: false,
      error: isProd ? '服务暂时不可用，请稍后再试' : (err.message || 'Internal error'),
      errorId: errId,
      ...(isProd ? {} : { stack: err.stack })
    });
  });
}

module.exports = {
  createNestJsProxyMiddleware,
  createCorsOptions,
  registerProductionErrorHandlers,
  registerProductionMiddleware,
  shouldBypassRateLimit
};
