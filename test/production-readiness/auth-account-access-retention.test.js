const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

describe('auth/account access retention smoke', () => {
  const loginPage = read('apps/dealer-workbench/src/app/page.tsx');
  const accountsPage = read('apps/dealer-workbench/src/app/accounts/page.tsx');
  const dealerNav = read('apps/dealer-workbench/src/components/DealerNav.tsx');
  const dealerApi = read('apps/dealer-workbench/src/lib/api.ts');
  const authController = read('services/api/src/modules/auth/auth.controller.ts');
  const authGuard = read('services/api/src/modules/auth/auth.guard.ts');
  const rolesGuard = read('services/api/src/modules/common/roles.guard.ts');
  const routeOwnership = read('server/modules/routeOwnership.js');
  const permissionDomains = JSON.parse(read('governance/permission-domains.json'));

  test('dealer workbench root remains the reachable login page', () => {
    expect(loginPage).toContain('export default function LoginPage');
    expect(loginPage).toContain('auth.login(phone, password)');
    expect(loginPage).toContain("localStorage.setItem('token', res.token)");
    expect(loginPage).toContain("localStorage.setItem('user', JSON.stringify(res.user))");
    expect(loginPage).toContain('setToken(res.token)');
    expect(loginPage).toContain("new URLSearchParams(window.location.search).get('returnUrl')");
    expect(loginPage).toContain("window.location.href = decodeURIComponent(returnUrl)");
    expect(loginPage).toContain("'/api/v2/auth/sso/login?redirect=/brand'");
    expect(dealerApi).toContain("apiFetch('/api/v2/auth/login'");
  });

  test('session validation stays on v2 auth/me and accepts bearer or shared cookie tokens', () => {
    expect(dealerApi).toContain("me: () => apiFetch('/api/v2/auth/me')");
    expect(accountsPage).toContain('auth.me()');
    expect(authController).toMatch(/@Get\('me'\)\s*@UseGuards\(AuthGuard\)/);
    expect(authGuard).toContain("const NX_COOKIE_NAME = 'nx_token'");
    expect(authGuard).toContain("auth.startsWith('Bearer ') ? auth.slice(7) : extractTokenFromCookie(req)");
  });

  test('authorized admins can discover and enter account management after module trimming', () => {
    expect(dealerNav).toContain('href="/accounts"');
    expect(accountsPage).toContain("can(mePermissions, 'admin.users.view', meRole)");
    expect(accountsPage).toContain("can(mePermissions, 'admin.users.read', meRole)");
    expect(accountsPage).toContain('adminUsers.list(q)');
    expect(accountsPage).toContain('adminUsers.create');
    expect(accountsPage).toContain('adminUsers.update');
    expect(accountsPage).toContain('adminUsers.resetPassword');
  });

  test('account management API remains guarded by admin roles and auth domain ownership', () => {
    expect(dealerApi).toContain("apiFetch('/api/v2/auth/admin/users?'");
    expect(dealerApi).toContain("apiFetch('/api/v2/auth/admin/users'");
    expect(dealerApi).toContain("apiFetch('/api/v2/auth/admin/users/' + encodeURIComponent(id)");

    const roleDecorators =
      authController.match(/@Roles\('platform_admin', 'hq_admin', 'dealer_admin'\)/g) || [];
    expect(roleDecorators.length).toBeGreaterThanOrEqual(4);
    expect(rolesGuard).toContain('required.some((role) => roles.has(role))');

    expect(routeOwnership).toContain("{ prefix: '/api/v2/auth'");
    expect(routeOwnership).toContain("owner: 'services/api/src/modules/auth'");
    expect(permissionDomains.domains.D0.ownedModules).toContain('auth');
  });
});
