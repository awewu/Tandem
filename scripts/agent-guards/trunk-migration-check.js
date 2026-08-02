#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { ACTIVE_HTML_PATHS } = require('../../server/middleware/productionStaticSurfaceGuard');
const { PRODUCTION_ROUTE_CATALOG } = require('../../server/modules/productionRouteCatalog');

const REQUIRED_FILES = [
  'docs/_archive/PRODUCTION-TRUNK-REWRITE-PLAN.md',
  'docs/_archive/PROJECT-CHARTER-AND-PRD.md',
  'docs/_archive/RHAUTT-NEXUS-DEEP-INDUSTRY-ARCHITECTURE-RESEARCH-2026-06-05.md',
  'docs/_archive/RHAUTT-NEXUS-MULTI-AGENT-DEVELOPMENT-GROUP.md',
  'docs/_archive/RHAUTT-NEXUS-HARNESS-ENGINEERING-ARCHITECTURE.md',
  'docs/_archive/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md',
  'docs/_archive/RHAUTT-NEXUS-LEGACY-FUSION-LEDGER.md',
  'docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md',
  'docs/_archive/RHAUTT-NEXUS-DEVELOPMENT-GROUP-LAUNCH-BOARD.md',
  'docs/_archive/PRD-CURRENT.md',
  'docs/_archive/PRODUCT-SCOPE.md',
  'docs/_archive/RUUD-VI-RESEARCH.md',
  'docs/_archive/RUUD-COM-FULLSITE-VI-AUDIT.md',
  'docs/_archive/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md',
  'docs/_archive/PRODUCT-PORTAL-ARCHITECTURE.md',
  '.claude/agents/orchestrator-chief.md',
  '.claude/agents/prd-charter-monitor.md',
  '.claude/agents/architecture-governor.md',
  '.claude/agents/backend-platform-builder.md',
  '.claude/agents/data-platform-architect.md',
  '.claude/agents/legacy-fusion-migrator.md',
  '.claude/agents/enterprise-ai-control-architect.md',
  '.claude/agents/frontend-contract-auditor.md',
  '.claude/agents/quote-cost-governor.md',
  '.claude/agents/customer-project-lifecycle-director.md',
  '.claude/agents/hvac-standards-auditor.md',
  '.claude/agents/iot-lifecycle-architect.md',
  '.claude/agents/test-harness-builder.md',
  '.claude/agents/product-domain-critic.md',
  '.claude/agents/security-supply-chain.md',
  '.claude/agents/sre-guardian.md',
  '.claude/agents/ui-vi-director.md',
  'server/middleware/productionStaticSurfaceGuard.js',
  'server/modules/productionRouteCatalog.js',
  'server/modules/productionRouteRegistrar.js',
  'archive/legacy-ui/public/legacy-surface-manifest.json',
  'scripts/agent-guards/route-catalog-boundary-check.js',
  'scripts/agent-guards/legacy-surface-manifest-check.js',
  'scripts/agent-guards/legacy-surface-ownership-check.js',
  'scripts/agent-guards/active-navigation-check.js',
  'scripts/agent-guards/ui-vi-check.js',
  'scripts/agent-guards/ruud-vi-research-check.js',
  'scripts/agent-guards/portal-architecture-check.js',
  'scripts/agent-guards/database-schema-check.js',
  'scripts/agent-guards/workspace-size-governance-check.js'
];

const REQUIRED_PACKAGE_SCRIPTS = [
  'guard:catalog',
  'guard:legacy-surface',
  'guard:legacy-surface-ownership',
  'guard:navigation',
  'guard:ui-vi',
  'guard:ruud-vi',
  'guard:portal-architecture',
  'guard:database',
  'guard:nexus-naming',
  'guard:trunk-migration',
  'guard:production-trunk-isolation',
  'guard:workspace-size',
  'guard:all',
  'harness:all',
  'test:production-readiness',
  'perf:capacity',
  'production:self-check:sandbox'
];

const REQUIRED_ACTIVE_PAGES = [
  '/index.html',
  '/index-ready.html',
  '/pain-diagnosis.html',
  '/customer-share.html',
  '/customer-view.html',
  '/staff-portal.html',
  '/business-console.html',
  '/login.html'
];

const REQUIRED_ROUTE_DOMAINS = [
  'lifecycle-iot-front-office',
  'comfort-home-domain',
  'admin-governance',
  'platform-core'
];

const REQUIRED_RUUD_TOKENS = [
  'products',
  'commercial',
  'commercial resource center',
  'EcoNet',
  'mobile apps',
  'warranty',
  'find a contractor',
  'BIM',
  'integrated'
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function countMatches(source, pattern) {
  return (source.match(pattern) || []).length;
}

const failures = [];
const warnings = [];

for (const file of REQUIRED_FILES) {
  if (!exists(file)) failures.push(`missing required trunk file: ${file}`);
}

if (exists('package.json')) {
  const pkg = JSON.parse(read('package.json'));
  for (const scriptName of REQUIRED_PACKAGE_SCRIPTS) {
    if (!pkg.scripts || !pkg.scripts[scriptName]) {
      failures.push(`package.json missing script: ${scriptName}`);
    }
  }
  if (pkg.scripts?.['guard:all'] && !pkg.scripts['guard:all'].includes('guard:trunk-migration')) {
    failures.push('package.json guard:all must include guard:trunk-migration');
  }
  if (pkg.scripts?.['guard:all'] && !pkg.scripts['guard:all'].includes('guard:nexus-naming')) {
    failures.push('package.json guard:all must include guard:nexus-naming');
  }
  if (pkg.scripts?.['guard:all'] && !pkg.scripts['guard:all'].includes('guard:production-trunk-isolation')) {
    failures.push('package.json guard:all must include guard:production-trunk-isolation');
  }
  if (pkg.scripts?.['guard:all:nonvisual'] && !pkg.scripts['guard:all:nonvisual'].includes('guard:production-trunk-isolation')) {
    failures.push('package.json guard:all:nonvisual must include guard:production-trunk-isolation');
  }
  if (pkg.scripts?.['guard:all'] && !pkg.scripts['guard:all'].includes('guard:workspace-size')) {
    failures.push('package.json guard:all must include guard:workspace-size');
  }
  if (pkg.scripts?.['guard:all:nonvisual'] && !pkg.scripts['guard:all:nonvisual'].includes('guard:workspace-size')) {
    failures.push('package.json guard:all:nonvisual must include guard:workspace-size');
  }
  if (pkg.scripts?.['guard:all'] && !pkg.scripts['guard:all'].includes('guard:legacy-surface-ownership')) {
    failures.push('package.json guard:all must include guard:legacy-surface-ownership');
  }
  if (pkg.scripts?.['guard:all:nonvisual'] && !pkg.scripts['guard:all:nonvisual'].includes('guard:legacy-surface-ownership')) {
    failures.push('package.json guard:all:nonvisual must include guard:legacy-surface-ownership');
  }
  if (!pkg.scripts?.['production:self-check']) {
    warnings.push('package.json missing production:self-check convenience script');
  } else if (!pkg.scripts['production:self-check'].includes('perf:capacity:inprocess')) {
    failures.push('package.json production:self-check must include perf:capacity:inprocess');
  }
}

if (exists('server-production.js')) {
  const server = read('server-production.js');
  const factory = exists('server/modules/productionAppFactory.js')
    ? read('server/modules/productionAppFactory.js')
    : '';
  const compositionSource = `${server}\n${factory}`;
  const appUseCount = countMatches(server, /\bapp\.use\s*\(/g);
  if (!compositionSource.includes('registerProductionRoutes(app')) {
    failures.push('production app composition does not delegate route mounting to registerProductionRoutes');
  }
  if (!server.includes('createProductionApp')) {
    failures.push('server-production.js must delegate app composition to createProductionApp');
  }
  if (appUseCount > 8) {
    failures.push(`server-production.js has ${appUseCount} app.use calls; keep production trunk thin`);
  }
}

const routeDomains = new Set(PRODUCTION_ROUTE_CATALOG.map(group => group.domain));
for (const domain of REQUIRED_ROUTE_DOMAINS) {
  if (!routeDomains.has(domain)) failures.push(`production route catalog missing domain: ${domain}`);
}

for (const group of PRODUCTION_ROUTE_CATALOG) {
  if (!group.owner) failures.push(`${group.id}: route group missing owner`);
  if (!group.status) failures.push(`${group.id}: route group missing status`);
  for (const route of group.routes || []) {
    if (!route.id) failures.push(`${group.id}: route missing id`);
  }
}

for (const page of REQUIRED_ACTIVE_PAGES) {
  if (!ACTIVE_HTML_PATHS.has(page)) {
    failures.push(`productionStaticSurfaceGuard missing active page: ${page}`);
  }
}

if (exists('archive/legacy-ui/public/legacy-surface-manifest.json')) {
  const manifest = JSON.parse(read('archive/legacy-ui/public/legacy-surface-manifest.json'));
  const active = new Set((manifest.surfaces?.active || []).map(file => `/${path.basename(file)}`));
  for (const page of REQUIRED_ACTIVE_PAGES) {
    if (!active.has(page)) failures.push(`legacy surface manifest active bucket missing: ${page}`);
  }
  const candidateCount = manifest.surfaces?.['migration-candidate']?.length || 0;
  const archiveCount = manifest.surfaces?.archive?.length || 0;
  const inventoryCount = manifest.surfaces?.['static-inventory']?.length || 0;
  if (candidateCount + archiveCount + inventoryCount === 0) {
    failures.push('legacy surface manifest must classify non-active public HTML');
  }
}

if (exists('docs/_archive/RUUD-VI-RESEARCH.md')) {
  const research = read('docs/_archive/RUUD-VI-RESEARCH.md');
  for (const token of REQUIRED_RUUD_TOKENS) {
    if (!research.toLowerCase().includes(token.toLowerCase())) {
      failures.push(`Ruud VI research missing required evidence token: ${token}`);
    }
  }
  if (!research.includes('Evidence Gap')) {
    failures.push('Ruud VI research must explicitly record evidence gap until official full crawl exists');
  }
}

if (exists('docs/_archive/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md')) {
  const viDoc = read('docs/_archive/UI-VI-ARCHITECTURE-RHAUTT-COMFORT.md');
  if (!viDoc.includes('docs/_archive/RUUD-VI-RESEARCH.md')) {
    failures.push('UI/VI architecture doc must reference docs/_archive/RUUD-VI-RESEARCH.md');
  }
}

if (exists('docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md')) {
  const goal = read('docs/_archive/RHAUTT-NEXUS-PRODUCTION-DELIVERY-GOAL.md');
  for (const token of [
    '可上线、可扩展、可验证、可持续进化',
    'staging/network capacity',
    'SBOM',
    'SLSA provenance',
    'rollback drill',
    '105 个旧 HTML',
    'React candidate'
  ]) {
    if (!goal.includes(token)) failures.push(`production delivery goal missing token: ${token}`);
  }
}

if (exists('src/App.jsx')) {
  const app = read('src/App.jsx');
  if (app.includes('BrowserRouter') || app.includes('Routes')) {
    warnings.push('React/Vite surface still exists; keep it candidate-only until API contract gate passes');
  }
}

console.log(`Trunk Migration Check: files = ${REQUIRED_FILES.length}, routeGroups = ${PRODUCTION_ROUTE_CATALOG.length}, failures = ${failures.length}, warnings = ${warnings.length}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const warning of warnings) console.warn(`- ${warning}`);
