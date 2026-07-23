const mongoose = require('mongoose');

const Tenant = require('../../server/models/Tenant');
const Dealer = require('../../server/models/Dealer');
const Store = require('../../server/models/Store');
const UserV2 = require('../../server/models/UserV2');
const CustomerV2 = require('../../server/models/CustomerV2');
const Opportunity = require('../../server/models/Opportunity');
const Interaction = require('../../server/models/Interaction');
const AuditLog = require('../../server/models/AuditLog');
const LifecycleLink = require('../../server/models/LifecycleLink');
const RysnovaArtifact = require('../../server/models/RysnovaArtifact');
const OutboxEvent = require('../../server/models/OutboxEvent');
const Quotation = require('../../server/models/Quotation');
const QuotationV2 = require('../../server/models/QuotationV2');

describe('production multitenant models', () => {
  test('core models expose tenant-aware indexes', () => {
    const specs = [
      [Tenant, ['code_1']],
      [Dealer, ['tenantId_1_code_1', 'tenantId_1_status_1']],
      [Store, ['tenantId_1_dealerId_1_code_1', 'tenantId_1_dealerId_1_status_1']],
      [UserV2, ['phone_1', 'tenantId_1_dealerId_1_role_1_status_1', 'tenantId_1_customerId_1_role_1_status_1']],
      [CustomerV2, ['tenantId_1_phoneHash_1', 'tenantId_1_ownerUserId_1_status_1_updatedAt_-1', 'tenantId_1_productModuleId_1_productDeploymentMode_1_updatedAt_-1']],
      [Opportunity, ['tenantId_1_ownerUserId_1_stage_1_updatedAt_-1', 'tenantId_1_customerId_1', 'tenantId_1_productModuleId_1_productDeploymentMode_1_updatedAt_-1']],
      [Interaction, ['tenantId_1_customerId_1_createdAt_-1']],
      [AuditLog, ['tenantId_1_resourceType_1_resourceId_1_createdAt_-1']],
      [LifecycleLink, ['tenantId_1_contractId_1', 'tenantId_1_customerId_1_lifecycleStage_1_updatedAt_-1', 'tenantId_1_installedAssets.assetId_1']],
      [RysnovaArtifact, [
        'tenantId_1_projectId_1_type_1_version_-1',
        'tenantId_1_customerId_1_projectId_1_status_1_permissions.customerVisible_1_updatedAt_-1',
        'tenantId_1_dataNamespace_1_metadata.storage.integrityPassed_1_updatedAt_-1',
        'tenantId_1_objectKey_1'
      ]],
      [OutboxEvent, ['tenantId_1_idempotencyKey_1', 'status_1_availableAt_1_attempts_1']],
      [Quotation, ['tenantId_1_quotationNo_1', 'tenantId_1_dealerId_1_status_1_createdAt_-1']],
      [QuotationV2, ['tenantId_1_quotationNo_1', 'tenantId_1_customerId_1_status_1_updatedAt_-1', 'tenantId_1_productModuleId_1_productDeploymentMode_1_updatedAt_-1']]
    ];

    for (const [model, expectedIndexNames] of specs) {
      const indexes = model.schema.indexes().map(([fields]) => Object.entries(fields).map(([k, v]) => `${k}_${v}`).join('_'));
      for (const name of expectedIndexNames) {
        expect(indexes).toContain(name);
      }
    }
  });

  test('tenant-scoped documents include required tenant field', () => {
    for (const model of [Dealer, Store, UserV2, CustomerV2, Opportunity, Interaction, AuditLog, LifecycleLink, RysnovaArtifact, OutboxEvent, Quotation, QuotationV2]) {
      expect(model.schema.path('tenantId')).toBeTruthy();
    }
  });

  test('object id fields are represented consistently', () => {
    expect(UserV2.schema.path('tenantId').instance).toBe('ObjectId');
    expect(UserV2.schema.path('customerId').instance).toBe('ObjectId');
    expect(CustomerV2.schema.path('ownerUserId').instance).toBe('ObjectId');
    expect(Opportunity.schema.path('customerId').instance).toBe('ObjectId');
    expect(LifecycleLink.schema.path('customerId').instance).toBe('ObjectId');
    expect(LifecycleLink.schema.path('installedAssets')).toBeTruthy();
    expect(LifecycleLink.schema.path('iot.capabilityRegistry')).toBeTruthy();
    expect(LifecycleLink.schema.path('servicePlan.status')).toBeTruthy();
    expect(RysnovaArtifact.schema.path('customerId').instance).toBe('ObjectId');
    expect(OutboxEvent.schema.path('tenantId').instance).toBe('ObjectId');
    expect(Quotation.schema.path('tenantId').instance).toBe('ObjectId');
    expect(QuotationV2.schema.path('tenantId').instance).toBe('ObjectId');
    expect(QuotationV2.schema.path('customerId').instance).toBe('ObjectId');
    for (const model of [CustomerV2, Opportunity, QuotationV2]) {
      expect(model.schema.path('productModuleId')).toBeTruthy();
      expect(model.schema.path('productDeploymentMode')).toBeTruthy();
      expect(model.schema.path('productNamespace')).toBeTruthy();
      expect(model.schema.path('productDataNamespace')).toBeTruthy();
    }
    for (const model of [RysnovaArtifact]) {
      expect(model.schema.path('moduleId')).toBeTruthy();
      expect(model.schema.path('moduleDeploymentMode')).toBeTruthy();
      expect(model.schema.path('moduleNamespace')).toBeTruthy();
      expect(model.schema.path('dataNamespace')).toBeTruthy();
    }
  });
});
