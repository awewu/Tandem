const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const specPath = path.join(ROOT, 'contracts/openapi/rhautt-nexus-v2.openapi.json');
const clientPath = path.join(ROOT, 'packages/generated-client/src/rhauttNexusClient.ts');

const protectedPrefixes = [
  '/api/v2/crm',
  '/api/v2/lifecycle',
  '/api/v2/rysnova-bim',
  '/api/v2/analytics',
  '/api/v2/audit',
  '/api/v2/governance',
  '/api/v2/tenants',
  '/api/v2/dealers',
  '/api/v2/stores'
];
const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadSpec() {
  return JSON.parse(fs.readFileSync(specPath, 'utf8'));
}

function operations(spec) {
  const items = [];
  for (const [routePath, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!httpMethods.has(method)) continue;
      items.push({ routePath, method, operation });
    }
  }
  return items;
}

function successRef(spec, routePath, method, statusCode = '200') {
  return spec.paths[routePath][method].responses[statusCode].$ref;
}

function collectRefs(value, refs = []) {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.$ref === 'string') refs.push(value.$ref);
  for (const child of Object.values(value)) collectRefs(child, refs);
  return refs;
}

describe('OpenAPI contract and generated client', () => {
  test('v2 OpenAPI contract identifies 瑞诺瓦AI舒适家 and production boundary', () => {
    const spec = loadSpec();

    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info.title).toBe('Rhautt Nexus / 瑞合数智枢纽 API');
    expect(spec.info.description).toContain('Rhautt Comfort / 瑞合瑞德暖通科技集团');
    expect(spec.info.description).toContain('瑞诺瓦');
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining([
      '/api/v2/health/ready',
      '/api/v2/health/observability',
      '/api/v2/tenants',
      '/api/v2/tenants/{id}',
      '/api/v2/dealers',
      '/api/v2/dealers/{id}',
      '/api/v2/stores',
      '/api/v2/stores/{id}',
      '/api/v2/crm/leads',
      '/api/v2/diagnosis/complete',
      '/api/v2/diagnosis/public/complete',
      '/api/v2/diagnosis/public/reports/{reportId}',
      '/api/v2/design/projects/{projectId}/workspace-state',
      '/api/v2/analytics/overview',
      '/api/v2/governance/agent-progress',
      '/api/v2/audit/events',
      '/api/v2/lifecycle/handover',
      '/api/v2/lifecycle/handover/{contractId}/handoff-package',
      '/api/v2/lifecycle/customer-projects',
      '/api/v2/lifecycle/customer-projects/{contractId}',
      '/api/v2/rysnova-bim/artifacts',
      '/api/v2/rysnova-bim/artifacts/{artifactId}/integrity',
      '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
      '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
      '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
      '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff',
      '/api/v2/react-candidate/status'
    ]));
  });

  test('tenant management contract freezes the NestJS tenant, dealer and store surface', () => {
    const spec = loadSpec();
    const schemas = spec.components.schemas;
    const expectedOperations = {
      '/api/v2/tenants': ['get', 'post'],
      '/api/v2/tenants/{id}': ['get', 'put'],
      '/api/v2/dealers': ['get', 'post'],
      '/api/v2/dealers/{id}': ['get', 'put'],
      '/api/v2/stores': ['get', 'post'],
      '/api/v2/stores/{id}': ['get', 'put']
    };

    for (const [routePath, methods] of Object.entries(expectedOperations)) {
      expect(Object.keys(spec.paths[routePath])).toEqual(expect.arrayContaining(methods));
      for (const method of methods) {
        expect(spec.paths[routePath][method].security).toEqual([{ bearerAuth: [] }]);
      }
    }

    expect(schemas.Tenant.required).toEqual(expect.arrayContaining(['id', 'code', 'name', 'type', 'status']));
    expect(schemas.Dealer.required).toEqual(expect.arrayContaining(['id', 'tenantId', 'code', 'name', 'status']));
    expect(schemas.Store.required).toEqual(expect.arrayContaining(['id', 'tenantId', 'dealerId', 'code', 'name', 'status']));
    expect(schemas.CreateTenantInput.required).toEqual(['code', 'name']);
    expect(schemas.CreateDealerInput.required).toEqual(['code', 'name']);
    expect(schemas.CreateStoreInput.required).toEqual(['dealerId', 'code', 'name']);

    const hqRoles = ['platform_admin', 'hq_admin'];
    const dealerReadRoles = [...hqRoles, 'regional_manager', 'dealer_admin', 'store_manager'];
    const dealerWriteRoles = [...hqRoles, 'regional_manager', 'dealer_admin'];
    expect(spec.paths['/api/v2/tenants'].get['x-roles']).toEqual(hqRoles);
    expect(spec.paths['/api/v2/tenants'].post['x-roles']).toEqual(hqRoles);
    expect(spec.paths['/api/v2/dealers'].get['x-roles']).toEqual(dealerReadRoles);
    expect(spec.paths['/api/v2/dealers'].post['x-roles']).toEqual([...hqRoles, 'regional_manager']);
    expect(spec.paths['/api/v2/dealers/{id}'].put['x-roles']).toEqual(dealerWriteRoles);
    expect(spec.paths['/api/v2/stores'].get['x-roles']).toEqual(dealerReadRoles);
    expect(spec.paths['/api/v2/stores'].post['x-roles']).toEqual(dealerWriteRoles);
  });

  test('all production v2 operations have operationId, tags, responses and security where required', () => {
    const spec = loadSpec();
    const ids = new Set();

    for (const item of operations(spec)) {
      expect(item.operation.operationId).toBeTruthy();
      expect(ids.has(item.operation.operationId)).toBe(false);
      ids.add(item.operation.operationId);
      expect(item.operation.tags.length).toBeGreaterThan(0);
      expect(Object.keys(item.operation.responses).length).toBeGreaterThan(0);
      if (protectedPrefixes.some(prefix => item.routePath.startsWith(prefix))) {
        expect(item.operation.security).toEqual([{ bearerAuth: [] }]);
      }
    }

    expect(ids.has('createLifecycleHandover')).toBe(true);
    expect(ids.has('createRysnovaArtifact')).toBe(true);
    expect(ids.has('getHealthHeartbeat')).toBe(true);
    expect(ids.has('getHealthObservability')).toBe(true);
    expect(ids.has('getGovernanceAgentProgress')).toBe(true);
  });

  test('high-value production APIs use concrete business schemas instead of generic envelopes', () => {
    const spec = loadSpec();

    expect(successRef(spec, '/api/v2/analytics/overview', 'get')).toBe('#/components/responses/AnalyticsOverviewSuccess');
    expect(successRef(spec, '/api/v2/governance/agent-progress', 'get')).toBe('#/components/responses/GovernanceAgentProgressSuccess');
    expect(successRef(spec, '/api/v2/diagnosis/complete', 'post', '201')).toBe('#/components/responses/DiagnosisCompletionSuccess');
    expect(successRef(spec, '/api/v2/diagnosis/public/complete', 'post', '201')).toBe('#/components/responses/DiagnosisCompletionSuccess');
    expect(successRef(spec, '/api/v2/diagnosis/public/reports/{reportId}', 'get')).toBe('#/components/responses/DiagnosisPublicReportSuccess');
    expect(successRef(spec, '/api/v2/design/projects/{projectId}/workspace-state', 'post')).toBe('#/components/responses/DesignWorkspaceStateSuccess');
    expect(successRef(spec, '/api/v2/design/projects/{projectId}/workspace-state', 'get')).toBe('#/components/responses/DesignWorkspaceStateSuccess');
    expect(successRef(spec, '/api/v2/system-packs', 'get')).toBe('#/components/responses/SystemPackListSuccess');
    expect(successRef(spec, '/api/v2/system-packs/{packId}', 'get')).toBe('#/components/responses/SystemPackSuccess');
    expect(successRef(spec, '/api/v2/system-packs/compose', 'post')).toBe('#/components/responses/SystemPackCompositionSuccess');
    expect(successRef(spec, '/api/v2/system-packs/recommend', 'post')).toBe('#/components/responses/SystemPackRecommendationSuccess');
    expect(successRef(spec, '/api/v2/audit/events', 'get')).toBe('#/components/responses/AuditEventsSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/handover', 'get')).toBe('#/components/responses/LifecycleHandoverListSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/handover', 'post', '201')).toBe('#/components/responses/LifecycleHandoverSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/handover/{contractId}', 'get')).toBe('#/components/responses/LifecycleHandoverSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/customer-projects', 'get')).toBe('#/components/responses/LifecycleCustomerProjectListSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/customer-projects/{contractId}', 'get')).toBe('#/components/responses/LifecycleCustomerProjectSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/handover/{contractId}/handoff-package', 'get')).toBe('#/components/responses/LifecycleIotHandoffPackageSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/handover/{contractId}/state', 'patch')).toBe('#/components/responses/LifecycleHandoverSuccess');
    expect(successRef(spec, '/api/v2/lifecycle/handover/{contractId}/acceptance', 'post')).toBe('#/components/responses/LifecycleHandoverSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts', 'get')).toBe('#/components/responses/RysnovaArtifactListSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts', 'post', '201')).toBe('#/components/responses/RysnovaArtifactSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts/{artifactId}/approval', 'post')).toBe('#/components/responses/RysnovaArtifactSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts/{artifactId}/integrity', 'get')).toBe('#/components/responses/RysnovaArtifactIntegritySuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts/{artifactId}/download', 'get')).toBe('#/components/responses/RysnovaArtifactDownloadSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts/{artifactId}/download', 'get', '409')).toBe('#/components/responses/Error');
    expect(spec.paths['/api/v2/rysnova-bim/artifacts/{artifactId}/download'].get.operationId)
      .toBe('prepareRysnovaArtifactDownload');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content', 'get')).toBe('#/components/responses/RysnovaArtifactContentSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content', 'get', '403')).toBe('#/components/responses/Error');
    expect(successRef(spec, '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content', 'get', '409')).toBe('#/components/responses/Error');
    expect(spec.paths['/api/v2/rysnova-bim/artifacts/{artifactId}/download/content'].get.operationId)
      .toBe('downloadRysnovaArtifactContent');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/customer-package', 'get')).toBe('#/components/responses/RysnovaCustomerPackageSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/customer-package', 'get', '403')).toBe('#/components/responses/Error');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/customer-package', 'get', '404')).toBe('#/components/responses/Error');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts', 'post', '201')).toBe('#/components/responses/RysnovaVisualArtifactsSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts', 'post', '201')).toBe('#/components/responses/RysnovaDeliverableArtifactsSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/signoff-package', 'post', '201')).toBe('#/components/responses/RysnovaSignoffPackageSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff', 'post', '201')).toBe('#/components/responses/RysnovaCustomerSignoffSuccess');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff', 'post', '400')).toBe('#/components/responses/Error');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff', 'post', '403')).toBe('#/components/responses/Error');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff', 'post', '409')).toBe('#/components/responses/Error');
    expect(successRef(spec, '/api/v2/rysnova-bim/projects/{projectId}/deepening-package', 'get')).toBe('#/components/responses/RysnovaDeepeningPackageSuccess');
    expect(successRef(spec, '/api/v2/health/observability', 'get')).toBe('#/components/responses/HealthObservabilitySuccess');
    expect(successRef(spec, '/api/v2/react-candidate/status', 'get')).toBe('#/components/responses/ReactCandidateStatusSuccess');
  });

  test('all OpenAPI component refs resolve to defined components', () => {
    const spec = loadSpec();
    const refs = collectRefs(spec);
    const missing = refs.filter(ref => {
      if (!ref.startsWith('#/')) return false;
      const parts = ref.slice(2).split('/');
      let cursor = spec;
      for (const part of parts) {
        cursor = cursor?.[part];
        if (cursor === undefined) return true;
      }
      return false;
    });

    expect(missing).toEqual([]);
  });

  test('system pack contract exposes Rysnova-ready standards coverage schema', () => {
    const spec = loadSpec();
    const schemas = spec.components.schemas;

    expect(schemas.SystemPackListEnvelope.properties.data.items.$ref).toBe('#/components/schemas/SystemPack');
    expect(schemas.SystemPackEnvelope.properties.data.$ref).toBe('#/components/schemas/SystemPack');
    expect(schemas.SystemPackCompositionEnvelope.properties.data.$ref).toBe('#/components/schemas/SystemPackComposition');
    expect(schemas.SystemPackRecommendationEnvelope.properties.data.$ref).toBe('#/components/schemas/SystemPackRecommendation');

    expect(schemas.SystemPack.required).toEqual(expect.arrayContaining([
      'standards',
      'standardsCoverage',
      'deliverables',
      'iotCapabilities',
      'quoteTags'
    ]));
    expect(schemas.SystemPack.properties.standardsCoverage.items.$ref).toBe('#/components/schemas/SystemPackStandardsCoverage');

    expect(schemas.SystemPackStandardsCoverageDomain.enum).toEqual([
      'thermal-comfort',
      'ventilation-iaq',
      'hot-water-safety',
      'potable-water',
      'energy',
      'smart-interoperability'
    ]);
    expect(schemas.SystemPackStandardsCoverage.required).toEqual([
      'domain',
      'requiredFor',
      'primaryStandards',
      'softwareChecks',
      'deliverableEvidence',
      'quoteImpact',
      'lifecycleHandoffImpact'
    ]);
    expect(schemas.SystemPackComposition.required).toEqual(expect.arrayContaining([
      'standardsCoverage',
      'standardsEvidence',
      'iot',
      'quoteTags',
      'implementationNotes'
    ]));
    expect(schemas.SystemPackStandardsEvidence.properties.coverage.$ref).toBe('#/components/schemas/SystemPackStandardsCoverageSummary');
    expect(schemas.SystemPackStandardsCoverageSummary.properties.status.enum).toEqual(['complete', 'incomplete']);
    expect(schemas.SystemPackStandardsCoverageSummary.properties.missingRequiredDomains.items.$ref)
      .toBe('#/components/schemas/SystemPackStandardsCoverageDomain');
  });

  test('domain schemas preserve lifecycle-only IoT handoff and Rysnova artifact precision', () => {
    const spec = loadSpec();
    const schemas = spec.components.schemas;

    expect(schemas.IotHandoff.properties.handoffBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.IotHandoffInput.properties.handoffBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.CapabilityRegistryItem.properties.controlBoundary.enum).toEqual(['lifecycle_handoff_only']);

    expect(schemas.LifecycleHandover.required).toEqual(expect.arrayContaining([
      'tenantId',
      'customerId',
      'contractId',
      'projectState',
      'lifecycleStage',
      'handoverStatus',
      'iot',
      'installedAssets',
      'servicePlan'
    ]));
    expect(schemas.LifecycleCustomerProject.required).toEqual(expect.arrayContaining([
      'tenantId',
      'customerId',
      'contractId',
      'projectState',
      'customerVisibleState',
      'progressPercent',
      'references',
      'solution',
      'quotation',
      'construction',
      'acceptance',
      'servicePlan',
      'installedAssets',
      'iot',
      'milestones',
      'nextAction',
      'visibility',
      'handoffBoundary'
    ]));
    expect(schemas.LifecycleCustomerProjectListEnvelope.properties.data.properties.items.items.$ref).toBe('#/components/schemas/LifecycleCustomerProject');
    expect(schemas.LifecycleCustomerProject.properties.handoffBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.LifecycleCustomerIot.properties.handoffBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.LifecycleCustomerVisibility.properties.scope.enum).toEqual(['customer-visible']);
    expect(schemas.LifecycleCustomerVisibility.properties.hiddenFields.items.enum).toEqual(expect.arrayContaining([
      'dealerMargin',
      'costBaseline',
      'internalApprovalNotes',
      'crossTenantData',
      'sensitiveTechnicianNotes'
    ]));
    expect(schemas.LifecycleCustomerSolution.properties.equipmentBrands.items.enum).toEqual(expect.arrayContaining(['Rheem', 'Ruud', 'Everhot']));
    expect(schemas.LifecycleIotHandoffPackage.required).toEqual(expect.arrayContaining([
      'packageType',
      'packageVersion',
      'generatedAt',
      'tenantId',
      'customerId',
      'contractId',
      'home',
      'installedAssets',
      'capabilityRegistry',
      'servicePlan',
      'warrantySummary',
      'maintenanceSchedule',
      'handoffBoundary',
      'forbiddenControl',
      'visibility'
    ]));
    expect(schemas.LifecycleIotHandoffPackage.properties.packageType.enum).toEqual(['rhautt-nexus-iot-lifecycle-handoff']);
    expect(schemas.LifecycleIotHandoffPackage.properties.handoffBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.LifecycleIotHandoffPackage.properties.capabilityRegistry.items.$ref).toBe('#/components/schemas/CapabilityRegistryItem');
    expect(schemas.LifecycleIotForbiddenControl.properties.realtimeControlCommands.const).toBe(false);
    expect(schemas.LifecycleIotForbiddenControl.properties.remoteSetpointWrite.const).toBe(false);
    expect(schemas.LifecycleIotForbiddenControl.properties.deviceActuation.const).toBe(false);
    expect(schemas.LifecycleIotHandoffPackageVisibility.properties.scope.enum).toEqual(['iot-lifecycle-handoff']);
    expect(schemas.LifecycleIotHandoffPackageVisibility.properties.hiddenFields.items.enum).toEqual(expect.arrayContaining([
      'dealerMargin',
      'costBaseline',
      'internalApprovalNotes',
      'realtimeControlCommands',
      'remoteControlTokens'
    ]));
    expect(schemas.DesignWorkspaceState.required).toEqual(expect.arrayContaining([
      'tenantId',
      'projectId',
      'sourceSurface',
      'moduleId',
      'moduleDeploymentMode',
      'moduleNamespace',
      'dataNamespace',
      'canvas',
      'contentHash',
      'version',
      'rysnovaBimReadiness'
    ]));
    expect(schemas.DesignWorkspaceState.properties.moduleId.enum).toEqual(['designer-workbench', 'rysnova-bim-engineering-support']);
    expect(schemas.DesignWorkspaceState.properties.moduleDeploymentMode.enum).toEqual(['rhautt-portal-embedded', 'standalone']);
    expect(schemas.DesignWorkspaceState.properties.moduleNamespace.enum).toEqual(['designer', 'rysnova-bim']);
    expect(schemas.DesignWorkspaceState.properties.dataNamespace.enum).toEqual(['designer', 'rysnova-bim']);
    expect(schemas.DesignWorkspaceRysnovaReadiness.properties.handoffBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.RysnovaArtifactType.enum).toEqual(expect.arrayContaining([
      'concept-effect-view',
      'principle-diagram',
      'construction-drawing',
      'bim-model',
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ]));
    expect(schemas.RysnovaArtifact.required).toEqual(expect.arrayContaining([
      'tenantId',
      'moduleId',
      'moduleDeploymentMode',
      'moduleNamespace',
      'dataNamespace',
      'projectId',
      'source',
      'type',
      'version',
      'status',
      'objectKey',
      'contentHash',
      'inputsHash',
      'standards',
      'permissions'
    ]));
    expect(schemas.RysnovaArtifact.properties.moduleId.enum).toEqual(['rysnova-bim-engineering-support']);
    expect(schemas.RysnovaArtifact.properties.moduleDeploymentMode.enum).toEqual(['rhautt-portal-embedded', 'standalone']);
    expect(schemas.RysnovaArtifact.properties.moduleNamespace.enum).toEqual(['rysnova-bim']);
    expect(schemas.RysnovaArtifact.properties.dataNamespace.enum).toEqual(['rysnova-bim']);
    expect(schemas.RysnovaArtifactInput.properties.moduleDeploymentMode.enum).toEqual(['rhautt-portal-embedded', 'standalone']);
    expect(schemas.RysnovaArtifact.properties.metadata.$ref).toBe('#/components/schemas/RysnovaArtifactMetadata');
    expect(schemas.RysnovaArtifactIntegrity.required).toEqual(expect.arrayContaining([
      'artifactId',
      'objectKey',
      'expectedContentHash',
      'exists',
      'passed',
      'checkedAt'
    ]));
    expect(schemas.RysnovaArtifactIntegrity.properties.storage.anyOf).toEqual(expect.arrayContaining([
      expect.objectContaining({ $ref: '#/components/schemas/ArtifactStorageMetadata' })
    ]));
    expect(schemas.RysnovaDeliverableArtifactsResult.required).toEqual(expect.arrayContaining([
      'bomSummary',
      'quantityTakeoffSummary',
      'quoteCostSummary',
      'standardsSummary',
      'standardsCoverage',
      'tierComparison',
      'engineeringTraceabilityManifest',
      'storageEvidence'
    ]));
    expect(schemas.RysnovaVisualArtifactsResult.required).toEqual(expect.arrayContaining([
      'engineeringTraceabilityManifest'
    ]));
    expect(schemas.RysnovaVisualArtifactsResult.properties.engineeringTraceabilityManifest.$ref)
      .toBe('#/components/schemas/RysnovaEngineeringTraceabilityManifest');
    expect(schemas.RysnovaDeliverableArtifactsResult.properties.artifactTypes.items.$ref).toBe('#/components/schemas/RysnovaArtifactType');
    expect(schemas.RysnovaDeliverableArtifactsResult.properties.storageEvidence.items.$ref).toBe('#/components/schemas/RysnovaArtifactStorageEvidence');
    expect(schemas.RysnovaDeliverableArtifactsResult.properties.standardsCoverage.$ref)
      .toBe('#/components/schemas/SystemPackStandardsCoverageSummary');
    expect(schemas.RysnovaDeliverableArtifactsResult.properties.quoteCostSummary.$ref)
      .toBe('#/components/schemas/RysnovaQuoteCostSummary');
    expect(schemas.RysnovaDeliverableArtifactsResult.properties.tierComparison.$ref)
      .toBe('#/components/schemas/RysnovaTierComparison');
    expect(schemas.RysnovaDeliverableArtifactsResult.properties.engineeringTraceabilityManifest.$ref)
      .toBe('#/components/schemas/RysnovaEngineeringTraceabilityManifest');
	    const rysnovaBimSignoffTypes = [
	      'principle-diagram',
	      'construction-drawing',
	      'bim-model',
	      'bom',
	      'quantity-takeoff',
	      'standards-check',
	      'customer-report'
	    ];
	    expect(schemas.RysnovaSignoffPackageInput.properties.approvalMode.enum).toEqual(['review-only', 'share-to-customer']);
	    expect(schemas.RysnovaSignoffPackageResult.required).toEqual(expect.arrayContaining([
	      'approvalMode',
	      'requiredTypes',
	      'artifactTypes',
	      'signoffEvidence',
	      'customerPackage',
	      'customerSignoffManifest',
	      'deepeningPackage',
	      'standardsSummary',
	      'standardsCoverage',
	      'tierComparison',
	      'engineeringTraceabilityManifest',
	      'customerPackageReady',
	      'handoffReady',
	      'evidenceGaps',
	      'nextActions'
	    ]));
	    expect(schemas.RysnovaSignoffPackageResult.properties.requiredTypes).toEqual(expect.objectContaining({
	      minItems: 7,
	      maxItems: 7,
	      uniqueItems: true,
	      'x-rysnova-bim-signoff-required-types': rysnovaBimSignoffTypes
	    }));
	    expect(schemas.RysnovaSignoffPackageResult.properties.requiredTypes.allOf.map(item => item.contains.const))
	      .toEqual(rysnovaBimSignoffTypes);
	    expect(schemas.RysnovaSignoffPackageResult.properties.artifactTypes).toEqual(expect.objectContaining({
	      minItems: 7,
	      maxItems: 7
	    }));
	    expect(schemas.RysnovaSignoffPackageResult.properties.signoffEvidence.items.$ref)
	      .toBe('#/components/schemas/RysnovaArtifactSignoffEvidence');
	    expect(schemas.RysnovaSignoffPackageResult.properties.customerPackage.$ref).toBe('#/components/schemas/RysnovaCustomerPackage');
	    expect(schemas.RysnovaSignoffPackageResult.properties.customerSignoffManifest.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffManifest');
	    expect(schemas.RysnovaSignoffPackageResult.properties.deepeningPackage.$ref).toBe('#/components/schemas/RysnovaDeepeningPackage');
	    expect(schemas.RysnovaSignoffPackageResult.properties.standardsCoverage.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageSummary');
	    expect(schemas.RysnovaSignoffPackageResult.properties.quoteCostSummary.$ref)
	      .toBe('#/components/schemas/RysnovaQuoteCostSummary');
	    expect(schemas.RysnovaSignoffPackageResult.properties.tierComparison.$ref)
	      .toBe('#/components/schemas/RysnovaTierComparison');
	    expect(schemas.RysnovaSignoffPackageResult.properties.engineeringTraceabilityManifest.$ref)
	      .toBe('#/components/schemas/RysnovaEngineeringTraceabilityManifest');
	    expect(schemas.RysnovaTierComparison.required).toEqual(expect.arrayContaining([
	      'selectedTier',
	      'recommendedTier',
	      'tierCount',
	      'tiers',
	      'boundary'
	    ]));
	    expect(schemas.RysnovaTierComparison.properties.tierCount.const).toBe(3);
	    expect(schemas.RysnovaTierComparison.properties.tiers).toEqual(expect.objectContaining({
	      minItems: 3,
	      maxItems: 3
	    }));
	    expect(schemas.RysnovaTierComparison.properties.tiers.items.$ref)
	      .toBe('#/components/schemas/RysnovaTierComparisonItem');
	    expect(schemas.RysnovaTierComparison.properties.boundary.properties.lifecycleHandoffOnly.const).toBe(true);
	    expect(schemas.RysnovaTierComparison.properties.boundary.properties.realtimeControl.const).toBe(false);
	    expect(schemas.RysnovaTierComparisonItem.properties.tier.enum).toEqual(['essential', 'balanced', 'premium']);
	    expect(schemas.RysnovaTierComparisonItem.required).toEqual(expect.arrayContaining([
	      'customerTotal',
	      'monthlyPayment',
	      'quantityTakeoffSummary',
	      'marginGuard',
	      'standardsCoverageStatus',
	      'coveredCoverageDomains',
	      'lifecycleHandoff',
	      'customerSafeExplanation'
	    ]));
	    expect(schemas.RysnovaTierComparisonItem.properties.lifecycleHandoff.properties.handoffBoundary.const)
	      .toBe('lifecycle_handoff_only');
	    expect(schemas.RysnovaTierComparisonItem.properties.lifecycleHandoff.properties.realtimeControl.const)
	      .toBe(false);
	    expect(schemas.RysnovaDeepeningPackage.required).toEqual(expect.arrayContaining([
	      'commercialReadiness',
	      'installedAssetReadiness',
	      'customerSignoff',
	      'qualityGateSummary',
	      'downloadManifest',
	      'engineeringTraceabilityManifest',
	      'standardsCoverage',
	      'handoffReady'
	    ]));
	    expect(schemas.RysnovaDeepeningPackage.properties.qualityGateSummary.$ref)
	      .toBe('#/components/schemas/RysnovaQualityGateSummary');
	    expect(schemas.RysnovaDeepeningPackage.properties.downloadManifest.$ref)
	      .toBe('#/components/schemas/RysnovaDownloadManifest');
	    expect(schemas.RysnovaDeepeningPackage.properties.standardsCoverage.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageSummary');
	    expect(schemas.RysnovaDeepeningPackage.properties.engineeringTraceabilityManifest.$ref)
	      .toBe('#/components/schemas/RysnovaEngineeringTraceabilityManifest');
	    expect(schemas.RysnovaDeepeningPackage.properties.installedAssetReadiness.$ref)
	      .toBe('#/components/schemas/RysnovaInstalledAssetReadiness');
	    expect(schemas.RysnovaVisualReadiness.required).toEqual(expect.arrayContaining([
	      'qualityMissingVisuals',
	      'qualityFailedVisuals'
	    ]));
	    expect(schemas.RysnovaVisualReadiness.properties.requirements.additionalProperties.properties.qualityEvidence.$ref)
	      .toBe('#/components/schemas/RysnovaVisualQualityEvidence');
	    expect(schemas.RysnovaVisualReadiness.properties.qualityFailedVisuals.items.required)
	      .toEqual(expect.arrayContaining(['key', 'artifactType', 'artifactId', 'blockers']));
	    expect(schemas.RysnovaVisualQualityEvidence.required).toEqual(expect.arrayContaining([
	      'passed',
	      'status',
	      'type',
	      'visualKey',
	      'checks',
	      'expectedRefs',
	      'blockers',
	      'warnings'
	    ]));
	    expect(schemas.RysnovaVisualQualityEvidence.properties.checks.properties.realtimeControl.enum).toEqual([false]);
	    expect(schemas.RysnovaDeepeningPackage.properties.installedAssetHandoff.anyOf).toEqual(expect.arrayContaining([
	      expect.objectContaining({ $ref: '#/components/schemas/RysnovaInstalledAssetHandoff' }),
	      expect.objectContaining({ type: 'null' })
	    ]));
	    expect(schemas.RysnovaInstalledAssetHandoff.required).toEqual(expect.arrayContaining([
	      'handoffBoundary',
	      'realtimeControl',
	      'targetPlatform',
	      'assetCount',
	      'assets',
	      'requiredBeforeCustomerCare'
	    ]));
	    expect(schemas.RysnovaInstalledAssetHandoff.properties.handoffBoundary.enum).toEqual(['lifecycle_handoff_only']);
	    expect(schemas.RysnovaInstalledAssetHandoff.properties.realtimeControl.const).toBe(false);
	    expect(schemas.RysnovaInstalledAssetHandoff.properties.targetPlatform.enum).toEqual(['external-iot-lifecycle-platform']);
	    expect(schemas.RysnovaInstalledAssetHandoff.properties.assets.items.$ref)
	      .toBe('#/components/schemas/RysnovaInstalledAssetHandoffAsset');
	    expect(schemas.RysnovaInstalledAssetHandoffAsset.required).toEqual(expect.arrayContaining([
	      'assetId',
	      'systemFamily',
	      'brand',
	      'model',
	      'iotBinding'
	    ]));
	    expect(schemas.RysnovaInstalledAssetHandoffAsset.properties.lifecycleState.enum).toEqual(['pending-installation']);
	    expect(schemas.RysnovaInstalledAssetIotBinding.properties.status.enum).toEqual(['handoff-ready-not-bound']);
	    expect(schemas.RysnovaInstalledAssetIotBinding.properties.realtimeControl.const).toBe(false);
	    expect(schemas.RysnovaArtifactStorageEvidence.required).toEqual(expect.arrayContaining([
	      'objectKey',
	      'contentHash',
	      'provider',
	      'sizeBytes',
	      'storageReady'
	    ]));
	    expect(schemas.RysnovaStandardsSummary.properties.coverageStatus.enum)
	      .toEqual(['complete', 'incomplete']);
	    expect(schemas.RysnovaStandardsSummary.properties.requiredCoverageDomains.items.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageDomain');
	    expect(schemas.RysnovaStandardsSummary.properties.coveredCoverageDomains.items.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageDomain');
	    expect(schemas.RysnovaStandardsSummary.properties.missingCoverageDomains.items.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageDomain');
	    expect(schemas.RysnovaCustomerPackage.required).toEqual(expect.arrayContaining([
	      'projectId',
	      'artifacts',
	      'count',
	      'requiredTypes',
	      'missingTypes',
	      'readiness',
	      'quoteSummary',
	      'lifecycleHandoff',
	      'standardsSummary',
	      'standardsCoverage',
	      'qualityGateSummary',
	      'downloadManifest',
	      'customerSignoffManifest',
	      'engineeringTraceabilityManifest',
	      'deliveryStage',
	      'visibility'
	    ]));
	    expect(schemas.RysnovaCustomerPackage.properties.requiredTypes).toEqual(expect.objectContaining({
	      minItems: 7,
	      maxItems: 7,
	      uniqueItems: true,
	      'x-rysnova-bim-signoff-required-types': rysnovaBimSignoffTypes
	    }));
	    expect(schemas.RysnovaCustomerPackage.properties.requiredTypes.allOf.map(item => item.contains.const))
	      .toEqual(rysnovaBimSignoffTypes);
	    expect(schemas.RysnovaCustomerPackage.properties.missingTypes.uniqueItems).toBe(true);
	    expect(schemas.RysnovaCustomerPackage.properties.artifacts.items.$ref).toBe('#/components/schemas/RysnovaCustomerArtifact');
	    expect(schemas.RysnovaCustomerPackage.properties.readiness.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerPackageReadiness');
	    expect(schemas.RysnovaCustomerPackage.properties.quoteSummary.anyOf).toEqual(expect.arrayContaining([
	      expect.objectContaining({ $ref: '#/components/schemas/RysnovaCustomerQuoteSummary' }),
	      expect.objectContaining({ type: 'null' })
	    ]));
	    expect(schemas.RysnovaCustomerPackage.properties.lifecycleHandoff.anyOf).toEqual(expect.arrayContaining([
	      expect.objectContaining({ $ref: '#/components/schemas/RysnovaInstalledAssetHandoff' }),
	      expect.objectContaining({ type: 'null' })
	    ]));
	    expect(schemas.RysnovaCustomerPackage.properties.standardsSummary.$ref)
	      .toBe('#/components/schemas/RysnovaStandardsSummary');
	    expect(schemas.RysnovaCustomerPackage.properties.standardsCoverage.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageSummary');
	    expect(schemas.RysnovaCustomerPackage.properties.qualityGateSummary.$ref)
	      .toBe('#/components/schemas/RysnovaQualityGateSummary');
	    expect(schemas.RysnovaCustomerPackage.properties.downloadManifest.$ref)
	      .toBe('#/components/schemas/RysnovaDownloadManifest');
	    expect(schemas.RysnovaCustomerPackage.properties.customerSignoffManifest.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffManifest');
	    expect(schemas.RysnovaCustomerPackage.properties.engineeringTraceabilityManifest.$ref)
	      .toBe('#/components/schemas/RysnovaEngineeringTraceabilityManifest');
	    expect(schemas.RysnovaCustomerPackage.properties.deliveryStage.enum)
	      .toEqual(['not-ready', 'customer-review-incomplete', 'customer-signoff-ready']);
	    expect(schemas.RysnovaCustomerSignoffManifest.required).toEqual(expect.arrayContaining([
	      'manifestId',
	      'packageType',
	      'projectId',
	      'deliveryStage',
	      'ready',
	      'requiredTypes',
	      'artifactTypes',
	      'artifactCount',
	      'missingTypes',
	      'download',
	      'quoteSummary',
	      'standardsSummary',
	      'standardsCoverage',
	      'lifecycleHandoff',
	      'engineeringTraceabilityManifest',
	      'signoffAction',
	      'artifacts',
	      'boundary',
	      'generatedAt'
	    ]));
	    expect(schemas.RysnovaCustomerSignoffManifest.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.packageType.enum)
	      .toEqual(['rysnova-bim-customer-signoff-manifest']);
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.deliveryStage.enum)
	      .toEqual(['not-ready', 'customer-review-incomplete', 'customer-signoff-ready']);
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.requiredTypes.minItems).toBe(7);
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.requiredTypes.maxItems).toBe(7);
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.download.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffManifestDownload');
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.lifecycleHandoff.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaCustomerSignoffLifecycleSummary' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.standardsCoverage.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/SystemPackStandardsCoverageSummary' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.engineeringTraceabilityManifest.$ref)
	      .toBe('#/components/schemas/RysnovaEngineeringTraceabilityManifest');
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.signoffAction.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffAction');
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.artifacts.items.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffManifestArtifact');
	    expect(schemas.RysnovaCustomerSignoffManifest.properties.boundary.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffBoundary');
	    expect(schemas.RysnovaCustomerSignoffManifestDownload.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffLifecycleSummary.properties.handoffBoundary.enum)
	      .toEqual(['lifecycle_handoff_only']);
	    expect(schemas.RysnovaCustomerSignoffLifecycleSummary.properties.realtimeControl.const).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffLifecycleSummary.properties.standardsCoverageImpact.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaStandardsCoverageImpact' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaCustomerSignoffAction.properties.required.enum)
	      .toEqual(['customer-signature-required', 'complete-evidence-before-signature']);
	    expect(schemas.RysnovaCustomerSignoffAction.properties.requiredCustomerAcknowledgements.items.enum)
	      .toEqual(expect.arrayContaining([
	        'solution-scope-reviewed',
	        'quotation-summary-reviewed',
	        'engineering-deliverables-received',
	        'standards-precheck-reviewed',
	        'lifecycle-handoff-boundary-reviewed'
	      ]));
	    expect(schemas.RysnovaCustomerSignoffManifestArtifact.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffManifestArtifact.properties.signoffStatus.enum)
	      .toEqual(['customer-visible', 'internal-review']);
	    expect(schemas.RysnovaCustomerSignoffBoundary.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffBoundary.properties.customerSafe.const).toBe(true);
	    expect(schemas.RysnovaCustomerSignoffBoundary.properties.omittedFieldGroups.items.enum)
	      .toEqual(['internal-costing', 'tenant-scope', 'approval-audit', 'raw-records']);
	    expect(schemas.RysnovaCustomerSignoffBoundary.properties.handoffBoundary.enum)
	      .toEqual(['lifecycle_handoff_only']);
	    expect(schemas.RysnovaCustomerSignoffBoundary.properties.realtimeControl.const).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffInput.required).toEqual(['acknowledgements']);
	    expect(schemas.RysnovaCustomerSignoffInput.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffInput.properties.customerId).toEqual(expect.objectContaining({
	      type: 'string'
	    }));
	    expect(schemas.RysnovaCustomerSignoffInput.properties.acknowledgements).toEqual(expect.objectContaining({
	      minItems: 5,
	      uniqueItems: true
	    }));
	    expect(schemas.RysnovaCustomerSignoffInput.properties.acknowledgements.items.enum)
	      .toEqual(expect.arrayContaining([
	        'solution-scope-reviewed',
	        'quotation-summary-reviewed',
	        'engineering-deliverables-received',
	        'standards-precheck-reviewed',
	        'lifecycle-handoff-boundary-reviewed'
	      ]));
	    expect(schemas.RysnovaCustomerSignoffInput.properties.signerMobile.writeOnly).toBe(true);
	    expect(schemas.RysnovaCustomerSignoffInput.properties.signatureEvidence.writeOnly).toBe(true);
	    expect(schemas.RysnovaCustomerSignoffEnvelope.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffEnvelope.properties.data.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffResult');
	    expect(schemas.RysnovaCustomerSignoffResult.required).toEqual(expect.arrayContaining([
	      'projectId',
	      'tenantId',
	      'status',
	      'receipt',
	      'customerPackage',
	      'customerSignoffManifest',
	      'lifecycleHandoff',
	      'generatedAt'
	    ]));
	    expect(schemas.RysnovaCustomerSignoffResult.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffResult.properties.status.enum)
	      .toEqual(['customer-signoff-confirmed']);
	    expect(schemas.RysnovaCustomerSignoffResult.properties.receipt.$ref)
	      .toBe('#/components/schemas/RysnovaCustomerSignoffReceipt');
	    expect(schemas.RysnovaCustomerSignoffReceipt.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffReceipt.properties.packageType.enum)
	      .toEqual(['rysnova-bim-customer-signoff-receipt']);
	    expect(schemas.RysnovaCustomerSignoffReceipt.properties.status.enum)
	      .toEqual(['customer-signed']);
	    expect(schemas.RysnovaCustomerSignoffReceipt.properties.deliveryStage.enum)
	      .toEqual(['customer-signoff-ready']);
	    expect(schemas.RysnovaCustomerSignoffReceipt.properties.artifactCount.minimum).toBe(7);
	    expect(schemas.RysnovaCustomerSignoffReceipt.properties.acknowledgements.items.enum)
	      .toEqual(expect.arrayContaining([
	        'solution-scope-reviewed',
	        'quotation-summary-reviewed',
	        'engineering-deliverables-received',
	        'standards-precheck-reviewed',
	        'lifecycle-handoff-boundary-reviewed'
	      ]));
	    expect(schemas.RysnovaCustomerSignoffReceipt.properties.lifecycleHandoff.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaCustomerSignoffLifecycleSummary' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaCustomerSignoffReceiptBoundary.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffReceiptBoundary.properties.customerSafe.const).toBe(true);
	    expect(schemas.RysnovaCustomerSignoffReceiptBoundary.properties.handoffBoundary.enum)
	      .toEqual(['lifecycle_handoff_only']);
	    expect(schemas.RysnovaCustomerSignoffReceiptBoundary.properties.realtimeControl.const).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffReceiptBoundary.properties.noRealtimeControlGranted.const).toBe(true);
	    expect(schemas.RysnovaCustomerSignoffSignatureReceipt.additionalProperties).toBe(false);
	    expect(schemas.RysnovaCustomerSignoffSignatureReceipt.properties.method.enum)
	      .toEqual(['customer_portal_confirmation', 'onsite_tablet_signature', 'dealer_assisted_confirmation']);
	    expect(schemas.RysnovaCustomerSignoffSignatureReceipt.properties.signerMobileHash.pattern)
	      .toBe('^sha256:');
	    expect(schemas.RysnovaCustomerSignoffSignatureReceipt.properties.evidenceHash.pattern)
	      .toBe('^sha256:');
	    expect(schemas.RysnovaCustomerSignoffSignatureReceipt.properties).not.toHaveProperty('signerMobile');
	    expect(schemas.RysnovaCustomerSignoffSignatureReceipt.properties).not.toHaveProperty('signatureEvidence');
	    expect(schemas.RysnovaCustomerPackageReadiness.required).toEqual(expect.arrayContaining([
	      'packageReady',
	      'visualReady',
	      'commercialReady',
	      'standardsPassed',
	      'lifecycleHandoffReady',
	      'customerSignoffReady',
	      'objectStorageIntegrityReady'
	    ]));
	    expect(schemas.RysnovaCustomerQuoteSummary.required).toEqual(expect.arrayContaining([
	      'quotationNo',
	      'currency',
	      'customerTotal',
	      'monthlyPayment',
	      'validDays'
	    ]));
	    expect(schemas.RysnovaCustomerQuoteSummary.properties.standardsCoverageImpact.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaStandardsCoverageImpact' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaInstalledAssetHandoff.properties.standardsCoverageImpact.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaStandardsCoverageImpact' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaStandardsCoverageImpact.required).toEqual(expect.arrayContaining([
	      'status',
	      'coveredDomains',
	      'missingRequiredDomains',
	      'quoteDrivers',
	      'deliverableEvidence',
	      'lifecycleHandoffImpact'
	    ]));
	    expect(schemas.RysnovaStandardsCoverageImpact.properties.coveredDomains.items.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageDomain');
	    expect(schemas.RysnovaQuoteCostSummary.required).toEqual(expect.arrayContaining([
	      'quotationSummary',
	      'installedAssetHandoff',
	      'standardsCoverageImpact',
	      'systemQuoteExplanations'
	    ]));
	    expect(schemas.RysnovaQuoteCostSummary.properties.standardsCoverageImpact.$ref)
	      .toBe('#/components/schemas/RysnovaStandardsCoverageImpact');
	    expect(schemas.RysnovaQuoteCostSummary.properties.systemQuoteExplanations.items.$ref)
	      .toBe('#/components/schemas/RysnovaSystemQuoteExplanation');
	    expect(schemas.RysnovaSystemQuoteExplanation.required).toEqual(expect.arrayContaining([
	      'systemFamily',
	      'standardsDomains',
	      'quoteDrivers',
	      'deliverableEvidence',
	      'lifecycleHandoffImpact',
	      'customerSafeExplanation'
	    ]));
	    expect(schemas.RysnovaSystemQuoteExplanation.properties.standardsDomains.items.$ref)
	      .toBe('#/components/schemas/SystemPackStandardsCoverageDomain');
	    expect(schemas.RysnovaEngineeringTraceabilityArtifactRef.required).toEqual(expect.arrayContaining([
	      'artifactId',
	      'type',
	      'version',
	      'objectKey',
	      'contentHash',
	      'role',
	      'customerVisible'
	    ]));
	    expect(schemas.RysnovaEngineeringTraceabilityArtifactRef.additionalProperties).toBe(false);
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.required).toEqual(expect.arrayContaining([
	      'manifestId',
	      'traceability',
	      'artifactRefs',
	      'visualArtifactTypes',
	      'deliverableArtifactTypes',
	      'linkedArtifacts',
	      'drawingToCommercialLinks',
	      'commercialTraceability',
	      'standardsTraceability',
	      'lifecycleTraceability',
	      'deliverableEvidence',
	      'boundary',
	      'generatedAt'
	    ]));
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.additionalProperties).toBe(false);
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.traceability.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaEngineeringTraceability' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.linkedArtifacts.required)
	      .toEqual(['principleDiagram', 'layout2d', 'scene3d', 'bom', 'quantityTakeoff', 'standardsCheck', 'customerReport']);
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.drawingToCommercialLinks.items.$ref)
	      .toBe('#/components/schemas/RysnovaSystemQuoteExplanation');
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.standardsTraceability.properties.impact.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaStandardsCoverageImpact' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.lifecycleTraceability.properties.handoffBoundary.enum)
	      .toEqual(['lifecycle_handoff_only']);
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.lifecycleTraceability.properties.realtimeControl.const)
	      .toBe(false);
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.boundary.properties.lifecycleHandoffOnly.const)
	      .toBe(true);
	    expect(schemas.RysnovaEngineeringTraceabilityManifest.properties.boundary.properties.internalCostHiddenFromCustomer.const)
	      .toBe(true);
	    expect(schemas.RysnovaCustomerPackage.properties.visibility.properties.scope.enum).toEqual(['customer-visible']);
	    expect(schemas.RysnovaCustomerPackage.properties.visibility.properties.hiddenFields.items.enum).toEqual(expect.arrayContaining([
	      'tenantId',
	      'dealerId',
	      'storeId',
	      'permissions',
	      'metadata',
	      'dealerMargin',
	      'costBaseline',
	      'internalApprovalNotes',
	      'costBreakdown',
	      'marginGuard'
	    ]));
	    expect(Object.keys(schemas.RysnovaCustomerArtifact.properties)).toEqual(expect.arrayContaining([
	      'id',
	      'type',
	      'version',
	      'status',
	      'customerId',
	      'objectKey',
	      'contentHash',
	      'customerVisible',
	      'storage',
	      'engineeringTraceability',
	      'summary',
	      'standards',
	      'qualityGate',
	      'signoff',
	      'deliveryStage'
	    ]));
	    expect(schemas.RysnovaCustomerArtifact.properties.customerId.type)
	      .toEqual(['string', 'null']);
	    expect(schemas.RysnovaCustomerArtifact.properties.qualityGate.$ref)
	      .toBe('#/components/schemas/RysnovaQualityGate');
	    expect(schemas.RysnovaCustomerArtifact.properties.engineeringTraceability.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaEngineeringTraceability' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaCustomerArtifact.properties.signoff.required)
	      .toEqual(['approved', 'approvedAt', 'customerVisible']);
	    expect(schemas.RysnovaCustomerArtifact.properties.signoff.properties.approvedBy)
	      .toBeUndefined();
	    expect(schemas.RysnovaCustomerArtifact.properties.deliveryStage.enum)
	      .toEqual(['blocked', 'customer-ready']);
	    expect(schemas.RysnovaDownloadManifest.required).toEqual(expect.arrayContaining([
	      'ready',
	      'count',
	      'readyCount',
	      'blockedCount',
	      'items',
	      'generatedAt'
	    ]));
	    expect(schemas.RysnovaDownloadManifest.properties.items.items.$ref)
	      .toBe('#/components/schemas/RysnovaDownloadItem');
	    expect(schemas.RysnovaDownloadItem.required).toEqual(expect.arrayContaining([
	      'artifactId',
	      'type',
	      'label',
	      'fileRole',
	      'version',
	      'objectKey',
	      'contentHash',
	      'contentType',
	      'sizeBytes',
	      'provider',
	      'integrityPassed',
	      'downloadReady',
	      'qualityStatus',
	      'signoffStatus',
	      'visualQualityEvidence',
	      'engineeringTraceability',
	      'blockers'
	    ]));
	    expect(schemas.RysnovaDownloadItem.properties.engineeringTraceability.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaEngineeringTraceability' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaDownloadItem.properties.visualQualityEvidence.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaVisualQualityEvidence' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaDownloadItem.properties.fileRole.enum).toEqual(expect.arrayContaining([
	      'principle-diagram',
	      'layout-2d',
	      'bim-or-3d-preview',
	      'commercial-bom',
	      'quantity-takeoff',
	      'standards-compliance',
	      'customer-report'
	    ]));
	    expect(schemas.RysnovaDownloadItem.properties.blockers.items.$ref)
	      .toBe('#/components/schemas/RysnovaReadinessBlocker');
	    expect(schemas.RysnovaArtifactDownloadEnvelope.properties.data.$ref)
	      .toBe('#/components/schemas/RysnovaArtifactDownload');
	    expect(schemas.RysnovaArtifactDownload.required).toEqual(expect.arrayContaining([
	      'artifactId',
	      'projectId',
	      'type',
	      'label',
	      'fileRole',
	      'objectKey',
	      'contentHash',
	      'integrityPassed',
	      'downloadReady',
	      'accessMode',
	      'downloadUrl',
	      'expiresInSeconds',
	      'customerSafe',
	      'visualQualityEvidence',
	      'engineeringTraceability',
	      'qualityGate'
	    ]));
	    expect(schemas.RysnovaArtifactDownload.properties.integrityPassed.const).toBe(true);
	    expect(schemas.RysnovaArtifactDownload.properties.downloadReady.const).toBe(true);
	    expect(schemas.RysnovaArtifactDownload.properties.customerSafe.const).toBe(true);
	    expect(schemas.RysnovaArtifactDownload.properties.accessMode.enum).toEqual(['object-storage-gateway']);
	    expect(schemas.RysnovaArtifactDownload.properties.engineeringTraceability.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaEngineeringTraceability' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaArtifactDownload.properties.visualQualityEvidence.anyOf)
	      .toEqual(expect.arrayContaining([
	        { $ref: '#/components/schemas/RysnovaVisualQualityEvidence' },
	        { type: 'null' }
	      ]));
	    expect(schemas.RysnovaArtifactDownload.additionalProperties).toBe(false);
	    expect(schemas.RysnovaEngineeringTraceability.required).toEqual(expect.arrayContaining([
	      'traceabilityId',
	      'sourceHash',
	      'systemNodes',
	      'visualArtifacts',
	      'standardsRefs',
	      'handoffBoundary',
	      'realtimeControl'
	    ]));
	    expect(schemas.RysnovaEngineeringTraceability.properties.handoffBoundary.enum)
	      .toEqual(['lifecycle_handoff_only']);
	    expect(schemas.RysnovaEngineeringTraceability.properties.realtimeControl.const).toBe(false);
	    expect(schemas.RysnovaEngineeringTraceability.properties.visualArtifacts.properties)
	      .toEqual(expect.objectContaining({
	        principleDiagram: { enum: ['principle-diagram'] },
	        layout2d: { enum: ['construction-drawing'] },
	        scene3d: { enum: ['bim-model'] }
	      }));
	    expect(spec.components.responses.RysnovaArtifactContentSuccess.content['application/octet-stream'].schema).toEqual({
	      type: 'string',
	      format: 'binary'
	    });
	    expect(spec.components.responses.RysnovaArtifactContentSuccess.headers['X-Content-SHA256'].schema.type).toBe('string');
	    expect(spec.components.responses.RysnovaArtifactContentSuccess.headers['X-Rysnova-Artifact-Id'].schema.type).toBe('string');
	    expect(spec.components.responses.RysnovaArtifactContentSuccess.headers['X-Rysnova-Artifact-Type'].schema.type).toBe('string');
	    expect(schemas.RysnovaQualityGate.required).toEqual(expect.arrayContaining([
	      'passed',
	      'status',
	      'checks',
	      'blockers',
	      'warnings'
	    ]));
	    expect(schemas.RysnovaQualityGate.properties.status.enum).toEqual(['passed', 'blocked']);
	    expect(schemas.RysnovaQualityGate.properties.checks.required)
	      .toEqual(expect.arrayContaining(['visualQualityPassed']));
	    expect(schemas.RysnovaQualityGate.properties.checks.properties.visualQualityPassed.type).toBe('boolean');
	    expect(schemas.RysnovaQualityGateSummary.required).toEqual(expect.arrayContaining([
	      'passed',
	      'requiredTypes',
	      'checkedTypes',
	      'missingTypes',
	      'failedArtifacts',
	      'warningCount',
	      'checkedAt'
	    ]));
	    expect(schemas.RysnovaArtifactSignoffEvidence.required).toEqual(expect.arrayContaining([
	      'artifactId',
	      'type',
	      'version',
	      'status',
	      'customerVisible',
	      'objectKey',
	      'contentHash',
	      'qualityGate'
	    ]));
	    for (const forbidden of ['tenantId', 'dealerId', 'storeId', 'permissions', 'metadata', 'createdBy', 'approvedBy']) {
	      expect(schemas.RysnovaCustomerArtifact.properties).not.toHaveProperty(forbidden);
	    }
	    expect(schemas.RysnovaDeliverableArtifactsInput.properties.systems.items.type).toEqual(['object', 'string']);
    expect(schemas.HealthObservability.properties.boundary.enum).toEqual(['observability-baseline']);
    expect(schemas.ObservabilitySignals.properties.traces.enum).toEqual(['request-id-and-trace-id']);
    expect(schemas.ObservabilitySlo.properties.status.enum).toEqual(['within_slo', 'slo_risk']);
    expect(schemas.AnalyticsOverview.properties.scope.properties.visibility.enum).toEqual(['tenant-wide', 'dealer-scoped']);
    expect(schemas.DiagnosisCompletion.required).toEqual(expect.arrayContaining([
      'moduleId',
      'moduleDeploymentMode',
      'moduleNamespace',
      'dataNamespace',
      'source',
      'customer',
      'opportunity',
      'diagnosis',
      'solutions',
      'recommendedTierId',
      'visualPackages',
      'quotationSummary',
      'customerReport',
      'nextActions',
      'iotBoundary'
    ]));
    expect(schemas.DiagnosisCompletion.properties.moduleId.enum).toEqual(['rysnova-consumer-system']);
    expect(schemas.DiagnosisCompletion.properties.moduleDeploymentMode.enum).toEqual(['rhautt-portal-embedded', 'standalone']);
    expect(schemas.DiagnosisCompletion.properties.moduleNamespace.enum).toEqual(['rysnova']);
    expect(schemas.DiagnosisCompletion.properties.dataNamespace.enum).toEqual(['rysnova']);
    expect(schemas.DiagnosisCompletion.properties.source.enum).toEqual(['rysnova-ai-diagnosis']);
    expect(schemas.DiagnosisCompletion.properties.iotBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.DiagnosisSolutionTier.properties.id.enum).toEqual(['essential', 'balanced', 'premium']);
    expect(schemas.DiagnosisSolutionTier.properties.equipmentBrands.items.enum).toEqual(['Rheem', 'Ruud', 'Everhot']);
    expect(schemas.DiagnosisVisualPackages.required).toEqual(expect.arrayContaining([
      'version',
      'generatedAt',
      'status',
      'tiers'
    ]));
    expect(schemas.DiagnosisVisualPackages.properties.tiers.required).toEqual(['essential', 'balanced', 'premium']);
    expect(schemas.DiagnosisVisualTierPackage.properties.tier.enum).toEqual(['essential', 'balanced', 'premium']);
    expect(schemas.DiagnosisVisualSet.required).toEqual(['principleDiagram', 'layout2d', 'scene3d']);
    expect(schemas.DiagnosisVisualArtifact.properties.label.enum).toEqual(expect.arrayContaining([
      '设计原理图',
      '2D布局图',
      '3D示意图'
    ]));
    expect(schemas.DiagnosisCustomerReport.properties.type.enum).toEqual(['rysnova-ai-diagnosis-report']);
    expect(schemas.DiagnosisCustomerReport.properties.shareToken.description).toContain('persist only a hash');
    expect(schemas.DiagnosisPublicReport.required).toEqual(expect.arrayContaining([
      'reportId',
      'moduleId',
      'moduleDeploymentMode',
      'moduleNamespace',
      'dataNamespace',
      'source',
      'status',
      'customer',
      'project',
      'diagnosis',
      'solutions',
      'recommendedTierId',
      'visualPackages',
      'quotationSummary',
      'customerReport',
      'nextActions',
      'iotBoundary'
    ]));
    expect(schemas.DiagnosisPublicReport.properties.moduleId.enum).toEqual(['rysnova-consumer-system']);
    expect(schemas.DiagnosisPublicReport.properties.moduleDeploymentMode.enum).toEqual(['rhautt-portal-embedded', 'standalone']);
    expect(schemas.DiagnosisPublicReport.properties.moduleNamespace.enum).toEqual(['rysnova']);
    expect(schemas.DiagnosisPublicReport.properties.dataNamespace.enum).toEqual(['rysnova']);
    expect(schemas.DiagnosisPublicReport.properties.source.enum).toEqual(['rysnova-ai-diagnosis']);
    expect(schemas.DiagnosisPublicReport.properties.iotBoundary.enum).toEqual(['lifecycle_handoff_only']);
    expect(schemas.DiagnosisPublicReport.properties.visualPackages.$ref).toBe('#/components/schemas/DiagnosisVisualPackages');
    expect(schemas.DiagnosisPublicReport.properties.solutions.items.$ref).toBe('#/components/schemas/DiagnosisSolutionTier');
    expect(spec.paths['/api/v2/diagnosis/public/complete'].post.security).toBeUndefined();
    expect(spec.paths['/api/v2/diagnosis/public/reports/{reportId}'].get.security).toBeUndefined();
    expect(spec.paths['/api/v2/diagnosis/complete'].post.security).toEqual([{ bearerAuth: [] }]);
  });

  test('generated TypeScript client is synchronized with OpenAPI hash and operations', () => {
    const spec = loadSpec();
    const client = fs.readFileSync(clientPath, 'utf8');
    const hash = sha256(specPath);

    expect(client).toContain(`OPENAPI_SHA256 = '${hash}'`);
    expect(client).toContain('export class RhauttNexusClient');
    expect(client).toContain('export type RysnovaTierComparison =');
    expect(client).toContain('export type RysnovaTierComparisonItem =');
    expect(client).toContain('selectedTier: "essential" | "balanced" | "premium";');
    expect(client).toContain('tierCount: 3;');
    expect(client).toContain('lifecycleHandoffOnly: true;');
    expect(client).toContain('realtimeControl: false;');
    expect(client).toContain('export type RysnovaVisualQualityEvidence =');
    expect(client).toContain('export type RysnovaQualityGate =');
    expect(client).toContain('export type RysnovaArtifactDownload =');
    expect(client).toContain('visualQualityEvidence: RysnovaVisualQualityEvidence | null;');
    expect(client).toContain('visualQualityPassed: boolean;');
    expect(client).toContain('private async requestBlob');
    expect(client).toContain('async downloadRysnovaArtifactContent(params: ClientParams = {}): Promise<Response>');
    expect(client).toContain('return this.requestBlob("GET", "/api/v2/rysnova-bim/artifacts/{artifactId}/download/content", params);');

    for (const item of operations(spec)) {
      if (item.operation.operationId === 'downloadRysnovaArtifactContent') {
        expect(client).toContain(`async ${item.operation.operationId}(params: ClientParams = {}): Promise<Response>`);
      } else {
        expect(client).toContain(`async ${item.operation.operationId}<`);
      }
    }
  });

  test('generated client guard passes', () => {
    const output = execSync('node scripts/agent-guards/generated-client-check.js', {
      cwd: ROOT,
      encoding: 'utf8'
    });

    expect(output).toContain('Generated Client Check: failures = 0');
  });
});
