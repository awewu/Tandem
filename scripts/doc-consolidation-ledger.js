#!/usr/bin/env node
'use strict';
// 文档收敛台账生成器：对 docs/ 全量 + 根级 md 打 KEEP/ABSORBED-DELETE/DELETE 标签，
// 产出 docs/DOC-CONSOLIDATION-LEDGER.md 供共识审阅，共识后据此删除冗余文档。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');

const KEEP = new Set([
  'CAPABILITY-DECOMPOSITION-AND-RECOMPOSITION.md', 'STRUCTURE-ASSET-LEDGER.md',
  'PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md', 'DATABASE-BACKEND-ARCHITECTURE.md',
  'RHAUTT-NEXUS-CUSTOMER-LIFECYCLE-STATE-MODEL.md', 'DOC-CONSOLIDATION-LEDGER.md',
]);
const ROOT_KEEP = new Set(['PROJECT-CHARTER.md', 'PRD-v2.md', 'README.md']);
// 根级运维/构建/Agent 配置文档：与 PRD 不重叠，保留(非删除对象)。
const ROOT_OPS_KEEP = new Set(['CLAUDE.md', 'DEPLOYMENT-GUIDE.md', 'DESIGN.md', 'INSTALL-GUIDE.md']);

function verdict(n) {
  if (n === 'DOC-CONSOLIDATION-LEDGER.md') return ['KEEP', '本台账自身'];
  if (KEEP.has(n)) return ['KEEP', '保持权威，本 PRD 引用'];
  if (/^API-/.test(n) || /API-DOCUMENTATION/.test(n)) return ['DELETE', '手写 API 参考，被 OpenAPI 契约 + 自动生成取代'];
  if (/REPORT|COMPLETION|FIXED|RESULTS|VERIFICATION|ACCEPTANCE|PROGRESS|DELIVERY-REPORT|P0-|100-DATA|PROJECT-COMPREHENSIVE-SUMMARY|EVOLUTION-RESULTS|OPTIMIZATION-COMPLETION|SOFTWARE-OPTIMIZATION/.test(n)) return ['DELETE', '完成/修复/验收报告，过程记录已落入代码与台账'];
  if (/PLAN|SPRINT|CATCHUP|CHECKLIST|EXECUTION-START|DEVELOPMENT-GROUP|LAUNCH-BOARD|MULTI-AGENT|task_plan|ACCELERATED-DEV|SUPREME-DEVELOPMENT|migration-roadmap|PRODUCTION-TRUNK-REWRITE/.test(n)) return ['DELETE', '历史开发计划，被 PRD 第 9 章里程碑取代'];
  if (/NAMING/.test(n)) return ['DELETE', '命名候选/审计，命名已锁定(宪章第 1 章)'];
  if (/DOAS|WATER-SYSTEM|CALCULATION|HVAC|COMFORT-HOME|PLUG-AND-PLAY|6-SYSTEMS|150-TEAM|DEVICE-POSITIONING|LOCATION-SERVICE|HOT-WATER-COOLING|DESIGN-CALCULATION|DIFFERENTIATION-DOAS|UI-Design-Commercial/.test(n)) return ['ABSORBED-DELETE', '暖通领域规格，已吸收进 PRD 第 4.3'];
  if (/COMPETITOR|INDUSTRY|DEEP-INDUSTRY/.test(n)) return ['ABSORBED-DELETE', '竞品研究，已吸收进 PRD 第 4.4'];
  if (/RUUD|RYSNOVA|UI-VI-ARCHITECTURE/.test(n)) return ['ABSORBED-DELETE', 'VI 专题，已并入宪章第 6 章(实测为准)'];
  if (/LIFECYCLE-IOT|THREE-TIER-CONTRACT|RYSNOVA-ARTIFACT|WORKFLOW-OUTBOX/.test(n)) return ['ABSORBED-DELETE', '双栖/IoT/契约约束，已吸收进 PRD 第 4.1 及契约约束'];
  if (/PRD|CHARTER|SPECIFICATION|FEATURES|SCOPE|BLUEPRINT|CROSSWALK|ULTIMATE-DELIVERABLE|FULL-REWRITE|DECISION-RECORD|REVIEW-COMPLETION|DETAILED-DEVELOPMENT-GUIDE/.test(n)) return ['ABSORBED-DELETE', '历史 PRD/规格，有效内容已吸收进本 PRD'];
  if (/ARCHITECTURE|HARNESS|PORTAL|INTEGRITY|SYSTEM-INTEGRATION|ENTERPRISE-AI-CONTROL|DATA-ARCHITECTURE|BACKEND-DATA|MONGODB|DATA-EVOLUTION|EVOLUTION-MECHANISM|DECISION-MATRIX/.test(n)) return ['ABSORBED-DELETE', '架构专题，结论已并入宪章第 5 章/重组蓝图'];
  if (/GOAL|LOCKED|EXPORT-AND-ANALYTICS|USER-JOURNEY|LEGACY-FUSION-LEDGER/.test(n)) return ['ABSORBED-DELETE', '专题，有效内容已吸收(治理见 governance/ 与台账)'];
  return ['REVIEW', '需人工确认'];
}

const docs = fs.readdirSync(DOCS).filter((f) => f.endsWith('.md')).sort();
const rootMd = fs.readdirSync(ROOT).filter((f) => f.endsWith('.md')).sort();

const rows = [];
for (const f of docs) {
  const [v, r] = verdict(f);
  const loc = fs.readFileSync(path.join(DOCS, f), 'utf8').split('\n').length;
  rows.push({ file: 'docs/' + f, verdict: v, reason: r, loc });
}
for (const f of rootMd) {
  if (ROOT_KEEP.has(f)) { rows.push({ file: f, verdict: 'KEEP', reason: '根级权威文档', loc: fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length }); continue; }
  if (ROOT_OPS_KEEP.has(f)) { rows.push({ file: f, verdict: 'KEEP', reason: '根级运维/构建/Agent 配置, 与 PRD 不重叠, 保留', loc: fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length }); continue; }
  const [v, r] = verdict(f);
  const loc = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').length;
  rows.push({ file: f, verdict: v === 'REVIEW' ? 'REVIEW' : v, reason: r, loc });
}

const byV = {};
for (const r of rows) byV[r.verdict] = (byV[r.verdict] || 0) + 1;

const out = [];
out.push('# 文档收敛台账 (Doc Consolidation Ledger)');
out.push('');
out.push('> 生成器: scripts/doc-consolidation-ledger.js');
out.push('> 用途: 把散落历史文档需求吸收进 PRD-v2 后, 逐个标处置, 共识后删除冗余, 避免文件紊乱。');
out.push('> 处置: KEEP 保持权威 / ABSORBED-DELETE 已吸收进PRD可删 / DELETE 历史归档可删 / REVIEW 人工确认。');
out.push('');
out.push('## 分布');
out.push('');
out.push(Object.entries(byV).map((e) => '- ' + e[0] + ': ' + e[1]).join('\n'));
out.push('');
for (const v of ['KEEP', 'ABSORBED-DELETE', 'DELETE', 'REVIEW']) {
  const rs = rows.filter((r) => r.verdict === v);
  if (!rs.length) continue;
  out.push('## ' + v + '(' + rs.length + ')');
  out.push('');
  out.push('| 文件 | 行数 | 依据 |');
  out.push('| --- | ---: | --- |');
  for (const r of rs) out.push('| `' + r.file + '` | ' + r.loc + ' | ' + r.reason + ' |');
  out.push('');
}
fs.writeFileSync(path.join(DOCS, 'DOC-CONSOLIDATION-LEDGER.md'), out.join('\n'), 'utf8');
console.log('[doc-ledger] ' + JSON.stringify(byV) + ' total=' + rows.length);
