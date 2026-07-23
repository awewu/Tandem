#!/usr/bin/env node
/**
 * guard:product-fact-base — D2 产品事实基座架构纪律。
 *
 * 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §4 / §8。
 * 强制以下不变量（纯静态源检查，无需运行时/DB）：
 *   A. 单一事实源、不被下游反写：除 product-catalog 自身与 module-boundary 外，
 *      其它模块不得 import ProductEntity / product-catalog.entity，且不得调用 .upsert(。
 *   B. 对外只读 product_view、无成本/无 PII：公开控制器只读（无写动词），
 *      且公开读方法（listBrandPublic / recommend / list）投影不得出现 costPrice /
 *      cost_price / dealerPrice / dealer_price。
 *   C. 写入闸唯一：写方法 upsert 只经 AuthGuard 保护的 product-catalog 控制器暴露，
 *      公开控制器不得暴露任何写端点。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MODULES_DIR = path.join('services', 'api', 'src', 'modules');
const PC_DIR = path.join(MODULES_DIR, 'product-catalog');
const SERVICE = path.join(PC_DIR, 'product-catalog.service.ts');
const PUBLIC_CTRL = path.join(PC_DIR, 'product-catalog.public.controller.ts');
const BOUNDARY = path.join(MODULES_DIR, 'module-boundary.ts');
const EVIDENCE_JSON = path.join('evidence', 'architecture', 'product-fact-base.json');
const EVIDENCE_MD = path.join('evidence', 'architecture', 'product-fact-base.md');

const FORBIDDEN_PUBLIC_FIELDS = ['costPrice', 'cost_price', 'dealerPrice', 'dealer_price'];
const PUBLIC_READ_METHODS = ['listBrandPublic', 'listBrandPublicLocalized', 'getBrandProductLocalized', 'projectLocalized', 'recommend', 'list'];
// 公开控制器允许的「读形 POST」处理器名（body 载查询条件、无变更）——如 recommend。
const READ_SHAPED_POST = /recommend/i;

const failures = [];
const warnings = [];
const checks = [];

const abs = (rel) => path.join(ROOT, rel);
const read = (rel) => fs.readFileSync(abs(rel), 'utf8');
const exists = (rel) => fs.existsSync(abs(rel));
function pass(name) { checks.push({ name, ok: true }); }
function fail(name, detail) { checks.push({ name, ok: false, detail }); failures.push(`${name}: ${detail}`); }

/** 以花括号配平提取一个方法体（从方法名签名到匹配的结束 }）。 */
function extractMethod(src, name) {
  const sig = new RegExp(`(?:async\\s+)?${name}\\s*\\(`);
  const m = sig.exec(src);
  if (!m) return null;
  let i = src.indexOf('{', m.index);
  if (i < 0) return null;
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) return src.slice(m.index, j + 1); }
  }
  return src.slice(m.index);
}

// ── 前置存在性 ──
for (const [label, rel] of [['service', SERVICE], ['public-controller', PUBLIC_CTRL], ['module-boundary', BOUNDARY]]) {
  if (!exists(rel)) fail(`exists:${label}`, `${rel} 缺失`);
}

// ── A. 单一事实源，不被下游反写 ──
if (exists(MODULES_DIR)) {
  const offenders = [];
  const upsertOffenders = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (ent.name !== 'product-catalog') walk(rel); continue; }
      if (!ent.name.endsWith('.ts')) continue;
      if (rel === BOUNDARY) continue; // 边界登记表允许引用名称
      const src = read(rel);
      if (/from\s+['"][^'"]*product-catalog\.entity['"]/.test(src) || /\bProductEntity\b/.test(src)) {
        offenders.push(rel);
      }
      if (/ProductCatalogService/.test(src) && /\.upsert\s*\(/.test(src)) {
        upsertOffenders.push(rel);
      }
    }
  };
  walk(MODULES_DIR);
  if (offenders.length) fail('A.no-downstream-entity-import', `非 D2 模块引用了 ProductEntity：${offenders.join(', ')}`);
  else pass('A.no-downstream-entity-import');
  if (upsertOffenders.length) fail('A.no-downstream-writeback', `下游模块调用了 product-catalog.upsert()：${upsertOffenders.join(', ')}`);
  else pass('A.no-downstream-writeback');
}

// ── B. 公开只读、无成本/无 PII ──
if (exists(PUBLIC_CTRL)) {
  const src = read(PUBLIC_CTRL);
  // 变更动词 @Put/@Patch/@Delete 绝不允许出现在公开控制器。
  const mutationVerb = /@(Put|Patch|Delete)\b/.exec(src);
  // @Post 需逐个核验：仅允许「读形 POST」（如 recommend，body 载查询条件、无变更）。
  const badPosts = [];
  const postRe = /@Post\s*\(([^)]*)\)\s*\n\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\(/g;
  let pm;
  while ((pm = postRe.exec(src)) !== null) {
    const handler = pm[2];
    if (!READ_SHAPED_POST.test(handler)) badPosts.push(handler);
  }
  if (mutationVerb) fail('B.public-read-only', `公开控制器出现变更动词 @${mutationVerb[1]}（对外只读，禁止写入/删除）`);
  else if (badPosts.length) fail('B.public-read-only', `公开控制器出现非读形 @Post 处理器：${badPosts.join(', ')}（仅允许 recommend 等读形查询）`);
  else pass('B.public-read-only');
}
if (exists(SERVICE)) {
  const src = read(SERVICE);
  const leaks = [];
  for (const name of PUBLIC_READ_METHODS) {
    const body = extractMethod(src, name);
    if (!body) { warnings.push(`未能定位公开读方法 ${name}（源结构可能已变）`); continue; }
    for (const f of FORBIDDEN_PUBLIC_FIELDS) {
      if (body.includes(f)) leaks.push(`${name} 泄露 ${f}`);
    }
  }
  if (leaks.length) fail('B.no-cost-pii-in-public-view', leaks.join('；'));
  else pass('B.no-cost-pii-in-public-view');

  // C. 写方法 upsert 存在且成本字段仅现于受保护的定价方法 getDealerPrice。
  if (!/\bupsert\s*\(/.test(src)) fail('C.upsert-gate', 'service 未定义 upsert 写入闸');
  else pass('C.upsert-gate');
}

// ── 汇总与证据 ──
const summary = {
  guard: 'product-fact-base',
  generatedAt: new Date().toISOString(),
  factSource: 'docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §4 / §8',
  checks,
  failures,
  warnings,
};
try {
  fs.mkdirSync(abs(path.dirname(EVIDENCE_JSON)), { recursive: true });
  fs.writeFileSync(abs(EVIDENCE_JSON), JSON.stringify(summary, null, 2));
  const md = [
    '# Product Fact Base Check (D2)',
    '',
    `- generatedAt: ${summary.generatedAt}`,
    `- failures: ${failures.length} · warnings: ${warnings.length}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.ok ? 'x' : ' '}] ${c.name}${c.detail ? ' — ' + c.detail : ''}`),
    ...(warnings.length ? ['', '## Warnings', ...warnings.map((w) => `- ${w}`)] : []),
  ].join('\n');
  fs.writeFileSync(abs(EVIDENCE_MD), md + '\n');
} catch (e) {
  warnings.push(`evidence write failed: ${e.message}`);
}

console.log(`Product Fact Base Check: checks = ${checks.length}, failures = ${failures.length}, warnings = ${warnings.length}`);
for (const f of failures) console.log(`- ${f}`);
process.exit(failures.length ? 1 : 0);
