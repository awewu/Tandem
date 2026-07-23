const fs = require('fs');
const path = require('path');
const { getRouteOwner } = require('../../server/modules/routeOwnership');

const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Diagnosis NestJS cutover and Express retirement', () => {
  test('frozen Express v2 router no longer imports or mounts diagnosis routes', () => {
    const router = read('server/modules/v2.router.js');
    expect(router).not.toContain("require('./diagnosis/diagnosis.routes')");
    expect(router).not.toContain("router.use('/diagnosis'");
    expect(fs.existsSync(path.join(ROOT, 'server/modules/diagnosis/diagnosis.routes.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'server/modules/diagnosis/diagnosis.service.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'server/modules/diagnosis/diagnosis.ai.js'))).toBe(false);
  });

  test('route ownership points directly to the NestJS diagnosis module', () => {
    expect(getRouteOwner('/api/v2/diagnosis/public/complete')).toEqual(expect.objectContaining({
      owner: 'services/api/src/modules/diagnosis',
      status: 'production',
    }));
  });

  test('partial legacy rollback still proxies diagnosis to NestJS and cannot restore the legacy CRM service dependency', () => {
    const middleware = read('server/modules/productionMiddleware.js');
    const legacyServer = read('server/index.js');
    expect(middleware).toContain("'/api/v2/diagnosis'");
    expect(legacyServer).toContain("'/api/v2/diagnosis/**'");
    expect(middleware).not.toContain("require('./diagnosis/diagnosis.routes')");
  });
});
