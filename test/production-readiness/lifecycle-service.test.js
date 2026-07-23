const fs = require('fs');
const path = require('path');
const { getRouteOwner } = require('../../server/modules/routeOwnership');

const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Lifecycle NestJS cutover and Express retirement', () => {
  test('frozen Express v2 router no longer imports or mounts lifecycle routes', () => {
    const router = read('server/modules/v2.router.js');
    expect(router).not.toContain("require('./lifecycle/lifecycle.routes')");
    expect(router).not.toContain("router.use('/lifecycle'");
    expect(fs.existsSync(path.join(ROOT, 'server/modules/lifecycle/lifecycle.routes.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'server/modules/lifecycle/lifecycle.service.js'))).toBe(false);
  });

  test('route ownership and partial rollback point lifecycle to NestJS', () => {
    const middleware = read('server/modules/productionMiddleware.js');
    const legacyServer = read('server/index.js');
    expect(getRouteOwner('/api/v2/lifecycle/customer-projects')).toEqual(expect.objectContaining({
      owner: 'services/api/src/modules/lifecycle', status: 'production',
    }));
    expect(middleware).toContain("'/api/v2/lifecycle'");
    expect(legacyServer).toContain("'/api/v2/lifecycle/**'");
  });

  test('Nest lifecycle module owns PostgreSQL persistence and customer-safe projections', () => {
    const service = read('services/api/src/modules/lifecycle/lifecycle.service.ts');
    const controller = read('services/api/src/modules/lifecycle/lifecycle.controller.ts');
    const projection = read('services/api/src/modules/lifecycle/lifecycle-projection.ts');
    expect(service).not.toContain('server/modules/lifecycle');
    expect(service).toContain('withRlsTransaction');
    expect(service).toContain('eventBus.publishInTx');
    expect(controller).toContain("@Get('customer-projects/:id')");
    expect(projection).toContain('lifecycle_handoff_only');
    expect(projection).toContain('buildCustomerProjectView');
  });
});
