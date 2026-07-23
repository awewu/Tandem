#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ACTIVE_HTML_PATHS } = require('../../server/middleware/productionStaticSurfaceGuard');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'archive', 'legacy-ui', 'public', 'legacy-surface-manifest.json');
const REGISTRY_PATH = path.join(ROOT, 'audit', 'legacy-fusion-registry.json');
const REPORT_JSON = path.join(ROOT, 'audit', 'legacy-surface-ownership-report.json');
const REPORT_MD = path.join(ROOT, 'audit', 'legacy-surface-ownership-report.md');

const VALID_BUCKETS = new Set(['active', 'migration-candidate', 'archive', 'static-inventory']);
const VALID_ACTIONS = new Set(['active', 'migrate', 'wrap', 'archive', 'retire']);

const DOMAIN_OWNERS = {
  'group-portal': 'prd-charter-monitor',
  'brand-portal': 'ui-vi-director',
  'rysnova-diagnosis': 'ui-vi-director',
  'customer-lifecycle': 'customer-project-lifecycle-director',
  'designer-workbench': 'solution-design-rysnova-bim-director',
  rysnovaBim: 'solution-design-rysnova-bim-director',
  'rysnova-bim': 'solution-design-rysnova-bim-director',
  'business-console': 'enterprise-ai-control-architect',
  'staff-portal': 'enterprise-ai-control-architect',
  'auth-platform': 'backend-platform-builder',
  crm: 'backend-platform-builder',
  'ops-analytics': 'enterprise-ai-control-architect',
  delivery: 'customer-project-lifecycle-director',
  'lifecycle-iot': 'iot-lifecycle-architect',
  'standards-calculation': 'hvac-standards-auditor',
  'quote-cost': 'quote-cost-governor',
  'product-catalog': 'quote-cost-governor',
  quality: 'test-harness-builder',
  governance: 'enterprise-ai-control-architect',
  'shared-platform': 'architecture-governor',
  'legacy-archive': 'legacy-fusion-migrator'
};

const DOMAIN_TARGETS = {
  'group-portal': 'apps/public-portal and active public homepage until Next.js migration',
  'brand-portal': 'Rheem/Ruud VI governed brand asset package',
  'rysnova-diagnosis': 'apps/consumer-diagnosis and active pain diagnosis flow',
  'customer-lifecycle': 'customer project portal and lifecycle handoff module',
  'designer-workbench': 'designer成交工作台 and solution design package',
  rysnovaBim: 'Rysnova technical support, BIM, drawing, and artifact module',
  'rysnova-bim': 'Rysnova technical support, BIM, drawing, and artifact module',
  'business-console': 'business console, HQ analytics, and dealer rollup module',
  'staff-portal': 'employee portal and enterprise workbench module',
  'auth-platform': 'tenant-aware auth and RBAC platform module',
  crm: 'CRM/front-office module',
  'ops-analytics': 'HQ/dealer operations analytics module',
  delivery: 'delivery, construction, workflow, and acceptance module',
  'lifecycle-iot': 'customer lifecycle and IoT handoff module',
  'standards-calculation': 'comfort-home standards and calculation module',
  'quote-cost': 'quote, BOM, cost, margin, and approval module',
  'product-catalog': 'product catalog, price book, and system pack module',
  quality: 'test harness, quality ledger, and visual acceptance module',
  governance: 'enterprise AI control and governance module',
  'shared-platform': 'shared platform package or common runtime module',
  'legacy-archive': 'legacy reference archive outside production navigation'
};

const DOMAIN_EVIDENCE = {
  'group-portal': ['docs/_archive/PRODUCT-PORTAL-ARCHITECTURE.md', 'scripts/agent-guards/portal-architecture-check.js'],
  'brand-portal': ['docs/_archive/RUUD-VI-RESEARCH.md', 'scripts/agent-guards/rheem-vi-production-audit.js'],
  'rysnova-diagnosis': ['docs/_archive/RUINUOWA-AI-DIAGNOSIS-C-END-UI-VI-ARCHITECTURE.md', 'scripts/agent-guards/rysnova-diagnosis-cend-ui-vi-check.js'],
  'customer-lifecycle': ['docs/RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md', 'services/api/src/modules/lifecycle/lifecycle.service.ts'],
  'designer-workbench': ['docs/_archive/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md', 'server/modules/solution-visuals/solution-visual-package.service.js'],
  rysnovaBim: ['docs/_archive/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md', 'server/modules/rysnova-bim/rysnova-bim-artifact.service.js'],
  'rysnova-bim': ['docs/_archive/RHAUTT-NEXUS-RYSNOVA-ARTIFACT-CONTRACT.md', 'server/modules/rysnova-bim/rysnova-bim-artifact.service.js'],
  'business-console': ['docs/_archive/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md', 'server/modules/governance/governance.service.js'],
  'staff-portal': ['docs/_archive/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md', 'archive/legacy-ui/public/staff-portal.html'],
  'auth-platform': ['database/postgres/migrations/001_rhautt_nexus_core_ledger.sql', 'services/api/src/modules/auth/auth.service.ts'],
  crm: ['server/modules/crm/crm.service.js', 'test/production-readiness/repository-and-crm.test.js'],
  'ops-analytics': ['server/modules/analytics/analytics.service.js', 'test/production-readiness/analytics-service.test.js'],
  delivery: ['server/routes/delivery.js', 'server/routes/workflows.js', 'test/production-readiness/lifecycle-service.test.js'],
  'lifecycle-iot': ['docs/_archive/LIFECYCLE-IOT-BRIDGE.md', 'services/api/src/modules/lifecycle/lifecycle.service.ts'],
  'standards-calculation': ['docs/_archive/COMFORT-HOME-STANDARDS-MATRIX.md', 'server/modules/system-packs/system-packs.service.js'],
  'quote-cost': ['server/modules/quotation/quotation.service.js', 'test/production-readiness/quotation-v2-bom.test.js'],
  'product-catalog': ['server/modules/system-packs/system-packs.service.js', 'test/production-readiness/system-packs.test.js'],
  quality: ['audit/operational-readiness-harness.js', 'test/production-readiness/operational-readiness-harness.test.js'],
  governance: ['docs/_archive/RHAUTT-NEXUS-ENTERPRISE-AI-CONTROL-ARCHITECTURE.md', 'scripts/agent-guards/ai-control-plane-check.js'],
  'shared-platform': ['docs/_archive/RHAUTT-NEXUS-HARNESS-ENGINEERING-ARCHITECTURE.md', 'scripts/agent-guards/production-trunk-isolation-check.js'],
  'legacy-archive': ['archive/legacy-ui/public/legacy-surface-manifest.json', 'server/middleware/productionStaticSurfaceGuard.js']
};

const ACTIVE_DOMAIN_BY_FILE = {
  'archive/legacy-ui/public/business-console.html': 'business-console',
  'archive/legacy-ui/public/customer-share.html': 'customer-lifecycle',
  'archive/legacy-ui/public/customer-view.html': 'customer-lifecycle',
  'archive/legacy-ui/public/designer.html': 'designer-workbench',
  'archive/legacy-ui/public/index-ready.html': 'group-portal',
  'archive/legacy-ui/public/index.html': 'group-portal',
  'archive/legacy-ui/public/index-portal-legacy.html': 'group-portal',
  'archive/legacy-ui/public/rysnova-bim-designer.html': 'rysnova-bim',
  'archive/legacy-ui/public/smart-routing.html': 'shared-platform',
  'archive/legacy-ui/public/growth-hub.html': 'governance',
  'archive/legacy-ui/public/login.html': 'auth-platform',
  'archive/legacy-ui/public/pain-diagnosis.html': 'rysnova-diagnosis',
  'archive/legacy-ui/public/staff-portal.html': 'staff-portal',
  'archive/legacy-ui/public/privacy.html': 'governance',
  'archive/legacy-ui/public/consent.html': 'governance'
};

const DOMAIN_RULES = [
  { domain: 'customer-lifecycle', pattern: /(?:customer-journeys)/i },
  { domain: 'designer-workbench', pattern: /(?:designer-legacy|design-review|ppt-export)/i },
  { domain: 'quote-cost', pattern: /(?:quotation|quote|material|oneclick|package-purchase|price|commercial-tax)/i },
  { domain: 'product-catalog', pattern: /(?:admin\/products|products|product-|product_|showcase|presentation|custom-configurator|device-selection)/i },
  { domain: 'lifecycle-iot', pattern: /(?:econet|maintenance|operation-maintenance|service-ticket|service-tickets|predictive|workorders|hvac-dashboard)/i },
  { domain: 'delivery', pattern: /(?:construction|contract|delivery|workflow|schedule|acceptance)/i },
  { domain: 'crm', pattern: /(?:crm|sales|customers|channel|store|marketing|mobile-sales-assistant)/i },
  { domain: 'rysnova-bim', pattern: /(?:bim|revit|drawing|technical|cad|cfd|3d|ar-|immersive|floorplan|device-positioning|location|house-type|template-library)/i },
  { domain: 'standards-calculation', pattern: /(?:calculation|calc|load-|doas|water-system|water_|hvac|energy|hydraulic)/i },
  { domain: 'quality', pattern: /(?:quality|accuracy|performance-monitor|perf)/i },
  { domain: 'governance', pattern: /(?:ai-|ai_|chatbot|voice|assistant|command|agency-agent|governance)/i },
  { domain: 'ops-analytics', pattern: /(?:admin-dashboard|hq-admin|analytics|business-analytics|dashboard|notifications|messages|settings)/i },
  { domain: 'brand-portal', pattern: /(?:four-brand|rheem|ruud|brand|premium|index-v2|index-premium)/i },
  { domain: 'rysnova-diagnosis', pattern: /(?:solution|pain-diagnosis-v3|simple-proposal|quick-lock)/i },
  { domain: 'shared-platform', pattern: /(?:desktop-layout|mobile\.html|help|api-docs|login)/i }
];

const DELETE_GATE = [
  'PRD mapping exists',
  'replacement owner exists',
  'replacement or archive evidence exists',
  'active navigation remains unaffected',
  'route/API contract is unaffected or replaced',
  'tests/guards are updated and passing',
  'rollback note exists',
  'legacy manifest and ownership report are updated'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function slash(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function walkHtml(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(file, files);
    else if (entry.name.endsWith('.html')) files.push(slash(path.relative(ROOT, file)));
  }
  return files;
}

function classifyManifest(manifest) {
  const rows = [];
  const seen = new Map();
  const failures = [];

  for (const [bucket, files] of Object.entries(manifest.surfaces || {})) {
    if (!VALID_BUCKETS.has(bucket)) failures.push(`invalid manifest bucket: ${bucket}`);
    for (const file of files || []) {
      if (seen.has(file)) failures.push(`${file} declared in both ${seen.get(file)} and ${bucket}`);
      seen.set(file, bucket);
      rows.push({ file, manifestBucket: bucket });
    }
  }

  return { rows, seen, failures };
}

function inferDomain(file) {
  if (ACTIVE_DOMAIN_BY_FILE[file]) {
    return { domain: ACTIVE_DOMAIN_BY_FILE[file], source: 'active-exact' };
  }

  const comparable = file.replace(/^archive\/legacy-ui\/public\//, '');
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(comparable)) return { domain: rule.domain, source: `rule:${rule.pattern}` };
  }
  return { domain: 'legacy-archive', source: 'fallback' };
}

function actionFor(file, bucket, registryEntry, domain) {
  if (bucket === 'active') return 'active';
  if (registryEntry?.action) return registryEntry.action;
  if (bucket === 'migration-candidate') return domain === 'governance' || domain === 'shared-platform' ? 'wrap' : 'migrate';
  return 'archive';
}

function statusFor(bucket, action) {
  if (bucket === 'active') return 'active-production-surface';
  if (bucket === 'migration-candidate') return `${action}-owner-assigned`;
  if (bucket === 'archive') return 'archived-reference-guarded';
  return 'static-inventory-retained-guarded';
}

function evidenceFor(bucket, domain) {
  const evidence = [
    'archive/legacy-ui/public/legacy-surface-manifest.json',
    'server/middleware/productionStaticSurfaceGuard.js',
    'scripts/agent-guards/active-navigation-check.js',
    'scripts/agent-guards/production-trunk-isolation-check.js'
  ];
  if (bucket === 'active') {
    evidence.push('scripts/agent-guards/active-page-static-acceptance.js');
    evidence.push('test/production-readiness/visual-surface-contract.test.js');
  }
  for (const item of DOMAIN_EVIDENCE[domain] || []) evidence.push(item);
  return [...new Set(evidence)];
}

function buildRows(manifestRows, registry) {
  const pageAssets = registry.pageAssets || {};
  return manifestRows.map(row => {
    const registryEntry = pageAssets[row.file] || null;
    const inferred = inferDomain(row.file);
    const domain = registryEntry?.domain || inferred.domain;
    const action = actionFor(row.file, row.manifestBucket, registryEntry, domain);
    return {
      file: row.file,
      manifestBucket: row.manifestBucket,
      activeSurface: row.manifestBucket === 'active',
      domain,
      ownerAgent: DOMAIN_OWNERS[domain] || null,
      ownerAssignmentSource: registryEntry ? 'legacy-fusion-registry' : inferred.source,
      action,
      priority: registryEntry?.priority || (row.manifestBucket === 'migration-candidate' ? 'P1' : row.manifestBucket === 'active' ? 'P0' : 'P2'),
      migrationStatus: statusFor(row.manifestBucket, action),
      targetSurface: registryEntry?.target || DOMAIN_TARGETS[domain],
      nextAction: registryEntry?.next || (
        row.manifestBucket === 'active'
          ? 'Keep active surface covered by active-page, navigation, visual, and API contract guards.'
          : 'Retain behind productionStaticSurfaceGuard until the target module has replacement implementation, tests, and rollback evidence.'
      ),
      replacementEvidence: evidenceFor(row.manifestBucket, domain),
      deletionGate: DELETE_GATE,
      deletionSafe: false
    };
  });
}

function validate({ publicHtml, manifestRows, declared, rows }) {
  const failures = [];
  const warnings = [];

  for (const file of publicHtml) {
    if (!declared.has(file)) failures.push(`${file} is not classified in legacy-surface-manifest`);
  }

  for (const row of manifestRows) {
    if (!exists(row.file)) failures.push(`${row.file} is declared but missing`);
  }

  for (const pathName of ACTIVE_HTML_PATHS) {
    const manifestFile = `archive/legacy-ui/public${pathName}`;
    const row = rows.find(item => item.file === manifestFile);
    if (!row) failures.push(`${pathName} is active but missing ownership row`);
    else if (row.manifestBucket !== 'active' || row.action !== 'active') failures.push(`${manifestFile} active ownership mismatch`);
  }

  for (const row of rows) {
    if (!row.ownerAgent) failures.push(`${row.file}: missing ownerAgent for domain ${row.domain}`);
    if (!VALID_ACTIONS.has(row.action)) failures.push(`${row.file}: invalid action ${row.action}`);
    if (!row.targetSurface) failures.push(`${row.file}: missing targetSurface`);
    if (!row.nextAction) failures.push(`${row.file}: missing nextAction`);
    if (!row.migrationStatus) failures.push(`${row.file}: missing migrationStatus`);
    if (!Array.isArray(row.replacementEvidence) || row.replacementEvidence.length < 3) {
      failures.push(`${row.file}: missing replacementEvidence`);
    }
    if (!Array.isArray(row.deletionGate) || row.deletionGate.length < DELETE_GATE.length) {
      failures.push(`${row.file}: incomplete deletionGate`);
    }
    if (row.ownerAssignmentSource === 'fallback') failures.push(`${row.file}: owner assigned by fallback legacy archive rule`);
    if (row.manifestBucket !== 'active' && row.action === 'active') failures.push(`${row.file}: non-active page cannot have active action`);
    if (row.manifestBucket === 'active' && row.action !== 'active') failures.push(`${row.file}: active page must have active action`);

    for (const evidence of row.replacementEvidence || []) {
      if (!exists(evidence)) failures.push(`${row.file}: replacement evidence does not exist: ${evidence}`);
    }
  }

  return { failures, warnings };
}

function renderMarkdown(report) {
  const lines = [
    '# Legacy Surface Ownership Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report assigns owner, domain, migration action, target surface, replacement evidence, and deletion gates to every public HTML surface. It is production evidence that legacy pages are retained as governed assets, not accidental production navigation.',
    '',
    '## Summary',
    '',
    '| Metric | Value |',
    '|---|---:|',
    `| Public HTML | ${report.summary.publicHtml} |`,
    `| Manifest rows | ${report.summary.manifestRows} |`,
    `| Active surfaces | ${report.summary.activeSurfaces} |`,
    `| Non-active governed assets | ${report.summary.nonActiveGovernedAssets} |`,
    `| Owner coverage | ${report.summary.ownerCoverage} / ${report.summary.manifestRows} |`,
    `| Evidence coverage | ${report.summary.evidenceCoverage} / ${report.summary.manifestRows} |`,
    `| Failures | ${report.summary.failures} |`,
    `| Warnings | ${report.summary.warnings} |`,
    '',
    '## Bucket Counts',
    '',
    '| Bucket | Count |',
    '|---|---:|'
  ];

  for (const [bucket, count] of Object.entries(report.summary.bucketCounts)) {
    lines.push(`| ${bucket} | ${count} |`);
  }

  lines.push('', '## Action Counts', '', '| Action | Count |', '|---|---:|');
  for (const [action, count] of Object.entries(report.summary.actionCounts)) {
    lines.push(`| ${action} | ${count} |`);
  }

  lines.push('', '## Surface Ownership', '', '| File | Bucket | Domain | Owner | Action | Target |', '|---|---|---|---|---|---|');
  for (const row of report.surfaces) {
    lines.push(`| ${row.file} | ${row.manifestBucket} | ${row.domain} | ${row.ownerAgent} | ${row.action} | ${String(row.targetSurface).replace(/\|/g, '/')} |`);
  }

  lines.push('', '## Deletion Policy', '');
  for (const gate of DELETE_GATE) lines.push(`- ${gate}`);

  lines.push('', report.failures.length ? '## Failures' : '## Failures\n\nNone.');
  for (const failure of report.failures) lines.push(`- ${failure}`);
  lines.push('', report.warnings.length ? '## Warnings' : '## Warnings\n\nNone.');
  for (const warning of report.warnings) lines.push(`- ${warning}`);

  return `${lines.join('\n')}\n`;
}

function main() {
  const manifest = readJson(MANIFEST_PATH);
  const registry = fs.existsSync(REGISTRY_PATH) ? readJson(REGISTRY_PATH) : { pageAssets: {} };
  const publicHtml = walkHtml(path.join(ROOT, 'archive', 'legacy-ui', 'public')).sort();
  const classified = classifyManifest(manifest);
  const rows = buildRows(classified.rows, registry);
  const validation = validate({
    publicHtml,
    manifestRows: classified.rows,
    declared: classified.seen,
    rows
  });
  const failures = [...classified.failures, ...validation.failures];
  const warnings = validation.warnings;
  const bucketCounts = rows.reduce((acc, row) => {
    acc[row.manifestBucket] = (acc[row.manifestBucket] || 0) + 1;
    return acc;
  }, {});
  const actionCounts = rows.reduce((acc, row) => {
    acc[row.action] = (acc[row.action] || 0) + 1;
    return acc;
  }, {});
  const ownerCoverage = rows.filter(row => row.ownerAgent).length;
  const evidenceCoverage = rows.filter(row => Array.isArray(row.replacementEvidence) && row.replacementEvidence.length >= 3).length;
  const report = {
    generatedAt: new Date().toISOString(),
    sourceManifest: 'archive/legacy-ui/public/legacy-surface-manifest.json',
    sourceRegistry: 'audit/legacy-fusion-registry.json',
    policy: {
      activePagesRemainProductionSurfaces: true,
      nonActivePagesRemainBehindProductionStaticSurfaceGuard: true,
      deletionSafeByDefault: false,
      allowedActions: [...VALID_ACTIONS],
      deletionGate: DELETE_GATE
    },
    summary: {
      publicHtml: publicHtml.length,
      manifestRows: rows.length,
      activeSurfaces: rows.filter(row => row.activeSurface).length,
      nonActiveGovernedAssets: rows.filter(row => !row.activeSurface).length,
      ownerCoverage,
      evidenceCoverage,
      bucketCounts,
      actionCounts,
      failures: failures.length,
      warnings: warnings.length
    },
    surfaces: rows,
    failures,
    warnings
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(report));

  console.log(`Legacy Surface Ownership Check: html = ${publicHtml.length}, rows = ${rows.length}, ownerCoverage = ${ownerCoverage}, failures = ${failures.length}, warnings = ${warnings.length}`);
  if (failures.length) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (require.main === module) main();
