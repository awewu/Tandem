#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const CAPACITY_REPORT = 'audit/capacity-load-report.json';
const CAPACITY_INPROCESS_REPORT = 'audit/capacity-inprocess-report.json';
const CAPACITY_LOAD_SCRIPT = 'audit/capacity-load-test.js';
const CAPACITY_INPROCESS_SCRIPT = 'audit/capacity-inprocess-test.js';
const CAPACITY_README = 'evidence/capacity/README.md';
const CUSTOMER_PROJECT_SCENARIO_ID = 'customer-project-portal';
const CUSTOMER_PROJECT_PATH = '/api/v2/lifecycle/customer-projects';
const HANDOFF_PACKAGE_SCENARIO_ID = 'lifecycle-handoff-package';
const HANDOFF_PACKAGE_PATH = '/api/v2/lifecycle/handover/{contractId}/handoff-package';
const RYSNOVA_DELIVERABLE_SCENARIO_ID = 'rysnova-bim-deliverable-artifacts';
const RYSNOVA_DELIVERABLE_PATH = '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts';
const RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID = 'rysnova-bim-signoff-package';
const RYSNOVA_SIGNOFF_PACKAGE_PATH = '/api/v2/rysnova-bim/projects/{projectId}/signoff-package';
const RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID = 'rysnova-bim-customer-signoff';
const RYSNOVA_CUSTOMER_SIGNOFF_PATH = '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff';
const RYSNOVA_DEEPENING_SCENARIO_ID = 'rysnova-bim-deepening-package';
const RYSNOVA_DEEPENING_PATH = '/api/v2/rysnova-bim/projects/{projectId}/deepening-package';
const RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID = 'rysnova-bim-customer-package';
const RYSNOVA_CUSTOMER_PACKAGE_PATH = '/api/v2/rysnova-bim/projects/{projectId}/customer-package';
const RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID = 'rysnova-bim-artifact-content-download';
const RYSNOVA_ARTIFACT_CONTENT_PATH = '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content';
const REQUIRED_SIGNOFF_TYPES = [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'customer-report'
];

const failures = [];
const warnings = [];
const warningSet = new Set();

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

if (!exists(RELEASE_EVIDENCE)) failures.push(`missing ${RELEASE_EVIDENCE}`);
if (!exists(CAPACITY_README)) failures.push(`missing ${CAPACITY_README}`);

if (!failures.length) {
  const readme = read(CAPACITY_README);
	  for (const token of [
	    'local-network',
	    'staging-network',
	    'staging-mongodb',
	    'summary.finalLaunchCapacityProof',
	    CUSTOMER_PROJECT_PATH,
	    CUSTOMER_PROJECT_SCENARIO_ID,
	    HANDOFF_PACKAGE_PATH,
	    HANDOFF_PACKAGE_SCENARIO_ID,
		    RYSNOVA_DELIVERABLE_PATH,
		    RYSNOVA_DELIVERABLE_SCENARIO_ID,
		    RYSNOVA_SIGNOFF_PACKAGE_PATH,
		    RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID,
		    RYSNOVA_CUSTOMER_SIGNOFF_PATH,
		    RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID,
		    RYSNOVA_DEEPENING_PATH,
	    RYSNOVA_DEEPENING_SCENARIO_ID,
	    RYSNOVA_CUSTOMER_PACKAGE_PATH,
	    RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID,
	    RYSNOVA_ARTIFACT_CONTENT_PATH,
	    RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID
	  ]) {
	    if (!readme.includes(token)) failures.push(`capacity README missing token: ${token}`);
	  }

  requireSourceScenario(CAPACITY_LOAD_SCRIPT);
  requireSourceScenario(CAPACITY_INPROCESS_SCRIPT);

  const evidence = readJson(RELEASE_EVIDENCE);
  const staging = evidence.requiredEvidence?.stagingNetworkCapacity;
  const inprocessEvidence = evidence.requiredEvidence?.capacityInprocess;
  if (!inprocessEvidence) failures.push('release evidence missing capacityInprocess');
  else {
    if (inprocessEvidence.reportPath !== CAPACITY_INPROCESS_REPORT) {
      failures.push(`capacityInprocess reportPath must be ${CAPACITY_INPROCESS_REPORT}`);
    }
    if (inprocessEvidence.customerProjectPortalScenario?.id !== CUSTOMER_PROJECT_SCENARIO_ID) {
      failures.push(`capacityInprocess must record ${CUSTOMER_PROJECT_SCENARIO_ID}`);
    }
    if (inprocessEvidence.customerProjectPortalScenario?.path !== CUSTOMER_PROJECT_PATH) {
      failures.push(`capacityInprocess customerProjectPortalScenario path must be ${CUSTOMER_PROJECT_PATH}`);
    }
    if (inprocessEvidence.lifecycleHandoffPackageScenario?.id !== HANDOFF_PACKAGE_SCENARIO_ID) {
      failures.push(`capacityInprocess must record ${HANDOFF_PACKAGE_SCENARIO_ID}`);
    }
	    if (inprocessEvidence.lifecycleHandoffPackageScenario?.path !== HANDOFF_PACKAGE_PATH) {
	      failures.push(`capacityInprocess lifecycleHandoffPackageScenario path must be ${HANDOFF_PACKAGE_PATH}`);
	    }
	    if (inprocessEvidence.rysnovaBimDeliverableArtifactsScenario?.id !== RYSNOVA_DELIVERABLE_SCENARIO_ID) {
	      failures.push(`capacityInprocess must record ${RYSNOVA_DELIVERABLE_SCENARIO_ID}`);
	    }
		    if (inprocessEvidence.rysnovaBimDeliverableArtifactsScenario?.path !== RYSNOVA_DELIVERABLE_PATH) {
		      failures.push(`capacityInprocess rysnovaBimDeliverableArtifactsScenario path must be ${RYSNOVA_DELIVERABLE_PATH}`);
		    }
		    if (inprocessEvidence.rysnovaBimSignoffPackageScenario?.id !== RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID) {
		      failures.push(`capacityInprocess must record ${RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID}`);
		    }
		    if (inprocessEvidence.rysnovaBimSignoffPackageScenario?.path !== RYSNOVA_SIGNOFF_PACKAGE_PATH) {
		      failures.push(`capacityInprocess rysnovaBimSignoffPackageScenario path must be ${RYSNOVA_SIGNOFF_PACKAGE_PATH}`);
		    }
		    if (inprocessEvidence.rysnovaBimCustomerSignoffScenario?.id !== RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID) {
		      failures.push(`capacityInprocess must record ${RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID}`);
		    }
		    if (inprocessEvidence.rysnovaBimCustomerSignoffScenario?.path !== RYSNOVA_CUSTOMER_SIGNOFF_PATH) {
		      failures.push(`capacityInprocess rysnovaBimCustomerSignoffScenario path must be ${RYSNOVA_CUSTOMER_SIGNOFF_PATH}`);
		    }
		    if (inprocessEvidence.rysnovaBimDeepeningPackageScenario?.id !== RYSNOVA_DEEPENING_SCENARIO_ID) {
		      failures.push(`capacityInprocess must record ${RYSNOVA_DEEPENING_SCENARIO_ID}`);
	    }
	    if (inprocessEvidence.rysnovaBimDeepeningPackageScenario?.path !== RYSNOVA_DEEPENING_PATH) {
	      failures.push(`capacityInprocess rysnovaBimDeepeningPackageScenario path must be ${RYSNOVA_DEEPENING_PATH}`);
	    }
	    if (inprocessEvidence.rysnovaBimCustomerPackageScenario?.id !== RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID) {
	      failures.push(`capacityInprocess must record ${RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID}`);
	    }
	    if (inprocessEvidence.rysnovaBimCustomerPackageScenario?.path !== RYSNOVA_CUSTOMER_PACKAGE_PATH) {
	      failures.push(`capacityInprocess rysnovaBimCustomerPackageScenario path must be ${RYSNOVA_CUSTOMER_PACKAGE_PATH}`);
	    }
	    if (inprocessEvidence.rysnovaBimArtifactContentDownloadScenario?.id !== RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID) {
	      failures.push(`capacityInprocess must record ${RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID}`);
	    }
	    if (inprocessEvidence.rysnovaBimArtifactContentDownloadScenario?.path !== RYSNOVA_ARTIFACT_CONTENT_PATH) {
	      failures.push(`capacityInprocess rysnovaBimArtifactContentDownloadScenario path must be ${RYSNOVA_ARTIFACT_CONTENT_PATH}`);
	    }
	    requireRysnovaCustomerPackageReadiness(
	      inprocessEvidence.rysnovaBimCustomerPackageReadiness,
	      'capacityInprocess.rysnovaBimCustomerPackageReadiness'
	    );
	  }
  if (!staging) failures.push('release evidence missing stagingNetworkCapacity');
  else {
    if (staging.command !== 'CAPACITY_BASE_URL=<staging-url> npm run perf:capacity') {
      failures.push('stagingNetworkCapacity command must remain the staging network command');
    }
    if (staging.reportPath && staging.reportPath !== CAPACITY_REPORT) {
      failures.push(`stagingNetworkCapacity reportPath must be ${CAPACITY_REPORT}`);
    }
    if (staging.summaryPath && staging.summaryPath !== 'audit/capacity-load-report.md') {
      failures.push('stagingNetworkCapacity summaryPath must be audit/capacity-load-report.md');
    }
    if (staging.requiredScenario?.id !== CUSTOMER_PROJECT_SCENARIO_ID) {
      failures.push(`stagingNetworkCapacity must require ${CUSTOMER_PROJECT_SCENARIO_ID}`);
    }
	    if (staging.requiredScenario?.path !== CUSTOMER_PROJECT_PATH) {
	      failures.push(`stagingNetworkCapacity requiredScenario path must be ${CUSTOMER_PROJECT_PATH}`);
	    }
	    const requiredScenarios = staging.requiredScenarios || [];
		    for (const [scenarioId, scenarioPath] of [
		      [HANDOFF_PACKAGE_SCENARIO_ID, HANDOFF_PACKAGE_PATH],
		      [RYSNOVA_DELIVERABLE_SCENARIO_ID, RYSNOVA_DELIVERABLE_PATH],
		      [RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID, RYSNOVA_SIGNOFF_PACKAGE_PATH],
		      [RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID, RYSNOVA_CUSTOMER_SIGNOFF_PATH],
		      [RYSNOVA_DEEPENING_SCENARIO_ID, RYSNOVA_DEEPENING_PATH],
		      [RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID, RYSNOVA_CUSTOMER_PACKAGE_PATH],
		      [RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID, RYSNOVA_ARTIFACT_CONTENT_PATH]
	    ]) {
	      if (!requiredScenarios.some(item => item.id === scenarioId && item.path === scenarioPath)) {
	        failures.push(`stagingNetworkCapacity requiredScenarios must include ${scenarioId}`);
	      }
	    }
	  }

  if (exists(CAPACITY_REPORT)) {
    const report = readJson(CAPACITY_REPORT);
    const finalProof = report.summary?.finalLaunchCapacityProof === true;
    const evidenceMode = report.evidenceMode || 'unknown';
    const expectedStatus = capacityStatus(report);
		    requireScenario(report, CAPACITY_REPORT, CUSTOMER_PROJECT_SCENARIO_ID, CUSTOMER_PROJECT_PATH);
		    requireScenario(report, CAPACITY_REPORT, HANDOFF_PACKAGE_SCENARIO_ID, HANDOFF_PACKAGE_PATH);
		    requireScenario(report, CAPACITY_REPORT, RYSNOVA_DELIVERABLE_SCENARIO_ID, RYSNOVA_DELIVERABLE_PATH);
		    requireScenario(report, CAPACITY_REPORT, RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID, RYSNOVA_SIGNOFF_PACKAGE_PATH);
		    requireScenario(report, CAPACITY_REPORT, RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID, RYSNOVA_CUSTOMER_SIGNOFF_PATH);
		    requireScenario(report, CAPACITY_REPORT, RYSNOVA_DEEPENING_SCENARIO_ID, RYSNOVA_DEEPENING_PATH);
	    requireScenario(report, CAPACITY_REPORT, RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID, RYSNOVA_CUSTOMER_PACKAGE_PATH);

    if (staging?.status !== expectedStatus) {
      failures.push(`stagingNetworkCapacity status must match capacity report status: expected ${expectedStatus}, got ${staging?.status}`);
    }
    if (staging?.evidenceMode && staging.evidenceMode !== evidenceMode) {
      failures.push(`stagingNetworkCapacity evidenceMode must match capacity report: ${evidenceMode}`);
    }
    if (staging?.finalLaunchCapacityProof !== finalProof) {
      failures.push('stagingNetworkCapacity finalLaunchCapacityProof must match capacity report');
    }
    if (!Object.prototype.hasOwnProperty.call(staging || {}, 'rysnovaBimCustomerPackageSeed')) {
      failures.push('stagingNetworkCapacity must record rysnovaBimCustomerPackageSeed');
    }
    requireRysnovaCustomerPackageSeed(
      staging?.rysnovaBimCustomerPackageSeed,
      'stagingNetworkCapacity.rysnovaBimCustomerPackageSeed',
      {
        finalProof,
        preflightFailed: report.summary?.preflightFailed === true
      }
    );
    if (
      staging?.rysnovaBimCustomerPackageSeed &&
      report.config?.rysnovaBimCustomerPackageSeed &&
      JSON.stringify(staging.rysnovaBimCustomerPackageSeed) !== JSON.stringify(report.config.rysnovaBimCustomerPackageSeed)
    ) {
      failures.push('stagingNetworkCapacity rysnovaBimCustomerPackageSeed must match capacity report config');
    }

    if (finalProof && evidenceMode !== 'staging-mongodb') {
      failures.push('capacity report cannot claim finalLaunchCapacityProof unless evidenceMode is staging-mongodb');
    }

    if (finalProof && report.summary?.failed !== 0) {
      failures.push('final launch capacity report must have zero failed scenarios');
    }

    if (!finalProof && staging?.status === 'passed-staging-current-run') {
      failures.push('stagingNetworkCapacity must not be passed-staging-current-run until finalLaunchCapacityProof is true');
    }

    if (report.summary?.preflightFailed === true && staging?.status !== 'preflight-failed') {
      failures.push('preflight failed capacity report must set stagingNetworkCapacity status preflight-failed');
    }

    if (!['local-network', 'staging-network', 'staging-mongodb'].includes(evidenceMode)) {
      warnings.push(`capacity report evidenceMode is not recognized: ${evidenceMode}`);
    }
  } else if (staging?.status !== 'missing-staging-run') {
    failures.push('stagingNetworkCapacity must remain missing-staging-run when no capacity load report exists');
  }

  if (staging?.rysnovaBimCustomerPackageSeed) {
    requireRysnovaCustomerPackageSeed(
      staging.rysnovaBimCustomerPackageSeed,
      'stagingNetworkCapacity.rysnovaBimCustomerPackageSeed',
      {
        finalProof: staging.finalLaunchCapacityProof === true,
        preflightFailed: staging.preflightFailed === true
      }
    );
  }

  if (exists(CAPACITY_INPROCESS_REPORT)) {
    const inprocessReport = readJson(CAPACITY_INPROCESS_REPORT);
	    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, CUSTOMER_PROJECT_SCENARIO_ID, CUSTOMER_PROJECT_PATH);
		    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, HANDOFF_PACKAGE_SCENARIO_ID, HANDOFF_PACKAGE_PATH);
		    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, RYSNOVA_DELIVERABLE_SCENARIO_ID, RYSNOVA_DELIVERABLE_PATH);
		    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID, RYSNOVA_SIGNOFF_PACKAGE_PATH);
		    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID, RYSNOVA_CUSTOMER_SIGNOFF_PATH);
		    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, RYSNOVA_DEEPENING_SCENARIO_ID, RYSNOVA_DEEPENING_PATH);
	    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID, RYSNOVA_CUSTOMER_PACKAGE_PATH);
	    requireScenario(inprocessReport, CAPACITY_INPROCESS_REPORT, RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID, RYSNOVA_ARTIFACT_CONTENT_PATH);
	    requireRysnovaCustomerPackageReadiness(
	      inprocessReport.rysnovaBimCustomerPackageReadiness,
	      `${CAPACITY_INPROCESS_REPORT}.rysnovaBimCustomerPackageReadiness`
	    );
	    if (inprocessReport.summary?.rysnovaBimCustomerPackageReady !== true) {
	      failures.push(`${CAPACITY_INPROCESS_REPORT} summary.rysnovaBimCustomerPackageReady must be true`);
	    }
	  }
}

function capacityStatus(report) {
  if (report.summary?.finalLaunchCapacityProof === true) return 'passed-staging-current-run';
  if (report.summary?.preflightFailed === true) return 'preflight-failed';
  if (report.evidenceMode === 'staging-mongodb') return 'failed-staging-current-run';
  if (report.evidenceMode === 'staging-network') return 'staging-network-not-final';
  return 'missing-staging-run';
}

function requireScenario(report, reportPath, scenarioId, routePath) {
  const results = Array.isArray(report.results) ? report.results : [];
  const scenario = results.find(item => item.id === scenarioId);
  if (!scenario && report.summary?.preflightFailed === true && results.length === 0) {
    addWarning(`${reportPath} preflight failed before scenario execution; source scripts and in-process report remain the enforceable coverage evidence`);
    return;
  }
  if (!scenario) {
    failures.push(`${reportPath} missing required scenario: ${scenarioId}`);
    return;
  }
  if (!String(scenario.title || '').includes(routePath) && !String(scenario.path || '').includes(routePath)) {
    failures.push(`${reportPath} scenario ${scenarioId} must cover ${routePath}`);
  }
}

function requireExactSignoffTypes(types, owner) {
  if (!Array.isArray(types)) {
    failures.push(`${owner} must be an array`);
    return;
  }
  const uniqueTypes = [...new Set(types)];
  if (uniqueTypes.length !== types.length) {
    failures.push(`${owner} must not contain duplicate signoff types`);
  }
  if (types.length !== REQUIRED_SIGNOFF_TYPES.length) {
    failures.push(`${owner} must contain exactly ${REQUIRED_SIGNOFF_TYPES.length} signoff types`);
  }
  const missing = REQUIRED_SIGNOFF_TYPES.filter(type => !types.includes(type));
  const unexpected = types.filter(type => !REQUIRED_SIGNOFF_TYPES.includes(type));
  if (missing.length) failures.push(`${owner} missing signoff types: ${missing.join(', ')}`);
  if (unexpected.length) failures.push(`${owner} has unexpected signoff types: ${unexpected.join(', ')}`);
}

function requireEmptyArray(value, owner) {
  if (!Array.isArray(value)) {
    failures.push(`${owner} must be an array`);
    return;
  }
  if (value.length) failures.push(`${owner} must be empty`);
}

function requireRysnovaCustomerPackageSeed(seed, owner, context = {}) {
  if (!seed || typeof seed !== 'object') {
    failures.push(`${owner} must be an object`);
    return;
  }
  if (seed.enabled !== true) {
    failures.push(`${owner}.enabled must be true so Rysnova customer-package capacity uses a real seeded package`);
  }
  if (!seed.status) {
    failures.push(`${owner}.status is required`);
  }
  if (!Object.prototype.hasOwnProperty.call(seed, 'signoffComplete')) {
    failures.push(`${owner}.signoffComplete is required`);
  } else if (typeof seed.signoffComplete !== 'boolean') {
    failures.push(`${owner}.signoffComplete must be boolean`);
  }
  requireExactSignoffTypes(seed.requiredTypes, `${owner}.requiredTypes`);

  if (context.finalProof && seed.status !== 'ready') {
    failures.push(`${owner}.status must be ready when finalLaunchCapacityProof is true`);
  }
  if (context.finalProof && seed.signoffComplete !== true) {
    failures.push(`${owner}.signoffComplete must be true when finalLaunchCapacityProof is true`);
  }
  if (context.preflightFailed && seed.status === 'ready') {
    failures.push(`${owner}.status cannot be ready when capacity preflight failed`);
  }

  if (seed.status === 'ready') {
    if (seed.signoffComplete !== true) failures.push(`${owner}.signoffComplete must be true when status is ready`);
    if (seed.artifactCount !== REQUIRED_SIGNOFF_TYPES.length) {
      failures.push(`${owner}.artifactCount must be ${REQUIRED_SIGNOFF_TYPES.length} when status is ready`);
    }
    if (seed.customerPackageCount !== REQUIRED_SIGNOFF_TYPES.length) {
      failures.push(`${owner}.customerPackageCount must be ${REQUIRED_SIGNOFF_TYPES.length} when status is ready`);
    }
    requireExactSignoffTypes(seed.artifactTypes, `${owner}.artifactTypes`);
    requireEmptyArray(seed.missingTypes, `${owner}.missingTypes`);
    if (!seed.projectId) failures.push(`${owner}.projectId is required when status is ready`);
    if (!seed.customerId) failures.push(`${owner}.customerId is required when status is ready`);
    for (const [field, expected] of [
      ['readinessFlagsReady', true],
      ['quoteSummaryReady', true],
      ['lifecycleHandoffReady', true],
      ['customerSignoffConfirmationReady', true],
      ['noForbiddenInternalFields', true]
    ]) {
      if (seed[field] !== expected) failures.push(`${owner}.${field} must be ${expected} when status is ready`);
    }
    if (seed.customerSignoffScenarioId !== RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID) {
      failures.push(`${owner}.customerSignoffScenarioId must be ${RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID} when status is ready`);
    }
    if (seed.customerSignoffRoutePath !== RYSNOVA_CUSTOMER_SIGNOFF_PATH) {
      failures.push(`${owner}.customerSignoffRoutePath must be ${RYSNOVA_CUSTOMER_SIGNOFF_PATH} when status is ready`);
    }
    if (seed.customerSignoffStatusCode !== 201) {
      failures.push(`${owner}.customerSignoffStatusCode must be 201 when status is ready`);
    }
    requireCustomerSignoffReceipt(seed.customerSignoffReceipt, `${owner}.customerSignoffReceipt`);
    requireEmptyArray(seed.forbiddenFieldPaths, `${owner}.forbiddenFieldPaths`);
    if (seed.packageReadiness?.packageReady !== true ||
        seed.packageReadiness?.lifecycleHandoffReady !== true ||
        seed.packageReadiness?.objectStorageIntegrityReady !== true) {
      failures.push(`${owner}.packageReadiness must prove packageReady, lifecycleHandoffReady, and objectStorageIntegrityReady`);
    }
    if (seed.quoteSummary?.currency !== 'CNY' ||
        !(Number(seed.quoteSummary?.customerTotal || 0) > 0) ||
        !(Number(seed.quoteSummary?.monthlyPayment || 0) > 0)) {
      failures.push(`${owner}.quoteSummary must include customer-facing CNY total and monthly payment`);
    }
    if (seed.lifecycleHandoff?.handoffBoundary !== 'lifecycle_handoff_only' ||
        seed.lifecycleHandoff?.realtimeControl !== false ||
        seed.lifecycleHandoff?.targetPlatform !== 'external-iot-lifecycle-platform' ||
        !(Number(seed.lifecycleHandoff?.assetCount || 0) > 0) ||
        seed.lifecycleHandoff?.assetsHaveIotBinding !== true) {
      failures.push(`${owner}.lifecycleHandoff must prove lifecycle_handoff_only installed asset handoff`);
    }
  } else if (seed.status === 'not-executed-health-preflight-failed') {
    if (seed.signoffComplete !== false) {
      failures.push(`${owner}.signoffComplete must be false when health preflight prevents seed execution`);
    }
  } else if (seed.status === 'failed') {
    if (seed.signoffComplete !== false) failures.push(`${owner}.signoffComplete must be false when status is failed`);
    if (!seed.reason) failures.push(`${owner}.reason is required when status is failed`);
  } else {
    failures.push(`${owner}.status must be ready, failed, or not-executed-health-preflight-failed`);
  }
}

function requireRysnovaCustomerPackageReadiness(readiness, owner) {
  if (!readiness || typeof readiness !== 'object') {
    failures.push(`${owner} must be an object`);
    return;
  }
  if (readiness.scenarioId !== RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID) {
    failures.push(`${owner}.scenarioId must be ${RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID}`);
  }
  if (readiness.routePath !== RYSNOVA_CUSTOMER_PACKAGE_PATH) {
    failures.push(`${owner}.routePath must be ${RYSNOVA_CUSTOMER_PACKAGE_PATH}`);
  }
  if (readiness.status !== 'ready') failures.push(`${owner}.status must be ready`);
  if (readiness.customerPackageStatusCode !== 200) failures.push(`${owner}.customerPackageStatusCode must be 200`);
  if (readiness.deepeningPackageStatusCode !== 200) failures.push(`${owner}.deepeningPackageStatusCode must be 200`);
  if (readiness.artifactCount !== REQUIRED_SIGNOFF_TYPES.length) {
    failures.push(`${owner}.artifactCount must be ${REQUIRED_SIGNOFF_TYPES.length}`);
  }
  if (readiness.customerPackageCount !== REQUIRED_SIGNOFF_TYPES.length) {
    failures.push(`${owner}.customerPackageCount must be ${REQUIRED_SIGNOFF_TYPES.length}`);
  }
  requireExactSignoffTypes(readiness.requiredTypes, `${owner}.requiredTypes`);
  requireExactSignoffTypes(readiness.packageRequiredTypes, `${owner}.packageRequiredTypes`);
  requireExactSignoffTypes(readiness.artifactTypes, `${owner}.artifactTypes`);
  requireEmptyArray(readiness.missingTypes, `${owner}.missingTypes`);
  requireEmptyArray(readiness.packageMissingTypes, `${owner}.packageMissingTypes`);

  for (const [field, expected] of [
    ['requiredTypesExact', true],
    ['artifactTypesExact', true],
    ['allCustomerVisible', true],
    ['statusesApprovedOrShared', true],
    ['storageIntegrityPassed', true],
    ['downloadContentReady', true],
    ['downloadContentIntegrityHeadersReady', true],
    ['customerSignoffConfirmationReady', true],
    ['noForbiddenInternalFields', true],
    ['readinessFlagsReady', true],
    ['quoteSummaryReady', true],
    ['lifecycleHandoffReady', true],
    ['customerSignoffReady', true],
    ['deepeningHandoffReady', true],
    ['deepeningCustomerSignoffReady', true],
    ['deepeningVisualReady', true],
    ['deepeningCommercialReady', true],
    ['deepeningStandardsPassed', true],
    ['finalLaunchCapacityProof', false]
  ]) {
    if (readiness[field] !== expected) failures.push(`${owner}.${field} must be ${expected}`);
  }

  requireEmptyArray(readiness.forbiddenFieldPaths, `${owner}.forbiddenFieldPaths`);
  if (readiness.downloadContentScenarioId !== RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID) {
    failures.push(`${owner}.downloadContentScenarioId must be ${RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID}`);
  }
  if (readiness.customerSignoffScenarioId !== RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID) {
    failures.push(`${owner}.customerSignoffScenarioId must be ${RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID}`);
  }
  if (readiness.customerSignoffRoutePath !== RYSNOVA_CUSTOMER_SIGNOFF_PATH) {
    failures.push(`${owner}.customerSignoffRoutePath must be ${RYSNOVA_CUSTOMER_SIGNOFF_PATH}`);
  }
  if (readiness.customerSignoffStatusCode !== 201) {
    failures.push(`${owner}.customerSignoffStatusCode must be 201`);
  }
  requireCustomerSignoffReceipt(readiness.customerSignoffReceipt, `${owner}.customerSignoffReceipt`);
  if (readiness.customerSignoffConfirmationReady !== true) {
    failures.push(`${owner}.customerSignoffConfirmationReady must be true`);
  }
  if (readiness.downloadContentRoutePath !== RYSNOVA_ARTIFACT_CONTENT_PATH) {
    failures.push(`${owner}.downloadContentRoutePath must be ${RYSNOVA_ARTIFACT_CONTENT_PATH}`);
  }
  if (readiness.downloadContentCount !== REQUIRED_SIGNOFF_TYPES.length) {
    failures.push(`${owner}.downloadContentCount must be ${REQUIRED_SIGNOFF_TYPES.length}`);
  }
  if (!Array.isArray(readiness.downloadContentResults) || readiness.downloadContentResults.length !== REQUIRED_SIGNOFF_TYPES.length) {
    failures.push(`${owner}.downloadContentResults must include one result per required artifact`);
  } else {
    for (const result of readiness.downloadContentResults) {
      if (result.path !== RYSNOVA_ARTIFACT_CONTENT_PATH) failures.push(`${owner}.downloadContentResults path must be ${RYSNOVA_ARTIFACT_CONTENT_PATH}`);
      if (result.statusCode !== 200) failures.push(`${owner}.downloadContentResults statusCode must be 200`);
      if (result.passed !== true) failures.push(`${owner}.downloadContentResults passed must be true`);
      if (result.etagReady !== true) failures.push(`${owner}.downloadContentResults etagReady must be true`);
      if (!result.expectedContentHash || result.responseContentHash !== result.expectedContentHash || result.actualContentHash !== result.expectedContentHash) {
        failures.push(`${owner}.downloadContentResults must prove expected, response, and actual content hashes match`);
      }
      if (!(Number(result.sizeBytes || 0) > 0) || result.contentLengthHeader !== result.sizeBytes) {
        failures.push(`${owner}.downloadContentResults must prove content length and non-empty bytes`);
      }
    }
  }
  if (readiness.packageReadiness?.packageReady !== true ||
      readiness.packageReadiness?.lifecycleHandoffReady !== true ||
      readiness.packageReadiness?.objectStorageIntegrityReady !== true) {
    failures.push(`${owner}.packageReadiness must prove packageReady, lifecycleHandoffReady, and objectStorageIntegrityReady`);
  }
  if (readiness.quoteSummary?.currency !== 'CNY' ||
      !(Number(readiness.quoteSummary?.customerTotal || 0) > 0) ||
      !(Number(readiness.quoteSummary?.monthlyPayment || 0) > 0)) {
    failures.push(`${owner}.quoteSummary must include customer-facing CNY total and monthly payment`);
  }
  if (readiness.lifecycleHandoff?.handoffBoundary !== 'lifecycle_handoff_only' ||
      readiness.lifecycleHandoff?.realtimeControl !== false ||
      readiness.lifecycleHandoff?.targetPlatform !== 'external-iot-lifecycle-platform' ||
      !(Number(readiness.lifecycleHandoff?.assetCount || 0) > 0) ||
      readiness.lifecycleHandoff?.assetsHaveIotBinding !== true) {
    failures.push(`${owner}.lifecycleHandoff must prove lifecycle_handoff_only installed asset handoff`);
  }
  if (!String(readiness.evidenceScope || '').includes('not staging network proof')) {
    failures.push(`${owner}.evidenceScope must clearly state this is not staging network proof`);
  }
}

function requireCustomerSignoffReceipt(receipt, owner) {
  if (!receipt || typeof receipt !== 'object') {
    failures.push(`${owner} must be an object`);
    return;
  }
  if (!/^LITH-SIGNOFF-/.test(String(receipt.receiptNo || ''))) {
    failures.push(`${owner}.receiptNo must start with LITH-SIGNOFF-`);
  }
  if (receipt.packageType !== 'rysnova-bim-customer-signoff-receipt') {
    failures.push(`${owner}.packageType must be rysnova-bim-customer-signoff-receipt`);
  }
  if (receipt.status !== 'customer-signed') {
    failures.push(`${owner}.status must be customer-signed`);
  }
  if (receipt.artifactCount !== REQUIRED_SIGNOFF_TYPES.length) {
    failures.push(`${owner}.artifactCount must be ${REQUIRED_SIGNOFF_TYPES.length}`);
  }
  requireExactSignoffTypes(receipt.requiredTypes, `${owner}.requiredTypes`);
  requireExactSignoffTypes(receipt.artifactTypes, `${owner}.artifactTypes`);
  for (const acknowledgement of [
    'solution-scope-reviewed',
    'quotation-summary-reviewed',
    'engineering-deliverables-received',
    'standards-precheck-reviewed',
    'lifecycle-handoff-boundary-reviewed'
  ]) {
    if (!receipt.acknowledgements?.includes(acknowledgement)) {
      failures.push(`${owner}.acknowledgements missing ${acknowledgement}`);
    }
  }
  if (receipt.handoffBoundary !== 'lifecycle_handoff_only' ||
      receipt.realtimeControl !== false ||
      receipt.boundary?.handoffBoundary !== 'lifecycle_handoff_only' ||
      receipt.boundary?.realtimeControl !== false ||
      receipt.boundary?.noRealtimeControlGranted !== true) {
    failures.push(`${owner} must prove lifecycle_handoff_only and no realtime control`);
  }
  if (receipt.signerMobileHashReady !== true || receipt.evidenceHashReady !== true) {
    failures.push(`${owner} must prove signer mobile and evidence are hashed`);
  }
  if (receipt.rawSensitiveEvidenceOmitted !== true) {
    failures.push(`${owner} must omit raw mobile/signature evidence`);
  }
}

function addWarning(message) {
  if (warningSet.has(message)) return;
  warningSet.add(message);
  warnings.push(message);
}

function requireSourceScenario(relativePath) {
  if (!exists(relativePath)) {
    failures.push(`missing capacity script: ${relativePath}`);
    return;
  }
  const source = read(relativePath);
  for (const token of [
    CUSTOMER_PROJECT_SCENARIO_ID,
    CUSTOMER_PROJECT_PATH,
    HANDOFF_PACKAGE_SCENARIO_ID,
    HANDOFF_PACKAGE_PATH,
	    RYSNOVA_DELIVERABLE_SCENARIO_ID,
	    RYSNOVA_DELIVERABLE_PATH,
	    RYSNOVA_SIGNOFF_PACKAGE_SCENARIO_ID,
	    RYSNOVA_SIGNOFF_PACKAGE_PATH,
	    RYSNOVA_CUSTOMER_SIGNOFF_SCENARIO_ID,
	    RYSNOVA_CUSTOMER_SIGNOFF_PATH,
	    RYSNOVA_DEEPENING_SCENARIO_ID,
    RYSNOVA_DEEPENING_PATH,
    RYSNOVA_CUSTOMER_PACKAGE_SCENARIO_ID,
    RYSNOVA_CUSTOMER_PACKAGE_PATH,
    RYSNOVA_ARTIFACT_CONTENT_SCENARIO_ID,
    RYSNOVA_ARTIFACT_CONTENT_PATH
  ]) {
	    if (!source.includes(token)) failures.push(`${relativePath} missing required token: ${token}`);
	  }

  if (relativePath === CAPACITY_LOAD_SCRIPT) {
    for (const token of [
      'seedRysnovaCustomerPackage',
      'validateRysnovaCustomerPackage',
      'RYSNOVA_SIGNOFF_REQUIRED_TYPES',
      'CAPACITY_SEED_RYSNOVA_CUSTOMER_PACKAGE',
      'rysnovaBimCustomerPackageSeed',
      'signoffComplete',
      'validateRysnovaCustomerSignoff',
      'customerSignoffConfirmationReady',
      'customerSignoffReceipt',
      'CUSTOMER_PACKAGE_FORBIDDEN_FIELDS',
      'findForbiddenFieldPaths',
      'readinessFlagsReady',
      'quoteSummaryReady',
      'lifecycleHandoffReady',
      'noForbiddenInternalFields',
      'packageReadiness',
      'quoteSummary',
      'lifecycleHandoff',
      'forbiddenFieldPaths',
      'handoff-ready-not-bound',
      'external-iot-lifecycle-platform',
      'validateCapacityEnv',
      'semanticFailures',
      'invalidEnv'
    ]) {
      if (!source.includes(token)) failures.push(`${relativePath} missing required staging seed token: ${token}`);
    }
    for (const token of [
      ...REQUIRED_SIGNOFF_TYPES
    ]) {
      if (!source.includes(token)) failures.push(`${relativePath} missing Rysnova signoff type token: ${token}`);
    }
  }
  if (relativePath === CAPACITY_INPROCESS_SCRIPT) {
    for (const token of [
      'inspectRysnovaCustomerPackage',
      'rysnovaBimCustomerPackageReadiness',
      'CUSTOMER_PACKAGE_FORBIDDEN_FIELDS',
      'deepeningHandoffReady',
      'customerSignoffReady',
      'storageIntegrityPassed',
      'readinessFlagsReady',
      'quoteSummaryReady',
      'lifecycleHandoffReady',
      'packageReadiness',
      'quoteSummary',
      'lifecycleHandoff',
      'forbiddenFieldPaths',
      'validateRysnovaArtifactContentResponse',
      'validateRysnovaCustomerSignoffResponse',
      'downloadContentReady',
      'downloadContentIntegrityHeadersReady',
      'customerSignoffConfirmationReady',
      'customerSignoffReceipt'
    ]) {
      if (!source.includes(token)) failures.push(`${relativePath} missing Rysnova semantic readiness token: ${token}`);
    }
    for (const token of REQUIRED_SIGNOFF_TYPES) {
      if (!source.includes(token)) failures.push(`${relativePath} missing Rysnova signoff type token: ${token}`);
    }
  }
}

console.log(`Capacity Evidence Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
