const path = require('path');

const PHASE1_BACKEND_CLEANUP_MATRIX = [
  {
    id: 'retained-auth-account-brand-product-dam-growth',
    category: 'retained',
    routeIds: ['v2', 'admin-guard', 'cache-delete-guard', 'backup-guard', 'qa-config-guard'],
    evidence: [
      'apps/dealer-workbench/src/app/hub/page.tsx keeps brand-console/growth/product/public/comfort/accounts',
      'apps/dealer-workbench/src/components/DealerNav.tsx keeps /products, /brand, /accounts',
      'apps/dealer-workbench/src/lib/api.ts calls /api/v2/auth, /api/v2/brand, /api/v2/brand-sites, /api/v2/product-catalog',
      'apps/brand-console and apps/nexus-console proxy retained product/DAM/publish/growth calls to NestJS /api/v2'
    ],
    action: 'keep-active'
  },
  {
    id: 'phase1-unreachable-bim-delivery-support',
    category: 'unreachable-out-of-scope',
    routeIds: [
      'dxf-bim',
      'rysnova-bim-base',
      'construction',
      'smart-routing',
      'delivery',
      'rysnova-bim-runtime',
      'tech-support'
    ],
    evidence: [
      'scripts/agent-guards/active-navigation-check.js hides diagnosis/crm/bim/bim-deepen/customer/aftersales navigation',
      'active legacy pages are index/index-ready/privacy/consent and do not call these mounts',
      'route source files expose only DXF/BIM, Rysnova BIM preview/runtime, construction/delivery, or technical-support/settlement APIs'
    ],
    action: 'disable-active-mount',
    reason: 'Phase 1 trim removes inactive CRM/BIM/AI diagnosis/delivery/after-sales/customer-entry surfaces from active production mounting without deleting backend files.'
  },
  {
    id: 'legacy-compatibility-health-core-pages-governance',
    category: 'legacy-compatibility',
    routeIds: [
      'new-features',
      'marketing',
      'exports',
      'reports',
      'drawings-reports-compat',
      'core-api',
      'standards',
      'closed-loop',
      'enterprise-loop',
      'page-aliases',
      'qa',
      'governance-runtime',
      'promotions',
      'journey',
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
      'ai-assistant',
      'channel',
      'oneclick',
      'quotation',
      'quotation-v2',
      'calculation',
      'three-tier',
      'package-purchase',
      'supreme',
      'revit',
      'workflows',
      'hotwater',
      'econet'
    ],
    evidence: [
      'module files are mixed legacy surfaces or broad compatibility facades',
      'no retained active navigation evidence requires them, but their blast radius is not proven to be single-domain out-of-scope'
    ],
    action: 'keep-active-pending-evidence',
    reason: 'Keep unknown modules mounted until a narrower call graph or owner decision proves they are safe to disable.'
  }
];

const PHASE1_DISABLED_ROUTE_IDS = new Set(
  PHASE1_BACKEND_CLEANUP_MATRIX
    .filter(item => item.action === 'disable-active-mount')
    .flatMap(item => item.routeIds)
);

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
      { id: 'dxf-bim', prefix: '/api/dxf', modulePath: '../routes/dxfRoutes', label: 'OK DXF/BIM routes mounted (/api/dxf)' },
      { id: 'rysnova-bim-base', prefix: '/api/rysnova-bim', modulePath: '../routes/rysnova-bim-simple', label: 'OK Rysnova base routes mounted (/api/rysnova-bim)' },
      { id: 'marketing', prefix: '/api/marketing', modulePath: '../routes/marketing', label: 'OK marketing routes mounted (/api/marketing)' },
      { id: 'construction', prefix: '/api/construction', modulePath: '../routes/construction', label: 'OK construction routes mounted (/api/construction)' },
      { id: 'business-domain', modulePath: '../routes/business-domain', factory: 'businessDomain', label: 'OK business domain routes mounted' },
      { id: 'exports', prefix: '/api/exports', modulePath: '../routes/exports', label: 'OK export routes mounted (/api/exports)' },
      { id: 'reports', prefix: '/api/reports', modulePath: '../routes/reports', label: 'OK report routes mounted (/api/reports)' },
      { id: 'drawings-reports-compat', prefix: '/api/drawings', modulePath: '../routes/reports', label: 'OK drawing routes mounted (/api/drawings)' }
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
    id: 'engineering-delivery',
    domain: 'engineering-delivery',
    owner: 'server/modules/engineering-delivery facade candidate',
    status: 'legacy-compat',
    routes: [
      { id: 'supreme', prefix: '/api/supreme', modulePath: '../routes/supreme-api' },
      { id: 'revit', prefix: '/api/revit', modulePath: '../routes/revit-integration' },
      { id: 'workflows', prefix: '/api/workflows', modulePath: '../routes/workflows' },
      { id: 'hotwater', prefix: '/api/hotwater', modulePath: '../routes/hotwater' },
      { id: 'smart-routing', prefix: '/api/rysnova-bim', modulePath: '../routes/smart-routing' },
      { id: 'delivery', prefix: '/api/delivery', modulePath: '../routes/delivery', label: 'OK BIM, Revit, workflow, and delivery routes mounted' }
    ]
  },
  {
    id: 'ai-channel',
    domain: 'ai-channel',
    owner: 'server/routes/ai-assistant and server/modules/legacy-api/channel.routes',
    status: 'legacy-compat',
    routes: [
      { id: 'ai-assistant', prefix: '/api/ai', modulePath: '../routes/ai-assistant' },
      { id: 'channel', prefix: '/api/channel', modulePath: './legacy-api/channel.routes', label: 'OK AI assistant and channel routes mounted' },
      { id: 'v9-evolution', prefix: '/api/v9', modulePath: './legacy-api/v9.routes', optional: true, label: 'OK V9 evolution routes mounted (/api/v9)' }
    ]
  },
  {
    id: 'admin-runtime-guards',
    domain: 'admin-governance',
    owner: 'server/modules/authRuntime',
    status: 'production',
    routes: [
      { id: 'admin-guard', prefix: '/api/admin', middleware: 'adminGuard' },
      { id: 'cache-delete-guard', prefix: '/api/cache/delete', middleware: 'adminGuard' },
      { id: 'backup-guard', prefix: '/api/backup', middleware: 'adminGuard' },
      { id: 'qa-config-guard', prefix: '/api/qa/config', middleware: 'adminGuard', label: 'OK admin guard mounted' }
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
      { id: 'standards', modulePath: '../routes/standards.routes', factory: 'engines' },
      { id: 'closed-loop', modulePath: '../routes/closed-loop.routes', factory: 'engines' },
      { id: 'enterprise-loop', modulePath: '../routes/enterprise-loop.routes', factory: 'engines' }
    ]
  },
  {
    id: 'lifecycle-iot-front-office',
    domain: 'lifecycle-iot-front-office',
    owner: 'server/modules/lifecycle and front-office runtime',
    status: 'production',
    routes: [
      { id: 'rysnova-bim-runtime', modulePath: '../routes/rysnova-bim-runtime.routes', factory: 'rysnovaBimRuntime' },
      { id: 'front-office-runtime', modulePath: '../routes/front-office-runtime.routes', factory: 'frontOfficeRuntime' },
      { id: 'econet', modulePath: '../routes/econet.routes', factory: 'econet' },
      { id: 'admin-routes', prefix: '/api/admin', modulePath: '../routes/admin.routes', factory: 'adminRoutes' },
      { id: 'tech-support', modulePath: '../routes/tech-support.routes', factory: 'techSupport' },
      { id: 'ops-runtime', modulePath: '../routes/ops-runtime.routes', factory: 'opsRuntime' }
    ]
  },
  {
    id: 'pages-and-governance',
    domain: 'pages-and-governance',
    owner: 'server/routes/page-aliases and governance runtime',
    status: 'legacy-compat',
    routes: [
      { id: 'page-aliases', modulePath: '../routes/page-aliases', factory: 'pageAliases' },
      { id: 'qa', prefix: '/api/qa', modulePath: '../routes/qa.routes', factory: 'qualityAssurance' },
      { id: 'governance-runtime', modulePath: '../routes/governance-runtime.routes', factory: 'engines' },
      { id: 'promotions', prefix: '/api/promotions', modulePath: '../routes/promotion.routes', factory: 'promotion' },
      { id: 'journey', prefix: '/api/journey', modulePath: '../routes/journey.routes' }
    ]
  },
  {
    id: 'comfort-home-domain-runtime',
    domain: 'comfort-home-domain',
    owner: 'server/modules/comfort-domain facade candidate',
    status: 'production-candidate',
    routes: [
      { id: 'design-runtime', modulePath: '../routes/design-runtime.routes', factory: 'designRuntime' },
      { id: 'content-sales', modulePath: '../routes/content-sales.routes', factory: 'empty' },
      { id: 'energy-carbon', modulePath: '../routes/energy-carbon.routes', factory: 'empty' },
      { id: 'platform-runtime', modulePath: '../routes/platform-runtime.routes', factory: 'engines' },
      { id: 'field-services', modulePath: '../routes/field-services', factory: 'engines' },
      { id: 'doas-compliance', modulePath: '../routes/doas-compliance', factory: 'engines' },
      { id: 'air-control', modulePath: '../routes/air-control', factory: 'engines' },
      { id: 'ppt-export', prefix: '/api/ppt-export', modulePath: './legacy-api/ppt-export.routes', optional: true, label: 'OK PPT export routes mounted (/api/ppt-export)' }
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
    case 'rysnovaBimRuntime':
      return routeModule(context.engines, {
        authenticateToken: context.authenticateToken,
        checkRole: context.checkRole
      });
    case 'frontOfficeRuntime':
      return routeModule({
        db: context.db,
        engines: context.engines,
        authenticateToken: context.authenticateToken,
        checkRole: context.checkRole
      });
    case 'econet':
      return routeModule(context.engines, { authenticateToken: context.authenticateToken });
    case 'adminRoutes':
      return routeModule({
        db: context.db,
        engines: context.engines,
        maskSensitiveData: context.maskSensitiveData
      });
    case 'techSupport':
      return routeModule({
        db: context.db,
        maskSensitiveData: context.maskSensitiveData,
        authenticateToken: context.authenticateToken,
        checkRole: context.checkRole
      });
    case 'opsRuntime':
      return routeModule({
        db: context.db,
        engines: context.engines,
        heartbeat: context.heartbeat,
        authenticateToken: context.authenticateToken,
        checkRole: context.checkRole
      });
    case 'pageAliases':
      return routeModule(context.publicDir || path.join(__dirname, '..', '..', 'public'));
    case 'qualityAssurance':
      return routeModule(context.engines.qualityAssurance);
    case 'promotion':
      return routeModule(context.engines.promotion);
    case 'designRuntime':
      return routeModule(context.engines, { heartbeat: context.heartbeat });
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
      if (PHASE1_DISABLED_ROUTE_IDS.has(entry.id)) {
        logger.log(`SKIP ${entry.id} route disabled by Phase 1 backend cleanup matrix`);
        continue;
      }
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
    .filter(entry => !PHASE1_DISABLED_ROUTE_IDS.has(entry.id))
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
