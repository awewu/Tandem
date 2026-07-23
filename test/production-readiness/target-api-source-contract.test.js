const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

const TARGET_MODULES = [
  'auth',
  'tenant',
  'crm',
  'diagnosis',
  'product-catalog',
  'quote',
  'design',
  'rysnova-bim',
  'delivery',
  'lifecycle',
  'analytics',
  'governance',
  'file-artifact',
  'notification',
  'workflow'
];

function classNameForModule(name) {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

describe('target NestJS/Fastify API source contract', () => {
  test('target API main file is a real NestJS Fastify bootstrap source contract', () => {
    const main = read('services/api/src/main.ts');

    expect(main).toContain("import 'reflect-metadata'");
    expect(main).toContain("import { NestFactory } from '@nestjs/core'");
    expect(main).toContain("@nestjs/platform-fastify");
    expect(main).toContain('FastifyAdapter');
    expect(main).toContain('AppModule');
    expect(main).toContain('export async function createApiApplication');
    expect(main).toContain("app.setGlobalPrefix('api/v2')");
    expect(main).toContain('enableShutdownHooks');
    expect(main).toContain("status: 'source-contract-ready'");
    expect(main).toContain('runtimeTruth');
    expect(main).not.toContain("status: 'scaffold-only'");
  });

  test('target API health module preserves platform, module boundary, and IoT lifecycle boundary', () => {
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
    expect(health).toContain("iotBoundary: 'lifecycle_handoff_only'");
  });

  test('target AppModule composes every P0 backend module source boundary', () => {
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

    const lifecycleSource = read('services/api/src/modules/lifecycle/lifecycle.module.ts');
    expect(lifecycleSource).toContain('iotBoundary');
  });

  test('target API boot smoke proves Nest/Fastify app initialization without claiming staging database proof', () => {
    const report = JSON.parse(read('evidence/architecture/target-api-boot-smoke.json'));

    expect(report.sourceContractProof).toBe(true);
    expect(report.sourceContract.checks.every(check => check.passed)).toBe(true);
    expect(report.sourceContract.moduleStates).toHaveLength(TARGET_MODULES.length);
    for (const moduleName of TARGET_MODULES) {
      expect(report.sourceContract.moduleStates).toContainEqual(expect.objectContaining({
        name: moduleName,
        path: `services/api/src/modules/${moduleName}/${moduleName}.module.ts`,
        passed: true
      }));
    }
    expect(report.status).toBe('passed-runtime-boot-smoke-current-run');
    expect(report.bootProofEligible).toBe(true);
    expect(report.nestFastifyBootProof).toBe(true);
    expect(report.serviceTsconfig).toBe('services/api/tsconfig.json');
    expect(report.runtimeBootSmoke).toEqual(expect.objectContaining({
      enabled: true,
      mode: 'target-api-boot-smoke-no-database',
      targetApiBootSmokeEnv: true,
      databaseSkippedForBootSmoke: true,
      postgresRuntimeProof: false,
      passed: true,
      appCreated: true,
      appInitialized: true,
      adapterType: 'fastify',
      healthRouteStatusCode: 200,
      healthRoutePassed: true,
      rysnovaBimBoundaryRouteStatusCode: 200,
      rysnovaBimBoundaryRoutePassed: true,
      rysnovaBimCustomerPackageAuthStatusCode: 401,
	      rysnovaBimCustomerPackageAuthPassed: true,
	      rysnovaBimCustomerPackageHappyPathStatusCode: 200,
	      rysnovaBimCustomerPackageHappyPathPassed: true,
      rysnovaBimArtifactDownloadAuthStatusCode: 401,
	      rysnovaBimArtifactDownloadAuthPassed: true,
	      rysnovaBimArtifactDownloadHappyPathStatusCode: 200,
	      rysnovaBimArtifactDownloadHappyPathPassed: true,
	      rysnovaBimArtifactDownloadContentAuthStatusCode: 401,
	      rysnovaBimArtifactDownloadContentAuthPassed: true,
	      rysnovaBimArtifactDownloadContentHappyPathStatusCode: 200,
	      rysnovaBimArtifactDownloadContentHappyPathPassed: true,
	      rysnovaBimVisualArtifactsAuthStatusCode: 401,
	      rysnovaBimVisualArtifactsAuthPassed: true,
      rysnovaBimDeliverableArtifactsAuthStatusCode: 401,
      rysnovaBimDeliverableArtifactsAuthPassed: true,
      rysnovaBimSignoffPackageAuthStatusCode: 401,
      rysnovaBimSignoffPackageAuthPassed: true,
      rysnovaBimDeepeningPackageAuthStatusCode: 401,
      rysnovaBimDeepeningPackageAuthPassed: true,
      rysnovaBimVisualArtifactsHappyPathStatusCode: 201,
      rysnovaBimVisualArtifactsHappyPathPassed: true,
      rysnovaBimDeliverableArtifactsHappyPathStatusCode: 201,
      rysnovaBimDeliverableArtifactsHappyPathPassed: true,
      rysnovaBimSignoffPackageHappyPathStatusCode: 201,
      rysnovaBimSignoffPackageHappyPathPassed: true,
      rysnovaBimDeepeningPackageHappyPathStatusCode: 200,
      rysnovaBimDeepeningPackageHappyPathPassed: true,
      rysnovaBimWorkflowAuthStatusCode: 401,
      rysnovaBimWorkflowAuthPassed: true,
      rysnovaBimWorkflowHappyPathStatusCode: 200,
      rysnovaBimWorkflowHappyPathPassed: true
    }));
    expect(report.runtimeBootSmoke.routeProbe).toEqual(expect.objectContaining({
      path: '/api/v2/health',
      platform: 'Rhautt Nexus / 瑞合数智枢纽',
      framework: 'NestJS',
      httpAdapter: 'Fastify',
      iotBoundary: 'lifecycle_handoff_only'
    }));
    expect(report.runtimeBootSmoke.rysnovaBimBoundaryProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/boundary',
      tenantScope: true,
      auditLog: true,
      openApiContract: true
    }));
    expect(report.runtimeBootSmoke.rysnovaBimCustomerPackageAuthProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      authBoundary: 'bearer-token-required',
      statusCode: 401
    }));
	    expect(report.runtimeBootSmoke.rysnovaBimCustomerPackageHappyPathProbe).toEqual(expect.objectContaining({
	      path: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
	      authBoundary: 'customer-bearer-token',
      statusCode: 200,
      envelopeSuccess: true,
      dataPresent: true,
      artifactCount: 7,
      missingTypes: [],
      allCustomerVisible: true,
      statusesApprovedOrShared: true,
      storageIntegrityPassed: true,
	      leakedForbiddenFields: []
	    }));
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadAuthProbe).toEqual(expect.objectContaining({
	      path: '/api/v2/rysnova-bim/artifacts/{artifactId}/download',
	      authBoundary: 'bearer-token-required',
	      statusCode: 401
	    }));
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadHappyPathProbe).toEqual(expect.objectContaining({
	      path: '/api/v2/rysnova-bim/artifacts/{artifactId}/download',
	      authBoundary: 'customer-bearer-token',
	      statusCode: 200,
	      envelopeSuccess: true,
	      dataPresent: true,
	      objectKeyPresent: true,
	      contentHashPresent: true,
	      integrityPassed: true,
	      downloadReady: true,
	      customerSafe: true,
	      accessMode: 'object-storage-gateway',
	      leakedForbiddenFields: []
	    }));
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadHappyPathProbe.downloadUrl)
	      .toContain('/api/v2/rysnova-bim/artifacts/');
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadContentAuthProbe).toEqual(expect.objectContaining({
	      path: '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
	      authBoundary: 'bearer-token-required',
	      statusCode: 401
	    }));
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadContentHappyPathProbe).toEqual(expect.objectContaining({
	      path: '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
	      authBoundary: 'customer-bearer-token',
	      statusCode: 200,
	      etagPresent: true,
	      cacheControl: 'private, max-age=0, must-revalidate',
	      bodyPresent: true,
	      notJsonEnvelope: true
	    }));
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadContentHappyPathProbe.contentLength).toBeGreaterThan(0);
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadContentHappyPathProbe.xContentSha256).toMatch(/^sha256:/);
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadContentHappyPathProbe.xRysnovaArtifactId).toBeTruthy();
	    expect(report.runtimeBootSmoke.rysnovaBimArtifactDownloadContentHappyPathProbe.xRysnovaArtifactType).toBeTruthy();
	    expect(report.runtimeBootSmoke.rysnovaBimVisualArtifactsAuthProbe).toEqual(expect.objectContaining({
	      path: '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts',
      authBoundary: 'bearer-token-required',
      statusCode: 401
    }));
    expect(report.runtimeBootSmoke.rysnovaBimDeliverableArtifactsAuthProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      authBoundary: 'bearer-token-required',
      statusCode: 401
    }));
    expect(report.runtimeBootSmoke.rysnovaBimSignoffPackageAuthProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      authBoundary: 'bearer-token-required',
      statusCode: 401
    }));
    expect(report.runtimeBootSmoke.rysnovaBimDeepeningPackageAuthProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/deepening-package',
      authBoundary: 'bearer-token-required',
      statusCode: 401
    }));
    expect(report.runtimeBootSmoke.rysnovaBimVisualArtifactsHappyPathProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts',
      authBoundary: 'designer-bearer-token',
      statusCode: 201,
      envelopeSuccess: true,
      dataPresent: true,
      artifactCount: 3,
      missingTypes: [],
      allStorageReady: true
    }));
    expect(report.runtimeBootSmoke.rysnovaBimVisualArtifactsHappyPathProbe.artifactTypes.sort()).toEqual([
      'bim-model',
      'construction-drawing',
      'principle-diagram'
    ]);
    expect(report.runtimeBootSmoke.rysnovaBimDeliverableArtifactsHappyPathProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      authBoundary: 'designer-bearer-token',
      statusCode: 201,
      envelopeSuccess: true,
      dataPresent: true,
      artifactCount: 4,
      missingTypes: [],
      allStorageReady: true,
      standardsPassed: true
    }));
    expect(report.runtimeBootSmoke.rysnovaBimDeliverableArtifactsHappyPathProbe.artifactTypes.sort()).toEqual([
      'bom',
      'customer-report',
      'quantity-takeoff',
      'standards-check'
    ]);
    expect(['pass', 'floor_adjusted']).toContain(report.runtimeBootSmoke.rysnovaBimDeliverableArtifactsHappyPathProbe.quoteMarginGuardStatus);
    expect(report.runtimeBootSmoke.rysnovaBimDeliverableArtifactsHappyPathProbe.quantityPipeMeters).toBeGreaterThan(0);
    expect(report.runtimeBootSmoke.rysnovaBimSignoffPackageHappyPathProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      authBoundary: 'designer-bearer-token',
      statusCode: 201,
      envelopeSuccess: true,
      dataPresent: true,
      approvalMode: 'share-to-customer',
      status: 'signoff-ready',
      artifactCount: 7,
      missingTypes: [],
      visualArtifactCount: 3,
      deliverableArtifactCount: 4,
      approvalCount: 7,
      customerPackageReady: true,
      handoffReady: true,
      downloadManifestReady: true,
      downloadManifestCount: 7,
      downloadManifestBlockedCount: 0,
      lifecycleHandoffReady: true
    }));
    expect(['pass', 'floor_adjusted']).toContain(report.runtimeBootSmoke.rysnovaBimSignoffPackageHappyPathProbe.quoteMarginGuardStatus);
    expect(report.runtimeBootSmoke.rysnovaBimSignoffPackageHappyPathProbe.quantityPipeMeters).toBeGreaterThan(0);
    expect(report.runtimeBootSmoke.rysnovaBimDeepeningPackageApprovalProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/artifacts/{artifactId}/approval',
      artifactCount: 7,
      approvedCount: 7,
      allEnvelopeSuccess: true,
      allShared: true,
      allCustomerVisible: true,
      storageIntegrityPassed: true
    }));
    expect(report.runtimeBootSmoke.rysnovaBimDeepeningPackageHappyPathProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/projects/{projectId}/deepening-package',
      authBoundary: 'designer-bearer-token',
      statusCode: 200,
      envelopeSuccess: true,
      dataPresent: true,
      handoffReady: true,
      status: 'handoff-ready',
      missingTypes: [],
      approvalMissingTypes: [],
      visualReady: true,
      commercialReady: true,
      customerSignoffReady: true,
      storageIntegrityTodoCount: 0,
      evidenceGapsCount: 0,
      nextActionsCount: 0,
      customerVisibleCount: 7
    }));
    expect(['pass', 'floor_adjusted']).toContain(report.runtimeBootSmoke.rysnovaBimDeepeningPackageHappyPathProbe.quoteMarginGuardStatus);
    expect(report.runtimeBootSmoke.rysnovaBimDeepeningPackageHappyPathProbe.quantityPipeMeters).toBeGreaterThan(0);
    expect(report.runtimeBootSmoke.rysnovaBimWorkflowAuthProbe).toEqual(expect.objectContaining({
      path: '/api/v2/workflow/rysnova-bim/projects/{projectId}',
      authBoundary: 'bearer-token-required',
      statusCode: 401
    }));
    expect(report.runtimeBootSmoke.rysnovaBimWorkflowHappyPathProbe).toEqual(expect.objectContaining({
      path: '/api/v2/workflow/rysnova-bim/projects/{projectId}',
      authBoundary: 'designer-bearer-token',
      statusCode: 200,
      module: 'Rysnova',
      status: 'ready-for-worker',
      temporalRuntimeProof: false,
      workerRuntimeProof: false,
      outboxRequired: true,
      iotBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      customerPackageReadyEventPresent: true,
      customerSignoffConfirmedEventPresent: true,
      artifactIntegrityEventPresent: true,
      lifecycleHandoffEventPresent: true,
      signoffTypeCount: 7
    }));
    expect(report.runtimeBootSmoke.rysnovaBimWorkflowHappyPathProbe.workflowTypes).toEqual(expect.arrayContaining([
      'drawing-export-workflow',
      'rysnova-bim-customer-signoff-workflow'
    ]));
    expect(report.runtimeBootSmoke.rysnovaBimWorkflowHappyPathProbe.nonCompletionRule).toContain('Temporal runtime worker evidence');
    expect(report.finalLaunchArchitectureProof).toBe(false);
    expect(report.missingDeclared).toEqual([]);
    expect(report.missingLockfile).toEqual([]);
    expect(report.missingInstalled).toEqual([]);
  });

  test('target Rysnova module is mounted as a real Nest route boundary without exposing customer packages anonymously', () => {
    const rysnovaBimModule = read('services/api/src/modules/rysnova-bim/rysnova-bim.module.ts');
    const rysnovaBimController = read('services/api/src/modules/rysnova-bim/rysnova-bim.controller.ts');
    const rysnovaBimService = read('services/api/src/modules/rysnova-bim/rysnova-bim.service.ts');
    const rysnovaBimBootSmoke = read('services/api/src/modules/rysnova-bim/rysnova-bim.boot-smoke.ts');
    const openapi = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));

    expect(rysnovaBimModule).toContain('controllers: [RysnovaController, RysnovaBoundaryController, BimController, BimPublicController]');
	    expect(rysnovaBimModule).toContain('RysnovaService');
	    expect(rysnovaBimModule).toContain('RysnovaBoundaryService');
	    expect(rysnovaBimModule).toContain('bootSmokeRepositoryProvider(RysnovaArtifactEntity)');
	    expect(rysnovaBimModule).toContain("getApiModuleBoundary('rysnova-bim')");
    expect(rysnovaBimModule).toContain("@Controller('rysnova-bim')");
    expect(rysnovaBimModule).toContain("@Get('boundary')");

	    expect(rysnovaBimController).toContain('@UseGuards(AuthGuard)');
	    expect(rysnovaBimController).toContain('private envelope(data: unknown)');
	    expect(rysnovaBimController).toContain('return { success: true, data }');
	    expect(rysnovaBimController).toContain('this.envelope(await this.svc');
	    expect(rysnovaBimController).toContain("@Get('artifacts/:artifactId/download')");
	    expect(rysnovaBimController).toContain("@Get('artifacts/:artifactId/download/content')");
	    expect(rysnovaBimController).toContain("@Get('projects/:projectId/customer-package')");
    expect(rysnovaBimController).toContain("@Post('projects/:projectId/visual-artifacts')");
    expect(rysnovaBimController).toContain("@Post('projects/:projectId/deliverable-artifacts')");
    expect(rysnovaBimController).toContain("@Post('projects/:projectId/signoff-package')");
    expect(rysnovaBimController).toContain("@Post('projects/:projectId/customer-signoff')");
    expect(rysnovaBimController).toContain("@Get('projects/:projectId/deepening-package')");
	    expect(rysnovaBimController).toContain('prepareDownload');
	    expect(rysnovaBimController).toContain('downloadContent');
	    expect(rysnovaBimController).toContain('buildCustomerPackage');
    expect(rysnovaBimController).toContain('generateVisualArtifacts');
    expect(rysnovaBimController).toContain('generateDeliverableArtifacts');
    expect(rysnovaBimController).toContain('generateSignoffPackage');
    expect(rysnovaBimController).toContain('confirmCustomerSignoff');
    expect(rysnovaBimController).toContain('buildDeepeningPackage');

    expect(rysnovaBimService).toContain('TARGET_API_BOOT_SMOKE');
    expect(rysnovaBimService).toContain('createRysnovaBootSmokeArtifactService');
	    expect(rysnovaBimService).toContain("customerId: user['customerId']");
	    expect(rysnovaBimService).toContain("role: user['role']");
	    expect(rysnovaBimService).toContain('prepareArtifactDownload');
	    expect(rysnovaBimService).toContain('downloadArtifactContent');
	    expect(rysnovaBimService).toContain('generateVisualArtifacts');
    expect(rysnovaBimService).toContain('generateDeliverableArtifacts');
    expect(rysnovaBimService).toContain('generateSignoffPackage');
    expect(rysnovaBimService).toContain('confirmCustomerSignoff');
    expect(rysnovaBimService).toContain('buildDeepeningPackage');

    expect(rysnovaBimBootSmoke).toContain('RYSNOVA_BOOT_SMOKE_REQUIRED_TYPES');
    for (const requiredType of [
      'principle-diagram',
      'construction-drawing',
      'bim-model',
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ]) {
      expect(rysnovaBimBootSmoke).toContain(requiredType);
    }
    expect(rysnovaBimBootSmoke).toContain('MemoryArtifactStorageAdapter');
    expect(rysnovaBimBootSmoke).toContain('shareToCustomer: true');

    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/customer-package'].get).toEqual(expect.objectContaining({
      operationId: 'buildRysnovaCustomerPackage'
    }));
    expect(openapi.components.responses.RysnovaCustomerPackageSuccess.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/RysnovaCustomerPackageEnvelope');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts'].post).toEqual(expect.objectContaining({
      operationId: 'generateRysnovaVisualArtifacts'
    }));
    expect(openapi.components.responses.RysnovaVisualArtifactsSuccess.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/RysnovaVisualArtifactsEnvelope');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'].post).toEqual(expect.objectContaining({
      operationId: 'generateRysnovaDeliverableArtifacts'
    }));
    expect(openapi.components.responses.RysnovaDeliverableArtifactsSuccess.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/RysnovaDeliverableArtifactsEnvelope');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/signoff-package'].post).toEqual(expect.objectContaining({
      operationId: 'generateRysnovaSignoffPackage'
    }));
    expect(openapi.components.responses.RysnovaSignoffPackageSuccess.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/RysnovaSignoffPackageEnvelope');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/customer-signoff'].post).toEqual(expect.objectContaining({
      operationId: 'confirmRysnovaCustomerSignoff',
      security: [{ bearerAuth: [] }]
    }));
    expect(openapi.components.responses.RysnovaCustomerSignoffSuccess.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/RysnovaCustomerSignoffEnvelope');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/deepening-package'].get).toEqual(expect.objectContaining({
      operationId: 'buildRysnovaDeepeningPackage'
    }));
    expect(openapi.components.responses.RysnovaDeepeningPackageSuccess.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/RysnovaDeepeningPackageEnvelope');
    expect(openapi.paths['/api/v2/rysnova-bim/artifacts/{artifactId}/download'].get).toEqual(expect.objectContaining({
      operationId: 'prepareRysnovaArtifactDownload'
    }));
    expect(openapi.components.responses.RysnovaArtifactDownloadSuccess.content['application/json'].schema.$ref)
      .toBe('#/components/schemas/RysnovaArtifactDownloadEnvelope');
    expect(openapi.paths['/api/v2/rysnova-bim/artifacts/{artifactId}/download/content'].get).toEqual(expect.objectContaining({
      operationId: 'downloadRysnovaArtifactContent',
      security: [{ bearerAuth: [] }]
    }));
    expect(openapi.components.responses.RysnovaArtifactContentSuccess.content['application/octet-stream'].schema)
      .toEqual({ type: 'string', format: 'binary' });
    expect(openapi.components.responses.RysnovaArtifactContentSuccess.headers['X-Content-SHA256'].schema.type)
      .toBe('string');
  });

  test('target workflow module exposes Rysnova handoff workflows instead of an empty facade', () => {
    const workflowController = read('services/api/src/modules/workflow/workflow.controller.ts');
    const workflowService = read('services/api/src/modules/workflow/workflow.service.ts');
    const openapi = JSON.parse(read('contracts/openapi/rhautt-nexus-v2.openapi.json'));

    expect(workflowController).toContain("@Get('rysnova-bim/projects/:projectId')");
    expect(workflowController).toContain('getRysnovaProjectWorkflow');
    expect(workflowService).toContain('drawing-export-workflow');
    expect(workflowService).toContain('rysnova-bim-customer-signoff-workflow');
    expect(workflowService).toContain('rysnova-bim.customer_package.ready');
    expect(workflowService).toContain('rysnova-bim.customer_signoff.confirmed');
    expect(workflowService).toContain('rysnova-bim.artifact.integrity.verified');
    expect(workflowService).toContain('rysnova-bim.lifecycle_handoff.ready');
    expect(workflowService).toContain('temporalRuntimeProof: false');
    expect(workflowService).toContain('workerRuntimeProof: false');
    expect(workflowService).toContain("iotBoundary: 'lifecycle_handoff_only'");
    expect(workflowService).toContain('external-iot-lifecycle-platform');
    expect(workflowService).not.toContain('async listWorkflows(_user: JwtPayload) { return []; }');

    expect(openapi.paths['/api/v2/workflow/rysnova-bim/projects/{projectId}'].get).toEqual(expect.objectContaining({
      operationId: 'getRysnovaProjectWorkflow',
      security: [{ bearerAuth: [] }]
    }));
    expect(openapi.components.schemas.RysnovaWorkflowSnapshot.required).toEqual(expect.arrayContaining([
      'module',
      'projectId',
      'status',
      'temporalRuntimeProof',
      'workerRuntimeProof',
      'outboxRequired',
      'iotBoundary',
      'workflows',
      'requiredArtifacts'
    ]));
    expect(openapi.components.schemas.RysnovaWorkflowSnapshot.properties.iotBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(openapi.components.schemas.RysnovaWorkflowSnapshot.properties.temporalRuntimeProof.const).toBe(false);
    expect(openapi.components.schemas.RysnovaWorkflowSnapshot.properties.workerRuntimeProof.const).toBe(false);
    expect(openapi.components.schemas.RysnovaWorkflowSnapshot.properties.workflows.items.$ref)
      .toBe('#/components/schemas/WorkflowInstanceSnapshot');
    expect(openapi.components.schemas.WorkflowInstanceSnapshot.properties.workflowType.enum).toEqual(expect.arrayContaining([
      'drawing-export-workflow',
      'rysnova-bim-customer-signoff-workflow'
    ]));
    expect(openapi.components.schemas.WorkflowInstanceSnapshot.properties.requiredArtifacts.items.$ref)
      .toBe('#/components/schemas/RysnovaArtifactType');
  });
});
