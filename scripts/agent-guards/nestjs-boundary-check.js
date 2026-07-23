/**
 * guard: NestJS 边界检查
 *
 * 规则：2026-06-07 决策后，新业务逻辑必须写在 services/api/src/modules/ 里。
 * 本 guard 检测 server/modules/ 中是否出现了「最近新增」的非 legacy 文件。
 *
 * 判定方法：
 *   - server/modules/ 里除 _ALLOWED_LEGACY 白名单外，若有文件 mtime > FREEZE_TS，报警告
 *   - services/api/src/modules/ 里有新增 .ts 文件 → 正向信号
 *
 * npm run guard:nestjs-boundary
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FREEZE_TS = new Date('2026-06-07T14:00:00Z').getTime(); // 决策时间点

// 允许在 server/modules/ 继续修改的文件（现有 v2 生产模块维护窗口）
const ALLOWED_LEGACY_DIRS = new Set([
  'audit', 'contracts', 'crm', 'diagnosis', 'governance',
  'health', 'lifecycle', 'rysnova-bim', 'system-packs', 'analytics',
  'quotation', 'devices', 'projects',
  'react-candidate',         // 候选面过渡期
  'design',                  // NestJS 迁移完成，server 侧保留遗留兼容
  'outbox', 'security',      // 共享基础设施
  'productModules', 'observability', 'comfort-domain', 'solution-visuals',
  'legacy-api',              // 遗留兼容层
]);

// 顶层允许修改的单文件
const ALLOWED_LEGACY_FILES = new Set([
  'productionAppFactory.js', 'productionMiddleware.js',
  'productionRouteCatalog.js', 'productionRouteRegistrar.js',
  'routeOwnership.js', 'v2.router.js',
  'authRuntime.js', 'dataMasking.js', 'engineRegistry.js',
  'lazyEngine.js', 'runtimeEngineAccess.js', 'runtimeServices.js',
]);

function scanNewFiles(dir, since) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanNewFiles(full, since));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const stat = fs.statSync(full);
      if (stat.mtimeMs > since) results.push(full);
    }
  }
  return results;
}

const serverModulesDir = path.join(ROOT, 'server', 'modules');
const nestDir = path.join(ROOT, 'services', 'api', 'src', 'modules');

// 扫描 server/modules/ 中的新增文件
const violations = [];
for (const entry of fs.readdirSync(serverModulesDir, { withFileTypes: true })) {
  if (ALLOWED_LEGACY_FILES.has(entry.name)) continue;
  if (ALLOWED_LEGACY_DIRS.has(entry.name)) continue;

  const full = path.join(serverModulesDir, entry.name);
  if (entry.isDirectory()) {
    // 新的域目录 → 违规
    const stat = fs.statSync(full);
    if (stat.mtimeMs > FREEZE_TS) {
      violations.push(`NEW DOMAIN DIR: server/modules/${entry.name} — should be in services/api/src/modules/`);
    }
  }
}

// 统计 NestJS 侧进展
const nestFiles = fs.existsSync(nestDir)
  ? fs.readdirSync(nestDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
  : [];
const nestImplemented = nestFiles.filter(name => {
  const dir = path.join(nestDir, name);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'README.md');
  // 超过1个ts文件（不只是module.ts骨架）视为有实现
  return files.length > 1;
});

// ── 分层边界扫描（2026-06-30 · W0-b 扩展，MASTER Part 5）──
// 规则1 apps/* 禁直连 legacy server/；规则2 禁跨应用 import；
// 规则3 services/api 禁 reach-in server/core|server/engines（应走 packages/domain/hvac-kernels）。
const warnings = [];
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.vue']);
const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', '.turbo', 'coverage', '.git', '.cache']);
// 已知 kernel reach-in 基线（W1 精算归位前的技术债，仅告警；W1 完成后应清零）
const KNOWN_KERNEL_REACHIN = new Set([
  'LoadCalculationEngineV3', 'EconetPricingEngine', 'ExportEngine', 'PromotionEngine',
]);
const IMPORT_RE = /(?:require\(|import\(|from\s+|import\s+)['"]([^'"]+)['"]/g;
const RE_REL_SERVER = /^(?:\.\.?\/)+.*\bserver\//;          // 相对路径爬回仓库 server/（排除 bare 如 next/dist/server）
const RE_REL_APPS = /^(?:\.\.?\/)+.*\bapps\/([a-z0-9-]+)\//; // 相对路径进入另一个 app
const RE_KERNEL_REACHIN = /^(?:\.\.?\/)+.*\bserver\/(core|engines)\/([A-Za-z0-9_]+)/;

function scanSource(dir, onImport) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      scanSource(full, onImport);
    } else if (entry.isFile() && SRC_EXT.has(path.extname(entry.name))) {
      const content = fs.readFileSync(full, 'utf8');
      let m;
      while ((m = IMPORT_RE.exec(content))) onImport(full, m[1]);
    }
  }
}

const appsDir = path.join(ROOT, 'apps');
const nestSrcDir = path.join(ROOT, 'services', 'api', 'src');

scanSource(appsDir, (file, spec) => {
  if (RE_REL_SERVER.test(spec)) {
    violations.push(`APP→SERVER: ${path.relative(ROOT, file)} imports "${spec}" — apps 禁直连 legacy server/`);
  }
  const cross = RE_REL_APPS.exec(spec);
  if (cross) {
    const currentApp = path.relative(appsDir, file).split(path.sep)[0];
    if (cross[1] !== currentApp) {
      violations.push(`CROSS-APP: ${path.relative(ROOT, file)} imports "${spec}" — 禁跨应用 import`);
    }
  }
});

scanSource(nestSrcDir, (file, spec) => {
  const m = RE_KERNEL_REACHIN.exec(spec);
  if (!m) return;
  const engine = m[2];
  const where = `${path.relative(ROOT, file)} → server/${m[1]}/${engine}`;
  if (KNOWN_KERNEL_REACHIN.has(engine)) {
    warnings.push(`KERNEL-REACHIN (基线, W1 待清): ${where}`);
  } else {
    violations.push(`KERNEL-REACHIN (新增): ${where} — services/api 应调 packages/domain/hvac-kernels，禁新增 legacy 算法直连`);
  }
});

const ok = violations.length === 0;

console.log(`NestJS Boundary Check:`);
console.log(`  server/modules violations: ${violations.length}`);
console.log(`  NestJS modules (scaffold): ${nestFiles.length}`);
console.log(`  NestJS modules (implemented): ${nestImplemented.length}/${nestFiles.length}`);
if (warnings.length) {
  console.log(`  layered-boundary warnings (baseline): ${warnings.length}`);
  warnings.forEach(w => console.log(`  • ${w}`));
}
if (violations.length) violations.forEach(v => console.log(`  ⚠️  ${v}`));
if (!ok) process.exit(1);
