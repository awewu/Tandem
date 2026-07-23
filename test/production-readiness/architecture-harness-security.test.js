const fs = require('fs');
const path = require('path');

describe('architecture harness security signal', () => {
  test('production JWT fallback is isolated behind auth runtime hard-fail', () => {
    const entrySource = fs.readFileSync(path.join(__dirname, '..', '..', 'server-production.js'), 'utf8');
    const factorySource = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'modules', 'productionAppFactory.js'), 'utf8');
    const runtimeSource = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'modules', 'authRuntime.js'), 'utf8');
    const hasDevFallback = /JWT_SECRET[\s\S]{0,300}(dev-secret|NEVER-USE-IN-PRODUCTION|'123456'|"123456")/.test(runtimeSource);
    const hasProductionHardFail = /NODE_ENV\s*===\s*['"`]production['"`][\s\S]{0,260}process\.exit\(1\)/.test(runtimeSource);

    expect(hasDevFallback).toBe(true);
    expect(hasProductionHardFail).toBe(true);
    expect(entrySource).toContain("require('./server/modules/productionAppFactory')");
    expect(factorySource).toContain("require('./authRuntime')");
    expect(factorySource).toContain('resolveJwtSecret(env)');
  });
});
