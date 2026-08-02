const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

// These are the shared backend boundaries retained for authentication,
// accounts, marketing/CRM, catalog content, files, and notifications.
const TARGET_MODULES = [
  'auth',
  'tenant',
  'crm',
  'product-catalog',
  'analytics',
  'file-artifact',
  'notification',
];

function classNameForModule(name) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

describe('target NestJS/Fastify API source contract', () => {
  test('target API main file is a real NestJS Fastify bootstrap source contract', () => {
    const main = read('services/api/src/main.ts');

    expect(main).toContain("import 'reflect-metadata'");
    expect(main).toContain("import { NestFactory } from '@nestjs/core'");
    expect(main).toContain('@nestjs/platform-fastify');
    expect(main).toContain('FastifyAdapter');
    expect(main).toContain('AppModule');
    expect(main).toContain('export async function createApiApplication');
    expect(main).toContain("app.setGlobalPrefix('api/v2')");
    expect(main).toContain('enableShutdownHooks');
    expect(main).not.toContain("status: 'scaffold-only'");
  });

  test('target API health module preserves the platform boundary', () => {
    const appModule = read('services/api/src/modules/app.module.ts');
    const health = read('services/api/src/modules/health.controller.ts');

    expect(appModule).toContain('@Module');
    expect(appModule).toContain('HealthController');
    expect(health).toContain('@Controller');
    expect(health).toContain('@Get');
    expect(health).toContain('Rhautt Nexus / 瑞合数智枢纽');
    expect(health).toContain('NestJS');
    expect(health).toContain('Fastify');
    expect(health).toContain('apiModuleBoundary');
  });

  test('AppModule composes every retained backend boundary', () => {
    const appModule = read('services/api/src/modules/app.module.ts');

    for (const moduleName of TARGET_MODULES) {
      const className = classNameForModule(moduleName);
      const source = read(`services/api/src/modules/${moduleName}/${moduleName}.module.ts`);

      expect(appModule).toContain(`${className}Module`);
      expect(source).toContain(`@Controller('${moduleName}')`);
      expect(source).toContain(`${className}BoundaryController`);
      expect(source).toContain(`${className}BoundaryService`);
      expect(source).toContain(`${className}Module`);
      expect(source).toContain(`getApiModuleBoundary('${moduleName}')`);
      expect(source).toContain("@Get('boundary')");
      expect(source).toContain('tenantScope');
      expect(source).toContain('auditLog');
      expect(source).toContain('openApiContract');
    }
  });

  test('boot smoke proves Nest/Fastify initialization without requiring retired design delivery probes', () => {
    const report = JSON.parse(read('evidence/architecture/target-api-boot-smoke.json'));

    expect(report.sourceContractProof).toBe(true);
    expect(report.status).toBe('passed-runtime-boot-smoke-current-run');
    expect(report.bootProofEligible).toBe(true);
    expect(report.nestFastifyBootProof).toBe(true);
    expect(report.runtimeBootSmoke).toEqual(expect.objectContaining({
      enabled: true,
      mode: 'target-api-boot-smoke-no-database',
      databaseSkippedForBootSmoke: true,
      postgresRuntimeProof: false,
      passed: true,
      appCreated: true,
      appInitialized: true,
      adapterType: 'fastify',
      healthRouteStatusCode: 200,
      healthRoutePassed: true,
    }));
    expect(report.runtimeBootSmoke.routeProbe).toEqual(expect.objectContaining({
      path: '/api/v2/health',
      framework: 'NestJS',
      httpAdapter: 'Fastify',
    }));
    for (const moduleName of TARGET_MODULES) {
      expect(report.sourceContract.moduleStates).toContainEqual(expect.objectContaining({
        name: moduleName,
        path: `services/api/src/modules/${moduleName}/${moduleName}.module.ts`,
        passed: true,
      }));
    }
    expect(report.missingDeclared).toEqual([]);
    expect(report.missingLockfile).toEqual([]);
    expect(report.missingInstalled).toEqual([]);
  });
});
