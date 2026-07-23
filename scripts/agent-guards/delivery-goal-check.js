#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function fileSha256(relativePath) {
  return crypto.createHash('sha256').update(read(relativePath)).digest('hex');
}

const failures = [];
const warnings = [];
const SKIP_VISUAL_ACCEPTANCE = process.env.DELIVERY_GOAL_SKIP_VISUAL === 'true'
  || process.argv.includes('--nonvisual');

const REQUIRED_FILES = [
  'governance/locked-goal.json',
  'docs/_archive/RHAUTT-NEXUS-LOCKED-GOAL.md',
  'docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md',
  'docs/_archive/RHAUTT-NEXUS-DEVELOPMENT-GROUP-LAUNCH-BOARD.md',
  'docs/_archive/RHAUTT-NEXUS-GOAL-EVIDENCE-MATRIX.md',
  'docs/_archive/RHAUTT-NEXUS-MULTI-AGENT-DEVELOPMENT-GROUP.md',
  'docs/_archive/RHAUTT-NEXUS-HARNESS-ENGINEERING-ARCHITECTURE.md',
  'docs/_archive/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md',
  'docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md',
  'governance/agent-charter.md',
  'governance/task-board.json',
  'governance/quality-findings.json',
  'evidence/README.md',
  'evidence/release-evidence.json',
  'evidence/contracts/production-readiness-jest-result.json',
  'evidence/capacity/README.md',
  'evidence/operations/README.md',
  'evidence/security/README.md',
  'evidence/database/README.md',
  'evidence/cache/README.md',
  'evidence/workflow/README.md',
  'evidence/object-storage/README.md',
  'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json',
  'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.md',
  'evidence/rysnova-bim/rysnova-bim-external-proof-run.json',
  'evidence/rysnova-bim/rysnova-bim-external-proof-run.md',
  'evidence/rysnova-bim/rysnova-bim-launch-runbook.json',
  'evidence/rysnova-bim/rysnova-bim-launch-runbook.md',
  'evidence/rysnova-bim/rysnova-bim-final-readiness.json',
  'evidence/rysnova-bim/rysnova-bim-final-readiness.md',
  'evidence/sbom/README.md',
  'evidence/provenance/README.md',
  'evidence/rollback/README.md',
  'evidence/visual/README.md',
  'server/routes/rysnova-bim-runtime.routes.js',
  'server/routes/rysnova-bim-simple.js',
  'test/production-readiness/rysnova-bim-runtime-routes.test.js',
  'test/production-readiness/rysnova-bim-preview-compatibility.test.js',
  'test/production-readiness/rysnova-bim-production-evidence.test.js',
  'test/production-readiness/rysnova-bim-external-proof-preflight-semantic.test.js',
  'test/production-readiness/rysnova-bim-launch-runbook.test.js',
  'scripts/agent-guards/rysnova-diagnosis-cend-ui-vi-check.js',
  'audit/rysnova-diagnosis-cend-ui-vi-report.json',
  'audit/rysnova-diagnosis-cend-ui-vi-report.md',
  'evidence/operations/backup-restore-drill.json',
  'evidence/operations/backup-restore-drill.md',
  'database/postgres/README.md',
  'database/postgres/harness/target-schema-contract.json',
  'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql',
  'evidence/database/postgres-target-schema-report.json',
  'evidence/database/postgres-target-schema-report.md',
  'evidence/database/postgres-staging-smoke-report.json',
  'evidence/database/postgres-staging-smoke-report.md',
  'scripts/release/postgres-staging-smoke.js',
  'contracts/cache/rhautt-nexus-redis-cache-boundary.json',
  'evidence/cache/redis-cache-boundary-report.json',
  'evidence/cache/redis-cache-boundary-report.md',
  'evidence/cache/redis-runtime-smoke.json',
  'evidence/cache/redis-runtime-smoke.md',
  'scripts/release/redis-runtime-smoke.js',
  'scripts/agent-guards/redis-runtime-smoke-check.js',
  'contracts/workflow/rhautt-nexus-workflow-outbox-contract.json',
  'contracts/architecture/rhautt-nexus-target-architecture.json',
  'scripts/release/temporal-runtime-smoke.js',
  'scripts/release/external-proof-validation.js',
  'scripts/release/rysnova-bim-external-proof-preflight.js',
  'scripts/release/rysnova-bim-external-proof-runner.js',
  'scripts/release/rysnova-bim-launch-runbook.js',
  'scripts/release/rysnova-bim-final-readiness.js',
  'scripts/release/update-guard-all-nonvisual-evidence.js',
  'scripts/release/update-production-readiness-evidence.js',
  'docs/_archive/RHAUTT-NEXUS-WORKFLOW-OUTBOX-CONTRACT.md',
  'evidence/workflow/workflow-outbox-contract-report.json',
  'evidence/workflow/workflow-outbox-contract-report.md',
  'evidence/workflow/temporal-runtime-smoke.json',
  'evidence/workflow/temporal-runtime-smoke.md',
  'evidence/architecture/target-architecture-contract-report.json',
  'evidence/architecture/target-architecture-contract-report.md',
  'evidence/architecture/target-dependency-readiness-report.json',
  'evidence/architecture/target-dependency-readiness-report.md'
];
const REQUIRED_ACTIVE_VISUAL_PAGES = [
  '/index.html',
  '/index-ready.html',
  '/pain-diagnosis.html',
  '/customer-view.html',
  '/designer.html',
  '/rysnova-bim-designer.html',
  '/business-console.html'
];
const BROWSER_VISUAL_EXTERNAL_COMMAND = 'VISUAL_BASE_URL=<staging-or-browser-capable-url> VISUAL_BROWSER_WS_ENDPOINT=<cdp-endpoint-optional> npm run guard:browser-visual';

for (const file of REQUIRED_FILES) {
  if (!exists(file)) failures.push(`missing delivery goal file: ${file}`);
}

const goal = exists('docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md')
  ? read('docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md')
  : '';
const lockedGoal = exists('docs/_archive/RHAUTT-NEXUS-LOCKED-GOAL.md')
  ? read('docs/_archive/RHAUTT-NEXUS-LOCKED-GOAL.md')
  : '';
const launch = exists('docs/_archive/RHAUTT-NEXUS-DEVELOPMENT-GROUP-LAUNCH-BOARD.md')
  ? read('docs/_archive/RHAUTT-NEXUS-DEVELOPMENT-GROUP-LAUNCH-BOARD.md')
  : '';
const goalEvidenceMatrix = exists('docs/_archive/RHAUTT-NEXUS-GOAL-EVIDENCE-MATRIX.md')
  ? read('docs/_archive/RHAUTT-NEXUS-GOAL-EVIDENCE-MATRIX.md')
  : '';
const rysnovaBimContract = exists('docs/_archive/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md')
  ? read('docs/_archive/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md')
  : '';
const rysnovaBimRuntimeRoutes = exists('server/routes/rysnova-bim-runtime.routes.js')
  ? read('server/routes/rysnova-bim-runtime.routes.js')
  : '';
const rysnovaBimSimpleRoutes = exists('server/routes/rysnova-bim-simple.js')
  ? read('server/routes/rysnova-bim-simple.js')
  : '';
const rysnovaBimRuntimeRoutesTest = exists('test/production-readiness/rysnova-bim-runtime-routes.test.js')
  ? read('test/production-readiness/rysnova-bim-runtime-routes.test.js')
  : '';
const rysnovaBimPreviewCompatibilityTest = exists('test/production-readiness/rysnova-bim-preview-compatibility.test.js')
  ? read('test/production-readiness/rysnova-bim-preview-compatibility.test.js')
  : '';
const rysnovaBimProductionEvidenceTest = exists('test/production-readiness/rysnova-bim-production-evidence.test.js')
  ? read('test/production-readiness/rysnova-bim-production-evidence.test.js')
  : '';
const rysnovaBimExternalPreflightSemanticTest = exists('test/production-readiness/rysnova-bim-external-proof-preflight-semantic.test.js')
  ? read('test/production-readiness/rysnova-bim-external-proof-preflight-semantic.test.js')
  : '';
const lifecycleModel = exists('docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md')
  ? read('docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md')
  : '';
const charter = exists('docs/_archive/PROJECT-CHARTER-AND-PRD.md')
  ? read('docs/_archive/PROJECT-CHARTER-AND-PRD.md')
  : '';
const packageJson = exists('package.json') ? readJson('package.json') : null;
const lockedGoalJson = exists('governance/locked-goal.json')
  ? readJson('governance/locked-goal.json')
  : null;

if (!lockedGoalJson) {
  failures.push('missing machine-readable locked goal: governance/locked-goal.json');
} else {
  if (lockedGoalJson.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('governance/locked-goal.json platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  if (lockedGoalJson.softwareName !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('governance/locked-goal.json softwareName must be Rhautt Nexus / 瑞合数智枢纽');
  }
  if (lockedGoalJson.groupExpression !== 'Rhautt Comfort / 瑞合瑞德暖通科技集团') {
    failures.push('governance/locked-goal.json groupExpression must be Rhautt Comfort / 瑞合瑞德暖通科技集团');
  }
  if (lockedGoalJson.status !== 'locked-active-not-production-complete') {
    failures.push('governance/locked-goal.json status must be locked-active-not-production-complete');
  }
  if (lockedGoalJson.owner !== 'orchestrator-chief') {
    failures.push('governance/locked-goal.json owner must be orchestrator-chief');
  }

  for (const token of [
    '生产级数字化平台主干',
    '瑞合瑞德暖通科技集团',
    '瑞诺瓦 AI 问诊',
    '客户项目门户',
    '设计师成交工作台',
    'Rysnova 技术支持体系',
    '多租户后台',
    'IoT 生命周期衔接',
    '可上线、可扩展、可验证、可持续进化'
  ]) {
    if (!String(lockedGoalJson.oneSentenceGoal || '').includes(token)) {
      failures.push(`governance/locked-goal.json oneSentenceGoal missing token: ${token}`);
    }
  }

  const boundaries = lockedGoalJson.productBoundaries || {};
  for (const [key, tokens] of Object.entries({
    rhauttComfort: ['集团英文/中文表达', '不能作为软件名'],
    rhauttNexus: ['软件平台名', '不能回退'],
    rysnova: ['瑞诺瓦 / Rysnova', '英文名锁定为 Rysnova'],
    equipmentBrands: ['Rheem / Ruud / Everhot', '设备品牌'],
    publicExperience: ['官网和瑞诺瓦 AI 问诊保持 C 端逻辑', '不能改成企业后台'],
    internalExperience: ['企业级专业 UI/VI', '不能做成消费级营销页'],
    iotScope: ['IoT lifecycle handoff', '不宣称实时 IoT 控制平台'],
    dualModeProductModules: ['瑞诺瓦 / Rysnova 赋能体系（问诊 / CRM / BIM）可以在 Rhautt 官网中被使用', '独立上线', '独立数据分析', '不能把瑞诺瓦 / Rysnova 体系降级为官网普通内容页']
  })) {
    const boundaryText = `${boundaries[key]?.meaning || ''} ${boundaries[key]?.forbidden || ''}`;
    for (const token of tokens) {
      if (!boundaryText.includes(token)) {
        failures.push(`governance/locked-goal.json productBoundaries.${key} missing token: ${token}`);
      }
    }
  }

  const productModuleSpecs = {
    'rysnova-consumer-system': {
      displayName: '瑞诺瓦 / Rysnova（经销商赋能体系）',
      targetApp: 'apps/consumer-diagnosis',
      embeddedEntry: '/pain-diagnosis.html',
      standaloneAliases: ['/rysnova', '/rysnova-ai', '/rysnova-diagnosis'],
      moduleNamespace: 'rysnova',
      dataNamespace: 'rysnova',
      apiNamespace: '/api/v2/diagnosis'
    },
    'rysnova-bim-engineering-support': {
      displayName: '瑞诺瓦技术支持 BIM / Rysnova BIM',
      targetApp: 'apps/rysnova-bim-workbench',
      embeddedEntry: '/rysnova-bim-designer.html',
      standaloneAliases: ['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench'],
      moduleNamespace: 'rysnova-bim',
      dataNamespace: 'rysnova-bim',
      apiNamespace: '/api/v2/rysnova-bim'
    }
  };
  const independentModules = new Map((lockedGoalJson.independentProductModules || []).map(module => [module.id, module]));
  for (const [id, spec] of Object.entries(productModuleSpecs)) {
    const module = independentModules.get(id);
    if (!module) {
      failures.push(`governance/locked-goal.json missing independent product module: ${id}`);
      continue;
    }
    for (const [key, expected] of Object.entries(spec)) {
      if (key === 'standaloneAliases') continue;
      if (module[key] !== expected) {
        failures.push(`governance/locked-goal.json independentProductModules.${id}.${key} must be ${expected}`);
      }
    }
    if (module.poweredBy !== 'Powered by Rhautt Comfort') {
      failures.push(`governance/locked-goal.json independentProductModules.${id}.poweredBy must be Powered by Rhautt Comfort`);
    }
    for (const alias of spec.standaloneAliases) {
      if (!module.standaloneAliases?.includes(alias)) {
        failures.push(`governance/locked-goal.json independentProductModules.${id} missing standalone alias: ${alias}`);
      }
    }
  }

  const p0ModuleIds = new Set((lockedGoalJson.p0Modules || []).map(module => module.id));
  for (const id of [
    'public-portal',
    'consumer-diagnosis',
    'customer-project-portal',
    'designer-workbench',
    'rysnova-bim',
    'business-console',
    'backend-data-foundation'
  ]) {
    if (!p0ModuleIds.has(id)) failures.push(`governance/locked-goal.json missing P0 module: ${id}`);
  }

  const architecture = lockedGoalJson.targetArchitecture || {};
  for (const [key, token] of Object.entries({
    frontend: 'Nx/Turborepo monorepo + Next.js + React + TypeScript',
    backend: 'NestJS + Fastify + TypeScript',
    primaryDatabase: 'PostgreSQL',
    documentDatabase: 'MongoDB',
    cache: 'Redis',
    fileStorage: '对象存储',
    workflow: 'Temporal + Outbox',
    contract: 'OpenAPI + generated client',
    tests: 'Unit + Contract + E2E + Visual + Capacity + Security + Tenant isolation',
    release: 'SBOM + SLSA provenance + rollback drill'
  })) {
    if (!String(architecture[key] || '').includes(token)) {
      failures.push(`governance/locked-goal.json targetArchitecture.${key} missing token: ${token}`);
    }
  }

  for (const gate of [
    'guard:all',
    'harness:all',
    'test:production-readiness',
    'perf:capacity:inprocess',
    'staging/network capacity',
    'browser visual',
    'OpenAPI + generated client',
    'multi-tenant isolation',
    'HQ rollup',
    'audit log',
    '105 legacy HTML migration evidence',
    'React candidate production navigation block',
    'external object-storage smoke',
    'PostgreSQL staging RLS proof',
    'Temporal runtime worker proof',
    'Redis staging/TLS/ACL/degradation proof',
    'SBOM',
    'SLSA provenance',
    'rollback drill'
  ]) {
    if (!lockedGoalJson.acceptanceGates?.includes(gate)) {
      failures.push(`governance/locked-goal.json missing acceptance gate: ${gate}`);
    }
  }

  for (const agent of [
    'orchestrator-chief',
    'prd-charter-monitor',
    'ui-vi-director',
    'architecture-governor',
    'backend-platform-builder',
    'data-platform-architect',
    'legacy-fusion-migrator',
    'frontend-contract-auditor',
    'enterprise-ai-control-architect',
    'quote-cost-governor',
    'solution-design-rysnova-bim-director',
    'rysnova-bim-engineering-builder',
    'customer-project-lifecycle-director',
    'iot-lifecycle-architect',
    'test-harness-builder',
    'sre-guardian',
    'security-supply-chain'
  ]) {
    if (!lockedGoalJson.developmentGroup?.includes(agent)) {
      failures.push(`governance/locked-goal.json missing development agent: ${agent}`);
    }
  }

  const nonCompletionText = (lockedGoalJson.nonCompletionTruth || []).join('\n');
  for (const token of [
    '生产级交付尚未完成',
    'guard:all',
    'staging/network capacity',
    'PostgreSQL staging smoke',
    'Temporal runtime smoke',
    'external object-storage smoke',
    'Next/Nx/NestJS/Fastify',
    '105 个旧 HTML'
  ]) {
    if (!nonCompletionText.includes(token)) {
      failures.push(`governance/locked-goal.json nonCompletionTruth missing token: ${token}`);
    }
  }
  if (!String(lockedGoalJson.operatingRule || '').includes('不能升格为 production-complete')) {
    failures.push('governance/locked-goal.json operatingRule must block production-complete promotion without evidence');
  }
}

for (const token of [
  'Rhautt Nexus / 瑞合数智枢纽',
  '瑞合瑞德暖通科技集团',
  '瑞诺瓦 AI 问诊',
  '客户项目门户',
  '设计师成交工作台',
  'Rysnova 技术支持体系',
  '业务控制台',
  '多租户后台',
  'IoT 生命周期衔接',
  '可上线、可扩展、可验证、可持续进化',
  'Rhautt Comfort / 瑞合瑞德暖通科技集团',
  '不是软件名',
  '不擅自英文化',
  'Rheem / Ruud / Everhot',
  '官网和瑞诺瓦 AI 问诊保持 C 端逻辑',
  '当前系统做 lifecycle handoff',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  '对象存储',
  'Temporal + Outbox',
  'OpenAPI + generated client',
  'SBOM',
  'SLSA provenance',
  'rollback drill',
  'staging/network capacity'
]) {
  if (!goal.includes(token)) failures.push(`delivery goal missing token: ${token}`);
}

for (const token of [
  'One Sentence Goal',
  'Locked Product Truths',
  'Rhautt Nexus / 瑞合数智枢纽',
  'production-grade digital platform backbone',
  'Rhautt Comfort / 瑞合瑞德暖通科技集团',
  'Do not use as the software name',
  '瑞诺瓦',
  'Do not invent visible English naming',
  'Rheem / Ruud / Everhot',
  'IoT lifecycle handoff',
  'Nx/Turborepo monorepo + Next.js + React + TypeScript',
  'NestJS + Fastify + TypeScript',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'Temporal + Outbox',
  'OpenAPI + generated client',
  'Production Acceptance Gates',
  '105 legacy HTML assets',
  'Current Non-Completion Truth',
  'Operating Rule'
]) {
  if (!lockedGoal.includes(token)) failures.push(`locked goal missing token: ${token}`);
}

for (const token of [
  'Goal Lock',
  '生产级数字化平台主干',
  '不是继续堆演示页面',
  'guard、harness、contract、E2E、visual、capacity、security、SBOM、provenance、rollback',
  '不宣称当前系统已经承担实时 IoT 控制平台'
]) {
  if (!goal.includes(token)) failures.push(`delivery goal lock missing token: ${token}`);
}

const agentCharter = exists('governance/agent-charter.md')
  ? read('governance/agent-charter.md')
  : '';

for (const token of [
  'Goal Lock',
  'production-grade digital platform backbone',
  'Post-delivery care',
  'IoT lifecycle handoff only',
  'Production proof'
]) {
  if (!agentCharter.includes(token)) failures.push(`agent charter goal lock missing token: ${token}`);
}

for (const agent of [
  'orchestrator-chief',
  'prd-charter-monitor',
  'ui-vi-director',
  'architecture-governor',
  'backend-platform-builder',
  'data-platform-architect',
  'legacy-fusion-migrator',
  'solution-design-rysnova-bim-director',
  'customer-project-lifecycle-director',
  'test-harness-builder'
]) {
  if (!goal.includes(agent)) failures.push(`delivery goal missing required agent: ${agent}`);
  if (!launch.includes(agent)) failures.push(`launch board missing required agent: ${agent}`);
  if (!goalEvidenceMatrix.includes(agent)) failures.push(`goal evidence matrix missing required agent: ${agent}`);
}

for (const command of [
  'npm run guard:all',
  'npm run harness:all',
  'npm run test:production-readiness',
  'npm run perf:capacity:inprocess',
  BROWSER_VISUAL_EXTERNAL_COMMAND,
  'CAPACITY_BASE_URL=<staging-url> npm run perf:capacity'
]) {
  if (!goal.includes(command) && !launch.includes(command)) {
    failures.push(`delivery docs missing required command: ${command}`);
  }
}

for (const token of [
  'Goal Evidence Matrix',
  'Source of truth',
  'Rhautt Comfort / 瑞合瑞德暖通科技集团不是软件名',
  'Rhautt Nexus / 瑞合数智枢纽是软件平台名',
  '瑞诺瓦是 C 端舒适家系统品牌',
  'Rheem / Ruud / Everhot 是设备品牌',
  '主系统只做 IoT lifecycle handoff',
  'P0 功能闭环',
  'Target Architecture Evidence',
  'Production Evidence Gate',
  'Development Group Accountability',
  'Non-Completion Truth',
  'blocked-on-browser-visual',
  'missing-staging-run',
  'local-smoke-only',
  'target-contract-not-production-trunk',
  'guarded-runtime',
  'guard:active-runtime-deps',
  'guard:postgres-target-schema',
  'postgresTargetSchema',
  'target-contract-not-production-applied',
  'guard:workflow-outbox-contract',
  'workflowOutboxContract',
  'target-contract-not-production-runtime',
  'guard:target-architecture',
  'targetArchitectureContract',
  'targetDependencyReadiness',
  'redisCacheBoundary',
  'redisRuntimeSmoke',
  'guard:redis-runtime-smoke',
  'release:redis-runtime:smoke',
  'target-contract-not-production-trunk',
  'missing-target-dependencies',
  'guard:target-dependencies',
  'guard:redis-cache-boundary',
  'target-cache-boundary-simulated',
  'apps/public-portal',
  'apps/consumer-diagnosis',
  'apps/customer-portal',
  'apps/dealer-workbench',
  'apps/designer-workbench',
  'apps/rysnova-bim-workbench',
  '/js/konva-lite.js',
  '/js/orbit-controls-lite.js',
  '105 个旧 HTML',
  '37 个当前 orphan legacy engine',
  '14 个 resolved legacy engine',
  'Operating Rule'
]) {
  if (!goalEvidenceMatrix.includes(token)) failures.push(`goal evidence matrix missing token: ${token}`);
}

if (goal.includes('待命名软件平台')) {
  failures.push('delivery goal must not call 瑞诺瓦AI舒适家 an unnamed platform');
}

if (goal.includes('Rhautt Comfort 完全重构') || goal.includes('Rhautt Comfort PRD')) {
  failures.push('delivery goal must not use Rhautt Comfort as software/project title');
}

if (charter) {
  if (!charter.includes('Rhautt Nexus / 瑞合数智枢纽')) {
    failures.push('PROJECT-CHARTER-AND-PRD.md must identify Rhautt Nexus / 瑞合数智枢纽');
  }
  if (charter.includes('在正式确认前本文称为“待命名软件平台”')) {
    failures.push('PROJECT-CHARTER-AND-PRD.md still says the software is unnamed after 瑞诺瓦AI舒适家 selection');
  }
}

if (packageJson) {
  if (!packageJson.scripts?.['guard:delivery-goal']) {
    failures.push('package.json missing guard:delivery-goal script');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:delivery-goal')) {
    failures.push('package.json guard:all must include guard:delivery-goal');
  }
  if (packageJson.scripts?.['guard:browser-visual'] !== 'node scripts/agent-guards/browser-visual-acceptance.js') {
    failures.push('package.json guard:browser-visual must run browser visual acceptance');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:browser-visual')) {
    failures.push('package.json guard:all must include guard:browser-visual');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']) {
    failures.push('package.json missing guard:all:nonvisual script for sandbox-compatible non-visual checks');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:delivery-goal')) {
    failures.push('package.json guard:all:nonvisual must include guard:delivery-goal');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('node scripts/release/update-guard-all-nonvisual-evidence.js')) {
    failures.push('package.json guard:all:nonvisual must update guardAllNonVisual release evidence after a successful non-visual run');
  }
  if (packageJson.scripts?.['guard:active-page-static'] !== 'node scripts/agent-guards/active-page-static-acceptance.js') {
    failures.push('package.json guard:active-page-static must run active page static acceptance');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:active-page-static')) {
    failures.push('package.json guard:all must include guard:active-page-static');
  }
  if (packageJson.scripts?.['guard:active-runtime-deps'] !== 'node scripts/agent-guards/active-runtime-deps-check.js') {
    failures.push('package.json guard:active-runtime-deps must run active runtime dependency check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:active-runtime-deps')) {
    failures.push('package.json guard:all must include guard:active-runtime-deps');
  }
  if (packageJson.scripts?.['guard:rysnova-diagnosis-ui-vi'] !== 'node scripts/agent-guards/rysnova-diagnosis-cend-ui-vi-check.js') {
    failures.push('package.json guard:rysnova-diagnosis-ui-vi must run 瑞诺瓦 C-end diagnosis UI/VI check');
  }
  if (packageJson.scripts?.['guard:rysnova-diagnosis-ui-vi:report'] !== 'node scripts/agent-guards/rysnova-diagnosis-cend-ui-vi-check.js --report') {
    failures.push('package.json guard:rysnova-diagnosis-ui-vi:report must run 瑞诺瓦 C-end diagnosis UI/VI report mode');
  }
  if (packageJson.scripts?.['guard:postgres-target-schema'] !== 'node scripts/agent-guards/postgres-target-schema-check.js') {
    failures.push('package.json guard:postgres-target-schema must run PostgreSQL target schema check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:postgres-target-schema')) {
    failures.push('package.json guard:all must include guard:postgres-target-schema');
  }
  if (packageJson.scripts?.['guard:postgres-rls-behavior'] !== 'node scripts/agent-guards/postgres-rls-behavior-check.js') {
    failures.push('package.json guard:postgres-rls-behavior must run PostgreSQL RLS behavior check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:postgres-rls-behavior')) {
    failures.push('package.json guard:all must include guard:postgres-rls-behavior');
  }
  if (packageJson.scripts?.['guard:postgres-transaction-outbox'] !== 'node scripts/agent-guards/postgres-transaction-outbox-check.js') {
    failures.push('package.json guard:postgres-transaction-outbox must run PostgreSQL transaction + outbox check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:postgres-transaction-outbox')) {
    failures.push('package.json guard:all must include guard:postgres-transaction-outbox');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:postgres-transaction-outbox')) {
    failures.push('package.json guard:all:nonvisual must include guard:postgres-transaction-outbox');
  }
  if (packageJson.scripts?.['guard:postgres-staging-smoke'] !== 'node scripts/agent-guards/postgres-staging-smoke-check.js') {
    failures.push('package.json guard:postgres-staging-smoke must run PostgreSQL staging smoke check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:postgres-staging-smoke')) {
    failures.push('package.json guard:all must include guard:postgres-staging-smoke');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:postgres-staging-smoke')) {
    failures.push('package.json guard:all:nonvisual must include guard:postgres-staging-smoke');
  }
  if (packageJson.scripts?.['release:postgres-staging:smoke'] !== 'node scripts/release/postgres-staging-smoke.js') {
    failures.push('package.json release:postgres-staging:smoke must run PostgreSQL staging smoke');
  }
  if (packageJson.scripts?.['guard:workflow-outbox-contract'] !== 'node scripts/agent-guards/workflow-outbox-contract-check.js') {
    failures.push('package.json guard:workflow-outbox-contract must run Workflow + Outbox contract check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:workflow-outbox-contract')) {
    failures.push('package.json guard:all must include guard:workflow-outbox-contract');
  }
  if (packageJson.scripts?.['guard:temporal-runtime-smoke'] !== 'node scripts/agent-guards/temporal-runtime-smoke-check.js') {
    failures.push('package.json guard:temporal-runtime-smoke must run Temporal runtime smoke check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:temporal-runtime-smoke')) {
    failures.push('package.json guard:all must include guard:temporal-runtime-smoke');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:temporal-runtime-smoke')) {
    failures.push('package.json guard:all:nonvisual must include guard:temporal-runtime-smoke');
  }
  if (packageJson.scripts?.['release:temporal-runtime:smoke'] !== 'node scripts/release/temporal-runtime-smoke.js') {
    failures.push('package.json release:temporal-runtime:smoke must run Temporal runtime smoke');
  }
  if (packageJson.scripts?.['guard:target-architecture'] !== 'node scripts/agent-guards/target-architecture-contract-check.js') {
    failures.push('package.json guard:target-architecture must run target architecture contract check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:target-architecture')) {
    failures.push('package.json guard:all must include guard:target-architecture');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:target-architecture')) {
    failures.push('package.json guard:all:nonvisual must include guard:target-architecture');
  }
  if (packageJson.scripts?.['guard:target-dependencies'] !== 'node scripts/agent-guards/target-dependency-readiness-check.js') {
    failures.push('package.json guard:target-dependencies must run target dependency readiness check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:target-dependencies')) {
    failures.push('package.json guard:all must include guard:target-dependencies');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:target-dependencies')) {
    failures.push('package.json guard:all:nonvisual must include guard:target-dependencies');
  }
  if (packageJson.scripts?.['guard:redis-cache-boundary'] !== 'node scripts/agent-guards/redis-cache-boundary-check.js') {
    failures.push('package.json guard:redis-cache-boundary must run Redis cache boundary check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:redis-cache-boundary')) {
    failures.push('package.json guard:all must include guard:redis-cache-boundary');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:redis-cache-boundary')) {
    failures.push('package.json guard:all:nonvisual must include guard:redis-cache-boundary');
  }
  if (packageJson.scripts?.['release:redis-runtime:smoke'] !== 'node scripts/release/redis-runtime-smoke.js') {
    failures.push('package.json release:redis-runtime:smoke must run Redis runtime smoke');
  }
  if (packageJson.scripts?.['guard:redis-runtime-smoke'] !== 'node scripts/agent-guards/redis-runtime-smoke-check.js') {
    failures.push('package.json guard:redis-runtime-smoke must run Redis runtime smoke check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:redis-runtime-smoke')) {
    failures.push('package.json guard:all must include guard:redis-runtime-smoke');
  }
  if (!packageJson.scripts?.['guard:all:nonvisual']?.includes('guard:redis-runtime-smoke')) {
    failures.push('package.json guard:all:nonvisual must include guard:redis-runtime-smoke');
  }
  if (packageJson.scripts?.['test:tenant-isolation'] !== 'jest test/production-readiness/tenant-isolation.test.js --runInBand') {
    failures.push('package.json test:tenant-isolation must run the tenant isolation production-readiness test');
  }
  if (packageJson.scripts?.['test:audit-trail'] !== 'jest test/production-readiness/audit-service.test.js test/production-readiness/lifecycle-service.test.js --runInBand') {
    failures.push('package.json test:audit-trail must run audit and lifecycle audit production-readiness tests');
  }
  if (packageJson.scripts?.['test:health-readiness'] !== 'jest test/production-readiness/health-and-seed.test.js --runInBand') {
    failures.push('package.json test:health-readiness must run health readiness production-readiness tests');
  }
  if (packageJson.scripts?.['test:contracts'] !== 'jest test/production-readiness/openapi-contract.test.js --runInBand') {
    failures.push('package.json test:contracts must run OpenAPI production-readiness test');
  }
  if (packageJson.scripts?.['contracts:generate'] !== 'node scripts/contracts/generate-openapi-client.js') {
    failures.push('package.json contracts:generate must generate the OpenAPI client');
  }
  if (packageJson.scripts?.['guard:generated-client'] !== 'node scripts/agent-guards/generated-client-check.js') {
    failures.push('package.json guard:generated-client must run generated client check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:generated-client')) {
    failures.push('package.json guard:all must include guard:generated-client');
  }
  if (packageJson.scripts?.['guard:frontend-api-contract'] !== 'node scripts/agent-guards/frontend-api-contract-check.js') {
    failures.push('package.json guard:frontend-api-contract must run frontend API contract check');
  }
  if (packageJson.scripts?.['test:production-readiness:evidence'] !== 'jest test/production-readiness --runInBand --json --outputFile=evidence/contracts/production-readiness-jest-result.json && node scripts/release/update-production-readiness-evidence.js') {
    failures.push('package.json test:production-readiness:evidence must run Jest JSON output and update production readiness evidence');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:frontend-api-contract')) {
    failures.push('package.json guard:all must include guard:frontend-api-contract');
  }
  if (packageJson.scripts?.['guard:capacity-evidence'] !== 'node scripts/agent-guards/capacity-evidence-check.js') {
    failures.push('package.json guard:capacity-evidence must run capacity evidence check');
  }
  if (!packageJson.scripts?.['guard:all']?.includes('guard:capacity-evidence')) {
    failures.push('package.json guard:all must include guard:capacity-evidence');
  }
  for (const [script, command] of Object.entries({
    'sbom:generate': 'node scripts/release/generate-sbom.js',
    'release:provenance': 'node scripts/release/generate-provenance.js',
    'release:rollback:drill': 'node scripts/release/rollback-drill.js',
    'release:backup-restore:drill': 'node scripts/release/backup-restore-drill.js',
    'release:workflow-replay:smoke': 'node scripts/release/workflow-replay-smoke.js',
    'release:product-modules:standalone-smoke': 'node scripts/release/product-module-standalone-smoke.js',
    'guard:product-modules:standalone-smoke': 'node scripts/agent-guards/product-module-standalone-smoke-check.js',
    'release:target-api:boot-smoke': 'node scripts/release/target-api-boot-smoke.js',
    'release:redis-runtime:smoke': 'node scripts/release/redis-runtime-smoke.js',
    'release:rysnova-bim-storage:smoke': 'node scripts/release/rysnova-bim-object-storage-smoke.js',
    'release:rysnova-bim-external-proof-preflight': 'node scripts/release/rysnova-bim-external-proof-preflight.js',
    'release:rysnova-bim-external-proof': 'node scripts/release/rysnova-bim-external-proof-runner.js',
    'release:rysnova-bim-launch-runbook': 'node scripts/release/rysnova-bim-launch-runbook.js',
    'release:rysnova-bim-final-readiness': 'node scripts/release/rysnova-bim-final-readiness.js',
    'guard:all:nonvisual:evidence': 'node scripts/release/update-guard-all-nonvisual-evidence.js',
    'release:evidence': 'npm run sbom:generate && npm run release:provenance && npm run release:rollback:drill && npm run release:backup-restore:drill && npm run release:workflow-replay:smoke && npm run release:product-modules:standalone-smoke && npm run release:target-api:boot-smoke && npm run release:redis-runtime:smoke && npm run release:rysnova-bim-storage:smoke && node scripts/release/update-production-readiness-evidence.js && npm run release:rysnova-bim-external-proof-preflight && npm run release:rysnova-bim-external-proof && npm run release:rysnova-bim-launch-runbook && npm run release:rysnova-bim-final-readiness'
  })) {
    if (packageJson.scripts?.[script] !== command) {
      failures.push(`package.json ${script} must be ${command}`);
    }
  }
}

if (exists('governance/task-board.json')) {
  const board = readJson('governance/task-board.json');
  if (board.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('governance/task-board.json platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  const tasks = board.tasks || [];
  if (tasks.length < 7) failures.push('governance/task-board.json must include at least 7 launch tasks');
  for (const id of ['NX-DEL-001', 'NX-TEST-001', 'NX-PRD-001', 'NX-LEG-001', 'NX-LIT-001', 'NX-LIFE-001', 'NX-UI-002', 'NX-TEST-002']) {
    if (!tasks.some(task => task.id === id)) failures.push(`governance/task-board.json missing task ${id}`);
  }
  const uiTask = tasks.find(task => task.id === 'NX-UI-002');
  if (uiTask) {
    if (uiTask.status === 'done') {
      failures.push('NX-UI-002 must not be done until guard:rysnova-diagnosis-ui-vi and browser visual proof pass');
    }
    if (!uiTask.evidence?.includes('audit/rysnova-diagnosis-cend-ui-vi-report.json')) {
      failures.push('NX-UI-002 must cite the 瑞诺瓦 C-end UI/VI JSON report');
    }
    if (!uiTask.remainingProof?.some(item => item.includes('guard:rysnova-diagnosis-ui-vi'))) {
      failures.push('NX-UI-002 remainingProof must require guard:rysnova-diagnosis-ui-vi');
    }
  }
  const testTask = tasks.find(task => task.id === 'NX-TEST-002');
  if (testTask) {
    if (testTask.status === 'done') {
      failures.push('NX-TEST-002 must not be done until the 瑞诺瓦 C-end UI/VI guard is promoted into guard:all after passing');
    }
    if (!testTask.blockedBy?.some(item => item.includes('NX-UI-002'))) {
      failures.push('NX-TEST-002 must be blocked by NX-UI-002 until the page refactor passes');
    }
  }
}

if (exists('governance/quality-findings.json')) {
  const quality = readJson('governance/quality-findings.json');
  if (quality.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('governance/quality-findings.json platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  const findings = quality.findings || [];
  const rysnovaFinding = findings.find(finding => finding.id === 'QF-006');
  if (!rysnovaFinding) {
    failures.push('governance/quality-findings.json missing QF-006 for 瑞诺瓦 C-end UI/VI blockers');
  } else {
    if (rysnovaFinding.priority !== 'P0') {
      failures.push('QF-006 must remain P0 until 瑞诺瓦 C-end UI/VI blockers are cleared');
    }
    if (rysnovaFinding.area !== 'rysnova-cend-ui-vi') {
      failures.push('QF-006 area must be rysnova-cend-ui-vi');
    }
    if (rysnovaFinding.owner !== 'ui-vi-director') {
      failures.push('QF-006 owner must be ui-vi-director');
    }
    if (rysnovaFinding.sourceTask !== 'NX-UI-002') {
      failures.push('QF-006 sourceTask must be NX-UI-002');
    }
    if (rysnovaFinding.status === 'closed' || rysnovaFinding.status === 'done') {
      failures.push('QF-006 must not be closed until guard:rysnova-diagnosis-ui-vi and browser visual proof pass');
    }
    for (const token of [
      'guard:rysnova-diagnosis-ui-vi',
      'guard:browser-visual',
      'audit/rysnova-diagnosis-cend-ui-vi-report.json',
      'audit/rysnova-diagnosis-cend-ui-vi-report.md'
    ]) {
      if (!rysnovaFinding.requiredEvidence?.includes(token)) {
        failures.push(`QF-006 requiredEvidence missing token: ${token}`);
      }
    }
    const closeText = (rysnovaFinding.closeCriteria || []).join('\n');
    for (const token of [
      'archive/legacy-ui/public/pain-diagnosis.html',
      'guard:rysnova-diagnosis-ui-vi passes',
      'Desktop and mobile browser visual acceptance',
      'visualPackages',
      'customer report',
      'share chain'
    ]) {
      if (!closeText.includes(token)) {
        failures.push(`QF-006 closeCriteria missing token: ${token}`);
      }
    }
    if (exists('audit/rysnova-diagnosis-cend-ui-vi-report.json')) {
      const diagnosisUiReport = readJson('audit/rysnova-diagnosis-cend-ui-vi-report.json');
      const expectedBlockerIds = (diagnosisUiReport.checks || [])
        .filter(check => check.status === 'fail' && check.severity === 'blocker')
        .map(check => check.id)
        .sort();
      const findingBlockerIds = [...(rysnovaFinding.blockerIds || [])].sort();
      if (rysnovaFinding.blockerCount !== diagnosisUiReport.summary?.blockerFailures) {
        failures.push('QF-006 blockerCount must match 瑞诺瓦 diagnosis UI/VI report');
      }
      if (JSON.stringify(findingBlockerIds) !== JSON.stringify(expectedBlockerIds)) {
        failures.push('QF-006 blockerIds must match 瑞诺瓦 diagnosis UI/VI report');
      }
      if (diagnosisUiReport.pass !== true && rysnovaFinding.status !== 'active') {
        failures.push('QF-006 must remain active while 瑞诺瓦 diagnosis UI/VI report has blocker failures');
      }
    }
  }
}

if (exists('evidence/release-evidence.json')) {
  const evidence = readJson('evidence/release-evidence.json');
  if (evidence.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('evidence/release-evidence.json platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  const required = evidence.requiredEvidence || {};
  for (const key of [
    'guardAll',
    'guardAllNonVisual',
    'harnessAll',
    'productionReadiness',
    'openApiContract',
    'diagnosisCompletionLoop',
    'customerProjectPortalLoop',
    'capacityInprocess',
    'stagingNetworkCapacity',
    'browserVisual',
    'rysnovaDiagnosisCendUiVi',
    'activePageStatic',
    'activeRuntimeDeps',
    'postgresTargetSchema',
    'postgresRlsBehavior',
    'postgresTransactionOutbox',
    'postgresStagingSmoke',
    'workflowOutboxContract',
    'temporalRuntimeSmoke',
    'targetArchitectureContract',
    'targetDependencyReadiness',
    'productModuleStandaloneSmoke',
    'targetApiBootSmoke',
    'redisCacheBoundary',
    'redisRuntimeSmoke',
    'legacyFusion',
    'tenantIsolation',
    'auditTrail',
    'healthReadiness',
    'backupRestore',
    'rysnovaBimArtifactContract',
    'rysnovaBimRuntimeBoundary',
    'rysnovaBimPreviewCompatibilityBoundary',
    'rysnovaBimProductionEvidenceAggregate',
    'rysnovaBimObjectStorage',
    'rysnovaBimExternalProofPreflight',
    'rysnovaBimExternalProofRun',
    'rysnovaBimLaunchRunbook',
    'rysnovaBimFinalReadiness',
    'customerLifecycleStateModel',
    'sbom',
    'provenance',
    'rollback'
  ]) {
    if (!required[key]) failures.push(`evidence/release-evidence.json missing required evidence key: ${key}`);
  }
  if (evidence.status === 'production-complete') {
    warnings.push('release evidence says production-complete; verify all evidence before release');
  }
  if (required.guardAll?.command !== 'npm run guard:all') {
    failures.push('guardAll evidence command must be npm run guard:all');
  }
  if (required.guardAll?.path !== 'evidence/guards/') {
    failures.push('guardAll evidence path must be evidence/guards/');
  }
  if (exists('scripts/agent-guards/browser-visual-acceptance.js')) {
    const browserVisualSource = read('scripts/agent-guards/browser-visual-acceptance.js');
    for (const token of [
      "updateReleaseEvidence('browserVisual'",
      "status: 'passed-current-run'",
      "path: 'audit/browser-visual-acceptance-report.json'",
      "summaryPath: 'audit/browser-visual-acceptance-report.md'",
      'missingPages: []',
      'staleSourcePaths: []',
      "updateReleaseEvidence('guardAll'",
      "status: 'blocked-by-sandbox-browser-launch'"
    ]) {
      if (!browserVisualSource.includes(token)) {
        failures.push(`browser visual acceptance source missing success evidence token: ${token}`);
      }
    }
  }
  if (required.browserVisual?.status === 'passed-current-run') {
    if (!['passed-current-run', 'blocked-by-sandbox-browser-launch'].includes(required.guardAll?.status)) {
      failures.push('guardAll evidence must be passed-current-run or blocked-by-sandbox-browser-launch when browserVisual is passed-current-run');
    }
    if (required.guardAll?.status === 'blocked-by-sandbox-browser-launch') {
      const blocker = String(required.guardAll?.currentBlocker || '');
      if (!blocker.includes('guard:all:nonvisual') || !blocker.includes('browserVisual') || !blocker.includes('MachPort')) {
        failures.push('guardAll sandbox-browser-launch blocker must cite browserVisual, guard:all:nonvisual, and MachPort permission evidence');
      }
    }
  } else {
    if (required.guardAll?.status !== 'blocked-by-browser-visual') {
      failures.push('guardAll evidence must remain blocked-by-browser-visual until browserVisual is passed-current-run');
    }
    if (!String(required.guardAll?.currentBlocker || '').includes('browserVisual')) {
      failures.push('guardAll blocked state must name browserVisual as the current blocker');
    }
  }
  if (required.guardAllNonVisual?.command !== 'npm run guard:all:nonvisual') {
    failures.push('guardAllNonVisual evidence command must be npm run guard:all:nonvisual');
  }
  if (!['passed-current-run', 'needs-current-run'].includes(required.guardAllNonVisual?.status)) {
    failures.push('guardAllNonVisual evidence status must be passed-current-run or needs-current-run');
  }
  if (required.guardAllNonVisual?.path !== 'evidence/guards/') {
    failures.push('guardAllNonVisual evidence path must be evidence/guards/');
  }
  if (!String(required.guardAllNonVisual?.note || '').includes('does not replace browser visual acceptance')) {
    failures.push('guardAllNonVisual evidence note must state it does not replace browser visual acceptance');
  }
  if (required.productionReadiness?.command !== 'npm run test:production-readiness') {
    failures.push('productionReadiness evidence command must be npm run test:production-readiness');
  }
  if (required.productionReadiness?.status !== 'passed-current-run') {
    failures.push('productionReadiness evidence status must be passed-current-run');
  }
  if (required.productionReadiness?.path !== 'evidence/contracts/') {
    failures.push('productionReadiness evidence path must be evidence/contracts/');
  }
  if (required.productionReadiness?.resultPath !== 'evidence/contracts/production-readiness-jest-result.json') {
    failures.push('productionReadiness evidence resultPath must be evidence/contracts/production-readiness-jest-result.json');
  }
  if (required.productionReadiness?.suites < 60) {
    failures.push('productionReadiness evidence suites must be at least 60 after Rysnova launch runbook coverage');
  }
  if (required.productionReadiness?.tests < 288) {
    failures.push('productionReadiness evidence tests must be at least 288 after Rysnova launch runbook coverage');
  }
  if (required.productionReadiness?.passedSuites !== required.productionReadiness?.suites) {
    failures.push('productionReadiness evidence passedSuites must equal suites');
  }
  if (required.productionReadiness?.passedTests !== required.productionReadiness?.tests) {
    failures.push('productionReadiness evidence passedTests must equal tests');
  }
  if (!String(required.productionReadiness?.note || '').includes('does not replace browser visual') ||
      !String(required.productionReadiness?.note || '').includes('staging database') ||
      !String(required.productionReadiness?.note || '').includes('external runtime proof')) {
    failures.push('productionReadiness evidence note must not replace visual, staging database, or external runtime proof');
  }
  if (exists('evidence/contracts/production-readiness-jest-result.json')) {
    const jestResult = readJson('evidence/contracts/production-readiness-jest-result.json');
    if (jestResult.numTotalTestSuites !== required.productionReadiness?.suites) {
      failures.push('productionReadiness suites must match Jest result');
    }
    if (jestResult.numTotalTests !== required.productionReadiness?.tests) {
      failures.push('productionReadiness tests must match Jest result');
    }
    if (jestResult.numPassedTestSuites !== required.productionReadiness?.passedSuites) {
      failures.push('productionReadiness passedSuites must match Jest result');
    }
    if (jestResult.numPassedTests !== required.productionReadiness?.passedTests) {
      failures.push('productionReadiness passedTests must match Jest result');
    }
    if (jestResult.numFailedTestSuites !== 0 || jestResult.numFailedTests !== 0) {
      failures.push('productionReadiness Jest result must have zero failed suites and tests');
    }
  }
  if (required.rysnovaDiagnosisCendUiVi?.command !== 'npm run guard:rysnova-diagnosis-ui-vi') {
    failures.push('rysnovaDiagnosisCendUiVi evidence command must be npm run guard:rysnova-diagnosis-ui-vi');
  }
  if (required.rysnovaDiagnosisCendUiVi?.reportCommand !== 'npm run guard:rysnova-diagnosis-ui-vi:report') {
    failures.push('rysnovaDiagnosisCendUiVi reportCommand must be npm run guard:rysnova-diagnosis-ui-vi:report');
  }
  if (!['blocked-by-cend-ui-vi', 'passed-current-run'].includes(required.rysnovaDiagnosisCendUiVi?.status)) {
    failures.push('rysnovaDiagnosisCendUiVi status must be blocked-by-cend-ui-vi or passed-current-run');
  }
  if (required.rysnovaDiagnosisCendUiVi?.path !== 'audit/rysnova-diagnosis-cend-ui-vi-report.json') {
    failures.push('rysnovaDiagnosisCendUiVi path must be audit/rysnova-diagnosis-cend-ui-vi-report.json');
  }
  if (required.rysnovaDiagnosisCendUiVi?.summaryPath !== 'audit/rysnova-diagnosis-cend-ui-vi-report.md') {
    failures.push('rysnovaDiagnosisCendUiVi summaryPath must be audit/rysnova-diagnosis-cend-ui-vi-report.md');
  }
  if (required.rysnovaDiagnosisCendUiVi?.finalLaunchCendUiProof === true && required.rysnovaDiagnosisCendUiVi?.status !== 'passed-current-run') {
    failures.push('rysnovaDiagnosisCendUiVi finalLaunchCendUiProof true requires passed-current-run status');
  }
  if (required.rysnovaDiagnosisCendUiVi?.status === 'blocked-by-cend-ui-vi' && required.rysnovaDiagnosisCendUiVi?.finalLaunchCendUiProof !== false) {
    failures.push('blocked rysnovaDiagnosisCendUiVi must not claim finalLaunchCendUiProof');
  }
  if (!String(required.rysnovaDiagnosisCendUiVi?.promotionRule || '').includes('guard:all')) {
    failures.push('rysnovaDiagnosisCendUiVi promotionRule must mention guard:all promotion after pass');
  }
  if (!String(required.rysnovaDiagnosisCendUiVi?.note || '').includes('functional/API evidence') ||
      !String(required.rysnovaDiagnosisCendUiVi?.note || '').includes('browser visual acceptance')) {
    failures.push('rysnovaDiagnosisCendUiVi note must distinguish functional/API evidence from browser visual acceptance');
  }
  if (exists('audit/rysnova-diagnosis-cend-ui-vi-report.json')) {
    const diagnosisUiReport = readJson('audit/rysnova-diagnosis-cend-ui-vi-report.json');
    const expectedStatus = diagnosisUiReport.pass === true ? 'passed-current-run' : 'blocked-by-cend-ui-vi';
    if (required.rysnovaDiagnosisCendUiVi?.status !== expectedStatus) {
      failures.push(`rysnovaDiagnosisCendUiVi status must match audit report: expected ${expectedStatus}`);
    }
    if (required.rysnovaDiagnosisCendUiVi?.checks !== diagnosisUiReport.summary?.total) {
      failures.push('rysnovaDiagnosisCendUiVi checks must match audit report total');
    }
    if (required.rysnovaDiagnosisCendUiVi?.passed !== diagnosisUiReport.summary?.passed) {
      failures.push('rysnovaDiagnosisCendUiVi passed count must match audit report');
    }
    if (required.rysnovaDiagnosisCendUiVi?.blockerFailures !== diagnosisUiReport.summary?.blockerFailures) {
      failures.push('rysnovaDiagnosisCendUiVi blockerFailures must match audit report');
    }
    if (required.rysnovaDiagnosisCendUiVi?.finalLaunchCendUiProof !== (diagnosisUiReport.pass === true)) {
      failures.push('rysnovaDiagnosisCendUiVi finalLaunchCendUiProof must match audit report pass value');
    }
    const expectedBlockerIds = (diagnosisUiReport.checks || [])
      .filter(check => check.status === 'fail' && check.severity === 'blocker')
      .map(check => check.id)
      .sort();
    const releaseBlockerIds = [...(required.rysnovaDiagnosisCendUiVi?.blockerIds || [])].sort();
    if (JSON.stringify(releaseBlockerIds) !== JSON.stringify(expectedBlockerIds)) {
      failures.push('rysnovaDiagnosisCendUiVi blockerIds must match audit report blocker IDs');
    }
  }
  if (required.capacityInprocess?.command !== 'npm run perf:capacity:inprocess') {
    failures.push('capacityInprocess evidence command must be npm run perf:capacity:inprocess');
  }
  if (required.capacityInprocess?.status !== 'passed-current-run') {
    failures.push('capacityInprocess evidence must remain passed-current-run');
  }
  if (required.capacityInprocess?.reportPath !== 'audit/capacity-inprocess-report.json') {
    failures.push('capacityInprocess reportPath must be audit/capacity-inprocess-report.json');
  }
  if (required.capacityInprocess?.summaryPath !== 'audit/capacity-inprocess-report.md') {
    failures.push('capacityInprocess summaryPath must be audit/capacity-inprocess-report.md');
  }
  if (required.capacityInprocess?.customerProjectPortalScenario?.id !== 'customer-project-portal') {
    failures.push('capacityInprocess must record customer-project-portal scenario');
  }
  if (required.capacityInprocess?.customerProjectPortalScenario?.path !== '/api/v2/lifecycle/customer-projects') {
    failures.push('capacityInprocess customer-project-portal scenario must cover /api/v2/lifecycle/customer-projects');
  }
  if (required.capacityInprocess?.lifecycleHandoffPackageScenario?.id !== 'lifecycle-handoff-package') {
    failures.push('capacityInprocess must record lifecycle-handoff-package scenario');
  }
	  if (required.capacityInprocess?.lifecycleHandoffPackageScenario?.path !== '/api/v2/lifecycle/handover/{contractId}/handoff-package') {
	    failures.push('capacityInprocess lifecycle-handoff-package scenario must cover /api/v2/lifecycle/handover/{contractId}/handoff-package');
	  }
	  if (required.capacityInprocess?.rysnovaBimDeliverableArtifactsScenario?.id !== 'rysnova-bim-deliverable-artifacts') {
	    failures.push('capacityInprocess must record rysnova-bim-deliverable-artifacts scenario');
	  }
	  if (required.capacityInprocess?.rysnovaBimDeliverableArtifactsScenario?.path !== '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts') {
	    failures.push('capacityInprocess rysnova-bim-deliverable-artifacts scenario must cover /api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts');
	  }
	  if (required.capacityInprocess?.rysnovaBimSignoffPackageScenario?.id !== 'rysnova-bim-signoff-package') {
	    failures.push('capacityInprocess must record rysnova-bim-signoff-package scenario');
	  }
	  if (required.capacityInprocess?.rysnovaBimSignoffPackageScenario?.path !== '/api/v2/rysnova-bim/projects/{projectId}/signoff-package') {
	    failures.push('capacityInprocess rysnova-bim-signoff-package scenario must cover /api/v2/rysnova-bim/projects/{projectId}/signoff-package');
	  }
	  if (required.capacityInprocess?.rysnovaBimCustomerSignoffScenario?.id !== 'rysnova-bim-customer-signoff') {
	    failures.push('capacityInprocess must record rysnova-bim-customer-signoff scenario');
	  }
	  if (required.capacityInprocess?.rysnovaBimCustomerSignoffScenario?.path !== '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff') {
	    failures.push('capacityInprocess rysnova-bim-customer-signoff scenario must cover /api/v2/rysnova-bim/projects/{projectId}/customer-signoff');
	  }
	  if (required.capacityInprocess?.rysnovaBimDeepeningPackageScenario?.id !== 'rysnova-bim-deepening-package') {
	    failures.push('capacityInprocess must record rysnova-bim-deepening-package scenario');
	  }
	  if (required.capacityInprocess?.rysnovaBimDeepeningPackageScenario?.path !== '/api/v2/rysnova-bim/projects/{projectId}/deepening-package') {
	    failures.push('capacityInprocess rysnova-bim-deepening-package scenario must cover /api/v2/rysnova-bim/projects/{projectId}/deepening-package');
	  }
	  if (required.capacityInprocess?.rysnovaBimCustomerPackageScenario?.id !== 'rysnova-bim-customer-package') {
	    failures.push('capacityInprocess must record rysnova-bim-customer-package scenario');
	  }
	  if (required.capacityInprocess?.rysnovaBimCustomerPackageScenario?.path !== '/api/v2/rysnova-bim/projects/{projectId}/customer-package') {
	    failures.push('capacityInprocess rysnova-bim-customer-package scenario must cover /api/v2/rysnova-bim/projects/{projectId}/customer-package');
	  }
	  if (required.capacityInprocess?.rysnovaBimArtifactContentDownloadScenario?.id !== 'rysnova-bim-artifact-content-download') {
	    failures.push('capacityInprocess must record rysnova-bim-artifact-content-download scenario');
	  }
	  if (required.capacityInprocess?.rysnovaBimArtifactContentDownloadScenario?.path !== '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content') {
	    failures.push('capacityInprocess rysnova-bim-artifact-content-download scenario must cover /api/v2/rysnova-bim/artifacts/{artifactId}/download/content');
	  }
  if (required.stagingNetworkCapacity?.command !== 'CAPACITY_BASE_URL=<staging-url> npm run perf:capacity') {
    failures.push('stagingNetworkCapacity evidence command must be CAPACITY_BASE_URL=<staging-url> npm run perf:capacity');
  }
  if (!['missing-staging-run', 'preflight-failed', 'staging-network-not-final', 'failed-staging-current-run', 'passed-staging-current-run'].includes(required.stagingNetworkCapacity?.status)) {
    failures.push('stagingNetworkCapacity evidence status must be missing-staging-run, preflight-failed, staging-network-not-final, failed-staging-current-run, or passed-staging-current-run');
  }
  if (required.stagingNetworkCapacity?.reportPath && required.stagingNetworkCapacity.reportPath !== 'audit/capacity-load-report.json') {
    failures.push('stagingNetworkCapacity reportPath must be audit/capacity-load-report.json');
  }
  if (required.stagingNetworkCapacity?.summaryPath && required.stagingNetworkCapacity.summaryPath !== 'audit/capacity-load-report.md') {
    failures.push('stagingNetworkCapacity summaryPath must be audit/capacity-load-report.md');
  }
  if (required.stagingNetworkCapacity?.requiredScenario?.id !== 'customer-project-portal') {
    failures.push('stagingNetworkCapacity must require customer-project-portal scenario');
  }
  if (required.stagingNetworkCapacity?.requiredScenario?.path !== '/api/v2/lifecycle/customer-projects') {
    failures.push('stagingNetworkCapacity required scenario must cover /api/v2/lifecycle/customer-projects');
  }
	  const stagingRequiredScenarios = required.stagingNetworkCapacity?.requiredScenarios || [];
	  if (!stagingRequiredScenarios.some(item => item.id === 'lifecycle-handoff-package' && item.path === '/api/v2/lifecycle/handover/{contractId}/handoff-package')) {
	    failures.push('stagingNetworkCapacity requiredScenarios must include lifecycle-handoff-package');
	  }
	  if (!stagingRequiredScenarios.some(item => item.id === 'rysnova-bim-deliverable-artifacts' && item.path === '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts')) {
	    failures.push('stagingNetworkCapacity requiredScenarios must include rysnova-bim-deliverable-artifacts');
	  }
	  if (!stagingRequiredScenarios.some(item => item.id === 'rysnova-bim-customer-signoff' && item.path === '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff')) {
	    failures.push('stagingNetworkCapacity requiredScenarios must include rysnova-bim-customer-signoff');
	  }
	  if (!stagingRequiredScenarios.some(item => item.id === 'rysnova-bim-deepening-package' && item.path === '/api/v2/rysnova-bim/projects/{projectId}/deepening-package')) {
	    failures.push('stagingNetworkCapacity requiredScenarios must include rysnova-bim-deepening-package');
	  }
	  if (!stagingRequiredScenarios.some(item => item.id === 'rysnova-bim-customer-package' && item.path === '/api/v2/rysnova-bim/projects/{projectId}/customer-package')) {
	    failures.push('stagingNetworkCapacity requiredScenarios must include rysnova-bim-customer-package');
	  }
	  if (!Object.prototype.hasOwnProperty.call(required.stagingNetworkCapacity || {}, 'rysnovaBimCustomerPackageSeed')) {
	    failures.push('stagingNetworkCapacity must record rysnovaBimCustomerPackageSeed');
	  }
  if (required.stagingNetworkCapacity?.finalLaunchCapacityProof === true && required.stagingNetworkCapacity?.status !== 'passed-staging-current-run') {
    failures.push('stagingNetworkCapacity finalLaunchCapacityProof true requires passed-staging-current-run status');
  }
  if (required.stagingNetworkCapacity?.status === 'passed-staging-current-run' && required.stagingNetworkCapacity?.finalLaunchCapacityProof !== true) {
    failures.push('stagingNetworkCapacity passed-staging-current-run requires finalLaunchCapacityProof true');
  }
  if (required.stagingNetworkCapacity?.finalLaunchCapacityProof === true && required.stagingNetworkCapacity?.evidenceMode !== 'staging-mongodb') {
    failures.push('stagingNetworkCapacity final launch proof requires evidenceMode staging-mongodb');
  }
  if (exists('audit/capacity-load-report.json')) {
    const capacityReport = readJson('audit/capacity-load-report.json');
    const expectedCapacityStatus = capacityReport.summary?.finalLaunchCapacityProof === true
      ? 'passed-staging-current-run'
      : capacityReport.summary?.preflightFailed === true
        ? 'preflight-failed'
        : capacityReport.evidenceMode === 'staging-mongodb'
          ? 'failed-staging-current-run'
          : capacityReport.evidenceMode === 'staging-network'
            ? 'staging-network-not-final'
            : 'missing-staging-run';
    if (required.stagingNetworkCapacity?.status !== expectedCapacityStatus) {
      failures.push(`stagingNetworkCapacity status must match audit/capacity-load-report.json: expected ${expectedCapacityStatus}`);
    }
    if (required.stagingNetworkCapacity?.evidenceMode !== capacityReport.evidenceMode) {
      failures.push('stagingNetworkCapacity evidenceMode must match audit/capacity-load-report.json');
    }
    if (required.stagingNetworkCapacity?.finalLaunchCapacityProof !== (capacityReport.summary?.finalLaunchCapacityProof === true)) {
      failures.push('stagingNetworkCapacity finalLaunchCapacityProof must match capacity report');
    }
    if (capacityReport.summary?.finalLaunchCapacityProof === true) {
      if (capacityReport.evidenceMode !== 'staging-mongodb') {
        failures.push('capacity final launch proof requires capacity report evidenceMode staging-mongodb');
      }
      if (capacityReport.summary?.failed !== 0) {
        failures.push('capacity final launch proof requires zero failed scenarios');
      }
    }
  }
  if (exists('evidence/capacity/README.md')) {
    const capacityReadme = read('evidence/capacity/README.md');
    for (const token of [
      'missing-staging-run',
      'preflight-failed',
      'staging-network-not-final',
      'failed-staging-current-run',
      'passed-staging-current-run',
	      'summary.finalLaunchCapacityProof',
	      '/api/v2/lifecycle/customer-projects',
	      'lifecycle-handoff-package',
	      '/api/v2/lifecycle/handover/{contractId}/handoff-package',
		      'rysnova-bim-deliverable-artifacts',
		      '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
		      'rysnova-bim-signoff-package',
		      '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
		      'rysnova-bim-customer-signoff',
		      '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff',
		      'rysnova-bim-deepening-package',
	      '/api/v2/rysnova-bim/projects/{projectId}/deepening-package',
	      'rysnova-bim-customer-package',
	      '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
	      'rysnova-bim-artifact-content-download',
	      '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
	      'CAPACITY_SEED_RYSNOVA_CUSTOMER_PACKAGE'
	    ]) {
      if (!capacityReadme.includes(token)) failures.push(`capacity README missing token: ${token}`);
    }
  }
  if (exists('audit/capacity-load-test.js')) {
    const capacityLoadScript = read('audit/capacity-load-test.js');
    for (const token of [
      'updateReleaseEvidence',
      'capacityReleaseStatus',
      'preflight-failed',
      'staging-network-not-final',
	      'passed-staging-current-run',
	      'customer-project-portal',
	      '/api/v2/lifecycle/customer-projects',
	      'lifecycle-handoff-package',
	      '/api/v2/lifecycle/handover/{contractId}/handoff-package',
		      'rysnova-bim-deliverable-artifacts',
		      '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
		      'rysnova-bim-signoff-package',
		      '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
		      'rysnova-bim-customer-signoff',
		      '/api/v2/rysnova-bim/projects/{projectId}/customer-signoff',
		      'rysnova-bim-deepening-package',
	      '/api/v2/rysnova-bim/projects/{projectId}/deepening-package',
	      'rysnova-bim-customer-package',
	      '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
	      'seedRysnovaCustomerPackage',
	      'validateRysnovaCustomerPackage',
	      'validateRysnovaCustomerSignoff',
	      'RYSNOVA_SIGNOFF_REQUIRED_TYPES',
	      'signoffComplete',
	      'customerSignoffConfirmationReady',
	      'customerSignoffReceipt'
	    ]) {
      if (!capacityLoadScript.includes(token)) failures.push(`capacity load script missing token: ${token}`);
    }
    for (const token of [
      'principle-diagram',
      'construction-drawing',
      'bim-model',
      'bom',
      'quantity-takeoff',
      'standards-check',
      'customer-report'
    ]) {
      if (!capacityLoadScript.includes(token)) failures.push(`capacity load script missing Rysnova signoff type: ${token}`);
    }
  }
  if (required.redisCacheBoundary?.status !== 'target-cache-boundary-simulated') {
    failures.push('redisCacheBoundary evidence must be target-cache-boundary-simulated');
  }
  if (required.redisCacheBoundary?.command !== 'npm run guard:redis-cache-boundary') {
    failures.push('redisCacheBoundary evidence command must be npm run guard:redis-cache-boundary');
  }
  if (required.redisCacheBoundary?.path !== 'evidence/cache/redis-cache-boundary-report.json') {
    failures.push('redisCacheBoundary evidence path must be evidence/cache/redis-cache-boundary-report.json');
  }
  if (required.redisCacheBoundary?.summaryPath !== 'evidence/cache/redis-cache-boundary-report.md') {
    failures.push('redisCacheBoundary evidence summaryPath must be evidence/cache/redis-cache-boundary-report.md');
  }
  if (required.redisCacheBoundary?.contractPath !== 'contracts/cache/rhautt-nexus-redis-cache-boundary.json') {
    failures.push('redisCacheBoundary contractPath must be contracts/cache/rhautt-nexus-redis-cache-boundary.json');
  }
  if (required.redisCacheBoundary?.finalLaunchRedisProof !== false) {
    failures.push('redisCacheBoundary must not claim final launch Redis proof from local simulation');
  }
  for (const capability of [
    'cache-session-rate-limit-task-status-only',
    'tenant-scoped-keys',
    'ttl-required',
    'redis-unavailable-safe-degrade',
    'not-business-truth-source',
    'lifecycle_handoff_only'
  ]) {
    if (!required.redisCacheBoundary?.capabilities?.includes(capability)) {
      failures.push(`redisCacheBoundary missing capability: ${capability}`);
    }
  }
  if (exists('evidence/cache/redis-cache-boundary-report.json')) {
    const redisReport = readJson('evidence/cache/redis-cache-boundary-report.json');
    if (redisReport.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Redis cache boundary report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (redisReport.status !== 'target-cache-boundary-simulated-not-staging-redis') {
      failures.push('Redis cache boundary report must remain target-cache-boundary-simulated-not-staging-redis');
    }
    if (redisReport.finalLaunchRedisProof !== false) {
      failures.push('Redis cache boundary report must not claim final launch Redis proof');
    }
    if (redisReport.summary?.failures !== 0) {
      failures.push('Redis cache boundary report must have zero failures');
    }
    if (redisReport.contractPath !== 'contracts/cache/rhautt-nexus-redis-cache-boundary.json') {
      failures.push('Redis cache boundary report must point to the Redis contract');
    }
  } else {
    failures.push('missing Redis cache boundary report');
  }
  for (const [sourcePath, tokens] of Object.entries({
    'contracts/cache/rhautt-nexus-redis-cache-boundary.json': ['target-boundary-not-production-redis-smoke', 'forbiddenTruthSources', 'tenantScopedPattern', 'redisUnavailable', 'lifecycle handoff'],
    'server/core/CacheEngine.js': ["prefix: 'rhautt:nexus:'", 'tenantId', 'tenant:${safeTenantId}', 'setex', 'return null'],
    'server/core/CalculationCache.js': ["require('redis')", 'createClient', 'REDIS_ENABLED', 'rhautt:nexus:tenant:${tenantId}:calc', 'ALLOWED_SYSTEMS', 'Unsupported calculation cache system'],
    'server/modules/productionMiddleware.js': ['RATE_LIMIT_WINDOW_MS', 'rateLimitWindowMs', "app.use('/api', rateLimit"],
    'server/modules/health/health.service.js': ["redis: process.env.REDIS_URL ? 'configured' : 'not_configured'"],
    'test/production-readiness/redis-cache-boundary.test.js': ['Redis cache boundary readiness', 'tenant-scoped 瑞诺瓦AI舒适家 keys', 'Unsupported calculation cache system']
  })) {
    if (!exists(sourcePath)) {
      failures.push(`missing Redis boundary source: ${sourcePath}`);
      continue;
    }
    const source = read(sourcePath);
    for (const token of tokens) {
      if (!source.includes(token)) failures.push(`${sourcePath} missing Redis boundary token: ${token}`);
    }
  }
  if (!['missing-runtime-run', 'runtime-reachable-security-missing', 'passed-runtime-current-run'].includes(required.redisRuntimeSmoke?.status)) {
    failures.push('redisRuntimeSmoke evidence status must be missing-runtime-run, runtime-reachable-security-missing, or passed-runtime-current-run');
  }
  if (required.redisRuntimeSmoke?.command !== 'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke') {
    failures.push('redisRuntimeSmoke evidence command must document REDIS_STAGING_URL launch gate');
  }
  if (required.redisRuntimeSmoke?.path !== 'evidence/cache/redis-runtime-smoke.json') {
    failures.push('redisRuntimeSmoke evidence path must be evidence/cache/redis-runtime-smoke.json');
  }
  if (required.redisRuntimeSmoke?.summaryPath !== 'evidence/cache/redis-runtime-smoke.md') {
    failures.push('redisRuntimeSmoke evidence summaryPath must be evidence/cache/redis-runtime-smoke.md');
  }
  if (required.redisRuntimeSmoke?.contractPath !== 'contracts/cache/rhautt-nexus-redis-cache-boundary.json') {
    failures.push('redisRuntimeSmoke contractPath must be contracts/cache/rhautt-nexus-redis-cache-boundary.json');
  }
  for (const capability of [
    'redisUrlConfigured',
    'redisClientAvailable',
    'connectAndPing',
    'tenantScopedKeys',
    'ttlProof',
    'crossTenantMiss',
    'tlsAclSecretConfigurationObserved',
    'redisUnavailableDegradationDrillRequired',
    'notBusinessTruthSource',
    'rysnovaBimCustomerSignoffNotRedisTruth',
    'lifecycle_handoff_only'
  ]) {
    if (!required.redisRuntimeSmoke?.capabilities?.includes(capability)) {
      failures.push(`redisRuntimeSmoke missing capability: ${capability}`);
    }
  }
  if (exists('evidence/cache/redis-runtime-smoke.json')) {
    const redisRuntimeSmoke = readJson('evidence/cache/redis-runtime-smoke.json');
    if (redisRuntimeSmoke.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Redis runtime smoke report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (redisRuntimeSmoke.contractSha256 !== fileSha256('contracts/cache/rhautt-nexus-redis-cache-boundary.json')) {
      failures.push('Redis runtime smoke report is stale; rerun npm run release:redis-runtime:smoke');
    }
    if (redisRuntimeSmoke.status === 'passed-runtime-current-run') {
      if (redisRuntimeSmoke.finalLaunchRedisProof !== true || redisRuntimeSmoke.redisRuntime !== true) {
        failures.push('passed Redis runtime smoke must prove Redis runtime and finalLaunchRedisProof');
      }
      if (redisRuntimeSmoke.tlsObserved !== true || redisRuntimeSmoke.aclSecretObserved !== true || redisRuntimeSmoke.degradationDrillProof !== true) {
        failures.push('passed Redis runtime smoke must prove TLS/ACL/secret posture and degradation drill');
      }
      if (required.redisRuntimeSmoke?.finalLaunchRedisProof !== true) {
        failures.push('release evidence redisRuntimeSmoke must mark final Redis proof true only after runtime pass');
      }
    } else {
      if (redisRuntimeSmoke.finalLaunchRedisProof !== false || required.redisRuntimeSmoke?.finalLaunchRedisProof !== false) {
        failures.push('missing/incomplete Redis runtime smoke must not claim final launch Redis proof');
      }
    }
    if (redisRuntimeSmoke.status === 'missing-runtime-run' && !String(redisRuntimeSmoke.reason || '').includes('REDIS_STAGING_URL') && !String(redisRuntimeSmoke.reason || '').includes('redis package')) {
      failures.push('missing Redis runtime smoke report must explain REDIS_STAGING_URL/REDIS_URL/REDIS_HOST or redis package blocker');
    }
  } else {
    failures.push('missing Redis runtime smoke report');
  }
  if (exists('scripts/release/redis-runtime-smoke.js')) {
    const redisRuntimeSmokeScript = read('scripts/release/redis-runtime-smoke.js');
    for (const token of ['REDIS_STAGING_URL', 'REDIS_URL', 'REDIS_HOST', 'setEx', 'tenantScopedKeys', 'ttlProof', 'REDIS_DEGRADATION_DRILL_PROOF', 'lifecycle_handoff_only', 'finalLaunchRedisProof', 'validateRedisRuntimeEnv', 'semanticFailures', 'invalidEnv', 'rysnova-bim-task-status-payload-no-business-truth', 'rysnova-bim-signoff-business-truth-detected-before-write', 'customerSignoffReceipt']) {
      if (!redisRuntimeSmokeScript.includes(token)) failures.push(`Redis runtime smoke script missing token: ${token}`);
    }
  }
  if (!exists('test/production-readiness/tenant-isolation.test.js')) {
    failures.push('missing tenant isolation production-readiness test');
  }
  if (required.tenantIsolation?.status !== 'passed-current-run') {
    failures.push('tenantIsolation evidence must be passed-current-run');
  }
  if (required.tenantIsolation?.path !== 'test/production-readiness/tenant-isolation.test.js') {
    failures.push('tenantIsolation evidence path must point to the production-readiness test');
  }
  if (required.tenantIsolation?.summaryPath !== 'evidence/security/tenant-isolation.md') {
    failures.push('tenantIsolation evidence summaryPath must be evidence/security/tenant-isolation.md');
  }
  if (required.tenantIsolation?.repositoryBoundary?.status !== 'passed-current-run') {
    failures.push('tenantIsolation repositoryBoundary evidence must be passed-current-run');
  }
  if (required.tenantIsolation?.repositoryBoundary?.sourcePath !== 'server/repositories/BaseRepository.js') {
    failures.push('tenantIsolation repositoryBoundary sourcePath must be server/repositories/BaseRepository.js');
  }
  if (!required.tenantIsolation?.repositoryBoundary?.tests?.includes('test/production-readiness/repository-and-crm.test.js') ||
    !required.tenantIsolation?.repositoryBoundary?.tests?.includes('test/production-readiness/tenant-isolation.test.js')) {
    failures.push('tenantIsolation repositoryBoundary must cite repository-and-crm and tenant-isolation tests');
  }
  if (exists('server/repositories/BaseRepository.js')) {
    const baseRepository = read('server/repositories/BaseRepository.js');
    for (const token of ['sanitizeTenantUpdate', 'delete base.tenantId', 'delete setPayload.tenantId', 'delete setOnInsert.tenantId', 'tenantId: this.requireTenant(scope)', '$setOnInsert']) {
      if (!baseRepository.includes(token)) failures.push(`BaseRepository tenant boundary missing token: ${token}`);
    }
  }
  if (exists('test/production-readiness/repository-and-crm.test.js')) {
    const repositoryTest = read('test/production-readiness/repository-and-crm.test.js');
    for (const token of ['BaseRepository update cannot move documents across tenants', '$setOnInsert', "expect(update.tenantId).toBeUndefined()", "expect(update.$set.tenantId).toBe('tenant-a')"]) {
      if (!repositoryTest.includes(token)) failures.push(`repository-and-crm tenant boundary test missing token: ${token}`);
    }
  }
  if (exists('test/production-readiness/tenant-isolation.test.js')) {
    const tenantIsolationTest = read('test/production-readiness/tenant-isolation.test.js');
    for (const token of ['tenant scope overrides any caller-supplied tenantId in updateById', '$set', "tenantId: 'tenant-a'"]) {
      if (!tenantIsolationTest.includes(token)) failures.push(`tenant-isolation repository boundary test missing token: ${token}`);
    }
  }
  if (!exists('server/modules/audit/audit.service.js')) {
    failures.push('missing AuditService');
  }
  if (!exists('server/modules/audit/audit.routes.js')) {
    failures.push('missing audit routes');
  }
  if (!exists('test/production-readiness/audit-service.test.js')) {
    failures.push('missing audit service production-readiness test');
  }
  if (required.auditTrail?.status !== 'passed-current-run') {
    failures.push('auditTrail evidence must be passed-current-run');
  }
  if (required.auditTrail?.path !== 'test/production-readiness/audit-service.test.js') {
    failures.push('auditTrail evidence path must point to the audit service production-readiness test');
  }
  if (required.auditTrail?.summaryPath !== 'evidence/security/audit-trail.md') {
    failures.push('auditTrail evidence summaryPath must be evidence/security/audit-trail.md');
  }
  const lifecycleSource = exists('services/api/src/modules/lifecycle/lifecycle.service.ts')
    ? read('services/api/src/modules/lifecycle/lifecycle.service.ts')
    : '';
  for (const token of ['lifecycle.handover.upsert', 'lifecycle.project_state.update', 'lifecycle.acceptance.marked']) {
    if (!lifecycleSource.includes(token)) failures.push(`LifecycleService missing audit action ${token}`);
  }
  if (!exists('server/modules/health/health.service.js')) {
    failures.push('missing v2 health service');
  }
  const healthRoutes = exists('server/modules/health/health.routes.js')
    ? read('server/modules/health/health.routes.js')
    : '';
  for (const token of ["router.get('/live'", "router.get('/ready'", "router.get('/heartbeat'", "router.get('/observability'", "router.get('/db'"]) {
    if (!healthRoutes.includes(token)) failures.push(`health routes missing ${token}`);
  }
  if (!exists('server/modules/observability/observability.service.js')) {
    failures.push('missing observability service');
  } else {
    const observabilitySource = read('server/modules/observability/observability.service.js');
    for (const token of ['observability-baseline', 'errorBudget', 'request-id-and-trace-id', 'in-process-http-window']) {
      if (!observabilitySource.includes(token)) failures.push(`observability service missing token: ${token}`);
    }
  }
  if (exists('server/middleware/requestContext.js')) {
    const requestContextSource = read('server/middleware/requestContext.js');
    for (const token of ['X-Request-ID', 'X-Trace-ID', 'getRequestMetrics', 'rhautt-nexus']) {
      if (!requestContextSource.includes(token)) failures.push(`request context missing token: ${token}`);
    }
  }
  if (required.healthReadiness?.status !== 'passed-current-run') {
    failures.push('healthReadiness evidence must be passed-current-run');
  }
  if (required.healthReadiness?.path !== 'test/production-readiness/health-and-seed.test.js') {
    failures.push('healthReadiness evidence path must be test/production-readiness/health-and-seed.test.js');
  }
  if (required.healthReadiness?.summaryPath !== 'evidence/operations/health-readiness.md') {
    failures.push('healthReadiness evidence summaryPath must be evidence/operations/health-readiness.md');
  }
  if (!exists('scripts/release/backup-restore-drill.js')) {
    failures.push('missing backup restore drill release script');
  }
  if (required.backupRestore?.status !== 'passed-current-run') {
    failures.push('backupRestore evidence must be passed-current-run');
  }
  if (required.backupRestore?.path !== 'evidence/operations/backup-restore-drill.json') {
    failures.push('backupRestore evidence path must be evidence/operations/backup-restore-drill.json');
  }
  if (required.backupRestore?.summaryPath !== 'evidence/operations/backup-restore-drill.md') {
    failures.push('backupRestore evidence summaryPath must be evidence/operations/backup-restore-drill.md');
  }
  if (exists('evidence/operations/backup-restore-drill.json')) {
    const backupRestore = readJson('evidence/operations/backup-restore-drill.json');
    if (backupRestore.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('backup restore drill platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (backupRestore.result !== 'passed') {
      failures.push('backup restore drill result must be passed');
    }
    if (backupRestore.rtoObjectiveMinutes > 30 || backupRestore.rpoObjectiveMinutes > 15) {
      failures.push('backup restore drill must keep RTO <= 30 minutes and RPO <= 15 minutes');
    }
    for (const token of ['tenant-scoped customer records are restored', 'lifecycle handoff boundary remains lifecycle_handoff_only']) {
      if (!backupRestore.assertions?.includes(token)) failures.push(`backup restore drill missing assertion: ${token}`);
    }
  }
  if (!exists('scripts/release/rysnova-bim-object-storage-smoke.js')) {
    failures.push('missing Rysnova object storage smoke release script');
  }
  if (exists('server/modules/rysnova-bim/rysnova-bim-artifact.service.js')) {
    const rysnovaBimServiceSource = read('server/modules/rysnova-bim/rysnova-bim-artifact.service.js');
    const customerSignoffBlock = rysnovaBimServiceSource.slice(
      rysnovaBimServiceSource.indexOf('const CUSTOMER_SIGNOFF_REQUIRED_TYPES'),
      rysnovaBimServiceSource.indexOf('const STANDARD_CHECK_STATUSES')
    );
    for (const requiredType of ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report']) {
      if (!customerSignoffBlock.includes(`'${requiredType}'`)) {
        failures.push(`CUSTOMER_SIGNOFF_REQUIRED_TYPES missing full signoff artifact: ${requiredType}`);
      }
    }
    if (!rysnovaBimServiceSource.includes('requiredTypes: CUSTOMER_SIGNOFF_REQUIRED_TYPES') ||
        !rysnovaBimServiceSource.includes('const missingTypes = CUSTOMER_SIGNOFF_REQUIRED_TYPES.filter') ||
        !rysnovaBimServiceSource.includes('missingTypes,')) {
      failures.push('buildCustomerPackage must use CUSTOMER_SIGNOFF_REQUIRED_TYPES for requiredTypes and missingTypes');
    }
  }
  if (exists('evidence/object-storage/README.md')) {
    const objectStorageReadme = read('evidence/object-storage/README.md');
    for (const token of [
      'missing-external-object-storage-proof',
      'finalLaunchObjectStorageProof: true',
      'OBJECT_STORAGE_EXTERNAL_PROVIDER',
      'External launch proof must use a real S3/OSS/MinIO-compatible PUT/GET/verify round trip',
      'must not leak raw endpoint, bucket, access key, or secret',
      'service-complete-rysnova-bim-signoff-package',
      'approve/share all 7 artifacts'
    ]) {
      if (!objectStorageReadme.includes(token)) failures.push(`object storage README missing token: ${token}`);
    }
  }
  if (required.rysnovaBimObjectStorage?.command !== 'npm run release:rysnova-bim-storage:smoke') {
    failures.push('rysnovaBimObjectStorage evidence command must be npm run release:rysnova-bim-storage:smoke');
  }
  if (required.rysnovaBimObjectStorage?.path !== 'evidence/object-storage/rysnova-bim-object-storage-smoke.json') {
    failures.push('rysnovaBimObjectStorage evidence path must be evidence/object-storage/rysnova-bim-object-storage-smoke.json');
  }
  if (required.rysnovaBimObjectStorage?.summaryPath !== 'evidence/object-storage/rysnova-bim-object-storage-smoke.md') {
    failures.push('rysnovaBimObjectStorage evidence summaryPath must be evidence/object-storage/rysnova-bim-object-storage-smoke.md');
  }
  if (required.rysnovaBimRuntimeBoundary?.command !== 'npx jest test/production-readiness/rysnova-bim-runtime-routes.test.js --runInBand') {
    failures.push('rysnovaBimRuntimeBoundary evidence command must be npx jest test/production-readiness/rysnova-bim-runtime-routes.test.js --runInBand');
  }
  if (required.rysnovaBimRuntimeBoundary?.status !== 'passed-current-run') {
    failures.push('rysnovaBimRuntimeBoundary evidence must remain passed-current-run');
  }
  if (required.rysnovaBimRuntimeBoundary?.path !== 'server/routes/rysnova-bim-runtime.routes.js') {
    failures.push('rysnovaBimRuntimeBoundary path must be server/routes/rysnova-bim-runtime.routes.js');
  }
  if (required.rysnovaBimRuntimeBoundary?.testPath !== 'test/production-readiness/rysnova-bim-runtime-routes.test.js') {
    failures.push('rysnovaBimRuntimeBoundary testPath must be test/production-readiness/rysnova-bim-runtime-routes.test.js');
  }
  if (required.rysnovaBimRuntimeBoundary?.routePath !== '/api/rysnova-bim/runtime-boundary') {
    failures.push('rysnovaBimRuntimeBoundary routePath must be /api/rysnova-bim/runtime-boundary');
  }
  if (required.rysnovaBimRuntimeBoundary?.surface !== 'rysnova-bim-compatibility-runtime') {
    failures.push('rysnovaBimRuntimeBoundary surface must be rysnova-bim-compatibility-runtime');
  }
  if (required.rysnovaBimRuntimeBoundary?.compatibilityStatus !== 'compatibility-preserved-not-production-artifact-trunk') {
    failures.push('rysnovaBimRuntimeBoundary compatibilityStatus must prevent legacy runtime from becoming the production artifact trunk');
  }
  if (required.rysnovaBimRuntimeBoundary?.productionArtifactApi !== '/api/v2/rysnova-bim') {
    failures.push('rysnovaBimRuntimeBoundary productionArtifactApi must be /api/v2/rysnova-bim');
  }
  if (required.rysnovaBimRuntimeBoundary?.deliverableArtifactsApi !== '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts') {
    failures.push('rysnovaBimRuntimeBoundary deliverableArtifactsApi must be /api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts');
  }
  if (required.rysnovaBimRuntimeBoundary?.signoffPackageApi !== '/api/v2/rysnova-bim/projects/{projectId}/signoff-package') {
    failures.push('rysnovaBimRuntimeBoundary signoffPackageApi must be /api/v2/rysnova-bim/projects/{projectId}/signoff-package');
  }
  if (required.rysnovaBimRuntimeBoundary?.customerPackageApi !== '/api/v2/rysnova-bim/projects/{projectId}/customer-package') {
    failures.push('rysnovaBimRuntimeBoundary customerPackageApi must be /api/v2/rysnova-bim/projects/{projectId}/customer-package');
  }
  if (required.rysnovaBimRuntimeBoundary?.storageBoundary !== 'artifact-contract-and-object-storage-required-for-production') {
    failures.push('rysnovaBimRuntimeBoundary storageBoundary must require artifact contract and object storage evidence');
  }
  if (!String(required.rysnovaBimRuntimeBoundary?.migrationRule || '').includes('must not replace v2 Rysnova artifact') ||
      !String(required.rysnovaBimRuntimeBoundary?.migrationRule || '').includes('deliverable-artifacts') ||
      !String(required.rysnovaBimRuntimeBoundary?.migrationRule || '').includes('signoff-package') ||
      !String(required.rysnovaBimRuntimeBoundary?.migrationRule || '').includes('customer-package') ||
      !String(required.rysnovaBimRuntimeBoundary?.migrationRule || '').includes('object-storage evidence')) {
    failures.push('rysnovaBimRuntimeBoundary migrationRule must keep legacy runtime below v2 artifact/deliverable-artifacts/signoff-package/customer-package/object-storage evidence');
  }
  for (const token of [
    'RYSNOVA_RUNTIME_BOUNDARY',
    '/api/rysnova-bim/runtime-boundary',
    'rysnova-bim-compatibility-runtime',
    'compatibility-preserved-not-production-artifact-trunk',
    '/api/v2/rysnova-bim',
    '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
    '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
    '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
    'artifact-contract-and-object-storage-required-for-production',
    'runtimeBoundary'
  ]) {
    if (!rysnovaBimRuntimeRoutes.includes(token)) failures.push(`Rysnova runtime route source missing token: ${token}`);
    if (!rysnovaBimRuntimeRoutesTest.includes(token)) failures.push(`Rysnova runtime route test missing token: ${token}`);
  }
  for (const token of [
    'rysnovaBimRuntimeBoundary',
    'rysnovaBimPreviewCompatibilityBoundary',
    'rysnovaBimProductionEvidenceAggregate',
    '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
    'downloadRysnovaArtifactContent',
    'requestBlob',
    'finalLaunchObjectStorageProof',
    'finalLaunchCapacityProof',
    'finalLaunchRysnovaProof',
    'compatibility-preserved-not-production-artifact-trunk',
    '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
    '/api/v2/rysnova-bim/projects/{projectId}/customer-package'
  ]) {
    if (!rysnovaBimProductionEvidenceTest.includes(token)) failures.push(`Rysnova production evidence test missing token: ${token}`);
  }
  for (const token of [
    'Rysnova external proof preflight semantic validation',
    'rejects placeholder and local infrastructure',
    'NODE_ENV must be production',
    'must be a non-local production/staging URL',
    'must not be a placeholder/example value',
    'validateCapacityEnv',
    'validateObjectStorageEnv',
    'validatePostgresStagingEnv',
    'validateRedisRuntimeEnv',
    'validateTemporalRuntimeEnv',
    'OBJECT_STORAGE_EXTERNAL_PROVIDER must be one of: s3, oss, minio, s3-compatible',
    'TEMPORAL_ADDRESS must target non-local production/staging infrastructure'
  ]) {
    if (!rysnovaBimExternalPreflightSemanticTest.includes(token)) {
      failures.push(`Rysnova external proof preflight semantic test missing token: ${token}`);
    }
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.command !== 'npx jest test/production-readiness/rysnova-bim-preview-compatibility.test.js --runInBand') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary evidence command must be npx jest test/production-readiness/rysnova-bim-preview-compatibility.test.js --runInBand');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.status !== 'passed-current-run') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary evidence must remain passed-current-run');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.path !== 'server/routes/rysnova-bim-simple.js') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary path must be server/routes/rysnova-bim-simple.js');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.testPath !== 'test/production-readiness/rysnova-bim-preview-compatibility.test.js') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary testPath must be test/production-readiness/rysnova-bim-preview-compatibility.test.js');
  }
  for (const routePath of ['/api/rysnova-bim/health', '/api/rysnova-bim/quick-design', '/api/rysnova-bim/complete-design', '/api/rysnova-bim/load-calculation', '/api/rysnova-bim/export']) {
    if (!required.rysnovaBimPreviewCompatibilityBoundary?.routePaths?.includes(routePath)) {
      failures.push(`rysnovaBimPreviewCompatibilityBoundary routePaths missing ${routePath}`);
    }
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.surface !== 'rysnova-bim-3d-preview-compatibility-runtime') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary surface must be rysnova-bim-3d-preview-compatibility-runtime');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.compatibilityStatus !== 'preview-compatibility-not-production-artifact-trunk') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary compatibilityStatus must prevent preview runtime from becoming production artifact trunk');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.productionArtifactApi !== '/api/v2/rysnova-bim') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary productionArtifactApi must be /api/v2/rysnova-bim');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.deliverableArtifactsApi !== '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary deliverableArtifactsApi must be /api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.signoffPackageApi !== '/api/v2/rysnova-bim/projects/{projectId}/signoff-package') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary signoffPackageApi must be /api/v2/rysnova-bim/projects/{projectId}/signoff-package');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.customerPackageApi !== '/api/v2/rysnova-bim/projects/{projectId}/customer-package') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary customerPackageApi must be /api/v2/rysnova-bim/projects/{projectId}/customer-package');
  }
  if (required.rysnovaBimPreviewCompatibilityBoundary?.storageBoundary !== 'artifact-contract-and-object-storage-required-for-production') {
    failures.push('rysnovaBimPreviewCompatibilityBoundary storageBoundary must require artifact contract and object storage evidence');
  }
  if (!String(required.rysnovaBimPreviewCompatibilityBoundary?.frontendAuthGuard || '').includes('employee/designer token') ||
      !String(required.rysnovaBimPreviewCompatibilityBoundary?.frontendAuthGuard || '').includes('quick-design') ||
      !String(required.rysnovaBimPreviewCompatibilityBoundary?.frontendAuthGuard || '').includes('preview export')) {
    failures.push('rysnovaBimPreviewCompatibilityBoundary frontendAuthGuard must require employee/designer token for preview calls');
  }
  if (!String(required.rysnovaBimPreviewCompatibilityBoundary?.migrationRule || '').includes('preview compatibility only') ||
      !String(required.rysnovaBimPreviewCompatibilityBoundary?.migrationRule || '').includes('production Rysnova deliverables must use v2 artifact') ||
      !String(required.rysnovaBimPreviewCompatibilityBoundary?.migrationRule || '').includes('deliverable-artifacts') ||
      !String(required.rysnovaBimPreviewCompatibilityBoundary?.migrationRule || '').includes('signoff-package') ||
      !String(required.rysnovaBimPreviewCompatibilityBoundary?.migrationRule || '').includes('tenant') ||
      !String(required.rysnovaBimPreviewCompatibilityBoundary?.migrationRule || '').includes('audit contracts')) {
    failures.push('rysnovaBimPreviewCompatibilityBoundary migrationRule must keep preview APIs below v2 artifact/deliverable-artifacts/signoff-package/customer-package/object-storage/tenant/audit contracts');
  }
  for (const token of [
    'RYSNOVA_PREVIEW_RUNTIME_BOUNDARY',
    'rysnova-bim-3d-preview-compatibility-runtime',
    'preview-compatibility-not-production-artifact-trunk',
    '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts',
    '/api/v2/rysnova-bim/projects/{projectId}/signoff-package',
    '/api/v2/rysnova-bim/projects/{projectId}/customer-package',
    'artifact-contract-and-object-storage-required-for-production',
    'runtimeBoundary',
    'not-produced-by-preview-runtime'
  ]) {
    if (!rysnovaBimSimpleRoutes.includes(token)) failures.push(`Rysnova preview route source missing token: ${token}`);
    if (!rysnovaBimPreviewCompatibilityTest.includes(token)) failures.push(`Rysnova preview compatibility test missing token: ${token}`);
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.command !== 'npx jest test/production-readiness/rysnova-bim-production-evidence.test.js --runInBand') {
    failures.push('rysnovaBimProductionEvidenceAggregate command must be npx jest test/production-readiness/rysnova-bim-production-evidence.test.js --runInBand');
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.status !== 'passed-current-run') {
    failures.push('rysnovaBimProductionEvidenceAggregate status must be passed-current-run');
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.path !== 'test/production-readiness/rysnova-bim-production-evidence.test.js') {
    failures.push('rysnovaBimProductionEvidenceAggregate path must be test/production-readiness/rysnova-bim-production-evidence.test.js');
  }
  for (const token of [
    'OpenAPI v2 Rysnova artifact/customer-package/download trunk',
    'OpenAPI v2 Rysnova artifact content download trunk',
    'generated client binary download method',
    'target Nest/Fastify artifact content download boot-smoke',
    'runtime boundary cannot replace production artifact trunk',
	    'preview compatibility runtime cannot replace production artifact trunk',
	    'capacity in-process Rysnova deliverable/signoff/deepening/customer-package/content-download scenarios',
    'full 7-artifact local signoff package',
    'non-final launch truth for object storage and staging capacity'
  ]) {
    if (!required.rysnovaBimProductionEvidenceAggregate?.scope?.includes(token)) {
      failures.push(`rysnovaBimProductionEvidenceAggregate scope missing token: ${token}`);
    }
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.contentDownloadApi !== '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content') {
    failures.push('rysnovaBimProductionEvidenceAggregate contentDownloadApi must be /api/v2/rysnova-bim/artifacts/{artifactId}/download/content');
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.contentDownloadOperationId !== 'downloadRysnovaArtifactContent') {
    failures.push('rysnovaBimProductionEvidenceAggregate contentDownloadOperationId must be downloadRysnovaArtifactContent');
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.contentDownloadClientMethod !== 'downloadRysnovaArtifactContent') {
    failures.push('rysnovaBimProductionEvidenceAggregate contentDownloadClientMethod must be downloadRysnovaArtifactContent');
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.contentDownloadResponseMode !== 'raw-response-with-integrity-headers') {
    failures.push('rysnovaBimProductionEvidenceAggregate contentDownloadResponseMode must be raw-response-with-integrity-headers');
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.contentDownloadBootSmoke !== true) {
    failures.push('rysnovaBimProductionEvidenceAggregate contentDownloadBootSmoke must be true');
  }
  for (const requiredType of ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report']) {
    if (!required.rysnovaBimProductionEvidenceAggregate?.requiredArtifactTypes?.includes(requiredType)) {
      failures.push(`rysnovaBimProductionEvidenceAggregate requiredArtifactTypes missing ${requiredType}`);
    }
  }
  if (required.rysnovaBimProductionEvidenceAggregate?.finalLaunchObjectStorageProof !== false ||
      required.rysnovaBimProductionEvidenceAggregate?.finalLaunchCapacityProof !== false ||
      required.rysnovaBimProductionEvidenceAggregate?.finalLaunchRysnovaProof !== false) {
    failures.push('rysnovaBimProductionEvidenceAggregate must not claim final launch proof while external storage or staging capacity is missing');
  }
  if (!String(required.rysnovaBimProductionEvidenceAggregate?.note || '').includes('prevents a production-complete claim')) {
    failures.push('rysnovaBimProductionEvidenceAggregate note must prevent premature production-complete claim');
  }
  if (exists('evidence/object-storage/rysnova-bim-object-storage-smoke.json')) {
    const storageSmoke = readJson('evidence/object-storage/rysnova-bim-object-storage-smoke.json');
    const capabilities = storageSmoke.adapterCapabilities || {};
    if (storageSmoke.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Rysnova object storage smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (!['passed', 'missing-external-proof'].includes(storageSmoke.result)) {
      failures.push('Rysnova object storage smoke result must be passed or missing-external-proof');
    }
    if (storageSmoke.result === 'passed' && (!Array.isArray(storageSmoke.checks) || storageSmoke.checks.some(check => check.passed !== true))) {
      failures.push('Rysnova object storage smoke checks must all pass');
    }
    const storageCheckNames = new Set((storageSmoke.checks || []).map(check => check.name));
	    for (const checkName of [
	      'service-create-approve-share-customer-package',
	      'service-complete-rysnova-bim-signoff-package',
	      'service-artifact-content-download',
	      'service-customer-package-sanitized',
	      'service-customer-visible-summary-sanitized',
	      'service-customer-package-lifecycle-handoff',
	      'service-customer-report-object-sanitized'
	    ]) {
	      if (!storageCheckNames.has(checkName)) failures.push(`Rysnova object storage smoke missing check: ${checkName}`);
	    }
    const servicePath = storageSmoke.servicePath || {};
    if (storageSmoke.result === 'passed') {
      if (servicePath.generatedArtifactCount !== 7 || servicePath.sharedArtifactCount !== 7 || servicePath.customerPackageCount !== 7) {
        failures.push('Rysnova object storage smoke must generate, share, and package 7 artifacts');
      }
      if (
        servicePath.artifactContentDownloadReady !== true ||
        servicePath.artifactContentDownloadCount !== 7 ||
        !Array.isArray(servicePath.artifactContentDownloads) ||
        servicePath.artifactContentDownloads.length !== 7 ||
        servicePath.artifactContentDownloads.some(item =>
          item.passed !== true ||
          !String(item.contentHash || '').startsWith('sha256:') ||
          item.contentHash !== item.expectedContentHash ||
          !(Number(item.sizeBytes || 0) > 0) ||
          item.sizeBytes !== item.expectedSizeBytes)
      ) {
        failures.push('Rysnova object storage smoke must prove service-level content download for all 7 signoff artifacts');
      }
      for (const requiredType of ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report']) {
        if (!Array.isArray(servicePath.customerPackageArtifactTypes) || !servicePath.customerPackageArtifactTypes.includes(requiredType)) {
          failures.push(`Rysnova object storage smoke customer package missing ${requiredType}`);
        }
      }
      if (
        servicePath.deepeningHandoffReady !== true ||
	        servicePath.visualReadinessReady !== true ||
	        servicePath.commercialReadinessReady !== true ||
	        servicePath.customerSignoffReady !== true ||
	        servicePath.customerPackageSanitized !== true ||
	        servicePath.customerVisibleSummarySanitized !== true ||
	        servicePath.customerReportObjectSanitized !== true
	      ) {
	        failures.push('Rysnova object storage smoke must prove handoff, visual, commercial, customer signoff, sanitized package, and sanitized customer-report object readiness');
	      }
	      const packageReadiness = servicePath.customerPackageReadiness || {};
	      if (
	        packageReadiness.packageReady !== true ||
	        packageReadiness.visualReady !== true ||
	        packageReadiness.commercialReady !== true ||
	        packageReadiness.standardsPassed !== true ||
	        packageReadiness.lifecycleHandoffReady !== true ||
	        packageReadiness.customerSignoffReady !== true ||
	        packageReadiness.objectStorageIntegrityReady !== true
	      ) {
	        failures.push('Rysnova object storage smoke must prove customer-package readiness flags');
	      }
	      const packageLifecycle = servicePath.customerPackageLifecycleHandoff || {};
	      if (
	        servicePath.customerPackageQuoteSummaryPresent !== true ||
	        packageLifecycle.handoffBoundary !== 'lifecycle_handoff_only' ||
	        packageLifecycle.realtimeControl !== false ||
	        packageLifecycle.targetPlatform !== 'external-iot-lifecycle-platform' ||
	        !(packageLifecycle.assetCount > 0) ||
	        packageLifecycle.assetsHaveIotBinding !== true
	      ) {
	        failures.push('Rysnova object storage smoke must prove customer-package quote summary and lifecycle_handoff_only installed-asset handoff');
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
	        failures.push('Rysnova object storage smoke must prove customer-report object boundary and internal-field exclusion');
	      }
	    }
    if (storageSmoke.result === 'missing-external-proof' && storageSmoke.finalLaunchObjectStorageProof !== false) {
      failures.push('missing Rysnova external object storage proof must not claim finalLaunchObjectStorageProof');
    }
    if (!capabilities.adapterType || typeof capabilities.externalRoundTrip !== 'boolean' || typeof capabilities.finalLaunchEligible !== 'boolean') {
      failures.push('Rysnova object storage smoke must record adapterCapabilities with adapterType, externalRoundTrip, and finalLaunchEligible');
    }
    if (storageSmoke.finalLaunchObjectStorageProof === true && storageSmoke.mode !== 'external-object-storage-smoke') {
      failures.push('Rysnova final object storage proof requires external-object-storage-smoke mode');
    }
    if (storageSmoke.finalLaunchObjectStorageProof === true && capabilities.externalRoundTrip !== true) {
      failures.push('Rysnova final object storage proof requires external adapter round-trip capability');
    }
    if (storageSmoke.finalLaunchObjectStorageProof === true && capabilities.finalLaunchEligible !== true) {
      failures.push('Rysnova final object storage proof requires finalLaunchEligible adapter capability');
    }
    if (storageSmoke.finalLaunchObjectStorageProof === true && ['memory', 'local-filesystem'].includes(capabilities.adapterType)) {
      failures.push('Rysnova final object storage proof cannot use memory/local artifact storage adapters');
    }
    if (storageSmoke.finalLaunchObjectStorageProof === true) {
      if (required.rysnovaBimObjectStorage?.status !== 'passed-external-current-run') {
        failures.push('external Rysnova object storage proof must set status passed-external-current-run');
      }
    } else if (storageSmoke.mode === 'missing-external-object-storage-proof') {
      if (required.rysnovaBimObjectStorage?.status !== 'missing-external-proof') {
        failures.push('missing external Rysnova object storage proof must set status missing-external-proof');
      }
    } else if (required.rysnovaBimObjectStorage?.status !== 'local-smoke-only') {
      failures.push('non-external Rysnova object storage evidence must remain local-smoke-only');
    }
    if (JSON.stringify(storageSmoke).includes('http://') || JSON.stringify(storageSmoke).includes('https://')) {
      failures.push('Rysnova object storage evidence must not leak raw external endpoint URLs');
    }
    if (storageSmoke.externalConfig?.endpoint || storageSmoke.externalConfig?.bucket) {
      failures.push('Rysnova object storage evidence must store endpointHash/bucketHash, not raw endpoint/bucket');
    }
  } else if (required.rysnovaBimObjectStorage?.status !== 'missing-smoke-run') {
    failures.push('Rysnova object storage evidence must remain missing-smoke-run when smoke report is absent');
  }
  if (required.rysnovaBimExternalProofPreflight?.command !== 'npm run release:rysnova-bim-external-proof-preflight') {
    failures.push('rysnovaBimExternalProofPreflight command must be npm run release:rysnova-bim-external-proof-preflight');
  }
  if (!['missing-external-proof-configuration', 'ready-to-run-external-proof'].includes(required.rysnovaBimExternalProofPreflight?.status)) {
    failures.push('rysnovaBimExternalProofPreflight status must be missing-external-proof-configuration or ready-to-run-external-proof');
  }
  if (required.rysnovaBimExternalProofPreflight?.path !== 'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json') {
    failures.push('rysnovaBimExternalProofPreflight path must be evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json');
  }
  if (required.rysnovaBimExternalProofPreflight?.summaryPath !== 'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.md') {
    failures.push('rysnovaBimExternalProofPreflight summaryPath must be evidence/rysnova-bim/rysnova-bim-external-proof-preflight.md');
  }
  if (exists('evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json')) {
    const externalPreflight = readJson('evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json');
    if (externalPreflight.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Rysnova external proof preflight platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (externalPreflight.module !== 'Rysnova') {
      failures.push('Rysnova external proof preflight module must be Rysnova');
    }
    if (externalPreflight.command !== 'npm run release:rysnova-bim-external-proof-preflight') {
      failures.push('Rysnova external proof preflight command must be npm run release:rysnova-bim-external-proof-preflight');
    }
    if (required.rysnovaBimExternalProofPreflight?.status !== externalPreflight.status) {
      failures.push('rysnovaBimExternalProofPreflight release status must match preflight report');
    }
    if (required.rysnovaBimExternalProofPreflight?.readyForExternalProofRun !== externalPreflight.readyForExternalProofRun) {
      failures.push('rysnovaBimExternalProofPreflight readyForExternalProofRun must match preflight report');
    }
    if (required.rysnovaBimExternalProofPreflight?.checks !== externalPreflight.summary?.checks) {
      failures.push('rysnovaBimExternalProofPreflight checks count must match preflight report');
    }
    if (required.rysnovaBimExternalProofPreflight?.ready !== externalPreflight.summary?.ready) {
      failures.push('rysnovaBimExternalProofPreflight ready count must match preflight report');
    }
    if (required.rysnovaBimExternalProofPreflight?.blocked !== externalPreflight.summary?.blocked) {
      failures.push('rysnovaBimExternalProofPreflight blocked count must match preflight report');
    }
    const preflightCheckIds = new Set((externalPreflight.checks || []).map(item => item.id));
    for (const id of ['browser-visual', 'staging-capacity', 'external-object-storage', 'postgres-staging', 'redis-runtime', 'temporal-runtime']) {
      if (!preflightCheckIds.has(id)) failures.push(`Rysnova external proof preflight missing check: ${id}`);
    }
    for (const check of externalPreflight.checks || []) {
      if (!Array.isArray(check.invalidEnv)) {
        failures.push(`Rysnova external proof preflight check ${check.id} must include invalidEnv array`);
      }
      if (!Array.isArray(check.semanticFailures)) {
        failures.push(`Rysnova external proof preflight check ${check.id} must include semanticFailures array`);
      }
    }
    const blockerIds = (externalPreflight.blockers || []).map(item => item.id).sort();
    const releaseBlockerIds = [...(required.rysnovaBimExternalProofPreflight?.blockers || [])].sort();
    if (JSON.stringify(blockerIds) !== JSON.stringify(releaseBlockerIds)) {
      failures.push('rysnovaBimExternalProofPreflight blockers must match preflight report blockers');
    }
    for (const blocker of externalPreflight.blockers || []) {
      if (!Array.isArray(blocker.invalidEnv)) {
        failures.push(`Rysnova external proof preflight blocker ${blocker.id} must include invalidEnv array`);
      }
      if (!Array.isArray(blocker.semanticFailures)) {
        failures.push(`Rysnova external proof preflight blocker ${blocker.id} must include semanticFailures array`);
      }
    }
    for (const command of [
      'npm run release:rysnova-bim-external-proof-preflight',
      BROWSER_VISUAL_EXTERNAL_COMMAND,
      'NODE_ENV=production MONGODB_URI=<staging-mongodb-uri> CAPACITY_BASE_URL=<staging-url> npm run perf:capacity',
      'OBJECT_STORAGE_EXTERNAL_PROVIDER=<s3|oss|minio> OBJECT_STORAGE_ENDPOINT=<endpoint> OBJECT_STORAGE_BUCKET=<bucket> OBJECT_STORAGE_ACCESS_KEY_ID=<key> OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret> npm run release:rysnova-bim-storage:smoke',
      'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke',
	      'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke',
	      'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke',
	      'npm run release:rysnova-bim-external-proof',
	      'npm run release:rysnova-bim-final-readiness',
	      'npm run guard:all'
	    ]) {
      if (!externalPreflight.runOrder?.includes(command)) {
        failures.push(`Rysnova external proof preflight missing run order command: ${command}`);
      }
      if (!required.rysnovaBimExternalProofPreflight?.runOrder?.includes(command)) {
        failures.push(`rysnovaBimExternalProofPreflight release evidence missing run order command: ${command}`);
      }
    }
    if (!String(externalPreflight.nonCompletionRule || '').includes('never proves Rysnova production completion')) {
      failures.push('Rysnova external proof preflight must include non-completion rule');
    }
    if (!String(required.rysnovaBimExternalProofPreflight?.note || '').includes('never proves Rysnova production completion')) {
      failures.push('rysnovaBimExternalProofPreflight release note must include non-completion rule');
    }
	  } else if (required.rysnovaBimExternalProofPreflight?.status !== 'missing-external-proof-configuration') {
	    failures.push('Rysnova external proof preflight must remain missing-external-proof-configuration when report is absent');
	  }
  if (exists('scripts/release/rysnova-bim-external-proof-preflight.js')) {
    const externalPreflightSource = read('scripts/release/rysnova-bim-external-proof-preflight.js');
    for (const token of [
      'semanticFailures',
      'invalidEnv',
      "require('./external-proof-validation')",
      'validateCapacityEnv',
      'validateObjectStorageEnv',
      'validatePostgresStagingEnv',
      'validateRedisRuntimeEnv',
      'validateTemporalRuntimeEnv'
    ]) {
      if (!externalPreflightSource.includes(token)) {
        failures.push(`Rysnova external proof preflight source missing semantic validation token: ${token}`);
      }
    }
    if (exists('scripts/release/external-proof-validation.js')) {
      const externalProofValidationSource = read('scripts/release/external-proof-validation.js');
      for (const token of [
        'NODE_ENV must be production',
        'must be a non-local production/staging URL',
        'must not be a placeholder/example value',
        'OBJECT_STORAGE_EXTERNAL_PROVIDER',
        's3-compatible',
        'TEMPORAL_WORKER_PROOF_TENANT_ID',
        'TEMPORAL_WORKER_PROOF_PROJECT_ID',
        'validateCapacityEnv',
        'validateObjectStorageEnv',
        'validatePostgresStagingEnv',
        'validateRedisRuntimeEnv',
        'validateTemporalRuntimeEnv'
      ]) {
        if (!externalProofValidationSource.includes(token)) {
          failures.push(`external proof validation source missing token: ${token}`);
        }
      }
    }
  }
	  if (exists('scripts/release/rysnova-bim-external-proof-runner.js')) {
	    const externalProofRunnerSource = read('scripts/release/rysnova-bim-external-proof-runner.js');
	    for (const token of [
	      'readyForExternalProofRun',
	      'finalLaunchRysnovaProof',
	      'release:rysnova-bim-external-proof-preflight',
	      'guard:browser-visual',
	      'perf:capacity',
	      'release:rysnova-bim-storage:smoke',
	      'release:postgres-staging:smoke',
	      'release:redis-runtime:smoke',
	      'release:temporal-runtime:smoke',
	      'release:rysnova-bim-final-readiness',
	      'guard:all',
	      'missing-external-proof-configuration',
	      'failed-external-proof-current-run',
	      'passed-external-proof-current-run',
	      "updateReleaseEvidence('rysnovaBimExternalProofRun'"
	    ]) {
	      if (!externalProofRunnerSource.includes(token)) {
	        failures.push(`Rysnova external proof runner source missing token: ${token}`);
	      }
	    }
	  }
	  if (required.rysnovaBimExternalProofRun?.command !== 'npm run release:rysnova-bim-external-proof') {
	    failures.push('rysnovaBimExternalProofRun command must be npm run release:rysnova-bim-external-proof');
	  }
	  if (!['missing-external-proof-configuration', 'failed-external-proof-current-run', 'passed-external-proof-current-run'].includes(required.rysnovaBimExternalProofRun?.status)) {
	    failures.push('rysnovaBimExternalProofRun status must be missing-external-proof-configuration, failed-external-proof-current-run, or passed-external-proof-current-run');
	  }
	  if (required.rysnovaBimExternalProofRun?.path !== 'evidence/rysnova-bim/rysnova-bim-external-proof-run.json') {
	    failures.push('rysnovaBimExternalProofRun path must be evidence/rysnova-bim/rysnova-bim-external-proof-run.json');
	  }
	  if (required.rysnovaBimExternalProofRun?.summaryPath !== 'evidence/rysnova-bim/rysnova-bim-external-proof-run.md') {
	    failures.push('rysnovaBimExternalProofRun summaryPath must be evidence/rysnova-bim/rysnova-bim-external-proof-run.md');
	  }
	  if (exists('evidence/rysnova-bim/rysnova-bim-external-proof-run.json')) {
	    const externalProofRun = readJson('evidence/rysnova-bim/rysnova-bim-external-proof-run.json');
	    if (externalProofRun.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
	      failures.push('Rysnova external proof run platform must be Rhautt Nexus / 瑞合数智枢纽');
	    }
	    if (externalProofRun.module !== 'Rysnova') {
	      failures.push('Rysnova external proof run module must be Rysnova');
	    }
	    if (externalProofRun.command !== 'npm run release:rysnova-bim-external-proof') {
	      failures.push('Rysnova external proof run command must be npm run release:rysnova-bim-external-proof');
	    }
	    if (required.rysnovaBimExternalProofRun?.status !== externalProofRun.status) {
	      failures.push('rysnovaBimExternalProofRun release status must match external proof run report');
	    }
	    if (required.rysnovaBimExternalProofRun?.readyForExternalProofRun !== externalProofRun.readyForExternalProofRun) {
	      failures.push('rysnovaBimExternalProofRun readyForExternalProofRun must match external proof run report');
	    }
	    if (required.rysnovaBimExternalProofRun?.finalLaunchRysnovaProof !== externalProofRun.finalLaunchRysnovaProof) {
	      failures.push('rysnovaBimExternalProofRun finalLaunchRysnovaProof must match external proof run report');
	    }
	    if (required.rysnovaBimExternalProofRun?.status === 'passed-external-proof-current-run' && required.rysnovaBimExternalProofRun?.finalLaunchRysnovaProof !== true) {
	      failures.push('passed rysnovaBimExternalProofRun requires finalLaunchRysnovaProof true');
	    }
	    if (externalProofRun.finalLaunchRysnovaProof === true && externalProofRun.status !== 'passed-external-proof-current-run') {
	      failures.push('Rysnova external proof run final launch proof requires passed-external-proof-current-run status');
	    }
	    if (externalProofRun.finalLaunchRysnovaProof === false && externalProofRun.status === 'passed-external-proof-current-run') {
	      failures.push('Rysnova external proof run cannot pass while finalLaunchRysnovaProof is false');
	    }
	    const reportBlockerIds = (externalProofRun.blockers || [])
	      .map(item => item.id || item)
	      .sort();
	    const releaseBlockerIds = [...(required.rysnovaBimExternalProofRun?.blockers || [])].sort();
	    if (JSON.stringify(reportBlockerIds) !== JSON.stringify(releaseBlockerIds)) {
	      failures.push('rysnovaBimExternalProofRun blockers must match external proof run report blockers');
	    }
	    const reportFailedSteps = [...(externalProofRun.failedSteps || [])].sort();
	    const releaseFailedSteps = [...(required.rysnovaBimExternalProofRun?.failedSteps || [])].sort();
	    if (JSON.stringify(reportFailedSteps) !== JSON.stringify(releaseFailedSteps)) {
	      failures.push('rysnovaBimExternalProofRun failedSteps must match external proof run report failedSteps');
	    }
	    for (const command of [
	      'npm run release:rysnova-bim-external-proof-preflight',
		      BROWSER_VISUAL_EXTERNAL_COMMAND,
	      'NODE_ENV=production MONGODB_URI=<staging-mongodb-uri> CAPACITY_BASE_URL=<staging-url> npm run perf:capacity',
	      'OBJECT_STORAGE_EXTERNAL_PROVIDER=<s3|oss|minio> OBJECT_STORAGE_ENDPOINT=<endpoint> OBJECT_STORAGE_BUCKET=<bucket> OBJECT_STORAGE_ACCESS_KEY_ID=<key> OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret> npm run release:rysnova-bim-storage:smoke',
	      'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke',
	      'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke',
	      'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke',
	      'npm run release:rysnova-bim-final-readiness',
	      'npm run guard:all'
	    ]) {
	      const reportCommands = [
	        ...(externalProofRun.plannedSteps || []).map(step => step.command),
	        ...(externalProofRun.steps || []).map(step => step.command),
	        ...(externalProofRun.requiredExternalProofCommands || [])
	      ];
	      if (!reportCommands.includes(command)) {
	        failures.push(`Rysnova external proof run missing command: ${command}`);
	      }
	      if (!required.rysnovaBimExternalProofRun?.requiredExternalProofCommands?.includes(command)) {
	        failures.push(`rysnovaBimExternalProofRun release evidence missing proof command: ${command}`);
	      }
	    }
	    if (!String(externalProofRun.nonCompletionRule || '').includes('does not claim Rysnova production completion') &&
	        !String(externalProofRun.nonCompletionRule || '').includes('production-complete only when this runner passes')) {
	      failures.push('Rysnova external proof run must include a non-completion rule');
	    }
	    if (!String(required.rysnovaBimExternalProofRun?.note || '').includes('does not claim Rysnova production completion') &&
	        !String(required.rysnovaBimExternalProofRun?.note || '').includes('production-complete only when this runner passes')) {
	      failures.push('rysnovaBimExternalProofRun release note must include the non-completion rule');
	    }
	  } else if (required.rysnovaBimExternalProofRun?.status !== 'missing-external-proof-configuration') {
	    failures.push('Rysnova external proof run must remain missing-external-proof-configuration when report is absent');
  }
  if (required.rysnovaBimLaunchRunbook?.command !== 'npm run release:rysnova-bim-launch-runbook') {
    failures.push('rysnovaBimLaunchRunbook command must be npm run release:rysnova-bim-launch-runbook');
  }
  if (!['blocked-external-proof-required', 'ready-for-production-proof-run'].includes(required.rysnovaBimLaunchRunbook?.status)) {
    failures.push('rysnovaBimLaunchRunbook status must be blocked-external-proof-required or ready-for-production-proof-run');
  }
  if (required.rysnovaBimLaunchRunbook?.path !== 'evidence/rysnova-bim/rysnova-bim-launch-runbook.json') {
    failures.push('rysnovaBimLaunchRunbook path must be evidence/rysnova-bim/rysnova-bim-launch-runbook.json');
  }
  if (required.rysnovaBimLaunchRunbook?.summaryPath !== 'evidence/rysnova-bim/rysnova-bim-launch-runbook.md') {
    failures.push('rysnovaBimLaunchRunbook summaryPath must be evidence/rysnova-bim/rysnova-bim-launch-runbook.md');
  }
  if (required.rysnovaBimLaunchRunbook?.finalLaunchRysnovaProof !== false) {
    failures.push('rysnovaBimLaunchRunbook must never claim finalLaunchRysnovaProof true');
  }
  if (exists('scripts/release/rysnova-bim-launch-runbook.js')) {
    const launchRunbookSource = read('scripts/release/rysnova-bim-launch-runbook.js');
    for (const token of [
      'const GATES',
      'browser-visual-current-run',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime',
      'final-readiness',
      'guard-all',
      'buildRunbook',
      'buildPreflightReport',
      "updateReleaseEvidence('rysnovaBimLaunchRunbook'",
      'must never be used as final production proof by itself'
    ]) {
      if (!launchRunbookSource.includes(token)) {
        failures.push(`Rysnova launch runbook source missing token: ${token}`);
      }
    }
  }
  if (exists('evidence/rysnova-bim/rysnova-bim-launch-runbook.json')) {
    const launchRunbook = readJson('evidence/rysnova-bim/rysnova-bim-launch-runbook.json');
    if (launchRunbook.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Rysnova launch runbook platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (launchRunbook.module !== 'Rysnova') {
      failures.push('Rysnova launch runbook module must be Rysnova');
    }
    if (launchRunbook.command !== 'npm run release:rysnova-bim-launch-runbook') {
      failures.push('Rysnova launch runbook command must be npm run release:rysnova-bim-launch-runbook');
    }
    if (required.rysnovaBimLaunchRunbook?.status !== launchRunbook.status) {
      failures.push('rysnovaBimLaunchRunbook release status must match launch runbook report');
    }
    if (required.rysnovaBimLaunchRunbook?.finalLaunchRysnovaProof !== launchRunbook.finalLaunchRysnovaProof) {
      failures.push('rysnovaBimLaunchRunbook finalLaunchRysnovaProof must match launch runbook report');
    }
    if (launchRunbook.finalLaunchRysnovaProof !== false) {
      failures.push('Rysnova launch runbook must keep finalLaunchRysnovaProof false');
    }
    if (required.rysnovaBimLaunchRunbook?.gates !== launchRunbook.summary?.gates) {
      failures.push('rysnovaBimLaunchRunbook gates count must match launch runbook report');
    }
    if (required.rysnovaBimLaunchRunbook?.ready !== launchRunbook.summary?.ready) {
      failures.push('rysnovaBimLaunchRunbook ready count must match launch runbook report');
    }
    if (required.rysnovaBimLaunchRunbook?.blocked !== launchRunbook.summary?.blocked) {
      failures.push('rysnovaBimLaunchRunbook blocked count must match launch runbook report');
    }
    const launchGateIds = (launchRunbook.gates || []).map(item => item.id);
    for (const gateId of [
      'browser-visual-current-run',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime',
      'final-readiness',
      'guard-all'
    ]) {
      if (!launchGateIds.includes(gateId)) failures.push(`Rysnova launch runbook missing gate: ${gateId}`);
    }
    for (const gate of launchRunbook.gates || []) {
      if (!gate.owner) failures.push(`Rysnova launch runbook gate ${gate.id} missing owner`);
      if (!gate.command) failures.push(`Rysnova launch runbook gate ${gate.id} missing command`);
      if (!gate.evidencePath) failures.push(`Rysnova launch runbook gate ${gate.id} missing evidencePath`);
      if (!gate.purpose) failures.push(`Rysnova launch runbook gate ${gate.id} missing purpose`);
      if (gate.finalProofRequired === true && !gate.finalProofField) {
        failures.push(`Rysnova launch runbook gate ${gate.id} requires a finalProofField`);
      }
    }
    for (const command of [
      'npm run release:rysnova-bim-launch-runbook',
      'npm run release:rysnova-bim-external-proof-preflight',
      BROWSER_VISUAL_EXTERNAL_COMMAND,
      'NODE_ENV=production MONGODB_URI=<staging-mongodb-uri> CAPACITY_BASE_URL=<staging-url> npm run perf:capacity',
      'OBJECT_STORAGE_EXTERNAL_PROVIDER=<s3|oss|minio> OBJECT_STORAGE_ENDPOINT=<endpoint> OBJECT_STORAGE_BUCKET=<bucket> OBJECT_STORAGE_ACCESS_KEY_ID=<key> OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret> npm run release:rysnova-bim-storage:smoke',
      'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke',
      'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke',
      'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke',
      'npm run release:rysnova-bim-external-proof',
      'npm run release:rysnova-bim-final-readiness',
      'npm run guard:all'
    ]) {
      if (!launchRunbook.runOrder?.includes(command)) {
        failures.push(`Rysnova launch runbook missing run order command: ${command}`);
      }
      if (!required.rysnovaBimLaunchRunbook?.runOrder?.includes(command)) {
        failures.push(`rysnovaBimLaunchRunbook release evidence missing run order command: ${command}`);
      }
    }
    const reportExternalBlockers = [...(launchRunbook.externalBlockers || [])].sort();
    const releaseExternalBlockers = [...(required.rysnovaBimLaunchRunbook?.externalBlockers || [])].sort();
    if (JSON.stringify(reportExternalBlockers) !== JSON.stringify(releaseExternalBlockers)) {
      failures.push('rysnovaBimLaunchRunbook externalBlockers must match launch runbook report');
    }
    if (!String(launchRunbook.completionRule || '').includes('finalLaunchRysnovaProof=true')) {
      failures.push('Rysnova launch runbook completion rule must require finalLaunchRysnovaProof=true');
    }
    if (!String(launchRunbook.nonCompletionRule || '').includes('must never be used as final production proof by itself')) {
      failures.push('Rysnova launch runbook must include a non-completion rule');
    }
    if (!String(required.rysnovaBimLaunchRunbook?.note || '').includes('must never be used as final production proof by itself')) {
      failures.push('rysnovaBimLaunchRunbook release note must include the non-completion rule');
    }
  } else if (required.rysnovaBimLaunchRunbook?.status !== 'blocked-external-proof-required') {
    failures.push('Rysnova launch runbook must remain blocked-external-proof-required when report is absent');
  }
  if (exists('scripts/release/rysnova-bim-object-storage-smoke.js')) {
    const objectStorageSmokeScript = read('scripts/release/rysnova-bim-object-storage-smoke.js');
    for (const token of [
      'missing-external-object-storage-proof',
      'validateObjectStorageEnv',
      'semanticFailures',
      'invalidEnv',
      'sanitizedExternalConfig',
      'endpointHash',
      'bucketHash',
      'external-object-storage-smoke',
      'finalLaunchObjectStorageProof',
      'externalRoundTrip',
      'finalLaunchEligible',
      'service-complete-rysnova-bim-signoff-package',
      'service-customer-package-lifecycle-handoff',
      'customerPackageReadiness',
      'customerPackageLifecycleHandoff',
      'downloadArtifactContent',
      'artifactContentDownloadReady',
      'service-artifact-content-download',
      'generateVisualArtifacts',
      'generateDeliverableArtifacts'
    ]) {
      if (!objectStorageSmokeScript.includes(token)) failures.push(`Rysnova object storage smoke script missing token: ${token}`);
    }
  }
  if (required.rysnovaBimFinalReadiness?.command !== 'npm run release:rysnova-bim-final-readiness') {
    failures.push('rysnovaBimFinalReadiness command must be npm run release:rysnova-bim-final-readiness');
  }
  if (!['blocked-external-proof-required', 'ready-for-production'].includes(required.rysnovaBimFinalReadiness?.status)) {
    failures.push('rysnovaBimFinalReadiness status must be blocked-external-proof-required or ready-for-production');
  }
  if (required.rysnovaBimFinalReadiness?.path !== 'evidence/rysnova-bim/rysnova-bim-final-readiness.json') {
    failures.push('rysnovaBimFinalReadiness path must be evidence/rysnova-bim/rysnova-bim-final-readiness.json');
  }
  if (required.rysnovaBimFinalReadiness?.summaryPath !== 'evidence/rysnova-bim/rysnova-bim-final-readiness.md') {
    failures.push('rysnovaBimFinalReadiness summaryPath must be evidence/rysnova-bim/rysnova-bim-final-readiness.md');
  }
  if (exists('scripts/release/rysnova-bim-final-readiness.js')) {
    const finalReadinessSource = read('scripts/release/rysnova-bim-final-readiness.js');
    for (const token of [
      'function capacitySeedReady',
      'rysnovaBimCustomerPackageSeed',
      'readinessFlagsReady',
      'quoteSummaryReady',
      'lifecycleHandoffReady',
      'noForbiddenInternalFields',
      'forbiddenFieldPaths',
      'downloadContentReady',
      'downloadContentCount',
      'downloadContentScenarioId',
      '/api/v2/rysnova-bim/artifacts/{artifactId}/download/content',
      'downloadContentTarget',
      'packageReadiness',
      'handoff-ready-not-bound',
      'external-iot-lifecycle-platform',
      'rysnovaBimCustomerPackageSeedReady',
      'releaseRysnovaCustomerPackageSeedReady',
      'function evidenceSource',
      'sourceEvidence',
      'sourceEvidenceConsistent',
      'sourceEvidenceHashes',
      'reportFinalProofPath',
      'finalProofMatches',
      'rysnova-bim-external-proof-preflight',
      'readyForExternalProofRun',
      'rysnova-bim-launch-runbook',
      'rysnovaBimLaunchRunbook',
      'must never be used as final production proof by itself'
    ]) {
      if (!finalReadinessSource.includes(token)) {
        failures.push(`Rysnova final readiness source missing capacity seed token: ${token}`);
      }
    }
  }
  if (exists('evidence/rysnova-bim/rysnova-bim-final-readiness.json')) {
    const rysnovaBimReadiness = readJson('evidence/rysnova-bim/rysnova-bim-final-readiness.json');
    if (rysnovaBimReadiness.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Rysnova final readiness platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (rysnovaBimReadiness.module !== 'Rysnova') {
      failures.push('Rysnova final readiness module must be Rysnova');
    }
    if (rysnovaBimReadiness.command !== 'npm run release:rysnova-bim-final-readiness') {
      failures.push('Rysnova final readiness command must be npm run release:rysnova-bim-final-readiness');
    }
    if (required.rysnovaBimFinalReadiness?.status !== rysnovaBimReadiness.status) {
      failures.push('rysnovaBimFinalReadiness release status must match readiness report status');
    }
    if (required.rysnovaBimFinalReadiness?.finalLaunchRysnovaProof !== rysnovaBimReadiness.finalLaunchRysnovaProof) {
      failures.push('rysnovaBimFinalReadiness finalLaunchRysnovaProof must match readiness report');
    }
    if (required.rysnovaBimFinalReadiness?.gates !== rysnovaBimReadiness.summary?.gates) {
      failures.push('rysnovaBimFinalReadiness gates count must match readiness report');
    }
    if (required.rysnovaBimFinalReadiness?.passed !== rysnovaBimReadiness.summary?.passed) {
      failures.push('rysnovaBimFinalReadiness passed count must match readiness report');
    }
    if (required.rysnovaBimFinalReadiness?.blocked !== rysnovaBimReadiness.summary?.blocked) {
      failures.push('rysnovaBimFinalReadiness blocked count must match readiness report');
    }
    if (required.rysnovaBimFinalReadiness?.sourceEvidence !== rysnovaBimReadiness.summary?.sourceEvidence) {
      failures.push('rysnovaBimFinalReadiness sourceEvidence count must match readiness report');
    }
    if (required.rysnovaBimFinalReadiness?.sourceEvidenceConsistent !== rysnovaBimReadiness.summary?.sourceEvidenceConsistent) {
      failures.push('rysnovaBimFinalReadiness sourceEvidenceConsistent must match readiness report');
    }
    if (!Array.isArray(rysnovaBimReadiness.sourceEvidence) || rysnovaBimReadiness.sourceEvidence.length < 7) {
      failures.push('Rysnova final readiness must record sourceEvidence for all required proof sources');
    } else {
      const requiredSourcePaths = [
        'audit/browser-visual-acceptance-report.json',
        'audit/capacity-inprocess-report.json',
        'audit/capacity-load-report.json',
        'evidence/object-storage/rysnova-bim-object-storage-smoke.json',
        'evidence/database/postgres-staging-smoke-report.json',
        'evidence/cache/redis-runtime-smoke.json',
        'evidence/workflow/temporal-runtime-smoke.json',
        'evidence/rysnova-bim/rysnova-bim-external-proof-preflight.json',
        'evidence/rysnova-bim/rysnova-bim-external-proof-run.json',
        'evidence/rysnova-bim/rysnova-bim-launch-runbook.json'
      ];
      const releaseSourcePaths = required.rysnovaBimFinalReadiness?.sourceEvidencePaths || [];
      const releaseSourceHashes = required.rysnovaBimFinalReadiness?.sourceEvidenceHashes || {};
      const reportSourcePaths = rysnovaBimReadiness.sourceEvidence.map(item => item.path);
      for (const sourcePath of requiredSourcePaths) {
        if (!reportSourcePaths.includes(sourcePath)) {
          failures.push(`Rysnova final readiness sourceEvidence missing path: ${sourcePath}`);
          continue;
        }
        if (!releaseSourcePaths.includes(sourcePath)) {
          failures.push(`rysnovaBimFinalReadiness release evidence missing source path: ${sourcePath}`);
        }
        const source = rysnovaBimReadiness.sourceEvidence.find(item => item.path === sourcePath);
        const currentHash = exists(sourcePath) ? fileSha256(sourcePath) : null;
        if (!source?.sha256 || source.sha256 !== currentHash) {
          failures.push(`Rysnova final readiness source evidence hash is stale for ${sourcePath}; rerun npm run release:rysnova-bim-final-readiness`);
        }
        if (releaseSourceHashes[sourcePath] !== source?.sha256) {
          failures.push(`rysnovaBimFinalReadiness release source hash must match readiness report for ${sourcePath}`);
        }
        if (source?.present !== true) {
          failures.push(`Rysnova final readiness source evidence must be present for ${sourcePath}`);
        }
        if (source?.statusAccepted !== true) {
          failures.push(`Rysnova final readiness source status must be accepted for ${sourcePath}`);
        }
        if (source?.finalProofMatches !== true) {
          failures.push(`Rysnova final readiness source final proof must match release evidence for ${sourcePath}`);
        }
        if (source?.releaseStatus === 'missing') {
          failures.push(`Rysnova final readiness source release status missing for ${sourcePath}`);
        }
      }
    }
    if (rysnovaBimReadiness.finalLaunchRysnovaProof === true && rysnovaBimReadiness.status !== 'ready-for-production') {
      failures.push('Rysnova final launch proof requires readiness status ready-for-production');
    }
    if (rysnovaBimReadiness.finalLaunchRysnovaProof === false && rysnovaBimReadiness.status !== 'blocked-external-proof-required') {
      failures.push('Rysnova non-final readiness must use blocked-external-proof-required status');
    }
    if (rysnovaBimReadiness.finalLaunchRysnovaProof === false && rysnovaBimReadiness.summary?.blocked <= 0) {
      failures.push('Rysnova non-final readiness must have at least one blocker');
    }
    if (rysnovaBimReadiness.finalLaunchRysnovaProof === true && rysnovaBimReadiness.summary?.sourceEvidenceConsistent !== true) {
      failures.push('Rysnova final launch proof requires sourceEvidenceConsistent true');
    }
    const readinessGateIds = new Set((rysnovaBimReadiness.gates || []).map(gate => gate.id));
    for (const gateId of [
      'rysnova-bim-v2-aggregate',
      'rysnova-bim-inprocess-capacity',
      'rysnova-bim-seven-artifact-package',
      'rysnova-bim-launch-runbook',
      'browser-visual-current-run',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime',
      'guard-all'
    ]) {
      if (!readinessGateIds.has(gateId)) failures.push(`Rysnova final readiness missing gate: ${gateId}`);
    }
    const blockerIds = (rysnovaBimReadiness.blockers || []).map(item => item.id).sort();
    const releaseBlockerIds = [...(required.rysnovaBimFinalReadiness?.blockers || [])].sort();
    if (JSON.stringify(blockerIds) !== JSON.stringify(releaseBlockerIds)) {
      failures.push('rysnovaBimFinalReadiness blockers must match readiness report blockers');
    }
    for (const command of [
      'npm run release:rysnova-bim-external-proof-preflight',
      'npm run release:rysnova-bim-external-proof',
      'npm run release:rysnova-bim-launch-runbook',
      BROWSER_VISUAL_EXTERNAL_COMMAND,
	      'NODE_ENV=production MONGODB_URI=<staging-mongodb-uri> CAPACITY_BASE_URL=<staging-url> npm run perf:capacity',
	      'OBJECT_STORAGE_EXTERNAL_PROVIDER=<s3|oss|minio> OBJECT_STORAGE_ENDPOINT=<endpoint> OBJECT_STORAGE_BUCKET=<bucket> OBJECT_STORAGE_ACCESS_KEY_ID=<key> OBJECT_STORAGE_SECRET_ACCESS_KEY=<secret> npm run release:rysnova-bim-storage:smoke',
	      'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke',
	      'REDIS_STAGING_URL=<redis-url> npm run release:redis-runtime:smoke',
	      'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke',
	      'npm run guard:all'
	    ]) {
      if (!rysnovaBimReadiness.requiredExternalProofCommands?.includes(command)) {
        failures.push(`Rysnova final readiness missing external proof command: ${command}`);
      }
      if (!required.rysnovaBimFinalReadiness?.requiredExternalProofCommands?.includes(command)) {
        failures.push(`rysnovaBimFinalReadiness release evidence missing external proof command: ${command}`);
      }
    }
    if (!String(rysnovaBimReadiness.nonCompletionRule || '').includes('cannot be called production-complete')) {
      failures.push('Rysnova final readiness must include a non-completion rule');
    }
    if (!String(required.rysnovaBimFinalReadiness?.note || '').includes('cannot be called production-complete')) {
      failures.push('rysnovaBimFinalReadiness release note must include the non-completion rule');
    }
    const externalGateIds = [
      'browser-visual-current-run',
      'staging-capacity',
      'external-object-storage',
      'postgres-staging',
      'redis-runtime',
      'temporal-runtime',
      'guard-all'
    ];
    if (rysnovaBimReadiness.finalLaunchRysnovaProof === true) {
      for (const gateId of externalGateIds) {
        const gate = (rysnovaBimReadiness.gates || []).find(item => item.id === gateId);
        if (gate?.passed !== true) failures.push(`Rysnova final launch proof requires ${gateId} gate to pass`);
      }
    }
  } else if (required.rysnovaBimFinalReadiness?.status !== 'blocked-external-proof-required') {
    failures.push('Rysnova final readiness must remain blocked-external-proof-required when report is absent');
  }
  if (!exists('contracts/openapi/rhautt-nexus-v2.openapi.json')) {
    failures.push('missing OpenAPI contract');
  } else {
    const openApi = readJson('contracts/openapi/rhautt-nexus-v2.openapi.json');
    const customerPackageSchema = openApi.components?.schemas?.RysnovaCustomerPackage || {};
    const customerPackageRequired = customerPackageSchema.required || [];
    const customerPackageProperties = customerPackageSchema.properties || {};
    const customerPackageRequiredTypes = customerPackageProperties.requiredTypes || {};
    for (const field of ['readiness', 'quoteSummary', 'lifecycleHandoff', 'standardsSummary', 'visibility']) {
      if (!customerPackageRequired.includes(field)) {
        failures.push(`OpenAPI RysnovaCustomerPackage required fields missing ${field}`);
      }
    }
    if (customerPackageProperties.readiness?.$ref !== '#/components/schemas/RysnovaCustomerPackageReadiness') {
      failures.push('OpenAPI RysnovaCustomerPackage.readiness must reference RysnovaCustomerPackageReadiness');
    }
    if (!JSON.stringify(customerPackageProperties.quoteSummary || {}).includes('RysnovaCustomerQuoteSummary')) {
      failures.push('OpenAPI RysnovaCustomerPackage.quoteSummary must reference RysnovaCustomerQuoteSummary');
    }
    if (!JSON.stringify(customerPackageProperties.lifecycleHandoff || {}).includes('RysnovaInstalledAssetHandoff')) {
      failures.push('OpenAPI RysnovaCustomerPackage.lifecycleHandoff must reference RysnovaInstalledAssetHandoff');
    }
    if (customerPackageProperties.standardsSummary?.$ref !== '#/components/schemas/RysnovaStandardsSummary') {
      failures.push('OpenAPI RysnovaCustomerPackage.standardsSummary must reference RysnovaStandardsSummary');
    }
    const customerPackageReadinessSchema = openApi.components?.schemas?.RysnovaCustomerPackageReadiness || {};
    for (const field of ['packageReady', 'visualReady', 'commercialReady', 'standardsPassed', 'lifecycleHandoffReady', 'customerSignoffReady', 'objectStorageIntegrityReady']) {
      if (!customerPackageReadinessSchema.required?.includes(field)) {
        failures.push(`OpenAPI RysnovaCustomerPackageReadiness required fields missing ${field}`);
      }
    }
    if (customerPackageRequiredTypes.minItems !== 7 ||
        customerPackageRequiredTypes.maxItems !== 7 ||
        customerPackageRequiredTypes.uniqueItems !== true) {
      failures.push('OpenAPI RysnovaCustomerPackage.requiredTypes must require exactly 7 unique signoff artifact types');
    }
    const containsTypes = (customerPackageRequiredTypes.allOf || [])
      .map(item => item.contains?.const)
      .filter(Boolean);
    for (const requiredType of ['principle-diagram', 'construction-drawing', 'bim-model', 'bom', 'quantity-takeoff', 'standards-check', 'customer-report']) {
      if (!containsTypes.includes(requiredType)) {
        failures.push(`OpenAPI RysnovaCustomerPackage.requiredTypes missing contains const: ${requiredType}`);
      }
      if (!customerPackageRequiredTypes['x-rysnova-bim-signoff-required-types']?.includes(requiredType)) {
        failures.push(`OpenAPI RysnovaCustomerPackage.requiredTypes missing x-rysnova-bim-signoff-required-types: ${requiredType}`);
      }
    }
  }
  if (!exists('packages/generated-client/src/rhauttNexusClient.ts')) {
    failures.push('missing generated TypeScript client');
  }
  if (!exists('test/production-readiness/openapi-contract.test.js')) {
    failures.push('missing OpenAPI contract production-readiness test');
  }
  if (required.openApiContract?.status !== 'passed-current-run') {
    failures.push('openApiContract evidence must be passed-current-run');
  }
  if (required.openApiContract?.path !== 'contracts/openapi/rhautt-nexus-v2.openapi.json') {
    failures.push('openApiContract evidence path must point to the OpenAPI spec');
  }
  if (required.openApiContract?.clientPath !== 'packages/generated-client/src/rhauttNexusClient.ts') {
    failures.push('openApiContract evidence clientPath must point to generated client');
  }
  if (required.openApiContract?.summaryPath !== 'evidence/contracts/openapi-generated-client.md') {
    failures.push('openApiContract evidence summaryPath must be evidence/contracts/openapi-generated-client.md');
  }
  if (required.diagnosisCompletionLoop?.status !== 'passed-current-run') {
    failures.push('diagnosisCompletionLoop evidence must be passed-current-run');
  }
  if (required.diagnosisCompletionLoop?.routePath !== '/api/v2/diagnosis/complete') {
    failures.push('diagnosisCompletionLoop routePath must be /api/v2/diagnosis/complete');
  }
  if (required.diagnosisCompletionLoop?.path !== 'test/production-readiness/diagnosis-service.test.js') {
    failures.push('diagnosisCompletionLoop path must be test/production-readiness/diagnosis-service.test.js');
  }
  if (required.diagnosisCompletionLoop?.contractPath !== 'contracts/openapi/rhautt-nexus-v2.openapi.json') {
    failures.push('diagnosisCompletionLoop contractPath must point to the v2 OpenAPI contract');
  }
  if (required.diagnosisCompletionLoop?.clientPath !== 'packages/generated-client/src/rhauttNexusClient.ts') {
    failures.push('diagnosisCompletionLoop clientPath must point to generated client');
  }
  for (const capability of [
    'rysnova-ai-diagnosis-source',
    'crm-lead',
    'three-tier-solutions',
    'quotation-summary',
    'customer-report-share-url',
    'outbox-diagnosis-completed',
    'lifecycle_handoff_only'
  ]) {
    if (!required.diagnosisCompletionLoop?.capabilities?.includes(capability)) {
      failures.push(`diagnosisCompletionLoop missing capability: ${capability}`);
    }
  }
  for (const [sourcePath, tokens] of Object.entries({
    'services/api/src/modules/diagnosis/diagnosis.service.ts': ['completePublicDiagnosis', 'completeDiagnosis', 'createLeadInTx', 'DiagnosisSessionEntity', 'diagnosis.completed'],
    'server/modules/productModules/product-module-registry.js': ['rysnova-ai-diagnosis', 'rysnova-ai-diagnosis-report', 'rysnova-consumer-system'],
    'services/api/src/modules/diagnosis/diagnosis.controller.ts': ["@Controller('diagnosis')", "@Post('complete')", "@Post('public/complete')"],
    'server/modules/productionMiddleware.js': ["'/api/v2/diagnosis'", 'NESTJS_MIGRATED_PREFIXES'],
    'contracts/openapi/rhautt-nexus-v2.openapi.json': ['/api/v2/diagnosis/complete', 'DiagnosisCompletionSuccess', 'rysnova-ai-diagnosis-report', 'Rheem', 'Ruud', 'Everhot'],
    'packages/generated-client/src/rhauttNexusClient.ts': ['async completeDiagnosis<'],
    'test/production-readiness/diagnosis-service.test.js': ['Diagnosis NestJS cutover and Express retirement', 'legacy CRM service']
  })) {
    if (!exists(sourcePath)) {
      failures.push(`missing diagnosis completion source: ${sourcePath}`);
      continue;
    }
    const source = read(sourcePath);
    for (const token of tokens) {
      if (!source.includes(token)) failures.push(`${sourcePath} missing diagnosis completion token: ${token}`);
    }
  }

  if (required.customerProjectPortalLoop?.status !== 'passed-current-run') {
    failures.push('customerProjectPortalLoop evidence must be passed-current-run');
  }
  if (required.customerProjectPortalLoop?.routePath !== '/api/v2/lifecycle/customer-projects/{contractId}') {
    failures.push('customerProjectPortalLoop routePath must be /api/v2/lifecycle/customer-projects/{contractId}');
  }
  if (required.customerProjectPortalLoop?.path !== 'test/production-readiness/lifecycle-service.test.js') {
    failures.push('customerProjectPortalLoop path must be test/production-readiness/lifecycle-service.test.js');
  }
  if (required.customerProjectPortalLoop?.contractPath !== 'contracts/openapi/rhautt-nexus-v2.openapi.json') {
    failures.push('customerProjectPortalLoop contractPath must point to the v2 OpenAPI contract');
  }
  if (required.customerProjectPortalLoop?.clientPath !== 'packages/generated-client/src/rhauttNexusClient.ts') {
    failures.push('customerProjectPortalLoop clientPath must point to generated client');
  }
  for (const capability of [
    'customer-visible-project-state',
    'solution-references',
    'quotation-status',
    'construction-progress',
    'acceptance-status',
    'service-plan',
    'installed-assets-summary',
    'customer-scope-isolation',
    'hidden-internal-business-fields',
    'frontend-v2-contract-binding',
    'lifecycle_handoff_only'
  ]) {
    if (!required.customerProjectPortalLoop?.capabilities?.includes(capability)) {
      failures.push(`customerProjectPortalLoop missing capability: ${capability}`);
    }
  }
  for (const [sourcePath, tokens] of Object.entries({
    'server/middleware/tenantScope.js': ['customerId'],
    'server/middleware/authenticateV2.js': ['customerId'],
    'server/models/UserV2.js': ['customerId'],
    'services/api/src/modules/auth/auth.service.ts': ['customerId'],
    'services/api/src/modules/lifecycle/lifecycle.service.ts': ['getCustomerProjectView', 'buildCustomerProjectView', 'lifecycle_handoff_only'],
    'services/api/src/modules/lifecycle/lifecycle.controller.ts': ["@Get('customer-projects')", "@Get('customer-projects/:id')", 'listCustomerProjectViews', 'getCustomerProjectView'],
    'contracts/openapi/rhautt-nexus-v2.openapi.json': ['/api/v2/lifecycle/customer-projects', '/api/v2/lifecycle/customer-projects/{contractId}', 'LifecycleCustomerProjectListSuccess', 'LifecycleCustomerProjectSuccess', 'LifecycleCustomerProject', 'LifecycleCustomerVisibility', 'lifecycle_handoff_only'],
    'packages/generated-client/src/rhauttNexusClient.ts': ['async listLifecycleCustomerProjects<', 'async getLifecycleCustomerProject<'],
    'archive/legacy-ui/public/customer-view.html': ['/api/v2/lifecycle/customer-projects', 'Authorization', 'lifecycle_handoff_only', 'DEMO_PROJECT'],
    'test/production-readiness/lifecycle-service.test.js': ['builds customer-visible project portal view', 'customer project portal rejects cross-customer reads', 'dealerMargin', 'lifecycle_handoff_only'],
    'test/production-readiness/v2-routes.test.js': ['lifecycle customer project route returns customer-visible portal contract', 'customerId']
  })) {
    if (!exists(sourcePath)) {
      failures.push(`missing customer project portal source: ${sourcePath}`);
      continue;
    }
    const source = read(sourcePath);
    for (const token of tokens) {
      if (!source.includes(token)) failures.push(`${sourcePath} missing customer project portal token: ${token}`);
    }
  }
  if (exists('archive/legacy-ui/public/customer-view.html')) {
    const customerView = read('archive/legacy-ui/public/customer-view.html');
    for (const forbidden of [
      '/api/crm/customers',
      '/api/contracts/'
    ]) {
      if (customerView.includes(forbidden)) failures.push(`archive/legacy-ui/public/customer-view.html must not use legacy customer portal API: ${forbidden}`);
    }
  }

  if (required.legacyFusion?.status !== 'passed-current-run') {
    failures.push('legacyFusion evidence must be passed-current-run');
  }
  if (required.legacyFusion?.path !== 'audit/legacy-fusion-registry.json') {
    failures.push('legacyFusion evidence path must be audit/legacy-fusion-registry.json');
  }
  if (required.legacyFusion?.reportPath !== 'audit/legacy-fusion-report.json') {
    failures.push('legacyFusion evidence reportPath must be audit/legacy-fusion-report.json');
  }
  if (exists('audit/legacy-fusion-report.json')) {
    const legacyFusion = readJson('audit/legacy-fusion-report.json');
    if (legacyFusion.summary?.unregisteredOrphanEngines !== 0) {
      failures.push('legacy fusion must have zero unregistered orphan engines');
    }
    if (required.legacyFusion?.registeredEngineAssets !== legacyFusion.summary?.registeredEngineAssets) {
      failures.push('legacyFusion registeredEngineAssets must match legacy fusion report');
    }
    if (required.legacyFusion?.resolvedEngineAssets !== legacyFusion.summary?.resolvedEngineAssets) {
      failures.push('legacyFusion resolvedEngineAssets must match legacy fusion report');
    }
    if (required.legacyFusion?.unregisteredOrphanEngines !== legacyFusion.summary?.unregisteredOrphanEngines) {
      failures.push('legacyFusion unregisteredOrphanEngines must match legacy fusion report');
    }
    if (required.legacyFusion?.registeredPageAssets !== legacyFusion.summary?.registeredPageAssets) {
      failures.push('legacyFusion registeredPageAssets must match legacy fusion report');
    }
  } else {
    failures.push('missing legacy fusion report');
  }

  if (!SKIP_VISUAL_ACCEPTANCE && exists('audit/browser-visual-acceptance-report.json')) {
    const visual = readJson('audit/browser-visual-acceptance-report.json');
    let visualFresh = true;
    if (visual.summary?.failed !== 0) {
      visualFresh = false;
      failures.push('browser visual acceptance report must have zero failed pages');
    }
    if (visual.summary?.passed !== visual.summary?.pages) {
      visualFresh = false;
      failures.push('browser visual acceptance report passed count must equal page count');
    }
    for (const result of visual.results || []) {
      if (!result.passed) {
        visualFresh = false;
        failures.push(`browser visual page failed: ${result.path}`);
      }
      if (result.sourcePath && exists(result.sourcePath) && result.sourceSha256 !== fileSha256(result.sourcePath)) {
        visualFresh = false;
        failures.push(`browser visual evidence is stale for ${result.sourcePath}; rerun VISUAL_BASE_URL=<url> npm run guard:browser-visual`);
      }
    }
    if (visualFresh && required.browserVisual?.status !== 'passed-current-run') {
      failures.push('browserVisual evidence must be passed-current-run after visual acceptance');
    }
    if (required.browserVisual?.path !== 'audit/browser-visual-acceptance-report.json') {
      failures.push('browserVisual evidence path must be audit/browser-visual-acceptance-report.json');
    }
    if (required.browserVisual?.summaryPath !== 'audit/browser-visual-acceptance-report.md') {
      failures.push('browserVisual evidence summaryPath must be audit/browser-visual-acceptance-report.md');
    }
    if (required.browserVisual?.pages !== visual.summary?.pages) {
      failures.push('browserVisual evidence pages must match visual report summary');
    }
    if (visual.summary?.pages !== REQUIRED_ACTIVE_VISUAL_PAGES.length) {
      failures.push(`browser visual acceptance must cover all ${REQUIRED_ACTIVE_VISUAL_PAGES.length} active pages`);
    }
    const visualPaths = new Set((visual.results || []).map(result => result.path));
    for (const page of REQUIRED_ACTIVE_VISUAL_PAGES) {
      if (!visualPaths.has(page)) failures.push(`browser visual acceptance missing active page: ${page}`);
    }
  } else if (SKIP_VISUAL_ACCEPTANCE) {
    warnings.push('browser visual acceptance freshness skipped for nonvisual delivery-goal mode; final guard:all still requires guard:browser-visual');
  }
  if (exists('audit/active-page-static-acceptance-report.json')) {
    const staticAcceptance = readJson('audit/active-page-static-acceptance-report.json');
    if (staticAcceptance.summary?.failed !== 0) {
      failures.push('active page static acceptance report must have zero failed pages');
    }
    if (staticAcceptance.summary?.pages !== REQUIRED_ACTIVE_VISUAL_PAGES.length) {
      failures.push(`active page static acceptance must cover all ${REQUIRED_ACTIVE_VISUAL_PAGES.length} active pages`);
    }
    const staticPaths = new Set((staticAcceptance.results || []).map(result => result.path));
    for (const page of REQUIRED_ACTIVE_VISUAL_PAGES) {
      if (!staticPaths.has(page)) failures.push(`active page static acceptance missing active page: ${page}`);
    }
    for (const result of staticAcceptance.results || []) {
      if (!result.passed) failures.push(`active page static acceptance failed: ${result.path}`);
      if (result.sourcePath && exists(result.sourcePath) && result.sourceSha256 !== fileSha256(result.sourcePath)) {
        failures.push(`active page static evidence is stale for ${result.sourcePath}; rerun npm run guard:active-page-static`);
      }
    }
    if (required.activePageStatic?.status !== 'passed-current-run') {
      failures.push('activePageStatic evidence must be passed-current-run');
    }
    if (required.activePageStatic?.path !== 'audit/active-page-static-acceptance-report.json') {
      failures.push('activePageStatic evidence path must be audit/active-page-static-acceptance-report.json');
    }
    if (required.activePageStatic?.summaryPath !== 'audit/active-page-static-acceptance-report.md') {
      failures.push('activePageStatic evidence summaryPath must be audit/active-page-static-acceptance-report.md');
    }
    if (required.activePageStatic?.pages !== staticAcceptance.summary?.pages) {
      failures.push('activePageStatic evidence pages must match static acceptance report summary');
    }
  } else {
    failures.push('missing active page static acceptance report');
  }
  if (required.activeRuntimeDeps?.status !== 'passed-current-run') {
    failures.push('activeRuntimeDeps evidence must be passed-current-run');
  }
  if (required.activeRuntimeDeps?.command !== 'npm run guard:active-runtime-deps') {
    failures.push('activeRuntimeDeps evidence command must be npm run guard:active-runtime-deps');
  }
  if (required.activeRuntimeDeps?.path !== 'scripts/agent-guards/active-runtime-deps-check.js') {
    failures.push('activeRuntimeDeps evidence path must be scripts/agent-guards/active-runtime-deps-check.js');
  }
  for (const file of [
    'archive/legacy-ui/public/js/konva-lite.js',
    'archive/legacy-ui/public/js/three.min.js',
    'archive/legacy-ui/public/js/orbit-controls-lite.js',
    'archive/legacy-ui/public/designer.html',
    'archive/legacy-ui/public/rysnova-bim-designer.html'
  ]) {
    if (!exists(file)) failures.push(`activeRuntimeDeps missing required file: ${file}`);
  }
  if (required.postgresTargetSchema?.status !== 'target-contract-guarded') {
    failures.push('postgresTargetSchema evidence must be target-contract-guarded');
  }
  if (required.postgresTargetSchema?.command !== 'npm run guard:postgres-target-schema') {
    failures.push('postgresTargetSchema evidence command must be npm run guard:postgres-target-schema');
  }
  if (required.postgresTargetSchema?.path !== 'evidence/database/postgres-target-schema-report.json') {
    failures.push('postgresTargetSchema evidence path must be evidence/database/postgres-target-schema-report.json');
  }
  if (required.postgresTargetSchema?.summaryPath !== 'evidence/database/postgres-target-schema-report.md') {
    failures.push('postgresTargetSchema evidence summaryPath must be evidence/database/postgres-target-schema-report.md');
  }
  if (required.postgresTargetSchema?.migrationPath !== 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql') {
    failures.push('postgresTargetSchema migrationPath must be database/postgres/migrations/001_rhautt_nexus_core_ledger.sql');
  }
  if (exists('evidence/database/postgres-target-schema-report.json')) {
    const postgresReport = readJson('evidence/database/postgres-target-schema-report.json');
    if (postgresReport.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('PostgreSQL target schema report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (postgresReport.status !== 'target-contract-not-production-applied') {
      failures.push('PostgreSQL target schema report must remain target-contract-not-production-applied until staging migration proof exists');
    }
    if (postgresReport.summary?.failures !== 0) {
      failures.push('PostgreSQL target schema report must have zero failures');
    }
    if (postgresReport.migrationPath !== 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql') {
      failures.push('PostgreSQL target schema report migrationPath must point to the target ledger migration');
    }
    if (postgresReport.migrationSha256 !== fileSha256('database/postgres/migrations/001_rhautt_nexus_core_ledger.sql')) {
      failures.push('PostgreSQL target schema report is stale; rerun npm run guard:postgres-target-schema');
    }
    if (required.postgresTargetSchema?.tables !== postgresReport.summary?.requiredTables) {
      failures.push('postgresTargetSchema tables must match PostgreSQL target schema report');
    }
    if (required.postgresTargetSchema?.tenantScopedTables !== postgresReport.summary?.tenantScopedTables) {
      failures.push('postgresTargetSchema tenantScopedTables must match PostgreSQL target schema report');
    }
  } else {
    failures.push('missing PostgreSQL target schema report');
  }
  if (required.postgresRlsBehavior?.status !== 'target-behavior-simulated') {
    failures.push('postgresRlsBehavior evidence must be target-behavior-simulated');
  }
  if (required.postgresRlsBehavior?.command !== 'npm run guard:postgres-rls-behavior') {
    failures.push('postgresRlsBehavior evidence command must be npm run guard:postgres-rls-behavior');
  }
  if (required.postgresRlsBehavior?.path !== 'evidence/database/postgres-rls-behavior-report.json') {
    failures.push('postgresRlsBehavior evidence path must be evidence/database/postgres-rls-behavior-report.json');
  }
  if (required.postgresRlsBehavior?.summaryPath !== 'evidence/database/postgres-rls-behavior-report.md') {
    failures.push('postgresRlsBehavior evidence summaryPath must be evidence/database/postgres-rls-behavior-report.md');
  }
  if (required.postgresRlsBehavior?.finalLaunchDatabaseProof !== false) {
    failures.push('postgresRlsBehavior must not claim final launch database proof');
  }
  for (const capability of [
    'tenantScopedSelect',
    'withCheckRejectsCrossTenantWrite',
    'tenantScopedAuditLogs',
    'hqRollupWithoutRawCustomerLeak',
    'lifecycleHandoffOnlyBoundary'
  ]) {
    if (!required.postgresRlsBehavior?.capabilities?.includes(capability)) {
      failures.push(`postgresRlsBehavior missing capability: ${capability}`);
    }
  }
  if (exists('evidence/database/postgres-rls-behavior-report.json')) {
    const rlsBehavior = readJson('evidence/database/postgres-rls-behavior-report.json');
    if (rlsBehavior.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('PostgreSQL RLS behavior report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (rlsBehavior.status !== 'target-behavior-simulated-not-staging-applied') {
      failures.push('PostgreSQL RLS behavior report must remain target-behavior-simulated-not-staging-applied');
    }
    if (rlsBehavior.summary?.failures !== 0) {
      failures.push('PostgreSQL RLS behavior report must have zero failures');
    }
    if (rlsBehavior.migrationSha256 !== fileSha256('database/postgres/migrations/001_rhautt_nexus_core_ledger.sql')) {
      failures.push('PostgreSQL RLS behavior report is stale; rerun npm run guard:postgres-rls-behavior');
    }
  } else {
    failures.push('missing PostgreSQL RLS behavior report');
  }
  if (required.postgresTransactionOutbox?.status !== 'target-transaction-simulated') {
    failures.push('postgresTransactionOutbox evidence must be target-transaction-simulated');
  }
  if (required.postgresTransactionOutbox?.command !== 'npm run guard:postgres-transaction-outbox') {
    failures.push('postgresTransactionOutbox evidence command must be npm run guard:postgres-transaction-outbox');
  }
  if (required.postgresTransactionOutbox?.path !== 'evidence/database/postgres-transaction-outbox-report.json') {
    failures.push('postgresTransactionOutbox evidence path must be evidence/database/postgres-transaction-outbox-report.json');
  }
  if (required.postgresTransactionOutbox?.summaryPath !== 'evidence/database/postgres-transaction-outbox-report.md') {
    failures.push('postgresTransactionOutbox evidence summaryPath must be evidence/database/postgres-transaction-outbox-report.md');
  }
  if (required.postgresTransactionOutbox?.migrationPath !== 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql') {
    failures.push('postgresTransactionOutbox migrationPath must be database/postgres/migrations/001_rhautt_nexus_core_ledger.sql');
  }
  if (required.postgresTransactionOutbox?.finalLaunchDatabaseProof !== false) {
    failures.push('postgresTransactionOutbox must not claim final launch database proof');
  }
  for (const capability of [
    'businessWriteOutboxAtomicity',
    'rollbackNoPartialRows',
    'tenantScopedIdempotencyKey',
    'crossTenantWithCheckRejects',
    'auditAndWorkflowRowsInTransaction',
    'lifecycleHandoffOnlyBoundary',
    'rysnovaBimCustomerSignoffConfirmedOutbox',
    'rysnovaBimCustomerSignoffSanitizedReceipt'
  ]) {
    if (!required.postgresTransactionOutbox?.capabilities?.includes(capability)) {
      failures.push(`postgresTransactionOutbox missing capability: ${capability}`);
    }
  }
  if (exists('evidence/database/postgres-transaction-outbox-report.json')) {
    const transactionOutbox = readJson('evidence/database/postgres-transaction-outbox-report.json');
    if (transactionOutbox.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('PostgreSQL transaction outbox report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (transactionOutbox.status !== 'target-transaction-simulated-not-staging-applied') {
      failures.push('PostgreSQL transaction outbox report must remain target-transaction-simulated-not-staging-applied');
    }
    if (transactionOutbox.finalLaunchDatabaseProof !== false) {
      failures.push('PostgreSQL transaction outbox report must not claim final launch database proof');
    }
    if (transactionOutbox.summary?.failures !== 0) {
      failures.push('PostgreSQL transaction outbox report must have zero failures');
    }
    if (transactionOutbox.summary?.rolledBackTransactions < 1) {
      failures.push('PostgreSQL transaction outbox report must prove at least one rollback');
    }
    if (transactionOutbox.summary?.outboxRows < 2 || transactionOutbox.summary?.auditRows < 2 || transactionOutbox.summary?.workflowRows < 2) {
      failures.push('PostgreSQL transaction outbox report must prove business, audit, workflow, and outbox writes');
    }
    const checksByName = new Map((transactionOutbox.checks || []).map(item => [item.name, item]));
    for (const checkName of [
      'rysnova-bim-customer-signoff-transaction-commits',
      'rysnova-bim-customer-signoff-confirmed-outbox',
      'rysnova-bim-customer-signoff-confirmed-audit',
      'rysnova-bim-customer-signoff-workflow',
      'rysnova-bim-customer-signoff-sanitized-receipt'
    ]) {
      if (checksByName.get(checkName)?.passed !== true) {
        failures.push(`PostgreSQL transaction outbox report must pass ${checkName}`);
      }
    }
    if (transactionOutbox.migrationSha256 !== fileSha256('database/postgres/migrations/001_rhautt_nexus_core_ledger.sql')) {
      failures.push('PostgreSQL transaction outbox report is stale; rerun npm run guard:postgres-transaction-outbox');
    }
  } else {
    failures.push('missing PostgreSQL transaction outbox report');
  }
  if (!['missing-staging-run', 'passed-staging-current-run'].includes(required.postgresStagingSmoke?.status)) {
    failures.push('postgresStagingSmoke evidence status must be missing-staging-run or passed-staging-current-run');
  }
  if (required.postgresStagingSmoke?.command !== 'POSTGRES_STAGING_URL=<staging-postgres-url> npm run release:postgres-staging:smoke') {
    failures.push('postgresStagingSmoke evidence command must document POSTGRES_STAGING_URL launch gate');
  }
  if (required.postgresStagingSmoke?.path !== 'evidence/database/postgres-staging-smoke-report.json') {
    failures.push('postgresStagingSmoke evidence path must be evidence/database/postgres-staging-smoke-report.json');
  }
  if (required.postgresStagingSmoke?.summaryPath !== 'evidence/database/postgres-staging-smoke-report.md') {
    failures.push('postgresStagingSmoke evidence summaryPath must be evidence/database/postgres-staging-smoke-report.md');
  }
  if (required.postgresStagingSmoke?.migrationPath !== 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql') {
    failures.push('postgresStagingSmoke migrationPath must be database/postgres/migrations/001_rhautt_nexus_core_ledger.sql');
  }
  for (const capability of [
    'stagingMigrationApplied',
    'realPostgresRls',
    'tenantScopedSelect',
    'crossTenantWriteRejected',
    'forceRlsCriticalTables',
    'lifecycle_handoff_only',
    'outboxEventVisible',
    'rysnovaBimCustomerPackageReadyOutbox',
    'rysnovaBimCustomerSignoffConfirmedOutbox',
    'rysnovaBimCustomerSignoffWorkflow',
    'rysnovaBimCustomerSignoffSanitizedReceipt'
  ]) {
    if (!required.postgresStagingSmoke?.capabilities?.includes(capability)) {
      failures.push(`postgresStagingSmoke missing capability: ${capability}`);
    }
  }
  if (exists('evidence/database/postgres-staging-smoke-report.json')) {
    const stagingSmoke = readJson('evidence/database/postgres-staging-smoke-report.json');
    if (stagingSmoke.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('PostgreSQL staging smoke report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (stagingSmoke.migrationSha256 !== fileSha256('database/postgres/migrations/001_rhautt_nexus_core_ledger.sql')) {
      failures.push('PostgreSQL staging smoke report is stale; rerun npm run release:postgres-staging:smoke');
    }
    if (stagingSmoke.status === 'passed-staging-current-run') {
      if (stagingSmoke.finalLaunchDatabaseProof !== true || required.postgresStagingSmoke?.finalLaunchDatabaseProof !== true) {
        failures.push('passed PostgreSQL staging smoke must set finalLaunchDatabaseProof true in report and release evidence');
      }
      for (const check of stagingSmoke.checks || []) {
        if (check.passed !== true) failures.push(`PostgreSQL staging smoke failed check: ${check.name}`);
      }
      const stagingChecksByName = new Map((stagingSmoke.checks || []).map(check => [check.name, check]));
      for (const checkName of [
        'rysnovaBimCustomerPackageReadyOutbox',
        'rysnovaBimCustomerSignoffConfirmedOutbox',
        'rysnovaBimCustomerSignoffWorkflow',
        'rysnovaBimCustomerSignoffSanitizedReceipt'
      ]) {
        if (stagingChecksByName.get(checkName)?.passed !== true) {
          failures.push(`passed PostgreSQL staging smoke must prove ${checkName}`);
        }
      }
    } else if (stagingSmoke.status === 'missing-staging-run') {
      if (stagingSmoke.finalLaunchDatabaseProof !== false || required.postgresStagingSmoke?.finalLaunchDatabaseProof !== false) {
        failures.push('missing PostgreSQL staging smoke must not claim finalLaunchDatabaseProof');
      }
      if (!String(stagingSmoke.reason || '').includes('POSTGRES_STAGING_URL') && !String(stagingSmoke.reason || '').includes('psql')) {
        failures.push('missing PostgreSQL staging smoke report must explain POSTGRES_STAGING_URL or psql blocker');
      }
    } else {
      failures.push(`PostgreSQL staging smoke report has unacceptable status: ${stagingSmoke.status}`);
    }
  } else {
    failures.push('missing PostgreSQL staging smoke report');
  }
  if (exists('scripts/release/postgres-staging-smoke.js')) {
    const stagingSmokeScript = read('scripts/release/postgres-staging-smoke.js');
    for (const token of ['POSTGRES_STAGING_URL', 'psql', 'SET LOCAL app.tenant_id', 'cross-tenant write was not rejected', 'lifecycle_handoff_only', 'rysnova-bim.customer_package.ready', 'rysnova-bim.customer_signoff.confirmed', 'rysnova-bim-customer-signoff-workflow', 'rawSensitiveEvidenceOmitted', 'finalLaunchDatabaseProof', 'validatePostgresStagingEnv', 'semanticFailures', 'invalidEnv']) {
      if (!stagingSmokeScript.includes(token)) failures.push(`PostgreSQL staging smoke script missing token: ${token}`);
    }
  }
  if (required.workflowOutboxContract?.status !== 'target-contract-guarded') {
    failures.push('workflowOutboxContract evidence must be target-contract-guarded');
  }
  if (required.workflowOutboxContract?.command !== 'npm run guard:workflow-outbox-contract') {
    failures.push('workflowOutboxContract evidence command must be npm run guard:workflow-outbox-contract');
  }
  if (required.workflowOutboxContract?.path !== 'evidence/workflow/workflow-outbox-contract-report.json') {
    failures.push('workflowOutboxContract evidence path must be evidence/workflow/workflow-outbox-contract-report.json');
  }
  if (required.workflowOutboxContract?.summaryPath !== 'evidence/workflow/workflow-outbox-contract-report.md') {
    failures.push('workflowOutboxContract evidence summaryPath must be evidence/workflow/workflow-outbox-contract-report.md');
  }
  if (required.workflowOutboxContract?.contractPath !== 'contracts/workflow/rhautt-nexus-workflow-outbox-contract.json') {
    failures.push('workflowOutboxContract contractPath must be contracts/workflow/rhautt-nexus-workflow-outbox-contract.json');
  }
  if (required.workflowOutboxContract?.finalLaunchWorkflowProof !== false) {
    failures.push('workflowOutboxContract must not claim final launch workflow proof');
  }
  if (required.workflowOutboxContract?.compatibilityDeliveryProof !== true) {
    failures.push('workflowOutboxContract must record compatibilityDeliveryProof true after outbox replay/retry/dead-letter tests pass');
  }
  if (required.workflowOutboxContract?.compatibilityWorkflowReplayProof !== true) {
    failures.push('workflowOutboxContract must record compatibilityWorkflowReplayProof true after local workflow replay smoke passes');
  }
  if (required.workflowOutboxContract?.workflowReplaySmokeCommand !== 'npm run release:workflow-replay:smoke') {
    failures.push('workflowOutboxContract workflowReplaySmokeCommand must be npm run release:workflow-replay:smoke');
  }
  if (required.workflowOutboxContract?.workflowReplaySmokePath !== 'evidence/workflow/workflow-replay-smoke.json') {
    failures.push('workflowOutboxContract workflowReplaySmokePath must be evidence/workflow/workflow-replay-smoke.json');
  }
  if (required.workflowOutboxContract?.workflowReplaySmokeSummaryPath !== 'evidence/workflow/workflow-replay-smoke.md') {
    failures.push('workflowOutboxContract workflowReplaySmokeSummaryPath must be evidence/workflow/workflow-replay-smoke.md');
  }
  if (required.workflowOutboxContract?.replayedWorkflows !== 7) {
    failures.push('workflowOutboxContract replayedWorkflows must be 7');
  }
  for (const capability of ['claimPending', 'markDelivered', 'markFailed', 'retryBackoff', 'dead_letter', 'manualReplay']) {
    if (!required.workflowOutboxContract?.compatibilityDeliveryCapabilities?.includes(capability)) {
      failures.push(`workflowOutboxContract missing compatibility delivery capability: ${capability}`);
    }
  }
  if (exists('evidence/workflow/workflow-outbox-contract-report.json')) {
    const workflowReport = readJson('evidence/workflow/workflow-outbox-contract-report.json');
    if (workflowReport.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Workflow + Outbox report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (workflowReport.status !== 'target-contract-not-production-runtime') {
      failures.push('Workflow + Outbox report must remain target-contract-not-production-runtime until Temporal worker proof exists');
    }
    if (workflowReport.summary?.failures !== 0) {
      failures.push('Workflow + Outbox report must have zero failures');
    }
    if (workflowReport.summary?.workflows !== 7) {
      failures.push('Workflow + Outbox report must cover 7 P0 workflows');
    }
    if (workflowReport.contractSha256 !== fileSha256('contracts/workflow/rhautt-nexus-workflow-outbox-contract.json')) {
      failures.push('Workflow + Outbox report is stale; rerun npm run guard:workflow-outbox-contract');
    }
  } else {
    failures.push('missing Workflow + Outbox contract report');
  }
  if (exists('evidence/workflow/workflow-replay-smoke.json')) {
    const workflowReplaySmoke = readJson('evidence/workflow/workflow-replay-smoke.json');
    if (workflowReplaySmoke.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Workflow replay smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (workflowReplaySmoke.status !== 'local-deterministic-replay-not-production-temporal') {
      failures.push('Workflow replay smoke must remain local-deterministic-replay-not-production-temporal');
    }
    if (workflowReplaySmoke.finalLaunchWorkflowProof !== false) {
      failures.push('Workflow replay smoke must not claim final launch workflow proof');
    }
    if (workflowReplaySmoke.summary?.workflows !== 7 || workflowReplaySmoke.summary?.failed !== 0) {
      failures.push('Workflow replay smoke must cover 7 workflows with zero failures');
    }
    if (workflowReplaySmoke.summary?.replayedEvents < 7) {
      failures.push('Workflow replay smoke must replay at least one event per workflow');
    }
    if (workflowReplaySmoke.summary?.lifecycleHandoffOnlyBoundary !== true) {
      failures.push('Workflow replay smoke must preserve lifecycle_handoff_only boundary');
    }
    if (workflowReplaySmoke.contractSha256 !== fileSha256('contracts/workflow/rhautt-nexus-workflow-outbox-contract.json')) {
      failures.push('Workflow replay smoke report is stale; rerun npm run release:workflow-replay:smoke');
    }
  } else {
    failures.push('missing Workflow replay smoke report');
  }
  if (!['missing-runtime-run', 'runtime-unreachable', 'runtime-reachable-worker-missing', 'passed-runtime-current-run'].includes(required.temporalRuntimeSmoke?.status)) {
    failures.push('temporalRuntimeSmoke evidence status must be missing-runtime-run, runtime-unreachable, runtime-reachable-worker-missing, or passed-runtime-current-run');
  }
  if (required.temporalRuntimeSmoke?.command !== 'TEMPORAL_ADDRESS=<temporal-address> npm run release:temporal-runtime:smoke') {
    failures.push('temporalRuntimeSmoke evidence command must document TEMPORAL_ADDRESS launch gate');
  }
  if (required.temporalRuntimeSmoke?.path !== 'evidence/workflow/temporal-runtime-smoke.json') {
    failures.push('temporalRuntimeSmoke evidence path must be evidence/workflow/temporal-runtime-smoke.json');
  }
  if (required.temporalRuntimeSmoke?.summaryPath !== 'evidence/workflow/temporal-runtime-smoke.md') {
    failures.push('temporalRuntimeSmoke evidence summaryPath must be evidence/workflow/temporal-runtime-smoke.md');
  }
  if (required.temporalRuntimeSmoke?.contractPath !== 'contracts/workflow/rhautt-nexus-workflow-outbox-contract.json') {
    failures.push('temporalRuntimeSmoke contractPath must be contracts/workflow/rhautt-nexus-workflow-outbox-contract.json');
  }
  for (const capability of [
    'temporalAddressConfigured',
    'temporalCliAvailable',
    'namespaceReachable',
    'taskQueueDeclared',
    'workerProofEnvValidated',
    'workerProofIdentifiersHashed',
    'workflowExecutionDescribed',
    'workerRuntimeProofRequired',
    'lifecycle_handoff_only'
  ]) {
    if (!required.temporalRuntimeSmoke?.capabilities?.includes(capability)) {
      failures.push(`temporalRuntimeSmoke missing capability: ${capability}`);
    }
  }
  if (exists('evidence/workflow/temporal-runtime-smoke.json')) {
    const temporalSmoke = readJson('evidence/workflow/temporal-runtime-smoke.json');
    if (temporalSmoke.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Temporal runtime smoke report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (temporalSmoke.contractSha256 !== fileSha256('contracts/workflow/rhautt-nexus-workflow-outbox-contract.json')) {
      failures.push('Temporal runtime smoke report is stale; rerun npm run release:temporal-runtime:smoke');
    }
    if (temporalSmoke.status === 'passed-runtime-current-run') {
      if (temporalSmoke.finalLaunchWorkflowProof !== true || temporalSmoke.temporalRuntime !== true || temporalSmoke.workerRuntimeProof !== true) {
        failures.push('passed Temporal runtime smoke must prove Temporal runtime and worker runtime');
      }
      if (temporalSmoke.workerProof?.status !== 'passed') {
        failures.push('passed Temporal runtime smoke must include passed workerProof');
      }
      if (temporalSmoke.workerProof?.mode !== 'passed') {
        failures.push('passed Temporal runtime smoke workerProof mode must be passed');
      }
      if (temporalSmoke.workerProof?.workflowType !== 'rysnova-bim-customer-signoff-workflow') {
        failures.push('passed Temporal runtime smoke workerProof workflowType must be rysnova-bim-customer-signoff-workflow');
      }
      if (temporalSmoke.workerProof?.eventType !== 'rysnova-bim.customer_signoff.confirmed') {
        failures.push('passed Temporal runtime smoke workerProof eventType must prove Rysnova customer signoff confirmation');
      }
      if (temporalSmoke.workerProof?.taskQueue !== temporalSmoke.taskQueue) {
        failures.push('passed Temporal runtime smoke workerProof taskQueue must match report taskQueue');
      }
      if (temporalSmoke.workerProof?.workflowDescribe?.passed !== true) {
        failures.push('passed Temporal runtime smoke must prove Temporal workflow describe');
      }
      if (!temporalSmoke.workerProof?.tenantSha256 || !temporalSmoke.workerProof?.projectSha256) {
        failures.push('passed Temporal runtime smoke must carry hashed tenant/project scope proof');
      }
      if (required.temporalRuntimeSmoke?.finalLaunchWorkflowProof !== true || required.temporalRuntimeSmoke?.workerRuntimeProof !== true) {
        failures.push('release evidence temporalRuntimeSmoke must mark final workflow proof true only after runtime pass');
      }
    } else {
      if (temporalSmoke.finalLaunchWorkflowProof !== false || required.temporalRuntimeSmoke?.finalLaunchWorkflowProof !== false) {
        failures.push('missing/incomplete Temporal runtime smoke must not claim final launch workflow proof');
      }
      if (temporalSmoke.workerRuntimeProof !== false || required.temporalRuntimeSmoke?.workerRuntimeProof !== false) {
        failures.push('missing/incomplete Temporal runtime smoke must not claim worker runtime proof');
      }
    }
    if (temporalSmoke.status === 'missing-runtime-run' && !String(temporalSmoke.reason || '').includes('TEMPORAL_ADDRESS') && !String(temporalSmoke.reason || '').includes('temporal CLI')) {
      failures.push('missing Temporal runtime smoke report must explain TEMPORAL_ADDRESS or temporal CLI blocker');
    }
    if (temporalSmoke.workerProof?.rawIdentifiersPersisted !== false) {
      failures.push('Temporal runtime smoke must never persist raw worker proof identifiers');
    }
  } else {
    failures.push('missing Temporal runtime smoke report');
  }
  if (exists('scripts/release/temporal-runtime-smoke.js')) {
    const temporalSmokeScript = read('scripts/release/temporal-runtime-smoke.js');
    for (const token of [
      'TEMPORAL_ADDRESS',
      'temporal',
      'TEMPORAL_TASK_QUEUE',
      'TEMPORAL_WORKER_PROOF',
      'TEMPORAL_WORKER_PROOF_WORKFLOW_ID',
      'TEMPORAL_WORKER_PROOF_RUN_ID',
      'TEMPORAL_WORKER_PROOF_TASK_QUEUE',
      'TEMPORAL_WORKER_PROOF_WORKFLOW_TYPE',
      'TEMPORAL_WORKER_PROOF_EVENT_TYPE',
      'workerProofIdentifiersHashed',
      'workflowExecutionDescribed',
      'workerRuntimeProof',
      'finalLaunchWorkflowProof',
      'rysnova-bim.customer_signoff.confirmed',
      'rysnovaBimCustomerSignoffConfirmedWorkerProof',
      'lifecycle_handoff_only',
      'validateTemporalRuntimeEnv',
      'semanticFailures',
      'invalidEnv'
    ]) {
      if (!temporalSmokeScript.includes(token)) failures.push(`Temporal runtime smoke script missing token: ${token}`);
    }
  }
  if (required.targetArchitectureContract?.status !== 'target-contract-guarded') {
    failures.push('targetArchitectureContract evidence must be target-contract-guarded');
  }
  if (required.targetArchitectureContract?.command !== 'npm run guard:target-architecture') {
    failures.push('targetArchitectureContract evidence command must be npm run guard:target-architecture');
  }
  if (required.targetArchitectureContract?.path !== 'evidence/architecture/target-architecture-contract-report.json') {
    failures.push('targetArchitectureContract evidence path must be evidence/architecture/target-architecture-contract-report.json');
  }
  if (required.targetArchitectureContract?.summaryPath !== 'evidence/architecture/target-architecture-contract-report.md') {
    failures.push('targetArchitectureContract evidence summaryPath must be evidence/architecture/target-architecture-contract-report.md');
  }
  if (required.targetArchitectureContract?.contractPath !== 'contracts/architecture/rhautt-nexus-target-architecture.json') {
    failures.push('targetArchitectureContract contractPath must be contracts/architecture/rhautt-nexus-target-architecture.json');
  }
  if (required.targetArchitectureContract?.finalLaunchArchitectureProof !== false) {
    failures.push('targetArchitectureContract must not claim final launch architecture proof');
  }
  if (required.targetArchitectureContract?.scaffoldProof !== true) {
    failures.push('targetArchitectureContract must record scaffoldProof true after nx/services scaffold exists');
  }
  if (required.targetArchitectureContract?.frontendApps !== 6) {
    failures.push('targetArchitectureContract must record 6 target frontend apps');
  }
  if (required.targetArchitectureContract?.frontendPackages !== 4) {
    failures.push('targetArchitectureContract must record 4 target frontend packages');
  }
  if (required.targetArchitectureContract?.backendModules !== 15) {
    failures.push('targetArchitectureContract must record 15 target backend modules');
  }
  for (const app of ['public-portal', 'consumer-diagnosis', 'customer-portal', 'dealer-workbench', 'designer-workbench', 'rysnova-bim-workbench']) {
    if (!required.targetArchitectureContract?.apps?.includes(app)) {
      failures.push(`targetArchitectureContract missing app: ${app}`);
    }
  }
  for (const moduleName of ['auth', 'tenant', 'crm', 'diagnosis', 'product-catalog', 'quote', 'design', 'rysnova-bim', 'delivery', 'lifecycle', 'analytics', 'governance', 'file-artifact', 'notification', 'workflow']) {
    if (!required.targetArchitectureContract?.backendModuleNames?.includes(moduleName)) {
      failures.push(`targetArchitectureContract missing backend module: ${moduleName}`);
    }
  }
  if (exists('evidence/architecture/target-architecture-contract-report.json')) {
    const architectureReport = readJson('evidence/architecture/target-architecture-contract-report.json');
    if (architectureReport.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Target architecture report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (architectureReport.status !== 'target-contract-not-production-trunk') {
      failures.push('Target architecture report must remain target-contract-not-production-trunk until real Nx/Nest trunk exists');
    }
    if (architectureReport.summary?.failures !== 0) {
      failures.push('Target architecture report must have zero failures');
    }
    if (architectureReport.summary?.scaffoldProof !== true) {
      failures.push('Target architecture report must record scaffoldProof true');
    }
    if (architectureReport.summary?.finalLaunchArchitectureProof !== false) {
      failures.push('Target architecture report must not claim final launch architecture proof');
    }
    if (architectureReport.summary?.frontendApps !== required.targetArchitectureContract?.frontendApps) {
      failures.push('targetArchitectureContract frontendApps must match architecture report');
    }
    if (architectureReport.summary?.frontendPackages !== required.targetArchitectureContract?.frontendPackages) {
      failures.push('targetArchitectureContract frontendPackages must match architecture report');
    }
    if (architectureReport.summary?.backendModules !== required.targetArchitectureContract?.backendModules) {
      failures.push('targetArchitectureContract backendModules must match architecture report');
    }
    if (architectureReport.contractSha256 !== fileSha256('contracts/architecture/rhautt-nexus-target-architecture.json')) {
      failures.push('Target architecture report is stale; rerun npm run guard:target-architecture');
    }
  } else {
    failures.push('missing target architecture contract report');
  }
  if (required.targetDependencyReadiness?.command !== 'npm run guard:target-dependencies') {
    failures.push('targetDependencyReadiness evidence command must be npm run guard:target-dependencies');
  }
  if (!['target-dependencies-ready', 'missing-target-dependencies'].includes(required.targetDependencyReadiness?.status)) {
    failures.push('targetDependencyReadiness evidence status must be target-dependencies-ready or missing-target-dependencies');
  }
  if (required.targetDependencyReadiness?.path !== 'evidence/architecture/target-dependency-readiness-report.json') {
    failures.push('targetDependencyReadiness evidence path must be evidence/architecture/target-dependency-readiness-report.json');
  }
  if (required.targetDependencyReadiness?.summaryPath !== 'evidence/architecture/target-dependency-readiness-report.md') {
    failures.push('targetDependencyReadiness evidence summaryPath must be evidence/architecture/target-dependency-readiness-report.md');
  }
  if (required.targetDependencyReadiness?.finalLaunchArchitectureProof !== false) {
    failures.push('targetDependencyReadiness must not claim final launch architecture proof');
  }
  if (exists('evidence/architecture/target-dependency-readiness-report.json')) {
    const dependencyReport = readJson('evidence/architecture/target-dependency-readiness-report.json');
    if (dependencyReport.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Target dependency readiness report platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (dependencyReport.status !== required.targetDependencyReadiness?.status) {
      failures.push('targetDependencyReadiness status must match dependency readiness report');
    }
    if (dependencyReport.summary?.failures !== 0) {
      failures.push('Target dependency readiness report must have zero failures');
    }
    if (dependencyReport.finalLaunchArchitectureProof !== false) {
      failures.push('Target dependency readiness report must not claim final launch architecture proof');
    }
    if (dependencyReport.bootProofEligible !== required.targetDependencyReadiness?.bootProofEligible) {
      failures.push('targetDependencyReadiness bootProofEligible must match dependency readiness report');
    }
    if (JSON.stringify(dependencyReport.summary?.missingLockfile || []) !== JSON.stringify(required.targetDependencyReadiness?.missingLockfile || [])) {
      failures.push('targetDependencyReadiness missingLockfile must match dependency readiness report');
    }
    if (JSON.stringify(dependencyReport.summary?.missingNodeModules || []) !== JSON.stringify(required.targetDependencyReadiness?.missingNodeModules || [])) {
      failures.push('targetDependencyReadiness missingNodeModules must match dependency readiness report');
    }
    for (const dependency of ['next', 'nx', '@nestjs/core', '@nestjs/common', '@nestjs/platform-fastify', 'fastify', 'reflect-metadata', 'rxjs']) {
      if (!dependencyReport.dependencies?.some(item => item.name === dependency)) {
        failures.push(`Target dependency readiness report missing dependency: ${dependency}`);
      }
      if (!required.targetDependencyReadiness?.required?.includes(dependency)) {
        failures.push(`targetDependencyReadiness release evidence missing dependency: ${dependency}`);
      }
    }
  } else {
    failures.push('missing target dependency readiness report');
  }
  if (required.productModuleStandaloneSmoke?.command !== 'npm run release:product-modules:standalone-smoke') {
    failures.push('productModuleStandaloneSmoke evidence command must be npm run release:product-modules:standalone-smoke');
  }
  if (required.productModuleStandaloneSmoke?.path !== 'evidence/architecture/product-module-standalone-smoke.json') {
    failures.push('productModuleStandaloneSmoke evidence path must be evidence/architecture/product-module-standalone-smoke.json');
  }
  if (required.productModuleStandaloneSmoke?.summaryPath !== 'evidence/architecture/product-module-standalone-smoke.md') {
    failures.push('productModuleStandaloneSmoke evidence summaryPath must be evidence/architecture/product-module-standalone-smoke.md');
  }
  if (required.productModuleStandaloneSmoke?.contractPath !== 'contracts/product-modules/rysnova-rysnova-bim-module-boundary.json') {
    failures.push('productModuleStandaloneSmoke contractPath must be contracts/product-modules/rysnova-rysnova-bim-module-boundary.json');
  }
  if (required.productModuleStandaloneSmoke?.targetArchitecturePath !== 'contracts/architecture/rhautt-nexus-target-architecture.json') {
    failures.push('productModuleStandaloneSmoke targetArchitecturePath must be contracts/architecture/rhautt-nexus-target-architecture.json');
  }
  if (!['local-inprocess-standalone-smoke', 'passed-external-current-run'].includes(required.productModuleStandaloneSmoke?.status)) {
    failures.push('productModuleStandaloneSmoke status must be local-inprocess-standalone-smoke or passed-external-current-run');
  }
  if (exists('evidence/architecture/product-module-standalone-smoke.json')) {
    const standaloneSmoke = readJson('evidence/architecture/product-module-standalone-smoke.json');
    if (standaloneSmoke.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Product module standalone smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (standaloneSmoke.status !== required.productModuleStandaloneSmoke?.status) {
      failures.push('productModuleStandaloneSmoke status must match smoke report');
    }
    if (standaloneSmoke.summary?.failed !== 0) {
      failures.push('Product module standalone smoke report must have zero failed checks');
    }
    if (standaloneSmoke.summary?.inProcessAliasProof !== true) {
      failures.push('Product module standalone smoke must prove in-process aliases');
    }
    if (standaloneSmoke.summary?.standaloneAppProof !== true) {
      failures.push('Product module standalone smoke must prove local standalone app composition');
    }
    if (standaloneSmoke.summary?.metadataProof !== true) {
      failures.push('Product module standalone smoke must prove target-app metadata');
    }
    if (standaloneSmoke.status === 'local-inprocess-standalone-smoke') {
      if (standaloneSmoke.finalLaunchStandaloneProof !== false || standaloneSmoke.standaloneDomainProof !== false) {
        failures.push('local product-module standalone smoke must not claim final standalone launch proof');
      }
      if (required.productModuleStandaloneSmoke?.finalLaunchStandaloneProof !== false || required.productModuleStandaloneSmoke?.standaloneDomainProof !== false) {
        failures.push('release evidence local product-module standalone smoke must not claim final standalone launch proof');
      }
    }
    if (standaloneSmoke.status === 'passed-external-current-run') {
      if (standaloneSmoke.finalLaunchStandaloneProof !== true || standaloneSmoke.standaloneDomainProof !== true) {
        failures.push('external product-module standalone smoke must prove finalLaunchStandaloneProof and standaloneDomainProof');
      }
    }
    const moduleSpecs = {
      'rysnova-consumer-system': {
        targetApp: 'apps/consumer-diagnosis',
        embeddedEntry: '/pain-diagnosis.html',
        aliases: ['/rysnova', '/rysnova-ai', '/rysnova-diagnosis'],
        moduleNamespace: 'rysnova',
        dataNamespace: 'rysnova',
        apiNamespace: '/api/v2/diagnosis'
      },
      'rysnova-bim-engineering-support': {
        targetApp: 'apps/rysnova-bim-workbench',
        embeddedEntry: '/rysnova-bim-designer.html',
        aliases: ['/rysnova-bim', '/rysnova-bim-bim', '/rysnova-bim-workbench'],
        moduleNamespace: 'rysnova-bim',
        dataNamespace: 'rysnova-bim',
        apiNamespace: '/api/v2/rysnova-bim'
      }
    };
    const smokeModules = new Map((standaloneSmoke.modules || []).map(module => [module.id, module]));
    const releaseModules = new Map((required.productModuleStandaloneSmoke?.modules || []).map(module => [module.id, module]));
    for (const [id, spec] of Object.entries(moduleSpecs)) {
      const module = smokeModules.get(id);
      const releaseModule = releaseModules.get(id);
      if (!module) {
        failures.push(`Product module standalone smoke missing module: ${id}`);
        continue;
      }
      if (!releaseModule) failures.push(`productModuleStandaloneSmoke release evidence missing module: ${id}`);
      for (const [key, expected] of Object.entries({
        targetApp: spec.targetApp,
        embeddedEntry: spec.embeddedEntry,
        moduleNamespace: spec.moduleNamespace,
        dataNamespace: spec.dataNamespace,
        apiNamespace: spec.apiNamespace
      })) {
        if (module[key] !== expected) failures.push(`Product module standalone smoke ${id}.${key} must be ${expected}`);
        if (releaseModule && releaseModule[key] !== expected) failures.push(`productModuleStandaloneSmoke release ${id}.${key} must be ${expected}`);
      }
      for (const alias of spec.aliases) {
        if (!module.aliases?.includes(alias)) failures.push(`Product module standalone smoke ${id} missing alias: ${alias}`);
        if (releaseModule && !releaseModule.aliases?.includes(alias)) failures.push(`productModuleStandaloneSmoke release ${id} missing alias: ${alias}`);
        if (!module.inProcessAliases?.some(item => item.routePath === alias && item.passed === true)) {
          failures.push(`Product module standalone smoke ${id} missing passed in-process alias proof: ${alias}`);
        }
        if (!module.standaloneAppRoutes?.some(item => item.routePath === alias && item.passed === true)) {
          failures.push(`Product module standalone smoke ${id} missing passed standalone app alias proof: ${alias}`);
        }
      }
      for (const routePath of ['/', '/index.html', spec.embeddedEntry, '/health', '/module-meta', `${spec.apiNamespace}/health`, `${spec.apiNamespace}/module-meta`]) {
        if (!module.standaloneAppRoutes?.some(item => item.routePath === routePath && item.passed === true)) {
          failures.push(`Product module standalone smoke ${id} missing passed standalone app route proof: ${routePath}`);
        }
      }
      if (module.passed !== true) failures.push(`Product module standalone smoke ${id} must pass`);
    }
  } else {
    failures.push('missing product module standalone smoke report');
  }
  if (required.targetApiBootSmoke?.command !== 'npm run release:target-api:boot-smoke') {
    failures.push('targetApiBootSmoke evidence command must be npm run release:target-api:boot-smoke');
  }
  if (required.targetApiBootSmoke?.path !== 'evidence/architecture/target-api-boot-smoke.json') {
    failures.push('targetApiBootSmoke evidence path must be evidence/architecture/target-api-boot-smoke.json');
  }
  if (required.targetApiBootSmoke?.summaryPath !== 'evidence/architecture/target-api-boot-smoke.md') {
    failures.push('targetApiBootSmoke evidence summaryPath must be evidence/architecture/target-api-boot-smoke.md');
  }
  if (required.targetApiBootSmoke?.serviceEntry !== 'services/api/src/main.ts') {
    failures.push('targetApiBootSmoke serviceEntry must be services/api/src/main.ts');
  }
  if (required.targetApiBootSmoke?.serviceModule !== 'services/api/src/modules/app.module.ts') {
    failures.push('targetApiBootSmoke serviceModule must be services/api/src/modules/app.module.ts');
  }
  if (required.targetApiBootSmoke?.healthController !== 'services/api/src/modules/health.controller.ts') {
    failures.push('targetApiBootSmoke healthController must be services/api/src/modules/health.controller.ts');
  }
  if (required.targetApiBootSmoke?.serviceTsconfig !== 'services/api/tsconfig.json') {
    failures.push('targetApiBootSmoke serviceTsconfig must be services/api/tsconfig.json');
  }
  if (required.targetApiBootSmoke?.sourceContractProof !== true) {
    failures.push('targetApiBootSmoke must prove NestJS/Fastify source contract');
  }
  if (required.targetApiBootSmoke?.finalLaunchArchitectureProof !== false) {
    failures.push('targetApiBootSmoke must not claim final launch architecture proof');
  }
  if (exists('evidence/architecture/target-api-boot-smoke.json')) {
    const apiBootSmoke = readJson('evidence/architecture/target-api-boot-smoke.json');
    if (apiBootSmoke.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('Target API boot smoke platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (apiBootSmoke.status !== required.targetApiBootSmoke?.status) {
      failures.push('targetApiBootSmoke status must match smoke report');
    }
    if (apiBootSmoke.bootProofEligible !== required.targetApiBootSmoke?.bootProofEligible) {
      failures.push('targetApiBootSmoke bootProofEligible must match smoke report');
    }
    if (apiBootSmoke.nestFastifyBootProof !== required.targetApiBootSmoke?.nestFastifyBootProof) {
      failures.push('targetApiBootSmoke nestFastifyBootProof must match smoke report');
    }
    if (JSON.stringify(apiBootSmoke.missingLockfile || []) !== JSON.stringify(required.targetApiBootSmoke?.missingLockfile || [])) {
      failures.push('targetApiBootSmoke missingLockfile must match smoke report');
    }
    if (JSON.stringify(apiBootSmoke.missingInstalled || []) !== JSON.stringify(required.targetApiBootSmoke?.missingInstalled || [])) {
      failures.push('targetApiBootSmoke missingInstalled must match smoke report');
    }
    if (apiBootSmoke.sourceContractProof !== true || required.targetApiBootSmoke?.sourceContractProof !== true) {
      failures.push('target API boot smoke must prove sourceContractProof in report and release evidence');
    }
    if (apiBootSmoke.sourceContract?.checks?.some(item => item.passed !== true)) {
      failures.push('target API boot smoke source contract checks must all pass');
    }
    if (apiBootSmoke.finalLaunchArchitectureProof !== false) {
      failures.push('target API boot smoke must not claim final launch architecture proof');
    }
    if (apiBootSmoke.status === 'passed-runtime-boot-smoke-current-run') {
      if (apiBootSmoke.bootProofEligible !== true || apiBootSmoke.nestFastifyBootProof !== true) {
        failures.push('passed target API boot smoke must prove bootProofEligible and nestFastifyBootProof');
      }
      const boot = apiBootSmoke.runtimeBootSmoke || {};
      if (boot.enabled !== true || boot.passed !== true || boot.appCreated !== true || boot.appInitialized !== true) {
        failures.push('passed target API boot smoke must create and initialize the Nest/Fastify application');
      }
      if (boot.mode !== 'target-api-boot-smoke-no-database' || boot.databaseSkippedForBootSmoke !== true || boot.postgresRuntimeProof !== false) {
        failures.push('target API boot smoke must be explicit no-database smoke and must not claim PostgreSQL runtime proof');
      }
      if (boot.adapterType !== 'fastify' || boot.healthRoutePassed !== true || boot.routeProbe?.path !== '/api/v2/health') {
        failures.push('target API boot smoke must prove Fastify adapter and /api/v2/health route');
      }
      if (boot.rysnovaBimBoundaryRoutePassed !== true || boot.rysnovaBimBoundaryProbe?.path !== '/api/v2/rysnova-bim/boundary') {
        failures.push('target API boot smoke must prove Rysnova boundary route /api/v2/rysnova-bim/boundary');
      }
      if (
        boot.rysnovaBimBoundaryProbe?.tenantScope !== true ||
        boot.rysnovaBimBoundaryProbe?.auditLog !== true ||
        boot.rysnovaBimBoundaryProbe?.openApiContract !== true
      ) {
        failures.push('target API boot smoke Rysnova boundary must prove tenantScope, auditLog, and OpenAPI contract requirements');
      }
      if (
        boot.rysnovaBimCustomerPackageAuthStatusCode !== 401 ||
        boot.rysnovaBimCustomerPackageAuthPassed !== true ||
        boot.rysnovaBimCustomerPackageAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/customer-package'
      ) {
        failures.push('target API boot smoke must prove Rysnova customer-package route is mounted and bearer-token protected');
      }
      if (
        boot.rysnovaBimCustomerPackageHappyPathStatusCode !== 200 ||
        boot.rysnovaBimCustomerPackageHappyPathPassed !== true ||
        boot.rysnovaBimCustomerPackageHappyPathProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/customer-package' ||
        boot.rysnovaBimCustomerPackageHappyPathProbe?.artifactCount !== 7 ||
        boot.rysnovaBimCustomerPackageHappyPathProbe?.missingTypes?.length !== 0 ||
        boot.rysnovaBimCustomerPackageHappyPathProbe?.allCustomerVisible !== true ||
        boot.rysnovaBimCustomerPackageHappyPathProbe?.statusesApprovedOrShared !== true ||
        boot.rysnovaBimCustomerPackageHappyPathProbe?.storageIntegrityPassed !== true ||
        boot.rysnovaBimCustomerPackageHappyPathProbe?.leakedForbiddenFields?.length !== 0
      ) {
        failures.push('target API boot smoke must prove Rysnova customer-package happy path with 7 sanitized customer-visible artifacts');
      }
      if (
        boot.rysnovaBimVisualArtifactsAuthStatusCode !== 401 ||
        boot.rysnovaBimVisualArtifactsAuthPassed !== true ||
        boot.rysnovaBimVisualArtifactsAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts'
      ) {
        failures.push('target API boot smoke must prove Rysnova visual-artifacts route is mounted and bearer-token protected');
      }
      if (
        boot.rysnovaBimDeliverableArtifactsAuthStatusCode !== 401 ||
        boot.rysnovaBimDeliverableArtifactsAuthPassed !== true ||
        boot.rysnovaBimDeliverableArtifactsAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts'
      ) {
        failures.push('target API boot smoke must prove Rysnova deliverable-artifacts route is mounted and bearer-token protected');
      }
      if (
        boot.rysnovaBimDeepeningPackageAuthStatusCode !== 401 ||
        boot.rysnovaBimDeepeningPackageAuthPassed !== true ||
        boot.rysnovaBimDeepeningPackageAuthProbe?.path !== '/api/v2/rysnova-bim/projects/{projectId}/deepening-package'
      ) {
        failures.push('target API boot smoke must prove Rysnova deepening-package route is mounted and bearer-token protected');
      }
      const visual = boot.rysnovaBimVisualArtifactsHappyPathProbe || {};
      if (
        boot.rysnovaBimVisualArtifactsHappyPathStatusCode !== 201 ||
        boot.rysnovaBimVisualArtifactsHappyPathPassed !== true ||
        visual.path !== '/api/v2/rysnova-bim/projects/{projectId}/visual-artifacts' ||
        visual.authBoundary !== 'designer-bearer-token' ||
        visual.artifactCount !== 3 ||
        visual.missingTypes?.length !== 0 ||
        visual.allStorageReady !== true
      ) {
        failures.push('target API boot smoke must generate Rysnova visual artifacts for principle diagram, 2D layout, and 3D illustration');
      }
      const deliverable = boot.rysnovaBimDeliverableArtifactsHappyPathProbe || {};
      if (
        boot.rysnovaBimDeliverableArtifactsHappyPathStatusCode !== 201 ||
        boot.rysnovaBimDeliverableArtifactsHappyPathPassed !== true ||
        deliverable.path !== '/api/v2/rysnova-bim/projects/{projectId}/deliverable-artifacts' ||
        deliverable.authBoundary !== 'designer-bearer-token' ||
        deliverable.artifactCount !== 4 ||
        deliverable.missingTypes?.length !== 0 ||
        deliverable.allStorageReady !== true ||
        !['pass', 'floor_adjusted'].includes(deliverable.quoteMarginGuardStatus) ||
        deliverable.standardsPassed !== true ||
        !(deliverable.quantityPipeMeters > 0)
      ) {
        failures.push('target API boot smoke must generate Rysnova deliverable artifacts with BOM, quantity takeoff, standards check, customer report, margin guard, and quantity evidence');
      }
      const approval = boot.rysnovaBimDeepeningPackageApprovalProbe || {};
      if (
        approval.path !== '/api/v2/rysnova-bim/artifacts/{artifactId}/approval' ||
        approval.artifactCount !== 7 ||
        approval.approvedCount !== 7 ||
        approval.allShared !== true ||
        approval.allCustomerVisible !== true ||
        approval.storageIntegrityPassed !== true
      ) {
        failures.push('target API boot smoke must approve and share all 7 Rysnova deepening artifacts with storage integrity');
      }
      const deepening = boot.rysnovaBimDeepeningPackageHappyPathProbe || {};
      if (
        boot.rysnovaBimDeepeningPackageHappyPathStatusCode !== 200 ||
        boot.rysnovaBimDeepeningPackageHappyPathPassed !== true ||
        deepening.path !== '/api/v2/rysnova-bim/projects/{projectId}/deepening-package' ||
        deepening.authBoundary !== 'designer-bearer-token' ||
        deepening.handoffReady !== true ||
        deepening.status !== 'handoff-ready' ||
        deepening.missingTypes?.length !== 0 ||
        deepening.approvalMissingTypes?.length !== 0 ||
        deepening.visualReady !== true ||
        deepening.commercialReady !== true ||
        deepening.customerSignoffReady !== true ||
        deepening.storageIntegrityTodoCount !== 0 ||
        deepening.evidenceGapsCount !== 0 ||
        deepening.nextActionsCount !== 0 ||
        deepening.customerVisibleCount !== 7 ||
        !['pass', 'floor_adjusted'].includes(deepening.quoteMarginGuardStatus) ||
        !(deepening.quantityPipeMeters > 0)
      ) {
        failures.push('target API boot smoke must prove Rysnova deepening-package reaches handoff-ready with no evidence gaps');
      }
    } else if (apiBootSmoke.status === 'runtime-boot-smoke-failed') {
      failures.push(`target API boot smoke failed: ${apiBootSmoke.runtimeBootSmoke?.error || 'unknown error'}`);
    } else if (required.targetApiBootSmoke?.nestFastifyBootProof !== false) {
      failures.push('incomplete target API boot smoke must keep nestFastifyBootProof false');
    }
  } else {
    failures.push('missing target API boot smoke report');
  }
  for (const item of [
    ['sbom', 'evidence/sbom/rhautt-nexus-sbom.json', 'evidence/sbom/rhautt-nexus-sbom.md'],
    ['provenance', 'evidence/provenance/rhautt-nexus-provenance.json', 'evidence/provenance/rhautt-nexus-provenance.md'],
    ['rollback', 'evidence/rollback/rhautt-nexus-rollback-drill.json', 'evidence/rollback/rhautt-nexus-rollback-drill.md']
  ]) {
    const [key, artifactPath, summaryPath] = item;
    const record = required[key] || {};
    if (!exists(artifactPath)) failures.push(`missing release evidence artifact: ${artifactPath}`);
    if (!exists(summaryPath)) failures.push(`missing release evidence summary: ${summaryPath}`);
    if (record.status !== 'generated-current-run') {
      failures.push(`release evidence ${key} must be generated-current-run`);
    }
    if (record.path !== artifactPath) {
      failures.push(`release evidence ${key} path must be ${artifactPath}`);
    }
    if (record.summaryPath !== summaryPath) {
      failures.push(`release evidence ${key} summaryPath must be ${summaryPath}`);
    }
  }

  if (exists('evidence/sbom/rhautt-nexus-sbom.json')) {
    const sbom = readJson('evidence/sbom/rhautt-nexus-sbom.json');
    const packageJsonSha = fileSha256('package.json');
    const packageLockSha = fileSha256('package-lock.json');
    if (sbom.metadata?.component?.name !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('SBOM component must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (sbom.metadata?.hashes?.packageJsonSha256 !== packageJsonSha) {
      failures.push('SBOM package.json hash is stale; rerun npm run sbom:generate');
    }
    if (sbom.metadata?.hashes?.packageLockSha256 !== packageLockSha) {
      failures.push('SBOM package-lock.json hash is stale; rerun npm run sbom:generate');
    }
    if (!Number.isFinite(sbom.dependencySummary?.totalComponents) || sbom.dependencySummary.totalComponents < 1) {
      failures.push('SBOM must contain dependencySummary.totalComponents');
    }
    if (required.sbom?.componentCount !== sbom.dependencySummary?.totalComponents) {
      failures.push('release evidence sbom componentCount must match SBOM totalComponents');
    }
  }

  if (exists('evidence/provenance/rhautt-nexus-provenance.json')) {
    const provenance = readJson('evidence/provenance/rhautt-nexus-provenance.json');
    const subject = provenance.subject?.[0] || {};
    if (subject.name !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('provenance subject must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (subject.digest?.['package-lock-sha256'] !== fileSha256('package-lock.json')) {
      failures.push('provenance package-lock hash is stale; rerun npm run release:provenance');
    }
    const commands = provenance.predicate?.buildDefinition?.externalParameters?.commands || {};
    if (commands.guardAll !== packageJson?.scripts?.['guard:all']) {
      failures.push('provenance guardAll command must match package.json');
    }
    if (commands.productionSelfCheck !== packageJson?.scripts?.['production:self-check']) {
      failures.push('provenance productionSelfCheck command must match package.json');
    }
  }

  if (exists('evidence/rollback/rhautt-nexus-rollback-drill.json')) {
    const rollback = readJson('evidence/rollback/rhautt-nexus-rollback-drill.json');
    if (rollback.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
      failures.push('rollback drill platform must be Rhautt Nexus / 瑞合数智枢纽');
    }
    if (!rollback.rollbackObjective || rollback.rollbackObjective.rtoMinutes > 30 || rollback.rollbackObjective.rpoMinutes > 15) {
      failures.push('rollback drill must define RTO <= 30 minutes and RPO <= 15 minutes');
    }
    for (const command of [
      'npm run guard:all',
      'npm run harness:all',
      'npm run perf:capacity:inprocess',
      'npm run test:production-readiness'
    ]) {
      if (!rollback.verificationCommands?.includes(command)) {
        failures.push(`rollback drill missing verification command: ${command}`);
      }
    }
  }
}

for (const token of [
  'principle-diagram',
  'construction-drawing',
  'bim-model',
  'bom',
  'quantity-takeoff',
  'standards-check',
  'objectKey',
  'contentHash'
]) {
  if (!rysnovaBimContract.includes(token)) failures.push(`Rysnova artifact contract missing token: ${token}`);
}

for (const token of [
  'lead-created',
  'diagnosis-in-progress',
  'solution-drafted',
  'quote-approved',
  'construction-in-progress',
  'accepted',
  'lifecycle-handoff-ready',
  'lifecycle-active',
  'installedAssets',
  'handoffStatus'
]) {
  if (!lifecycleModel.includes(token)) failures.push(`customer lifecycle state model missing token: ${token}`);
}

console.log(`Delivery Goal Check: files = ${REQUIRED_FILES.length}, failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
