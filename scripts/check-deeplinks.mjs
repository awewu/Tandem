#!/usr/bin/env node
/**
 * scripts/check-deeplinks.mjs · 内链存在性扫描
 *
 * 立项: P3 #11 · "/decisions/new 在 CARD_REGISTRY 一度悬空" 类问题
 *
 * 扫所有 .tsx 里:
 *   - href="/xxx" / href={'/xxx'}
 *   - router.push('/xxx') / router.replace('/xxx') / redirect('/xxx')
 *   - <Link href="/xxx">
 * 对照 app/ 实际路由 (page.tsx + route.ts) 看是否存在.
 *
 * 用法:
 *   node scripts/check-deeplinks.mjs              # 列出悬空内链
 *   node scripts/check-deeplinks.mjs --strict     # CI 模式: 有悬空退 1
 *
 * 退出码:
 *   0 = 没有悬空 (或非 strict)
 *   1 = 有悬空 + --strict
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');

// ────────────────────────────────────────────────────────────────
// 1. 扫 app/ 收集已存在的路由 (page.tsx + route.ts)
// ────────────────────────────────────────────────────────────────
const APP_DIR = join(ROOT, 'app');
const ROUTES = new Set();

function walkRoutes(dir, prefix = '') {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      // 路由组 (group) ()/segment 不参与 URL · 跳过命名进路径
      const seg = name.startsWith('(') && name.endsWith(')') ? '' : '/' + name;
      walkRoutes(full, prefix + seg);
    } else if (name === 'page.tsx' || name === 'page.ts') {
      const p = prefix || '/';
      ROUTES.add(p);
    } else if (name === 'route.ts' || name === 'route.tsx') {
      const p = prefix || '/';
      ROUTES.add(p);
    }
  }
}
walkRoutes(APP_DIR);

// ────────────────────────────────────────────────────────────────
// 2. 收集动态段, 用于匹配 (e.g. /im/[id] · /convergence/[id])
// ────────────────────────────────────────────────────────────────
const ROUTE_REGEXES = [...ROUTES].map((r) => {
  // 把 [foo] / [...foo] / [[...foo]] 替换成 ([^/]+) (catch-all 仍用 .+)
  const pattern = r
    .replace(/\[\[\.\.\.[^\]]+\]\]/g, '(?:.*)')
    .replace(/\[\.\.\.[^\]]+\]/g, '.+')
    .replace(/\[[^\]]+\]/g, '[^/]+');
  return { route: r, regex: new RegExp('^' + pattern + '$') };
});

function routeExists(path) {
  // path 已 stripped of query/hash
  if (ROUTES.has(path)) return true;
  for (const { regex } of ROUTE_REGEXES) {
    if (regex.test(path)) return true;
  }
  return false;
}

// ────────────────────────────────────────────────────────────────
// 3. 扫源码里的内链
// ────────────────────────────────────────────────────────────────
const SCAN_DIRS = ['app', 'components', 'lib'];
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

// 三类抓取模式:
const PATTERNS = [
  // href="/xxx"  或 href={'/xxx'}
  /\bhref\s*=\s*[{"']\s*[`'"]?(\/[A-Za-z0-9_\-./\[\]?#&=:]+)/g,
  // router.push('/xxx') / router.replace('/xxx') / redirect('/xxx')
  /\b(?:router\.(?:push|replace|prefetch)|redirect)\(\s*[`'"](\/[A-Za-z0-9_\-./\[\]?#&=:]+)/g,
];

// 这些前缀是外部, 跳过
const EXTERNAL_PREFIXES = ['/api/', '/_next/', '/static/', '//', '/#'];
// 静态资源
const STATIC_EXT = /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|json|txt|pdf|woff2?|ttf)(\?|$)/i;

function* walkSources(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      yield* walkSources(full);
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      yield full;
    }
  }
}

const dangling = [];

for (const top of SCAN_DIRS) {
  const abs = join(ROOT, top);
  try { statSync(abs); } catch { continue; }
  for (const file of walkSources(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    const src = readFileSync(file, 'utf8');

    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) {
        let raw = m[1];
        // 砍 query/hash
        const cleaned = raw.split('?')[0].split('#')[0];
        if (!cleaned) continue;
        if (cleaned === '/') continue; // 根
        // 末尾 / · 说明后面有 ${} 动态段, 跳过 (脚本无法静态判断)
        if (cleaned.endsWith('/')) continue;
        if (EXTERNAL_PREFIXES.some((p) => cleaned.startsWith(p))) continue;
        if (STATIC_EXT.test(cleaned)) continue;
        // 模板字符串里的 ${} 占位 - 跳过
        if (cleaned.includes('${') || cleaned.includes('[id]')) continue;
        // /docs/* 是外部 markdown 引用, 不在 Next 路由表
        if (cleaned.startsWith('/docs/') || cleaned.startsWith('/docs.')) continue;

        if (!routeExists(cleaned)) {
          const upToMatch = src.slice(0, m.index);
          const lineNo = upToMatch.split('\n').length;
          dangling.push({ file: rel, line: lineNo, href: cleaned });
        }
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────
// 4. 输出
// ────────────────────────────────────────────────────────────────
// allowlist · 已知悬空的内链, snapshot 2026-05-30 · P3 清零
const ALLOWLIST = new Set([
  'app/intranet/page.tsx:/intranet/archive', // archive 页待建, 链接先在
]);

const filtered = dangling.filter((d) => !ALLOWLIST.has(`${d.file}:${d.href}`));

if (filtered.length === 0) {
  console.log(`✓ 内链存在性扫描 · 0 悬空 (allowlist ${ALLOWLIST.size} 条已知遗留) · ${ROUTES.size} 路由`);
  process.exit(0);
}

const byFile = new Map();
for (const d of filtered) {
  if (!byFile.has(d.file)) byFile.set(d.file, []);
  byFile.get(d.file).push(d);
}

console.log(`\n⚠ 内链悬空: ${filtered.length} 条 · ${byFile.size} 文件\n`);
for (const [file, ds] of byFile) {
  console.log(`  ${file}`);
  for (const d of ds) {
    console.log(`    ✗ L${d.line}  ${d.href}`);
  }
  console.log('');
}
console.log(`扫描范围: ${SCAN_DIRS.join(' / ')} · ${ROUTES.size} 路由对照 · allowlist ${ALLOWLIST.size} 条已跳过`);

if (STRICT && filtered.length > 0) {
  console.log(`\n✗ STRICT 模式: ${filtered.length} 悬空 → exit 1`);
  process.exit(1);
}
process.exit(0);
