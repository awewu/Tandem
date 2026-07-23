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

describe('Rysnova object storage evidence', () => {
  test('local smoke proves the full 7-artifact customer signoff package without claiming final external proof', () => {
    const report = readJson('evidence/object-storage/rysnova-bim-object-storage-smoke.json');
    const release = readJson('evidence/release-evidence.json').requiredEvidence.rysnovaBimObjectStorage;

    expect(report.result).toBe('passed');
    expect(report.mode).toBe('local-deterministic-smoke');
    expect(report.finalLaunchObjectStorageProof).toBe(false);
    expect(report.externalRoundTripVerified).toBe(false);
    expect(report.finalLaunchGatePassed).toBe(false);
    expect(report.adapterCapabilities).toEqual(expect.objectContaining({
      adapterType: 'local-filesystem',
      externalRoundTrip: false,
      finalLaunchEligible: false
    }));
    expect(release).toEqual(expect.objectContaining({
      command: 'npm run release:rysnova-bim-storage:smoke',
      status: 'local-smoke-only',
      finalLaunchObjectStorageProof: false
    }));

    expect(report.checks).toEqual(expect.arrayContaining([
	      expect.objectContaining({ name: 'put-object', passed: true }),
	      expect.objectContaining({ name: 'verify-object-hash', passed: true }),
	      expect.objectContaining({ name: 'reject-tampered-hash', passed: true }),
	      expect.objectContaining({ name: 'reject-path-traversal-object-key', passed: true }),
	      expect.objectContaining({ name: 'service-create-approve-share-customer-package', passed: true }),
	      expect.objectContaining({ name: 'service-object-keys-tenant-project-scoped', passed: true }),
	      expect.objectContaining({ name: 'service-complete-rysnova-bim-signoff-package', passed: true }),
	      expect.objectContaining({ name: 'service-artifact-content-download', passed: true }),
	      expect.objectContaining({ name: 'service-customer-signoff-confirmed', passed: true }),
	      expect.objectContaining({ name: 'service-customer-package-sanitized', passed: true }),
	      expect.objectContaining({ name: 'service-customer-report-object-sanitized', passed: true })
	    ]));
	    expect(report.servicePath).toEqual(expect.objectContaining({
      generatedArtifactCount: 7,
      sharedArtifactCount: 7,
      approvalStatus: 'shared',
      customerVisible: true,
      integrityPassed: true,
      storageIntegrityPassed: true,
      artifactContentDownloadReady: true,
      artifactContentDownloadCount: 7,
      expectedObjectKeyPrefix: 'tenant-smoke/project-smoke/',
      objectKeyTenantScoped: true,
      crossTenantObjectKeys: [],
      customerPackageCount: 7,
      customerPackageMissingTypes: [],
      deepeningHandoffReady: true,
      visualReadinessReady: true,
      commercialReadinessReady: true,
      customerSignoffReady: true,
      customerSignoffConfirmationReady: true,
	      quoteCostSummaryPresent: true,
	      quantityTakeoffSummaryPresent: true,
	      customerPackageSanitized: true,
	      customerReportObjectSanitized: true
	    }));
	    expect(report.servicePath.customerReportObjectBoundary).toEqual(expect.objectContaining({
	      objectKey: expect.stringContaining('/customer-report/'),
	      contentHash: expect.stringMatching(/^sha256:/),
	      parsed: true,
	      parseError: null,
	      hasEstimationBoundary: true,
	      iotBoundary: expect.stringContaining('lifecycle_handoff_only'),
	      missingExcludedFields: [],
	      leakedFieldKeys: [],
	      hasRawInternalJsonKeys: false,
	      internalFieldsExcluded: expect.arrayContaining([
	        'directCost',
	        'dealerMargin',
	        'costBreakdown',
	        'marginGuard',
	        'targetBeforeTax',
	        'quoteFloor'
	      ])
	    }));
	    expect(report.servicePath.customerSignoffReceipt).toEqual(expect.objectContaining({
	      receiptNo: expect.stringMatching(/^LITH-SIGNOFF-/),
	      packageType: 'rysnova-bim-customer-signoff-receipt',
	      status: 'customer-signed',
	      handoffBoundary: 'lifecycle_handoff_only',
	      realtimeControl: false,
	      signerMobileHashReady: true,
	      evidenceHashReady: true,
	      rawSensitiveEvidenceOmitted: true
	    }));
	    expectExactSignoffTypes(report.servicePath.artifactTypes);
    expectExactSignoffTypes(report.servicePath.customerPackageArtifactTypes);
    expect(report.servicePath.objectKeys).toHaveLength(7);
    expect(report.servicePath.objectKeys.every(key => key.startsWith('tenant-smoke/project-smoke/'))).toBe(true);
    expect(report.servicePath.contentHashes).toHaveLength(7);
    expect(report.servicePath.artifactContentDownloads).toHaveLength(7);
    for (const download of report.servicePath.artifactContentDownloads) {
      expect(download).toEqual(expect.objectContaining({
        passed: true,
        objectKey: expect.stringContaining('tenant-smoke/project-smoke/'),
        contentHash: expect.stringMatching(/^sha256:/),
        expectedContentHash: expect.stringMatching(/^sha256:/)
      }));
      expect(download.contentHash).toBe(download.expectedContentHash);
      expect(download.sizeBytes).toBe(download.expectedSizeBytes);
      expect(download.sizeBytes).toBeGreaterThan(0);
    }
    expect(report.servicePath.outboxEventTypes.filter(type => type === 'rysnova-bim.artifact.created')).toHaveLength(7);
    expect(report.servicePath.outboxEventTypes.filter(type => type === 'rysnova-bim.artifact.shared')).toHaveLength(7);
    expect(report.servicePath.outboxEventTypes.filter(type => type === 'rysnova-bim.artifact.integrity.verified')).toHaveLength(7);
    expect(report.servicePath.outboxEventTypes.filter(type => type === 'rysnova-bim.customer_package.ready')).toHaveLength(1);
    expect(report.servicePath.outboxEventTypes.filter(type => type === 'rysnova-bim.customer_signoff.confirmed')).toHaveLength(1);
  });

  test('object storage release evidence and script keep external proof honest and sanitized', () => {
    const report = readJson('evidence/object-storage/rysnova-bim-object-storage-smoke.json');
    const readme = read('evidence/object-storage/README.md');
    const script = read('scripts/release/rysnova-bim-object-storage-smoke.js');
    const reportText = JSON.stringify(report);

    expect(readme).toContain('service-complete-rysnova-bim-signoff-package');
    expect(readme).toContain('must not leak raw endpoint, bucket, access key, or secret');
    expect(script).toContain('sanitizedExternalConfig');
    expect(script).toContain('endpointHash');
    expect(script).toContain('bucketHash');
    expect(script).toContain('external-object-storage-smoke');
    expect(script).toContain('finalLaunchObjectStorageProof');
    expect(reportText).not.toContain('OBJECT_STORAGE_SECRET_ACCESS_KEY');
    expect(reportText).not.toContain('OBJECT_STORAGE_ACCESS_KEY_ID');
    expect(report.externalConfig).toBeNull();
  });

  test('final object storage proof is impossible without an external round trip and sanitized config', () => {
    const report = readJson('evidence/object-storage/rysnova-bim-object-storage-smoke.json');
    const release = readJson('evidence/release-evidence.json').requiredEvidence.rysnovaBimObjectStorage;

    if (!report.finalLaunchObjectStorageProof) {
      expect(report.adapterCapabilities.finalLaunchEligible).toBe(false);
      expect(release.status).not.toBe('passed-external-current-run');
      return;
    }

    expect(report.mode).toBe('external-object-storage-smoke');
    expect(report.externalRoundTripVerified).toBe(true);
    expect(report.finalLaunchGatePassed).toBe(true);
    expect(report.checks.every(check => check.passed === true)).toBe(true);
    expect(report.adapterCapabilities).toEqual(expect.objectContaining({
      adapterType: 's3-compatible',
      externalRoundTrip: true,
      finalLaunchEligible: true
    }));
    expect(report.externalConfig).toEqual(expect.objectContaining({
      endpointPresent: true,
      endpointHash: expect.any(String),
      bucketPresent: true,
      bucketHash: expect.any(String),
      accessKeyIdPresent: true,
      secretAccessKeyPresent: true
    }));
    expect(release.status).toBe('passed-external-current-run');
    expect(release.finalLaunchObjectStorageProof).toBe(true);
  });
});
