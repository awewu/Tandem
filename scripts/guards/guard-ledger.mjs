#!/usr/bin/env node
/**
 * guard-ledger — 门禁红绿账（harness 工程学）。
 *
 * 问题：`guard:all*` 用 && 串联，第一个失败即中断，看不到体系全貌，
 * 导致"某个门禁红了很久却无人知晓"。本工具**逐项独立执行**，产出完整账本。
 *
 * 用法：
 *   node scripts/guards/guard-ledger.mjs            # 跑非环境依赖门禁
 *   node scripts/guards/guard-ledger.mjs --all      # 含环境依赖（浏览器/staging/redis）
 *   node scripts/guards/guard-ledger.mjs --json     # 机器可读输出
 *   node scripts/guards/guard-ledger.mjs --fail-on=real   # 仅 REAL 类失败才退出非零（CI 推荐）
 *   node scripts/guards/guard-ledger.mjs --out=x.json     # 由 Node 写 UTF-8 账本
 *
 * 退出码：默认有 FAIL 即 1；`--fail-on=real` 时仅 REAL 计失败（ARTIFACT/BROKEN 仍全量展示，
 * 避免"因基础设施债长期红 → 整个门禁体系被忽略"的恶性循环）。SKIP 不算失败。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Set(process.argv.slice(2));
const RUN_ALL = args.has('--all');
const AS_JSON = args.has('--json');
const TIMEOUT_MS = Number(process.env.GUARD_TIMEOUT_MS || 90_000);

// 聚合脚本（会串联子门禁，逐项跑时排除，避免重复与中断语义）
// 聚合脚本 + 本工具自身（否则递归自调用）
const AGGREGATES = /^(guard:all|guard:all:nonvisual|guard:all:nonvisual:evidence|harness:all|guard:ledger)$/;
// 依赖外部环境（浏览器/staging/redis/在跑的服务），默认跳过，--all 时执行
const ENV_DEPENDENT = /(browser-visual|staging-smoke|redis-runtime|rls-enforcement|target-api-boot-smoke)/;

// 分类用的正则必须在执行循环**之前**求值：classify() 虽被提升，但 const 有暂时性死区，
// 若声明在循环之后，第一个失败的门禁就会抛 ReferenceError 并让整个账本崩溃（已踩过）。
const ARTIFACT_PATH = /evidence[\\/]|archive[\\/]|docs[\\/]_archive|_archive\/|nexus-console/;
const MISSING_SIGNAL = /missing|not found|ENOENT|缺失|不存在|does not exist/i;

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const names = Object.keys(pkg.scripts || {})
  .filter((n) => /^(guard|harness):/.test(n))
  .filter((n) => !AGGREGATES.test(n))
  .sort();

const rows = [];
// --out 增量落盘：全部跑完才写会导致「超时/中断 → 文件保持旧内容却看起来是最新的」
// （实测踩过：账本被超时杀掉，读到的是上一轮的旧结论，误判 GEO 仍失败）。
// 每跑完一项就写一次，并带 complete 标记，让部分结果一眼可辨。
const outArg0 = [...args].find((a) => a.startsWith('--out='));
const OUT_PATH = outArg0 ? resolve(ROOT, outArg0.slice(6)) : null;
const flush = (complete) => {
  if (!OUT_PATH) return;
  const p = rows.filter((r) => r.status === 'PASS').length;
  const f = rows.filter((r) => r.status === 'FAIL' || r.status === 'TIMEOUT').length;
  const s = rows.filter((r) => r.status === 'SKIP').length;
  writeFileSync(OUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    complete,
    total: names.length,
    ran: rows.length,
    pass: p, fail: f, skip: s, rows,
  }, null, 2), 'utf8');
};
flush(false);

for (const name of names) {
  if (!RUN_ALL && ENV_DEPENDENT.test(name)) {
    rows.push({ name, status: 'SKIP', note: '环境依赖（用 --all 执行）' });
    continue;
  }
  const started = Date.now();
  try {
    const out = execSync(`npm run --silent ${name}`, { cwd: ROOT, stdio: 'pipe', timeout: TIMEOUT_MS }).toString();
    // 门禁通过 _artifact-gate 主动 SKIP（依赖的产物未生成/已退役）→ 不计通过、不阻断
    if (/^SKIPPED:/m.test(out)) {
      const why = (out.match(/^SKIPPED:.*$/m) || [''])[0].slice(9, 150);
      rows.push({ name, status: 'SKIP', note: why });
    } else {
      rows.push({ name, status: 'PASS', ms: Date.now() - started });
    }
  } catch (err) {
    const timedOut = err.signal === 'SIGTERM' || /ETIMEDOUT|timed out/i.test(String(err.message));
    const out = `${err.stdout?.toString() ?? ''}${err.stderr?.toString() ?? ''}`;
    const firstIssue = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && /^[-•]|failed|missing|violation|error|duplicate|❌/i.test(l))
      .slice(0, 2)
      .join(' | ')
      .slice(0, 200);
    const note = firstIssue || `exit=${err.status ?? '?'}`;
    rows.push({
      name,
      status: timedOut ? 'TIMEOUT' : 'FAIL',
      kind: classify(out, note),
      ms: Date.now() - started,
      note,
    });
  }
  flush(false);
}
flush(true);

/**
 * 失败分类——恢复信噪比：
 *  BROKEN   门禁脚本自身坏（引用从未入库的模块/读目录当文件）→ 修脚本或退役
 *  ARTIFACT 依赖 gitignored 的本地产物(evidence/ archive/ docs/_archive/ apps/nexus-console)
 *           且无生成步骤 → 干净检出必红，需补生成管线或退役
 *  REAL     真实代码/架构问题 → 必须修
 */
function classify(out, note) {
  const t = `${out}\n${note}`;
  if (/Cannot find module|EISDIR/.test(t)) return 'BROKEN';
  // ARTIFACT 判定要求「缺失信号」与「gitignored 产物路径」**同行**出现。
  // 早期版本只要输出里提到过这些路径就判 ARTIFACT → 真实回归可能被误判为基础设施债
  // 而在 --fail-on=real 下被放行。宁可误判为 REAL（多修一次），不可漏放真问题。
  const lines = t.split(/\r?\n/);
  if (lines.some((l) => ARTIFACT_PATH.test(l) && MISSING_SIGNAL.test(l))) return 'ARTIFACT';
  return 'REAL';
}

const pass = rows.filter((r) => r.status === 'PASS');
const fail = rows.filter((r) => r.status === 'FAIL' || r.status === 'TIMEOUT');
const skip = rows.filter((r) => r.status === 'SKIP');

const report = { pass: pass.length, fail: fail.length, skip: skip.length, rows };
// 落盘已由 flush() 增量完成（含 complete 标记），此处只提示路径。
if (OUT_PATH) console.log(`账本已写入 ${outArg0.slice(6)}（complete=true）`);

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const byKind = (k) => fail.filter((r) => r.kind === k);
  console.log(`\n门禁红绿账（${rows.length} 项：PASS ${pass.length} / FAIL ${fail.length} / SKIP ${skip.length}）`);
  console.log(`失败分类：REAL ${byKind('REAL').length}（真问题，必修） · ARTIFACT ${byKind('ARTIFACT').length}（依赖缺失产物） · BROKEN ${byKind('BROKEN').length}（门禁脚本自身坏）\n`);
  for (const kind of ['REAL', 'BROKEN', 'ARTIFACT']) {
    const list = byKind(kind);
    if (!list.length) continue;
    console.log(`❌ ${kind}：`);
    for (const r of list) console.log(`   ${r.name.padEnd(38)} ${r.note ?? ''}`);
    console.log('');
  }
  if (skip.length) {
    console.log('\n⏭  跳过（环境依赖）：');
    for (const r of skip) console.log(`   ${r.name}`);
  }
  console.log('\n✅ 通过：');
  console.log('   ' + pass.map((r) => r.name).join('\n   '));
}

// CI 门禁语义：--fail-on=real 时只有 REAL 类阻断（基础设施债不掩盖真问题，也不长期阻断流水线）
const FAIL_ON_REAL = args.has('--fail-on=real');
const blocking = FAIL_ON_REAL ? fail.filter((r) => r.kind === 'REAL') : fail;
if (blocking.length) {
  console.error(`\n阻断项 ${blocking.length}${FAIL_ON_REAL ? '（仅计 REAL）' : ''}：${blocking.map((r) => r.name).join(', ')}`);
}
process.exit(blocking.length ? 1 : 0);
