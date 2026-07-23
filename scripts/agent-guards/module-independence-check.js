#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT = 'contracts/product-modules/rysnova-rysnova-bim-module-boundary.json';
const LEGACY_CONTRACT = 'contracts/product-modules/rysnova-rysnova-bim-module-boundary.json';
const failures = [];
const pageAliases = require(path.join(ROOT, 'server/routes/page-aliases')).aliases || [];
const aliasMap = new Map(pageAliases.map(([routePath, target]) => [routePath, target]));

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function text(relativePath) {
  const html = read(relativePath);
  const dom = new JSDOM(html);
  for (const selector of ['script', 'style', 'noscript', 'template']) {
    for (const node of dom.window.document.querySelectorAll(selector)) node.remove();
  }
  return dom.window.document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function check(condition, message) {
  if (!condition) failures.push(message);
}

check(exists(CONTRACT), `missing module independence contract: ${CONTRACT}`);
check(exists(LEGACY_CONTRACT), `missing legacy compatibility contract: ${LEGACY_CONTRACT}`);

let contract = null;
if (exists(CONTRACT)) {
  contract = JSON.parse(read(CONTRACT));
  check(String(contract.principle || '').includes('可嵌入 Rhautt 官网'), 'contract must state modules can be embedded in the Rhautt portal');
  check(String(contract.principle || '').includes('独立上线'), 'contract must state modules can launch independently');
  check(String(contract.principle || '').includes('Powered by Rhautt Comfort'), 'contract must preserve Powered by Rhautt Comfort support expression');
  check(String(contract.independenceModel?.standaloneLaunch || '').includes('独立数据命名空间'), 'contract must require independent data namespace for standalone launch');
  check(String(contract.independenceModel?.dataEvolution || '').includes('拆库'), 'contract must preserve future database split/migration capability');
  check(String(contract.independenceModel?.ownershipRule || '').includes('官网只是生态承载和入口'), 'contract must state Rhautt portal is an entry/carrier, not the owner of product domains');
  check(String(contract.independenceModel?.ownershipRule || '').includes('独立产品单独发展'), 'contract must preserve independent product development for 瑞诺瓦 and Rysnova');
  check(String(contract.independenceModel?.databaseIndependence || '').includes('product_modules'), 'contract must preserve product_modules database registry');
  check(String(contract.independenceModel?.databaseIndependence || '').includes('独立数据库'), 'contract must preserve future independent database migration capability');
  check(String(contract.independenceModel?.currentDataMode || '').includes('productModuleId'), 'contract current data mode must require product module partition keys');
  check(String(contract.independenceModel?.futureDataMode || '').includes('独立 PostgreSQL schema'), 'contract future data mode must preserve independent PostgreSQL schema extraction');
  check(String(contract.independenceModel?.deploymentRegistry || '').includes('product_module_deployments'), 'contract must preserve product_module_deployments registry');
  check(String(contract.independenceModel?.deploymentRegistry || '').includes('standalone'), 'contract must preserve standalone deployment registry');
  check(String(contract.independenceModel?.dataPartitionRegistry || '').includes('product_module_data_partitions'), 'contract must preserve product_module_data_partitions registry');
  check(String(contract.independenceModel?.dataPartitionRegistry || '').includes('拆库'), 'contract must preserve future product-domain database split through data partitions');
  check(String(contract.independenceModel?.runtimeTruth || '').includes('lifecycle handoff'), 'contract must lock IoT lifecycle handoff boundary');
  for (const module of contract.modules || []) {
    check(module.embeddedInRhauttPortal === true, `${module.id}: embeddedInRhauttPortal must be true`);
    check(module.standaloneLaunchable === true, `${module.id}: standaloneLaunchable must be true`);
    check(Boolean(module.namespace), `${module.id}: must define product namespace`);
    check(Boolean(module.dataNamespace), `${module.id}: must define data namespace`);
    check(Boolean(module.apiNamespace), `${module.id}: must define API namespace`);
    check(module.productIndependenceLevel === 'portal-embedded-and-standalone-extractable', `${module.id}: productIndependenceLevel must preserve embedded and standalone extraction`);
    check(module.standaloneDomainStrategy === 'dedicated-domain-or-subdomain-required', `${module.id}: standaloneDomainStrategy must require a dedicated domain or subdomain`);
    check(module.standaloneAppShellMode === 'independent-product-app-shell', `${module.id}: standaloneAppShellMode must be independent-product-app-shell`);
    check(Boolean(module.standalonePostgresSchema), `${module.id}: must define standalonePostgresSchema`);
    check(Boolean(module.standaloneMongoDatabase), `${module.id}: must define standaloneMongoDatabase`);
    check(Boolean(module.standaloneObjectStorageBucket), `${module.id}: must define standaloneObjectStorageBucket`);
    check(Boolean(module.extractionPlan), `${module.id}: must define extractionPlan`);
    check(module.logoPolicy?.poweredBy === 'Powered by Rhautt Comfort', `${module.id}: must use Powered by Rhautt Comfort`);
    check(module.portalIntegration?.embeddedInRhauttPortal === true, `${module.id}: portalIntegration must keep embeddedInRhauttPortal true`);
    check(module.standaloneProductization?.appShellMode === 'independent-product-app-shell', `${module.id}: standaloneProductization.appShellMode must be independent-product-app-shell`);
    check(module.standaloneProductization?.domainStrategy === 'dedicated-domain-or-subdomain-required', `${module.id}: standaloneProductization.domainStrategy must require dedicated domain/subdomain`);
    check(Array.isArray(module.standaloneProductization?.standaloneDomainTargets), `${module.id}: standaloneProductization must list standalone domain targets`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('moduleId'), `${module.id}: data domain must include moduleId`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('moduleDeploymentMode'), `${module.id}: data domain must include moduleDeploymentMode`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('moduleNamespace'), `${module.id}: data domain must include moduleNamespace`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('dataNamespace'), `${module.id}: data domain must include dataNamespace`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('productModuleId'), `${module.id}: shared business data domain must include productModuleId`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('productDeploymentMode'), `${module.id}: shared business data domain must include productDeploymentMode`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('productNamespace'), `${module.id}: shared business data domain must include productNamespace`);
    check(Array.isArray(module.dataDomain?.standaloneKeys) && module.dataDomain.standaloneKeys.includes('productDataNamespace'), `${module.id}: shared business data domain must include productDataNamespace`);
    check(module.dataDomain?.postgresRegistry === 'rhautt_nexus.product_modules', `${module.id}: data domain must reference PostgreSQL product_modules registry`);
    check(module.dataDomain?.deploymentRegistry === 'rhautt_nexus.product_module_deployments', `${module.id}: data domain must reference PostgreSQL product_module_deployments registry`);
    check(module.dataDomain?.dataPartitionRegistry === 'rhautt_nexus.product_module_data_partitions', `${module.id}: data domain must reference PostgreSQL product_module_data_partitions registry`);
    check(module.dataDomain?.productIndependenceLevel === 'portal-embedded-and-standalone-extractable', `${module.id}: data domain must preserve productIndependenceLevel`);
    check(module.dataDomain?.standaloneDomainStrategy === 'dedicated-domain-or-subdomain-required', `${module.id}: data domain must preserve standaloneDomainStrategy`);
    check(module.dataDomain?.standaloneAppShellMode === 'independent-product-app-shell', `${module.id}: data domain must preserve standaloneAppShellMode`);
    check(module.dataDomain?.futureDatabaseStrategy === 'namespace-extractable-shared-ledger', `${module.id}: data domain must preserve namespace-extractable shared ledger strategy`);
    check(module.dataDomain?.currentDataMode === 'shared-foundation-product-domain-partitioned', `${module.id}: data domain must preserve current shared foundation/product partition mode`);
    check(module.dataDomain?.futureDataMode === 'standalone-database-extractable', `${module.id}: data domain must preserve future standalone database extraction mode`);
    check(Array.isArray(module.dataDomain?.sharedFoundationTables) && module.dataDomain.sharedFoundationTables.includes('tenants'), `${module.id}: data domain must list shared foundation tables`);
    check(Array.isArray(module.dataDomain?.ownedPostgresTables) && module.dataDomain.ownedPostgresTables.length > 0, `${module.id}: data domain must list owned PostgreSQL tables for extraction`);
    check(Array.isArray(module.dataDomain?.ownedMongoNamespaces) && module.dataDomain.ownedMongoNamespaces.length > 0, `${module.id}: data domain must list owned MongoDB namespaces for extraction`);
    check(Boolean(module.dataDomain?.standaloneDatabaseTarget), `${module.id}: data domain must define standalone database target`);
    check(module.dataDomain?.extractionProofRequired === true, `${module.id}: data domain must require extraction proof`);
    check(module.dataDomain?.futureStandaloneProductReady === true, `${module.id}: data domain must mark futureStandaloneProductReady`);
    check(Boolean(module.dataDomain?.objectStoragePrefix), `${module.id}: data domain must define object storage prefix`);
    check(module.dataDomain?.analyticsNamespace === module.dataNamespace, `${module.id}: analytics namespace must equal data namespace for standalone reporting`);
    check(Boolean(module.dataDomain?.mongodbNamespace), `${module.id}: data domain must define MongoDB namespace for product extraction`);
    check(module.dataDomain?.postgresPartitionKey === 'product_data_namespace', `${module.id}: data domain must define PostgreSQL product_data_namespace partition key`);
    check(module.dataDomain?.standalonePostgresSchema === module.standalonePostgresSchema, `${module.id}: data domain standalonePostgresSchema must match module`);
    check(module.dataDomain?.standaloneMongoDatabase === module.standaloneMongoDatabase, `${module.id}: data domain standaloneMongoDatabase must match module`);
    check(module.dataDomain?.standaloneObjectStorageBucket === module.standaloneObjectStorageBucket, `${module.id}: data domain standaloneObjectStorageBucket must match module`);
    check(module.dataDomain?.extractionPlan === module.extractionPlan, `${module.id}: data domain extractionPlan must match module`);
    check(module.dataDomain?.independentDatabaseReady === true, `${module.id}: data domain must be marked independentDatabaseReady`);
    for (const routePath of module.standaloneAliases || []) {
      check(aliasMap.has(routePath), `${module.id}: standalone alias missing from page-aliases: ${routePath}`);
    }
  }
}

if (exists('public/index-ready.html')) {
  const home = read('public/index-ready.html');
  check(home.includes('/pain-diagnosis.html'), 'Rhautt portal must keep 瑞诺瓦 AI diagnosis entry');
  check(home.includes('/rysnova-bim-designer.html'), 'Rhautt portal must keep Rysnova entry');
}

if (exists('public/pain-diagnosis.html')) {
  const html = read('public/pain-diagnosis.html');
  const visible = text('public/pain-diagnosis.html');
  check(html.includes('diag-rheem-wordmark'), '瑞诺瓦 module header must show Rheem equipment-brand wordmark placeholder for now');
  check(html.includes('Rheem equipment brand'), '瑞诺瓦 module header must label Rheem as an equipment brand placeholder');
  check(!html.includes('/images/rheem-logo.svg'), '瑞诺瓦 module header must not use gated local Rheem logo before approved brand package asset');
  check(html.includes('瑞诺瓦系统问诊'), '瑞诺瓦 module header must show independent module name');
  check(html.includes('Powered by Rhautt Comfort'), '瑞诺瓦 module must show Powered by Rhautt Comfort outside primary logo');
  check(!html.includes('/images/rhautt-comfort-wordmark.svg'), '瑞诺瓦 module must not use Rhautt Comfort as primary logo');
  check(visible.includes('瑞诺瓦 AI 问诊'), '瑞诺瓦 visible module identity must remain');
}

if (exists('public/customer-share.html')) {
  const html = read('public/customer-share.html');
  check(html.includes('hero-logo-mark'), '瑞诺瓦 customer share must show Rheem equipment-brand wordmark placeholder for now');
  check(html.includes('Rheem equipment brand'), '瑞诺瓦 customer share must label Rheem as an equipment brand placeholder');
  check(!html.includes('/images/rheem-logo.svg'), '瑞诺瓦 customer share must not use gated local Rheem logo before approved brand package asset');
  check(html.includes('瑞诺瓦方案'), '瑞诺瓦 customer share must show independent module identity');
  check(html.includes('Powered by Rhautt Comfort'), '瑞诺瓦 customer share must show Powered by Rhautt Comfort');
}

if (exists('public/rysnova-bim-designer.html')) {
  const html = read('public/rysnova-bim-designer.html');
  check(html.includes('/images/ruud-logo.svg'), 'Rysnova module header must use Ruud logo placeholder for now');
  check(html.includes('<strong>Rysnova</strong>'), 'Rysnova module header must show independent module name');
  check(html.includes('Powered by Rhautt Comfort'), 'Rysnova module must show Powered by Rhautt Comfort outside primary logo');
  check(!html.includes('/images/rhautt-comfort-wordmark.svg'), 'Rysnova module must not use Rhautt Comfort as primary logo');
}

if (exists('server/models/DiagnosisReport.js')) {
  const model = read('server/models/DiagnosisReport.js');
  const registry = exists('server/modules/productModules/product-module-registry.js') ? read('server/modules/productModules/product-module-registry.js') : '';
  check(model.includes('moduleId'), 'DiagnosisReport must carry moduleId for standalone 瑞诺瓦 data domain');
  check(model.includes('moduleDeploymentMode'), 'DiagnosisReport must carry moduleDeploymentMode for embedded/standalone mode');
  check(model.includes('moduleNamespace'), 'DiagnosisReport must carry moduleNamespace for standalone 瑞诺瓦 product namespace');
  check(model.includes('dataNamespace'), 'DiagnosisReport must carry dataNamespace for standalone 瑞诺瓦 data extraction');
  check(registry.includes("source: 'rysnova-ai-diagnosis'"), 'product module registry must use rysnova-ai-diagnosis as the new production source');
  check(registry.includes("legacySources: ['rysnova-ai-diagnosis']"), 'product module registry must keep legacy source compatibility for existing reports');
}

if (exists('server/models/RysnovaArtifact.js')) {
  const model = read('server/models/RysnovaArtifact.js');
  check(model.includes('moduleId'), 'RysnovaArtifact must carry moduleId for standalone Rysnova data domain');
  check(model.includes('moduleDeploymentMode'), 'RysnovaArtifact must carry moduleDeploymentMode for embedded/standalone mode');
  check(model.includes('moduleNamespace'), 'RysnovaArtifact must carry moduleNamespace for standalone Rysnova product namespace');
  check(model.includes('dataNamespace'), 'RysnovaArtifact must carry dataNamespace for standalone Rysnova data extraction');
}

for (const modelPath of [
  'server/models/CustomerV2.js',
  'server/models/Opportunity.js',
  'server/models/QuotationV2.js'
]) {
  if (exists(modelPath)) {
    const model = read(modelPath);
    check(model.includes('productModuleId'), `${modelPath} must carry productModuleId for standalone product analytics/migration`);
    check(model.includes('productDeploymentMode'), `${modelPath} must carry productDeploymentMode for portal embedded vs standalone mode`);
    check(model.includes('productNamespace'), `${modelPath} must carry productNamespace for standalone product analytics/migration`);
    check(model.includes('productDataNamespace'), `${modelPath} must carry productDataNamespace for future product-domain database extraction`);
    check(model.includes('RHAUTT_SHARED_PLATFORM'), `${modelPath} must keep shared-platform fallback for non-module records`);
  }
}

if (exists('server/modules/productModules/product-module-registry.js')) {
  const registry = read('server/modules/productModules/product-module-registry.js');
  check(registry.includes('RYSNOVA_CONSUMER_SYSTEM'), 'product module registry must define 瑞诺瓦 module id');
  check(registry.includes('RYSNOVA_ENGINEERING_SUPPORT'), 'product module registry must define Rysnova module id');
  check(registry.includes('STANDALONE'), 'product module registry must define standalone deployment mode');
  check(registry.includes('PRODUCT_DATABASE_STRATEGY'), 'product module registry must define shared future database strategy constant');
  check(registry.includes('portalIntegration'), 'product module registry must define portal integration boundary');
  check(registry.includes('standaloneProductization'), 'product module registry must define standalone productization boundary');
  check(registry.includes('dataBoundary'), 'product module registry must define data boundary');
  check(registry.includes('databaseIndependence'), 'product module registry must define database independence boundary');
  check(registry.includes('CURRENT_DATA_MODE'), 'product module registry must define current data mode constant');
  check(registry.includes('FUTURE_DATA_MODE'), 'product module registry must define future data mode constant');
  check(registry.includes('PRODUCT_EXTRACTION_KEYS'), 'product module registry must define product extraction keys');
  check(registry.includes("namespace: 'rysnova'"), 'product module registry must define 瑞诺瓦 namespace');
  check(registry.includes("dataNamespace: 'rysnova'"), 'product module registry must define 瑞诺瓦 data namespace');
  check(registry.includes("namespace: 'rysnova-bim'"), 'product module registry must define Rysnova namespace');
  check(registry.includes("dataNamespace: 'rysnova-bim'"), 'product module registry must define Rysnova data namespace');
  check(registry.includes('productModuleContext'), 'product module registry must expose shared product context resolver');
}

if (exists('database/postgres/migrations/001_rhautt_nexus_core_ledger.sql')) {
  const sql = read('database/postgres/migrations/001_rhautt_nexus_core_ledger.sql');
  check(sql.includes('CREATE TABLE IF NOT EXISTS rhautt_nexus.product_modules'), 'PostgreSQL target schema must include product_modules registry');
  check(sql.includes('CREATE TABLE IF NOT EXISTS rhautt_nexus.product_module_deployments'), 'PostgreSQL target schema must include product_module_deployments registry');
  check(sql.includes('CREATE TABLE IF NOT EXISTS rhautt_nexus.product_module_data_partitions'), 'PostgreSQL target schema must include product_module_data_partitions registry');
  check(sql.includes("'rysnova-consumer-system'"), 'PostgreSQL product_modules seed must include 瑞诺瓦');
  check(sql.includes("'rysnova-bim-engineering-support'"), 'PostgreSQL product_modules seed must include Rysnova');
  check(sql.includes("'namespace-extractable-shared-ledger'"), 'PostgreSQL product_modules must preserve future namespace extraction strategy');
  check(sql.includes("'rysnova/'"), 'PostgreSQL product_modules must define 瑞诺瓦 object storage prefix');
  check(sql.includes("'rysnova-bim/'"), 'PostgreSQL product_modules must define Rysnova object storage prefix');
  check(sql.includes('external_domain_proof_required'), 'PostgreSQL deployment registry must require external domain proof flag');
  check(sql.includes('product_independence_level'), 'PostgreSQL product module schema must define product_independence_level');
  check(sql.includes('standalone_domain_strategy'), 'PostgreSQL product module schema must define standalone_domain_strategy');
  check(sql.includes('standalone_app_shell_mode'), 'PostgreSQL product module schema must define standalone_app_shell_mode');
  check(sql.includes('standalone_postgres_schema'), 'PostgreSQL product module schema must define standalone_postgres_schema');
  check(sql.includes('standalone_mongodb_database'), 'PostgreSQL product module schema must define standalone_mongodb_database');
  check(sql.includes('standalone_object_storage_bucket'), 'PostgreSQL product module schema must define standalone_object_storage_bucket');
  check(sql.includes('extraction_plan'), 'PostgreSQL product module schema must define extraction_plan');
  check(sql.includes('current_data_mode'), 'PostgreSQL product module schema must define current_data_mode');
  check(sql.includes('future_data_mode'), 'PostgreSQL product module schema must define future_data_mode');
  check(sql.includes('standalone_database_target'), 'PostgreSQL data partition schema must define standalone_database_target');
  check(sql.includes('extraction_proof_required'), 'PostgreSQL product module schema must require extraction_proof_required');
  check(sql.includes('future_standalone_product_ready'), 'PostgreSQL product module schema must define future_standalone_product_ready');
  check(sql.includes('shared-foundation-product-domain-partitioned'), 'PostgreSQL schema must preserve shared foundation/product-domain partition mode');
  check(sql.includes('standalone-database-extractable'), 'PostgreSQL schema must preserve standalone database extractable mode');
  check(sql.includes('independent_database_ready'), 'PostgreSQL data partition registry must preserve independent database readiness flag');
}

console.log(`Module Independence Check: failures=${failures.length}`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
