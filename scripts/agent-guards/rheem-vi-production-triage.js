#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('./_artifact-gate').requireArtifactOrSkip('archive/legacy-ui/public/legacy-surface-manifest.json', {
  guard: 'guard:rheem-vi-production:triage', reason: '遗留 UI 已归档移除，archive/ 在 .gitignore 且无生成步骤',
});

const ROOT = path.join(__dirname, '..', '..');
const AUDIT_PATH = path.join(ROOT, 'audit', 'rheem-vi-production-audit.json');
const MANIFEST_PATH = path.join(ROOT, 'archive', 'legacy-ui', 'public', 'legacy-surface-manifest.json');
const JSON_OUTPUT = path.join(ROOT, 'audit', 'rheem-vi-production-triage.json');
const MD_OUTPUT = path.join(ROOT, 'audit', 'rheem-vi-production-triage.md');

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const BUCKET_ORDER = [
  'active',
  'migration-candidate',
  'archive',
  'static-inventory',
  'shared-asset',
  'source-candidate',
  'unclassified'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toCountMap(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || 'unknown';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function buildClassification(manifest) {
  const byFile = new Map();
  for (const bucket of BUCKET_ORDER) {
    const files = manifest.surfaces?.[bucket];
    if (!Array.isArray(files)) continue;
    for (const file of files) byFile.set(file, bucket);
  }
  return byFile;
}

function classifyFile(file, classification) {
  if (classification.has(file)) return classification.get(file);
  if (file.startsWith('archive/legacy-ui/public/css/') || file.startsWith('archive/legacy-ui/public/shared/') || file.startsWith('archive/legacy-ui/public/images/') || file.startsWith('archive/legacy-ui/public/design-tokens/')) {
    return 'shared-asset';
  }
  if (/^archive\/legacy-ui\/public\/[^/]+\.(css|js|json|svg)$/.test(file)) return 'shared-asset';
  if (file.startsWith('archive/legacy-ui/src/') || file.startsWith('frontend/') || file.startsWith('apps/') || file.startsWith('packages/')) {
    return 'source-candidate';
  }
  return 'unclassified';
}

function summarizeFindings(findings, classification) {
  const byBucket = {};
  const byFile = {};

  for (const finding of findings) {
    const bucket = classifyFile(finding.file, classification);
    byBucket[bucket] ||= {
      total: 0,
      bySeverity: {},
      byRule: {},
      files: {}
    };
    byFile[finding.file] ||= {
      file: finding.file,
      bucket,
      total: 0,
      bySeverity: {},
      byRule: {},
      firstFindings: []
    };

    for (const target of [byBucket[bucket], byFile[finding.file]]) {
      target.total += 1;
      target.bySeverity[finding.severity] = (target.bySeverity[finding.severity] || 0) + 1;
      target.byRule[finding.id] = (target.byRule[finding.id] || 0) + 1;
    }

    byBucket[bucket].files[finding.file] = (byBucket[bucket].files[finding.file] || 0) + 1;
    if (byFile[finding.file].firstFindings.length < 3) {
      byFile[finding.file].firstFindings.push({
        id: finding.id,
        severity: finding.severity,
        line: finding.line,
        match: finding.match
      });
    }
  }

  const topFiles = Object.values(byFile).sort((a, b) => {
    if (a.bucket !== b.bucket) return BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket);
    const aCritical = a.bySeverity.critical || 0;
    const bCritical = b.bySeverity.critical || 0;
    if (aCritical !== bCritical) return bCritical - aCritical;
    const aHigh = a.bySeverity.high || 0;
    const bHigh = b.bySeverity.high || 0;
    if (aHigh !== bHigh) return bHigh - aHigh;
    return b.total - a.total;
  });

  const bucketRows = BUCKET_ORDER
    .filter(bucket => byBucket[bucket])
    .map(bucket => ({
      bucket,
      total: byBucket[bucket].total,
      bySeverity: byBucket[bucket].bySeverity,
      byRule: byBucket[bucket].byRule,
      affectedFiles: Object.keys(byBucket[bucket].files).length,
      topFiles: Object.entries(byBucket[bucket].files)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([file, count]) => ({ file, count }))
    }));

  return { byBucket: bucketRows, topFiles };
}

function statusFor(summary) {
  const active = summary.byBucket.find(bucket => bucket.bucket === 'active');
  if (active?.bySeverity?.critical || active?.bySeverity?.high) return 'active-routes-blocked';
  if (summary.byBucket.some(bucket => bucket.bySeverity?.critical || bucket.bySeverity?.high)) {
    return 'legacy-and-candidate-routes-blocked';
  }
  if (summary.byBucket.some(bucket => bucket.total > 0)) return 'needs-review';
  return 'pass';
}

function migrationAdvice(summary) {
  const active = summary.byBucket.find(bucket => bucket.bucket === 'active');
  const candidate = summary.byBucket.find(bucket => bucket.bucket === 'migration-candidate');
  const archive = summary.byBucket.find(bucket => bucket.bucket === 'archive');
  const staticInventory = summary.byBucket.find(bucket => bucket.bucket === 'static-inventory');
  const shared = summary.byBucket.find(bucket => bucket.bucket === 'shared-asset');
  const source = summary.byBucket.find(bucket => bucket.bucket === 'source-candidate');

  return [
    active
      ? `P0 active routes first: ${active.total} findings across ${active.affectedFiles} active files. These block production user-facing Rheem VI.`
      : 'P0 active routes currently have no Rheem VI findings.',
    candidate
      ? `P1 migration candidates: ${candidate.total} findings. Fix while migrating or wrapping into target modules.`
      : 'P1 migration candidates currently have no Rheem VI findings.',
    archive
      ? `P2 archived surfaces: ${archive.total} findings. Keep out of production navigation and clean only when reactivated.`
      : 'P2 archived surfaces currently have no Rheem VI findings.',
    staticInventory
      ? `P3 static inventory: ${staticInventory.total} findings. Preserve as classified assets until replaced, but do not let them enter production navigation.`
      : 'P3 static inventory currently has no Rheem VI findings.',
    shared
      ? `Shared assets: ${shared.total} findings. Clean token, CSS, SVG, and shared JS sources carefully because they may affect many routes at once.`
      : 'Shared assets currently have no Rheem VI findings.',
    source
      ? `Source candidates: ${source.total} findings. Keep React candidate surfaces excluded from production until contract and visual evidence align.`
      : 'Source candidate surfaces currently have no Rheem VI findings.',
    'Logo gate remains controlled: do not use the local Rheem logo asset in production pages until an approved Rheem brand package is installed.',
    'Strict Rheem VI release gate is clear when npm run guard:rheem-vi-production:strict passes; browser visual QA remains a separate launch proof.'
  ];
}

function tableCell(value) {
  return String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function renderMarkdown(report) {
  const lines = [
    '# Rheem VI Production Triage',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Status: ${report.status}`,
    '',
    'This report triages the strict Rheem VI audit by production surface classification. It does not relax the production gate.',
    '',
    '## Totals',
    '',
    `- Audit status: ${report.audit.productionStatus}`,
    `- Total findings: ${report.audit.counts.total}`,
    `- Critical: ${report.audit.counts.bySeverity.critical || 0}`,
    `- High: ${report.audit.counts.bySeverity.high || 0}`,
    `- Medium: ${report.audit.counts.bySeverity.medium || 0}`,
    '',
    '## Buckets',
    '',
    '| Bucket | Findings | Files | Critical | High | Medium | Top Rules |',
    '|---|---:|---:|---:|---:|---:|---|'
  ];

  for (const bucket of report.summary.byBucket) {
    const topRules = Object.entries(bucket.byRule)
      .sort((a, b) => b[1] - a[1])
      .map(([rule, count]) => `${rule}: ${count}`)
      .join(', ');
    lines.push([
      bucket.bucket,
      bucket.total,
      bucket.affectedFiles,
      bucket.bySeverity.critical || 0,
      bucket.bySeverity.high || 0,
      bucket.bySeverity.medium || 0,
      topRules
    ].map(tableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  lines.push(
    '',
    '## Top Active Files',
    '',
    '| File | Findings | Critical | High | Medium | Top Rules |',
    '|---|---:|---:|---:|---:|---|'
  );

  for (const file of report.summary.topFiles.filter(item => item.bucket === 'active').slice(0, 20)) {
    const topRules = Object.entries(file.byRule)
      .sort((a, b) => b[1] - a[1])
      .map(([rule, count]) => `${rule}: ${count}`)
      .join(', ');
    lines.push([
      file.file,
      file.total,
      file.bySeverity.critical || 0,
      file.bySeverity.high || 0,
      file.bySeverity.medium || 0,
      topRules
    ].map(tableCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  lines.push('', '## Migration Advice', '');
  for (const item of report.recommendations) lines.push(`- ${item}`);

  lines.push('', '## Required Gates', '');
  for (const gate of report.requiredGates) lines.push(`- ${gate}`);
  lines.push('');

  return lines.join('\n');
}

function main() {
  if (!fs.existsSync(AUDIT_PATH)) {
    console.error(`Missing audit report: ${path.relative(ROOT, AUDIT_PATH)}. Run npm run guard:rheem-vi-production first.`);
    process.exit(1);
  }
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Missing legacy surface manifest: ${path.relative(ROOT, MANIFEST_PATH)}`);
    process.exit(1);
  }

  const audit = readJson(AUDIT_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const classification = buildClassification(manifest);
  const findings = Array.isArray(audit.findings) ? audit.findings : [];
  const summary = summarizeFindings(findings, classification);
  const report = {
    generatedAt: new Date().toISOString(),
    status: statusFor(summary),
    audit: {
      generatedAt: audit.generatedAt,
      productionStatus: audit.productionStatus,
      counts: audit.counts
    },
    surfacePolicy: manifest.policy,
    summary,
    unclassifiedFindings: findings.filter(finding => classifyFile(finding.file, classification) === 'unclassified').length,
    rules: toCountMap(findings, 'id'),
    severities: toCountMap(findings, 'severity'),
    recommendations: migrationAdvice(summary),
    requiredGates: [
      'npm run guard:rheem-vi-production',
      'npm run guard:rheem-vi-production:strict',
      'responsive visual QA for each migrated active route',
      'approved Rheem logo package asset before production logo use'
    ]
  };

  fs.mkdirSync(path.dirname(JSON_OUTPUT), { recursive: true });
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2));
  fs.writeFileSync(MD_OUTPUT, renderMarkdown(report));

  console.log(JSON.stringify({
    status: report.status,
    outputPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MD_OUTPUT),
    activeFindings: report.summary.byBucket.find(bucket => bucket.bucket === 'active')?.total || 0,
    unclassifiedFindings: report.unclassifiedFindings
  }, null, 2));
}

if (require.main === module) {
  main();
}
