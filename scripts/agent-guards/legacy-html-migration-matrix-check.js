#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { moduleNamespaces } = require('../lib/apiModuleNamespaces');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OWNERSHIP_SCRIPT = 'scripts/agent-guards/legacy-surface-ownership-check.js';
const OWNERSHIP_REPORT = 'audit/legacy-surface-ownership-report.json';
const TARGET_ARCHITECTURE = 'contracts/architecture/rhautt-nexus-target-architecture.json';
const MODULE_BOUNDARY = 'services/api/src/modules/module-boundary.ts';
const REPORT_JSON = 'evidence/architecture/legacy-html-migration-matrix.json';
const REPORT_MD = 'evidence/architecture/legacy-html-migration-matrix.md';

const ALLOWED_REFERENCE_TARGETS = new Set([
  'legacy-reference-archive',
  'shared-platform-package',
  'brand-asset-package'
]);

const REQUIRED_DELETION_GATES = [
  'legacy ownership row exists',
  'target frontend app or reference bucket is assigned',
  'target API module boundary exists when API behavior is relevant',
  'replacement implementation exists in target app/module',
  'OpenAPI/generated client contract covers replacement behavior when API behavior is relevant',
  'E2E or production-readiness test covers replacement behavior',
  'browser visual evidence is current for active or replacement surfaces',
  'production navigation remains unaffected',
  'rollback note and checksum manifest exist',
  'legacy manifest, ownership report, and migration matrix are updated'
];

const DOMAIN_MATRIX = {
  'group-portal': {
    targetFrontendApps: ['public-portal'],
    targetApiModules: ['crm', 'product-catalog', 'analytics'],
    targetNamespaces: ['/api/v2/crm', '/api/v2/product-catalog', '/api/v2/analytics'],
    capability: 'group portal, company introduction, brand relationships, and public entry routing'
  },
  'brand-portal': {
    targetFrontendApps: ['public-portal', 'brand-asset-package'],
    targetApiModules: ['product-catalog', 'file-artifact'],
    targetNamespaces: ['/api/v2/product-catalog', '/api/v2/file-artifact'],
    capability: 'Rheem, Ruud, Everhot governed brand/product asset presentation'
  },
  'rysnova-diagnosis': {
    targetFrontendApps: ['consumer-diagnosis'],
    targetApiModules: ['diagnosis', 'product-catalog', 'quote', 'crm'],
    targetNamespaces: ['/api/v2/diagnosis', '/api/v2/product-catalog', '/api/v2/quote', '/api/v2/crm'],
    capability: '瑞诺瓦 AI 问诊, three-tier solution recommendation, budget, monthly payment, ROI, lead capture, and customer report'
  },
  'customer-lifecycle': {
    targetFrontendApps: ['customer-portal'],
    targetApiModules: ['crm', 'quote', 'delivery', 'lifecycle', 'notification'],
    targetNamespaces: ['/api/v2/crm', '/api/v2/quote', '/api/v2/delivery', '/api/v2/lifecycle', '/api/v2/notification'],
    capability: 'customer project portal for方案, quotation, order progress, construction, acceptance, maintenance, and IoT lifecycle handoff status'
  },
  'designer-workbench': {
    targetFrontendApps: ['designer-workbench'],
    targetApiModules: ['design', 'quote', 'product-catalog', 'file-artifact'],
    targetNamespaces: ['/api/v2/design', '/api/v2/quote', '/api/v2/product-catalog', '/api/v2/file-artifact'],
    capability: 'designer成交工作台 with 2D layout, equipment placement, BOM, quotation, and customer sharing'
  },
  rysnovaBim: {
    targetFrontendApps: ['rysnova-bim-workbench'],
    targetApiModules: ['rysnova-bim', 'design', 'quote', 'file-artifact'],
    targetNamespaces: ['/api/v2/rysnova-bim', '/api/v2/design', '/api/v2/quote', '/api/v2/file-artifact'],
    capability: 'Rysnova technical support, BIM, drawings, schematics, quantity takeoff, standards checks, and engineering handoff'
  },
  'rysnova-bim': {
    targetFrontendApps: ['rysnova-bim-workbench'],
    targetApiModules: ['rysnova-bim', 'design', 'quote', 'file-artifact'],
    targetNamespaces: ['/api/v2/rysnova-bim', '/api/v2/design', '/api/v2/quote', '/api/v2/file-artifact'],
    capability: 'Rysnova technical support, BIM, drawings, schematics, quantity takeoff, standards checks, and engineering handoff'
  },
  'business-console': {
    targetFrontendApps: ['dealer-workbench'],
    targetApiModules: ['tenant', 'analytics', 'governance', 'crm', 'quote'],
    targetNamespaces: ['/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores', '/api/v2/analytics', '/api/v2/governance', '/api/v2/crm', '/api/v2/quote'],
    capability: 'multi-tenant business console, dealer rollup, headquarters analytics, permissions, and audit'
  },
  'staff-portal': {
    targetFrontendApps: ['dealer-workbench'],
    targetApiModules: ['auth', 'tenant', 'governance', 'analytics', 'notification'],
    targetNamespaces: ['/api/v2/auth', '/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores', '/api/v2/governance', '/api/v2/analytics', '/api/v2/notification'],
    capability: 'employee entry, enterprise workbench, governance tasks, and notification center'
  },
  'auth-platform': {
    targetFrontendApps: ['dealer-workbench', 'customer-portal'],
    targetApiModules: ['auth', 'tenant'],
    targetNamespaces: ['/api/v2/auth', '/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores'],
    capability: 'tenant-aware login, RBAC, customer/staff/dealer identity boundaries'
  },
  crm: {
    targetFrontendApps: ['dealer-workbench'],
    targetApiModules: ['crm', 'tenant', 'analytics', 'notification'],
    targetNamespaces: ['/api/v2/crm', '/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores', '/api/v2/analytics', '/api/v2/notification'],
    capability: 'front-office CRM, leads, customers, opportunities, interactions, and dealer operations'
  },
  'ops-analytics': {
    targetFrontendApps: ['dealer-workbench'],
    targetApiModules: ['analytics', 'tenant', 'governance'],
    targetNamespaces: ['/api/v2/analytics', '/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores', '/api/v2/governance'],
    capability: 'headquarters analytics, dealer performance, margin, quality, and operations rollup'
  },
  delivery: {
    targetFrontendApps: ['customer-portal', 'dealer-workbench'],
    targetApiModules: ['delivery', 'workflow', 'notification', 'file-artifact'],
    targetNamespaces: ['/api/v2/delivery', '/api/v2/workflow', '/api/v2/notification', '/api/v2/file-artifact'],
    capability: 'construction workflow, schedule, contract, acceptance, material movement, and handoff'
  },
  'lifecycle-iot': {
    targetFrontendApps: ['customer-portal', 'dealer-workbench'],
    targetApiModules: ['lifecycle', 'delivery', 'notification', 'workflow'],
    targetNamespaces: ['/api/v2/lifecycle', '/api/v2/delivery', '/api/v2/notification', '/api/v2/workflow'],
    capability: 'installed assets, warranties, service tickets, predictive maintenance reference, and IoT lifecycle handoff only'
  },
  'standards-calculation': {
    targetFrontendApps: ['designer-workbench', 'rysnova-bim-workbench'],
    targetApiModules: ['design', 'product-catalog', 'quote', 'rysnova-bim'],
    targetNamespaces: ['/api/v2/design', '/api/v2/product-catalog', '/api/v2/quote', '/api/v2/rysnova-bim'],
    capability: 'comfort-home load, hot water, heating, fresh air, water, air conditioning, and standard calculation support'
  },
  'quote-cost': {
    targetFrontendApps: ['designer-workbench', 'dealer-workbench'],
    targetApiModules: ['quote', 'product-catalog', 'crm', 'analytics'],
    targetNamespaces: ['/api/v2/quote', '/api/v2/product-catalog', '/api/v2/crm', '/api/v2/analytics'],
    capability: 'BOM, cost, tax, margin, promotion, approval, quotation, and signing offer'
  },
  'product-catalog': {
    targetFrontendApps: ['public-portal', 'designer-workbench', 'dealer-workbench'],
    targetApiModules: ['product-catalog', 'quote', 'file-artifact'],
    targetNamespaces: ['/api/v2/product-catalog', '/api/v2/quote', '/api/v2/file-artifact'],
    capability: 'Rheem, Ruud, Everhot SKUs, system packs, price books, and product documents'
  },
  quality: {
    targetFrontendApps: ['dealer-workbench'],
    targetApiModules: ['governance', 'analytics'],
    targetNamespaces: ['/api/v2/governance', '/api/v2/analytics'],
    capability: 'quality ledger, test harness, visual acceptance, and operational readiness evidence'
  },
  governance: {
    targetFrontendApps: ['dealer-workbench'],
    targetApiModules: ['governance', 'workflow', 'notification'],
    targetNamespaces: ['/api/v2/governance', '/api/v2/workflow', '/api/v2/notification'],
    capability: 'enterprise AI control plane, approval gates, agent progress, audit, and governance findings'
  },
  'shared-platform': {
    targetFrontendApps: ['shared-platform-package'],
    targetApiModules: ['auth', 'tenant', 'governance'],
    targetNamespaces: ['/api/v2/auth', '/api/v2/tenants', '/api/v2/dealers', '/api/v2/stores', '/api/v2/governance'],
    capability: 'shared shell, platform help, API docs, layout, and cross-app runtime contracts'
  },
  'legacy-archive': {
    targetFrontendApps: ['legacy-reference-archive'],
    targetApiModules: [],
    targetNamespaces: [],
    capability: 'historical reference only; no production navigation or runtime claim',
    apiRelevant: false
  }
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

function refreshOwnershipReport() {
  execFileSync(process.execPath, [OWNERSHIP_SCRIPT], {
    cwd: ROOT,
    stdio: 'pipe'
  });
}

function targetAppsFromArchitecture(contract) {
  return new Set((contract.frontend?.apps || []).map(app => app.id));
}

function moduleBoundaryNames() {
  const source = read(MODULE_BOUNDARY);
  const match = source.match(/export const apiModuleBoundary = \[([\s\S]*?)\] as const;/);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function phaseFor(surface) {
  if (surface.action === 'active') return 'active-compatibility-to-target-migration';
  if (surface.action === 'migrate') return 'migrate-into-target-app-and-api-module';
  if (surface.action === 'wrap') return 'wrap-behind-target-facade-before-rewrite';
  if (surface.action === 'retire') return 'retire-after-replacement-and-rollback-proof';
  return 'archive-reference-only';
}

function implementationEvidenceFor(targetFrontendApps, targetApiModules) {
  const evidence = [
    TARGET_ARCHITECTURE,
    MODULE_BOUNDARY,
    'contracts/architecture/production-route-target-module-map.json',
    'archive/legacy-ui/public/legacy-surface-manifest.json',
    'audit/legacy-surface-ownership-report.json'
  ];

  for (const app of targetFrontendApps) {
    if (ALLOWED_REFERENCE_TARGETS.has(app)) continue;
    const projectJson = `apps/${app}/project.json`;
    evidence.push(exists(projectJson) ? projectJson : `apps/${app}/package.json`);
  }

  if (targetFrontendApps.includes('shared-platform-package')) {
    evidence.push('packages/ui/project.json');
    evidence.push('packages/visual-system/project.json');
  }
  if (targetFrontendApps.includes('brand-asset-package')) {
    evidence.push('packages/visual-system/project.json');
  }

  if (targetApiModules.length) {
    evidence.push('contracts/openapi/rhautt-nexus-v2.openapi.json');
    evidence.push('packages/generated-client/src/rhauttNexusClient.ts');
  }

  return [...new Set(evidence)];
}

function buildRows(ownershipReport) {
  return ownershipReport.surfaces.map(surface => {
    const domainConfig = DOMAIN_MATRIX[surface.domain];
    const targetFrontendApps = [...(domainConfig?.targetFrontendApps || ['legacy-reference-archive'])];
    if ((surface.manifestBucket === 'archive' || surface.manifestBucket === 'static-inventory') && !targetFrontendApps.includes('legacy-reference-archive')) {
      targetFrontendApps.push('legacy-reference-archive');
    }
    const targetApiModules = domainConfig?.targetApiModules || [];
    const targetApiNamespaces = domainConfig?.targetNamespaces || targetApiModules.flatMap(moduleNamespaces);
    const apiRelevant = domainConfig?.apiRelevant === false ? false : targetApiModules.length > 0;
    const implementationEvidence = implementationEvidenceFor(targetFrontendApps, targetApiModules);
    const replacementEvidence = [...new Set([
      ...(surface.replacementEvidence || []),
      ...implementationEvidence
    ])];

    return {
      file: surface.file,
      sourceBucket: surface.manifestBucket,
      sourceDomain: surface.domain,
      ownerAgent: surface.ownerAgent,
      currentAction: surface.action,
      migrationPhase: phaseFor(surface),
      priority: surface.priority,
      targetFrontendApps,
      targetApiModules,
      targetApiNamespaces,
      apiRelevant,
      targetCapability: domainConfig?.capability || surface.targetSurface,
      targetSurface: surface.targetSurface,
      standaloneProductBoundary: surface.domain === 'rysnova-diagnosis'
        ? '瑞诺瓦 can run inside the portal or as an independent C-end product module.'
        : surface.domain === 'rysnova-bim'
          ? 'Rysnova can run inside the portal or as an independent engineering support module.'
          : null,
      replacementEvidence,
      requiredDeletionGates: REQUIRED_DELETION_GATES,
      deletionSafe: false,
      implementationComplete: false,
      runtimeReplacementProof: false,
      finalArchiveOrRetirementProof: false,
      nextAction: surface.action === 'active'
        ? 'Keep current page active while building target app replacement with visual, contract, and route proof.'
        : surface.nextAction
    };
  });
}

function validate(report, targetApps, moduleNames) {
  const failures = [];
  const warnings = [];
  const seenFiles = new Set();

  if (report.platform !== 'Rhautt Nexus / 瑞合数智枢纽') {
    failures.push('platform must be Rhautt Nexus / 瑞合数智枢纽');
  }
  if (report.status !== 'pass-matrix-contract-not-deletion-safe') {
    failures.push('status must remain pass-matrix-contract-not-deletion-safe');
  }
  if (report.deletionSafe !== false) failures.push('migration matrix must not be deletion-safe');
  if (report.runtimeReplacementProof !== false) failures.push('migration matrix must not claim runtime replacement proof');
  if (report.finalMigrationProof !== false) failures.push('migration matrix must not claim final migration proof');

  for (const token of [
    'not production implementation proof',
    'not deletion approval',
    'not Next/Nest runtime proof'
  ]) {
    if (!String(report.nonCompletionRule || '').includes(token)) {
      failures.push(`nonCompletionRule missing token: ${token}`);
    }
  }

  for (const row of report.surfaces) {
    if (seenFiles.has(row.file)) failures.push(`${row.file}: duplicate matrix row`);
    seenFiles.add(row.file);

    if (!exists(row.file)) failures.push(`${row.file}: source HTML file missing`);
    if (!row.ownerAgent) failures.push(`${row.file}: missing ownerAgent`);
    if (!DOMAIN_MATRIX[row.sourceDomain]) failures.push(`${row.file}: missing DOMAIN_MATRIX mapping for ${row.sourceDomain}`);
    if (!Array.isArray(row.targetFrontendApps) || row.targetFrontendApps.length === 0) {
      failures.push(`${row.file}: missing targetFrontendApps`);
    }
    for (const app of row.targetFrontendApps || []) {
      if (!targetApps.has(app) && !ALLOWED_REFERENCE_TARGETS.has(app)) {
        failures.push(`${row.file}: unknown target frontend app/reference ${app}`);
      }
    }
    if (row.apiRelevant && (!Array.isArray(row.targetApiModules) || row.targetApiModules.length === 0)) {
      failures.push(`${row.file}: apiRelevant row must map to targetApiModules`);
    }
    for (const moduleName of row.targetApiModules || []) {
      if (!moduleNames.has(moduleName)) failures.push(`${row.file}: unknown target API module ${moduleName}`);
      for (const namespace of moduleNamespaces(moduleName)) {
        if (!row.targetApiNamespaces.includes(namespace)) {
          failures.push(`${row.file}: missing namespace ${namespace}`);
        }
      }
    }
    if (row.sourceBucket === 'active' && row.currentAction !== 'active') {
      failures.push(`${row.file}: active source must retain active action before replacement`);
    }
    if (row.sourceBucket !== 'active' && row.currentAction === 'active') {
      failures.push(`${row.file}: non-active source cannot be active`);
    }
    if (!Array.isArray(row.requiredDeletionGates) || row.requiredDeletionGates.length !== REQUIRED_DELETION_GATES.length) {
      failures.push(`${row.file}: requiredDeletionGates incomplete`);
    }
    for (const gate of REQUIRED_DELETION_GATES) {
      if (!row.requiredDeletionGates.includes(gate)) failures.push(`${row.file}: deletion gate missing ${gate}`);
    }
    if (row.deletionSafe !== false) failures.push(`${row.file}: deletionSafe must remain false`);
    if (row.implementationComplete !== false) failures.push(`${row.file}: implementationComplete must remain false`);
    if (row.runtimeReplacementProof !== false) failures.push(`${row.file}: runtimeReplacementProof must remain false`);
    if (row.finalArchiveOrRetirementProof !== false) failures.push(`${row.file}: finalArchiveOrRetirementProof must remain false`);
    if (!Array.isArray(row.replacementEvidence) || row.replacementEvidence.length < 6) {
      failures.push(`${row.file}: replacementEvidence too weak`);
    }
    for (const evidence of row.replacementEvidence || []) {
      if (!exists(evidence)) failures.push(`${row.file}: evidence path missing ${evidence}`);
    }
  }

  if (seenFiles.size !== report.summary.totalSurfaces) {
    failures.push(`summary totalSurfaces ${report.summary.totalSurfaces} does not match unique rows ${seenFiles.size}`);
  }

  for (const app of ['public-portal', 'consumer-diagnosis', 'customer-portal', 'dealer-workbench', 'designer-workbench', 'rysnova-bim-workbench']) {
    if (!report.summary.targetFrontendApps.includes(app)) {
      warnings.push(`target app ${app} has no legacy HTML mapping`);
    }
  }

  return { failures, warnings };
}

function renderMarkdown(report) {
  const lines = [
    '# Legacy HTML Migration Matrix',
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
    `Final migration proof: ${report.finalMigrationProof}`,
    '',
    'This matrix turns retained public HTML into governed migration assets. It proves target ownership and gates; it does not prove the target Next/Nest implementation is complete.',
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Total surfaces | ${report.summary.totalSurfaces} |`,
    `| Active surfaces | ${report.summary.activeSurfaces} |`,
    `| Non-active surfaces | ${report.summary.nonActiveSurfaces} |`,
    `| Migration candidates | ${report.summary.migrationCandidates} |`,
    `| Archive/static retained | ${report.summary.archiveAndStaticRetained} |`,
    `| Target frontend apps/references | ${report.summary.targetFrontendApps.length} |`,
    `| Target API modules | ${report.summary.targetApiModules.length} |`,
    `| Failures | ${report.failures.length} |`,
    `| Warnings | ${report.warnings.length} |`,
    '',
    '## Domain Coverage',
    '',
    '| Domain | Surfaces | Target Frontend | Target API Modules |',
    '|---|---:|---|---|'
  ];

  for (const domain of report.domainCoverage) {
    lines.push(`| ${domain.domain} | ${domain.surfaces} | ${domain.targetFrontendApps.join(', ')} | ${domain.targetApiModules.join(', ') || 'none'} |`);
  }

  lines.push(
    '',
    '## Surface Matrix',
    '',
    '| File | Bucket | Domain | Owner | Phase | Target Frontend | Target API Modules |',
    '|---|---|---|---|---|---|---|'
  );
  for (const row of report.surfaces) {
    lines.push(`| ${tableCell(row.file)} | ${tableCell(row.sourceBucket)} | ${tableCell(row.sourceDomain)} | ${tableCell(row.ownerAgent)} | ${tableCell(row.migrationPhase)} | ${tableCell(row.targetFrontendApps.join(', '))} | ${tableCell(row.targetApiModules.join(', ') || 'none')} |`);
  }

  lines.push('', '## Deletion Gates', '');
  for (const gate of REQUIRED_DELETION_GATES) lines.push(`- ${gate}`);

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
  lines.push('- Legacy HTML must be migrated, wrapped, archived, or retired by target app/module, not deleted by bulk cleanup.');
  lines.push('- Active consumer surfaces remain live until replacement apps have route, contract, visual, rollback, and production-readiness evidence.');
  lines.push('- This guard is a slimming control: it prevents accidental deletion while creating a precise path to reduce repository bulk.');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const initialFailures = [];
  for (const file of [OWNERSHIP_SCRIPT, TARGET_ARCHITECTURE, MODULE_BOUNDARY]) {
    if (!exists(file)) initialFailures.push(`missing required source ${file}`);
  }
  if (initialFailures.length) {
    for (const failure of initialFailures) console.error(`- ${failure}`);
    process.exit(1);
  }

  refreshOwnershipReport();

  const ownership = readJson(OWNERSHIP_REPORT);
  const targetArchitecture = readJson(TARGET_ARCHITECTURE);
  const targetApps = targetAppsFromArchitecture(targetArchitecture);
  const moduleNames = new Set(moduleBoundaryNames());
  const surfaces = buildRows(ownership);
  const targetFrontendApps = [...new Set(surfaces.flatMap(row => row.targetFrontendApps))].sort();
  const targetApiModules = [...new Set(surfaces.flatMap(row => row.targetApiModules))].sort();
  const domainCoverage = Object.entries(surfaces.reduce((acc, row) => {
    if (!acc[row.sourceDomain]) {
      acc[row.sourceDomain] = {
        domain: row.sourceDomain,
        surfaces: 0,
        targetFrontendApps: new Set(),
        targetApiModules: new Set()
      };
    }
    acc[row.sourceDomain].surfaces += 1;
    for (const app of row.targetFrontendApps) acc[row.sourceDomain].targetFrontendApps.add(app);
    for (const moduleName of row.targetApiModules) acc[row.sourceDomain].targetApiModules.add(moduleName);
    return acc;
  }, {})).map(([, value]) => ({
    domain: value.domain,
    surfaces: value.surfaces,
    targetFrontendApps: [...value.targetFrontendApps].sort(),
    targetApiModules: [...value.targetApiModules].sort()
  })).sort((a, b) => a.domain.localeCompare(b.domain));

  const report = {
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    generatedAt: new Date().toISOString(),
    status: 'pass-matrix-contract-not-deletion-safe',
    nonCompletionRule: 'This migration matrix is not production implementation proof, not deletion approval, and not Next/Nest runtime proof.',
    sourceOwnershipReport: OWNERSHIP_REPORT,
    sourceTargetArchitecture: TARGET_ARCHITECTURE,
    deletionSafe: false,
    runtimeReplacementProof: false,
    finalMigrationProof: false,
    summary: {
      totalSurfaces: surfaces.length,
      activeSurfaces: surfaces.filter(row => row.sourceBucket === 'active').length,
      nonActiveSurfaces: surfaces.filter(row => row.sourceBucket !== 'active').length,
      migrationCandidates: surfaces.filter(row => row.sourceBucket === 'migration-candidate').length,
      archiveAndStaticRetained: surfaces.filter(row => row.sourceBucket === 'archive' || row.sourceBucket === 'static-inventory').length,
      targetFrontendApps,
      targetApiModules
    },
    requiredDeletionGates: REQUIRED_DELETION_GATES,
    domainCoverage,
    surfaces,
    failures: [],
    warnings: []
  };

  const validation = validate(report, targetApps, moduleNames);
  report.failures = validation.failures;
  report.warnings = validation.warnings;
  report.status = report.failures.length ? 'blocked-migration-matrix' : 'pass-matrix-contract-not-deletion-safe';

  const hashSource = JSON.stringify({
    sourceOwnershipReport: report.sourceOwnershipReport,
    sourceTargetArchitecture: report.sourceTargetArchitecture,
    summary: report.summary,
    domainCoverage: report.domainCoverage,
    surfaces: report.surfaces.map(row => ({
      file: row.file,
      sourceBucket: row.sourceBucket,
      sourceDomain: row.sourceDomain,
      ownerAgent: row.ownerAgent,
      currentAction: row.currentAction,
      migrationPhase: row.migrationPhase,
      targetFrontendApps: row.targetFrontendApps,
      targetApiModules: row.targetApiModules,
      targetApiNamespaces: row.targetApiNamespaces,
      deletionSafe: row.deletionSafe
    }))
  });
  report.matrixSha256 = sha256(hashSource);

  fs.mkdirSync(absolute(path.dirname(REPORT_JSON)), { recursive: true });
  fs.writeFileSync(absolute(REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(absolute(REPORT_MD), renderMarkdown(report));

  console.log(`Legacy HTML Migration Matrix: surfaces = ${surfaces.length}, targetApps = ${targetFrontendApps.length}, targetApiModules = ${targetApiModules.length}, failures = ${report.failures.length}, warnings = ${report.warnings.length}`);
  if (report.failures.length) {
    for (const failure of report.failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  for (const warning of report.warnings) console.warn(`- ${warning}`);
}

if (require.main === module) main();
