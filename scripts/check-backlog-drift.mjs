#!/usr/bin/env node
/**
 * scripts/check-backlog-drift.mjs · 防 backlog 状态严重 lag 代码 (info-only, 不阻断 commit)
 *
 * 起源: 2026-06-09 复盘. Cascade 多次因为信 backlog "⏳ 待 sprint" 而以为某能力 0 行,
 *      实际 Owner 早已落地 (B-024 Reflexion 6/8 落 95%, B-022 preSearchLayer 落 70%),
 *      险些重新发明轮子. 根因: backlog 文档严重 lag 真实代码.
 *
 * 工作原理:
 *   1. 收集本次改动的核心模块文件 (默认 staged; 也可 --since=HEAD~10 或 --range=HEAD~5..HEAD)
 *   2. 解析 docs/AI-BACKLOG.md 切出每个 #### B-XXX 块 + 状态字段
 *   3. 对每个改动文件, fuzzy match basename 在哪些 B-XXX 块体内被引用
 *   4. 输出受影响条目 + 当前状态字段, 提示 Owner / Cascade "改完代码也改 backlog"
 *
 * 用法:
 *   node scripts/check-backlog-drift.mjs                   # 默认 staged
 *   node scripts/check-backlog-drift.mjs --since=HEAD~10
 *   node scripts/check-backlog-drift.mjs --range=HEAD~5..HEAD
 *   node scripts/check-backlog-drift.mjs --files=lib/x.ts,lib/y.ts
 *
 * 退出码: 永远 0 (info-only). 不阻塞 commit.
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\//, '').replace(/^([a-zA-Z]):/, '$1:')).replace(/\\/g, '/');
// Windows 上 import.meta.url 是 file:///E:/... 处理一下
const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// 核心模块路径前缀: 只对这些路径下的改动做 drift 检测 (避免 UI/test 噪声)
// ---------------------------------------------------------------------------
const CORE_PREFIXES = [
  'lib/persona/',
  'lib/skill-gateway/',
  'lib/decision-layer/',
  'lib/ontology/',
  'lib/governance/',
  'lib/memory/',
  'lib/agent-runtime/',
  'lib/taf/',
  'lib/im/service.ts',
  'lib/api/',
  'lib/audit/',
  'lib/auth/',
];

const BACKLOG_PATH = 'docs/AI-BACKLOG.md';

// ---------------------------------------------------------------------------
// 1. 解析参数
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (k) => argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];

let mode = 'staged';
let scopeArg = null;
if (arg('since')) {
  mode = 'since';
  scopeArg = arg('since');
} else if (arg('range')) {
  mode = 'range';
  scopeArg = arg('range');
} else if (arg('files')) {
  mode = 'files';
  scopeArg = arg('files');
}

// ---------------------------------------------------------------------------
// 2. 收集改动文件
// ---------------------------------------------------------------------------
function listChangedFiles() {
  try {
    if (mode === 'files') return scopeArg.split(',').map((s) => s.trim()).filter(Boolean);
    let cmd;
    if (mode === 'staged') {
      cmd = 'git diff --cached --name-only --diff-filter=ACMR';
    } else if (mode === 'since') {
      cmd = `git diff --name-only ${scopeArg}..HEAD`;
    } else if (mode === 'range') {
      cmd = `git diff --name-only ${scopeArg}`;
    }
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf8' });
    return out.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function isCoreFile(path) {
  return CORE_PREFIXES.some((p) => path.startsWith(p));
}

// ---------------------------------------------------------------------------
// 3. 解析 backlog: 切 #### B-XXX 块, 抽 title + 状态字段 + 块体内文本
// ---------------------------------------------------------------------------
function parseBacklog() {
  if (!existsSync(BACKLOG_PATH)) return [];
  const text = readFileSync(BACKLOG_PATH, 'utf8');
  // 切以 #### 起头的块 (B-XXX). 末尾用下一个 #### 或 ## 收尾
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let cur = null;
  for (const line of lines) {
    if (/^#### /.test(line)) {
      if (cur) blocks.push(cur);
      cur = { titleLine: line, body: [], statusLine: null };
    } else if (/^## /.test(line) && cur) {
      blocks.push(cur);
      cur = null;
    } else if (cur) {
      cur.body.push(line);
      if (/^\s*-\s*\*\*状态\*\*:/.test(line) && !cur.statusLine) {
        cur.statusLine = line.trim();
      }
    }
  }
  if (cur) blocks.push(cur);
  return blocks
    .filter((b) => /B-\d+/.test(b.titleLine))
    .map((b) => ({
      id: (b.titleLine.match(/B-\d+/) || [''])[0],
      title: b.titleLine.replace(/^####\s*/, '').trim(),
      status: b.statusLine ?? '(未声明状态)',
      bodyText: b.body.join('\n'),
    }));
}

// ---------------------------------------------------------------------------
// 4. 对每个改动文件 fuzzy match 受影响 backlog 条目
// ---------------------------------------------------------------------------
function basenameNoExt(p) {
  const base = p.split('/').pop() ?? p;
  return base.replace(/\.(tsx?|mjs|js)$/, '');
}

function matchBacklogEntries(changedFiles, blocks) {
  const affected = new Map(); // id → { entry, files: [] }
  for (const f of changedFiles) {
    const stem = basenameNoExt(f);
    if (stem.length < 4) continue; // 太短的名 (e.g. 'log') 噪声大
    for (const b of blocks) {
      // 匹配规则: backlog 块体内出现完整 path (`lib/x/y.ts`) 或文件 stem (e.g. `reflexion`)
      const hitPath = b.bodyText.includes(f);
      const hitStem = new RegExp(`\\b${stem.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(b.bodyText);
      if (hitPath || hitStem) {
        if (!affected.has(b.id)) affected.set(b.id, { entry: b, files: [] });
        affected.get(b.id).files.push(f);
      }
    }
  }
  return affected;
}

// ---------------------------------------------------------------------------
// 5. 状态字段判读: 是否 "🟢 已落 / ✅ MVP" 之类 / 还是 "⏳ 待 sprint"
// ---------------------------------------------------------------------------
function classifyStatus(statusLine) {
  if (/✅|🟢|已落地|已完成|MVP 闭环|完成/.test(statusLine)) return 'done';
  if (/🟡|部分落地|进行中/.test(statusLine)) return 'partial';
  if (/⏳|待 sprint|待评估|观察|TBD/.test(statusLine)) return 'pending';
  return 'unknown';
}

const statusEmoji = { done: '✅', partial: '🟡', pending: '⏳', unknown: '❓' };

// ---------------------------------------------------------------------------
// 6. Run
// ---------------------------------------------------------------------------
const allChanged = listChangedFiles();
const coreChanged = allChanged.filter(isCoreFile);

console.log('🔍 Backlog Drift Check');
console.log(`   模式: ${mode}${scopeArg ? ` (${scopeArg})` : ''}`);
console.log(`   改动文件: ${allChanged.length} (核心模块: ${coreChanged.length})`);

if (coreChanged.length === 0) {
  console.log('   ✓ 无核心模块改动, 跳过');
  process.exit(0);
}

console.log('\n核心模块改动:');
for (const f of coreChanged) console.log(`   - ${f}`);

const blocks = parseBacklog();
if (blocks.length === 0) {
  console.log(`\n⚠ ${BACKLOG_PATH} 不存在或解析为空, 跳过 drift 检测`);
  process.exit(0);
}

const affected = matchBacklogEntries(coreChanged, blocks);

if (affected.size === 0) {
  console.log('\n   ✓ 改动未匹配任何 backlog 条目 (可能是新功能 — 考虑是否要加 backlog 项)');
  process.exit(0);
}

console.log(`\n受影响 backlog 条目 (${affected.size}):`);
const drifts = [];
for (const { entry, files } of affected.values()) {
  const cls = classifyStatus(entry.status);
  const emoji = statusEmoji[cls];
  console.log(`\n   ${emoji} ${entry.title}`);
  console.log(`      状态: ${entry.status.replace(/^\s*-\s*\*\*状态\*\*:\s*/, '')}`);
  console.log(`      命中文件: ${files.join(', ')}`);
  if (cls === 'pending') {
    drifts.push(entry);
  }
}

if (drifts.length > 0) {
  console.log('\n⚠ DRIFT 警告: 以下 backlog 条目状态仍是「待 sprint/观察」, 但代码已改:');
  for (const d of drifts) {
    console.log(`   - ${d.id} · 同步 docs/AI-BACKLOG.md 状态字段为 🟡 部分落地 / ✅ 已完成`);
  }
  console.log('\n💡 提醒: backlog drift 是 Cascade 状态评估失准的根因. 请同步.');
  console.log('   (此检查 info-only, 不阻塞 commit)');
}

process.exit(0);
