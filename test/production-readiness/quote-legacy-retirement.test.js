const fs = require('fs');
const path = require('path');
const { getRouteOwner } = require('../../server/modules/routeOwnership');

const ROOT = path.join(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('Quote NestJS cutover and Express retirement', () => {
  test('frozen Express v2 router no longer imports or mounts quotation routes', () => {
    const router = read('server/modules/v2.router.js');
    expect(router).not.toContain("require('./quotation/quotation.routes')");
    expect(router).not.toContain("router.use('/quotation'");
    expect(fs.existsSync(path.join(ROOT, 'server/modules/quotation/quotation.routes.js'))).toBe(false);
  });

  test('route ownership points directly to the NestJS quote module', () => {
    expect(getRouteOwner('/api/v2/quotation')).toEqual(expect.objectContaining({
      owner: 'services/api/src/modules/quote',
      status: 'production',
    }));
  });

  test('legacy quotation service is retained only for pre-v2 compatibility consumers', () => {
    const legacyRoute = read('server/routes/quotation-v2.js');
    expect(legacyRoute).toContain("require('../modules/quotation/quotation.service')");
    expect(fs.existsSync(path.join(ROOT, 'server/modules/quotation/quotation.service.js'))).toBe(true);
  });
});
