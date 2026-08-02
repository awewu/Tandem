const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('operational readiness surface', () => {
  test('keeps standard health endpoints and retires the custom heartbeat endpoint', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server/modules/health/health.routes.js'), 'utf8');

    expect(source).toContain("router.get('/live'");
    expect(source).toContain("router.get('/ready'");
    expect(source).toContain("router.get('/observability'");
    expect(source).toContain("router.get('/db'");
    expect(source).not.toContain("router.get('/heartbeat'");
  });
});
