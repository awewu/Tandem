#!/usr/bin/env node

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
const DiagnosisReport = require('../../server/models/DiagnosisReport');
const OutboxEvent = require('../../server/models/OutboxEvent');
const Quotation = require('../../server/models/Quotation');
const QuotationV2 = require('../../server/models/QuotationV2');
const BaseRepository = require('../../server/repositories/BaseRepository');
const fs = require('fs');
const path = require('path');

const failures = [];
const warnings = [];
const ROOT = path.join(__dirname, '..', '..');

const TENANT_SCOPED_MODELS = [
  { model: Dealer, name: 'Dealer', required: ['tenantId'], indexes: ['tenantId_1_code_1', 'tenantId_1_status_1', 'tenantId_1_province_1_city_1'] },
  { model: Store, name: 'Store', required: ['tenantId', 'dealerId'], indexes: ['tenantId_1_dealerId_1_code_1', 'tenantId_1_dealerId_1_status_1'] },
  { model: UserV2, name: 'UserV2', required: ['tenantId'], indexes: ['phone_1', 'tenantId_1_dealerId_1_role_1_status_1', 'tenantId_1_storeId_1_status_1'] },
  { model: CustomerV2, name: 'CustomerV2', required: ['tenantId', 'phoneHash', 'phoneEncrypted'], indexes: ['tenantId_1_phoneHash_1', 'tenantId_1_ownerUserId_1_status_1_updatedAt_-1', 'tenantId_1_storeId_1_status_1_lastInteractionAt_-1', 'tenantId_1_productModuleId_1_productDeploymentMode_1_updatedAt_-1', 'tenantId_1_productDataNamespace_1_productDeploymentMode_1_updatedAt_-1'] },
  { model: Opportunity, name: 'Opportunity', required: ['tenantId', 'customerId'], indexes: ['tenantId_1_ownerUserId_1_stage_1_updatedAt_-1', 'tenantId_1_storeId_1_stage_1_updatedAt_-1', 'tenantId_1_customerId_1', 'tenantId_1_productModuleId_1_productDeploymentMode_1_updatedAt_-1', 'tenantId_1_productDataNamespace_1_productDeploymentMode_1_updatedAt_-1'] },
  { model: Interaction, name: 'Interaction', required: ['tenantId', 'customerId'], indexes: ['tenantId_1_customerId_1_createdAt_-1', 'tenantId_1_actorUserId_1_createdAt_-1'] },
  { model: AuditLog, name: 'AuditLog', required: ['tenantId', 'action', 'resourceType'], indexes: ['tenantId_1_resourceType_1_resourceId_1_createdAt_-1', 'tenantId_1_actorUserId_1_createdAt_-1'] },
  { model: LifecycleLink, name: 'LifecycleLink', required: ['tenantId', 'customerId', 'contractId'], indexes: ['tenantId_1_contractId_1', 'tenantId_1_customerId_1_lifecycleStage_1_updatedAt_-1', 'tenantId_1_installedAssets.assetId_1', 'tenantId_1_handoverStatus_1_updatedAt_-1'] },
  { model: DiagnosisReport, name: 'DiagnosisReport', required: ['tenantId', 'reportId', 'shareTokenHash'], indexes: ['tenantId_1_reportId_1', 'tenantId_1_shareTokenHash_1', 'tenantId_1_moduleId_1_moduleDeploymentMode_1_updatedAt_-1', 'tenantId_1_dataNamespace_1_moduleDeploymentMode_1_updatedAt_-1', 'tenantId_1_customerId_1_updatedAt_-1', 'tenantId_1_status_1_updatedAt_-1'] },
  { model: OutboxEvent, name: 'OutboxEvent', required: ['tenantId', 'aggregateType', 'aggregateId', 'eventType', 'payload', 'idempotencyKey'], indexes: ['tenantId_1_idempotencyKey_1', 'status_1_availableAt_1_attempts_1', 'tenantId_1_aggregateType_1_aggregateId_1_createdAt_-1'] },
  { model: Quotation, name: 'Quotation', required: ['tenantId', 'quotationNo'], indexes: ['tenantId_1_quotationNo_1', 'tenantId_1_dealerId_1_status_1_createdAt_-1', 'tenantId_1_storeId_1_status_1_createdAt_-1'] },
  { model: QuotationV2, name: 'QuotationV2', required: ['tenantId', 'customerId', 'quotationNo'], indexes: ['tenantId_1_quotationNo_1', 'tenantId_1_customerId_1_status_1_updatedAt_-1', 'tenantId_1_dealerId_1_status_1_createdAt_-1', 'tenantId_1_storeId_1_status_1_createdAt_-1', 'tenantId_1_productModuleId_1_productDeploymentMode_1_updatedAt_-1', 'tenantId_1_productDataNamespace_1_productDeploymentMode_1_updatedAt_-1'] }
];

function indexNames(model) {
  return model.schema.indexes().map(([fields]) => Object.entries(fields).map(([key, value]) => `${key}_${value}`).join('_'));
}

function indexSpec(model, expectedName) {
  return model.schema.indexes().find(([fields]) => Object.entries(fields).map(([key, value]) => `${key}_${value}`).join('_') === expectedName);
}

function assertPathRequired(model, modelName, field) {
  const schemaPath = model.schema.path(field);
  if (!schemaPath) {
    failures.push(`${modelName}: missing field ${field}`);
    return;
  }
  if (!schemaPath.isRequired && field !== 'tenantId') {
    failures.push(`${modelName}: field ${field} must be required`);
  }
  if (field === 'tenantId' && !schemaPath.isRequired) {
    failures.push(`${modelName}: tenantId must be required for tenant-scoped persistence`);
  }
}

function assertObjectId(model, modelName, field) {
  const schemaPath = model.schema.path(field);
  if (!schemaPath) {
    failures.push(`${modelName}: missing ObjectId field ${field}`);
    return;
  }
  if (schemaPath.instance !== 'ObjectId') {
    warnings.push(`${modelName}: ${field} is ${schemaPath.instance}; migrate to ObjectId before Mongo-backed launch if it joins tenant-scoped collections`);
  }
}

function assertUniqueTenantIndex(model, modelName, expectedName) {
  const spec = indexSpec(model, expectedName);
  if (!spec) {
    failures.push(`${modelName}: missing required unique index ${expectedName}`);
    return;
  }
  const [, options] = spec;
  if (!options || options.unique !== true) failures.push(`${modelName}: index ${expectedName} must be unique`);
}

function assertIndexes(model, modelName, expectedIndexes) {
  const names = indexNames(model);
  for (const expected of expectedIndexes) {
    if (!names.includes(expected)) failures.push(`${modelName}: missing index ${expected}`);
  }
}

function assertNoGlobalUniqueBusinessKey(model, modelName, allowedGlobalUnique = []) {
  for (const [fields, options = {}] of model.schema.indexes()) {
    if (!options.unique) continue;
    const keys = Object.keys(fields);
    if (keys.includes('tenantId')) continue;
    const name = keys.map(key => `${key}_${fields[key]}`).join('_');
    if (!allowedGlobalUnique.includes(name)) {
      failures.push(`${modelName}: unique business index ${name} must include tenantId`);
    }
  }
}

function assertRepositoryTenantGuard() {
  const repo = new BaseRepository({
    findOne: () => ({ lean: () => null })
  });

  try {
    repo.withTenant({}, { status: 'active' });
    failures.push('BaseRepository.withTenant must reject missing tenantId');
  } catch (error) {
    if (!String(error.message).includes('tenantId is required')) {
      failures.push('BaseRepository.withTenant rejection must explain missing tenantId');
    }
  }

  const scoped = repo.withTenant({ tenantId: 'tenant-a' }, { status: 'active' });
  if (scoped.tenantId !== 'tenant-a' || scoped.status !== 'active') {
    failures.push('BaseRepository.withTenant must inject tenantId into query');
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertProductionDatabaseFailFast() {
  const dbSource = read('server/db/index.js');
  const serverSource = read('server-production.js');

  if (!dbSource.includes('isProductionDatabaseRequired')) {
    failures.push('server/db/index.js: missing isProductionDatabaseRequired guard');
  }
  if (!/NODE_ENV\s*===\s*['"`]production['"`]/.test(dbSource)) {
    failures.push('server/db/index.js: production database guard must inspect NODE_ENV=production');
  }
  if (!/REQUIRE_MONGODB\s*===\s*['"`]true['"`]/.test(dbSource)) {
    failures.push('server/db/index.js: staging gates must support REQUIRE_MONGODB=true');
  }
  if (!/throw\s+lastError|throw\s+new Error/.test(dbSource)) {
    failures.push('server/db/index.js: required MongoDB mode must throw instead of silently falling back to memory');
  }
  if (!/await\s+dbLayer\.connect\(\)/.test(serverSource)) {
    failures.push('server-production.js: must await dbLayer.connect() before listening');
  }
  if (!/require\.main\s*===\s*module/.test(serverSource)) {
    failures.push('server-production.js: must not auto-start when imported by tests');
  }
}

function assertAuditTrailContract() {
  const auditServiceSource = read('server/modules/audit/audit.service.js');

  for (const token of [
    'class AuditService',
    'tenantId is required for audit logging',
    'audit action and resourceType are required',
    'this.auditRepo.create',
    'this.auditRepo.list'
  ]) {
    if (!auditServiceSource.includes(token)) failures.push(`AuditService contract missing token: ${token}`);
  }
  // 退场波1(2026-08-06)：本地 v2.router 已退役，/api/v2/audit 由 NestJS(services/api audit-log) 服务；
  // 移除对已删 v2.router.js 的挂载断言。
}

function main() {
  assertUniqueTenantIndex(Tenant, 'Tenant', 'code_1');
  assertIndexes(Tenant, 'Tenant', ['status_1_updatedAt_-1']);
  assertNoGlobalUniqueBusinessKey(Tenant, 'Tenant', ['code_1']);

  for (const spec of TENANT_SCOPED_MODELS) {
    for (const field of spec.required) assertPathRequired(spec.model, spec.name, field);
    assertObjectId(spec.model, spec.name, 'tenantId');
    assertIndexes(spec.model, spec.name, spec.indexes);
    assertNoGlobalUniqueBusinessKey(spec.model, spec.name, spec.name === 'UserV2' ? ['phone_1'] : []);
  }

  assertObjectId(CustomerV2, 'CustomerV2', 'ownerUserId');
  assertObjectId(Opportunity, 'Opportunity', 'customerId');
  assertObjectId(LifecycleLink, 'LifecycleLink', 'customerId');
  if (!LifecycleLink.schema.path('installedAssets')) {
    failures.push('LifecycleLink: missing installedAssets handoff registry');
  }
  if (!LifecycleLink.schema.path('iot.capabilityRegistry')) {
    failures.push('LifecycleLink: missing iot.capabilityRegistry handoff registry');
  }
  if (!LifecycleLink.schema.path('servicePlan.status')) {
    failures.push('LifecycleLink: missing servicePlan.status lifecycle state');
  }
  assertObjectId(QuotationV2, 'QuotationV2', 'customerId');
  assertObjectId(QuotationV2, 'QuotationV2', 'dealerId');
  assertObjectId(QuotationV2, 'QuotationV2', 'storeId');
  for (const [model, modelName] of [[CustomerV2, 'CustomerV2'], [Opportunity, 'Opportunity'], [QuotationV2, 'QuotationV2']]) {
    if (!model.schema.path('productModuleId')) failures.push(`${modelName}: missing productModuleId for standalone product module separation`);
    if (!model.schema.path('productDeploymentMode')) failures.push(`${modelName}: missing productDeploymentMode for embedded/standalone separation`);
    if (!model.schema.path('productNamespace')) failures.push(`${modelName}: missing productNamespace for standalone product module separation`);
    if (!model.schema.path('productDataNamespace')) failures.push(`${modelName}: missing productDataNamespace for future product-domain database extraction`);
  }
  for (const [model, modelName] of [[DiagnosisReport, 'DiagnosisReport']]) {
    if (!model.schema.path('moduleNamespace')) failures.push(`${modelName}: missing moduleNamespace for standalone product module separation`);
    if (!model.schema.path('dataNamespace')) failures.push(`${modelName}: missing dataNamespace for future product-domain database extraction`);
  }
  assertUniqueTenantIndex(QuotationV2, 'QuotationV2', 'tenantId_1_quotationNo_1');
  assertUniqueTenantIndex(OutboxEvent, 'OutboxEvent', 'tenantId_1_idempotencyKey_1');

  const quotationCustomer = Quotation.schema.path('customerId');
  if (quotationCustomer && quotationCustomer.instance !== 'ObjectId' && !QuotationV2.schema.path('customerId')) {
    warnings.push('Quotation: customerId is String and QuotationV2 persistence is missing; migrate quote persistence to v2 customer graph');
  }

  assertRepositoryTenantGuard();
  assertProductionDatabaseFailFast();
  assertAuditTrailContract();

  console.log(`Database Schema Check: models = ${TENANT_SCOPED_MODELS.length + 1}, failures = ${failures.length}, warnings = ${warnings.length}`);

  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  for (const warning of warnings) console.warn(`- ${warning}`);

  mongoose.connection.close().catch(() => {});
}

main();
