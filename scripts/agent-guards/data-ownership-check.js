#!/usr/bin/env node
/**
 * guard:data-ownership — Phase 1 repository ownership boundary.
 *
 * Source: docs/dev/rhautt-nexus-brand-marketing-dam-prd.md §Data Ownership.
 * rhautt_comfort owns users, roles, permissions, files, products, content assets,
 * marketing assets, publication records, and brand-site data. Phase 1 must not
 * introduce cross-repository dependencies on CRM-owned auth, permission, storage,
 * product data, DAM, SDKs, or database tables.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const SCAN_ROOTS = [
  'apps',
  'services',
  'packages',
  'scripts',
  'test',
  'tests',
  'docs',
  '.env.example',
  '.env.production.example',
  '.env.nestjs.example',
  'package.json',
  'pnpm-workspace.yaml',
];

const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'dist',
  'build',
  'archive',
  '_archive',
  'exports',
  'evidence',
  'hammer-reports',
]);
const SKIP_FILES = new Set([
  'scripts/agent-guards/data-ownership-check.js',
]);

const ALLOWED_DOC_RHAUTT_CRM = new Set([
  'docs/dev/rhautt-nexus-brand-marketing-dam-prd.md',
]);

const REQUIRED_OWNED_SURFACES = [
  ['auth module', 'services/api/src/modules/auth/auth.module.ts'],
  ['user entity', 'services/api/src/modules/auth/auth.entity.ts'],
  ['permission guard', 'services/api/src/modules/common/roles.guard.ts'],
  ['file storage module', 'services/api/src/modules/file-artifact/file-artifact.module.ts'],
  ['file storage entity', 'services/api/src/modules/file-artifact/file-artifact.entity.ts'],
  ['product data module', 'services/api/src/modules/product-catalog/product-catalog.module.ts'],
  ['product data entity', 'services/api/src/modules/product-catalog/product-catalog.entity.ts'],
  ['content asset taxonomy', 'services/api/src/modules/product-catalog/product-taxonomy.ts'],
  ['marketing asset migration', 'database/postgres/migrations/010_growth_marketing_foundation.sql'],
  ['publication event entity', 'services/api/src/modules/product-catalog/product-catalog.entity.ts'],
  ['brand DAM UI', 'apps/nexus-console/src/components/DamLibraryManager.tsx'],
  ['brand publish UI', 'apps/nexus-console/src/components/BrandPublishManager.tsx'],
  ['brand site registry API', 'services/api/src/modules/brand-registry/brand-registry.controller.ts'],
];

const REQUIRED_CONTENT_MARKERS = [
  ['services/api/src/modules/product-catalog/product-catalog.entity.ts', 'ProductContentEntity'],
  ['services/api/src/modules/product-catalog/product-catalog.entity.ts', 'ProductContentEventEntity'],
  ['services/api/src/modules/product-catalog/product-catalog.service.ts', 'transitionContent'],
  ['services/api/src/modules/product-catalog/product-catalog.service.ts', 'publishDueContent'],
  ['database/postgres/migrations/010_growth_marketing_foundation.sql', 'growth_copy_asset'],
  ['database/postgres/migrations/010_growth_marketing_foundation.sql', 'growth_campaign'],
  ['apps/nexus-console/src/components/DamLibraryManager.tsx', '/api/file-artifact/upload-base64'],
  ['apps/nexus-console/src/components/BrandPublishManager.tsx', '从产品目录与 DAM 同步生成站点数据'],
];

const FORBIDDEN_PATTERNS = [
  {
    name: 'rhautt_crm reference',
    regex: /\brhautt[_-]crm\b|D:[\\/]+Project[\\/]+Red[\\/]+rhautt_crm/i,
    allow: (file) => ALLOWED_DOC_RHAUTT_CRM.has(file),
  },
  {
    name: 'cross-repo shared auth service',
    regex: /\b(shared-auth-service|sharedAuthService|SHARED_AUTH_URL|SHARED_AUTH_ENDPOINT)\b/i,
  },
  {
    name: 'cross-repo shared permission service',
    regex: /\b(shared-permission|shared-permissions|sharedPermissionService|SHARED_PERMISSION_URL|SHARED_PERMISSIONS_URL)\b/i,
  },
  {
    name: 'cross-repo shared file storage service',
    regex: /\b(shared-file-storage|shared-storage-service|sharedFileStorage|SHARED_FILE_STORAGE_URL|SHARED_STORAGE_URL)\b/i,
  },
  {
    name: 'cross-repo shared product data service',
    regex: /\b(shared-product-data|shared-product-service|sharedProductData|SHARED_PRODUCT_DATA_URL|SHARED_PRODUCT_SERVICE_URL)\b/i,
  },
  {
    name: 'cross-repo shared DAM service',
    regex: /\b(shared-dam|sharedDam|SHARED_DAM_URL|SHARED_DAM_SERVICE_URL)\b/i,
  },
  {
    name: 'cross-repo shared SDK',
    regex: /\b(shared-sdk|rhautt-crm-sdk|rhautt_crm_sdk|@rhautt-crm\/|@rhautt\/crm-sdk)\b/i,
  },
  {
    name: 'CRM-owned database URL',
    regex: /\b(RHAUTT_CRM_DATABASE_URL|RHAUTT_CRM_DB|CRM_DATABASE_URL|CRM_DB_URL)\b/,
  },
];

const failures = [];
const warnings = [];
const scannedFiles = [];

function normalize(rel) {
  return rel.split(path.sep).join('/');
}

function abs(rel) {
  return path.join(ROOT, rel);
}

function exists(rel) {
  return fs.existsSync(abs(rel));
}

function read(rel) {
  return fs.readFileSync(abs(rel), 'utf8');
}

function walk(entry) {
  const absolute = abs(entry);
  if (!fs.existsSync(absolute)) return;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    for (const dirent of fs.readdirSync(absolute, { withFileTypes: true })) {
      if (dirent.isDirectory() && SKIP_DIRS.has(dirent.name)) continue;
      walk(path.join(entry, dirent.name));
    }
    return;
  }
  if (!stat.isFile()) return;
  if (!/\.(js|jsx|ts|tsx|mjs|cjs|json|md|yml|yaml|env|example|sql|txt)$/.test(entry)) return;
  const rel = normalize(entry);
  if (SKIP_FILES.has(rel)) return;
  scannedFiles.push(rel);
}

for (const root of SCAN_ROOTS) walk(root);

for (const file of scannedFiles) {
  let src = '';
  try {
    src = read(file);
  } catch (error) {
    warnings.push(`${file}: skipped unreadable file (${error.message})`);
    continue;
  }
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.regex.test(src) && !(pattern.allow && pattern.allow(file, src))) {
      failures.push(`${file}: forbidden ${pattern.name}`);
    }
  }
}

for (const [label, file] of REQUIRED_OWNED_SURFACES) {
  if (!exists(file)) failures.push(`missing owned ${label}: ${file}`);
}

for (const [file, marker] of REQUIRED_CONTENT_MARKERS) {
  if (!exists(file)) {
    failures.push(`missing marker file: ${file}`);
    continue;
  }
  if (!read(file).includes(marker)) failures.push(`${file}: missing ownership marker ${marker}`);
}

if (exists('packages/shared-auth/package.json')) {
  const pkg = JSON.parse(read('packages/shared-auth/package.json'));
  if (pkg.private !== true) failures.push('packages/shared-auth must remain private to this repository');
  if (pkg.name !== '@rhautt/shared-auth') failures.push('packages/shared-auth package name changed unexpectedly');
} else {
  failures.push('missing private workspace cookie helper: packages/shared-auth/package.json');
}

for (const file of scannedFiles.filter((f) => /package\.json$/.test(f))) {
  const pkg = JSON.parse(read(file));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const value = pkg[field]?.['@rhautt/shared-auth'];
    if (value !== undefined && value !== 'workspace:*') {
      failures.push(`${file}: @rhautt/shared-auth must resolve to workspace:* only`);
    }
  }
}

console.log(`Data Ownership Check: files=${scannedFiles.length}, failures=${failures.length}, warnings=${warnings.length}`);
for (const warning of warnings) console.warn(`- warning: ${warning}`);
for (const failure of failures) console.error(`- ${failure}`);
process.exit(failures.length ? 1 : 0);
