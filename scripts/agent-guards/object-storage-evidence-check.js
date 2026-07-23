#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RELEASE_EVIDENCE = 'evidence/release-evidence.json';
const STORAGE_README = 'evidence/object-storage/README.md';
const STORAGE_REPORT = 'evidence/object-storage/rysnova-bim-object-storage-smoke.json';
const STORAGE_SUMMARY = 'evidence/object-storage/rysnova-bim-object-storage-smoke.md';
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
if (!exists(STORAGE_README)) failures.push(`missing ${STORAGE_README}`);

if (!failures.length) {
  const readme = read(STORAGE_README);
  for (const token of [
    'local-deterministic-smoke',
    'external-object-storage-smoke',
    'finalLaunchObjectStorageProof: true',
    'OBJECT_STORAGE_EXTERNAL_PROVIDER',
    'externalRoundTrip',
    'finalLaunchEligible',
    'Rysnova service path',
    'sanitized customer package'
  ]) {
    if (!readme.includes(token)) failures.push(`object storage README missing token: ${token}`);
  }

  const evidence = readJson(RELEASE_EVIDENCE);
  const record = evidence.requiredEvidence?.rysnovaBimObjectStorage;
  if (!record) {
    failures.push('release evidence missing rysnovaBimObjectStorage');
  } else {
    if (record.command !== 'npm run release:rysnova-bim-storage:smoke') {
      failures.push('rysnovaBimObjectStorage command must be npm run release:rysnova-bim-storage:smoke');
    }
    if (record.path !== STORAGE_REPORT) {
      failures.push(`rysnovaBimObjectStorage path must be ${STORAGE_REPORT}`);
    }
    if (record.summaryPath !== STORAGE_SUMMARY) {
      failures.push(`rysnovaBimObjectStorage summaryPath must be ${STORAGE_SUMMARY}`);
    }
  }

  if (exists(STORAGE_REPORT)) {
    const report = readJson(STORAGE_REPORT);
    const finalProof = report.finalLaunchObjectStorageProof === true;
    const mode = report.mode || 'unknown';
    const capabilities = report.adapterCapabilities || {};

    if (!['passed', 'missing-external-proof'].includes(report.result)) {
      failures.push('Rysnova object storage smoke result must be passed or missing-external-proof');
    }
    if (report.result === 'passed' && (!Array.isArray(report.checks) || report.checks.some(check => check.passed !== true))) {
      failures.push('Rysnova object storage smoke must have all checks passed when result is passed');
    }
    const checkNames = new Set((report.checks || []).map(check => check.name));
	    for (const requiredCheck of [
	      'reject-path-traversal-object-key',
	      'service-create-approve-share-customer-package',
	      'service-object-keys-tenant-project-scoped',
	      'service-complete-rysnova-bim-signoff-package',
	      'service-customer-signoff-confirmed',
	      'service-customer-package-sanitized',
	      'service-customer-report-object-sanitized'
	    ]) {
	      if (!checkNames.has(requiredCheck)) {
	        failures.push(`Rysnova object storage smoke missing required service-path check: ${requiredCheck}`);
      }
    }
    if (report.result === 'passed') {
      const servicePath = report.servicePath || {};
      if (servicePath.approvalStatus !== 'shared') {
        failures.push('Rysnova object storage service path must approve/share artifact before reporting passed');
      }
      if (servicePath.integrityPassed !== true || servicePath.storageIntegrityPassed !== true) {
        failures.push('Rysnova object storage service path must prove integrityPassed and storageIntegrityPassed');
      }
      if (
        servicePath.objectKeyTenantScoped !== true ||
        typeof servicePath.expectedObjectKeyPrefix !== 'string' ||
        !servicePath.expectedObjectKeyPrefix ||
        !Array.isArray(servicePath.objectKeys) ||
        servicePath.objectKeys.length !== 7 ||
        !servicePath.objectKeys.every(key => String(key || '').startsWith(servicePath.expectedObjectKeyPrefix)) ||
        !Array.isArray(servicePath.crossTenantObjectKeys) ||
        servicePath.crossTenantObjectKeys.length !== 0
      ) {
        failures.push('Rysnova object storage service path must prove tenant/project-scoped object keys with no cross-tenant keys');
      }
	      if (servicePath.customerPackageSanitized !== true) {
	        failures.push('Rysnova object storage service path must prove sanitized customer package');
	      }
	      if (servicePath.customerReportObjectSanitized !== true) {
	        failures.push('Rysnova object storage service path must prove sanitized customer-report storage object');
	      }
	      const customerReportBoundary = servicePath.customerReportObjectBoundary || {};
	      if (
	        customerReportBoundary.parsed !== true ||
	        customerReportBoundary.hasEstimationBoundary !== true ||
	        !String(customerReportBoundary.iotBoundary || '').includes('lifecycle_handoff_only') ||
	        !Array.isArray(customerReportBoundary.internalFieldsExcluded) ||
	        !Array.isArray(customerReportBoundary.missingExcludedFields) ||
	        customerReportBoundary.missingExcludedFields.length !== 0 ||
	        !Array.isArray(customerReportBoundary.leakedFieldKeys) ||
	        customerReportBoundary.leakedFieldKeys.length !== 0 ||
	        customerReportBoundary.hasRawInternalJsonKeys !== false
	      ) {
	        failures.push('Rysnova object storage service path must prove customer-report object boundary and internal-field exclusion');
	      }
	      if (servicePath.generatedArtifactCount !== 7 || servicePath.sharedArtifactCount !== 7) {
	        failures.push('Rysnova object storage service path must generate and share 7 Rysnova artifacts');
      }
      if (servicePath.customerPackageCount !== 7) {
        failures.push('Rysnova object storage service path customer package must include 7 artifacts');
      }
      requireExactSignoffTypes(servicePath.artifactTypes, 'Rysnova object storage service path artifactTypes');
      requireExactSignoffTypes(servicePath.customerPackageArtifactTypes, 'Rysnova object storage service path customerPackageArtifactTypes');
      requireEmptyArray(servicePath.customerPackageMissingTypes, 'Rysnova object storage service path customerPackageMissingTypes');
      if (
        servicePath.deepeningHandoffReady !== true ||
        servicePath.visualReadinessReady !== true ||
        servicePath.commercialReadinessReady !== true ||
        servicePath.customerSignoffReady !== true ||
        servicePath.customerSignoffConfirmationReady !== true
      ) {
        failures.push('Rysnova object storage service path must prove deepening, visual, commercial, customer signoff readiness, and customer signoff confirmation');
      }
      if (
        !/^LITH-SIGNOFF-/.test(String(servicePath.customerSignoffReceipt?.receiptNo || '')) ||
        servicePath.customerSignoffReceipt?.packageType !== 'rysnova-bim-customer-signoff-receipt' ||
        servicePath.customerSignoffReceipt?.status !== 'customer-signed' ||
        servicePath.customerSignoffReceipt?.handoffBoundary !== 'lifecycle_handoff_only' ||
        servicePath.customerSignoffReceipt?.realtimeControl !== false ||
        servicePath.customerSignoffReceipt?.signerMobileHashReady !== true ||
        servicePath.customerSignoffReceipt?.evidenceHashReady !== true ||
        servicePath.customerSignoffReceipt?.rawSensitiveEvidenceOmitted !== true
      ) {
        failures.push('Rysnova object storage service path must prove sanitized customer signoff receipt');
      }
      if (!Array.isArray(servicePath.customerPackageArtifactTypes) || !servicePath.customerPackageArtifactTypes.includes('principle-diagram')) {
        failures.push('Rysnova object storage service path must include customer-visible principle-diagram artifact');
      }
      const outboxEventTypes = servicePath.outboxEventTypes || [];
      if (outboxEventTypes.filter(type => type === 'rysnova-bim.artifact.created').length !== 7) {
        failures.push('Rysnova object storage service path must publish 7 rysnova-bim.artifact.created events');
      }
      if (outboxEventTypes.filter(type => type === 'rysnova-bim.artifact.shared').length !== 7) {
        failures.push('Rysnova object storage service path must publish 7 rysnova-bim.artifact.shared events');
      }
      if (outboxEventTypes.filter(type => type === 'rysnova-bim.artifact.integrity.verified').length !== 7) {
        failures.push('Rysnova object storage service path must publish exactly 7 rysnova-bim.artifact.integrity.verified events');
      }
      if (outboxEventTypes.filter(type => type === 'rysnova-bim.customer_package.ready').length !== 1) {
        failures.push('Rysnova object storage service path must publish exactly one rysnova-bim.customer_package.ready event');
      }
      if (outboxEventTypes.filter(type => type === 'rysnova-bim.customer_signoff.confirmed').length !== 1) {
        failures.push('Rysnova object storage service path must publish exactly one rysnova-bim.customer_signoff.confirmed event');
      }
    }
    if (report.result === 'missing-external-proof' && report.finalLaunchObjectStorageProof !== false) {
      failures.push('missing external object storage proof must not claim finalLaunchObjectStorageProof');
    }
    if (!finalProof && report.externalRoundTripVerified === true) {
      failures.push('non-final object storage report must not claim externalRoundTripVerified');
    }
    if (!finalProof && report.finalLaunchGatePassed === true) {
      failures.push('non-final object storage report must not claim finalLaunchGatePassed');
    }
    if (!capabilities.adapterType || typeof capabilities.externalRoundTrip !== 'boolean' || typeof capabilities.finalLaunchEligible !== 'boolean') {
      failures.push('Rysnova object storage smoke must record adapterCapabilities with adapterType, externalRoundTrip, and finalLaunchEligible');
    }
    if (finalProof && mode !== 'external-object-storage-smoke') {
      failures.push('finalLaunchObjectStorageProof requires external-object-storage-smoke mode');
    }
    if (finalProof && report.externalRoundTripVerified !== true) {
      failures.push('finalLaunchObjectStorageProof requires externalRoundTripVerified true');
    }
    if (finalProof && report.finalLaunchGatePassed !== true) {
      failures.push('finalLaunchObjectStorageProof requires finalLaunchGatePassed true');
    }
    if (finalProof && (!Array.isArray(report.checks) || report.checks.some(check => check.passed !== true))) {
      failures.push('finalLaunchObjectStorageProof requires every object storage smoke check to pass');
    }
    if (finalProof && capabilities.externalRoundTrip !== true) {
      failures.push('finalLaunchObjectStorageProof requires adapterCapabilities.externalRoundTrip true');
    }
    if (finalProof && capabilities.finalLaunchEligible !== true) {
      failures.push('finalLaunchObjectStorageProof requires adapterCapabilities.finalLaunchEligible true');
    }
    if (finalProof && !report.externalConfig) {
      failures.push('finalLaunchObjectStorageProof requires sanitized externalConfig evidence');
    }
    if (finalProof && (
      report.externalConfig?.endpointPresent !== true ||
      report.externalConfig?.bucketPresent !== true ||
      !report.externalConfig?.endpointHash ||
      !report.externalConfig?.bucketHash ||
      report.externalConfig?.accessKeyIdPresent !== true ||
      report.externalConfig?.secretAccessKeyPresent !== true
    )) {
      failures.push('finalLaunchObjectStorageProof requires complete sanitized endpoint, bucket, and credential presence evidence');
    }
    if (finalProof && ['memory', 'local-filesystem'].includes(capabilities.adapterType)) {
      failures.push('memory/local artifact storage adapters cannot produce finalLaunchObjectStorageProof');
    }
    if (!finalProof && mode !== 'missing-external-object-storage-proof' && (capabilities.externalRoundTrip === true || capabilities.finalLaunchEligible === true)) {
      warnings.push('object storage adapter is external-capable but report did not claim final proof; check smoke mode and credentials');
    }
    if (finalProof && record?.status !== 'passed-external-current-run') {
      failures.push('external object storage proof must set release evidence status to passed-external-current-run');
    }
    if (!finalProof && mode === 'missing-external-object-storage-proof' && record?.status !== 'missing-external-proof') {
      failures.push('missing external object storage proof must set release evidence status missing-external-proof');
    }
    if (!finalProof && mode !== 'missing-external-object-storage-proof' && record?.status !== 'local-smoke-only') {
      failures.push('local object storage smoke must keep release evidence status local-smoke-only');
    }
    if (!['local-deterministic-smoke', 'external-object-storage-smoke', 'missing-external-object-storage-proof'].includes(mode)) {
      warnings.push(`object storage smoke mode is not recognized: ${mode}`);
    }
    const reportText = JSON.stringify(report);
    if (reportText.includes('OBJECT_STORAGE_SECRET_ACCESS_KEY') && reportText.includes(process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || '__never__')) {
      failures.push('object storage report must not leak secret access key');
    }
    if (report.externalConfig?.endpoint && !report.externalConfig?.endpointHash) {
      failures.push('object storage report must store endpointHash instead of raw endpoint');
    }
    if (report.externalConfig?.bucket && !report.externalConfig?.bucketHash) {
      failures.push('object storage report must store bucketHash instead of raw bucket');
    }
  } else if (record?.status !== 'missing-smoke-run') {
    failures.push('rysnovaBimObjectStorage must remain missing-smoke-run when no smoke report exists');
  }
}

console.log(`Object Storage Evidence Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);

function requireExactSignoffTypes(types, owner) {
  if (!Array.isArray(types)) {
    failures.push(`${owner} must be an array`);
    return;
  }
  const uniqueTypes = [...new Set(types)];
  if (uniqueTypes.length !== types.length) {
    failures.push(`${owner} must not contain duplicates`);
  }
  if (types.length !== REQUIRED_SIGNOFF_TYPES.length) {
    failures.push(`${owner} must contain exactly ${REQUIRED_SIGNOFF_TYPES.length} types`);
  }
  const missing = REQUIRED_SIGNOFF_TYPES.filter(type => !types.includes(type));
  const unexpected = types.filter(type => !REQUIRED_SIGNOFF_TYPES.includes(type));
  if (missing.length) failures.push(`${owner} missing required types: ${missing.join(', ')}`);
  if (unexpected.length) failures.push(`${owner} has unexpected types: ${unexpected.join(', ')}`);
}

function requireEmptyArray(value, owner) {
  if (!Array.isArray(value)) {
    failures.push(`${owner} must be an array`);
    return;
  }
  if (value.length) failures.push(`${owner} must be empty`);
}
