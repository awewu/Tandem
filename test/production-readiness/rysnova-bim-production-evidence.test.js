const fs = require('fs');
const path = require('path');

const {
  RYSNOVA_RUNTIME_BOUNDARY
} = require('../../server/routes/rysnova-bim-runtime.routes');
const {
  RYSNOVA_PREVIEW_RUNTIME_BOUNDARY
} = require('../../server/routes/rysnova-bim-simple');

const ROOT = path.join(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const REQUIRED_SIGNOFF_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report'
];
const BROWSER_VISUAL_EXTERNAL_COMMAND = 'VISUAL_BASE_URL=<staging-or-browser-capable-url> VISUAL_BROWSER_WS_ENDPOINT=<cdp-endpoint-optional> npm run guard:browser-visual';
const OBJECT_STORAGE_EXTERNAL_COMMAND = 'OBJECT_STORAGE_EXTERNAL_PROVIDER=<s3|oss|minio> OBJECT_STORAGE_ENDPOINT=<endpoint> OBJECT_STORAGE_BUCKET=<bucket> OBJECT_STORAGE_ACCESS_KEY_ID=<key> OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret> npm run release:rysnova-bim-storage:smoke';

describe('Rysnova production evidence aggregate', () => {
  test('v2 artifact and customer-package trunk is contractually stronger than the compatibility runtime', () => {
    const release = readJson('evidence/release-evidence.json');
    const openapi = readJson('contracts/openapi/rhautt-nexus-v2.openapi.json');
    const runtimeSource = read('server/routes/rysnova-bim-runtime.routes.js');
    const previewSource = read('server/routes/rysnova-bim-simple.js');
    const runtimeEvidence = release.requiredEvidence.rysnovaBimRuntimeBoundary;
    const previewEvidence = release.requiredEvidence.rysnovaBimPreviewCompatibilityBoundary;
    const aggregateEvidence = release.requiredEvidence.rysnovaBimProductionEvidenceAggregate;

    expect(release.status).toBe('not-production-complete');
    expect(aggregateEvidence).toEqual(expect.objectContaining({
      command: 'npx jest test/production-readiness/rysnova-bim-production-evidence.test.js --runInBand',
      status: 'passed-current-run',
      path: 'test/production-readiness/rysnova-bim-production-evidence.test.js',
      finalLaunchObjectStorageProof: false,
      finalLaunchCapacityProof: false,
      finalLaunchRysnovaProof: false
    }));
    expect(aggregateEvidence.scope).toEqual(expect.arrayContaining([
      'OpenAPI v2 Rysnova artifact/customer-package/download trunk',
      'OpenAPI v2 Rysnova artifact content download trunk',
      'generated client binary download method',
      'target Nest/Fastify artifact content download boot-smoke',
      'runtime boundary cannot replace production artifact trunk',
      'preview compatibility runtime cannot replace production artifact trunk',
      'capacity in-process Rysnova deliverable/signoff/deepening/customer-package/content-download scenarios',
      'full 7-artifact local signoff package',
      'non-final launch truth for object storage and staging capacity'
    ]));
    expect(aggregateEvidence.requiredArtifactTypes).toEqual(expect.arrayContaining(REQUIRED_SIGNOFF_TYPES));
    expect(aggregateEvidence).toEqual(expect.objectContaining({
      contentDownloadApi: '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
      contentDownloadOperationId: 'downloadRysnovaArtifactContent',
      contentDownloadClientMethod: 'downloadRysnovaArtifactContent',
      contentDownloadResponseMode: 'raw-response-with-integrity-headers',
      contentDownloadBootSmoke: true
    }));
    expect(runtimeEvidence).toEqual(expect.objectContaining({
      command: 'npx jest test/production-readiness/rysnova-bim-runtime-routes.test.js --runInBand',
      status: 'passed-current-run',
      path: 'server/routes/rysnova-bim-runtime.routes.js',
      testPath: 'test/production-readiness/rysnova-bim-runtime-routes.test.js',
      routePath: '/api/rysnova-bim/runtime-boundary',
      surface: 'rysnova-bim-compatibility-runtime',
      compatibilityStatus: 'compatibility-preserved-not-production-artifact-trunk',
      productionArtifactApi: '/api/v2/rysnova-bim',
      deliverableArtifactsApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      signoffPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      customerPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      storageBoundary: 'artifact-contract-and-object-storage-required-for-production'
    }));
    expect(runtimeEvidence.migrationRule).toContain('must not replace v2 Rysnova artifact');
    expect(runtimeEvidence.migrationRule).toContain('signoff-package');
    expect(runtimeEvidence.migrationRule).toContain('customer-package');
    expect(runtimeEvidence.migrationRule).toContain('object-storage evidence');
    expect(previewEvidence).toEqual(expect.objectContaining({
      command: 'npx jest test/production-readiness/rysnova-bim-preview-compatibility.test.js --runInBand',
      status: 'passed-current-run',
      path: 'server/routes/rysnova-bim-simple.js',
      testPath: 'test/production-readiness/rysnova-bim-preview-compatibility.test.js',
      surface: 'rysnova-bim-3d-preview-compatibility-runtime',
      compatibilityStatus: 'preview-compatibility-not-production-artifact-trunk',
      productionArtifactApi: '/api/v2/rysnova-bim',
      deliverableArtifactsApi: '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      signoffPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      customerPackageApi: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      storageBoundary: 'artifact-contract-and-object-storage-required-for-production'
    }));
    expect(previewEvidence.routePaths).toEqual(expect.arrayContaining([
      '/api/rysnova-bim/health',
      '/api/rysnova-bim/quick-design',
      '/api/rysnova-bim/complete-design',
      '/api/rysnova-bim/load-calculation',
      '/api/rysnova-bim/export'
    ]));
    expect(previewEvidence.frontendAuthGuard).toContain('employee/designer token');
    expect(previewEvidence.migrationRule).toContain('preview compatibility only');
    expect(previewEvidence.migrationRule).toContain('production Rysnova deliverables must use v2 artifact');
    expect(previewEvidence.migrationRule).toContain('signoff-package');
    expect(RYSNOVA_RUNTIME_BOUNDARY).toEqual(expect.objectContaining({
      surface: runtimeEvidence.surface,
      status: runtimeEvidence.compatibilityStatus,
      productionArtifactApi: runtimeEvidence.productionArtifactApi,
      deliverableArtifactsApi: runtimeEvidence.deliverableArtifactsApi,
      signoffPackageApi: runtimeEvidence.signoffPackageApi,
      customerPackageApi: runtimeEvidence.customerPackageApi,
      storageBoundary: runtimeEvidence.storageBoundary
    }));
    expect(RYSNOVA_PREVIEW_RUNTIME_BOUNDARY).toEqual(expect.objectContaining({
      surface: previewEvidence.surface,
      status: previewEvidence.compatibilityStatus,
      productionArtifactApi: previewEvidence.productionArtifactApi,
      deliverableArtifactsApi: previewEvidence.deliverableArtifactsApi,
      signoffPackageApi: previewEvidence.signoffPackageApi,
      customerPackageApi: previewEvidence.customerPackageApi,
      storageBoundary: previewEvidence.storageBoundary
    }));

    for (const routePath of [
      '/api/v2/rysnova-bim/artifacts',
      '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts',
      '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff',
      '/api/v2/rysnova-bim/projects/{projectId}/deepening-package',
      '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      '/api/v2/rysnova-bim/artifacts/{artifactId}/download',
      '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content'
    ]) {
      expect(openapi.paths[routePath]).toBeDefined();
    }
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/customer-package'].get.operationId)
      .toBe('buildRysnovaCustomerPackage');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'].post.operationId)
      .toBe('generateRysnovaDeliverableArtifacts');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/customer-signoff'].post.operationId)
      .toBe('confirmRysnovaCustomerSignoff');
    expect(openapi.paths['/api/v2/rysnova-bim/projects/{projectId}/deepening-package'].get.operationId)
      .toBe('buildRysnovaDeepeningPackage');
    expect(openapi.paths['/api/v2/rysnova-bim/artifacts/{artifactId}/download'].get.operationId)
      .toBe('prepareRysnovaArtifactDownload');
    expect(openapi.paths['/api/v2/rysnova-bim/artifacts/{artifactId}/download/content'].get.operationId)
      .toBe('downloadRysnovaArtifactContent');
    expect(openapi.components.responses.RysnovaArtifactContentSuccess.content['application/octet-stream'].schema)
      .toEqual({ type: 'string', format: 'binary' });
    expect(openapi.components.schemas.RysnovaArtifactDownload.additionalProperties).toBe(false);
    expect(openapi.components.schemas.RysnovaArtifactDownload.properties.customerSafe.const).toBe(true);
    expect(openapi.components.schemas.RysnovaArtifactDownload.properties.downloadReady.const).toBe(true);
    const generatedClient = read('packages/generated-client/src/rhauttNexusClient.ts');
    expect(generatedClient).toContain('private async requestBlob');
    expect(generatedClient).toContain('async confirmRysnovaCustomerSignoff<');
    expect(generatedClient).toContain('async downloadRysnovaArtifactContent(params: ClientParams = {}): Promise<Response>');
    expect(generatedClient).toContain('return this.requestBlob("GET", "/api/v2/rysnova-bim/artifacts/{artifactId}/download/content", params);');
    const targetApiBootSmoke = readJson('evidence/architecture/target-api-boot-smoke.json');
    expect(targetApiBootSmoke.runtimeBootSmoke.rysnovaBimArtifactDownloadContentHappyPathProbe).toEqual(expect.objectContaining({
      path: '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
      authBoundary: 'customer-bearer-token',
      statusCode: 200,
      etagPresent: true,
      bodyPresent: true,
      notJsonEnvelope: true
    }));
    expect(targetApiBootSmoke.runtimeBootSmoke.rysnovaBimArtifactDownloadContentHappyPathProbe.xContentSha256).toMatch(/^sha256:/);

    const artifactTypes = openapi.components.schemas.RysnovaArtifactType.enum;
    const customerPackageRequiredTypes = openapi.components.schemas.RysnovaCustomerPackage.properties.requiredTypes;
    expect(artifactTypes).toEqual(expect.arrayContaining(REQUIRED_SIGNOFF_TYPES));
    expect(customerPackageRequiredTypes).toEqual(expect.objectContaining({
      minItems: 7,
      maxItems: 7,
      uniqueItems: true,
      'x-rysnova-bim-signoff-required-types': REQUIRED_SIGNOFF_TYPES
    }));
    expect(customerPackageRequiredTypes.allOf.map(item => item.contains.const))
      .toEqual(REQUIRED_SIGNOFF_TYPES);
    expect(runtimeSource).toContain('/api/rysnova-bim/runtime-boundary');
    expect(runtimeSource).toContain('runtimeBoundary');
    expect(previewSource).toContain('RYSNOVA_PREVIEW_RUNTIME_BOUNDARY');
    expect(previewSource).toContain('not-produced-by-preview-runtime');
    expect(previewSource).toContain('/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts');
    expect(previewSource).toContain('/api/v2/rysnova-bim/projects/{projectId}/signoff-package');
  });

  test('full local signoff package is proven while final launch blockers remain explicit', () => {
    const release = readJson('evidence/release-evidence.json').requiredEvidence;
    const capacity = readJson('audit/capacity-inprocess-report.json');
	    const networkCapacity = readJson('audit/capacity-load-report.json');
	    const storage = readJson('evidence/object-storage/rysnova-bim-object-storage-smoke.json');
	    const preflight = readJson('evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json');
	    const externalProofRun = readJson('evidence/rysnova-bim/rysnova-bim-external-proof-run.json');
	    const launchRunbook = readJson('evidence/rysnova-bim/rysnova-bim-launch-runbook.json');
	    const readiness = readJson('evidence/rysnova-bim/rysnova-bim-final-readiness.json');
	    const browserVisual = readJson('audit/browser-visual-acceptance-report.json');
	    const browserVisualSource = read('scripts/agent-guards/browser-visual-acceptance.js');
	    const externalProofRunnerSource = read('scripts/release/rysnova-bim-external-proof-runner.js');
	    const preflightSource = read('scripts/release/rysnova-bim-external-proof-preflight.js');
	    const externalProofValidationSource = read('scripts/release/external-proof-validation.js');

    expect(release.capacityInprocess).toEqual(expect.objectContaining({
      status: 'passed-current-run',
      scenarios: 14,
      passed: 14,
      failed: 0,
      productionLike: false,
      replacesNetworkLoadTest: false
    }));
    expect(capacity.summary).toEqual(expect.objectContaining({
      scenarios: 14,
      passed: 14,
      failed: 0,
      productionLike: false,
      replacesNetworkLoadTest: false
    }));

    for (const id of [
      'rysnova-bim-deliverable-artifacts',
      'rysnova-bim-signoff-package',
      'rysnova-bim-customer-signoff',
      'rysnova-bim-deepening-package',
      'rysnova-bim-customer-package',
      'rysnova-bim-artifact-content-download'
    ]) {
      const scenario = capacity.results.find(item => item.id === id);
      expect(scenario).toEqual(expect.objectContaining({
        passed: true,
        errorRate: 0
      }));
    }

    expect(release.stagingNetworkCapacity).toEqual(expect.objectContaining({
      status: 'preflight-failed',
      finalLaunchCapacityProof: false,
      evidenceMode: 'local-network'
    }));
    expect(networkCapacity.summary.finalLaunchCapacityProof).toBe(false);
    expect(networkCapacity.summary.preflightFailed).toBe(true);
    expect(browserVisual.finalLaunchVisualProof).toBe(false);
    expect(release.browserVisual).toEqual(expect.objectContaining({
      status: 'preflight-failed-browser-launch',
      finalLaunchVisualProof: false
    }));
    expect(browserVisualSource).toContain('finalLaunchVisualProofFromReport');
    expect(browserVisualSource).toContain("report?.executionMode !== 'local-static-fixture'");
    expect(browserVisualSource).toContain("report?.baseUrl !== 'local-static://public'");

    expect(storage.result).toBe('passed');
    expect(storage.finalLaunchObjectStorageProof).toBe(false);
    expect(storage.adapterCapabilities).toEqual(expect.objectContaining({
      adapterType: 'local-filesystem',
      externalRoundTrip: false,
      finalLaunchEligible: false
    }));
    expect(storage.servicePath).toEqual(expect.objectContaining({
      generatedArtifactCount: 7,
      sharedArtifactCount: 7,
      customerPackageCount: 7,
      customerPackageSanitized: true,
      customerVisibleSummarySanitized: true,
      deepeningHandoffReady: true,
      visualReadinessReady: true,
      commercialReadinessReady: true,
      customerSignoffReady: true
    }));
    expect(storage.servicePath.customerPackageReadiness).toEqual(expect.objectContaining({
      packageReady: true,
      visualReady: true,
      commercialReady: true,
      standardsPassed: true,
      lifecycleHandoffReady: true,
      customerSignoffReady: true,
      objectStorageIntegrityReady: true
    }));
    expect(storage.servicePath.customerPackageQuoteSummaryPresent).toBe(true);
    expect(storage.servicePath.customerPackageLifecycleHandoff).toEqual(expect.objectContaining({
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      targetPlatform: 'external-iot-lifecycle-platform',
      assetCount: 5,
      assetsHaveIotBinding: true
    }));
    expect(storage.servicePath.customerPackageArtifactTypes).toEqual(expect.arrayContaining(REQUIRED_SIGNOFF_TYPES));
    expect(release.rysnovaBimObjectStorage).toEqual(expect.objectContaining({
      status: 'local-smoke-only',
      finalLaunchObjectStorageProof: false
    }));

    expect(readiness).toEqual(expect.objectContaining({
      module: 'Rysnova',
      command: 'npm run release:rysnova-bim-final-readiness',
      status: 'blocked-external-proof-required',
      finalLaunchRysnovaProof: false,
      nonCompletionRule: expect.stringContaining('cannot be called production-complete')
    }));
    expect(preflight).toEqual(expect.objectContaining({
      module: 'Rysnova',
      command: 'npm run release:rysnova-bim-external-proof-preflight',
      status: 'missing-external-proof-configuration',
      readyForExternalProofRun: false,
      nonCompletionRule: expect.stringContaining('never proves Rysnova production completion')
    }));
    expect(preflight.summary).toEqual(expect.objectContaining({
      checks: 6,
      ready: 0,
      blocked: 6
    }));
    expect(preflight.checks.map(item => item.id)).toEqual(expect.arrayContaining([
      'browser-visual',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime'
    ]));
    for (const check of preflight.checks) {
      expect(check).toEqual(expect.objectContaining({
        invalidEnv: expect.any(Array),
        semanticFailures: expect.any(Array)
      }));
    }
    for (const blocker of preflight.blockers) {
      expect(blocker).toEqual(expect.objectContaining({
        invalidEnv: expect.any(Array),
        semanticFailures: expect.any(Array)
      }));
    }
    for (const token of [
      'semanticFailures',
      'invalidEnv',
      "require('./external-proof-validation')",
      'validateCapacityEnv',
      'validateObjectStorageEnv',
      'validatePostgresStagingEnv',
      'validateRedisRuntimeEnv',
      'validateTemporalRuntimeEnv'
    ]) {
      expect(preflightSource).toContain(token);
    }
    for (const token of [
      'NODE_ENV must be production',
      'must be a non-local production/staging URL',
      'must not be a placeholder/example value',
      'OBJECT_STORAGE_EXTERNAL_PROVIDER',
      's3-compatible',
      'TEMPORAL_WORKER_PROOF_TENANT_ID',
      'TEMPORAL_WORKER_PROOF_PROJECT_ID'
    ]) {
      expect(externalProofValidationSource).toContain(token);
    }
    expect(preflight.blockers.map(item => item.id).sort()).toEqual([
      'browser-visual',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'staging-capacity',
      'temporal-runtime'
    ]);
	    expect(release.rysnovaBimExternalProofPreflight).toEqual(expect.objectContaining({
	      command: 'npm run release:rysnova-bim-external-proof-preflight',
      status: preflight.status,
      path: 'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json',
      summaryPath: 'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.md',
      readyForExternalProofRun: false,
      checks: 6,
      ready: 0,
      blocked: 6,
	      blockers: preflight.blockers.map(item => item.id)
	    }));
	    expect(externalProofRun).toEqual(expect.objectContaining({
	      module: 'Rysnova',
	      command: 'npm run release:rysnova-bim-external-proof',
	      status: 'missing-external-proof-configuration',
	      finalLaunchRysnovaProof: false,
	      readyForExternalProofRun: false,
	      preflightStatus: 'missing-external-proof-configuration',
	      nonCompletionRule: expect.stringContaining('does not claim Rysnova production completion')
	    }));
	    expect(externalProofRun.steps).toEqual([
	      expect.objectContaining({
	        id: 'preflight',
	        npmScript: 'release:rysnova-bim-external-proof-preflight',
	        passed: true,
	        exitCode: 0
	      })
	    ]);
	    expect(externalProofRun.plannedSteps.map(item => item.id)).toEqual([
	      'preflight',
	      'browser-visual',
	      'staging-capacity',
	      'external-object-storage',
	      'postgres-staging',
	      'redis-runtime',
	      'temporal-runtime',
	      'final-readiness',
	      'guard-all'
	    ]);
	    expect(externalProofRun.blockers.map(item => item.id).sort()).toEqual([
	      'browser-visual',
	      'external-object-storage',
	      'postgres-staging',
	      'redis-runtime',
	      'staging-capacity',
	      'temporal-runtime'
	    ]);
	    expect(externalProofRun.requiredExternalProofCommands).toEqual(expect.arrayContaining([
	      'npm run release:rysnova-bim-external-proof-preflight',
	      BROWSER_VISUAL_EXTERNAL_COMMAND,
	      'NODE_ENV=production MONGODB_URI=<staging-mongodb-uri> CAPACITY_BASE_URL=<staging-url> npm run perf:capacity',
	      OBJECT_STORAGE_EXTERNAL_COMMAND,
	      'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke',
	      'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke',
	      'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke',
	      'npm run release:rysnova-bim-final-readiness',
	      'npm run guard:all'
	    ]));
	    expect(release.rysnovaBimExternalProofRun).toEqual(expect.objectContaining({
	      command: 'npm run release:rysnova-bim-external-proof',
	      status: externalProofRun.status,
	      path: 'evidence/rysnova-bim/rysnova-bim-external-proof-run.json',
	      summaryPath: 'evidence/rysnova-bim/rysnova-bim-external-proof-run.md',
	      readyForExternalProofRun: false,
	      finalLaunchRysnovaProof: false,
	      preflightStatus: externalProofRun.preflightStatus,
	      steps: externalProofRun.steps.length,
	      passed: 0,
	      failed: 0,
	      blockers: externalProofRun.blockers.map(item => item.id),
	      failedSteps: []
	    }));
    expect(externalProofRunnerSource).toContain('OBJECT_STORAGE_EXTERNAL_PROOF_COMMAND');
    expect(externalProofRunnerSource).toContain(OBJECT_STORAGE_EXTERNAL_COMMAND);
    expect(externalProofRun.requiredExternalProofCommands).not.toEqual(expect.arrayContaining([
      expect.stringContaining('... npm run release:rysnova-bim-storage:smoke')
    ]));
    expect(launchRunbook).toEqual(expect.objectContaining({
      module: 'Rysnova',
      command: 'npm run release:rysnova-bim-launch-runbook',
      status: 'blocked-external-proof-required',
      finalLaunchRysnovaProof: false,
      nonCompletionRule: expect.stringContaining('must never be used as final production proof by itself')
    }));
    expect(launchRunbook.summary).toEqual(expect.objectContaining({
      gates: 8,
      ready: 0,
      blocked: 8,
      preflightReady: false
    }));
    expect(launchRunbook.gates.map(item => item.id)).toEqual([
      'browser-visual-current-run',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime',
      'final-readiness',
      'guard-all'
    ]);
    expect(launchRunbook.runOrder).toEqual(expect.arrayContaining([
      'npm run release:rysnova-bim-launch-runbook',
      'npm run release:rysnova-bim-external-proof-preflight',
      'npm run release:rysnova-bim-external-proof',
      'npm run release:rysnova-bim-final-readiness',
      'npm run guard:all'
    ]));
    expect(release.rysnovaBimLaunchRunbook).toEqual(expect.objectContaining({
      command: 'npm run release:rysnova-bim-launch-runbook',
      status: launchRunbook.status,
      path: 'evidence/rysnova-bim/rysnova-bim-launch-runbook.json',
      summaryPath: 'evidence/rysnova-bim/rysnova-bim-launch-runbook.md',
      finalLaunchRysnovaProof: false,
      gates: 8,
      ready: 0,
      blocked: 8,
      externalBlockers: launchRunbook.externalBlockers
    }));
    expect(readiness.summary).toEqual(expect.objectContaining({
	      gates: 11,
	      passed: 4,
	      blocked: 7,
	      sourceEvidence: 10,
	      sourceEvidenceConsistent: true
	    }));
    expect(readiness.externalProofRequirements['external-object-storage']).toEqual(expect.objectContaining({
      owner: 'rysnova-bim-artifact-platform',
      evidencePath: 'evidence/object-storage/rysnova-bim-object-storage-smoke.json',
      requiredStatus: 'passed-external-current-run',
      finalProofField: 'finalLaunchObjectStorageProof',
      acceptanceCriteria: expect.arrayContaining([
        expect.stringContaining('External S3/OSS/MinIO-compatible adapter')
      ]),
      cannotBeReplacedBy: expect.arrayContaining([
        'local filesystem adapter'
      ])
    }));
    const objectStorageBlocker = readiness.blockers.find(item => item.id === 'external-object-storage');
    expect(objectStorageBlocker.proofRequirement).toEqual(expect.objectContaining({
      owner: 'rysnova-bim-artifact-platform',
      finalProofField: 'finalLaunchObjectStorageProof',
      failureImpact: expect.stringContaining('durable launch artifacts')
    }));
    expect(readiness.sourceEvidence.map(item => item.path)).toEqual(expect.arrayContaining([
      'audit/browser-visual-acceptance-report.json',
      'audit/capacity-inprocess-report.json',
      'audit/capacity-load-report.json',
	      'evidence/object-storage/rysnova-bim-object-storage-smoke.json',
	      'evidence/database/postgres-staging-smoke-report.json',
	      'evidence/cache/redis-runtime-smoke.json',
	      'evidence/workflow/temporal-runtime-smoke.json',
	      'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json',
	      'evidence/rysnova-bim/rysnova-bim-external-proof-run.json',
	      'evidence/rysnova-bim/rysnova-bim-launch-runbook.json'
	    ]));
    for (const source of readiness.sourceEvidence) {
      expect(source).toEqual(expect.objectContaining({
        present: true,
        statusAccepted: true,
        finalProofMatches: true
      }));
      expect(typeof source.sha256).toBe('string');
      expect(source.sha256.length).toBe(64);
    }
    expect(readiness.gates.map(gate => gate.id)).toEqual(expect.arrayContaining([
      'rysnova-bim-v2-aggregate',
      'rysnova-bim-inprocess-capacity',
      'rysnova-bim-seven-artifact-package',
      'rysnova-bim-launch-runbook',
      'browser-visual-current-run',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime',
      'guard-all'
    ]));
    const stagingCapacityGate = readiness.gates.find(gate => gate.id === 'staging-capacity');
    expect(stagingCapacityGate.evidence).toEqual(expect.objectContaining({
      artifactContentDownloadRequired: true,
      customerSignoffRequired: true
    }));
    expect(stagingCapacityGate.evidence.rysnovaBimCustomerPackageSeedReady).toBe(false);
    expect(stagingCapacityGate.evidence.releaseRysnovaCustomerPackageSeedReady).toBe(false);
    expect(stagingCapacityGate.blocker).toContain('artifact content download');
    expect(stagingCapacityGate.blocker).toContain('customer-package seed');
    expect(readiness.blockers.map(item => item.id).sort()).toEqual([
      'browser-visual-current-run',
      'external-object-storage',
      'guard-all',
      'postgres-staging',
      'redis-runtime',
      'staging-capacity',
      'temporal-runtime'
    ]);
    expect(readiness.requiredExternalProofCommands).toEqual(expect.arrayContaining([
      BROWSER_VISUAL_EXTERNAL_COMMAND,
      'NODE_ENV=production MONGODB_URI=<staging-mongodb-uri> CAPACITY_BASE_URL=<staging-url> npm run perf:capacity',
      OBJECT_STORAGE_EXTERNAL_COMMAND,
      'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke',
      'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke',
      'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke',
      'npm run guard:all'
    ]));
    expect(release.rysnovaBimFinalReadiness).toEqual(expect.objectContaining({
      command: 'npm run release:rysnova-bim-final-readiness',
      status: readiness.status,
      path: 'evidence/rysnova-bim/rysnova-bim-final-readiness.json',
      summaryPath: 'evidence/rysnova-bim/rysnova-bim-final-readiness.md',
      finalLaunchRysnovaProof: false,
	      gates: 11,
	      passed: 4,
	      blocked: 7,
	      sourceEvidence: 10,
	      sourceEvidenceConsistent: true,
	      blockers: readiness.blockers.map(item => item.id)
	    }));
    expect(release.rysnovaBimFinalReadiness.sourceEvidencePaths).toEqual(expect.arrayContaining(
      readiness.sourceEvidence.map(item => item.path)
    ));
    for (const source of readiness.sourceEvidence) {
      expect(release.rysnovaBimFinalReadiness.sourceEvidenceHashes[source.path]).toBe(source.sha256);
    }
  });
});
