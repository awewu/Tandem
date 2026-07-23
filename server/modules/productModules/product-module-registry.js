const DEPLOYMENT_MODES = Object.freeze({
  RHAUTT_PORTAL_EMBEDDED: 'rhautt-portal-embedded',
  STANDALONE: 'standalone',
  SHARED_PLATFORM: 'shared-platform'
});

const MODULE_IDS = Object.freeze({
  RYSNOVA_CONSUMER_SYSTEM: 'rysnova-consumer-system',
  RYSNOVA_ENGINEERING_SUPPORT: 'rysnova-bim-engineering-support',
  RHAUTT_SHARED_PLATFORM: 'rhautt-shared-platform'
});

const PRODUCT_DATABASE_STRATEGY = 'namespace-extractable-shared-ledger';
const PRODUCT_BOUNDARY = 'independent-product-domain';
const POWERED_BY = 'Powered by Rhautt Comfort';
const CURRENT_DATA_MODE = 'shared-foundation-product-domain-partitioned';
const FUTURE_DATA_MODE = 'standalone-database-extractable';
const STANDALONE_DOMAIN_STRATEGY = 'dedicated-domain-or-subdomain-required';
const STANDALONE_APP_SHELL_MODE = 'independent-product-app-shell';
const PRODUCT_INDEPENDENCE_LEVEL = 'portal-embedded-and-standalone-extractable';
const SHARED_FOUNDATION_TABLES = Object.freeze([
  'tenants',
  'dealers',
  'stores',
  'users',
  'audit_logs',
  'outbox_events',
  'workflow_instances',
  'workflow_steps'
]);
const PRODUCT_EXTRACTION_KEYS = Object.freeze([
  'tenantId',
  'productModuleId',
  'productDeploymentMode',
  'productNamespace',
  'productDataNamespace',
  'moduleId',
  'moduleDeploymentMode',
  'moduleNamespace',
  'dataNamespace',
  'objectStoragePrefix',
  'apiNamespace'
]);

const MODULES = Object.freeze({
  rysnova: Object.freeze({
    id: MODULE_IDS.RYSNOVA_CONSUMER_SYSTEM,
    namespace: 'rysnova',
    dataNamespace: 'rysnova',
    apiNamespace: '/api/v2/diagnosis',
    displayName: '瑞诺瓦',
    kind: 'consumer-comfort-system-brand',
    ownershipModel: PRODUCT_BOUNDARY,
    defaultDeploymentMode: DEPLOYMENT_MODES.RHAUTT_PORTAL_EMBEDDED,
    supportedDeploymentModes: [DEPLOYMENT_MODES.RHAUTT_PORTAL_EMBEDDED, DEPLOYMENT_MODES.STANDALONE],
    standaloneAliases: ['/rysnova', '/rysnova-ai', '/rysnova-diagnosis'],
    embeddedEntry: '/pain-diagnosis.html',
    customerEntry: '/customer-share.html',
    poweredBy: POWERED_BY,
    productIndependenceLevel: PRODUCT_INDEPENDENCE_LEVEL,
    standaloneDomainStrategy: STANDALONE_DOMAIN_STRATEGY,
    standaloneAppShellMode: STANDALONE_APP_SHELL_MODE,
    targetApp: 'apps/consumer-diagnosis',
    objectStoragePrefix: 'rysnova/',
    analyticsNamespace: 'rysnova',
    futureDatabaseStrategy: PRODUCT_DATABASE_STRATEGY,
    standalonePostgresSchema: 'rysnova',
    standaloneMongoDatabase: 'rysnova_documents',
    standaloneObjectStorageBucket: 'rysnova-product-artifacts',
    databaseIndependence: Object.freeze({
      currentDataMode: CURRENT_DATA_MODE,
      futureDataMode: FUTURE_DATA_MODE,
      sharedFoundationTables: SHARED_FOUNDATION_TABLES,
      ownedPostgresTables: ['customers', 'opportunities', 'quotations'],
      ownedMongoNamespaces: ['DiagnosisReport.moduleNamespace=rysnova'],
      ownedObjectStoragePrefix: 'rysnova/',
      standalonePostgresSchema: 'rysnova',
      standaloneMongoDatabase: 'rysnova_documents',
      standaloneObjectStorageBucket: 'rysnova-product-artifacts',
      requiredExtractionKeys: PRODUCT_EXTRACTION_KEYS,
      standaloneDatabaseTarget: 'rysnova-owned-postgres-schema-plus-mongodb-namespace',
      extractionProofRequired: true,
      futureStandaloneProductReady: true,
      extractionPlan: 'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix'
    }),
    portalIntegration: Object.freeze({
      embeddedInRhauttPortal: true,
      embeddedEntry: '/pain-diagnosis.html',
      customerEntry: '/customer-share.html'
    }),
    standaloneProductization: Object.freeze({
      launchable: true,
      aliases: ['/rysnova', '/rysnova-ai', '/rysnova-diagnosis'],
      targetApp: 'apps/consumer-diagnosis',
      appShellMode: STANDALONE_APP_SHELL_MODE,
      domainStrategy: STANDALONE_DOMAIN_STRATEGY,
      standaloneDomainTargets: ['pending-dedicated-rysnova-domain-or-subdomain'],
      externalDomainProofRequired: true,
      databaseExtractionReady: true
    }),
    dataBoundary: Object.freeze({
      postgresRegistry: 'rhautt_nexus.product_modules',
      deploymentRegistry: 'rhautt_nexus.product_module_deployments',
      dataPartitionRegistry: 'rhautt_nexus.product_module_data_partitions',
      moduleNamespace: 'rysnova',
      dataNamespace: 'rysnova',
      productNamespace: 'rysnova',
      productDataNamespace: 'rysnova',
      objectStoragePrefix: 'rysnova/',
      analyticsNamespace: 'rysnova',
      futureDatabaseStrategy: PRODUCT_DATABASE_STRATEGY,
      productIndependenceLevel: PRODUCT_INDEPENDENCE_LEVEL,
      standaloneDomainStrategy: STANDALONE_DOMAIN_STRATEGY,
      standaloneAppShellMode: STANDALONE_APP_SHELL_MODE,
      currentDataMode: CURRENT_DATA_MODE,
      futureDataMode: FUTURE_DATA_MODE,
      sharedFoundationTables: SHARED_FOUNDATION_TABLES,
      ownedPostgresTables: ['customers', 'opportunities', 'quotations'],
      ownedMongoNamespaces: ['DiagnosisReport.moduleNamespace=rysnova'],
      standalonePostgresSchema: 'rysnova',
      standaloneMongoDatabase: 'rysnova_documents',
      standaloneObjectStorageBucket: 'rysnova-product-artifacts',
      requiredExtractionKeys: PRODUCT_EXTRACTION_KEYS,
      standaloneDatabaseTarget: 'rysnova-owned-postgres-schema-plus-mongodb-namespace',
      extractionProofRequired: true,
      futureStandaloneProductReady: true,
      postgresPartitionKey: 'product_data_namespace',
      mongodbNamespace: 'DiagnosisReport.moduleNamespace=rysnova',
      independentDatabaseReady: true,
      extractionPlan: 'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix'
    }),
    source: 'rysnova-ai-diagnosis',
    legacySources: ['rysnova-ai-diagnosis'],
    channel: 'rysnova-public-diagnosis',
    legacyChannels: ['rysnova-public-diagnosis'],
    reportType: 'rysnova-ai-diagnosis-report',
    legacyReportTypes: ['rysnova-ai-diagnosis-report']
  }),
  rysnovaBim: Object.freeze({
    id: MODULE_IDS.RYSNOVA_ENGINEERING_SUPPORT,
    namespace: 'rysnova-bim',
    dataNamespace: 'rysnova-bim',
    apiNamespace: '/api/v2/rysnova-bim',
    displayName: 'Rysnova',
    kind: 'engineering-bim-technical-support',
    ownershipModel: PRODUCT_BOUNDARY,
    defaultDeploymentMode: DEPLOYMENT_MODES.RHAUTT_PORTAL_EMBEDDED,
    supportedDeploymentModes: [DEPLOYMENT_MODES.RHAUTT_PORTAL_EMBEDDED, DEPLOYMENT_MODES.STANDALONE],
    standaloneAliases: ['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench'],
    embeddedEntry: '/rysnova-bim-designer.html',
    poweredBy: POWERED_BY,
    productIndependenceLevel: PRODUCT_INDEPENDENCE_LEVEL,
    standaloneDomainStrategy: STANDALONE_DOMAIN_STRATEGY,
    standaloneAppShellMode: STANDALONE_APP_SHELL_MODE,
    targetApp: 'apps/rysnova-bim-workbench',
    objectStoragePrefix: 'rysnova-bim/',
    analyticsNamespace: 'rysnova-bim',
    futureDatabaseStrategy: PRODUCT_DATABASE_STRATEGY,
    standalonePostgresSchema: 'rysnova-bim',
    standaloneMongoDatabase: 'rysnova-bim_documents',
    standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
    databaseIndependence: Object.freeze({
      currentDataMode: CURRENT_DATA_MODE,
      futureDataMode: FUTURE_DATA_MODE,
      sharedFoundationTables: SHARED_FOUNDATION_TABLES,
      ownedPostgresTables: ['file_artifacts', 'quotations'],
      ownedMongoNamespaces: ['RysnovaArtifact.moduleNamespace=rysnova-bim'],
      ownedObjectStoragePrefix: 'rysnova-bim/',
      standalonePostgresSchema: 'rysnova-bim',
      standaloneMongoDatabase: 'rysnova-bim_documents',
      standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
      requiredExtractionKeys: PRODUCT_EXTRACTION_KEYS,
      standaloneDatabaseTarget: 'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace',
      extractionProofRequired: true,
      futureStandaloneProductReady: true,
      extractionPlan: 'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes'
    }),
    portalIntegration: Object.freeze({
      embeddedInRhauttPortal: true,
      embeddedEntry: '/rysnova-bim-designer.html'
    }),
    standaloneProductization: Object.freeze({
      launchable: true,
      aliases: ['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench'],
      targetApp: 'apps/rysnova-bim-workbench',
      appShellMode: STANDALONE_APP_SHELL_MODE,
      domainStrategy: STANDALONE_DOMAIN_STRATEGY,
      standaloneDomainTargets: ['pending-dedicated-rysnova-bim-domain-or-subdomain'],
      externalDomainProofRequired: true,
      databaseExtractionReady: true
    }),
    dataBoundary: Object.freeze({
      postgresRegistry: 'rhautt_nexus.product_modules',
      deploymentRegistry: 'rhautt_nexus.product_module_deployments',
      dataPartitionRegistry: 'rhautt_nexus.product_module_data_partitions',
      moduleNamespace: 'rysnova-bim',
      dataNamespace: 'rysnova-bim',
      productNamespace: 'rysnova-bim',
      productDataNamespace: 'rysnova-bim',
      objectStoragePrefix: 'rysnova-bim/',
      analyticsNamespace: 'rysnova-bim',
      futureDatabaseStrategy: PRODUCT_DATABASE_STRATEGY,
      productIndependenceLevel: PRODUCT_INDEPENDENCE_LEVEL,
      standaloneDomainStrategy: STANDALONE_DOMAIN_STRATEGY,
      standaloneAppShellMode: STANDALONE_APP_SHELL_MODE,
      currentDataMode: CURRENT_DATA_MODE,
      futureDataMode: FUTURE_DATA_MODE,
      sharedFoundationTables: SHARED_FOUNDATION_TABLES,
      ownedPostgresTables: ['file_artifacts', 'quotations'],
      ownedMongoNamespaces: ['RysnovaArtifact.moduleNamespace=rysnova-bim'],
      standalonePostgresSchema: 'rysnova-bim',
      standaloneMongoDatabase: 'rysnova-bim_documents',
      standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
      requiredExtractionKeys: PRODUCT_EXTRACTION_KEYS,
      standaloneDatabaseTarget: 'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace',
      extractionProofRequired: true,
      futureStandaloneProductReady: true,
      postgresPartitionKey: 'product_data_namespace',
      mongodbNamespace: 'RysnovaArtifact.moduleNamespace=rysnova-bim',
      independentDatabaseReady: true,
      extractionPlan: 'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes'
    }),
    source: 'rysnova-bim'
  }),
  sharedPlatform: Object.freeze({
    id: MODULE_IDS.RHAUTT_SHARED_PLATFORM,
    namespace: 'rhautt-shared',
    dataNamespace: 'rhautt_shared',
    apiNamespace: '/api/v2',
    displayName: 'Rhautt shared platform',
    kind: 'shared-foundation',
    defaultDeploymentMode: DEPLOYMENT_MODES.SHARED_PLATFORM
  })
});

function resolveDeploymentMode(value, fallback = DEPLOYMENT_MODES.RHAUTT_PORTAL_EMBEDDED) {
  return Object.values(DEPLOYMENT_MODES).includes(value) ? value : fallback;
}

function resolveModuleId(value, fallback = MODULE_IDS.RHAUTT_SHARED_PLATFORM) {
  return Object.values(MODULE_IDS).includes(value) ? value : fallback;
}

function getModuleById(moduleId) {
  return Object.values(MODULES).find(module => module.id === moduleId) || MODULES.sharedPlatform;
}

function productModuleContext(input = {}) {
  const productModuleId = resolveModuleId(input.productModuleId || input.moduleId, MODULE_IDS.RHAUTT_SHARED_PLATFORM);
  const module = getModuleById(productModuleId);
  return {
    productModuleId,
    productDeploymentMode: resolveDeploymentMode(
      input.productDeploymentMode || input.moduleDeploymentMode,
      module.defaultDeploymentMode || DEPLOYMENT_MODES.SHARED_PLATFORM
    ),
    productNamespace: module.namespace,
    productDataNamespace: module.dataNamespace
  };
}

function rysnovaModuleContext(input = {}) {
  return {
    moduleId: resolveModuleId(input.moduleId, MODULES.rysnova.id),
    moduleDeploymentMode: resolveDeploymentMode(input.moduleDeploymentMode, MODULES.rysnova.defaultDeploymentMode),
    moduleNamespace: MODULES.rysnova.namespace,
    dataNamespace: MODULES.rysnova.dataNamespace
  };
}

function rysnovaBimModuleContext(input = {}) {
  return {
    moduleId: resolveModuleId(input.moduleId, MODULES.rysnovaBim.id),
    moduleDeploymentMode: resolveDeploymentMode(input.moduleDeploymentMode, MODULES.rysnovaBim.defaultDeploymentMode),
    moduleNamespace: MODULES.rysnovaBim.namespace,
    dataNamespace: MODULES.rysnovaBim.dataNamespace
  };
}

module.exports = {
  DEPLOYMENT_MODES,
  MODULE_IDS,
  PRODUCT_DATABASE_STRATEGY,
  PRODUCT_BOUNDARY,
  POWERED_BY,
  CURRENT_DATA_MODE,
  FUTURE_DATA_MODE,
  STANDALONE_DOMAIN_STRATEGY,
  STANDALONE_APP_SHELL_MODE,
  PRODUCT_INDEPENDENCE_LEVEL,
  SHARED_FOUNDATION_TABLES,
  PRODUCT_EXTRACTION_KEYS,
  MODULES,
  resolveDeploymentMode,
  resolveModuleId,
  getModuleById,
  productModuleContext,
  rysnovaModuleContext,
  rysnovaBimModuleContext
};
