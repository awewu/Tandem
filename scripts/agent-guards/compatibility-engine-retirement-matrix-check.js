#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { moduleNamespaces, namespaceMatchesModule } = require('../lib/apiModuleNamespaces');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PRODUCT_CONSOLIDATION_HARNESS = 'audit/product-consolidation-harness.js';
const PRODUCT_CONSOLIDATION_REPORT = 'audit/product-consolidation-report.json';
const LEGACY_FUSION_REGISTRY = 'audit/legacy-fusion-registry.json';
const MODULE_BOUNDARY = 'services/api/src/modules/module-boundary.ts';
const TARGET_ARCHITECTURE = 'contracts/architecture/rhautt-nexus-target-architecture.json';
const ROUTE_TARGET_MAP = 'contracts/architecture/production-route-target-module-map.json';
const OPENAPI_CONTRACT = 'contracts/openapi/rhautt-nexus-v2.openapi.json';
const GENERATED_CLIENT = 'packages/generated-client/src/rhauttNexusClient.ts';
const REPORT_JSON = 'evidence/architecture/compatibility-engine-retirement-matrix.json';
const REPORT_MD = 'evidence/architecture/compatibility-engine-retirement-matrix.md';

const ALLOWED_ACTIONS = new Set(['migrate', 'wrap', 'archive', 'retire']);
const ALLOWED_PRIORITIES = new Set(['P0', 'P1', 'P2']);

const REQUIRED_RETIREMENT_GATES = [
  'legacy-fusion registry row exists',
  'current product-consolidation scan confirms production reference state',
  'target API module boundary exists or archival bucket is assigned',
  'domain owner accepts migration, wrap, archive, or retire action',
  'replacement implementation exists in target module or archived reference evidence exists',
  'OpenAPI/generated client covers replacement behavior when API behavior is relevant',
  'tenant isolation and audit behavior are tested when user, tenant, quote, delivery, or lifecycle data is touched',
  'production-readiness or harness test covers extracted behavior',
  'production route catalog no longer depends on the legacy engine',
  'code-size trunk report shows reachable/eager compatibility budgets remain bounded',
  'rollback note and checksum manifest name the retired engine',
  'legacy registry, engine matrix, and SBOM/provenance are refreshed'
];

const DOMAIN_MATRIX = {
  governance: {
    ownerAgent: 'enterprise-ai-control-architect',
    targetApiModules: ['governance', 'workflow', 'analytics', 'notification'],
    targetDataStores: ['postgresql', 'mongodb', 'object-storage', 'temporal-outbox'],
    capability: 'enterprise AI control plane, quality findings, approvals, agent progress, and governance audit'
  },
  quality: {
    ownerAgent: 'test-harness-builder',
    targetApiModules: ['governance', 'analytics'],
    targetDataStores: ['postgresql', 'mongodb'],
    capability: 'quality ledger, harness findings, visual acceptance, and operational readiness evidence'
  },
  crm: {
    ownerAgent: 'backend-platform-builder',
    targetApiModules: ['crm', 'tenant', 'analytics', 'notification'],
    targetDataStores: ['postgresql', 'mongodb', 'redis'],
    capability: 'front-office CRM, customers, opportunities, interactions, dealer operations, and notification hooks'
  },
  'ops-analytics': {
    ownerAgent: 'enterprise-ai-control-architect',
    targetApiModules: ['analytics', 'tenant', 'governance'],
    targetDataStores: ['postgresql', 'redis'],
    capability: 'headquarters analytics, dealer rollup, margin, quality, and operations metrics'
  },
  delivery: {
    ownerAgent: 'customer-project-lifecycle-director',
    targetApiModules: ['delivery', 'workflow', 'lifecycle', 'file-artifact'],
    targetDataStores: ['postgresql', 'mongodb', 'object-storage', 'temporal-outbox'],
    capability: 'construction workflow, milestones, material movement, acceptance, settlement, and customer-visible status'
  },
  'lifecycle-iot': {
    ownerAgent: 'iot-lifecycle-architect',
    targetApiModules: ['lifecycle', 'notification', 'workflow', 'governance'],
    targetDataStores: ['postgresql', 'mongodb', 'temporal-outbox'],
    capability: 'installed assets, warranties, service tickets, and IoT lifecycle handoff only'
  },
  rysnovaBim: {
    ownerAgent: 'solution-design-rysnova-bim-director',
    targetApiModules: ['rysnova-bim', 'design', 'file-artifact', 'quote'],
    targetDataStores: ['postgresql', 'mongodb', 'object-storage'],
    capability: 'Rysnova BIM, drawing, schematic, standards check, 3D artifact, and engineering handoff services'
  },
  'standards-calculation': {
    ownerAgent: 'hvac-standards-auditor',
    targetApiModules: ['design', 'product-catalog', 'quote', 'rysnova-bim'],
    targetDataStores: ['postgresql', 'mongodb', 'redis'],
    capability: 'comfort-home standards, heating, hot water, fresh air, water, air conditioning, and load calculation logic'
  },
  'quote-cost': {
    ownerAgent: 'quote-cost-governor',
    targetApiModules: ['quote', 'product-catalog', 'analytics'],
    targetDataStores: ['postgresql', 'mongodb', 'redis'],
    capability: 'BOM, tax, cost, margin, promotion, quotation, and signing-offer economics'
  },
  'shared-platform': {
    ownerAgent: 'architecture-governor',
    targetApiModules: ['auth', 'tenant', 'governance', 'file-artifact'],
    targetDataStores: ['postgresql', 'mongodb', 'redis', 'object-storage'],
    capability: 'shared platform shell, RBAC, cache boundary, reporting, adapter, and repository abstractions'
  },
  security: {
    ownerAgent: 'security-supply-chain',
    targetApiModules: ['auth', 'tenant', 'governance'],
    targetDataStores: ['postgresql', 'redis'],
    capability: 'security controls, PII handling, tenant boundary, cryptography policy, and audit posture'
  },
  'legacy-archive': {
    ownerAgent: 'legacy-fusion-migrator',
    targetApiModules: [],
    targetDataStores: ['external-archive'],
    capability: 'historical reference only; no production navigation, API, or runtime claim',
    apiRelevant: false,
    referenceBucket: 'legacy-engine-reference-archive'
  }
};

const DOMAIN_EVIDENCE = {
  governance: [
    'docs/_archive/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md',
    'scripts/agent-guards/ai-control-plane-check.js',
    'server/modules/governance/governance.service.js',
    'test/production-readiness/governance-agent-progress.test.js'
  ],
  quality: [
    'audit/operational-readiness-harness.js',
    'test/production-readiness/operational-readiness-harness.test.js',
    'test/production-readiness/code-size-trunk-evidence.test.js'
  ],
  crm: [
    'server/modules/crm/crm.service.js',
    'test/production-readiness/repository-and-crm.test.js',
    'test/production-readiness/analytics-service.test.js'
  ],
  'ops-analytics': [
    'server/modules/analytics/analytics.service.js',
    'test/production-readiness/analytics-service.test.js',
    'archive/legacy-ui/public/business-console.html'
  ],
  delivery: [
    'server/routes/delivery.js',
    'server/routes/workflows.js',
    'test/production-readiness/lifecycle-service.test.js'
  ],
  'lifecycle-iot': [
    'docs/_archive/LIFECYCLE-IOT-BRIDGE.md',
    'services/api/src/modules/lifecycle/lifecycle.service.ts',
    'test/production-readiness/lifecycle-service.test.js'
  ],
  rysnovaBim: [
    'docs/_archive/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md',
    'server/modules/rysnova-bim/rysnova-bim-artifact.service.js',
    'test/production-readiness/rysnova-bim-artifact-service.test.js'
  ],
  'standards-calculation': [
    'docs/_archive/COMFORT-HOME-STANDARDS-MATRIX.md',
    'server/modules/system-packs/system-packs.service.js',
    'test/production-readiness/system-packs.test.js'
  ],
  'quote-cost': [
    'server/modules/quotation/quotation.service.js',
    'test/production-readiness/quotation-v2-bom.test.js',
    'test/production-readiness/quotation-v2-persistence.test.js'
  ],
  'shared-platform': [
    'docs/_archive/RHAUTT-NEXUS-HARNESS-ENGINEERING-ARCHITECTURE.md',
    'scripts/agent-guards/redis-cache-boundary-check.js',
    'test/production-readiness/auth-service.test.js'
  ],
  security: [
    'evidence/security/tenant-isolation.md',
    'evidence/security/audit-trail.md',
    'test/production-readiness/tenant-isolation.test.js'
  ],
  'legacy-archive': [
    LEGACY_FUSION_REGISTRY,
    'audit/legacy-fusion-report.json',
    'evidence/operations/repository-bulk-retention-manifest.json'
  ]
};

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return fs.existsSync(absolute(relativePath));
}

function read(relativePath) {
  return fs.readFileSync(absolute(relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function tableCell(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '/').trim();
}

function refreshConsolidationReport() {
  execFileSync(process.execPath, [PRODUCT_CONSOLIDATION_HARNESS], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}

function moduleBoundaryNames() {
  const source = read(MODULE_BOUNDARY);
  const match = source.match(/export const apiModuleBoundary = \[([\s\S]*?)\] as const;/);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function implementationEvidenceFor(targetApiModules, domain) {
  const evidence = [
    PRODUCT_CONSOLIDATION_REPORT,
    LEGACY_FUSION_REGISTRY,
    TARGET_ARCHITECTURE,
    ROUTE_TARGET_MAP,
    MODULE_BOUNDARY,
    'audit/code-size-trunk-report.json',
    'scripts/agent-guards/code-size-trunk-check.js',
    'audit/legacy-fusion-harness.js'
  ];

  if (targetApiModules.length) {
    evidence.push(OPENAPI_CONTRACT);
    evidence.push(GENERATED_CLIENT);
  }

  for (const moduleName of targetApiModules) {
    evidence.push(`services/api/src/modules/${moduleName}/README.md`);
    evidence.push(`services/api/src/modules/${moduleName}/${moduleName}.module.ts`);
  }

  for (const item of DOMAIN_EVIDENCE[domain] || []) evidence.push(item);
  return [...new Set(evidence)];
}

function actionPhase(action) {
  if (action === 'migrate') return 'extract-algorithm-to-target-module';
  if (action === 'wrap') return 'wrap-behind-owned-facade-before-extraction';
  if (action === 'retire') return 'retire-after-replacement-and-rollback-proof';
  return 'archive-reference-only';
}

function buildRows(consolidation, registry) {
  const engineAssets = registry.engineAssets || {};
  const orphanEngines = consolidation.consolidation?.productionOrphanEngines || [];
  return orphanEngines.map(engine => {
    const entry = engineAssets[engine.file] || {};
    const domain = entry.domain || 'legacy-archive';
    const domainConfig = DOMAIN_MATRIX[domain] || DOMAIN_MATRIX['legacy-archive'];
    const targetApiModules = [...(domainConfig.targetApiModules || [])];
    const targetApiNamespaces = targetApiModules.flatMap(moduleNamespaces);
    const apiRelevant = domainConfig.apiRelevant === false ? false : targetApiModules.length > 0;
    const replacementEvidence = implementationEvidenceFor(targetApiModules, domain);
    const partialExtractionEvidence = Array.isArray(entry.partialExtractionEvidence)
      ? entry.partialExtractionEvidence
      : [];

    return {
      file: engine.file,
      name: engine.name,
      lines: engine.lines,
      productionRefs: engine.productionRefs,
      sampleRefs: engine.sampleRefs || [],
      currentState: engine.productionRefs === 0 ? 'production-orphan-inventory' : 'production-referenced-compatibility',
      registryDomain: domain,
      ownerAgent: domainConfig.ownerAgent,
      registryAction: entry.action || null,
      migrationPhase: actionPhase(entry.action || 'archive'),
      priority: entry.priority || null,
      targetCapability: entry.target || domainConfig.capability,
      extractionNextAction: entry.next || 'Retain as historical reference until owner supplies migration or archive evidence.',
      targetApiModules,
      targetApiNamespaces,
      targetDataStores: domainConfig.targetDataStores || [],
      apiRelevant,
      referenceBucket: domainConfig.referenceBucket || null,
      partialExtractionStatus: entry.partialExtractionStatus || 'not-started',
      partialExtractionEvidence,
      remainingBeforeRetirement: entry.remainingBeforeRetirement || [],
      replacementEvidence: [...new Set([
        ...replacementEvidence,
        ...partialExtractionEvidence
      ])],
      requiredRetirementGates: REQUIRED_RETIREMENT_GATES,
      deletionSafe: false,
      implementationComplete: false,
      runtimeReplacementProof: false,
      retirementProof: false
    };
  });
}

function buildResolvedRows(registry) {
  return Object.entries(registry.resolvedEngineAssets || {}).map(([file, entry]) => ({
    file,
    registryDomain: entry.domain,
    ownerAgent: DOMAIN_MATRIX[entry.domain]?.ownerAgent || registry.owners?.[entry.domain] || null,
    originalAction: entry.action,
    priority: entry.priority,
    targetCapability: entry.target,
    resolvedStatus: entry.resolvedStatus,
    resolutionNote: entry.resolutionNote,
    resolutionEvidence: entry.resolutionEvidence || [],
    deletionSafe: false
  }));
}

function validate(report, registry, moduleNames) {
  const failures = [];
  const warnings = [];
  const seen = new Set();
  const registryEngineAssets = registry.engineAssets || {};

  if (report.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  if (report.status !== 'pass-engine-retirement-matrix-not-deletion-safe') {
    failures.push('status must remain pass-engine-retirement-matrix-not-deletion-safe');
  }
  if (report.deletionSafe !== false) failures.push('matrix must not be deletion-safe');
  if (report.runtimeReplacementProof !== false) failures.push('matrix must not claim runtime replacement proof');
  if (report.finalRetirementProof !== false) failures.push('matrix must not claim final retirement proof');

  for (const token of [
    'not deletion approval',
    'not NestJS/Fastify runtime proof',
    'not implementation completion proof'
  ]) {
    if (!String(report.nonCompletionRule || '').includes(token)) {
      failures.push(`nonCompletionRule missing token: ${token}`);
    }
  }

  for (const row of report.engines) {
    if (seen.has(row.file)) failures.push(`${row.file}: duplicate engine row`);
    seen.add(row.file);

    if (!exists(row.file)) failures.push(`${row.file}: engine file missing`);
    if (!registryEngineAssets[row.file]) failures.push(`${row.file}: missing registry engine asset`);
    if (!DOMAIN_MATRIX[row.registryDomain]) failures.push(`${row.file}: unknown registry domain ${row.registryDomain}`);
    if (!row.ownerAgent) failures.push(`${row.file}: missing ownerAgent`);
    if (!ALLOWED_ACTIONS.has(row.registryAction)) failures.push(`${row.file}: invalid registryAction ${row.registryAction}`);
    if (!ALLOWED_PRIORITIES.has(row.priority)) failures.push(`${row.file}: invalid priority ${row.priority}`);
    if (!Number.isFinite(row.lines) || row.lines <= 0) failures.push(`${row.file}: invalid line count`);
    if (row.productionRefs !== 0) warnings.push(`${row.file}: productionRefs is ${row.productionRefs}; confirm it is still safe to treat as orphan inventory`);
    if (row.apiRelevant && row.targetApiModules.length === 0) failures.push(`${row.file}: apiRelevant requires targetApiModules`);
    for (const moduleName of row.targetApiModules) {
      if (!moduleNames.has(moduleName)) failures.push(`${row.file}: target module ${moduleName} is not in ${MODULE_BOUNDARY}`);
      if (!row.targetApiNamespaces.some(namespace => namespaceMatchesModule(namespace, moduleName))) {
        failures.push(`${row.file}: missing namespace /api/v2/${moduleName}`);
      }
    }
    for (const gate of REQUIRED_RETIREMENT_GATES) {
      if (!row.requiredRetirementGates.includes(gate)) failures.push(`${row.file}: missing retirement gate ${gate}`);
    }
    if (row.deletionSafe !== false) failures.push(`${row.file}: deletionSafe must be false`);
    if (row.implementationComplete !== false) failures.push(`${row.file}: implementationComplete must be false`);
    if (row.runtimeReplacementProof !== false) failures.push(`${row.file}: runtimeReplacementProof must be false`);
    if (row.retirementProof !== false) failures.push(`${row.file}: retirementProof must be false`);
    if (!Array.isArray(row.replacementEvidence) || row.replacementEvidence.length < 6) {
      failures.push(`${row.file}: replacementEvidence too weak`);
    }
    if (row.partialExtractionStatus !== 'not-started') {
      if (!String(row.partialExtractionStatus).includes('not-deletion-safe')) {
        failures.push(`${row.file}: partialExtractionStatus must remain honest about deletion safety`);
      }
      if (!Array.isArray(row.partialExtractionEvidence) || row.partialExtractionEvidence.length === 0) {
        failures.push(`${row.file}: partialExtractionStatus requires partialExtractionEvidence`);
      }
      if (!Array.isArray(row.remainingBeforeRetirement) || row.remainingBeforeRetirement.length === 0) {
        failures.push(`${row.file}: partialExtractionStatus requires remainingBeforeRetirement gates`);
      }
    }
    for (const evidence of row.replacementEvidence || []) {
      if (!exists(evidence)) failures.push(`${row.file}: evidence path missing ${evidence}`);
    }
  }

  if (seen.size !== report.summary.currentOrphanEngines) {
    failures.push(`summary currentOrphanEngines ${report.summary.currentOrphanEngines} does not match unique rows ${seen.size}`);
  }

  for (const row of report.resolvedEngines) {
    if (!row.ownerAgent) failures.push(`${row.file}: resolved row missing ownerAgent`);
    if (row.deletionSafe !== false) failures.push(`${row.file}: resolved deletionSafe must be false`);
    if (!Array.isArray(row.resolutionEvidence) || row.resolutionEvidence.length === 0) {
      failures.push(`${row.file}: missing resolutionEvidence`);
    }
    for (const evidence of row.resolutionEvidence || []) {
      if (!exists(evidence)) failures.push(`${row.file}: resolved evidence path missing ${evidence}`);
    }
  }

  return { failures, warnings };
}

function summarizeBy(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row[field] || 'missing';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function renderMarkdown(report) {
  const lines = [
    '# Compatibility Engine Retirement Matrix',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    `Matrix SHA-256: \`${report.matrixSha256}\``,
    '',
    `Deletion safe: ${report.deletionSafe}`,
    '',
    `Runtime replacement proof: ${report.runtimeReplacementProof}`,
    '',
    `Final retirement proof: ${report.finalRetirementProof}`,
    '',
    'This matrix converts orphan compatibility engines into governed migration or retirement inventory. It proves target ownership and gates; it does not prove target NestJS/Fastify implementation is complete.',
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Current orphan engines | ${report.summary.currentOrphanEngines} |`,
    `| Current orphan engine lines | ${report.summary.currentOrphanEngineLines} |`,
    `| Resolved historical engines | ${report.summary.resolvedHistoricalEngines} |`,
    `| P0 engines | ${report.summary.priorityCounts.P0 || 0} |`,
    `| P1 engines | ${report.summary.priorityCounts.P1 || 0} |`,
    `| P2 engines | ${report.summary.priorityCounts.P2 || 0} |`,
    `| Target API modules | ${report.summary.targetApiModules.length} |`,
    `| Failures | ${report.failures.length} |`,
    `| Warnings | ${report.warnings.length} |`,
    '',
    '## Domain Coverage',
    '',
    '| Domain | Engines | Lines | Target API Modules |',
    '|---|---:|---:|---|'
  ];

  for (const domain of report.domainCoverage) {
    lines.push(`| ${domain.domain} | ${domain.engines} | ${domain.lines} | ${domain.targetApiModules.join(', ') || 'none'} |`);
  }

  lines.push(
    '',
    '## Engine Matrix',
    '',
    '| Engine | Lines | Domain | Action | Priority | Target API Modules | Phase |',
    '|---|---:|---|---|---|---|---|'
  );
  for (const row of report.engines) {
    lines.push(`| ${tableCell(row.file)} | ${row.lines} | ${tableCell(row.registryDomain)} | ${tableCell(row.registryAction)} | ${tableCell(row.priority)} | ${tableCell(row.targetApiModules.join(', ') || row.referenceBucket || 'none')} | ${tableCell(row.migrationPhase)} |`);
  }

  lines.push('', '## Retirement Gates', '');
  for (const gate of REQUIRED_RETIREMENT_GATES) lines.push(`- ${gate}`);

  if (report.failures.length) {
    lines.push('', '## Failures', '');
    for (const failure of report.failures) lines.push(`- ${failure}`);
  } else {
    lines.push('', '## Failures', '', 'None.');
  }

  if (report.warnings.length) {
    lines.push('', '## Warnings', '');
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  } else {
    lines.push('', '## Warnings', '', 'None.');
  }

  lines.push('', '## Policy', '');
  lines.push('- A production-orphan engine is not deletion-safe merely because current productionRefs is zero.');
  lines.push('- Migrate and wrap actions require target module implementation, contract/client coverage, behavior tests, and rollback proof before retirement.');
  lines.push('- Archive and retire actions still require checksum, reference, SBOM/provenance refresh, and rollback notes.');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const initialFailures = [];
  for (const file of [
    PRODUCT_CONSOLIDATION_HARNESS,
    LEGACY_FUSION_REGISTRY,
    MODULE_BOUNDARY,
    TARGET_ARCHITECTURE,
    ROUTE_TARGET_MAP
  ]) {
    if (!exists(file)) initialFailures.push(`missing required source ${file}`);
  }
  if (initialFailures.length) {
    for (const failure of initialFailures) console.error(`- ${failure}`);
    process.exit(1);
  }

  refreshConsolidationReport();

  const consolidation = readJson(PRODUCT_CONSOLIDATION_REPORT);
  const registry = readJson(LEGACY_FUSION_REGISTRY);
  const moduleNames = new Set(moduleBoundaryNames());
  const engines = buildRows(consolidation, registry);
  const resolvedEngines = buildResolvedRows(registry);
  const targetApiModules = [...new Set(engines.flatMap(row => row.targetApiModules))].sort();
  const currentOrphanEngineLines = engines.reduce((sum, row) => sum + row.lines, 0);
  const domainCoverage = Object.values(engines.reduce((acc, row) => {
    acc[row.registryDomain] ||= {
      domain: row.registryDomain,
      engines: 0,
      lines: 0,
      targetApiModules: new Set()
    };
    acc[row.registryDomain].engines += 1;
    acc[row.registryDomain].lines += row.lines;
    for (const moduleName of row.targetApiModules) acc[row.registryDomain].targetApiModules.add(moduleName);
    return acc;
  }, {})).map(item => ({
    ...item,
    targetApiModules: [...item.targetApiModules].sort()
  })).sort((a, b) => b.lines - a.lines);

  const report = {
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    generatedAt: new Date().toISOString(),
    status: 'pass-engine-retirement-matrix-not-deletion-safe',
    nonCompletionRule: 'This compatibility engine retirement matrix is not deletion approval, not NestJS/Fastify runtime proof, and not implementation completion proof.',
    sourceConsolidationReport: PRODUCT_CONSOLIDATION_REPORT,
    sourceRegistry: LEGACY_FUSION_REGISTRY,
    targetModuleSource: MODULE_BOUNDARY,
    deletionSafe: false,
    runtimeReplacementProof: false,
    finalRetirementProof: false,
    summary: {
      currentOrphanEngines: engines.length,
      currentOrphanEngineLines,
      resolvedHistoricalEngines: resolvedEngines.length,
      actionCounts: summarizeBy(engines, 'registryAction'),
      priorityCounts: summarizeBy(engines, 'priority'),
      targetApiModules
    },
    requiredRetirementGates: REQUIRED_RETIREMENT_GATES,
    domainCoverage,
    engines,
    resolvedEngines,
    failures: [],
    warnings: []
  };

  const validation = validate(report, registry, moduleNames);
  report.failures = validation.failures;
  report.warnings = validation.warnings;
  report.status = report.failures.length ? 'blocked-engine-retirement-matrix' : 'pass-engine-retirement-matrix-not-deletion-safe';

  const hashSource = JSON.stringify({
    sourceConsolidationReport: report.sourceConsolidationReport,
    sourceRegistry: report.sourceRegistry,
    summary: report.summary,
    engines: report.engines.map(row => ({
      file: row.file,
      lines: row.lines,
      productionRefs: row.productionRefs,
      registryDomain: row.registryDomain,
      registryAction: row.registryAction,
      priority: row.priority,
      targetApiModules: row.targetApiModules,
      partialExtractionStatus: row.partialExtractionStatus,
      deletionSafe: row.deletionSafe
    })),
    resolvedEngines: report.resolvedEngines.map(row => ({
      file: row.file,
      resolvedStatus: row.resolvedStatus
    }))
  });
  report.matrixSha256 = sha256(hashSource);

  fs.mkdirSync(absolute(path.dirname(REPORT_JSON)), { recursive: true });
  fs.writeFileSync(absolute(REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(absolute(REPORT_MD), renderMarkdown(report));

  console.log(`Compatibility Engine Retirement Matrix: engines = ${engines.length}, lines = ${currentOrphanEngineLines}, targetApiModules = ${targetApiModules.length}, failures = ${report.failures.length}, warnings = ${report.warnings.length}`);
  if (report.failures.length) {
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  for (const warning of report.warnings) console.warn(`- ${warning}`);
}

if (require.main === module) main();
