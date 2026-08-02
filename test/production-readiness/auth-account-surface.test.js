const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const ADMIN_ROLES = ['platform_admin', 'hq_admin', 'dealer_admin'];

describe('auth/account surface smoke', () => {
  test('dealer login page remains the reachable session entry', () => {
    const loginPagePath = path.join(ROOT, 'apps/dealer-workbench/src/app/page.tsx');
    expect(fs.existsSync(loginPagePath)).toBe(true);

    const loginPage = read('apps/dealer-workbench/src/app/page.tsx');
    expect(loginPage).toContain('export default function LoginPage');
    expect(loginPage).toContain('auth.login(phone, password)');
    expect(loginPage).toContain('setToken(res.token)');
    expect(loginPage).toContain("localStorage.setItem('token', res.token)");
    expect(loginPage).toContain(") || '/brand'");
    expect(loginPage).toContain("'/api/v2/auth/sso/login?redirect=/brand'");

    const api = read('apps/dealer-workbench/src/lib/api.ts');
    expect(api).toContain("login: (phone: string, password: string)");
    expect(api).toContain("apiFetch('/api/v2/auth/login'");
    expect(api).toContain("credentials: 'include'");
  });

  test('session validation keeps using guarded /api/v2/auth/me', () => {
    const api = read('apps/dealer-workbench/src/lib/api.ts');
    expect(api).toContain("me: () => apiFetch('/api/v2/auth/me')");

    const accountsPage = read('apps/dealer-workbench/src/app/accounts/page.tsx');
    expect(accountsPage).toContain('auth.me()');

    const controller = read('services/api/src/modules/auth/auth.controller.ts');
    expect(controller).toMatch(/@Get\('me'\)\s*@UseGuards\(AuthGuard\)\s*me\(@Req\(\) req: any\)/);
  });

  test('authorized administrators keep an account-management entry after CRM/BIM/customer navigation pruning', () => {
    const dealerNav = read('apps/dealer-workbench/src/components/DealerNav.tsx');
    expect(dealerNav).toContain('href="/accounts"');

    const accountsPage = read('apps/dealer-workbench/src/app/accounts/page.tsx');
    expect(accountsPage).toContain('auth.me()');
    expect(accountsPage).toContain('adminUsers.list(q)');
    expect(accountsPage).toContain("encodeURIComponent('/accounts')");
    expect(accountsPage).toContain("can(mePermissions, 'admin.users.view', meRole)");
    expect(accountsPage).toContain("can(mePermissions, 'admin.users.read', meRole)");
  });

  test('admin account APIs keep AuthGuard, RBAC roles, and OpenAPI role metadata aligned', () => {
    const controller = read('services/api/src/modules/auth/auth.controller.ts');
    const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
    const api = read('apps/dealer-workbench/src/lib/api.ts');

    for (const route of [
      "admin/users'",
      "admin/users/:id'",
      "admin/users/:id/reset-password'",
    ]) {
      expect(controller).toContain(route);
    }
    expect(controller.match(/@Roles\('platform_admin', 'hq_admin', 'dealer_admin'\)/g).length).toBeGreaterThanOrEqual(4);

    const operations = [
      spec.paths['/api/v2/auth/admin/users'].get,
      spec.paths['/api/v2/auth/admin/users'].post,
      spec.paths['/api/v2/auth/admin/users/{id}'].patch,
      spec.paths['/api/v2/auth/admin/users/{id}/reset-password'].post,
    ];
    for (const operation of operations) {
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(operation['x-roles']).toEqual(ADMIN_ROLES);
    }

    expect(api).toContain("apiFetch('/api/v2/auth/admin/users?'");
    expect(api).toContain("apiFetch('/api/v2/auth/admin/users'");
    expect(api).toContain("'/reset-password'");
  });
});
