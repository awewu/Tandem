#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('./_artifact-gate').requireArtifactOrSkip('archive/legacy-ui/public/legacy-surface-manifest.json', {
  guard: 'guard:code-size-trunk', reason: '遗留 UI 已归档移除，archive/ 在 .gitignore 且无生成步骤',
});
const { ACTIVE_HTML_PATHS } = require('../../server/middleware/productionStaticSurfaceGuard');
const { getProductionRouteCatalogMountMetadata } = require('../../server/modules/productionRouteCatalog');

const ROOT = path.join(__dirname, '..', '..');
const MANIFEST_PATH = path.join(ROOT, 'archive', 'legacy-ui', 'public', 'legacy-surface-manifest.json');
const JSON_OUTPUT = path.join(ROOT, 'audit', 'code-size-trunk-report.json');
const MD_OUTPUT = path.join(ROOT, 'audit', 'code-size-trunk-report.md');

const INCLUDED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.html',
  '.css',
  '.json',
  '.md',
  '.sql',
  '.svg'
]);

const PRUNE_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo'
]);

const PRODUCTION_TRUNK_PREFIXES = [
  'server/modules/',
  'server/middleware/',
  'server/repositories/',
  'server/models/',
  'server/routes/',
  'server/fixtures/',
  'server/db/',
  'apps/',
  'packages/',
  'archive/legacy-ui/public/css/',
  'archive/legacy-ui/public/shared/',
  'archive/legacy-ui/public/js/'
];

const COMPATIBILITY_RUNTIME_PREFIXES = [
  'server/core/',
  'server/engines/',
  'server/services/',
  'server/api/',
  'server/admin/',
  'server/utils/'
];

const COMPATIBILITY_TRUNK_FILES = new Set([
  'server-production.js',
  'server/index.js',
  'server/db/index.js',
  'package.json',
  'nx.json',
  'tsconfig.base.json',
  'pnpm-workspace.yaml'
]);

const LEGACY_RUNTIME_SNAPSHOT_FILES = new Set([
  'server-production-fixed.js',
  'server-production-v7.js'
]);

const DESKTOP_SHELL_FILES = new Set([
  'electron-main.js',
  'main.js',
  'preload.js',
  'preload-simple.js',
  'package-electron.json'
]);

const EVIDENCE_PREFIXES = ['audit/', 'evidence/'];
const DOC_PREFIXES = ['docs/', 'README.md', 'CLAUDE.md', 'PRD-CURRENT.md', 'PRODUCT-SCOPE.md', 'PROJECT-DELIVERY.md', 'progress.md'];
const GOVERNANCE_PREFIXES = ['governance/', '.claude/', '.github/', 'skills/'];
const BACKUP_PREFIXES = ['backups/'];
const CANDIDATE_PREFIXES = ['frontend/'];
const ARCHIVE_PREFIXES = ['_archive/', 'archive/', 'server/archive/', 'commercial-hvac-design/'];
const DATA_PREFIXES = ['data/', 'database/'];
const CONTRACT_PREFIXES = ['contracts/'];
const TEST_PREFIXES = ['test/', 'test-data/'];
const GENERATED_APP_ARTIFACT_PREFIXES = ['exports/', 'storage/'];
const DELIVERY_TOOLING_PREFIXES = ['scripts/agent-guards/', 'scripts/release/', 'scripts/contracts/'];
const DEV_TOOLING_PREFIXES = ['scripts/', 'docker/', '.hermes/', '.windsurf/', 'hammer-reports/'];
const ROOT_DOC_OR_REPORT_PATTERN = /^(?:.*(?:REPORT|PLAN|GUIDE|CHECKLIST|AUDIT|SUMMARY|REVIEW|ANALYSIS|ROADMAP|DELIVERY|PRD|PROGRESS|INVENTORY|TASK|VALIDATION|EVOLUTION|RYSNOVA|COMPETITOR|SYSTEM|PROJECT|REFACTOR|SPRINT|HAMMER|ACCEPTANCE|DEPLOY|INSPECTION|HANDOFF).*\.(?:md|json|txt)|.+\.bat|.+\.ps1)$/i;
const ROOT_SUPPORT_FILES = new Set([
  'package-lock.json',
  'package-electron.json',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  'Dockerfile',
  'Dockerfile.backend',
  'Dockerfile.frontend',
  'jest.config.js',
  'vite.config.js',
  'tailwind.config.js',
  'tsconfig.json',
  '.eslintrc.json',
  '.prettierrc',
  '.hintrc',
  '.env.example',
  '.env.production'
]);

let acorn = null;
try {
  acorn = require('acorn');
} catch (error) {
  acorn = null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function slash(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (PRUNE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (INCLUDED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(slash(path.relative(ROOT, full)));
    }
  }
  return files;
}

function lineCount(relativePath) {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  if (!text.length) return 0;
  return text.split(/\r?\n/).length;
}

function isRuntimeScriptFile(relativePath) {
  return ['.js', '.jsx', '.ts', '.tsx'].includes(path.extname(relativePath));
}

function sumRuntimeScriptLines(items) {
  return items
    .filter(item => isRuntimeScriptFile(item.file))
    .reduce((sum, item) => sum + item.lines, 0);
}

function countRuntimeScriptFiles(items) {
  return items.filter(item => isRuntimeScriptFile(item.file)).length;
}

function resolveLocalRequire(fromRelativePath, specifier) {
  if (!specifier.startsWith('.')) return null;

  const fromDir = path.dirname(path.join(ROOT, fromRelativePath));
  const basePath = path.resolve(fromDir, specifier);
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.json`,
    `${basePath}.ts`,
    path.join(basePath, 'index.js'),
    path.join(basePath, 'index.json'),
    path.join(basePath, 'index.ts')
  ];

  for (const candidate of candidates) {
    if (!candidate.startsWith(ROOT)) continue;
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) continue;
    const relativePath = slash(path.relative(ROOT, candidate));
    if (INCLUDED_EXTENSIONS.has(path.extname(relativePath))) return relativePath;
  }

  return null;
}

function collectLocalRequires(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const ext = path.extname(relativePath);
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return { resolved: [], unresolved: [] };

  const text = fs.readFileSync(absolutePath, 'utf8');
  return collectRequiresFromText(relativePath, text);
}

function collectTopLevelLocalRequires(relativePath) {
  const absolutePath = path.join(ROOT, relativePath);
  const ext = path.extname(relativePath);
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return { resolved: [], unresolved: [] };

  const text = fs.readFileSync(absolutePath, 'utf8');
  const astRequires = collectTopLevelRequiresWithAst(relativePath, text);
  if (astRequires) return astRequires;

  const firstNestedBlock = text.search(/\n\s*(?:function|class|async function)\s+/);
  const topLevelText = firstNestedBlock >= 0 ? text.slice(0, firstNestedBlock) : text;
  return collectRequiresFromText(relativePath, topLevelText);
}

function collectTopLevelRequiresWithAst(relativePath, text) {
  if (!acorn) return null;

  let ast;
  try {
    ast = acorn.parse(text, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      allowHashBang: true
    });
  } catch (error) {
    return null;
  }

  const specifiers = [];

  function isFunctionNode(node) {
    return node && [
      'FunctionDeclaration',
      'FunctionExpression',
      'ArrowFunctionExpression'
    ].includes(node.type);
  }

  function isClassNode(node) {
    return node && ['ClassDeclaration', 'ClassExpression'].includes(node.type);
  }

  function isRequireCall(node) {
    return node &&
      node.type === 'CallExpression' &&
      node.callee &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'require' &&
      node.arguments &&
      node.arguments.length === 1 &&
      node.arguments[0].type === 'Literal' &&
      typeof node.arguments[0].value === 'string';
  }

  function isImmediateFunctionCall(node) {
    return node &&
      node.type === 'CallExpression' &&
      isFunctionNode(node.callee);
  }

  function visit(node, options = {}) {
    if (!node || typeof node.type !== 'string') return;

    if (isRequireCall(node)) {
      specifiers.push(node.arguments[0].value);
      return;
    }

    if (isFunctionNode(node) && !options.allowFunctionBody) return;
    if (isClassNode(node)) return;

    if (node.type === 'CallExpression') {
      if (isImmediateFunctionCall(node)) {
        visit(node.callee.body, { allowFunctionBody: true });
      } else {
        visit(node.callee);
      }
      for (const argument of node.arguments || []) visit(argument);
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc' || key === 'range') continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child.type === 'string') visit(child);
        }
      } else if (value && typeof value.type === 'string') {
        visit(value);
      }
    }
  }

  visit(ast);
  return resolveRequireSpecifiers(relativePath, specifiers);
}

function collectRequiresFromText(relativePath, text) {
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const specifiers = [];
  let match;

  while ((match = requirePattern.exec(text))) {
    specifiers.push(match[1]);
  }

  return resolveRequireSpecifiers(relativePath, specifiers);
}

function resolveRequireSpecifiers(relativePath, specifiers) {
  const resolved = [];
  const unresolved = [];

  for (const specifier of specifiers) {
    if (!specifier.startsWith('.')) continue;
    const target = resolveLocalRequire(relativePath, specifier);
    if (target) resolved.push(target);
    else unresolved.push({ from: relativePath, specifier });
  }

  return { resolved, unresolved };
}

function getRouteCatalogRuntimeEntries() {
  try {
    return getProductionRouteCatalogMountMetadata()
      .map(entry => resolveLocalRequire('server/modules/productionRouteCatalog.js', entry.modulePath))
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

function buildReachableRuntimeGraph(entryFiles) {
  const visited = new Set();
  const unresolved = [];
  const stack = [...entryFiles];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    if (!fs.existsSync(path.join(ROOT, current))) continue;
    visited.add(current);

    const requires = collectLocalRequires(current);
    unresolved.push(...requires.unresolved);
    for (const target of requires.resolved) {
      if (!visited.has(target)) stack.push(target);
    }
  }

  return {
    files: visited,
    unresolved
  };
}

function buildEagerRuntimeGraph(entryFiles) {
  const visited = new Set();
  const unresolved = [];
  const stack = [...entryFiles];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    if (!fs.existsSync(path.join(ROOT, current))) continue;
    visited.add(current);

    const requires = collectTopLevelLocalRequires(current);
    unresolved.push(...requires.unresolved);
    for (const target of requires.resolved) {
      if (!visited.has(target)) stack.push(target);
    }
  }

  return {
    files: visited,
    unresolved
  };
}

function startsWithAny(relativePath, prefixes) {
  return prefixes.some(prefix => relativePath === prefix || relativePath.startsWith(prefix));
}

function buildHtmlClassification() {
  const manifest = readJson(MANIFEST_PATH);
  const buckets = {};
  for (const [bucket, files] of Object.entries(manifest.surfaces || {})) {
    for (const file of files || []) buckets[file] = bucket;
  }
  return buckets;
}

function classify(relativePath, htmlBuckets) {
  if (startsWithAny(relativePath, BACKUP_PREFIXES)) return 'backup-excluded';
  if (startsWithAny(relativePath, ARCHIVE_PREFIXES)) return 'archive-excluded';
  if (startsWithAny(relativePath, EVIDENCE_PREFIXES)) return 'generated-evidence';
  if (startsWithAny(relativePath, GENERATED_APP_ARTIFACT_PREFIXES)) return 'generated-app-artifacts';
  if (startsWithAny(relativePath, DOC_PREFIXES)) return 'documentation';
  if (startsWithAny(relativePath, GOVERNANCE_PREFIXES)) return 'governance';
  if (startsWithAny(relativePath, TEST_PREFIXES)) return 'test-fixtures-and-tests';
  if (startsWithAny(relativePath, CONTRACT_PREFIXES)) return 'contracts-and-schemas';
  if (startsWithAny(relativePath, DELIVERY_TOOLING_PREFIXES)) return 'delivery-tooling';
  if (startsWithAny(relativePath, DEV_TOOLING_PREFIXES)) return 'dev-tooling-and-agent-knowledge';
  if (startsWithAny(relativePath, DATA_PREFIXES)) {
    return relativePath.startsWith('database/postgres/') ? 'database-contracts' : 'data-fixtures';
  }
  if (startsWithAny(relativePath, CANDIDATE_PREFIXES)) return 'candidate-surface';
  if (LEGACY_RUNTIME_SNAPSHOT_FILES.has(relativePath)) return 'root-legacy-runtime-snapshot';
  if (DESKTOP_SHELL_FILES.has(relativePath)) return 'desktop-shell';
  if (ROOT_SUPPORT_FILES.has(relativePath)) return 'root-support';
  if (!relativePath.includes('/') && ROOT_DOC_OR_REPORT_PATTERN.test(relativePath)) return 'root-legacy-report';
  if (relativePath.startsWith('archive/legacy-ui/public/') && relativePath.endsWith('.html')) {
    const bucket = htmlBuckets[relativePath] || 'unclassified-html';
    return bucket === 'active' ? 'production-active-page' : `legacy-html-${bucket}`;
  }
  if (startsWithAny(relativePath, COMPATIBILITY_RUNTIME_PREFIXES)) {
    return 'production-compatibility-runtime';
  }
  if (COMPATIBILITY_TRUNK_FILES.has(relativePath) || startsWithAny(relativePath, PRODUCTION_TRUNK_PREFIXES)) {
    return 'production-trunk';
  }
  return 'supporting-code';
}

function summarize(files, htmlBuckets) {
  const buckets = {};
  const topFiles = [];
  for (const file of files) {
    const lines = lineCount(file);
    const bucket = classify(file, htmlBuckets);
    buckets[bucket] ||= { files: 0, lines: 0 };
    buckets[bucket].files += 1;
    buckets[bucket].lines += lines;
    topFiles.push({ file, bucket, lines });
  }
  topFiles.sort((a, b) => b.lines - a.lines);
  return { buckets, topFiles };
}

function renderMarkdown(report) {
  const lines = [
    '# Code Size Trunk Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'This report separates production trunk code from legacy HTML, generated evidence, documentation, governance, backups, and candidate surfaces.',
    '',
    '## Summary',
    '',
    `- Total scanned lines: ${report.totals.lines}`,
    `- Production runtime lines: ${report.productionRuntimeLines}`,
    `- Production web core lines: ${report.productionWebCoreLines}`,
    `- Production compatibility runtime lines: ${report.productionCompatibilityRuntimeLines}`,
    `- Production reachable compatibility lines: ${report.productionReachableCompatibilityLines}`,
    `- Production unreachable compatibility inventory lines: ${report.productionUnreachableCompatibilityInventoryLines}`,
    `- Production reachable runtime lines: ${report.productionReachableRuntimeLines}`,
    `- Production reachable runtime files: ${report.productionReachableRuntimeFiles}`,
    `- Production reachable JS runtime lines: ${report.productionReachableJsRuntimeLines}`,
    `- Production reachable JS runtime files: ${report.productionReachableJsRuntimeFiles}`,
    `- Production eager runtime lines: ${report.productionEagerRuntimeLines}`,
    `- Production eager runtime files: ${report.productionEagerRuntimeFiles}`,
    `- Production eager JS runtime lines: ${report.productionEagerJsRuntimeLines}`,
    `- Production eager JS runtime files: ${report.productionEagerJsRuntimeFiles}`,
    `- Legacy dev server reachable lines: ${report.legacyDevServerReachableLines}`,
    `- Legacy dev server eager lines: ${report.legacyDevServerEagerLines}`,
    `- Production active page lines: ${report.productionActivePageLines}`,
    `- Production trunk lines: ${report.productionTrunkLines}`,
    `- Legacy HTML lines: ${report.legacyHtmlLines}`,
    `- Generated evidence lines: ${report.buckets['generated-evidence']?.lines || 0}`,
    `- Generated app artifact lines: ${report.buckets['generated-app-artifacts']?.lines || 0}`,
    `- Backup lines: ${report.buckets['backup-excluded']?.lines || 0}`,
    '',
    '## Delivery Size Budget',
    '',
    '| Metric | Current | Budget | Status | Meaning |',
    '|---|---:|---:|---|---|'
  ];

  for (const budget of report.deliverySizeBudget) {
    lines.push(`| ${budget.metric} | ${budget.current} | ${budget.budget} | ${budget.status} | ${budget.meaning.replace(/\|/g, '\\|')} |`);
  }

  lines.push(
    '',
    '## Runtime Interpretation',
    '',
    '- `productionRuntimeLines` includes compatibility engines because `server-production.js` still reaches them through route and engine registries.',
    '- `productionReachableCompatibilityLines` is the current compatibility debt actually reachable from the production route catalog.',
    '- `productionUnreachableCompatibilityInventoryLines` is retained compatibility inventory that is not reached by the current production route graph and needs migrate/archive/delete decisions.',
    '- `productionWebCoreLines` is the slimmer web trunk count: active static pages plus the modular server/app/package trunk.',
    '- `productionReachableRuntimeLines` is a static CommonJS reachability scan from the production server entry and route catalog.',
    '- `productionEagerRuntimeLines` includes production startup CommonJS dependencies plus active HTML page assets; `productionEagerJsRuntimeLines` is the actual JS startup subset.',
    '- `productionEagerJsRuntimeLines` only follows top-level CommonJS requires from `server-production.js`; lazy facades and lazy route handlers should reduce this number.',
    '- `legacyDevServer*` metrics keep `server/index.js` visible as development/legacy compatibility debt without counting it as production startup.',
    '- Compatibility runtime is not deletion-safe until the NestJS/Fastify target modules replace it with contract and E2E evidence.',
    '',
    '## Buckets',
    '',
    '| Bucket | Files | Lines |',
    '|---|---:|---:|'
  );

  for (const [bucket, summary] of Object.entries(report.buckets).sort((a, b) => b[1].lines - a[1].lines)) {
    lines.push(`| ${bucket} | ${summary.files} | ${summary.lines} |`);
  }

  lines.push('', '## Top Files', '', '| File | Bucket | Lines |', '|---|---|---:|');
  for (const item of report.topFiles.slice(0, 30)) {
    lines.push(`| ${item.file.replace(/\|/g, '\\|')} | ${item.bucket} | ${item.lines} |`);
  }

  lines.push('', '## Top Reachable Runtime Files', '', '| File | Lines |', '|---|---:|');
  for (const item of report.reachableRuntimeTopFiles.slice(0, 30)) {
    lines.push(`| ${item.file.replace(/\|/g, '\\|')} | ${item.lines} |`);
  }

  lines.push('', '## Top Eager Runtime Files', '', '| File | Lines |', '|---|---:|');
  for (const item of report.eagerRuntimeTopFiles.slice(0, 30)) {
    lines.push(`| ${item.file.replace(/\|/g, '\\|')} | ${item.lines} |`);
  }

  lines.push(
    '',
    '## Policy',
    '',
    '- Production claims must cite production runtime lines, not total workspace lines.',
    '- Runtime claims must include `production-compatibility-runtime` while legacy engines remain on the live startup path.',
    '- Legacy HTML is retained as classified asset inventory until migrated, wrapped, archived, or retired with evidence.',
    '- Generated evidence, SBOM, audit reports, backups, and docs are delivery assets, not production runtime code.',
    '- `server-production.js` remains compatibility trunk until the target NestJS/Fastify boot proof replaces it.',
    ''
  );

  return lines.join('\n');
}

function main() {
  const generatedSizeReports = new Set([
    'audit/code-size-trunk-report.json',
    'audit/code-size-trunk-report.md',
    'audit/workspace-size-governance-report.json',
    'audit/workspace-size-governance-report.md'
  ]);
  const files = walk(ROOT).filter(file => !generatedSizeReports.has(file));
  const htmlBuckets = buildHtmlClassification();
  const { buckets, topFiles } = summarize(files, htmlBuckets);
  const totals = Object.values(buckets).reduce(
    (acc, bucket) => ({ files: acc.files + bucket.files, lines: acc.lines + bucket.lines }),
    { files: 0, lines: 0 }
  );
  const legacyHtmlLines = Object.entries(buckets)
    .filter(([bucket]) => bucket.startsWith('legacy-html-'))
    .reduce((sum, [, bucket]) => sum + bucket.lines, 0);
  const productionWebCoreLines =
    (buckets['production-active-page']?.lines || 0) +
    (buckets['production-trunk']?.lines || 0);
  const productionActivePageLines = buckets['production-active-page']?.lines || 0;
  const productionTrunkLines = buckets['production-trunk']?.lines || 0;
  const productionCompatibilityRuntimeLines = buckets['production-compatibility-runtime']?.lines || 0;
  const productionRuntimeLines = productionWebCoreLines + productionCompatibilityRuntimeLines;
  const reachableRuntimeEntryFiles = [
    'server-production.js',
    ...getRouteCatalogRuntimeEntries()
  ];
  const eagerRuntimeEntryFiles = [
    'server-production.js'
  ];
  const legacyDevServerEntryFiles = [
    'server/index.js'
  ];
  const reachableRuntimeGraph = buildReachableRuntimeGraph(reachableRuntimeEntryFiles);
  const eagerRuntimeGraph = buildEagerRuntimeGraph(eagerRuntimeEntryFiles);
  const legacyDevServerReachableGraph = buildReachableRuntimeGraph(legacyDevServerEntryFiles);
  const legacyDevServerEagerGraph = buildEagerRuntimeGraph(legacyDevServerEntryFiles);
  for (const activePath of ACTIVE_HTML_PATHS) {
    reachableRuntimeGraph.files.add(`public${activePath}`);
    eagerRuntimeGraph.files.add(`public${activePath}`);
  }
  const reachableRuntimeTopFiles = [...reachableRuntimeGraph.files]
    .filter(file => fs.existsSync(path.join(ROOT, file)) && INCLUDED_EXTENSIONS.has(path.extname(file)))
    .map(file => ({ file, lines: lineCount(file) }))
    .sort((a, b) => b.lines - a.lines);
  const productionReachableRuntimeLines = reachableRuntimeTopFiles.reduce((sum, item) => sum + item.lines, 0);
  const productionReachableJsRuntimeLines = sumRuntimeScriptLines(reachableRuntimeTopFiles);
  const productionReachableJsRuntimeFiles = countRuntimeScriptFiles(reachableRuntimeTopFiles);
  const reachableRuntimeFiles = new Set(reachableRuntimeTopFiles.map(item => item.file));
  const compatibilityRuntimeFiles = topFiles.filter(item => item.bucket === 'production-compatibility-runtime');
  const productionReachableCompatibilityTopFiles = compatibilityRuntimeFiles
    .filter(item => reachableRuntimeFiles.has(item.file))
    .sort((a, b) => b.lines - a.lines);
  const productionUnreachableCompatibilityInventoryTopFiles = compatibilityRuntimeFiles
    .filter(item => !reachableRuntimeFiles.has(item.file))
    .sort((a, b) => b.lines - a.lines);
  const productionReachableCompatibilityLines = productionReachableCompatibilityTopFiles
    .reduce((sum, item) => sum + item.lines, 0);
  const productionUnreachableCompatibilityInventoryLines = productionUnreachableCompatibilityInventoryTopFiles
    .reduce((sum, item) => sum + item.lines, 0);
  const eagerRuntimeTopFiles = [...eagerRuntimeGraph.files]
    .filter(file => fs.existsSync(path.join(ROOT, file)) && INCLUDED_EXTENSIONS.has(path.extname(file)))
    .map(file => ({ file, lines: lineCount(file) }))
    .sort((a, b) => b.lines - a.lines);
  const productionEagerRuntimeLines = eagerRuntimeTopFiles.reduce((sum, item) => sum + item.lines, 0);
  const productionEagerJsRuntimeLines = sumRuntimeScriptLines(eagerRuntimeTopFiles);
  const productionEagerJsRuntimeFiles = countRuntimeScriptFiles(eagerRuntimeTopFiles);
  const legacyDevServerReachableTopFiles = [...legacyDevServerReachableGraph.files]
    .filter(file => fs.existsSync(path.join(ROOT, file)) && INCLUDED_EXTENSIONS.has(path.extname(file)))
    .map(file => ({ file, lines: lineCount(file) }))
    .sort((a, b) => b.lines - a.lines);
  const legacyDevServerReachableLines = legacyDevServerReachableTopFiles.reduce((sum, item) => sum + item.lines, 0);
  const legacyDevServerEagerTopFiles = [...legacyDevServerEagerGraph.files]
    .filter(file => fs.existsSync(path.join(ROOT, file)) && INCLUDED_EXTENSIONS.has(path.extname(file)))
    .map(file => ({ file, lines: lineCount(file) }))
    .sort((a, b) => b.lines - a.lines);
  const legacyDevServerEagerLines = legacyDevServerEagerTopFiles.reduce((sum, item) => sum + item.lines, 0);

  const activePageFiles = new Set([...ACTIVE_HTML_PATHS].map(pathName => `public${pathName}`));
  const activeManifestFiles = new Set(Object.entries(htmlBuckets).filter(([, bucket]) => bucket === 'active').map(([file]) => file));
  const activeMismatch = [
    ...[...activePageFiles].filter(file => !activeManifestFiles.has(file)),
    ...[...activeManifestFiles].filter(file => !activePageFiles.has(file))
  ];

  const thresholds = {
    warningProductionCountedLines: 120000,
    warningProductionRuntimeLines: 90000,
    warningLegacyHtmlLines: 90000,
    maxProductionReachableRuntimeLines: 60000,
    maxProductionReachableJsRuntimeLines: 35000,
    maxProductionEagerRuntimeLines: 20000,
    maxProductionEagerJsRuntimeLines: 5000,
    maxProductionReachableCompatibilityLines: 15000,
    maxProductionActivePageLines: 15000,
    note: 'Warnings are deliberately non-failing while the rewrite is in transition; active classification drift and production delivery budget breaches are failing.'
  };
  const warnings = [];
  if (productionRuntimeLines > thresholds.warningProductionRuntimeLines) {
    warnings.push(`production runtime lines exceed warning threshold: ${productionRuntimeLines}`);
  }
  if (legacyHtmlLines > thresholds.warningLegacyHtmlLines) {
    warnings.push(`legacy HTML lines exceed warning threshold: ${legacyHtmlLines}`);
  }
  const deliverySizeBudget = [
    {
      metric: 'productionReachableRuntimeLines',
      current: productionReachableRuntimeLines,
      budget: thresholds.maxProductionReachableRuntimeLines,
      meaning: 'Static reachable runtime from the production entry, route catalog, and active pages.'
    },
    {
      metric: 'productionReachableJsRuntimeLines',
      current: productionReachableJsRuntimeLines,
      budget: thresholds.maxProductionReachableJsRuntimeLines,
      meaning: 'Reachable JavaScript/TypeScript runtime only, excluding active HTML markup.'
    },
    {
      metric: 'productionEagerRuntimeLines',
      current: productionEagerRuntimeLines,
      budget: thresholds.maxProductionEagerRuntimeLines,
      meaning: 'Startup path plus active pages; this is the main production boot-size control.'
    },
    {
      metric: 'productionEagerJsRuntimeLines',
      current: productionEagerJsRuntimeLines,
      budget: thresholds.maxProductionEagerJsRuntimeLines,
      meaning: 'Actual eager JavaScript startup path from server-production.js.'
    },
    {
      metric: 'productionReachableCompatibilityLines',
      current: productionReachableCompatibilityLines,
      budget: thresholds.maxProductionReachableCompatibilityLines,
      meaning: 'Legacy compatibility debt still reachable from production routes.'
    },
    {
      metric: 'productionActivePageLines',
      current: productionActivePageLines,
      budget: thresholds.maxProductionActivePageLines,
      meaning: 'Currently active public HTML surfaces while the target monorepo is being built.'
    }
  ].map(item => ({
    ...item,
    status: item.current <= item.budget ? 'pass' : 'fail'
  }));
  const sizeBudgetFailures = deliverySizeBudget
    .filter(item => item.status === 'fail')
    .map(item => `${item.metric} exceeds budget ${item.budget}: ${item.current}`);

  const report = {
    generatedAt: new Date().toISOString(),
    status: activeMismatch.length
      ? 'blocked-active-classification-mismatch'
      : sizeBudgetFailures.length
        ? 'blocked-production-size-budget'
        : 'pass-with-size-observations',
    totals,
    productionRuntimeLines,
    productionWebCoreLines,
    productionActivePageLines,
    productionTrunkLines,
    productionCompatibilityRuntimeLines,
    productionReachableCompatibilityLines,
    productionReachableCompatibilityFiles: productionReachableCompatibilityTopFiles.length,
    productionUnreachableCompatibilityInventoryLines,
    productionUnreachableCompatibilityInventoryFiles: productionUnreachableCompatibilityInventoryTopFiles.length,
    productionReachableRuntimeLines,
    productionReachableRuntimeFiles: reachableRuntimeTopFiles.length,
    productionReachableJsRuntimeLines,
    productionReachableJsRuntimeFiles,
    productionEagerRuntimeLines,
    productionEagerRuntimeFiles: eagerRuntimeTopFiles.length,
    productionEagerJsRuntimeLines,
    productionEagerJsRuntimeFiles,
    legacyDevServerReachableLines,
    legacyDevServerReachableFiles: legacyDevServerReachableTopFiles.length,
    legacyDevServerEagerLines,
    legacyDevServerEagerFiles: legacyDevServerEagerTopFiles.length,
    legacyDevServerReachableTopFiles,
    legacyDevServerEagerTopFiles,
    reachableRuntimeUnresolvedRequires: reachableRuntimeGraph.unresolved.slice(0, 50),
    eagerRuntimeUnresolvedRequires: eagerRuntimeGraph.unresolved.slice(0, 50),
    legacyHtmlLines,
    activeMismatch,
    thresholds,
    deliverySizeBudget,
    sizeBudgetFailures,
    warnings,
    buckets,
    topFiles,
    reachableRuntimeTopFiles,
    eagerRuntimeTopFiles,
    productionReachableCompatibilityTopFiles,
    productionUnreachableCompatibilityInventoryTopFiles
  };

  fs.mkdirSync(path.dirname(JSON_OUTPUT), { recursive: true });
  fs.writeFileSync(JSON_OUTPUT, JSON.stringify(report, null, 2));
  fs.writeFileSync(MD_OUTPUT, renderMarkdown(report));

  console.log(JSON.stringify({
    status: report.status,
    outputPath: path.relative(ROOT, JSON_OUTPUT),
    markdownPath: path.relative(ROOT, MD_OUTPUT),
    productionRuntimeLines,
    productionWebCoreLines,
    productionActivePageLines,
    productionTrunkLines,
    productionCompatibilityRuntimeLines,
    productionReachableCompatibilityLines,
    productionReachableCompatibilityFiles: productionReachableCompatibilityTopFiles.length,
    productionUnreachableCompatibilityInventoryLines,
    productionUnreachableCompatibilityInventoryFiles: productionUnreachableCompatibilityInventoryTopFiles.length,
    productionReachableRuntimeLines,
    productionReachableRuntimeFiles: reachableRuntimeTopFiles.length,
    productionReachableJsRuntimeLines,
    productionReachableJsRuntimeFiles,
    productionEagerRuntimeLines,
    productionEagerRuntimeFiles: eagerRuntimeTopFiles.length,
    productionEagerJsRuntimeLines,
    productionEagerJsRuntimeFiles,
    legacyDevServerReachableLines,
    legacyDevServerEagerLines,
    legacyHtmlLines,
    sizeBudgetFailures,
    warnings: report.warnings
  }, null, 2));

  if (report.status.startsWith('blocked')) process.exit(1);
}

if (require.main === module) {
  main();
}
