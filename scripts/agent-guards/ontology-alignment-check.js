#!/usr/bin/env node

/**
 * 本体对象类型对齐 —— 门禁（让「名词只有一套」有牙）
 *
 * 背景（真实发生过的漂移）：`geo-actions.ts` 的 `objectType` 曾是自由字符串，
 * 动作里写 `CopyAsset`、事实图谱设计文档里写 `ContentAsset`，同一个东西两个名字，
 * 图谱一旦落地就接不上。类型约束已在编译期挡住新分叉，本 guard 补上**编译器管不到的三件事**：
 *
 *   1) 设计文档 `FACT-GRAPH-DESIGN.md` 的节点名与注册表 factGraphNode 双向一致
 *      （文档加了节点却不登记、或登记了文档不提，都会被拦）；
 *   2) 历史别名不得在源码中复活（防止有人把 CopyAsset 写回去）；
 *   3) 注册表自身自洽（id 与键一致、backing 与 persistence 匹配）。
 *
 * 纯本地静态校验，不联网、不起服务。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ONTOLOGY = 'services/api/src/modules/common/ontology.ts';
const FACT_GRAPH_DOC = 'docs/architecture/FACT-GRAPH-DESIGN.md';
const ACTIONS_SRC = 'services/api/src/modules/growth/geo-actions.ts';
// 别名不得复活的扫描范围（业务源码；注册表自身与本 guard 例外）
const SCAN_DIRS = ['services/api/src/modules'];

const failures = [];
const notes = [];

function read(rel) {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

const ontologySrc = read(ONTOLOGY);
const doc = read(FACT_GRAPH_DOC);
const actionsSrc = read(ACTIONS_SRC);

if (!ontologySrc) {
  console.error('本体对象类型对齐 —— FAIL');
  console.error(`- missing ${ONTOLOGY}（本体注册表是平台名词的单一真相源，不得删除）`);
  process.exit(1);
}

// ── 解析注册表（静态解析，不加载 TS 运行时）──
// 形如：  Xxx: { id: 'Xxx', ..., factGraphNode: true, aliases: ['Yyy'], persistence: 'entity', backing: '...' },
const entries = [];
const blockRe = /^\s{2}([A-Z][A-Za-z0-9]*):\s*\{([\s\S]*?)^\s{2}\},$/gm;
for (const m of ontologySrc.matchAll(blockRe)) {
  const key = m[1];
  const body = m[2];
  const pick = (field) => {
    const r = new RegExp(`${field}:\\s*'([^']*)'`).exec(body);
    return r ? r[1] : null;
  };
  const aliasesRaw = /aliases:\s*\[([^\]]*)\]/.exec(body);
  entries.push({
    key,
    id: pick('id'),
    persistence: pick('persistence'),
    backing: pick('backing'),
    hasNullBacking: /backing:\s*null/.test(body),
    factGraphNode: /factGraphNode:\s*true/.test(body),
    aliases: aliasesRaw
      ? [...aliasesRaw[1].matchAll(/'([^']+)'/g)].map((a) => a[1])
      : [],
  });
}

if (!entries.length) {
  failures.push(`${ONTOLOGY} 未解析出任何对象类型定义（注册表被清空或格式变更 → 门禁失效，必须修）`);
}

// 3) 注册表自洽
for (const e of entries) {
  if (e.id !== e.key) {
    failures.push(`${ONTOLOGY}: ${e.key} 的 id='${e.id}' 与键名不一致（标识必须稳定唯一）`);
  }
  if (!e.persistence) {
    failures.push(`${ONTOLOGY}: ${e.key} 缺少 persistence（必须如实标注落地程度，不得含糊）`);
  }
  if (e.persistence === 'planned' && !e.hasNullBacking) {
    failures.push(`${ONTOLOGY}: ${e.key} 标为 planned 却给了 backing（planned 意为尚无实现，不得假装已落地）`);
  }
  if (e.persistence && e.persistence !== 'planned' && !e.backing) {
    failures.push(`${ONTOLOGY}: ${e.key} persistence='${e.persistence}' 但缺少 backing（须指明实体/文件出处）`);
  }
}

// 1) 与事实图谱设计文档双向一致
if (!doc) {
  failures.push(`missing ${FACT_GRAPH_DOC}（事实图谱节点模型是注册表的对照基准）`);
} else {
  // 只取 §2「目标实体模型」小节（§1 现状盘点列的是已有实体，不是节点类型，不能混入）
  const section2 = /##\s*2\.[^\n]*\n([\s\S]*?)(?=\n##\s)/.exec(doc);
  const scope = section2 ? section2[1] : '';
  if (!scope) {
    failures.push(`${FACT_GRAPH_DOC} 未找到「## 2.」目标实体模型小节（节点模型是注册表对照基准，不得删除）`);
  }
  // 首列可能一格写多个节点（如 `ClimateZone` / `Audience`），须全部取出
  const docNodes = new Set();
  for (const row of scope.split('\n')) {
    const firstCell = /^\|([^|]*)\|/.exec(row);
    if (!firstCell) continue;
    for (const n of firstCell[1].matchAll(/`([A-Z][A-Za-z0-9]*)`/g)) docNodes.add(n[1]);
  }
  const registryNodes = entries.filter((e) => e.factGraphNode).map((e) => e.id);

  const missingInRegistry = [...docNodes].filter((n) => !entries.some((e) => e.id === n));
  if (missingInRegistry.length) {
    failures.push(
      `${FACT_GRAPH_DOC} 出现未登记的节点类型：${missingInRegistry.join(' / ')}。`
      + ` 处置：在 ${ONTOLOGY} 登记（含归属模块与 persistence），否则动作层无法锚定它。`,
    );
  }
  const missingInDoc = registryNodes.filter((n) => !docNodes.has(n));
  if (missingInDoc.length) {
    failures.push(
      `注册表标记为 factGraphNode 但 ${FACT_GRAPH_DOC} 未描述：${missingInDoc.join(' / ')}。`
      + ` 处置：补进设计文档 §2/§3（节点须有语义与边关系），或改 factGraphNode: false。`,
    );
  }
  if (!missingInRegistry.length && !missingInDoc.length) {
    notes.push(`事实图谱节点双向一致（${registryNodes.length} 个）`);
  }
}

// 2) 动作层必须受类型约束（而非自由字符串）
if (!actionsSrc) {
  failures.push(`missing ${ACTIONS_SRC}`);
} else if (!/objectType:\s*ObjectTypeId/.test(actionsSrc)) {
  failures.push(
    `${ACTIONS_SRC} 的 objectType 未使用 ObjectTypeId 类型约束（退回自由字符串 = 名词分叉可再次发生）`,
  );
} else {
  notes.push('动作 objectType 受编译期类型约束');
}

// 2b) 历史别名不得在源码中复活
const aliasMap = new Map();
for (const e of entries) for (const a of e.aliases) aliasMap.set(a, e.id);

if (aliasMap.size) {
  const offenders = [];
  const walk = (dir) => {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return;
    for (const name of fs.readdirSync(abs)) {
      const rel = path.join(dir, name);
      const stat = fs.statSync(path.join(ROOT, rel));
      if (stat.isDirectory()) { walk(rel); continue; }
      if (!/\.ts$/.test(name)) continue;
      if (rel.replace(/\\/g, '/') === ONTOLOGY) continue; // 注册表本身声明别名，属合法
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const [alias, canonical] of aliasMap) {
        // 只查作为 objectType 值出现的别名（避免误伤实体名如 GrowthCopyAssetEntity）
        const re = new RegExp(`objectType:\\s*['"]${alias}['"]`);
        if (re.test(src)) offenders.push(`${rel.replace(/\\/g, '/')} 使用别名 '${alias}'（应为 '${canonical}'）`);
      }
    }
  };
  for (const d of SCAN_DIRS) walk(d);
  if (offenders.length) {
    failures.push(`历史别名复活：\n    - ${offenders.join('\n    - ')}`);
  } else {
    notes.push(`历史别名未复活（监控 ${aliasMap.size} 个：${[...aliasMap.keys()].join(', ')}）`);
  }
}

if (failures.length) {
  console.error('本体对象类型对齐 —— FAIL');
  for (const f of failures) console.error(`- ${f}`);
  process.exit(1);
}

console.log('本体对象类型对齐 —— PASS');
notes.push(`已登记对象类型 ${entries.length} 个（事实图谱节点 ${entries.filter((e) => e.factGraphNode).length} 个）`);
for (const n of notes) console.log(`- ${n}`);
