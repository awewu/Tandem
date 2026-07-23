const assert = require('node:assert/strict');
const test = require('node:test');

const ecosystem = require('./ecosystem.development.config');

test('dealer development process is managed and uses the logged supervisor', () => {
  const dealer = ecosystem.apps.find((app) => app.name === 'dealer-workbench-dev');

  assert.ok(dealer);
  assert.equal(dealer.script, 'scripts/dev-logged.js');
  assert.equal(dealer.autorestart, true);
  assert.equal(dealer.watch, false);
  assert.equal(dealer.env.NODE_ENV, 'development');
});

test('legacy development stack supervises both API services and the dealer workbench', () => {
  const legacyApi = ecosystem.apps.find((app) => app.name === 'legacy-api-dev');
  const nestjsApi = ecosystem.apps.find((app) => app.name === 'nestjs-api-dev');
  const dealer = ecosystem.apps.find((app) => app.name === 'dealer-workbench-dev');

  assert.ok(legacyApi);
  assert.equal(legacyApi.script, 'server-production.js');
  assert.equal(legacyApi.autorestart, true);

  assert.ok(nestjsApi);
  assert.equal(nestjsApi.script, 'scripts/start-api.js');
  assert.equal(nestjsApi.autorestart, true);

  assert.equal(dealer.env.API_URL, 'http://localhost:3000');
});
