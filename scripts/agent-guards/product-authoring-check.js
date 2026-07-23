#!/usr/bin/env node
/**
 * guard:product-authoring — 品牌站产品录入纪律。
 *
 * 事实源：docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §5 / §8。
 * 品牌站脚本（sync-products-to-nexus.mjs）只能作为 seed / upsert 来源，
 * 不得成为绕过 D2 录入闸的长期写主。强制（纯静态源检查）：
 *   1. 只经 D2 upsert 端点写入（POST /product-catalog/devices），带鉴权令牌。
 *   2. 不得直连 DB 绕过 D2（禁止 import pg / typeorm / DataSource）。
 *   3. 不得作为 D2-录入字段的写主：seed DTO 不得写 positioning / assetRefs /
 *      asset_refs / productKey / product_key（这些必须由 product_manager 在 D2 录入）。
 *   4. 不得使用破坏性动词（DELETE / PUT / PATCH）。
 *   5. 门牌退役（模型B 第1律，见蓝图 §5.6）：不得再出现 rhautt_shared 共享哨兵。
 *   6. UUID 门牌闸：写入门牌须来自 EVERHOT_TENANT_ID 并经 UUID 强校验（非法即退出）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SEED_SCRIPT = path.join('apps', 'everhot-cn', 'scripts', 'sync-products-to-nexus.mjs');
const EVIDENCE_JSON = path.join('evidence', 'architecture', 'product-authoring.json');
const EVIDENCE_MD = path.join('evidence', 'architecture', 'product-authoring.md');

const D2_AUTHORED_FIELDS = ['positioning', 'assetRefs', 'asset_refs', 'productKey', 'product_key'];

const failures = [];
const warnings = [];
const checks = [];

const abs = (rel) => path.join(ROOT, rel);
function pass(name) { checks.push({ name, ok: true }); }
function fail(name, detail) { checks.push({ name, ok: false, detail }); failures.push(`${name}: ${detail}`); }

if (!fs.existsSync(abs(SEED_SCRIPT))) {
  fail('exists', `${SEED_SCRIPT} 缺失`);
} else {
  const src = fs.readFileSync(abs(SEED_SCRIPT), 'utf8');

  // 1. 只经 D2 upsert 端点写入（带鉴权）。
  const hitsUpsertEndpoint = /product-catalog\/devices/.test(src) && /method:\s*['"]POST['"]/i.test(src);
  if (hitsUpsertEndpoint) pass('1.through-d2-upsert-gate');
  else fail('1.through-d2-upsert-gate', '未见对 product-catalog/devices 的 POST（须经 D2 upsert 闸）');
  if (/Bearer|jwt\.sign\s*\(/.test(src)) pass('1b.authenticated');
  else fail('1b.authenticated', '写入未携带鉴权令牌（Bearer / jwt.sign）');

  // 2. 不得直连 DB 绕过 D2。
  const dbBypass = /from\s+['"]pg['"]|require\(\s*['"]pg['"]\s*\)|from\s+['"]typeorm['"]|\bnew\s+DataSource\b|\bnew\s+Pool\b/.exec(src);
  if (dbBypass) fail('2.no-db-bypass', `脚本疑似直连 DB 绕过 D2：${dbBypass[0]}`);
  else pass('2.no-db-bypass');

  // 3. 不得写 D2-录入字段。
  const authored = D2_AUTHORED_FIELDS.filter((f) => new RegExp(`\\b${f}\\b`).test(src));
  if (authored.length) fail('3.no-authoring-d2-fields', `seed 不得写 D2 录入字段：${authored.join(', ')}（须由 product_manager 在 D2 录入）`);
  else pass('3.no-authoring-d2-fields');

  // 4. 无破坏性动词。
  const destructive = /method:\s*['"](DELETE|PUT|PATCH)['"]/i.exec(src);
  if (destructive) fail('4.no-destructive-verbs', `seed 使用了破坏性动词 ${destructive[1]}（只能 seed/upsert）`);
  else pass('4.no-destructive-verbs');

  // 5. 门牌退役（模型B 第1律）：不得再出现 rhautt_shared 共享哨兵。
  if (/rhautt_shared/.test(src)) fail('5.no-retired-sentinel', 'seed 仍含 rhautt_shared 共享哨兵门牌（模型B 已退役，产品门牌须为品牌运营租户 UUID）');
  else pass('5.no-retired-sentinel');

  // 6. UUID 门牌闸：写入门牌须来自 EVERHOT_TENANT_ID 且经 UUID 强校验后才铸令牌。
  const hasUuidGate = /EVERHOT_TENANT_ID/.test(src) && /UUID_RE/.test(src) && /process\.exit\(1\)/.test(src);
  if (hasUuidGate) pass('6.uuid-tenant-gate');
  else fail('6.uuid-tenant-gate', 'seed 未强校验产品门牌为品牌运营租户 UUID（须 EVERHOT_TENANT_ID + UUID_RE 校验 + 非法即退出）');
}

const summary = {
  guard: 'product-authoring',
  generatedAt: new Date().toISOString(),
  factSource: 'docs/D2-PRODUCT-FACT-BASE-BLUEPRINT.md §5 / §8',
  seedScript: SEED_SCRIPT,
  checks,
  failures,
  warnings,
};
try {
  fs.mkdirSync(abs(path.dirname(EVIDENCE_JSON)), { recursive: true });
  fs.writeFileSync(abs(EVIDENCE_JSON), JSON.stringify(summary, null, 2));
  const md = [
    '# Product Authoring Check (D2)',
    '',
    `- generatedAt: ${summary.generatedAt}`,
    `- seedScript: ${SEED_SCRIPT}`,
    `- failures: ${failures.length} · warnings: ${warnings.length}`,
    '',
    '## Checks',
    ...checks.map((c) => `- [${c.ok ? 'x' : ' '}] ${c.name}${c.detail ? ' — ' + c.detail : ''}`),
  ].join('\n');
  fs.writeFileSync(abs(EVIDENCE_MD), md + '\n');
} catch (e) {
  warnings.push(`evidence write failed: ${e.message}`);
}

console.log(`Product Authoring Check: checks = ${checks.length}, failures = ${failures.length}, warnings = ${warnings.length}`);
for (const f of failures) console.log(`- ${f}`);
process.exit(failures.length ? 1 : 0);
