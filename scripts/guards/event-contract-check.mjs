#!/usr/bin/env node
/**
 * guard:event-contract — 事件契约与源码**双向一致性**校验。
 *
 * ① 结构：eventType 命名/唯一/producer/consumers/payload/purpose/status 齐全
 *    命名规范 <domain>.<aggregate>.<action> 三段；早期两段名须显式 legacyNaming:true 豁免（不再新增）
 * ② 源码→契约（防未登记事件）：services/api 中每个 `eventType: '...'` 发射点必须在契约登记，
 *    且 status 必须为 implemented。这是防止"偷偷加跨域事件"的护栏。
 * ③ 契约→源码（防契约漂移）：标 implemented 的事件必须能在源码找到发射点，否则应改回 planned。
 *
 * 运行：node scripts/guards/event-contract-check.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const CONTRACT = resolve(ROOT, 'contracts/events/growth-crm-geo-events.json');
const SRC = resolve(ROOT, 'services/api/src');

const errors = [];
const warnings = [];

let doc;
try { doc = JSON.parse(readFileSync(CONTRACT, 'utf8')); }
catch (e) { console.error('❌ 无法解析事件契约:', e.message); process.exit(1); }

// ── ① 结构校验 ────────────────────────────────────────────────────────────
const registry = new Map();
const THREE_SEG = /^[a-z]+(\.[a-z_]+){2}$/;
const TWO_SEG = /^[a-z]+\.[a-z_]+$/;
for (const ev of doc.events ?? []) {
  const id = ev.eventType || '(缺 eventType)';
  if (!ev.eventType) { errors.push('事件缺 eventType'); continue; }
  if (registry.has(ev.eventType)) errors.push(`${id}: 重复声明`);
  registry.set(ev.eventType, ev);

  const okName = ev.legacyNaming ? (TWO_SEG.test(ev.eventType) || THREE_SEG.test(ev.eventType)) : THREE_SEG.test(ev.eventType);
  if (!okName) {
    errors.push(ev.legacyNaming
      ? `${id}: 命名非法（两段名豁免也需 <domain>.<aggregate> 形式）`
      : `${id}: 命名不符 <domain>.<aggregate>.<action>（如为早期事件请标 legacyNaming:true）`);
  }
  if (!['implemented', 'planned'].includes(ev.status)) errors.push(`${id}: status 必须为 implemented|planned`);
  if (!ev.producer) errors.push(`${id}: 缺 producer`);
  if (!Array.isArray(ev.consumers) || ev.consumers.length === 0) errors.push(`${id}: 缺 consumers`);
  if (!ev.payload || typeof ev.payload !== 'object') errors.push(`${id}: 缺 payload schema`);
  if (!ev.purpose) errors.push(`${id}: 缺 purpose`);
}

// ── 扫描源码发射点 ────────────────────────────────────────────────────────
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.ts') && !name.endsWith('.nodetest.ts')) out.push(p);
  }
  return out;
}

// 只识别真正的 outbox 发射：EventBus 的两个 API —— `publishInTx(em, {...})`（业务同事务）
// 与 `bus.publish({...})`（独立事务）。
// 刻意不匹配裸 `eventType:` —— 审计实体（如 WechatPublishAuditEvent / SsoAuditLog）也用同名字段，
// 它们是审计记录而非跨域事件，纳入会误报。
const EMIT_RE = /(?:publishInTx|(?:bus|eventBus)\.publish)\s*\([\s\S]{0,600}?eventType:\s*'([a-z][a-zA-Z0-9_.]*)'/g;
const emitted = new Map(); // eventType -> [相对路径]
for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(EMIT_RE)) {
    const type = m[1];
    const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
    if (!emitted.has(type)) emitted.set(type, []);
    if (!emitted.get(type).includes(rel)) emitted.get(type).push(rel);
  }
}

// ── ② 源码→契约 ──────────────────────────────────────────────────────────
for (const [type, files] of emitted) {
  const ev = registry.get(type);
  if (!ev) {
    errors.push(`源码发射未登记事件 '${type}'（${files[0]}）→ 请补进 contracts/events`);
  } else if (ev.status !== 'implemented') {
    errors.push(`'${type}' 源码已发射但契约标 ${ev.status} → 应改为 implemented`);
  }
}

// ── ③ 契约→源码 ──────────────────────────────────────────────────────────
for (const [type, ev] of registry) {
  if (ev.status === 'implemented' && !emitted.has(type)) {
    errors.push(`'${type}' 契约标 implemented 但源码无发射点 → 应改回 planned`);
  }
}

const impl = [...registry.values()].filter((e) => e.status === 'implemented').length;
const planned = [...registry.values()].filter((e) => e.status === 'planned').length;

if (errors.length) {
  console.error(`❌ guard:event-contract 失败（${errors.length}）:`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
for (const w of warnings) console.warn('  ⚠ ' + w);
console.log(`✅ guard:event-contract 通过：登记 ${registry.size} 个事件（implemented ${impl} / planned ${planned}），源码 ${emitted.size} 个发射点全部登记且双向一致。`);
