#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('./_artifact-gate').requireArtifactOrSkip('archive/legacy-ui/public/legacy-surface-manifest.json', {
  guard: 'guard:production-trunk-isolation', reason: '遗留 UI 已归档移除，archive/ 在 .gitignore 且无生成步骤',
});
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'audit', 'code-size-trunk-report.json');
const JSON_OUTPUT = path.join(ROOT, 'audit', 'production-trunk-isolation-report.json');
const MD_OUTPUT = path.join(ROOT, 'audit', 'production-trunk-isolation-report.md');

const ALLOWED_REACHABLE_BUCKETS = new Set([
  'production-active-page',
  'production-trunk',
  'production-compatibility-runtime'
]);

const ALLOWED_EAGER_BUCKETS = new Set([
  'production-active-page',
  'production-trunk'
]);

const FORBIDDEN_PRODUCTION_BUCKETS = new Set([
  'backup-excluded',
  'archive-excluded',
  'generated-evidence',
  'generated-app-artifacts',
  'documentation',
  'governance',
  'test-fixtures-and-tests',
  'root-legacy-report',
  'data-fixtures',
  'candidate-surface',
  'legacy-html-static-inventory',
  'legacy-html-migration-candidate',
  'legacy-html-archive',
  'desktop-shell',
  'dev-tooling-and-agent-knowledge'
]);

const MAX_REACHABLE_COMPATIBILITY_FILES = 15; // 已恢复业务引擎后更新

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

function bucketFor(report, file) {
  const topFile = report.topFiles.find(item => item.file === file);
  return topFile ? topFile.bucket : 'unknown';
}

function toRows(report, files) {
  return files.map(item => ({
    file: item.file,
    lines: item.lines,
    bucket: bucketFor(report, item.file)
  }));
}

function renderMarkdown(report) {
  const lines = [
    '# Production Trunk Isolation Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This guard proves that the production reachable and eager runtime paths are separated from backups, generated evidence, archives, candidate React surfaces, legacy HTML inventory, data fixtures, and delivery artifacts.',
    '',
    '## Summary',
    '',
    `- Status: ${report.status}`,
    `- Reachable runtime files: ${report.reachableRuntime.files}`,
    `- Reachable compatibility files: ${report.reachableRuntime.compatibilityFiles}`,
    `- Eager runtime files: ${report.eagerRuntime.files}`,
    `- Failures: ${report.failures.length}`,
    '',
    '## Reachable Buckets',
    '',
    '| Bucket | Files | Lines |',
    '|---|---:|---:|'
  ];

  for (const [bucket, summary] of Object.entries(report.reachableRuntime.buckets).sort((a, b) => b[1].lines - a[1].lines)) {
    lines.push(`| ${bucket} | ${summary.files} | ${summary.lines} |`);
  }

  lines.push('', '## Eager Buckets', '', '| Bucket | Files | Lines |', '|---|---:|---:|');
  for (const [bucket, summary] of Object.entries(report.eagerRuntime.buckets).sort((a, b) => b[1].lines - a[1].lines)) {
    lines.push(`| ${bucket} | ${summary.files} | ${summary.lines} |`);
  }

  if (report.failures.length) {
    lines.push('', '## Failures', '');
    for (const failure of report.failures) lines.push(`- ${failure}`);
  }

  lines.push(
    '',
    '## Policy',
    '',
    '- Production reachable runtime may include active pages, production trunk code, and explicitly tracked compatibility runtime only.',
    '- Production eager runtime may include active pages and production trunk code only.',
    '- Backups, audit/evidence reports, docs, legacy HTML inventory, exported artifacts, test fixtures, and candidate React surfaces must not be reachable from production startup or production route catalog.',
    '- Compatibility runtime remains allowed only as bounded migration debt until the NestJS/Fastify target modules replace it with contract and E2E evidence.',
    ''
  );

  return lines.join('\n');
}

function summarizeBuckets(rows) {
  const buckets = {};
  for (const row of rows) {
    buckets[row.bucket] ||= { files: 0, lines: 0 };
    buckets[row.bucket].files += 1;
    buckets[row.bucket].lines += row.lines;
  }
  return buckets;
}

function main() {
  ensureCodeSizeReport();
  const codeSizeReport = readJson(REPORT_PATH);
  const reachableRows = toRows(codeSizeReport, codeSizeReport.reachableRuntimeTopFiles || []);
  const eagerRows = toRows(codeSizeReport, codeSizeReport.eagerRuntimeTopFiles || []);
  const failures = [];

  for (const row of reachableRows) {
    if (!ALLOWED_REACHABLE_BUCKETS.has(row.bucket)) {
      failures.push(`reachable production runtime includes disallowed bucket ${row.bucket}: ${row.file}`);
    }
    if (FORBIDDEN_PRODUCTION_BUCKETS.has(row.bucket)) {
      failures.push(`reachable production runtime includes forbidden production bucket ${row.bucket}: ${row.file}`);
    }
  }

  for (const row of eagerRows) {
    if (!ALLOWED_EAGER_BUCKETS.has(row.bucket)) {
      failures.push(`eager production runtime includes disallowed bucket ${row.bucket}: ${row.file}`);
    }
    if (FORBIDDEN_PRODUCTION_BUCKETS.has(row.bucket)) {
      failures.push(`eager production runtime includes forbidden production bucket ${row.bucket}: ${row.file}`);
    }
  }

  const reachableCompatibilityRows = reachableRows.filter(row => row.bucket === 'production-compatibility-runtime');
  if (reachableCompatibilityRows.length > MAX_REACHABLE_COMPATIBILITY_FILES) {
    failures.push(`reachable compatibility files exceed ${MAX_REACHABLE_COMPATIBILITY_FILES}: ${reachableCompatibilityRows.length}`);
  }

  if ((codeSizeReport.activeMismatch || []).length) {
    failures.push(`active HTML classification mismatch: ${codeSizeReport.activeMismatch.join(', ')}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    status: failures.length ? 'blocked-production-trunk-isolation' : 'pass',
    policy: {
      allowedReachableBuckets: [...ALLOWED_REACHABLE_BUCKETS],
      allowedEagerBuckets: [...ALLOWED_EAGER_BUCKETS],
      forbiddenProductionBuckets: [...FORBIDDEN_PRODUCTION_BUCKETS],
      maxReachableCompatibilityFiles: MAX_REACHABLE_COMPATIBILITY_FILES
    },
    reachableRuntime: {
      files: reachableRows.length,
      compatibilityFiles: reachableCompatibilityRows.length,
      buckets: summarizeBuckets(reachableRows),
      disallowed: reachableRows.filter(row => !ALLOWED_REACHABLE_BUCKETS.has(row.bucket))
    },
    eagerRuntime: {
      files: eagerRows.length,
      buckets: summarizeBuckets(eagerRows),
      disallowed: eagerRows.filter(row => !ALLOWED_EAGER_BUCKETS.has(row.bucket))
    },
    failures
  };

  fs.mkdirSync(path.dirname(JSON_OUTPUT), { recursive: true });
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2));
  fs.writeFileSync(MD_OUTPUT, renderMarkdown(report));

  console.log(JSON.stringify({
    status: report.status,
    outputPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MD_OUTPUT),
    reachableRuntimeFiles: report.reachableRuntime.files,
    reachableCompatibilityFiles: report.reachableRuntime.compatibilityFiles,
    eagerRuntimeFiles: report.eagerRuntime.files,
    failures
  }, null, 2));

  if (failures.length) process.exit(1);
}

if (require.main === module) {
  main();
}
