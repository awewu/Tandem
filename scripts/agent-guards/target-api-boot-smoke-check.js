#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_JSON = 'evidence/architecture/target-api-boot-smoke.json';
const REPORT_MD = 'evidence/architecture/target-api-boot-smoke.md';
const SERVICE_ENTRY = 'services/api/src/main.ts';
const SERVICE_MODULE = 'services/api/src/modules/app.module.ts';
const HEALTH_CONTROLLER = 'services/api/src/modules/health.controller.ts';
const SERVICE_TSCONFIG = 'services/api/tsconfig.json';
const REQUIRED_BACKEND_MODULES = [
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
const REQUIRED = [
  'next',
  'nx',
  '@nestjs/core',
  '@nestjs/common',
  '@nestjs/platform-fastify',
  'fastify',
  'reflect-metadata',
  'rxjs'
];

const failures = [];
const warnings = [];

function fullPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(fullPath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fail(message) {
  failures.push(message);
}

function classNameForModule(name) {
  // rysnova-bim 模块的类以 Rysnova* 命名（非 RysnovaBim*），单独映射。
  if (name === 'rysnova-bim') return 'Rysnova';
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

if (!exists(REPORT_JSON)) fail(`missing ${REPORT_JSON}; run npm run release:target-api:boot-smoke`);
if (!exists(REPORT_MD)) fail(`missing ${REPORT_MD}; run npm run release:target-api:boot-smoke`);
if (!exists('scripts/release/target-api-boot-smoke.js')) fail('missing target API boot smoke script');
if (!exists(SERVICE_ENTRY)) fail(`missing ${SERVICE_ENTRY}`);
if (!exists(SERVICE_MODULE)) fail(`missing ${SERVICE_MODULE}`);
if (!exists(HEALTH_CONTROLLER)) fail(`missing ${HEALTH_CONTROLLER}`);
if (!exists(SERVICE_TSCONFIG)) fail(`missing ${SERVICE_TSCONFIG}`);

const pkg = exists('package.json') ? readJson('package.json') : {};
if (pkg.scripts?.['release:target-api:boot-smoke'] !== 'node scripts/release/target-api-boot-smoke.js') {
  fail('package.json release:target-api:boot-smoke must run node scripts/release/target-api-boot-smoke.js');
}
if (pkg.scripts?.['guard:target-api-boot-smoke'] !== 'node scripts/agent-guards/target-api-boot-smoke-check.js') {
  fail('package.json guard:target-api-boot-smoke must run node scripts/agent-guards/target-api-boot-smoke-check.js');
}
if (!String(pkg.scripts?.['guard:all'] || '').includes('guard:target-api-boot-smoke')) {
  fail('package.json guard:all must include guard:target-api-boot-smoke');
}
if (!String(pkg.scripts?.['guard:all:nonvisual'] || '').includes('guard:target-api-boot-smoke')) {
  fail('package.json guard:all:nonvisual must include guard:target-api-boot-smoke');
}
if (!String(pkg.scripts?.['release:evidence'] || '').includes('release:target-api:boot-smoke')) {
  fail('package.json release:evidence must include release:target-api:boot-smoke');
}

if (exists(REPORT_JSON)) {
  const report = readJson(REPORT_JSON);
  if (report.platform !== 'Rhautt Nexus / 瑞合数智枢纽') fail('target API boot smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
  if (report.command !== 'npm run release:target-api:boot-smoke') fail('target API boot smoke command mismatch');
  if (report.serviceEntry !== SERVICE_ENTRY) fail(`target API boot smoke serviceEntry must be ${SERVICE_ENTRY}`);
  if (report.serviceModule !== SERVICE_MODULE) fail(`target API boot smoke serviceModule must be ${SERVICE_MODULE}`);
  if (report.healthController !== HEALTH_CONTROLLER) fail(`target API boot smoke healthController must be ${HEALTH_CONTROLLER}`);
  if (report.serviceTsconfig !== SERVICE_TSCONFIG) fail(`target API boot smoke serviceTsconfig must be ${SERVICE_TSCONFIG}`);
  if (report.sourceContractProof !== true) fail('target API boot smoke must prove NestJS/Fastify source contract even when dependencies are missing');
  if (report.sourceContract?.checks?.some(item => !item.passed)) fail('target API boot smoke source contract checks must all pass');
  const moduleStates = report.sourceContract?.moduleStates || [];
  if (moduleStates.length !== REQUIRED_BACKEND_MODULES.length) {
    fail(`target API boot smoke must record ${REQUIRED_BACKEND_MODULES.length} backend module states`);
  }
  for (const moduleName of REQUIRED_BACKEND_MODULES) {
    const moduleState = moduleStates.find(item => item.name === moduleName);
    if (!moduleState) {
      fail(`target API boot smoke missing module state: ${moduleName}`);
      continue;
    }
    if (moduleState.path !== `services/api/src/modules/${moduleName}/${moduleName}.module.ts`) {
      fail(`target API boot smoke module path mismatch: ${moduleName}`);
    }
    if (moduleState.passed !== true) fail(`target API boot smoke module state must pass: ${moduleName}`);
    if (moduleState.checks?.some(item => !item.passed)) fail(`target API boot smoke module checks must all pass: ${moduleName}`);
  }
  if (report.finalLaunchArchitectureProof !== false) fail('target API boot smoke must not claim finalLaunchArchitectureProof');
  if (![
    'missing-target-dependencies',
    'runtime-import-failed',
    'missing-service-entry',
    'passed-runtime-boot-smoke-current-run',
    'runtime-boot-smoke-failed'
  ].includes(report.status)) {
    fail(`unsupported target API boot smoke status: ${report.status}`);
  }
  for (const dependency of REQUIRED) {
    if (!report.dependencies?.some(item => item.name === dependency)) {
      fail(`target API boot smoke missing dependency: ${dependency}`);
    }
  }
  if (report.status === 'missing-target-dependencies') {
    if (report.bootProofEligible !== false || report.nestFastifyBootProof !== false) {
      fail('missing target dependencies must keep bootProofEligible and nestFastifyBootProof false');
    }
    if (!report.missingDeclared?.length && !report.missingLockfile?.length && !report.missingInstalled?.length) {
      fail('missing-target-dependencies report must list missingDeclared, missingLockfile, or missingInstalled dependencies');
    }
    const missing = [...new Set([
      ...(report.missingDeclared || []),
      ...(report.missingLockfile || []),
      ...(report.missingInstalled || [])
    ])];
    warnings.push(`Target API boot smoke missing dependencies: ${missing.join(', ')}`);
  }
  if (report.status === 'passed-runtime-boot-smoke-current-run') {
    if (report.bootProofEligible !== true || report.nestFastifyBootProof !== true) {
      fail('passed runtime boot smoke must mark bootProofEligible and nestFastifyBootProof true');
    }
    if (report.runtimeImports?.some(item => !item.ok)) {
      fail('passed runtime boot smoke cannot contain failed runtime imports');
    }
    const boot = report.runtimeBootSmoke || {};
    if (boot.enabled !== true) fail('passed target API boot smoke must enable runtimeBootSmoke');
    if (boot.mode !== 'target-api-boot-smoke-no-database') fail('target API boot smoke mode must be target-api-boot-smoke-no-database');
    if (boot.tsNodeProject !== SERVICE_TSCONFIG) fail(`target API boot smoke must use ${SERVICE_TSCONFIG}`);
    if (boot.targetApiBootSmokeEnv !== true) fail('target API boot smoke must set TARGET_API_BOOT_SMOKE=true');
    if (boot.databaseSkippedForBootSmoke !== true) fail('target API boot smoke must explicitly skip database only in smoke mode');
    if (boot.postgresRuntimeProof !== false) fail('target API boot smoke must not claim PostgreSQL runtime proof');
    if (boot.passed !== true || boot.appCreated !== true || boot.appInitialized !== true) {
      fail('passed target API boot smoke must create and initialize the Nest/Fastify application');
    }
    if (boot.adapterType !== 'fastify') fail('target API boot smoke adapterType must be fastify');
    if (boot.healthRouteStatusCode !== 200 || boot.healthRoutePassed !== true) {
      fail('target API boot smoke must pass GET /api/v2/health route probe');
    }
    if (boot.routeProbe?.path !== '/api/v2/health' || boot.routeProbe?.iotBoundary !== 'lifecycle_handoff_only') {
      fail('target API boot smoke route probe must preserve /api/v2/health and lifecycle_handoff_only');
    }
    if (boot.rysnovaBoundaryRouteStatusCode !== 200 || boot.rysnovaBoundaryRoutePassed !== true) {
      fail('target API boot smoke must pass GET /api/v2/rysnova-bim/boundary route probe');
    }
    if (boot.rysnovaBoundaryProbe?.path !== '/api/v2/rysnova-bim/boundary' ||
        boot.rysnovaBoundaryProbe?.tenantScope !== true ||
        boot.rysnovaBoundaryProbe?.auditLog !== true ||
        boot.rysnovaBoundaryProbe?.openApiContract !== true) {
      fail('target API boot smoke Rysnova boundary probe must prove tenantScope, auditLog, and OpenAPI contract requirements');
    }
    if (boot.rysnovaCustomerPackageAuthStatusCode !== 401 || boot.rysnovaCustomerPackageAuthPassed !== true) {
      fail('target API boot smoke must prove Rysnova customer-package route is mounted and bearer-token protected');
    }
    if (boot.rysnovaCustomerPackageAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/customer-package' ||
        boot.rysnovaCustomerPackageAuthProbe?.authBoundary !== 'bearer-token-required') {
      fail('target API boot smoke Rysnova customer-package auth probe must preserve route contract and auth boundary');
    }
    if (boot.rysnovaCustomerPackageHappyPathStatusCode !== 200 || boot.rysnovaCustomerPackageHappyPathPassed !== true) {
      fail('target API boot smoke must prove Rysnova customer-package happy path with a customer bearer token');
    }
    const happyPath = boot.rysnovaCustomerPackageHappyPathProbe || {};
	    if (happyPath.path !== '/api/v2/rysnova-bim/projects/{projectId}/customer-package' ||
	        happyPath.authBoundary !== 'customer-bearer-token' ||
	        happyPath.envelopeSuccess !== true ||
	        happyPath.dataPresent !== true ||
	        happyPath.artifactCount !== 7 ||
	        !Array.isArray(happyPath.missingTypes) ||
        happyPath.missingTypes.length !== 0 ||
        happyPath.allCustomerVisible !== true ||
        happyPath.statusesApprovedOrShared !== true ||
        happyPath.storageIntegrityPassed !== true ||
        !Array.isArray(happyPath.leakedForbiddenFields) ||
	        happyPath.leakedForbiddenFields.length !== 0) {
	      fail('target API boot smoke Rysnova happy path must return exactly 7 customer-visible sanitized artifacts with storage integrity');
	    }
	    if (
	      boot.rysnovaArtifactDownloadAuthStatusCode !== 401 ||
	      boot.rysnovaArtifactDownloadAuthPassed !== true ||
	      boot.rysnovaArtifactDownloadAuthProbe?.path !== '/api/v2/rysnova-bim/artifacts/{artifactId}/download' ||
	      boot.rysnovaArtifactDownloadAuthProbe?.authBoundary !== 'bearer-token-required'
	    ) {
	      fail('target API boot smoke must prove Rysnova artifact download route is mounted and bearer-token protected');
	    }
	    const download = boot.rysnovaArtifactDownloadHappyPathProbe || {};
	    if (
	      boot.rysnovaArtifactDownloadHappyPathStatusCode !== 200 ||
	      boot.rysnovaArtifactDownloadHappyPathPassed !== true ||
	      download.path !== '/api/v2/rysnova-bim/artifacts/{artifactId}/download' ||
	      download.authBoundary !== 'customer-bearer-token' ||
	      download.envelopeSuccess !== true ||
	      download.dataPresent !== true ||
	      download.objectKeyPresent !== true ||
	      download.contentHashPresent !== true ||
	      download.integrityPassed !== true ||
	      download.downloadReady !== true ||
	      download.customerSafe !== true ||
	      download.accessMode !== 'object-storage-gateway' ||
	      !String(download.downloadUrl || '').includes('/api/v2/rysnova-bim/artifacts/') ||
	      !Array.isArray(download.leakedForbiddenFields) ||
	      download.leakedForbiddenFields.length !== 0
	    ) {
	      fail('target API boot smoke must prove Rysnova artifact download preparation returns a customer-safe object-storage gateway descriptor');
	    }
	    if (
	      boot.rysnovaArtifactDownloadContentAuthStatusCode !== 401 ||
	      boot.rysnovaArtifactDownloadContentAuthPassed !== true ||
	      boot.rysnovaArtifactDownloadContentAuthProbe?.path !== '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content' ||
	      boot.rysnovaArtifactDownloadContentAuthProbe?.authBoundary !== 'bearer-token-required'
	    ) {
	      fail('target API boot smoke must prove Rysnova artifact content download route is mounted and bearer-token protected');
	    }
	    const contentDownload = boot.rysnovaArtifactDownloadContentHappyPathProbe || {};
	    if (
	      boot.rysnovaArtifactDownloadContentHappyPathStatusCode !== 200 ||
	      boot.rysnovaArtifactDownloadContentHappyPathPassed !== true ||
	      contentDownload.path !== '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content' ||
	      contentDownload.authBoundary !== 'customer-bearer-token' ||
	      !(contentDownload.contentLength > 0) ||
	      !String(contentDownload.xContentSha256 || '').startsWith('sha256:') ||
	      !contentDownload.xRysnovaArtifactId ||
	      !contentDownload.xRysnovaArtifactType ||
	      contentDownload.etagPresent !== true ||
	      contentDownload.cacheControl !== 'private, max-age=0, must-revalidate' ||
	      contentDownload.bodyPresent !== true ||
	      contentDownload.notJsonEnvelope !== true
	    ) {
	      fail('target API boot smoke must prove Rysnova artifact content download returns raw customer-safe bytes with integrity headers');
	    }
	    if (
	      boot.rysnovaVisualArtifactsAuthStatusCode !== 401 ||
	      boot.rysnovaVisualArtifactsAuthPassed !== true ||
      boot.rysnovaVisualArtifactsAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts'
    ) {
      fail('target API boot smoke must prove Rysnova visual-artifacts route is mounted and bearer-token protected');
    }
    if (
      boot.rysnovaDeliverableArtifactsAuthStatusCode !== 401 ||
      boot.rysnovaDeliverableArtifactsAuthPassed !== true ||
      boot.rysnovaDeliverableArtifactsAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'
    ) {
      fail('target API boot smoke must prove Rysnova deliverable-artifacts route is mounted and bearer-token protected');
    }
    if (
      boot.rysnovaSignoffPackageAuthStatusCode !== 401 ||
      boot.rysnovaSignoffPackageAuthPassed !== true ||
      boot.rysnovaSignoffPackageAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/signoff-package'
    ) {
      fail('target API boot smoke must prove Rysnova signoff-package route is mounted and bearer-token protected');
    }
    if (
      boot.rysnovaDeepeningPackageAuthStatusCode !== 401 ||
      boot.rysnovaDeepeningPackageAuthPassed !== true ||
      boot.rysnovaDeepeningPackageAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/deepening-package'
    ) {
      fail('target API boot smoke must prove Rysnova deepening-package route is mounted and bearer-token protected');
    }
    const visual = boot.rysnovaVisualArtifactsHappyPathProbe || {};
    if (
      boot.rysnovaVisualArtifactsHappyPathStatusCode !== 201 ||
      boot.rysnovaVisualArtifactsHappyPathPassed !== true ||
      visual.path !== '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts' ||
      visual.authBoundary !== 'designer-bearer-token' ||
      visual.envelopeSuccess !== true ||
      visual.dataPresent !== true ||
      visual.artifactCount !== 3 ||
      !Array.isArray(visual.missingTypes) ||
      visual.missingTypes.length !== 0 ||
      visual.allStorageReady !== true
    ) {
      fail('target API boot smoke must generate Rysnova visual artifacts for principle diagram, 2D layout, and 3D illustration through the real Nest route');
    }
    const deliverable = boot.rysnovaDeliverableArtifactsHappyPathProbe || {};
    if (
      boot.rysnovaDeliverableArtifactsHappyPathStatusCode !== 201 ||
      boot.rysnovaDeliverableArtifactsHappyPathPassed !== true ||
      deliverable.path !== '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts' ||
      deliverable.authBoundary !== 'designer-bearer-token' ||
      deliverable.envelopeSuccess !== true ||
      deliverable.dataPresent !== true ||
      deliverable.artifactCount !== 4 ||
      !Array.isArray(deliverable.missingTypes) ||
      deliverable.missingTypes.length !== 0 ||
      deliverable.allStorageReady !== true ||
      !['pass', 'floor_adjusted'].includes(deliverable.quoteMarginGuardStatus) ||
      deliverable.standardsPassed !== true ||
      !(deliverable.quantityPipeMeters > 0)
    ) {
      fail('target API boot smoke must generate Rysnova deliverable artifacts with BOM, quantity takeoff, standards check, customer report, margin guard, and quantity evidence');
    }
    const signoff = boot.rysnovaSignoffPackageHappyPathProbe || {};
    if (
      boot.rysnovaSignoffPackageHappyPathStatusCode !== 201 ||
      boot.rysnovaSignoffPackageHappyPathPassed !== true ||
      signoff.path !== '/api/v2/rysnova-bim/projects/{projectId}/signoff-package' ||
      signoff.authBoundary !== 'designer-bearer-token' ||
      signoff.envelopeSuccess !== true ||
      signoff.dataPresent !== true ||
      signoff.approvalMode !== 'share-to-customer' ||
      signoff.status !== 'signoff-ready' ||
      signoff.artifactCount !== 7 ||
      !Array.isArray(signoff.missingTypes) ||
      signoff.missingTypes.length !== 0 ||
      signoff.visualArtifactCount !== 3 ||
      signoff.deliverableArtifactCount !== 4 ||
      signoff.approvalCount !== 7 ||
      signoff.customerPackageReady !== true ||
      signoff.handoffReady !== true ||
      signoff.downloadManifestReady !== true ||
      signoff.downloadManifestCount !== 7 ||
      signoff.downloadManifestBlockedCount !== 0 ||
      signoff.lifecycleHandoffReady !== true ||
      !['pass', 'floor_adjusted'].includes(signoff.quoteMarginGuardStatus) ||
      !(signoff.quantityPipeMeters > 0)
    ) {
      fail('target API boot smoke must prove Rysnova signoff-package directly generates the seven-artifact customer signoff package used by the frontend');
    }
    const approval = boot.rysnovaDeepeningPackageApprovalProbe || {};
    if (
      approval.path !== '/api/v2/rysnova-bim/artifacts/{artifactId}/approval' ||
      approval.artifactCount !== 7 ||
      approval.approvedCount !== 7 ||
      approval.allEnvelopeSuccess !== true ||
      approval.allShared !== true ||
      approval.allCustomerVisible !== true ||
      approval.storageIntegrityPassed !== true
    ) {
      fail('target API boot smoke must approve and share all 7 Rysnova deepening artifacts with storage integrity');
    }
    const deepening = boot.rysnovaDeepeningPackageHappyPathProbe || {};
    if (
      boot.rysnovaDeepeningPackageHappyPathStatusCode !== 200 ||
      boot.rysnovaDeepeningPackageHappyPathPassed !== true ||
      deepening.path !== '/api/v2/rysnova-bim/projects/{projectId}/deepening-package' ||
      deepening.authBoundary !== 'designer-bearer-token' ||
      deepening.envelopeSuccess !== true ||
      deepening.dataPresent !== true ||
      deepening.handoffReady !== true ||
      deepening.status !== 'handoff-ready' ||
      !Array.isArray(deepening.missingTypes) ||
      deepening.missingTypes.length !== 0 ||
      !Array.isArray(deepening.approvalMissingTypes) ||
      deepening.approvalMissingTypes.length !== 0 ||
      deepening.visualReady !== true ||
      deepening.commercialReady !== true ||
      deepening.customerSignoffReady !== true ||
      deepening.storageIntegrityTodoCount !== 0 ||
      deepening.evidenceGapsCount !== 0 ||
      deepening.nextActionsCount !== 0 ||
      deepening.customerVisibleCount !== 7 ||
      !['pass', 'floor_adjusted'].includes(deepening.quoteMarginGuardStatus) ||
      !(deepening.quantityPipeMeters > 0)
    ) {
      fail('target API boot smoke must prove Rysnova deepening-package reaches handoff-ready with no evidence gaps');
    }
    const workflowAuth = boot.rysnovaWorkflowAuthProbe || {};
    if (
      boot.rysnovaWorkflowAuthStatusCode !== 401 ||
      boot.rysnovaWorkflowAuthPassed !== true ||
      workflowAuth.path !== '/api/v2/workflow/rysnova-bim/projects/{projectId}' ||
      workflowAuth.authBoundary !== 'bearer-token-required'
    ) {
      fail('target API boot smoke must prove Rysnova workflow route is mounted and bearer-token protected');
    }
    const workflow = boot.rysnovaWorkflowHappyPathProbe || {};
    if (
      boot.rysnovaWorkflowHappyPathStatusCode !== 200 ||
      boot.rysnovaWorkflowHappyPathPassed !== true ||
      workflow.path !== '/api/v2/workflow/rysnova-bim/projects/{projectId}' ||
      workflow.authBoundary !== 'designer-bearer-token' ||
      workflow.module !== 'Rysnova' ||
      workflow.status !== 'ready-for-worker' ||
      workflow.temporalRuntimeProof !== false ||
      workflow.workerRuntimeProof !== false ||
      workflow.outboxRequired !== true ||
      workflow.iotBoundary !== 'lifecycle_handoff_only' ||
      workflow.realtimeControl !== false ||
      !Array.isArray(workflow.workflowTypes) ||
      !workflow.workflowTypes.includes('drawing-export-workflow') ||
      !workflow.workflowTypes.includes('rysnova-bim-customer-signoff-workflow') ||
      workflow.customerPackageReadyEventPresent !== true ||
      workflow.customerSignoffConfirmedEventPresent !== true ||
      workflow.artifactIntegrityEventPresent !== true ||
      workflow.lifecycleHandoffEventPresent !== true ||
      workflow.signoffTypeCount !== 7 ||
      !String(workflow.nonCompletionRule || '').includes('Temporal runtime worker evidence')
    ) {
      fail('target API boot smoke must prove Rysnova workflow facade exposes drawing export/customer signoff, outbox events, lifecycle handoff boundary, and no false Temporal worker proof');
    }
  }
  if (report.status === 'runtime-boot-smoke-failed') {
    fail(`target API runtime boot smoke failed: ${report.runtimeBootSmoke?.error || 'unknown error'}`);
  }
}

if (exists(SERVICE_ENTRY)) {
  const source = read(SERVICE_ENTRY);
  for (const token of [
    "import 'reflect-metadata'",
    "import { NestFactory } from '@nestjs/core'",
    '@nestjs/platform-fastify',
    'FastifyAdapter',
    'AppModule',
    'createApiApplication',
    "app.setGlobalPrefix('api/v2')"
  ]) {
    if (!source.includes(token)) fail(`${SERVICE_ENTRY} missing source-contract token: ${token}`);
  }
}

if (exists(SERVICE_MODULE)) {
  const source = read(SERVICE_MODULE);
  for (const token of ['@nestjs/common', '@Module', 'HealthController']) {
    if (!source.includes(token)) fail(`${SERVICE_MODULE} missing source-contract token: ${token}`);
  }
  for (const moduleName of REQUIRED_BACKEND_MODULES) {
    const className = classNameForModule(moduleName);
    if (!source.includes(`${className}Module`)) fail(`${SERVICE_MODULE} missing backend module import: ${className}Module`);
  }
}

if (exists(HEALTH_CONTROLLER)) {
  const source = read(HEALTH_CONTROLLER);
  for (const token of ['@Controller', '@Get', 'apiModuleBoundary', 'lifecycle_handoff_only', 'NestJS', 'Fastify']) {
    if (!source.includes(token)) fail(`${HEALTH_CONTROLLER} missing source-contract token: ${token}`);
  }
}

if (exists('services/api/src/modules/rysnova-bim/rysnova-bim.module.ts')) {
  const source = read('services/api/src/modules/rysnova-bim/rysnova-bim.module.ts');
  const requiredTokens = [
    'RysnovaBoundaryController',
    'RysnovaBoundaryService',
    'RysnovaService',
    'bootSmokeRepositoryProvider(RysnovaArtifactEntity)',
    "getApiModuleBoundary('rysnova-bim')",
    "@Controller('rysnova-bim')",
    "@Get('boundary')"
  ];
  for (const token of requiredTokens) {
    if (!source.includes(token)) fail(`services/api/src/modules/rysnova-bim/rysnova-bim.module.ts missing Rysnova runtime boundary token: ${token}`);
  }
  const controllersMatch = source.match(/controllers:\s*\[([^\]]*)\]/);
  if (!controllersMatch) {
    fail(`services/api/src/modules/rysnova-bim/rysnova-bim.module.ts missing controllers array`);
  } else {
    const controllersList = controllersMatch[1];
    for (const requiredController of ['RysnovaController', 'RysnovaBoundaryController', 'BimController', 'BimPublicController', 'DesignSyncController']) {
      if (!controllersList.includes(requiredController)) {
        fail(`services/api/src/modules/rysnova-bim/rysnova-bim.module.ts controllers array missing ${requiredController}`);
      }
    }
  }
}

if (exists('services/api/src/modules/rysnova-bim/rysnova-bim.controller.ts')) {
  const source = read('services/api/src/modules/rysnova-bim/rysnova-bim.controller.ts');
	  for (const token of [
	    '@UseGuards(AuthGuard)',
	    "@Get('artifacts/:artifactId/download')",
	    "@Get('artifacts/:artifactId/download/content')",
	    'downloadContent',
	    'prepareDownload',
	    "@Get('projects/:projectId/customer-package')",
	    'buildCustomerPackage',
	    'private envelope(data: unknown)',
	    'return { success: true, data }',
	    'this.envelope(await this.svc'
  ]) {
    if (!source.includes(token)) fail(`services/api/src/modules/rysnova-bim/rysnova-bim.controller.ts missing customer-package auth boundary token: ${token}`);
  }
}

if (exists('services/api/src/modules/rysnova-bim/rysnova-bim.service.ts')) {
  const source = read('services/api/src/modules/rysnova-bim/rysnova-bim.service.ts');
  for (const token of [
	    'TARGET_API_BOOT_SMOKE',
	    'createRysnovaBootSmokeArtifactService',
	    "customerId: user['customerId']",
	    "role: user['role']",
	    'prepareArtifactDownload',
	    'downloadArtifactContent'
	  ]) {
    if (!source.includes(token)) fail(`services/api/src/modules/rysnova-bim/rysnova-bim.service.ts missing boot-smoke or customer scope token: ${token}`);
  }
}

if (exists('services/api/src/modules/rysnova-bim/rysnova-bim.boot-smoke.ts')) {
  const source = read('services/api/src/modules/rysnova-bim/rysnova-bim.boot-smoke.ts');
  for (const token of [
    'RYSNOVA_BOOT_SMOKE_REQUIRED_TYPES',
    'principle-diagram',
    'construction-drawing',
    'bim-model',
    'bom',
    'quantity-takeoff',
    'standards-check',
    'customer-report',
    'MemoryArtifactStorageAdapter',
    'shareToCustomer: true'
  ]) {
    if (!source.includes(token)) fail(`services/api/src/modules/rysnova-bim/rysnova-bim.boot-smoke.ts missing customer package seed token: ${token}`);
  }
}

if (exists('evidence/release-evidence.json')) {
  const release = readJson('evidence/release-evidence.json');
  const record = release.requiredEvidence?.targetApiBootSmoke;
  if (!record) {
    fail('release evidence missing targetApiBootSmoke');
  } else if (exists(REPORT_JSON)) {
    const report = readJson(REPORT_JSON);
    if (record.command !== 'npm run release:target-api:boot-smoke') fail('targetApiBootSmoke release command mismatch');
    if (record.status !== report.status) fail('targetApiBootSmoke release status must match report');
    if (record.path !== REPORT_JSON) fail(`targetApiBootSmoke release path must be ${REPORT_JSON}`);
    if (record.summaryPath !== REPORT_MD) fail(`targetApiBootSmoke release summaryPath must be ${REPORT_MD}`);
    if (record.serviceEntry !== SERVICE_ENTRY) fail(`targetApiBootSmoke serviceEntry must be ${SERVICE_ENTRY}`);
    if (record.serviceTsconfig !== SERVICE_TSCONFIG) fail(`targetApiBootSmoke serviceTsconfig must be ${SERVICE_TSCONFIG}`);
    if (record.bootProofEligible !== report.bootProofEligible) fail('targetApiBootSmoke bootProofEligible must match report');
    if (record.nestFastifyBootProof !== report.nestFastifyBootProof) fail('targetApiBootSmoke nestFastifyBootProof must match report');
    if (record.finalLaunchArchitectureProof !== false) fail('targetApiBootSmoke must not claim final launch architecture proof');
    if (JSON.stringify(record.missingLockfile || []) !== JSON.stringify(report.missingLockfile || [])) {
      fail('targetApiBootSmoke missingLockfile must match report');
    }
    if (JSON.stringify(record.runtimeBootSmoke || {}) !== JSON.stringify({
      enabled: report.runtimeBootSmoke?.enabled === true,
      mode: report.runtimeBootSmoke?.mode || null,
      passed: report.runtimeBootSmoke?.passed === true,
      appCreated: report.runtimeBootSmoke?.appCreated === true,
      appInitialized: report.runtimeBootSmoke?.appInitialized === true,
      adapterType: report.runtimeBootSmoke?.adapterType || null,
      healthRouteStatusCode: report.runtimeBootSmoke?.healthRouteStatusCode || null,
      healthRoutePassed: report.runtimeBootSmoke?.healthRoutePassed === true,
      rysnovaBoundaryRouteStatusCode: report.runtimeBootSmoke?.rysnovaBoundaryRouteStatusCode || null,
      rysnovaBoundaryRoutePassed: report.runtimeBootSmoke?.rysnovaBoundaryRoutePassed === true,
      rysnovaCustomerPackageAuthStatusCode: report.runtimeBootSmoke?.rysnovaCustomerPackageAuthStatusCode || null,
      rysnovaCustomerPackageAuthPassed: report.runtimeBootSmoke?.rysnovaCustomerPackageAuthPassed === true,
      rysnovaCustomerPackageHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaCustomerPackageHappyPathStatusCode || null,
      rysnovaCustomerPackageHappyPathPassed: report.runtimeBootSmoke?.rysnovaCustomerPackageHappyPathPassed === true,
      rysnovaArtifactDownloadAuthStatusCode: report.runtimeBootSmoke?.rysnovaArtifactDownloadAuthStatusCode || null,
      rysnovaArtifactDownloadAuthPassed: report.runtimeBootSmoke?.rysnovaArtifactDownloadAuthPassed === true,
      rysnovaArtifactDownloadHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaArtifactDownloadHappyPathStatusCode || null,
      rysnovaArtifactDownloadHappyPathPassed: report.runtimeBootSmoke?.rysnovaArtifactDownloadHappyPathPassed === true,
      rysnovaArtifactDownloadContentAuthStatusCode: report.runtimeBootSmoke?.rysnovaArtifactDownloadContentAuthStatusCode || null,
      rysnovaArtifactDownloadContentAuthPassed: report.runtimeBootSmoke?.rysnovaArtifactDownloadContentAuthPassed === true,
      rysnovaArtifactDownloadContentHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaArtifactDownloadContentHappyPathStatusCode || null,
      rysnovaArtifactDownloadContentHappyPathPassed: report.runtimeBootSmoke?.rysnovaArtifactDownloadContentHappyPathPassed === true,
      rysnovaVisualArtifactsAuthStatusCode: report.runtimeBootSmoke?.rysnovaVisualArtifactsAuthStatusCode || null,
      rysnovaVisualArtifactsAuthPassed: report.runtimeBootSmoke?.rysnovaVisualArtifactsAuthPassed === true,
      rysnovaDeliverableArtifactsAuthStatusCode: report.runtimeBootSmoke?.rysnovaDeliverableArtifactsAuthStatusCode || null,
      rysnovaDeliverableArtifactsAuthPassed: report.runtimeBootSmoke?.rysnovaDeliverableArtifactsAuthPassed === true,
      rysnovaSignoffPackageAuthStatusCode: report.runtimeBootSmoke?.rysnovaSignoffPackageAuthStatusCode || null,
      rysnovaSignoffPackageAuthPassed: report.runtimeBootSmoke?.rysnovaSignoffPackageAuthPassed === true,
      rysnovaDeepeningPackageAuthStatusCode: report.runtimeBootSmoke?.rysnovaDeepeningPackageAuthStatusCode || null,
      rysnovaDeepeningPackageAuthPassed: report.runtimeBootSmoke?.rysnovaDeepeningPackageAuthPassed === true,
      rysnovaVisualArtifactsHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaVisualArtifactsHappyPathStatusCode || null,
      rysnovaVisualArtifactsHappyPathPassed: report.runtimeBootSmoke?.rysnovaVisualArtifactsHappyPathPassed === true,
      rysnovaDeliverableArtifactsHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaDeliverableArtifactsHappyPathStatusCode || null,
      rysnovaDeliverableArtifactsHappyPathPassed: report.runtimeBootSmoke?.rysnovaDeliverableArtifactsHappyPathPassed === true,
      rysnovaSignoffPackageHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaSignoffPackageHappyPathStatusCode || null,
      rysnovaSignoffPackageHappyPathPassed: report.runtimeBootSmoke?.rysnovaSignoffPackageHappyPathPassed === true,
      rysnovaDeepeningPackageHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaDeepeningPackageHappyPathStatusCode || null,
      rysnovaDeepeningPackageHappyPathPassed: report.runtimeBootSmoke?.rysnovaDeepeningPackageHappyPathPassed === true,
      rysnovaWorkflowAuthStatusCode: report.runtimeBootSmoke?.rysnovaWorkflowAuthStatusCode || null,
      rysnovaWorkflowAuthPassed: report.runtimeBootSmoke?.rysnovaWorkflowAuthPassed === true,
      rysnovaWorkflowHappyPathStatusCode: report.runtimeBootSmoke?.rysnovaWorkflowHappyPathStatusCode || null,
      rysnovaWorkflowHappyPathPassed: report.runtimeBootSmoke?.rysnovaWorkflowHappyPathPassed === true,
      postgresRuntimeProof: report.runtimeBootSmoke?.postgresRuntimeProof === true
    })) {
      fail('targetApiBootSmoke runtimeBootSmoke release evidence must match report summary');
    }
  }
}

if (exists(SERVICE_TSCONFIG)) {
  const tsconfig = read(SERVICE_TSCONFIG);
  for (const token of ['experimentalDecorators', 'emitDecoratorMetadata', '"module": "CommonJS"']) {
    if (!tsconfig.includes(token)) fail(`${SERVICE_TSCONFIG} missing NestJS runtime tsconfig token: ${token}`);
  }
}

for (const sourcePath of [
  'services/api/src/modules/boot-smoke.ts',
  SERVICE_MODULE,
  'services/api/src/modules/auth/auth.module.ts',
  'services/api/src/modules/crm/crm.module.ts',
  'services/api/src/modules/quote/quote.module.ts',
  'services/api/src/modules/tenant/tenant.module.ts'
]) {
  if (!exists(sourcePath)) {
    fail(`missing target API boot-smoke source: ${sourcePath}`);
    continue;
  }
}
if (exists('services/api/src/modules/boot-smoke.ts')) {
  const source = read('services/api/src/modules/boot-smoke.ts');
  for (const token of ['TARGET_API_BOOT_SMOKE', 'bootSmokeRepositoryProvider', 'getRepositoryToken']) {
    if (!source.includes(token)) fail(`services/api/src/modules/boot-smoke.ts missing token: ${token}`);
  }
}
if (exists(SERVICE_MODULE) && !read(SERVICE_MODULE).includes('TARGET_API_BOOT_SMOKE ? [] : [')) {
  fail(`${SERVICE_MODULE} must skip TypeOrmModule.forRoot only under TARGET_API_BOOT_SMOKE`);
}

console.log(`Target API Boot Smoke Check: failures = ${failures.length}, warnings = ${warnings.length}`);
for (const warning of warnings) console.warn(`- ${warning}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
