#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const CONTRACT_PATH = 'contracts/architecture/rhautt-nexus-target-architecture.json';
const REPORT_JSON = 'evidence/architecture/target-architecture-contract-report.json';
const REPORT_MD = 'evidence/architecture/target-architecture-contract-report.md';

const REQUIRED_FRONTEND_APPS = [
  'public-portal',
  'consumer-diagnosis',
  'customer-portal',
  'dealer-workbench',
  'designer-workbench',
  'rysnova-bim-workbench'
];

const REQUIRED_PACKAGES = ['ui', 'contracts', 'domain', 'visual-system'];

const REQUIRED_BACKEND_MODULES = [
  'auth',
  'tenant',
  'crm',
  'diagnosis',
  'product-catalog',
  'quote',
  'design',
  'rysnova-bim',
  'delivery',
  'lifecycle',
  'analytics',
  'governance',
  'file-artifact',
  'notification',
  'workflow'
];

const REQUIRED_DATA_KEYS = ['postgresql', 'mongodb', 'redis', 'objectStorage', 'temporalOutbox'];

const REQUIRED_ENGINEERING_PHASES = [
  'requirements-and-owner-confirmation',
  'openapi-and-dto-contract-freeze',
  'contract-tests',
  'backend-implementation',
  'unit-and-integration-tests',
  'staging-or-shadow-validation',
  'traffic-cutover',
  'legacy-route-retirement',
  'guards-readiness-and-evidence-archive'
];

const FRONTEND_DATABASE_PACKAGES = new Set([
  'pg', 'postgres', 'mysql', 'mysql2', 'mongodb', 'mongoose',
  'typeorm', 'prisma', '@prisma/client', 'knex', 'sequelize'
]);

const REQUIRED_PRODUCT_TOKENS = [
  ['rhauttComfort', '不是软件名'],
  ['softwareName', 'Rhautt Nexus / 瑞合数智枢纽'],
  ['consumerSystemBrand', '瑞诺瓦'],
  ['iotBoundary', 'lifecycle_handoff_only']
];

const REQUIRED_STANDALONE_MODULE_APPS = {
  'consumer-diagnosis': {
    productModuleId: 'rysnova-consumer-system',
    moduleNamespace: 'rysnova',
    dataNamespace: 'rysnova',
    apiNamespace: '/api/v2/diagnosis',
    embeddedEntry: '/pain-diagnosis.html',
    standaloneAliases: ['/rysnova', '/rysnova-ai', '/rysnova-diagnosis'],
    objectStoragePrefix: 'rysnova/',
    analyticsNamespace: 'rysnova',
    ownedPostgresTables: ['customers', 'opportunities', 'quotations'],
    ownedMongoNamespaces: ['DiagnosisReport.moduleNamespace=rysnova'],
    standaloneDatabaseTarget: 'rysnova-owned-postgres-schema-plus-mongodb-namespace',
    standalonePostgresSchema: 'rysnova',
    standaloneMongoDatabase: 'rysnova_documents',
    standaloneObjectStorageBucket: 'rysnova-product-artifacts',
    extractionPlan: 'extract-by-product_data_namespace-moduleNamespace-dataNamespace-objectStoragePrefix',
    standaloneDomainTargets: ['pending-dedicated-rysnova-domain-or-subdomain']
  },
  'rysnova-bim-workbench': {
    productModuleId: 'rysnova-bim-engineering-support',
    moduleNamespace: 'rysnova-bim',
    dataNamespace: 'rysnova-bim',
    apiNamespace: '/api/v2/rysnova-bim',
    embeddedEntry: '/rysnova-bim-designer.html',
    standaloneAliases: ['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench'],
    objectStoragePrefix: 'rysnova-bim/',
    analyticsNamespace: 'rysnova-bim',
    ownedPostgresTables: ['file_artifacts', 'quotations'],
    ownedMongoNamespaces: ['RysnovaArtifact.moduleNamespace=rysnova-bim'],
    standaloneDatabaseTarget: 'rysnova-bim-owned-postgres-schema-plus-mongodb-namespace',
    standalonePostgresSchema: 'rysnova-bim',
    standaloneMongoDatabase: 'rysnova-bim_documents',
    standaloneObjectStorageBucket: 'rysnova-bim-product-artifacts',
    extractionPlan: 'extract-by-data_namespace-moduleNamespace-objectStoragePrefix-artifactHashes',
    standaloneDomainTargets: ['pending-dedicated-rysnova-bim-domain-or-subdomain']
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

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function pushFailure(message) {
  failures.push(message);
  return false;
}

function classNameForModule(name) {
  return name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function includesAll(values, required) {
  const set = new Set(values || []);
  return required.filter(item => !set.has(item));
}

function listSourceFiles(relativeDir) {
  if (!exists(relativeDir)) return [];
  const ignoredDirectories = new Set(['node_modules', '.next', 'dist', 'out', 'build', 'coverage', '.git']);
  const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
  const files = [];

  function walk(currentRelativeDir) {
    for (const entry of fs.readdirSync(fullPath(currentRelativeDir), { withFileTypes: true })) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
      const entryRelativePath = path.posix.join(currentRelativeDir.replace(/\\/g, '/'), entry.name);
      if (entry.isDirectory()) walk(entryRelativePath);
      else if (sourceExtensions.has(path.extname(entry.name))) files.push(entryRelativePath);
    }
  }

  walk(relativeDir);
  return files;
}

function inspect() {
  if (!exists(CONTRACT_PATH)) {
    pushFailure(`missing ${CONTRACT_PATH}`);
    return null;
  }

  const source = read(CONTRACT_PATH);
  const contract = JSON.parse(source);
  const checks = [];

  function check(name, passed, details = '') {
    checks.push({ name, passed, details });
    if (!passed) pushFailure(details || name);
  }

  const governance = contract.engineeringGovernance || {};
  const technologyStack = governance.technologyStack || {};
  const frontendDataAccess = governance.frontendDataAccess || {};
  const developmentProcess = governance.developmentProcess || {};

  check('engineering-governance-immutable', governance.immutable === true, 'engineering governance must be immutable');
  check('technology-stack-locked', technologyStack.locked === true, 'technology stack must be locked');
  check('technology-stack-owner-change-control', technologyStack.changeRequiresCharterAmendmentAndOwnerApproval === true, 'technology stack changes require charter amendment and owner approval');
  check('legacy-new-business-logic-blocked', technologyStack.newBusinessLogicInLegacyTrunk === false, 'legacy compatibility trunk must reject new business logic');
  for (const [layer, expected] of Object.entries({
    frontend: ['Nx', 'pnpm', 'TypeScript', 'Next.js', 'React'],
    backend: ['TypeScript', 'NestJS', 'Fastify', 'TypeORM'],
    dataAndWorkflow: ['PostgreSQL', 'MongoDB', 'Redis', 'Object Storage', 'Temporal', 'Outbox'],
    legacyCompatibilityOnly: ['Express', 'JavaScript']
  })) {
    check(`technology-stack-allowlist:${layer}`, JSON.stringify(technologyStack[layer] || []) === JSON.stringify(expected), `${layer} technology stack must match the locked allowlist`);
  }
  check('frontend-direct-database-access-blocked', frontendDataAccess.directDatabaseAccess === false, 'frontend direct database access must be prohibited');
  check('frontend-database-credentials-blocked', frontendDataAccess.databaseCredentialsAllowed === false, 'frontend database credentials must be prohibited');
  check('frontend-database-drivers-blocked', frontendDataAccess.databaseDriversOrOrmsAllowed === false, 'frontend database drivers and ORMs must be prohibited');
  check('frontend-approved-access-path', String(frontendDataAccess.approvedAccessPath || '').includes('OpenAPI-declared /api/v2'), 'frontend data access must use OpenAPI-declared /api/v2 backend APIs');
  check('development-process-mandatory', developmentProcess.mandatory === true, 'software development process must be mandatory');
  check('development-process-order', JSON.stringify(developmentProcess.phases || []) === JSON.stringify(REQUIRED_ENGINEERING_PHASES), 'development phases must match the locked order');
  check('development-process-no-skip', developmentProcess.skipPhaseAllowed === false, 'development process phases cannot be skipped');
  check('development-process-contract-first', developmentProcess.contractAfterImplementationAllowed === false, 'implementation cannot precede its contract');
  check('development-process-no-long-term-dual-write', developmentProcess.longTermDualWriteAllowed === false, 'long-term dual write must be prohibited');

  const frontendAppIds = exists('apps')
    ? fs.readdirSync(fullPath('apps'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
    : [];
  for (const appId of frontendAppIds) {
    const packagePath = `apps/${appId}/package.json`;
    const appPackage = exists(packagePath) ? readJson(packagePath) : {};
    const declaredPackages = {
      ...(appPackage.dependencies || {}),
      ...(appPackage.devDependencies || {}),
      ...(appPackage.peerDependencies || {})
    };
    const forbiddenPackages = Object.keys(declaredPackages).filter(name => FRONTEND_DATABASE_PACKAGES.has(name));
    check(
      `frontend-database-package-boundary:${appId}`,
      forbiddenPackages.length === 0,
      `${appId}: forbidden database packages: ${forbiddenPackages.join(', ')}`
    );
    const forbiddenImports = [];
    for (const sourcePath of listSourceFiles(`apps/${appId}`)) {
      const source = read(sourcePath);
      for (const packageName of FRONTEND_DATABASE_PACKAGES) {
        const tokens = [
          `from '${packageName}'`, `from "${packageName}"`,
          `require('${packageName}')`, `require("${packageName}")`,
          `import('${packageName}')`, `import("${packageName}")`
        ];
        if (tokens.some(token => source.includes(token))) forbiddenImports.push(`${sourcePath}:${packageName}`);
      }
    }
    check(
      `frontend-database-import-boundary:${appId}`,
      forbiddenImports.length === 0,
      `${appId}: forbidden database imports: ${forbiddenImports.join(', ')}`
    );
  }

  const nxConfig = exists('nx.json') ? readJson('nx.json') : null;
  const workspaceConfig = exists('pnpm-workspace.yaml') ? read('pnpm-workspace.yaml') : '';
  const tsconfig = exists('tsconfig.base.json') ? readJson('tsconfig.base.json') : null;

  check(
    'platform',
    contract.platform === 'Rhautt Nexus / 瑞合数智枢纽',
    'target architecture contract platform must be Rhautt Nexus / 瑞合数智枢纽'
  );
  check(
    'status',
    contract.status === 'target-contract-not-production-trunk',
    'target architecture contract must remain target-contract-not-production-trunk until real Nx/Nest trunk exists'
  );
  check(
    'non-completion-rule',
    String(contract.nonCompletionRule || '').includes('not Nx/Next/Nest production implementation proof'),
    'target architecture contract must state it is not production implementation proof'
  );

  check('frontend-workspace-primary', contract.frontend?.workspace?.primary === 'Nx', 'frontend workspace primary must be Nx');
  check('frontend-workspace-alternative-blocked', contract.frontend?.workspace?.alternative == null, 'frontend workspace must not declare an alternative technology stack');
  check('frontend-language', contract.frontend?.workspace?.language === 'TypeScript', 'frontend workspace language must be TypeScript');
  check('frontend-next-react', (contract.frontend?.workspace?.frameworks || []).includes('Next.js') && (contract.frontend?.workspace?.frameworks || []).includes('React'), 'frontend frameworks must include Next.js and React');
  check('frontend-project-graph', contract.frontend?.workspace?.graphRequired === true, 'frontend workspace must require project graph');
  check('frontend-affected-build', contract.frontend?.workspace?.affectedBuildRequired === true, 'frontend workspace must require affected build');

  const appIds = (contract.frontend?.apps || []).map(app => app.id);
  const missingApps = includesAll(appIds, REQUIRED_FRONTEND_APPS);
  check('frontend-app-count', missingApps.length === 0, `missing frontend apps: ${missingApps.join(', ')}`);

  check('workspace-nx-json', Boolean(nxConfig), 'nx.json is required for target monorepo scaffold proof');
  check('workspace-pnpm', workspaceConfig.includes('apps/*') && workspaceConfig.includes('packages/*') && workspaceConfig.includes('services/*'), 'pnpm-workspace.yaml must include apps/*, packages/*, and services/*');
  check('workspace-tsconfig-paths', Boolean(tsconfig?.compilerOptions?.paths?.['@rhautt-nexus/contracts']), 'tsconfig.base.json must include @rhautt-nexus/contracts path');
  if (nxConfig) {
    for (const project of [...REQUIRED_FRONTEND_APPS, ...REQUIRED_PACKAGES, 'api']) {
      check(`workspace-nx-project:${project}`, Boolean(nxConfig.projects?.[project]), `nx.json missing project ${project}`);
    }
  }

  for (const app of contract.frontend?.apps || []) {
    check(`frontend-app-path:${app.id}`, /^apps\/[a-z0-9-]+$/.test(app.targetPath || ''), `${app.id}: targetPath must be apps/<id>`);
    check(`frontend-app-current-surface:${app.id}`, Boolean(app.currentSurface && exists(app.currentSurface)), `${app.id}: currentSurface must exist`);
    if (app.compatibilitySurface) {
      check(`frontend-app-compatibility-surface:${app.id}`, exists(app.compatibilitySurface), `${app.id}: compatibilitySurface must exist`);
    }
    check(`frontend-app-entry:${app.id}`, Boolean(app.productionEntry && app.productionEntry.startsWith('/')), `${app.id}: productionEntry must be an absolute public path`);
    check(`frontend-app-brand-boundary:${app.id}`, Boolean(app.brandBoundary), `${app.id}: brandBoundary is required`);
    check(`frontend-app-project-json:${app.id}`, exists(`${app.targetPath}/project.json`), `${app.id}: project.json scaffold is required`);
    check(`frontend-app-readme:${app.id}`, exists(`${app.targetPath}/README.md`), `${app.id}: README scaffold is required`);
    if (exists(`${app.targetPath}/project.json`)) {
      const project = readJson(`${app.targetPath}/project.json`);
      check(`frontend-app-scaffold-status:${app.id}`, project.targets?.build?.options?.status === 'scaffold-only', `${app.id}: project.json must keep status scaffold-only`);
      check(`frontend-app-current-surface-link:${app.id}`, project.targets?.build?.options?.currentSurface === app.currentSurface, `${app.id}: project.json currentSurface must match contract`);
      if (app.compatibilitySurface) {
        check(`frontend-app-compatibility-surface-link:${app.id}`, project.targets?.build?.options?.compatibilitySurface === app.compatibilitySurface, `${app.id}: project.json compatibilitySurface must match contract`);
      }
      if (Array.isArray(app.embeddedProductModules)) {
        const projectEmbeddedModules = project.targets?.build?.options?.embeddedProductModules || [];
        for (const embeddedModule of app.embeddedProductModules) {
          check(`frontend-app-embedded-module:${app.id}:${embeddedModule}`, projectEmbeddedModules.includes(embeddedModule), `${app.id}: project.json missing embedded module ${embeddedModule}`);
        }
      }
      const standaloneSpec = REQUIRED_STANDALONE_MODULE_APPS[app.id];
      if (standaloneSpec) {
        const deploymentModel = app.deploymentModel || {};
        const projectOptions = project.targets?.build?.options || {};
        const projectDeploymentModel = projectOptions.deploymentModel || {};
        check(`frontend-app-product-module:${app.id}`, app.productModuleId === standaloneSpec.productModuleId, `${app.id}: productModuleId must be ${standaloneSpec.productModuleId}`);
        check(`frontend-app-project-product-module:${app.id}`, projectOptions.productModuleId === standaloneSpec.productModuleId, `${app.id}: project.json productModuleId must be ${standaloneSpec.productModuleId}`);
        for (const key of ['moduleNamespace', 'dataNamespace', 'apiNamespace']) {
          check(`frontend-app-${key}:${app.id}`, app[key] === standaloneSpec[key], `${app.id}: ${key} must be ${standaloneSpec[key]}`);
          check(`frontend-app-project-${key}:${app.id}`, projectOptions[key] === standaloneSpec[key], `${app.id}: project.json ${key} must be ${standaloneSpec[key]}`);
        }
        for (const key of ['portalEmbedded', 'standaloneLaunchable']) {
          check(`frontend-app-deployment-${key}:${app.id}`, deploymentModel[key] === true, `${app.id}: deploymentModel.${key} must be true`);
          check(`frontend-app-project-deployment-${key}:${app.id}`, projectDeploymentModel[key] === true, `${app.id}: project.json deploymentModel.${key} must be true`);
        }
        check(`frontend-app-deployment-entry:${app.id}`, deploymentModel.embeddedEntry === standaloneSpec.embeddedEntry, `${app.id}: deploymentModel.embeddedEntry must be ${standaloneSpec.embeddedEntry}`);
        check(`frontend-app-project-deployment-entry:${app.id}`, projectDeploymentModel.embeddedEntry === standaloneSpec.embeddedEntry, `${app.id}: project.json deploymentModel.embeddedEntry must be ${standaloneSpec.embeddedEntry}`);
        check(`frontend-app-deployment-powered-by:${app.id}`, deploymentModel.poweredBy === 'Powered by Rhautt Comfort', `${app.id}: deploymentModel.poweredBy must be Powered by Rhautt Comfort`);
        check(`frontend-app-project-deployment-powered-by:${app.id}`, projectDeploymentModel.poweredBy === 'Powered by Rhautt Comfort', `${app.id}: project.json deploymentModel.poweredBy must be Powered by Rhautt Comfort`);
        for (const [key, expected] of Object.entries({
          standaloneAppShellMode: 'independent-product-app-shell',
          standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required'
        })) {
          check(`frontend-app-deployment-${key}:${app.id}`, deploymentModel[key] === expected, `${app.id}: deploymentModel.${key} must be ${expected}`);
          check(`frontend-app-project-deployment-${key}:${app.id}`, projectDeploymentModel[key] === expected, `${app.id}: project.json deploymentModel.${key} must be ${expected}`);
        }
        for (const domainTarget of standaloneSpec.standaloneDomainTargets) {
          check(`frontend-app-domain-target:${app.id}:${domainTarget}`, (deploymentModel.standaloneDomainTargets || []).includes(domainTarget), `${app.id}: deploymentModel.standaloneDomainTargets missing ${domainTarget}`);
          check(`frontend-app-project-domain-target:${app.id}:${domainTarget}`, (projectDeploymentModel.standaloneDomainTargets || []).includes(domainTarget), `${app.id}: project.json deploymentModel.standaloneDomainTargets missing ${domainTarget}`);
        }
        for (const alias of standaloneSpec.standaloneAliases) {
          check(`frontend-app-standalone-alias:${app.id}:${alias}`, (deploymentModel.standaloneAliases || []).includes(alias), `${app.id}: deploymentModel missing standalone alias ${alias}`);
          check(`frontend-app-project-standalone-alias:${app.id}:${alias}`, (projectDeploymentModel.standaloneAliases || []).includes(alias), `${app.id}: project.json deploymentModel missing standalone alias ${alias}`);
        }
        const dataBoundary = app.dataBoundary || {};
        const projectDataBoundary = projectOptions.dataBoundary || {};
        for (const [key, expected] of Object.entries({
          postgresRegistry: 'rhautt_nexus.product_modules',
          deploymentRegistry: 'rhautt_nexus.product_module_deployments',
          dataPartitionRegistry: 'rhautt_nexus.product_module_data_partitions',
          objectStoragePrefix: standaloneSpec.objectStoragePrefix,
          analyticsNamespace: standaloneSpec.analyticsNamespace,
          futureDatabaseStrategy: 'namespace-extractable-shared-ledger',
          currentDataMode: 'shared-foundation-product-domain-partitioned',
          futureDataMode: 'standalone-database-extractable',
          productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
          standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
          standaloneAppShellMode: 'independent-product-app-shell',
          standalonePostgresSchema: standaloneSpec.standalonePostgresSchema,
          standaloneMongoDatabase: standaloneSpec.standaloneMongoDatabase,
          standaloneObjectStorageBucket: standaloneSpec.standaloneObjectStorageBucket,
          standaloneDatabaseTarget: standaloneSpec.standaloneDatabaseTarget,
          extractionPlan: standaloneSpec.extractionPlan
        })) {
          check(`frontend-app-data-boundary:${app.id}:${key}`, dataBoundary[key] === expected, `${app.id}: dataBoundary.${key} must be ${expected}`);
          check(`frontend-app-project-data-boundary:${app.id}:${key}`, projectDataBoundary[key] === expected, `${app.id}: project.json dataBoundary.${key} must be ${expected}`);
        }
        for (const key of ['independentDatabaseReady', 'extractionProofRequired', 'futureStandaloneProductReady']) {
          check(`frontend-app-data-boundary:${app.id}:${key}`, dataBoundary[key] === true, `${app.id}: dataBoundary.${key} must be true`);
          check(`frontend-app-project-data-boundary:${app.id}:${key}`, projectDataBoundary[key] === true, `${app.id}: project.json dataBoundary.${key} must be true`);
        }
        for (const [key, expected] of Object.entries({
          productIndependenceLevel: 'portal-embedded-and-standalone-extractable',
          standaloneDomainStrategy: 'dedicated-domain-or-subdomain-required',
          standaloneAppShellMode: 'independent-product-app-shell',
          standalonePostgresSchema: standaloneSpec.standalonePostgresSchema,
          standaloneMongoDatabase: standaloneSpec.standaloneMongoDatabase,
          standaloneObjectStorageBucket: standaloneSpec.standaloneObjectStorageBucket,
          extractionPlan: standaloneSpec.extractionPlan
        })) {
          check(`frontend-app-root-standalone:${app.id}:${key}`, app[key] === expected, `${app.id}: ${key} must be ${expected}`);
          check(`frontend-app-project-root-standalone:${app.id}:${key}`, projectOptions[key] === expected, `${app.id}: project.json ${key} must be ${expected}`);
        }
        for (const table of standaloneSpec.ownedPostgresTables) {
          check(`frontend-app-owned-postgres:${app.id}:${table}`, (dataBoundary.ownedPostgresTables || []).includes(table), `${app.id}: dataBoundary.ownedPostgresTables missing ${table}`);
          check(`frontend-app-project-owned-postgres:${app.id}:${table}`, (projectDataBoundary.ownedPostgresTables || []).includes(table), `${app.id}: project.json dataBoundary.ownedPostgresTables missing ${table}`);
        }
        for (const namespace of standaloneSpec.ownedMongoNamespaces) {
          check(`frontend-app-owned-mongo:${app.id}:${namespace}`, (dataBoundary.ownedMongoNamespaces || []).includes(namespace), `${app.id}: dataBoundary.ownedMongoNamespaces missing ${namespace}`);
          check(`frontend-app-project-owned-mongo:${app.id}:${namespace}`, (projectDataBoundary.ownedMongoNamespaces || []).includes(namespace), `${app.id}: project.json dataBoundary.ownedMongoNamespaces missing ${namespace}`);
        }
      }
    }
  }

  const packageIds = (contract.frontend?.packages || []).map(pkg => pkg.id);
  const missingPackages = includesAll(packageIds, REQUIRED_PACKAGES);
  check('frontend-package-count', missingPackages.length === 0, `missing frontend packages: ${missingPackages.join(', ')}`);

  for (const pkg of contract.frontend?.packages || []) {
    check(`frontend-package-path:${pkg.id}`, /^packages\/[a-z0-9-]+$/.test(pkg.targetPath || ''), `${pkg.id}: targetPath must be packages/<id>`);
    check(`frontend-package-purpose:${pkg.id}`, Boolean(pkg.purpose), `${pkg.id}: purpose is required`);
    check(`frontend-package-project-json:${pkg.id}`, exists(`${pkg.targetPath}/project.json`), `${pkg.id}: project.json scaffold is required`);
    check(`frontend-package-index:${pkg.id}`, exists(`${pkg.targetPath}/src/index.ts`), `${pkg.id}: src/index.ts scaffold is required`);
    if (exists(`${pkg.targetPath}/project.json`)) {
      const project = readJson(`${pkg.targetPath}/project.json`);
      check(`frontend-package-scaffold-status:${pkg.id}`, project.targets?.build?.options?.status === 'scaffold-only', `${pkg.id}: project.json must keep status scaffold-only`);
    }
  }

  for (const rule of [
    'apps must not import from other apps',
    'apps must call production APIs through packages/contracts generated clients',
    'consumer apps must not import enterprise-only workbench modules',
    'React/Vite compatibility surface remains candidate-only until contract and navigation gates promote it'
  ]) {
    check(`dependency-rule:${rule}`, (contract.frontend?.dependencyRules || []).includes(rule), `frontend dependency rule missing: ${rule}`);
  }

  check('backend-service-id', contract.backend?.service?.id === 'api', 'backend service id must be api');
  check('backend-service-language', contract.backend?.service?.language === 'TypeScript', 'backend language must be TypeScript');
  check('backend-service-framework', contract.backend?.service?.framework === 'NestJS', 'backend framework must be NestJS');
  check('backend-service-adapter', contract.backend?.service?.httpAdapter === 'Fastify', 'backend httpAdapter must be Fastify');
  check('backend-service-architecture', contract.backend?.service?.architecture === 'DDD modular monolith', 'backend architecture must be DDD modular monolith');
  check('backend-compat-trunk', String(contract.backend?.service?.currentCompatibilityTrunk || '').includes('Express/JavaScript'), 'backend contract must record current Express/JavaScript compatibility trunk');
  check('backend-service-project-json', exists('services/api/project.json'), 'services/api/project.json scaffold is required');
  check('backend-service-main', exists('services/api/src/main.ts'), 'services/api/src/main.ts scaffold is required');
  check('backend-module-boundary-file', exists('services/api/src/modules/module-boundary.ts'), 'services/api/src/modules/module-boundary.ts scaffold is required');
  if (exists('services/api/project.json')) {
    const apiProject = readJson('services/api/project.json');
    check('backend-service-scaffold-status', apiProject.targets?.build?.options?.status === 'scaffold-only', 'services/api project.json must keep status scaffold-only');
    check('backend-service-scaffold-framework', apiProject.targets?.build?.options?.framework === 'NestJS', 'services/api project.json framework must be NestJS');
    check('backend-service-scaffold-adapter', apiProject.targets?.build?.options?.httpAdapter === 'Fastify', 'services/api project.json httpAdapter must be Fastify');
  }

  const missingModules = includesAll(contract.backend?.modules || [], REQUIRED_BACKEND_MODULES);
  check('backend-module-count', missingModules.length === 0, `missing backend modules: ${missingModules.join(', ')}`);
  const moduleBoundarySource = exists('services/api/src/modules/module-boundary.ts')
    ? read('services/api/src/modules/module-boundary.ts')
    : '';
  const appModuleSource = exists('services/api/src/modules/app.module.ts')
    ? read('services/api/src/modules/app.module.ts')
    : '';
  for (const moduleName of REQUIRED_BACKEND_MODULES) {
    const className = classNameForModule(moduleName);
    const sourcePath = `services/api/src/modules/${moduleName}/${moduleName}.module.ts`;
    const moduleSource = exists(sourcePath) ? read(sourcePath) : '';
    check(`backend-module-scaffold:${moduleName}`, exists(`services/api/src/modules/${moduleName}/README.md`), `${moduleName}: README scaffold is required`);
    check(`backend-module-source:${moduleName}`, exists(sourcePath), `${moduleName}: NestJS source module is required`);
    check(`backend-module-source-controller:${moduleName}`, moduleSource.includes(`@Controller('${moduleName}')`) && moduleSource.includes(`${className}BoundaryController`), `${moduleName}: boundary controller is required`);
    check(`backend-module-source-service:${moduleName}`, moduleSource.includes('@Injectable') && moduleSource.includes(`${className}BoundaryService`), `${moduleName}: boundary service is required`);
    check(`backend-module-source-module:${moduleName}`, moduleSource.includes('@Module') && moduleSource.includes(`${className}Module`), `${moduleName}: NestJS module class is required`);
    check(`backend-module-source-controls:${moduleName}`, ['tenantScope', 'auditLog', 'openApiContract'].every(token => moduleSource.includes(token)), `${moduleName}: tenant/audit/openapi controls are required`);
    check(`backend-module-app-import:${moduleName}`, appModuleSource.includes(`${className}Module`), `${moduleName}: AppModule import is required`);
    check(`backend-module-boundary-token:${moduleName}`, moduleBoundarySource.includes(`'${moduleName}'`), `${moduleName}: module-boundary.ts missing module`);
  }

  for (const rule of [
    'every production API must have a module owner',
    'every production API must be represented in OpenAPI before frontend use',
    'tenant scope, audit, authz, and error code handling are mandatory for write APIs',
    'module boundaries must map to production route catalog groups',
    'do not split microservices before domain, tenant, workflow, and test boundaries are stable'
  ]) {
    check(`backend-module-rule:${rule}`, (contract.backend?.moduleRules || []).includes(rule), `backend module rule missing: ${rule}`);
  }

  for (const key of REQUIRED_DATA_KEYS) {
    const node = contract.dataAndWorkflow?.[key];
    check(`data-boundary:${key}`, Boolean(node?.role && node?.currentEvidence), `${key}: role and currentEvidence are required`);
  }

  for (const [key, token] of REQUIRED_PRODUCT_TOKENS) {
    check(`product-boundary:${key}`, String(contract.productBoundaries?.[key] || '').includes(token), `product boundary ${key} must include ${token}`);
  }
  check(
    'product-boundary-equipment-brands',
    ['Rheem', 'Ruud', 'Everhot'].every(brand => (contract.productBoundaries?.equipmentBrands || []).includes(brand)),
    'equipment brands must include Rheem, Ruud, and Everhot'
  );

  for (const token of [
    'actual nx.json or turbo.json with project graph',
    'services/api NestJS + Fastify boot proof',
    'PostgreSQL staging migration with RLS proof',
    'Temporal worker runtime proof',
    'external object storage smoke',
    'staging network capacity proof',
    'clean npm run guard:all proof'
  ]) {
    check(
      `required-production-evidence:${token}`,
      (contract.requiredEvidenceBeforeProductionClaim || []).includes(token),
      `required production evidence missing: ${token}`
    );
  }

  const hasMissingImplementationDependencies = [
    ['next', 'Next.js'],
    ['@nestjs/core', 'NestJS core'],
    ['@nestjs/platform-fastify', 'NestJS Fastify adapter'],
    ['fastify', 'Fastify']
  ].filter(([dependency]) => {
    if (!exists('package.json')) return true;
    const pkg = readJson('package.json');
    return !pkg.dependencies?.[dependency] && !pkg.devDependencies?.[dependency];
  });
  if (hasMissingImplementationDependencies.length) {
    warnings.push(`target implementation dependencies are not installed: ${hasMissingImplementationDependencies.map(([, label]) => label).join(', ')}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    platform: contract.platform,
    status: contract.status,
    contractPath: CONTRACT_PATH,
    contractSha256: sha256(source),
    summary: {
      frontendApps: appIds.length,
      frontendPackages: packageIds.length,
      backendModules: (contract.backend?.modules || []).length,
      dataBoundaries: REQUIRED_DATA_KEYS.length,
      scaffoldProof: true,
      finalLaunchArchitectureProof: false,
      checks: checks.length,
      failures: failures.length,
      warnings: warnings.length
    },
    checks,
    warnings
  };
}

function renderMarkdown(report) {
  const lines = [
    '# 瑞诺瓦AI舒适家 Target Architecture Contract Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    `Contract: \`${report.contractPath}\``,
    '',
    `Contract SHA-256: \`${report.contractSha256}\``,
    '',
    `Frontend apps: ${report.summary.frontendApps}`,
    `Frontend packages: ${report.summary.frontendPackages}`,
    `Backend modules: ${report.summary.backendModules}`,
    '',
    '| Check | Result | Details |',
    '|---|---:|---|'
  ];
  for (const check of report.checks) {
    lines.push(`| ${check.name} | ${check.passed ? 'pass' : 'fail'} | ${String(check.details || '').replace(/\|/g, '/')} |`);
  }
  if (report.warnings?.length) {
    lines.push('', '## Warnings', '');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  lines.push('', '## Boundary', '', 'This is target architecture contract evidence only. It does not prove that Nx/Next/Nest production trunk has been implemented.');
  return lines.join('\n');
}

const report = inspect();

if (report) {
  fs.mkdirSync(fullPath('evidence/architecture'), { recursive: true });
  fs.writeFileSync(fullPath(REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(fullPath(REPORT_MD), renderMarkdown(report));
}

console.log(`Target Architecture Contract Check: failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
