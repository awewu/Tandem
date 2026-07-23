const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

const MODULE_DIR = 'services/api/src/modules/entitlement';

describe('entitlement 订阅授权 · 契约与接线', () => {
  test('OpenAPI 暴露 4 个 entitlement 端点（operationId/tags/responses 完整）', () => {
    const paths = {
      '/api/v2/entitlement/me': ['get', 'getEntitlementMe'],
      '/api/v2/entitlement/subscriptions': ['get', 'listEntitlementSubscriptions'],
      '/api/v2/entitlement/grant': ['post', 'grantEntitlement'],
      '/api/v2/entitlement/revoke': ['post', 'revokeEntitlement'],
    };
    for (const [routePath, [method, operationId]] of Object.entries(paths)) {
      const op = spec.paths[routePath]?.[method];
      expect(op).toBeTruthy();
      expect(op.operationId).toBe(operationId);
      expect(op.tags).toContain('Entitlement');
      expect(Object.keys(op.responses).length).toBeGreaterThan(0);
      expect(op.security).toEqual([{ bearerAuth: [] }]);
    }
  });

  test('生成客户端暴露 4 个 entitlement 方法', () => {
    for (const method of ['getEntitlementMe', 'listEntitlementSubscriptions', 'grantEntitlement', 'revokeEntitlement']) {
      expect(client).toContain(`async ${method}`);
    }
  });

  test('entitlement 模块源文件齐备', () => {
    for (const f of [
      'subscription.entity.ts', 'entitlement.decorator.ts', 'entitlement.service.ts',
      'entitlement.guard.ts', 'entitlement.controller.ts', 'entitlement.module.ts',
    ]) {
      expect(fs.existsSync(path.join(ROOT, MODULE_DIR, f))).toBe(true);
    }
  });

  test('EntitlementGuard 实时查库鉴权（不信任 token）+ boot-smoke 放行', () => {
    const guard = read(`${MODULE_DIR}/entitlement.guard.ts`);
    expect(guard).toContain('hasActiveModules');
    expect(guard).toContain('REQUIRE_MODULE_KEY');
    expect(guard).toContain('TARGET_API_BOOT_SMOKE');
    expect(guard).toContain('req.user?.tenantId');
  });

  test('订阅服务走 RLS 事务（租户隔离）', () => {
    const service = read(`${MODULE_DIR}/entitlement.service.ts`);
    expect(service).toContain('withRlsTransaction');
    expect(service).toContain('activeModuleIds');
    expect(service).toContain('hasActiveModules');
  });

  test('EntitlementGuard 注册为全局守卫，模块被 AppModule 装配', () => {
    const app = read('services/api/src/modules/app.module.ts');
    expect(app).toContain('EntitlementModule');
    expect(app).toContain('useClass: EntitlementGuard');
  });

  test('entitlement 登记进模块边界契约', () => {
    const boundary = read('services/api/src/modules/module-boundary.ts');
    expect(boundary).toContain("'entitlement'");
    expect(boundary).toContain("apiNamespace: '/api/v2/entitlement'");
  });

  test('auth JWT 携带 modules 订阅声明（前端能力开关）', () => {
    const authService = read('services/api/src/modules/auth/auth.service.ts');
    expect(authService).toContain('resolveModules');
    expect(authService).toContain('modules');
    expect(authService).toContain('activeModuleIds');
  });

  test('数据库迁移 018 建订阅表并启用强 RLS', () => {
    const migration = read('database/postgres/migrations/018_entitlement_subscriptions.sql');
    expect(migration).toContain('tenant_module_subscriptions');
    expect(migration).toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('tenant_id = rhautt_nexus.current_tenant_id()');
  });
});
