const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const spec = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));
const client = read('packages/generated-client/src/rhauttNexusClient.ts');

describe('lifecycle future interface contract', () => {
  test('Express and Nest lifecycle implementations are absent', () => {
    const router = read('server/modules/v2.router.js');
    expect(router).not.toContain("require('./lifecycle/lifecycle.routes')");
    expect(router).not.toContain("router.use('/lifecycle'");
    expect(fs.existsSync(path.join(ROOT, 'server/modules/lifecycle'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'services/api/src/modules/lifecycle'))).toBe(false);
    expect(read('services/api/src/modules/app.module.ts')).not.toContain('LifecycleModule');
  });

  test('OpenAPI preserves lifecycle interfaces for future implementation', () => {
    const operations = {
      '/api/v2/lifecycle/customer-projects': ['get', 'listLifecycleCustomerProjects'],
      '/api/v2/lifecycle/customer-projects/{contractId}': ['get', 'getLifecycleCustomerProject'],
      '/api/v2/lifecycle/handover': ['post', 'createLifecycleHandover'],
      '/api/v2/lifecycle/handover/{contractId}': ['get', 'getLifecycleHandover'],
      '/api/v2/lifecycle/handover/{contractId}/acceptance': ['post', 'markLifecycleAccepted'],
      '/api/v2/lifecycle/handover/{contractId}/state': ['patch', 'updateLifecycleState'],
      '/api/v2/lifecycle/handover/{contractId}/handoff-package': ['get', 'getLifecycleIotHandoffPackage'],
    };
    for (const [route, [method, operationId]] of Object.entries(operations)) {
      expect(spec.paths[route]?.[method]?.operationId).toBe(operationId);
      expect(client).toContain(`async ${operationId}`);
    }
  });

  test('lifecycle is planned, not registered as a production runtime', () => {
    const boundary = read('services/api/src/modules/module-boundary.ts');
    expect(boundary).toMatch(/plannedApiInterfaces[\s\S]*'lifecycle'/);
    expect(read('server/modules/routeOwnership.js')).not.toContain("prefix: '/api/v2/lifecycle'");
    expect(read('server/modules/productionMiddleware.js')).not.toContain("'/api/v2/lifecycle'");
  });
});
