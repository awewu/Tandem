const fs = require('fs');
const path = require('path');
const { ROUTE_OWNERSHIP, ROUTE_FILE_OWNERSHIP, getRouteOwner, getRouteOwnerForRoute } = require('../../server/modules/routeOwnership');
const {
  PHASE1_BACKEND_CLEANUP_MATRIX,
  getProductionRouteCatalogMountMetadata
} = require('../../server/modules/productionRouteCatalog');

const ROOT = path.join(__dirname, '../..');

describe('route ownership registry', () => {
  test('assigns production owners for v2 modules', () => {
    expect(getRouteOwner('/api/v2/auth/login')).toEqual(expect.objectContaining({
      owner: 'services/api/src/modules/auth',
      status: 'production'
    }));
    for (const prefix of ['/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores']) {
      expect(getRouteOwner(`${prefix}/example-id`)).toEqual(expect.objectContaining({
        prefix,
        owner: 'services/api/src/modules/tenant',
        status: 'production'
      }));
    }
    expect(getRouteOwner('/api/v2/crm/customers')).toEqual(expect.objectContaining({
      owner: 'services/api/src/modules/crm',
      status: 'production'
    }));
    expect(getRouteOwner('/api/v2/quotation')).toEqual(expect.objectContaining({
      owner: 'services/api/src/modules/quote',
      status: 'production'
    }));
    expect(getRouteOwner('/api/v2/lifecycle/handover')).toEqual({
      owner: 'unassigned',
      prefix: null,
      status: 'needs-owner'
    });
    expect(getRouteOwner('/api/v2/analytics/overview')).toEqual(expect.objectContaining({
      owner: 'server/modules/analytics',
      status: 'production'
    }));
  });

  test('assigns production owners for retained brand, product, DAM, growth, and account APIs', () => {
    const retainedRoutes = [
      ['/api/v2/auth/admin/users', 'services/api/src/modules/auth'],
      ['/api/v2/entitlement/me', 'services/api/src/modules/entitlement'],
      ['/api/v2/brand', 'services/api/src/modules/brand, services/api/src/modules/product-catalog, and services/api/src/modules/brand-product-category public brand surface'],
      ['/api/v2/brand/everhot/products', 'services/api/src/modules/brand, services/api/src/modules/product-catalog, and services/api/src/modules/brand-product-category public brand surface'],
      ['/api/v2/brands/everhot', 'services/api/src/modules/brand-registry'],
      ['/api/v2/brand-sites/site-1/logo', 'services/api/src/modules/brand-registry'],
      ['/api/v2/product-catalog/devices', 'services/api/src/modules/product-catalog'],
      ['/api/v2/product-catalog/content/publish-due', 'services/api/src/modules/product-catalog'],
      ['/api/v2/file-artifact/upload-base64', 'services/api/src/modules/file-artifact'],
      ['/api/v2/growth/geo/probe', 'services/api/src/modules/growth']
    ];

    for (const [routePath, owner] of retainedRoutes) {
      expect(getRouteOwner(routePath)).toEqual(expect.objectContaining({
        owner,
        status: 'production'
      }));
    }
  });

  test('keeps retained NestJS prefixes in the partial legacy rollback proxy allowlist', () => {
    const productionMiddleware = fs.readFileSync(path.join(ROOT, 'server/modules/productionMiddleware.js'), 'utf8');
    const retainedPrefixes = [
      '/api/v2/auth',
      '/api/v2/entitlement',
      '/api/v2/brand',
      '/api/v2/brands',
      '/api/v2/brand-sites',
      '/api/v2/product-catalog',
      '/api/v2/file-artifact',
      '/api/v2/growth'
    ];

    expect(productionMiddleware).toContain("if (!LEGACY_V2_INPROCESS) return path.startsWith('/api/v2/')");
    for (const prefix of retainedPrefixes) {
      expect(productionMiddleware).toContain(`'${prefix}'`);
    }
  });

  test('keeps unknown legacy modules under review after retired routes are deleted', () => {
    const unknown = PHASE1_BACKEND_CLEANUP_MATRIX.find(item => item.category === 'unknown');
    const activeRouteIds = new Set(getProductionRouteCatalogMountMetadata().map(entry => entry.id));

    for (const routeId of [
      'dxf-bim',
      'rysnova-bim-base',
      'construction',
      'smart-routing',
      'delivery',
      'rysnova-bim-runtime',
      'tech-support'
    ]) {
      expect(activeRouteIds.has(routeId)).toBe(false);
    }

    expect(unknown).toEqual(expect.objectContaining({
      action: 'keep-active-pending-evidence'
    }));
    expect(unknown.routeIds).toEqual(expect.arrayContaining([
      'business-domain',
      'front-office-runtime'
    ]));
    expect(activeRouteIds.has('business-domain')).toBe(true);
    expect(activeRouteIds.has('front-office-runtime')).toBe(true);
    expect(activeRouteIds.has('ai-assistant')).toBe(false);
  });

  test('assigns legacy owners for major pre-v2 API domains', () => {
    const legacyPaths = [
      '/api/promotions/match'
    ];

    for (const routePath of legacyPaths) {
      expect(getRouteOwner(routePath)).toEqual(expect.objectContaining({
        status: 'legacy-compat'
      }));
    }
  });

  test('keeps route ownership registry sorted by specific prefix lookup', () => {
    expect(getRouteOwner('/api/v2/system-packs/compose')).toEqual(expect.objectContaining({
      prefix: '/api/v2/system-packs',
      owner: 'server/modules/system-packs'
    }));
    expect(ROUTE_OWNERSHIP.length).toBeGreaterThan(60);
  });

  test('infers owner from route module file when local router path has no prefix', () => {
    expect(getRouteOwnerForRoute({
      file: 'server/modules/analytics/analytics.routes.js',
      path: '/overview'
    })).toEqual(expect.objectContaining({
      owner: 'server/modules/analytics',
      status: 'production',
      inferredFromFile: true
    }));
    expect(getRouteOwnerForRoute({
      file: 'server/routes/workorders.js',
      path: '/'
    })).toEqual(expect.objectContaining({
      owner: 'server/routes/workorders',
      status: 'legacy-compat',
      inferredFromFile: true
    }));
    expect(ROUTE_FILE_OWNERSHIP.length).toBeGreaterThanOrEqual(33);
  });
});
