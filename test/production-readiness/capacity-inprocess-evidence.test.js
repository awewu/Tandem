const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const REQUIRED_SIGNOFF_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function expectExactSignoffTypes(types) {
  expect(Array.isArray(types)).toBe(true);
  expect(types).toHaveLength(REQUIRED_SIGNOFF_TYPES.length);
  expect(new Set(types).size).toBe(REQUIRED_SIGNOFF_TYPES.length);
  expect([...types].sort()).toEqual([...REQUIRED_SIGNOFF_TYPES].sort());
}

describe('capacity in-process evidence', () => {
  test('latest in-process capacity report passes all scenarios without replacing staging proof', () => {
    const report = readJson('audit/capacity-inprocess-report.json');

    expect(report.mode).toBe('in-process-express-injection');
    expect(report.capacityTargets).toEqual(expect.objectContaining({
      dealers: 500,
      staffUsers: 2000,
      customers: 100000
    }));
    expect(report.summary).toEqual(expect.objectContaining({
      scenarios: 14,
      passed: 14,
      failed: 0,
      productionLike: false,
      replacesNetworkLoadTest: false,
      rysnovaBimCustomerPackageReady: true
    }));

    for (const [id, title] of [
      ['customer-project-portal', 'GET /api/v2/lifecycle/customer-projects'],
      ['lifecycle-handoff-package', 'GET /api/v2/lifecycle/handover/{contractId}/handoff-package'],
      ['rysnova-bim-deliverable-artifacts', 'POST /api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'],
      ['rysnova-bim-signoff-package', 'POST /api/v2/rysnova-bim/projects/{projectId}/signoff-package'],
      ['rysnova-bim-customer-signoff', 'POST /api/v2/rysnova-bim/projects/{projectId}/customer-signoff'],
      ['rysnova-bim-deepening-package', 'GET /api/v2/rysnova-bim/projects/{projectId}/deepening-package'],
      ['rysnova-bim-customer-package', 'GET /api/v2/rysnova-bim/projects/{projectId}/customer-package'],
      ['rysnova-bim-artifact-content-download', 'GET /api/v2/rysnova-bim/artifacts/{artifactId}/download/content']
    ]) {
      const scenario = report.results.find(item => item.id === id);
      expect(scenario).toEqual(expect.objectContaining({
        title,
        passed: true,
        errorRate: 0,
        validationErrors: 0
      }));
      expect(scenario.latency.p95Ms).toBeLessThanOrEqual(scenario.targetP95Ms);
    }
  });

  test('customer project list capacity path uses summary projection, not full project payloads', () => {
    const script = read('audit/capacity-inprocess-test.js');

    expect(script).toContain('function buildCustomerProjectSummary');
    expect(script).toContain("storageMode: 'capacity-inprocess-summary'");
    expect(script).toContain('buildCustomerProjectSummary(scope, i + 1)');
    expect(script).toContain('getCustomerProjectView: async (scope, contractId) => ({');
    expect(script).toContain('...buildCustomerProjectView(scope, 1)');
    expect(script).toContain('buildIotHandoffPackage: async (scope, contractId) => buildIotHandoffPackage(scope, contractId, 1)');
  });

  test('Rysnova customer-package capacity uses a seeded customer-visible package and matching customer token', () => {
    const script = read('audit/capacity-inprocess-test.js');
    const loadScript = read('audit/capacity-load-test.js');
    const evidence = readJson('evidence/release-evidence.json').requiredEvidence.capacityInprocess;

    expect(script).toContain("id: 'rysnova-bim-customer-package'");
    expect(script).toContain('RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID');
    expect(script).toContain('/api/v2/rysnova-bim/artifacts/{artifactId}/download/content');
    expect(script).toContain('validateRysnovaArtifactContentResponse');
    expect(script).toContain('downloadContentReady');
    expect(script).toContain('RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID');
    expect(script).toContain('/api/v2/rysnova-bim/projects/{projectId}/signoff-package');
    expect(script).toContain('RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID');
    expect(script).toContain('/api/v2/rysnova-bim/projects/{projectId}/customer-signoff');
    expect(script).toContain('validateRysnovaCustomerSignoffResponse');
    expect(script).toContain('customerSignoffConfirmationReady');
    expect(script).toContain('customerSignoffReceipt');
    expect(script).toContain('shareSeededCustomerPackageArtifacts');
    expect(script).toContain('RYSNOVA_CUSTOMER_PACKAGE_INDEX');
    expect(script).toContain("token('customer', 23, { customerId: objectId(ids.customerBase, 23) })");
    expect(loadScript).toContain('validateRysnovaCustomerPackage');
    expect(loadScript).toContain('validateRysnovaCustomerSignoff');
    expect(loadScript).toContain('RYSNOVA_SIGNOFF_REQUIRED_TYPES');
    expect(loadScript).toContain('RYSNOVA_CUSTOMER_SIGNOFF_ACKNOWLEDGEMENTS');
    expect(loadScript).toContain('signoffComplete');
    expect(loadScript).toContain('customerSignoffConfirmationReady');
    for (const type of [
      'principle-diagram',
      'construction-drawing',
      'bim-model',
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ]) {
      expect(loadScript).toContain(type);
    }
    expect(evidence.rysnovaBimCustomerPackageScenario).toEqual(expect.objectContaining({
      id: 'rysnova-bim-customer-package',
      path: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      status: 'pass',
      errorRate: 0
    }));
    expect(evidence.rysnovaBimSignoffPackageScenario).toEqual(expect.objectContaining({
      id: 'rysnova-bim-signoff-package',
      path: '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      status: 'pass',
      errorRate: 0
    }));
    expect(evidence.rysnovaBimCustomerSignoffScenario).toEqual(expect.objectContaining({
      id: 'rysnova-bim-customer-signoff',
      path: '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff',
      status: 'pass',
      errorRate: 0
    }));
    expect(evidence.rysnovaBimArtifactContentDownloadScenario).toEqual(expect.objectContaining({
      id: 'rysnova-bim-artifact-content-download',
      path: '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
      status: 'pass',
      errorRate: 0
    }));
  });

  test('Rysnova in-process capacity evidence proves the 7-artifact customer signoff package semantics', () => {
    const report = readJson('audit/capacity-inprocess-report.json');
    const release = readJson('evidence/release-evidence.json').requiredEvidence.capacityInprocess;
    const readiness = report.rysnovaBimCustomerPackageReadiness;

    expect(release.rysnovaBimCustomerPackageReadiness).toEqual(readiness);
    expect(readiness).toEqual(expect.objectContaining({
      scenarioId: 'rysnova-bim-customer-package',
      routePath: '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
      status: 'ready',
      customerPackageStatusCode: 200,
      deepeningPackageStatusCode: 200,
      artifactCount: REQUIRED_SIGNOFF_TYPES.length,
      customerPackageCount: REQUIRED_SIGNOFF_TYPES.length,
      requiredTypesExact: true,
      artifactTypesExact: true,
      allCustomerVisible: true,
      statusesApprovedOrShared: true,
      storageIntegrityPassed: true,
      downloadContentReady: true,
      downloadContentCount: REQUIRED_SIGNOFF_TYPES.length,
      downloadContentIntegrityHeadersReady: true,
      downloadContentScenarioId: 'rysnova-bim-artifact-content-download',
      downloadContentRoutePath: '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
      customerSignoffStatusCode: 201,
      customerSignoffScenarioId: 'rysnova-bim-customer-signoff',
      customerSignoffRoutePath: '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff',
      customerSignoffConfirmationReady: true,
      noForbiddenInternalFields: true,
      customerSignoffReady: true,
      deepeningHandoffReady: true,
      deepeningCustomerSignoffReady: true,
      deepeningVisualReady: true,
      deepeningCommercialReady: true,
      deepeningStandardsPassed: true,
      finalLaunchCapacityProof: false
    }));
    expectExactSignoffTypes(readiness.requiredTypes);
    expectExactSignoffTypes(readiness.packageRequiredTypes);
    expectExactSignoffTypes(readiness.artifactTypes);
    expect(readiness.missingTypes).toEqual([]);
    expect(readiness.packageMissingTypes).toEqual([]);
    expect(readiness.forbiddenFieldPaths).toEqual([]);
    expect(readiness.customerSignoffReceipt).toEqual(expect.objectContaining({
      receiptNo: expect.stringMatching(/^LITH-SIGNOFF-/),
      packageType: 'rysnova-bim-customer-signoff-receipt',
      status: 'customer-signed',
      artifactCount: REQUIRED_SIGNOFF_TYPES.length,
      handoffBoundary: 'lifecycle_handoff_only',
      realtimeControl: false,
      boundary: expect.objectContaining({
        customerSafe: true,
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        noRealtimeControlGranted: true
      }),
      signerMobileHashReady: true,
      evidenceHashReady: true,
      rawSensitiveEvidenceOmitted: true
    }));
    expectExactSignoffTypes(readiness.customerSignoffReceipt.requiredTypes);
    expectExactSignoffTypes(readiness.customerSignoffReceipt.artifactTypes);
    expect(readiness.customerSignoffReceipt.acknowledgements).toEqual(expect.arrayContaining([
      'solution-scope-reviewed',
      'quotation-summary-reviewed',
      'engineering-deliverables-received',
      'standards-precheck-reviewed',
      'lifecycle-handoff-boundary-reviewed'
    ]));
    expect(readiness.downloadContentStatusCodes).toEqual(
      Array.from({ length: REQUIRED_SIGNOFF_TYPES.length }, () => 200)
    );
    expect(readiness.downloadContentResults).toHaveLength(REQUIRED_SIGNOFF_TYPES.length);
    for (const result of readiness.downloadContentResults) {
      expect(result).toEqual(expect.objectContaining({
        path: '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
        statusCode: 200,
        etagReady: true,
        passed: true
      }));
      expect(result.responseContentHash).toBe(result.expectedContentHash);
      expect(result.actualContentHash).toBe(result.expectedContentHash);
      expect(result.contentLengthHeader).toBe(result.sizeBytes);
      expect(result.sizeBytes).toBeGreaterThan(0);
    }
    expect(readiness.evidenceScope).toContain('not staging network proof');
  });

  test('staging capacity evidence records Rysnova 7-artifact seed truthfully', () => {
    const report = readJson('audit/capacity-load-report.json');
    const release = readJson('evidence/release-evidence.json').requiredEvidence.stagingNetworkCapacity;
    const seed = report.config.rysnovaBimCustomerPackageSeed;

    expect(release.rysnovaBimCustomerPackageSeed).toEqual(seed);
    expect(seed).toEqual(expect.objectContaining({
      enabled: true,
      projectId: expect.any(String),
      customerId: expect.any(String),
      signoffComplete: expect.any(Boolean)
    }));
    expectExactSignoffTypes(seed.requiredTypes);

    if (report.summary.finalLaunchCapacityProof) {
      expect(report.evidenceMode).toBe('staging-mongodb');
      expect(seed.status).toBe('ready');
      expect(seed.signoffComplete).toBe(true);
    }

    if (seed.status === 'ready') {
      expect(seed.signoffComplete).toBe(true);
      expect(seed.customerSignoffConfirmationReady).toBe(true);
      expect(seed.customerSignoffScenarioId).toBe('rysnova-bim-customer-signoff');
      expect(seed.customerSignoffRoutePath).toBe('/api/v2/rysnova-bim/projects/{projectId}/customer-signoff');
      expect(seed.customerSignoffStatusCode).toBe(201);
      expect(seed.customerSignoffReceipt).toEqual(expect.objectContaining({
        receiptNo: expect.stringMatching(/^LITH-SIGNOFF-/),
        packageType: 'rysnova-bim-customer-signoff-receipt',
        status: 'customer-signed',
        handoffBoundary: 'lifecycle_handoff_only',
        realtimeControl: false,
        signerMobileHashReady: true,
        evidenceHashReady: true,
        rawSensitiveEvidenceOmitted: true
      }));
      expect(seed.artifactCount).toBe(REQUIRED_SIGNOFF_TYPES.length);
      expect(seed.customerPackageCount).toBe(REQUIRED_SIGNOFF_TYPES.length);
      expectExactSignoffTypes(seed.artifactTypes);
      expect(seed.missingTypes).toEqual([]);
      return;
    }

    if (report.summary.preflightFailed) {
      expect(seed.status).toBe('not-executed-health-preflight-failed');
      expect(seed.signoffComplete).toBe(false);
      return;
    }

    expect(seed.status).toBe('failed');
    expect(seed.signoffComplete).toBe(false);
    expect(seed.reason).toEqual(expect.any(String));
  });
});
