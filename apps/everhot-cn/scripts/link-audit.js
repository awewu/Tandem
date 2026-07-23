#!/usr/bin/env node
/**
 * Everhot 中国静态站链接 / 资源审计。
 * 扫描所有 HTML，校验：
 *  - 根路径绝对引用是否能映射到 public/ 下真实文件（目录链接校验其 index.html）
 *  - 不允许残留 /everhot/ 子路径部署引用
 *  - 相对引用、CSS 中的 url() 资源是否存在
 * 发现断链/缺资源即列出并以非零退出，方便接入 CI。
 *
 *   node apps/everhot-cn/scripts/link-audit.js
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');

const htmlFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
})(PUBLIC);

const cssFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.css')) cssFiles.push(full);
  }
})(PUBLIC);

const problems = [];
const pending = [];
const seenRefs = new Set();

// 有意预留、稍后投放的资源（不算断链；信息性提示）。
// 阿里巴巴普惠体 3.0 由 @font-face 用 local() 优先 + 文件 drop-in，文件就位前不应让审计失败。
// 见 public/assets/fonts/README.md。
const PENDING_ASSETS = [
  /\/assets\/fonts\/AlibabaPuHuiTi-3-(?:55-Regular|65-Medium|105-Heavy)\.woff2$/,
];

function resolveRoot(ref) {
  // strip query/hash
  const clean = ref.split('#')[0].split('?')[0];
  let rel = clean.replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  return path.join(PUBLIC, rel);
}

function checkRef(sourceFile, ref) {
  if (!ref) return;
  if (/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(ref)) return;
  if (ref === '/everhot' || ref.startsWith('/everhot/')) {
    problems.push({ source: path.relative(PUBLIC, sourceFile), ref, reason: 'legacy /everhot base path' });
  } else if (ref.startsWith('/')) {
    const target = resolveRoot(ref);
    if (!fs.existsSync(target)) {
      if (PENDING_ASSETS.some((re) => re.test(ref))) {
        pending.push(path.relative(PUBLIC, target));
      } else {
        problems.push({ source: path.relative(PUBLIC, sourceFile), ref, reason: 'missing target', expected: path.relative(PUBLIC, target) });
      }
    }
    seenRefs.add(ref);
  } else {
    // relative
    let rel = ref.split('#')[0].split('?')[0];
    let target = path.resolve(path.dirname(sourceFile), rel);
    if (rel.endsWith('/')) target = path.join(target, 'index.html');
    if (!fs.existsSync(target) && fs.existsSync(target + '.html')) return;
    if (!fs.existsSync(target)) {
      problems.push({ source: path.relative(PUBLIC, sourceFile), ref, reason: 'missing relative target' });
    }
  }
}

const ATTR_RE = /(?:href|src|poster|data-desktop-src|data-mobile-src|content)\s*=\s*["']([^"']+)["']/gi;
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = ATTR_RE.exec(html))) {
    const ref = m[1];
    // skip og:image absolute urls handled by http filter; skip meta content that isn't a path
    if (m[0].toLowerCase().startsWith('content=') && !ref.startsWith('/') && !ref.startsWith('.')) continue;
    checkRef(file, ref);
  }
}

const URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
for (const file of cssFiles) {
  const css = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = URL_RE.exec(css))) checkRef(file, m[1]);
}

console.log(`Everhot link audit: ${htmlFiles.length} HTML, ${cssFiles.length} CSS scanned.`);
if (pending.length) {
  const uniq = [...new Set(pending)];
  console.log(`\n${uniq.length} pending asset(s) (intentional drop-in, not broken — see assets/fonts/README.md):`);
  for (const p of uniq) console.log(`  [pending] ${p}`);
}
if (!problems.length) {
  console.log('OK — no broken links or missing assets.');
  process.exit(0);
}
console.log(`\n${problems.length} problem(s):`);
for (const p of problems) {
  console.log(`  [${p.reason}] ${p.source}  ->  ${p.ref}${p.expected ? `  (expected ${p.expected})` : ''}`);
}
process.exit(1);
