const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('NestJS production auth service', () => {
  const service = read('services/api/src/modules/auth/auth.service.ts');
  const controller = read('services/api/src/modules/auth/auth.controller.ts');

  test('login uses PostgreSQL privileged lookup and returns tenant scoped token payload', () => {
    expect(service).toContain('auth_lookup_user_by_phone_hash');
    expect(service).toContain('withRlsTransaction');
    for (const field of ['userId', 'tenantId', 'dealerId', 'storeId', 'customerId', 'role', 'permissions']) {
      expect(service).toMatch(new RegExp(`${field}:`));
    }
  });

  test('self-registration provisions an isolated dealer tenant with no implicit privileges', () => {
    expect(service).toContain('SELF_REGISTER_ROLE');
    expect(service).toContain('assertIdentifierForRole(SELF_REGISTER_ROLE, identifier)');
    expect(service).toMatch(/type:\s*'dealer_group'/);
    expect(service).toMatch(/permissions:\s*\[\]/);
    expect(controller).toMatch(/@Public\(\)\s*@Post\('register'\)/);
  });

  test('protected auth endpoints keep explicit guards and stable success status codes', () => {
    expect(controller).toMatch(/@Post\('login'\)\s*@HttpCode\(200\)/);
    expect(controller).toMatch(/@Post\('refresh-token'\)\s*@HttpCode\(200\)\s*@UseGuards\(AuthGuard\)/);
    expect(controller).toMatch(/@Post\('logout'\)\s*@HttpCode\(200\)\s*@UseGuards\(AuthGuard\)/);
  });

  test('legacy Express auth implementation is retired', () => {
    expect(fs.existsSync(path.join(ROOT, 'server/modules/auth/auth.service.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'server/modules/auth/auth.routes.js'))).toBe(false);
  });
});
