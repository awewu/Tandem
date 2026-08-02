const path = require('path');

const PHASE1_BACKEND_CLEANUP_MATRIX = [
  {
    id: 'retained-auth-account-brand-product-dam-growth',
    category: 'retained',
    routeIds: ['v2', 'admin-guard'],
    evidence: [
      'apps/dealer-workbench retains brand, growth, product, public-site, and account operations',
      'apps/dealer-workbench/src/components/DealerNav.tsx keeps /products, /brand, /accounts',
      'apps/dealer-workbench/src/lib/api.ts calls /api/v2/auth, /api/v2/brand, /api/v2/brand-sites, /api/v2/product-catalog',
      'apps/dealer-workbench proxies retained product/DAM/publish/growth calls to NestJS /api/v2'
    ],
    action: 'keep-active'
  },
  {
    id: 'legacy-compatibility-health-core-pages-governance',
    category: 'legacy-compatibility',
    routeIds: [
      'new-features',
      'marketing',
      'exports',
      'reports',
      'core-api',
      'standards',
      'page-aliases',
      'promotions',
      'ops-runtime'
    ],
    evidence: [
      'archive/legacy-ui/public/index.html still calls /api/health',
      'route ownership keeps legacy compatibility owners while retained product work migrates to /api/v2'
    ],
    action: 'keep-active'
  },
  {
    id: 'unknown-mixed-legacy-modules',
    category: 'unknown',
    routeIds: [
      'business-domain',
      'front-office-runtime',
      'channel',
      'oneclick',
      'quotation',
      'quotation-v2',
      'calculation',
      'three-tier',
      'package-purchase'
    ],
    evidence: [
      'module files are mixed legacy surfaces or broad compatibility facades',
      'no retained active navigation evidence requires them, but their blast radius is not proven to be single-domain out-of-scope'
    ],
    action: 'keep-active-pending-evidence',
    reason: 'Keep unknown modules mounted until a narrower call graph or owner decision proves they are safe to disable.'
  }
];

// P1 架构收敛（2026-07-06）：生产 /api/v2 默认由 productionMiddleware 的前置代理转发到
// NestJS 单一真相源(3300)。下方 v2 条目仅在 LEGACY_V2_INPROCESS=true 回退时才实际服务。
const PRODUCTION_ROUTE_CATALOG = [
  {
    id: 'legacy-foundation',
    domain: 'legacy-foundation',
    owner: 'server/routes legacy compatibility',
    status: 'legacy-compat',
    routes: [
      { id: 'new-features', prefix: '/api', modulePath: './legacy-api/new-features.routes', label: 'OK new feature routes mounted (/api)' },
      { id: 'marketing', prefix: '/api/marketing', modulePath: '../routes/marketing', label: 'OK marketing routes mounted (/api/marketing)' },
      { id: 'business-domain', modulePath: '../routes/business-domain', factory: 'businessDomain', label: 'OK business domain routes mounted' },
      { id: 'exports', prefix: '/api/exports', modulePath: '../routes/exports', label: 'OK export routes mounted (/api/exports)' },
      { id: 'reports', prefix: '/api/reports', modulePath: '../routes/reports', label: 'OK report routes mounted (/api/reports)' }
    ]
  },
  {
    id: 'quote-calculation',
    domain: 'quote-calculation',
    owner: 'server/modules/quote-calculation facade candidate',
    status: 'legacy-compat',
    routes: [
      { id: 'oneclick', prefix: '/api/oneclick', modulePath: '../routes/oneclick-api' },
      { id: 'quotation', prefix: '/api/quotation', modulePath: '../routes/customQuotation' },
      { id: 'quotation-v2', prefix: '/api/quotation-v2', modulePath: '../routes/quotation-v2' },
      { id: 'calculation', prefix: '/api/calc', modulePath: '../routes/calculation-api' },
      { id: 'three-tier', prefix: '/api/three-tier', modulePath: '../routes/threeTier' },
      { id: 'package-purchase', prefix: '/api/package', modulePath: '../routes/packagePurchase', label: 'OK calculation and quote routes mounted' }
    ]
  },
  {
    id: 'ai-channel',
    domain: 'ai-channel',
    owner: 'server/modules/legacy-api/channel.routes',
    status: 'legacy-compat',
    routes: [
      { id: 'channel', prefix: '/api/channel', modulePath: './legacy-api/channel.routes', label: 'OK channel routes mounted' }
    ]
  },
  {
    id: 'admin-runtime-guards',
    domain: 'admin-governance',
    owner: 'server/modules/authRuntime',
    status: 'production',
    routes: [
      { id: 'admin-guard', prefix: '/api/admin', middleware: 'adminGuard', label: 'OK admin guard mounted' }
    ]
  },
  {
    id: 'core-and-v2',
    domain: 'platform-core',
    owner: 'server/modules/v2 and server/routes/core-api',
    status: 'production',
    routes: [
      { id: 'core-api', modulePath: '../routes/core-api', factory: 'coreApi' },
      // /api/v2/auth, /api/v2/crm, /api/v2/quotation, /api/v2/tenants|dealers|stores → migrated-to-nestjs (services/api)
      // 候选路由 design/devices/projects 仍走 v2.router（ENABLE_REACT_CANDIDATE 控制）
      { id: 'v2', prefix: '/api/v2', modulePath: './v2.router', factory: 'v2' },
      { id: 'standards', modulePath: '../routes/standards.routes', factory: 'engines' }
    ]
  },
  {
    id: 'lifecycle-iot-front-office',
    domain: 'lifecycle-iot-front-office',
    owner: 'server front-office runtime',
    status: 'production',
    routes: [
      { id: 'front-office-runtime', modulePath: '../routes/front-office-runtime.routes', factory: 'frontOfficeRuntime' },
      { id: 'admin-routes', prefix: '/api/admin', modulePath: '../routes/admin.routes', factory: 'adminRoutes' },
      { id: 'ops-runtime', modulePath: '../routes/ops-runtime.routes', factory: 'opsRuntime' }
    ]
  },
  {
    id: 'pages-and-governance',
    domain: 'pages-and-governance',
    owner: 'server/routes/page-aliases and promotion runtime',
    status: 'legacy-compat',
    routes: [
      { id: 'page-aliases', modulePath: '../routes/page-aliases', factory: 'pageAliases' },
      { id: 'promotions', prefix: '/api/promotions', modulePath: '../routes/promotion.routes', factory: 'promotion' }
    ]
  }
];

function loadRouteHandler(entry, context) {
  if (entry.middleware) {
    const middleware = context[entry.middleware];
    if (!middleware) throw new Error(`Missing route middleware: ${entry.middleware}`);
    return middleware;
  }

  const routeModule = require(entry.modulePath);
  switch (entry.factory) {
    case undefined:
      return routeModule;
    case 'empty':
      return routeModule();
    case 'v2':
      return routeModule({ db: context.db });
    case 'businessDomain':
      return routeModule(context.db);
    case 'coreApi':
      return routeModule(context.db, context.engines, {
        JWT_SECRET: context.jwtSecret,
        authenticateToken: context.authenticateToken,
        checkRole: context.checkRole
      });
    case 'engines':
      return routeModule(context.engines);
    case 'frontOfficeRuntime':
      return routeModule({
        db: context.db,
        engines: context.engines,
        authenticateToken: context.authenticateToken,
        checkRole: context.checkRole
      });
    case 'adminRoutes':
      return routeModule({
        db: context.db,
        engines: context.engines,
        maskSensitiveData: context.maskSensitiveData
      });
    case 'opsRuntime':
      return routeModule({
        db: context.db,
        engines: context.engines,
        authenticateToken: context.authenticateToken,
        checkRole: context.checkRole
      });
    case 'pageAliases':
      return routeModule(context.publicDir || path.join(__dirname, '..', '..', 'public'));
    case 'promotion':
      return routeModule(context.engines.promotion);
    default:
      throw new Error(`Unknown route factory: ${entry.factory}`);
  }
}

function createLazyRouteHandler(entry, context) {
  let handler;
  let optionalLoadFailure;

  return function lazyProductionRouteHandler(req, res, next) {
    if (optionalLoadFailure) return next();

    try {
      if (!handler) handler = loadRouteHandler(entry, context);
      return handler(req, res, next);
    } catch (error) {
      if (entry.optional) {
        optionalLoadFailure = error;
        const logger = context.logger || console;
        logger.log(`WARN ${entry.id} routes lazy load skipped:`, error.message);
        return next();
      }
      return next(error);
    }
  };
}

function mountRouteEntry(app, entry, context) {
  const handler = entry.middleware
    ? loadRouteHandler(entry, context)
    : createLazyRouteHandler(entry, context);
  if (entry.prefix) app.use(entry.prefix, handler);
  else app.use(handler);
}

function mountProductionRouteCatalog(app, context) {
  const logger = context.logger || console;

  for (const group of PRODUCTION_ROUTE_CATALOG) {
    for (const entry of group.routes) {
      try {
        mountRouteEntry(app, entry, context);
        if (entry.label) logger.log(entry.label);
      } catch (error) {
        if (!entry.optional) throw error;
        logger.log(`WARN ${entry.id} routes mount skipped:`, error.message);
      }
    }
  }

  logger.log('OK production route catalog complete');
}

function getProductionRouteCatalogMountMetadata() {
  return PRODUCTION_ROUTE_CATALOG.flatMap(group => group.routes
    .filter(entry => entry.modulePath)
    .map(entry => ({
      id: entry.id,
      groupId: group.id,
      domain: group.domain,
      owner: group.owner,
      status: entry.status || group.status,
      prefix: entry.prefix || '/',
      modulePath: entry.modulePath,
      optional: Boolean(entry.optional)
    })));
}

module.exports = {
  PHASE1_BACKEND_CLEANUP_MATRIX,
  PRODUCTION_ROUTE_CATALOG,
  getProductionRouteCatalogMountMetadata,
  mountProductionRouteCatalog
};
