#!/usr/bin/env node

/**
 * P3 · 诚实化愿景 guard —— 校验 PROJECT-CHARTER.md §5.5.6「能力成熟度矩阵」。
 *
 * 目的：宪章 5.3/5.5 把大量**规划态**架构（Temporal / Kafka / OLAP / 物理分库 / HA-DR / CDC）
 * 写成终态，易被误读为"已建成"。本 guard 强制：
 *   1) §5.5.6 成熟度矩阵存在，且声明"以本矩阵为准"的正文冲突消解优先级；
 *   2) 状态图例齐全（已建成 / 进行中 / 规划）；
 *   3) 明确未落地的能力在矩阵中如实标注为「规划」，且**绝不得**被标成「已建成」
 *      ——防止"偷偷把规划写成已建成"的信任风险回归。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
// 唯一最高真相源已合并为 docs/NEXUS-CHARTER-PRD.md（旧 PROJECT-CHARTER.md / governance/agent-charter.md
// / docs/NEXUS-VISION-AND-PRD.md 均已归档）。本门禁守的「能力成熟度矩阵」是防「把规划写成已建成」
// 的核心机制，故随真相源迁移而非退役。
const CHARTER = 'docs/NEXUS-CHARTER-PRD.md';

const failures = [];
const charterPath = path.join(ROOT, CHARTER);

if (!fs.existsSync(charterPath)) {
  console.error(`- missing ${CHARTER}`);
  process.exit(1);
}

const source = fs.readFileSync(charterPath, 'utf8');

// 抽取 §5.5.6 段落（到下一个 "## " 二级标题或文末）。
const startIdx = source.indexOf('#### 5.5.6');
let section = '';
if (startIdx === -1) {
  failures.push(`${CHARTER}: 缺少 §5.5.6 能力成熟度矩阵（P3 诚实化要求）`);
} else {
  const rest = source.slice(startIdx);
  const nextTop = rest.indexOf('\n## ');
  section = nextTop === -1 ? rest : rest.slice(0, nextTop);
}

// 1) 权威口径与图例
const requiredTokens = [
  ['能力成熟度矩阵', '矩阵标题'],
  ['以本矩阵为准', '正文冲突消解优先级声明'],
  ['已建成', '状态图例:已建成'],
  ['进行中', '状态图例:进行中'],
  ['规划', '状态图例:规划'],
];
for (const [token, label] of requiredTokens) {
  if (!section.includes(token)) {
    failures.push(`${CHARTER} §5.5.6: 缺少「${token}」（${label}）`);
  }
}

// 2) 规划态能力必须如实标注（关键字命中的矩阵行须含「规划」且不得含「已建成」）。
//    每项给一组同义关键字，命中任一即视为该能力行存在。
const ROADMAP_CAPABILITIES = [
  { name: 'Temporal 工作流编排', keys: ['Temporal'] },
  { name: '事件总线终态（Kafka/NATS）', keys: ['Kafka', 'NATS'] },
  { name: 'OLAP 数仓 / CDC 分析上行', keys: ['OLAP', 'CDC'] },
  { name: '板块级物理分库', keys: ['物理分库'] },
  { name: 'HA/DR 故障切换与恢复演练', keys: ['HA/DR', 'PITR', '故障切换'] },
];

const matrixRows = section
  .split('\n')
  .filter((line) => line.trim().startsWith('|'));

for (const cap of ROADMAP_CAPABILITIES) {
  const rows = matrixRows.filter((row) => cap.keys.some((k) => row.includes(k)));
  if (!rows.length) {
    failures.push(`${CHARTER} §5.5.6: 矩阵缺少规划态能力行「${cap.name}」`);
    continue;
  }
  for (const row of rows) {
    if (row.includes('已建成')) {
      failures.push(`${CHARTER} §5.5.6: 「${cap.name}」不得标注为「已建成」（尚未落地运行实例）— 行: ${row.trim().slice(0, 80)}`);
    }
    if (!row.includes('规划')) {
      failures.push(`${CHARTER} §5.5.6: 「${cap.name}」矩阵行须标注「规划」— 行: ${row.trim().slice(0, 80)}`);
    }
  }
}

console.log(`Charter Capability Maturity Check: section=${startIdx === -1 ? 'MISSING' : 'present'}, matrixRows=${matrixRows.length}, failures=${failures.length}`);

if (failures.length) {
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}
