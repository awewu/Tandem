#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_JSON = 'evidence/architecture/product-module-standalone-smoke.json';
const REPORT_MD = 'evidence/architecture/product-module-standalone-smoke.md';
const RELEASE_SCRIPT = 'scripts/release/product-module-standalone-smoke.js';
const STANDALONE_APP_FACTORY = 'server/modules/productModules/product-module-app-factory.js';
const CONTRACT_PATH = 'contracts/product-modules/rysnova-rysnova-bim-module-boundary.json';
const TARGET_ARCH_PATH = 'contracts/architecture/rhautt-nexus-target-architecture.json';

const MODULES = {
  'rysnova-consumer-system': {
    targetApp: 'apps/consumer-diagnosis',
    embeddedEntry: '/pain-diagnosis.html',
    aliases: ['/rysnova', '/rysnova-ai', '/rysnova-diagnosis'],
    moduleNamespace: 'rysnova',
    dataNamespace: 'rysnova',
    apiNamespace: '/api/v2/diagnosis',
    standaloneDatabaseTarget: 'rysnova-owned-postgres-schema-plus-mongodb-namespace',
    productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
    standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
    standaloneAppShellMode: 'independent-product-app-shell',
    standalonePostgresSchema: 'rysnova',
    standaloneMongoDatabase: 'rysnova_documents',
    standaloneObjectStorageBucket: 'rysnova-product-artifacts',
    extractionPlan: 'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix'
  },
  'rysnova-bim-engineering-support': {
    targetApp: 'apps/rysnova-bim-workbench',
    embeddedEntry: '/rysnova-bim-designer.html',
    aliases: ['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench'],
    moduleNamespace: 'rysnova-bim',
    dataNamespace: 'rysnova-bim',
    apiNamespace: '/api/v2/rysnova-bim',
    standaloneDatabaseTarget: 'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace',
    productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
    standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
    standaloneAppShellMode: 'independent-product-app-shell',
    standalonePostgresSchema: 'rysnova-bim',
    standaloneMongoDatabase: 'rysnova-bim_documents',
    standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
    extractionPlan: 'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes'
  }
};

const failures = [];
const warnings = [];

function fullPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(fullPath(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(fullPath(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fail(message) {
  failures.push(message);
}

if (!exists(RELEASE_SCRIPT)) fail(`missing ${RELEASE_SCRIPT}`);
if (!exists(STANDALONE_APP_FACTORY)) fail(`missing ${STANDALONE_APP_FACTORY}`);
if (!exists(REPORT_JSON)) fail(`missing ${REPORT_JSON}; run npm run release:product-modules:standalone-smoke`);
if (!exists(REPORT_MD)) fail(`missing ${REPORT_MD}; run npm run release:product-modules:standalone-smoke`);

const pkg = exists('package.json') ? readJson('package.json') : {};
if (pkg.scripts?.['release:product-modules:standalone-smoke'] !== 'node scripts/release/product-module-standalone-smoke.js') {
  fail('package.json release:product-modules:standalone-smoke must run node scripts/release/product-module-standalone-smoke.js');
}
if (pkg.scripts?.['guard:product-modules:standalone-smoke'] !== 'node scripts/agent-guards/product-module-standalone-smoke-check.js') {
  fail('package.json guard:product-modules:standalone-smoke must run node scripts/agent-guards/product-module-standalone-smoke-check.js');
}
if (!String(pkg.scripts?.['release:evidence'] || '').includes('release:product-modules:standalone-smoke')) {
  fail('package.json release:evidence must include release:product-modules:standalone-smoke');
}
if (!String(pkg.scripts?.['guard:all'] || '').includes('guard:product-modules:standalone-smoke')) {
  fail('package.json guard:all must include guard:product-modules:standalone-smoke');
}
if (!String(pkg.scripts?.['guard:all:nonvisual'] || '').includes('guard:product-modules:standalone-smoke')) {
  fail('package.json guard:all:nonvisual must include guard:product-modules:standalone-smoke');
}

if (exists(RELEASE_SCRIPT)) {
  const source = read(RELEASE_SCRIPT);
  for (const token of [
    'PRODUCT_MODULE_STANDALONE_BASE_URL',
    'local-inprocess-standalone-smoke',
    'finalLaunchStandaloneProof',
    'Powered by Rhautt Comfort',
    'rhautt-comfort-wordmark.svg',
    'createMinimalPortalAliasSmokeApp',
    'createPageAliasesRouter',
    'createProductModuleStandaloneApp',
    'minimal-portal-alias-app',
    'standaloneAppProof'
  ]) {
    if (!source.includes(token)) fail(`${RELEASE_SCRIPT} missing token: ${token}`);
  }
}

if (exists(STANDALONE_APP_FACTORY)) {
  const source = read(STANDALONE_APP_FACTORY);
  const registrySource = exists('server/modules/productModules/product-module-registry.js')
    ? read('server/modules/productModules/product-module-registry.js')
    : '';
  for (const token of [
    'createProductModuleStandaloneApp',
    '/health',
    '/module-meta',
    'moduleDeploymentMode: DEPLOYMENT_MODES.STANDALONE',
    'productBoundary:',
    "iotBoundary: 'lifecycle_handoff_only'",
    'Powered by Rhautt Comfort'
  ]) {
    if (!source.includes(token)) fail(`${STANDALONE_APP_FACTORY} missing token: ${token}`);
  }
  if (!registrySource.includes("PRODUCT_BOUNDARY = 'independent-product-domain'")) {
    fail('product module registry must define PRODUCT_BOUNDARY = independent-product-domain');
  }
  if (!source.includes('module.ownershipModel')) {
    fail(`${STANDALONE_APP_FACTORY} must derive productBoundary from module.ownershipModel`);
  }
}

let report = null;
if (exists(REPORT_JSON)) {
  report = readJson(REPORT_JSON);
  if (report.platform !== 'Rhautt Nexus / 瑞合数智枢纽') fail('product module standalone smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
  if (report.command !== 'npm run release:product-modules:standalone-smoke') fail('product module standalone smoke command mismatch');
  if (report.contractPath !== CONTRACT_PATH) fail(`product module standalone smoke contractPath must be ${CONTRACT_PATH}`);
  if (report.targetArchitecturePath !== TARGET_ARCH_PATH) fail(`product module standalone smoke targetArchitecturePath must be ${TARGET_ARCH_PATH}`);
  if (report.inProcessComposition !== 'minimal-portal-alias-app') fail('product module standalone smoke must use minimal-portal-alias-app composition');
  if (!['local-inprocess-standalone-smoke', 'passed-external-current-run', 'failed-current-run'].includes(report.status)) {
    fail(`unsupported product module standalone smoke status: ${report.status}`);
  }
  if (report.status === 'failed-current-run') {
    fail('product module standalone smoke report is failed-current-run');
  }
  if (report.status === 'local-inprocess-standalone-smoke') {
    if (report.finalLaunchStandaloneProof !== false || report.standaloneDomainProof !== false) {
      fail('local standalone smoke must not claim finalLaunchStandaloneProof or standaloneDomainProof');
    }
    warnings.push('Product module standalone smoke is local/in-process only; external standalone domain proof is still missing');
  }
  if (report.status === 'passed-external-current-run') {
    if (report.finalLaunchStandaloneProof !== true || report.standaloneDomainProof !== true) {
      fail('external standalone smoke must mark finalLaunchStandaloneProof and standaloneDomainProof true');
    }
  }
  if (report.summary?.failed !== 0) fail('product module standalone smoke summary.failed must be 0');
  if (report.summary?.inProcessAliasProof !== true) fail('product module standalone smoke must prove in-process aliases');
  if (report.summary?.standaloneAppProof !== true) fail('product module standalone smoke must prove local standalone app composition');
  if (report.summary?.metadataProof !== true) fail('product module standalone smoke must prove target app metadata');

  const moduleMap = new Map((report.modules || []).map(module => [module.id, module]));
  for (const [id, spec] of Object.entries(MODULES)) {
    const module = moduleMap.get(id);
    if (!module) {
      fail(`product module standalone smoke missing module: ${id}`);
      continue;
    }
    for (const [key, expected] of Object.entries({
      targetApp: spec.targetApp,
      embeddedEntry: spec.embeddedEntry,
      moduleNamespace: spec.moduleNamespace,
      dataNamespace: spec.dataNamespace,
      apiNamespace: spec.apiNamespace
    })) {
      if (module[key] !== expected) fail(`${id}.${key} must be ${expected}`);
    }
    if (module.standaloneAppMeta?.productBoundary !== 'independent-product-domain') {
      fail(`${id} standalone metadata must expose independent-product-domain boundary`);
    }
    if (module.standaloneAppMeta?.productIndependenceLevel !== spec.productIndependenceLevel) {
      fail(`${id} standalone metadata must expose productIndependenceLevel ${spec.productIndependenceLevel}`);
    }
    if (module.standaloneAppMeta?.standaloneAppShellMode !== spec.standaloneAppShellMode) {
      fail(`${id} standalone metadata must expose standaloneAppShellMode ${spec.standaloneAppShellMode}`);
    }
    if (module.standaloneAppMeta?.standaloneDomainStrategy !== spec.standaloneDomainStrategy) {
      fail(`${id} standalone metadata must expose standaloneDomainStrategy ${spec.standaloneDomainStrategy}`);
    }
    if (module.standaloneAppMeta?.standalonePostgresSchema !== spec.standalonePostgresSchema) {
      fail(`${id} standalone metadata must expose standalonePostgresSchema ${spec.standalonePostgresSchema}`);
    }
    if (module.standaloneAppMeta?.standaloneMongoDatabase !== spec.standaloneMongoDatabase) {
      fail(`${id} standalone metadata must expose standaloneMongoDatabase ${spec.standaloneMongoDatabase}`);
    }
    if (module.standaloneAppMeta?.standaloneObjectStorageBucket !== spec.standaloneObjectStorageBucket) {
      fail(`${id} standalone metadata must expose standaloneObjectStorageBucket ${spec.standaloneObjectStorageBucket}`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.deploymentRegistry !== 'rhautt_nexus.product_module_deployments') {
      fail(`${id} standalone metadata must expose product_module_deployments data boundary`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.dataPartitionRegistry !== 'rhautt_nexus.product_module_data_partitions') {
      fail(`${id} standalone metadata must expose product_module_data_partitions data boundary`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.currentDataMode !== 'shared-foundation-product-domain-partitioned') {
      fail(`${id} standalone metadata must expose shared foundation/product-domain partition mode`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.futureDataMode !== 'standalone-database-extractable') {
      fail(`${id} standalone metadata must expose standalone database extraction mode`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.standaloneDatabaseTarget !== spec.standaloneDatabaseTarget) {
      fail(`${id} standalone metadata must expose standaloneDatabaseTarget ${spec.standaloneDatabaseTarget}`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.extractionProofRequired !== true) {
      fail(`${id} standalone metadata must expose extractionProofRequired true`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.futureStandaloneProductReady !== true) {
      fail(`${id} standalone metadata must expose futureStandaloneProductReady true`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.independentDatabaseReady !== true) {
      fail(`${id} standalone metadata must expose independentDatabaseReady true`);
    }
    if (module.standaloneAppMeta?.dataBoundary?.extractionPlan !== spec.extractionPlan) {
      fail(`${id} standalone metadata must expose extractionPlan ${spec.extractionPlan}`);
    }
    for (const alias of spec.aliases) {
      if (!module.aliases?.includes(alias)) fail(`${id} missing alias ${alias}`);
      if (!module.inProcessAliases?.some(item => item.routePath === alias && item.passed === true)) {
        fail(`${id} missing passed in-process alias proof for ${alias}`);
      }
      if (!module.standaloneAppRoutes?.some(item => item.routePath === alias && item.passed === true)) {
        fail(`${id} missing passed standalone app alias proof for ${alias}`);
      }
    }
    for (const routePath of ['/', '/index.html', spec.embeddedEntry, '/health', '/module-meta', `${spec.apiNamespace}/health`, `${spec.apiNamespace}/module-meta`]) {
      if (!module.standaloneAppRoutes?.some(item => item.routePath === routePath && item.passed === true)) {
        fail(`${id} missing passed standalone app route proof for ${routePath}`);
      }
    }
    if (!module.metadataChecks?.every(item => item.passed)) fail(`${id} metadata checks must all pass`);
    if (module.passed !== true) fail(`${id} module passed must be true`);
  }
}

if (exists('evidence/release-evidence.json')) {
  const release = readJson('evidence/release-evidence.json');
  const record = release.requiredEvidence?.productModuleStandaloneSmoke;
  if (!record) {
    fail('release evidence missing productModuleStandaloneSmoke');
  } else if (report) {
    if (record.command !== 'npm run release:product-modules:standalone-smoke') fail('productModuleStandaloneSmoke release command mismatch');
    if (record.status !== report.status) fail('productModuleStandaloneSmoke release status must match report');
    if (record.path !== REPORT_JSON) fail(`productModuleStandaloneSmoke release path must be ${REPORT_JSON}`);
    if (record.summaryPath !== REPORT_MD) fail(`productModuleStandaloneSmoke release summaryPath must be ${REPORT_MD}`);
    if (record.finalLaunchStandaloneProof !== report.finalLaunchStandaloneProof) fail('productModuleStandaloneSmoke finalLaunchStandaloneProof must match report');
    if (record.standaloneDomainProof !== report.standaloneDomainProof) fail('productModuleStandaloneSmoke standaloneDomainProof must match report');
    if (!Array.isArray(record.modules) || record.modules.length !== Object.keys(MODULES).length) {
      fail('productModuleStandaloneSmoke release modules must list both independent product modules');
    }
  }
}

console.log(`Product Module Standalone Smoke Check: failures = ${failures.length}, warnings = ${warnings.length}`);
for (const warning of warnings) console.warn(`- ${warning}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
