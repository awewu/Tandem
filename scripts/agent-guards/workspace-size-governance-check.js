#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const CODE_SIZE_REPORT = path.join(ROOT, 'audit', 'code-size-trunk-report.json');
const JSON_OUTPUT = path.join(ROOT, 'audit', 'workspace-size-governance-report.json');
const MD_OUTPUT = path.join(ROOT, 'audit', 'workspace-size-governance-report.md');

const OBSERVATION_THRESHOLDS = {
  totalScannedLines: 250000,
  backupLines: 100000,
  archiveLines: 50000,
  generatedEvidenceLines: 50000,
  dataFixtureLines: 50000,
  productionCompatibilityRuntimeLines: 50000,
  rootLegacyReportLines: 25000,
  legacyHtmlLines: 50000
};

const REQUIRED_BULK_BUCKETS = [
  'archive-excluded',
  'generated-evidence',
  'data-fixtures',
  'production-compatibility-runtime',
  'root-legacy-report'
];

const BULK_BUCKET_POLICIES = {
  'backup-excluded': {
    owner: 'sre-guardian',
    domain: 'operations-retention',
    retention: 'Move to external retained artifact storage after release-evidence index and checksum proof exist.',
    migrationAction: 'externalize',
    deletionGate: 'external artifact URI, checksum manifest, restore drill, rollback note, and guard:workspace-size pass',
    targetEvidence: 'evidence/operations/backup-restore-drill.json'
  },
  'archive-excluded': {
    owner: 'legacy-fusion-migrator',
    domain: 'historical-archive',
    retention: 'Keep isolated from production imports; split to archive package or external archive after replacement index exists.',
    migrationAction: 'external-archive',
    deletionGate: 'owner approval, archive manifest, replacement or historical reference note, and production trunk isolation pass',
    targetEvidence: 'archive/legacy-ui/public/legacy-surface-manifest.json'
  },
  'generated-evidence': {
    owner: 'test-harness-builder',
    domain: 'release-evidence-retention',
    retention: 'Retain current release evidence; prune older generated evidence only by release snapshot retention policy.',
    migrationAction: 'retain-current-prune-old',
    deletionGate: 'SBOM/provenance/release evidence index, retention window, checksum proof, and delivery-goal pass',
    targetEvidence: 'evidence/release-evidence.json'
  },
  'data-fixtures': {
    owner: 'data-platform-architect',
    domain: 'seed-and-fixture-data',
    retention: 'Convert large demo JSON into controlled seeds or external datasets with checksum evidence.',
    migrationAction: 'normalize-to-seeds',
    deletionGate: 'seed script, checksum manifest, test coverage, and database guard pass',
    targetEvidence: 'database/postgres/migrations/001_rhautt_nexus_core_ledger.sql'
  },
  'production-compatibility-runtime': {
    owner: 'backend-platform-builder',
    domain: 'compatibility-runtime-replacement',
    retention: 'Keep until NestJS/Fastify modules replace each engine through OpenAPI contract and E2E evidence.',
    migrationAction: 'replace-with-target-modules',
    deletionGate: 'target dependency boot proof, route contract proof, E2E coverage, rollback note, and production trunk isolation pass',
    targetEvidence: 'evidence/architecture/target-api-boot-smoke.json'
  },
  'legacy-html': {
    owner: 'legacy-fusion-migrator',
    domain: 'legacy-html-surface-governance',
    retention: 'Every old HTML surface remains governed until migrated, wrapped, archived, or retired with replacement evidence.',
    migrationAction: 'migrate-wrap-archive-retire',
    deletionGate: 'legacy surface owner, replacement evidence, navigation unaffected, rollback note, and ownership guard pass',
    targetEvidence: 'audit/legacy-surface-ownership-report.json'
  },
  'root-legacy-report': {
    owner: 'orchestrator-chief',
    domain: 'root-report-consolidation',
    retention: 'Consolidate historical root reports into docs/evidence archive; keep current charter/evidence docs separate.',
    migrationAction: 'consolidate-to-docs-or-archive',
    deletionGate: 'canonical doc mapping, checksum/index entry, owner signoff, and delivery-goal pass',
    targetEvidence: 'docs/_archive/RHAUTT-NEXUS-GOAL-EVIDENCE-MATRIX.md'
  }
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureCodeSizeReport() {
  try {
    execFileSync(process.execPath, ['scripts/agent-guards/code-size-trunk-check.js'], {
      cwd: ROOT,
      stdio: 'pipe'
    });
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

function bucketLines(report, bucket) {
  return report.buckets[bucket]?.lines || 0;
}

function bucketFiles(report, bucket) {
  return report.buckets[bucket]?.files || 0;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function addObservation(observations, metric, current, threshold, message) {
  if (current > threshold) {
    observations.push({ metric, current, threshold, message });
  }
}

function topFilesForBucket(codeSize, bucket, limit = 5) {
  if (bucket === 'legacy-html') {
    return (codeSize.topFiles || [])
      .filter(item => String(item.bucket || '').startsWith('legacy-html-'))
      .slice(0, limit);
  }
  return (codeSize.topFiles || [])
    .filter(item => item.bucket === bucket)
    .slice(0, limit);
}

function bucketSummary(codeSize, bucket) {
  if (bucket === 'legacy-html') {
    return {
      files: Object.entries(codeSize.buckets)
        .filter(([name]) => name.startsWith('legacy-html-'))
        .reduce((sum, [, value]) => sum + value.files, 0),
      lines: codeSize.legacyHtmlLines
    };
  }
  return {
    files: bucketFiles(codeSize, bucket),
    lines: bucketLines(codeSize, bucket)
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Workspace Size Governance Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report answers whether the repository size is product runtime size. It separates the production trunk from historical assets, evidence, data fixtures, backups, archive folders, and migration inventory.',
    '',
    '## Verdict',
    '',
    `- Status: ${report.status}`,
    `- Total scanned lines: ${report.workspace.totalScannedLines}`,
    `- Production reachable runtime lines: ${report.production.reachableRuntimeLines}`,
    `- Production eager runtime lines: ${report.production.eagerRuntimeLines}`,
    `- Production reachable runtime ratio: ${(report.ratios.productionReachableRuntimeToWorkspace * 100).toFixed(2)}%`,
    `- Production eager runtime ratio: ${(report.ratios.productionEagerRuntimeToWorkspace * 100).toFixed(2)}%`,
    `- Repository expansion lines outside reachable runtime: ${report.workspace.linesOutsideReachableRuntime}`,
    `- Failures: ${report.failures.length}`,
    `- Observations: ${report.observations.length}`,
    '',
    '## Major Buckets',
    '',
    '| Bucket | Files | Lines | Interpretation |',
    '|---|---:|---:|---|'
  ];

  for (const item of report.majorBuckets) {
    lines.push(`| ${item.bucket} | ${item.files} | ${item.lines} | ${item.interpretation.replace(/\|/g, '\\|')} |`);
  }

  lines.push(
    '',
    '## Bulk Asset Governance',
    '',
    '| Bucket | Owner | Action | Files | Lines | Target Evidence |',
    '|---|---|---|---:|---:|---|'
  );
  for (const item of report.bulkAssetGovernance) {
    lines.push(`| ${item.bucket} | ${item.owner} | ${item.migrationAction} | ${item.files} | ${item.lines} | ${item.targetEvidence} |`);
  }

  lines.push('', '## Bulk Deletion Gates', '');
  for (const item of report.bulkAssetGovernance) {
    lines.push(`- ${item.bucket}: ${item.deletionGate}`);
  }

  lines.push(
    '',
    '## Production Size Budget',
    '',
    '| Metric | Current | Budget | Status |',
    '|---|---:|---:|---|'
  );
  for (const item of report.production.deliverySizeBudget) {
    lines.push(`| ${item.metric} | ${item.current} | ${item.budget} | ${item.status} |`);
  }

  lines.push(
    '',
    '## Observations',
    ''
  );
  if (report.observations.length) {
    for (const item of report.observations) {
      lines.push(`- ${item.metric}: ${item.message} Current ${item.current}, threshold ${item.threshold}.`);
    }
  } else {
    lines.push('- None.');
  }

  lines.push(
    '',
    '## Required Governance Actions',
    ''
  );
  for (const action of report.requiredActions) {
    lines.push(`- ${action}`);
  }

  lines.push(
    '',
    '## Policy',
    '',
    '- Production claims must cite reachable or eager runtime lines, not total workspace lines.',
    '- Backups, generated evidence, docs, audit reports, large fixtures, and legacy HTML are repository assets, not production runtime.',
    '- Repository slimming must be evidence-preserving: classify, migrate, archive externally, or retire with owner proof before deletion.',
    '- Tests must not reward larger compatibility debt; they should prove debt is visible, bounded on the production path, and shrinking over time.',
    ''
  );

  return lines.join('\n');
}

function main() {
  ensureCodeSizeReport();
  const codeSize = readJson(CODE_SIZE_REPORT);
  const totalScannedLines = codeSize.totals.lines;
  const failures = [];
  const observations = [];

  if (!codeSize.deliverySizeBudget || !Array.isArray(codeSize.deliverySizeBudget)) {
    failures.push('code-size report is missing deliverySizeBudget');
  }

  for (const budget of codeSize.deliverySizeBudget || []) {
    if (budget.status !== 'pass') {
      failures.push(`production size budget failed: ${budget.metric}`);
    }
  }

  if ((codeSize.activeMismatch || []).length) {
    failures.push(`active page classification mismatch: ${codeSize.activeMismatch.join(', ')}`);
  }

  const majorBuckets = [
    {
      bucket: 'production-reachable-runtime',
      files: codeSize.productionReachableRuntimeFiles,
      lines: codeSize.productionReachableRuntimeLines,
      interpretation: 'Actual static production route graph plus active pages.'
    },
    {
      bucket: 'production-eager-runtime',
      files: codeSize.productionEagerRuntimeFiles,
      lines: codeSize.productionEagerRuntimeLines,
      interpretation: 'Startup path plus active pages; this is the boot-size control.'
    },
    {
      bucket: 'backup-excluded',
      files: bucketFiles(codeSize, 'backup-excluded'),
      lines: bucketLines(codeSize, 'backup-excluded'),
      interpretation: 'Historical backups; should move to external retained artifact storage, not production trunk.'
    },
    {
      bucket: 'archive-excluded',
      files: bucketFiles(codeSize, 'archive-excluded'),
      lines: bucketLines(codeSize, 'archive-excluded'),
      interpretation: 'Archived experiments and legacy apps; keep isolated from production imports.'
    },
    {
      bucket: 'generated-evidence',
      files: bucketFiles(codeSize, 'generated-evidence'),
      lines: bucketLines(codeSize, 'generated-evidence'),
      interpretation: 'Audit, SBOM, provenance, and verification evidence; required for delivery but not runtime.'
    },
    {
      bucket: 'data-fixtures',
      files: bucketFiles(codeSize, 'data-fixtures'),
      lines: bucketLines(codeSize, 'data-fixtures'),
      interpretation: 'Seed/demo/test data; must become controlled seeds or external datasets.'
    },
    {
      bucket: 'production-compatibility-runtime',
      files: bucketFiles(codeSize, 'production-compatibility-runtime'),
      lines: codeSize.productionCompatibilityRuntimeLines,
      interpretation: 'Legacy compatibility inventory; only a small subset is reachable from production routes.'
    },
    {
      bucket: 'legacy-html',
      files: Object.entries(codeSize.buckets)
        .filter(([bucket]) => bucket.startsWith('legacy-html-'))
        .reduce((sum, [, value]) => sum + value.files, 0),
      lines: codeSize.legacyHtmlLines,
      interpretation: 'Old HTML asset inventory; migrate, wrap, archive, or retire with owner evidence.'
    },
    {
      bucket: 'root-legacy-report',
      files: bucketFiles(codeSize, 'root-legacy-report'),
      lines: bucketLines(codeSize, 'root-legacy-report'),
      interpretation: 'Historical root-level reports; should be consolidated into docs or evidence archive.'
    }
  ];

  const bulkAssetGovernance = REQUIRED_BULK_BUCKETS.map(bucket => {
    const summary = bucketSummary(codeSize, bucket);
    const policy = BULK_BUCKET_POLICIES[bucket];
    return {
      bucket,
      files: summary.files,
      lines: summary.lines,
      topFiles: topFilesForBucket(codeSize, bucket),
      ...policy
    };
  });

  for (const item of bulkAssetGovernance) {
    for (const field of ['owner', 'domain', 'retention', 'migrationAction', 'deletionGate', 'targetEvidence']) {
      if (!item[field]) failures.push(`${item.bucket} missing bulk governance field: ${field}`);
    }
    if (!item.files || !item.lines) failures.push(`${item.bucket} has no files/lines in bulk governance`);
    if (!fs.existsSync(path.join(ROOT, item.targetEvidence))) {
      failures.push(`${item.bucket} target evidence does not exist: ${item.targetEvidence}`);
    }
  }

  addObservation(
    observations,
    'totalScannedLines',
    totalScannedLines,
    OBSERVATION_THRESHOLDS.totalScannedLines,
    'workspace is much larger than the production runtime and needs repository slimming'
  );
  addObservation(
    observations,
    'backupLines',
    bucketLines(codeSize, 'backup-excluded'),
    OBSERVATION_THRESHOLDS.backupLines,
    'backups dominate repository size and should be retained outside the production workspace'
  );
  addObservation(
    observations,
    'archiveLines',
    bucketLines(codeSize, 'archive-excluded'),
    OBSERVATION_THRESHOLDS.archiveLines,
    'archives are large enough to require external archive or separate package governance'
  );
  addObservation(
    observations,
    'generatedEvidenceLines',
    bucketLines(codeSize, 'generated-evidence'),
    OBSERVATION_THRESHOLDS.generatedEvidenceLines,
    'generated evidence is large and should be pruned by retention policy after release snapshots'
  );
  addObservation(
    observations,
    'dataFixtureLines',
    bucketLines(codeSize, 'data-fixtures'),
    OBSERVATION_THRESHOLDS.dataFixtureLines,
    'fixtures should be normalized into seeds and external datasets'
  );
  addObservation(
    observations,
    'productionCompatibilityRuntimeLines',
    codeSize.productionCompatibilityRuntimeLines,
    OBSERVATION_THRESHOLDS.productionCompatibilityRuntimeLines,
    'compatibility runtime inventory remains large even though production reachability is bounded'
  );
  addObservation(
    observations,
    'rootLegacyReportLines',
    bucketLines(codeSize, 'root-legacy-report'),
    OBSERVATION_THRESHOLDS.rootLegacyReportLines,
    'root-level historical reports should be consolidated'
  );
  addObservation(
    observations,
    'legacyHtmlLines',
    codeSize.legacyHtmlLines,
    OBSERVATION_THRESHOLDS.legacyHtmlLines,
    'legacy HTML inventory is still large and needs migration or retirement evidence'
  );

  const report = {
    generatedAt: new Date().toISOString(),
    status: failures.length ? 'blocked-workspace-size-governance' : 'pass-with-repository-size-observations',
    workspace: {
      totalScannedFiles: codeSize.totals.files,
      totalScannedLines,
      linesOutsideReachableRuntime: totalScannedLines - codeSize.productionReachableRuntimeLines,
      linesOutsideEagerRuntime: totalScannedLines - codeSize.productionEagerRuntimeLines
    },
    production: {
      reachableRuntimeLines: codeSize.productionReachableRuntimeLines,
      reachableRuntimeFiles: codeSize.productionReachableRuntimeFiles,
      eagerRuntimeLines: codeSize.productionEagerRuntimeLines,
      eagerRuntimeFiles: codeSize.productionEagerRuntimeFiles,
      reachableJsRuntimeLines: codeSize.productionReachableJsRuntimeLines,
      eagerJsRuntimeLines: codeSize.productionEagerJsRuntimeLines,
      reachableCompatibilityLines: codeSize.productionReachableCompatibilityLines,
      compatibilityInventoryLines: codeSize.productionCompatibilityRuntimeLines,
      deliverySizeBudget: codeSize.deliverySizeBudget || []
    },
    ratios: {
      productionReachableRuntimeToWorkspace: ratio(codeSize.productionReachableRuntimeLines, totalScannedLines),
      productionEagerRuntimeToWorkspace: ratio(codeSize.productionEagerRuntimeLines, totalScannedLines),
      reachableCompatibilityToCompatibilityInventory: ratio(
        codeSize.productionReachableCompatibilityLines,
        codeSize.productionCompatibilityRuntimeLines
      )
    },
    majorBuckets,
    bulkAssetGovernance,
    observations,
    failures,
    requiredActions: [
      'Keep production runtime budgets failing on growth, while repository-size observations remain non-failing during migration.',
      'Retain generated release snapshots according to the verified release evidence index.',
      'Convert large data/database JSON fixtures into controlled seed scripts or external datasets with checksum evidence.',
      'Replace compatibility engines through NestJS/Fastify module contracts and E2E coverage before removing legacy runtime files.',
      'Keep React candidate surfaces out of production navigation until OpenAPI contract and browser evidence pass.'
    ],
    source: {
      codeSizeReport: 'audit/code-size-trunk-report.json'
    }
  };

  fs.mkdirSync(path.dirname(JSON_OUTPUT), { recursive: true });
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2));
  fs.writeFileSync(MD_OUTPUT, renderMarkdown(report));

  console.log(JSON.stringify({
    status: report.status,
    outputPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MD_OUTPUT),
    totalScannedLines: report.workspace.totalScannedLines,
    productionReachableRuntimeLines: report.production.reachableRuntimeLines,
    productionEagerRuntimeLines: report.production.eagerRuntimeLines,
    observations: report.observations.length,
    failures: report.failures
  }, null, 2));

  if (failures.length) process.exit(1);
}

if (require.main === module) {
  main();
}
