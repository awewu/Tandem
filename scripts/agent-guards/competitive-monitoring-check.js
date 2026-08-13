#!/usr/bin/env node

/**
 * 基座6 · 国际竞品持续学习监控 —— 门禁（让宪章红线"有牙"）
 *
 * 基线 `NEXUS-MARKETING-PLATFORM-BASELINE.md` 基座6 规定：竞争格局判断必须基于实证检索、
 * 季度复核、结论标注日期与出处、既往错误必须显式更正并留痕。
 * 红线若无门禁 = 漂亮 PPT（基线自身对"装饰仪表盘"的警告同样适用于文档）。
 *
 * 本 guard 做四件纯本地校验（不联网、不臆造）：
 *   1) 落档文件存在（结论 + 补齐 backlog）；
 *   2) 四条赛道的锚点对标仍在册（防止悄悄删掉不利于自己的对手）；
 *   3) 结论带可核查的检索日期，且**未超过一个季度+宽限**（强制季度复核）；
 *   4) 更正留痕仍在（防止把"我们曾经判断错了"悄悄抹掉）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ANALYSIS = 'docs/strategy/COMPETITIVE-ANALYSIS.md';
const BACKLOG = 'docs/strategy/PROFOUND-PARITY-BACKLOG.md';
const BASELINE = 'docs/NEXUS-MARKETING-PLATFORM-BASELINE.md';

// 四条赛道的锚点对标（基座6 所列；缺失即视为监控面收窄）
const REQUIRED_BENCHMARKS = ['Profound', 'Peec', 'Yext', 'SOCi', 'Uberall'];
// 季度复核 + 30 天宽限
const MAX_AGE_DAYS = 120;

const failures = [];
const notes = [];

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf8');
}

const analysis = read(ANALYSIS);
const backlog = read(BACKLOG);
const baseline = read(BASELINE);

// 1) 落档存在
if (!analysis) failures.push(`missing ${ANALYSIS}（基座6 要求对标结论固定落档）`);
if (!backlog) failures.push(`missing ${BACKLOG}（基座6 要求补齐项固定落档）`);
if (!baseline) failures.push(`missing ${BASELINE}`);
else if (!/基座6/.test(baseline)) {
  failures.push(`${BASELINE} 缺少「基座6 · 国际竞品持续学习监控」条款（宪章红线不得被删除）`);
}

if (analysis) {
  // 2) 锚点对标在册
  const missing = REQUIRED_BENCHMARKS.filter((name) => !analysis.includes(name));
  if (missing.length) {
    failures.push(`${ANALYSIS} 缺少锚点对标：${missing.join(' / ')}（基座6 四赛道监控面不得收窄）`);
  }

  // 3) 检索日期新鲜度（强制季度复核）
  const dates = [...analysis.matchAll(/(20\d{2})-(\d{2})(?:-(\d{2}))?/g)].map((m) => {
    const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3] || '01');
    const t = Date.UTC(y, mo - 1, d);
    return Number.isFinite(t) ? t : null;
  }).filter(Boolean);

  if (!dates.length) {
    failures.push(`${ANALYSIS} 未标注任何检索日期（基座6：结论须标注检索日期与出处，禁凭印象断言）`);
  } else {
    const newest = Math.max(...dates);
    const ageDays = Math.floor((Date.now() - newest) / 86400000);
    if (ageDays > MAX_AGE_DAYS) {
      failures.push(
        `${ANALYSIS} 竞品结论已过期 ${ageDays} 天（上限 ${MAX_AGE_DAYS} 天=季度复核+宽限）。`
        + ` 处置：重新检索四赛道现状 → 更新结论与日期 → 如与旧结论冲突须显式更正留痕。`,
      );
    } else {
      notes.push(`竞品结论新鲜度 ${ageDays} 天（上限 ${MAX_AGE_DAYS}）`);
    }
  }

  // 4) 更正留痕未被抹除
  if (!/更正/.test(analysis)) {
    failures.push(`${ANALYSIS} 缺少更正留痕（基座6：既往错误结论必须显式更正并保留痕迹，不得抹去）`);
  }
}

if (failures.length) {
  console.error('基座6 · 国际竞品持续学习监控 —— FAIL');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log('基座6 · 国际竞品持续学习监控 —— PASS');
for (const n of notes) console.log(`- ${n}`);
