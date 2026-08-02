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
      '/api/v2/analytics/overview',
      '/api/v2/audit/events',
      '/api/v2/lifecycle/handover',
      '/api/v2/lifecycle/handover/{contractId}/handoff-package',
      '/api/v2/lifecycle/customer-projects',
      '/api/v2/lifecycle/customer-projects/{contractId}',
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
    expect(ids.has('getHealthHeartbeat')).toBe(true);
    expect(ids.has('getHealthObservability')).toBe(true);
  });

  test('high-value production APIs use concrete business schemas instead of generic envelopes', () => {
    const spec = loadSpec();

    expect(successRef(spec, '/api/v2/analytics/overview', 'get')).toBe('#/components/responses/AnalyticsOverviewSuccess');
    expect(successRef(spec, '/api/v2/diagnosis/complete', 'post', '201')).toBe('#/components/responses/DiagnosisCompletionSuccess');
    expect(successRef(spec, '/api/v2/diagnosis/public/complete', 'post', '201')).toBe('#/components/responses/DiagnosisCompletionSuccess');
    expect(successRef(spec, '/api/v2/diagnosis/public/reports/{reportId}', 'get')).toBe('#/components/responses/DiagnosisPublicReportSuccess');
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

  test('domain schemas preserve lifecycle-only IoT handoff', () => {
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
  });

  test('generated TypeScript client is synchronized with OpenAPI hash and operations', () => {
    const spec = loadSpec();
    const client = fs.readFileSync(clientPath, 'utf8');
    const hash = sha256(specPath);

    expect(client).toContain(`OPENAPI_SHA256 = '${hash}'`);
    expect(client).toContain('export class RhauttNexusClient');

    for (const item of operations(spec)) {
      expect(client).toContain(`async ${item.operation.operationId}<`);
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
