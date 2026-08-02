const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

describe('production runtime route boundaries', () => {
  test('production error handlers do not register direct routes after the API 404 guard', () => {
    const serverSource = fs.readFileSync(path.join(ROOT, 'server-production.js'), 'utf8');
    const factorySource = fs.readFileSync(path.join(ROOT, 'server/modules/productionAppFactory.js'), 'utf8');
    const middlewareSource = fs.readFileSync(path.join(ROOT, 'server/modules/productionMiddleware.js'), 'utf8');

    expect(`${serverSource}\n${factorySource}`).toMatch(/registerProductionErrorHandlers\(\s*app\b/);
    const guardIndex = middlewareSource.indexOf("app.use('/api/*'");
    expect(guardIndex).toBeGreaterThan(0);
    expect(/\bapp\.(get|post|put|patch|delete)\s*\(\s*['"`]\/api\//.exec(middlewareSource.slice(guardIndex))).toBeNull();
  });

  test('production catalog retains scoped wrappers and excludes retired runtime routes', () => {
    const source = fs.readFileSync(path.join(ROOT, 'server/modules/productionRouteCatalog.js'), 'utf8');

    expect(source).toContain("modulePath: './legacy-api/new-features.routes'");
    expect(source).toContain("modulePath: './legacy-api/channel.routes'");
    for (const retired of [
      'legacy-api/v9.routes',
      'ai-assistant',
      'closed-loop',
      'enterprise-loop',
      'governance-runtime',
      'content-sales',
      'platform-runtime',
      'journey.routes',
      'qa.routes'
    ]) {
      expect(source).not.toContain(retired);
    }
  });
});
