#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const JSON_OUTPUT = path.join(ROOT, 'evidence', 'operations', 'repository-bulk-retention-manifest.json');
const MD_OUTPUT = path.join(ROOT, 'evidence', 'operations', 'repository-bulk-retention-manifest.md');

const PRUNE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo'
]);

const TEXT_EXTENSIONS = new Set([
  '.bat',
  '.css',
  '.csv',
  '.env',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.sql',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yml',
  '.yaml'
]);

const RETENTION_ROOTS = [
  {
    root: 'backups',
    bucket: 'backup-excluded',
    owner: 'sre-guardian',
    retentionAction: 'externalize',
    externalArtifactUriEnv: 'BACKUP_ARCHIVE_EXTERNAL_URI',
    restoreEvidence: 'evidence/operations/backup-restore-drill.json'
  },
  {
    root: '_archive',
    bucket: 'archive-excluded',
    owner: 'legacy-fusion-migrator',
    retentionAction: 'external-archive',
    externalArtifactUriEnv: 'LEGACY_ARCHIVE_EXTERNAL_URI',
    restoreEvidence: 'audit/legacy-fusion-report.json'
  },
  {
    root: 'archive',
    bucket: 'archive-excluded',
    owner: 'legacy-fusion-migrator',
    retentionAction: 'external-archive',
    externalArtifactUriEnv: 'LEGACY_ARCHIVE_EXTERNAL_URI',
    restoreEvidence: 'audit/legacy-fusion-report.json'
  },
  {
    root: 'server/archive',
    bucket: 'archive-excluded',
    owner: 'legacy-fusion-migrator',
    retentionAction: 'external-archive',
    externalArtifactUriEnv: 'LEGACY_ARCHIVE_EXTERNAL_URI',
    restoreEvidence: 'audit/legacy-fusion-report.json'
  },
  {
    root: 'commercial-hvac-design',
    bucket: 'archive-excluded',
    owner: 'legacy-fusion-migrator',
    retentionAction: 'external-archive',
    externalArtifactUriEnv: 'LEGACY_ARCHIVE_EXTERNAL_URI',
    restoreEvidence: 'audit/legacy-fusion-report.json'
  }
];

function slash(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function relative(filePath) {
  return slash(path.relative(ROOT, filePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function lineCount(buffer, filePath) {
  if (!isTextFile(filePath)) return null;
  const text = buffer.toString('utf8');
  if (!text.length) return 0;
  return text.split(/\r?\n/).length;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && PRUNE_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function inspectFile(filePath, rootPolicy) {
  const buffer = fs.readFileSync(filePath);
  return {
    file: relative(filePath),
    root: rootPolicy.root,
    bucket: rootPolicy.bucket,
    owner: rootPolicy.owner,
    bytes: buffer.length,
    lines: lineCount(buffer, filePath),
    sha256: sha256Buffer(buffer)
  };
}

function summarize(entries, policies) {
  const byBucket = {};
  const byRoot = {};

  for (const entry of entries) {
    byBucket[entry.bucket] ||= {
      bucket: entry.bucket,
      owner: entry.owner,
      files: 0,
      bytes: 0,
      textLines: 0,
      deletionSafe: false
    };
    byBucket[entry.bucket].files += 1;
    byBucket[entry.bucket].bytes += entry.bytes;
    byBucket[entry.bucket].textLines += entry.lines || 0;

    byRoot[entry.root] ||= {
      root: entry.root,
      bucket: entry.bucket,
      owner: entry.owner,
      files: 0,
      bytes: 0,
      textLines: 0,
      exists: true
    };
    byRoot[entry.root].files += 1;
    byRoot[entry.root].bytes += entry.bytes;
    byRoot[entry.root].textLines += entry.lines || 0;
  }

  for (const policy of policies) {
    byRoot[policy.root] ||= {
      root: policy.root,
      bucket: policy.bucket,
      owner: policy.owner,
      files: 0,
      bytes: 0,
      textLines: 0,
      exists: exists(policy.root)
    };
  }

  return {
    byBucket: Object.values(byBucket).sort((a, b) => b.bytes - a.bytes),
    byRoot: Object.values(byRoot).sort((a, b) => a.root.localeCompare(b.root))
  };
}

function externalUriStatus(policy) {
  const value = process.env[policy.externalArtifactUriEnv];
  return {
    env: policy.externalArtifactUriEnv,
    present: Boolean(value),
    sha256: value ? sha256Text(value) : null
  };
}

function deletionGate(policy) {
  const external = externalUriStatus(policy);
  return {
    root: policy.root,
    bucket: policy.bucket,
    owner: policy.owner,
    retentionAction: policy.retentionAction,
    externalArtifactUri: external,
    restoreEvidence: {
      path: policy.restoreEvidence,
      present: exists(policy.restoreEvidence)
    },
    requiredBeforeDeletion: [
      'checksum manifest covers every retained file',
      `${policy.externalArtifactUriEnv} points to retained external artifact storage`,
      `${policy.restoreEvidence} remains present and current`,
      'npm run guard:production-trunk-isolation passes',
      'npm run guard:workspace-size passes',
      'rollback note references this manifest hash'
    ],
    deletionSafe: false,
    deletionBlockedBecause: external.present
      ? ['rollback note and post-upload restore proof still required before removing local retained assets']
      : [`${policy.externalArtifactUriEnv} is not set; local retained assets must not be removed`]
  };
}

function renderMarkdown(report) {
  const lines = [
    '# Repository Bulk Retention Manifest',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This evidence governs bulky repository assets before slimming. It does not claim that backups or archives have already been moved out of the workspace; it proves they are inventoried, hashed, owned, and deletion-gated.',
    '',
    '## Summary',
    '',
    `- Status: ${report.status}`,
    `- Files inventoried: ${report.totals.files}`,
    `- Bytes inventoried: ${report.totals.bytes}`,
    `- Text lines inventoried: ${report.totals.textLines}`,
    `- Manifest hash: ${report.manifestSha256}`,
    `- Deletion safe: ${report.deletionSafe}`,
    `- Failures: ${report.failures.length}`,
    '',
    '## Buckets',
    '',
    '| Bucket | Owner | Files | Bytes | Text Lines | Deletion Safe |',
    '|---|---|---:|---:|---:|---|'
  ];

  for (const bucket of report.summary.byBucket) {
    lines.push(`| ${bucket.bucket} | ${bucket.owner} | ${bucket.files} | ${bucket.bytes} | ${bucket.textLines} | ${bucket.deletionSafe} |`);
  }

  lines.push('', '## Roots', '', '| Root | Bucket | Owner | Exists | Files | Bytes | Text Lines |', '|---|---|---|---|---:|---:|---:|');
  for (const root of report.summary.byRoot) {
    lines.push(`| ${root.root} | ${root.bucket} | ${root.owner} | ${root.exists} | ${root.files} | ${root.bytes} | ${root.textLines} |`);
  }

  lines.push('', '## Largest Retained Files', '', '| File | Bucket | Bytes | Lines | SHA-256 |', '|---|---|---:|---:|---|');
  for (const file of report.topFiles) {
    lines.push(`| ${file.file} | ${file.bucket} | ${file.bytes} | ${file.lines ?? ''} | ${file.sha256} |`);
  }

  lines.push('', '## Deletion Gates', '');
  for (const gate of report.deletionGates) {
    lines.push(`- ${gate.root}: owner ${gate.owner}, action ${gate.retentionAction}, deletionSafe ${gate.deletionSafe}, external URI env ${gate.externalArtifactUri.env} present ${gate.externalArtifactUri.present}.`);
  }

  lines.push(
    '',
    '## Policy',
    '',
    '- Do not delete backup or archive roots from the workspace until an external artifact URI, checksum manifest, restore/reference evidence, rollback note, and production guard pass are all present.',
    '- This manifest is a slimming prerequisite, not slimming completion evidence.',
    '- Production runtime size must be discussed through reachable/eager runtime reports, not through retained repository bulk.',
    ''
  );

  return lines.join('\n');
}

function main() {
  const failures = [];
  const entries = [];

  for (const policy of RETENTION_ROOTS) {
    const rootPath = path.join(ROOT, policy.root);
    for (const filePath of walk(rootPath)) {
      entries.push(inspectFile(filePath, policy));
    }
  }

  entries.sort((a, b) => a.file.localeCompare(b.file));

  for (const entry of entries) {
    if (!/^[a-f0-9]{64}$/.test(entry.sha256)) {
      failures.push(`missing or invalid sha256 for ${entry.file}`);
    }
    if (!entry.owner || !entry.bucket || !entry.root) {
      failures.push(`missing ownership metadata for ${entry.file}`);
    }
  }

  if (!entries.length) {
    failures.push('repository bulk retention manifest has no retained files');
  }

  const summary = summarize(entries, RETENTION_ROOTS);
  const deletionGates = RETENTION_ROOTS.map(deletionGate);
  const canonicalManifest = JSON.stringify(entries.map(entry => ({
    file: entry.file,
    root: entry.root,
    bucket: entry.bucket,
    owner: entry.owner,
    bytes: entry.bytes,
    lines: entry.lines,
    sha256: entry.sha256
  })));

  const report = {
    platform: 'Rhautt Nexus / 瑞合数智枢纽',
    generatedAt: new Date().toISOString(),
    status: failures.length ? 'blocked-repository-bulk-retention' : 'pass-manifest-only-not-deletion-safe',
    mode: 'local-retention-manifest',
    externalizationState: 'manifested-local-assets-not-yet-externalized',
    deletionSafe: false,
    totals: {
      files: entries.length,
      bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
      textLines: entries.reduce((sum, entry) => sum + (entry.lines || 0), 0)
    },
    manifestSha256: sha256Text(canonicalManifest),
    summary,
    deletionGates,
    topFiles: [...entries].sort((a, b) => b.bytes - a.bytes).slice(0, 20),
    files: entries,
    failures,
    policy: [
      'Local retained backup/archive files are not product runtime code.',
      'Local retained backup/archive files are not deletion-safe until external artifact storage, checksum proof, restore/reference proof, rollback note, and production guards are current.',
      'This guard may pass while deletionSafe remains false; that is intentional governance, not launch completion.'
    ]
  };

  fs.mkdirSync(path.dirname(JSON_OUTPUT), { recursive: true });
  fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(report)}\n`);
  fs.writeFileSync(MD_OUTPUT, renderMarkdown(report));

  console.log(JSON.stringify({
    status: report.status,
    outputPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MD_OUTPUT),
    files: report.totals.files,
    bytes: report.totals.bytes,
    textLines: report.totals.textLines,
    deletionSafe: report.deletionSafe,
    failures
  }, null, 2));

  if (failures.length) process.exit(1);
}

if (require.main === module) {
  main();
}
