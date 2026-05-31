/**
 * Dead-code scanner · 死代码巡检工具
 *
 * 用途: 在 lib/ 和 components/ 里找出"任何地方都没被 import 的模块"。
 *
 * 方法: 构建全量引用图 —— 解析 `import/export ... from`、动态 `import()`、`require()`,
 *   解析 @/ 别名 + 相对路径 + barrel index + 多扩展名, 覆盖 app/lib/components/hooks/
 *   types/tests/scripts 全部源码。Next.js 约定入口 (page/route/layout/...) 视为入口不计。
 *
 * 局限 (会漏报, 不会误判已被引用的): 无法发现纯字符串动态路径 (如 next/dynamic 传变量)、
 *   仅在注释里提到的引用。删除前仍需人工二次确认。
 *
 * 用法:
 *   node scripts/scan-unused.mjs            # 列出结果, 退出码恒为 0
 *   node scripts/scan-unused.mjs --strict   # 有"真死代码"(排除白名单)时退出码 1, 供 CI 用
 *
 * 白名单 (DORMANT): 有意休眠的预留接入口/未来版本模块, 不算死代码, 单独分组显示。
 */
import fs from 'fs';
import path from 'path';

const STRICT = process.argv.includes('--strict');

const exts = ['.ts', '.tsx', '.js', '.jsx'];
const roots = ['app', 'lib', 'components', 'hooks', 'types', 'middleware.ts', 'tests', 'scripts'];

// 有意休眠: 预留集成接入口 + 未来版本模块 (文件头均注明启用步骤/版本)。报告但不计入 --strict。
const DORMANT = [
  /^lib\/integrations\//,
  /^lib\/multi-tenant\//,
];

const all = [];
function walk(d) {
  if (!fs.existsSync(d)) return;
  const st = fs.statSync(d);
  if (st.isFile()) { if (exts.includes(path.extname(d))) all.push(d.replace(/\\/g, '/')); return; }
  for (const f of fs.readdirSync(d, { withFileTypes: true })) walk(path.join(d, f.name));
}
roots.forEach(walk);

const fileSet = new Set(all);
const contents = Object.fromEntries(all.map((f) => [f, fs.readFileSync(f, 'utf8')]));

// resolve a module specifier from an importing file -> canonical file path in fileSet
function resolve(fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.join(path.posix.dirname(fromFile), spec);
  else return null; // external pkg
  base = base.replace(/\\/g, '/');
  const tries = [];
  for (const e of exts) tries.push(base + e);
  for (const e of exts) tries.push(base + '/index' + e);
  tries.push(base); // already has ext
  for (const t of tries) if (fileSet.has(t)) return t;
  return null;
}

const importRe = /(?:import|export)[^'"`]*?from\s*['"`]([^'"`]+)['"`]|import\(\s*['"`]([^'"`]+)['"`]\s*\)|require\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
const importedBy = new Map();
all.forEach((f) => importedBy.set(f, new Set()));
for (const f of all) {
  const txt = contents[f];
  let m;
  while ((m = importRe.exec(txt))) {
    const spec = m[1] || m[2] || m[3];
    const target = resolve(f, spec);
    if (target) importedBy.get(target).add(f);
  }
}

// "Entry" files Next.js loads by convention (not via import)
const isEntry = (f) =>
  /\/(page|layout|route|loading|error|not-found|template|default|global-error)\.(tsx?|jsx?)$/.test(f) ||
  f === 'middleware.ts' ||
  f.startsWith('tests/') ||
  f.startsWith('scripts/') ||
  /\.(test|spec)\.(tsx?|jsx?)$/.test(f) ||
  f === 'app/globals.css';

const lines = (f) => contents[f].split('\n').length;
const isDormant = (f) => DORMANT.some((re) => re.test(f));

// candidates: lib + components only
const candidates = all.filter((f) => (f.startsWith('lib/') || f.startsWith('components/')) && !isEntry(f));
const unused = candidates.filter((f) => importedBy.get(f).size === 0).sort();

const dormant = unused.filter(isDormant);
const dead = unused.filter((f) => !isDormant(f));
const sum = (arr) => arr.reduce((a, f) => a + lines(f), 0);

console.log(`scanned: ${all.length} source files | candidates(lib+components): ${candidates.length}`);
console.log(`unreferenced: ${unused.length}  (dead: ${dead.length} / dormant: ${dormant.length})\n`);

console.log(`== DEAD CODE (${dead.length} files, ${sum(dead)} lines) — 建议清理 ==`);
dead.forEach((f) => console.log(`  ${String(lines(f)).padStart(4)}  ${f}`));

console.log(`\n== DORMANT (${dormant.length} files, ${sum(dormant)} lines) — 有意休眠, 白名单内 ==`);
dormant.forEach((f) => console.log(`  ${String(lines(f)).padStart(4)}  ${f}`));

if (STRICT && dead.length > 0) {
  console.error(`\n[strict] ${dead.length} dead-code module(s) found.`);
  process.exit(1);
}
