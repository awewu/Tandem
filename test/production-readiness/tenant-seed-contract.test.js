const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '..', '..', 'scripts', 'db', 'seed-nestjs-auth.js');

describe('NestJS auth tenant seed contract', () => {
  test('creates an idempotent DEFAULT dealer and store and binds scoped staff accounts', () => {
    const source = fs.readFileSync(seedPath, 'utf8');

    expect(source).toContain("'DEFAULT-DEALER'");
    expect(source).toContain("'DEFAULT-STORE'");
    expect(source).toContain('INSERT INTO rhautt_nexus.dealers');
    expect(source).toContain('INSERT INTO rhautt_nexus.stores');
    expect(source).toContain('dealer_id = $2');
    expect(source).toContain('store_id = $3');
    expect(source).toContain("role = 'dealer_admin'");
    expect(source).toContain("role IN ('store_manager','designer','sales','engineer','installer')");
  });
});
