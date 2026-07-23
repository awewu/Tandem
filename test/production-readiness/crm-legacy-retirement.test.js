const fs = require('fs');
const path = require('path');
const { getRouteOwner } = require('../../server/modules/routeOwnership');

const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('CRM NestJS cutover and Express retirement', () => {
  test('frozen Express v2 router no longer imports or mounts CRM routes', () => {
    const router = read('server/modules/v2.router.js');
    expect(router).not.toContain("require('./crm/crm.routes')");
    expect(router).not.toContain("router.use('/crm'");
    expect(fs.existsSync(path.join(ROOT, 'server/modules/crm/crm.routes.js'))).toBe(false);
  });

  test('route ownership points directly to the NestJS CRM module', () => {
    expect(getRouteOwner('/api/v2/crm/customers')).toEqual(expect.objectContaining({
      owner: 'services/api/src/modules/crm',
      status: 'production',
    }));
  });

  test('diagnosis no longer retains the legacy CRM service after its NestJS cutover', () => {
    const service = read('server/modules/crm/crm.service.js');
    expect(service).toContain('Diagnosis was retired to NestJS;');
    expect(fs.existsSync(path.join(ROOT, 'server/modules/diagnosis/diagnosis.service.js'))).toBe(false);
  });
});
