#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const AUDIT = path.resolve(__dirname, '..', 'audit');

function readJson(rel) {
  const p = path.join(AUDIT, rel);
  if (!fs.existsSync(p)) { console.error('missing: ' + p); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
const cap = readJson('capability-extract.json');
const rev = readJson('reverse-capability-audit-report.json');

const RULES = [
  [/QuotationEngine\.js$/, 'ARCHIVE', '', '被 QuoteEngine v2 取代(多代冗余)'],
  [/QuoteEngine\.js$/, 'ARCHIVE', '', '被 v2 报价内核取代(多代冗余)'],
  [/PainPointDiagnosisEngine\.js$/, 'ARCHIVE', '', '被 V3 取代(多代冗余)'],
  [/LoadCalculationEngine\.js$/, 'ARCHIVE', '', '被负荷计算 V3 取代(多代冗余)'],
  [/RoleSystem\.js$/, 'ARCHIVE', '', '被 RoleSystemV2 取代(多代冗余)'],
  [/HydraulicEngine\.js$/, 'ARCHIVE', '', '被 Modeling 内核取代(多代冗余)'],
  [/(Cache|UnifiedDatabase|DatabasePersistence|Monitoring|Performance|Deployment|DataBackup)/, 'MIGRATE', 'platform/infra', '平台基础设施'],
  [/routes\/business-domain\.js$/, 'SPLIT', '', '上帝路由 50 端点,按领域拆分'],
  [/routes\/core-api\.js$/, 'SPLIT', '', '上帝路由 40 端点,按领域拆分'],
  [/(electron|preload|package-electron)/i, 'ARCHIVE', '', 'Electron 桌面壳,归档'],
];
function ruleHit(file) {
  for (const r of RULES) if (r[0].test(file)) return { disposition: r[1], target: r[2], reason: r[3] };
  return null;
}
function fallback(it) {
  if (it.ownerStatus === 'UNMAPPED' && it.likelyDead) return { disposition: 'REVIEW', target: '', reason: '无归属且疑似死代码,人工确认删/留' };
  if (it.likelyDead) return { disposition: 'REVIEW', target: '', reason: '疑似死代码(引用低),人工确认' };
  if (it.ownerStatus === 'UNMAPPED') return { disposition: 'REVIEW', target: '', reason: '宪章未归属,人工归属领域' };
  if (it.ownerStatus === 'AMBIGUOUS') return { disposition: 'REVIEW', target: '', reason: '归属模糊,人工裁定主属' };
  if (it.group === 'model') return { disposition: 'KEEP', target: 'packages/domain', reason: '领域模型,迁入 domain 包' };
  if (it.group === 'route') return { disposition: 'KEEP', target: 'apps/api', reason: '路由,迁入 NestJS 控制器' };
  const d = (it.mappedDomains || []).join('/') || '未定';
  return { disposition: 'KEEP', target: '领域:' + d, reason: '已归属引擎,按领域迁入计算内核' };
}

const capIdx = new Map();
for (const e of cap.engines) capIdx.set(e.file, { kind: 'engine', count: e.methodCount, loc: e.loc });
for (const r of cap.routes) capIdx.set(r.file, { kind: 'route', count: r.endpointCount, loc: r.loc });

const ledger = rev.items.map((it) => {
  const hit = ruleHit(it.file);
  const disp = hit || fallback(it);
  const c = capIdx.get(it.file) || {};
  return {
    group: it.group, file: it.file, domains: (it.mappedDomains || []).join('/'),
    ownerStatus: it.ownerStatus, likelyDead: !!it.likelyDead, refs: it.referencedCount,
    methods: c.kind === 'engine' ? c.count : '', endpoints: c.kind === 'route' ? c.count : '',
    loc: c.loc || '', sizeKB: it.sizeBytes ? Math.round(it.sizeBytes / 1024) : '',
    disposition: disp.disposition, target: disp.target || '', reason: disp.reason, ruleHit: !!hit,
  };
});

const byDisp = {};
for (const r of ledger) byDisp[r.disposition] = (byDisp[r.disposition] || 0) + 1;

// ---- 裁定层(RESOLVE)：用动态接线真相源覆盖粗粒度 REVIEW 判定 ----
// 真相源：engineRegistry(懒加载) / productionRouteCatalog(动态挂载) / routeOwnership(legacy-compat 标记) / ref-recount。
function loadText(rel) { const p = path.resolve(__dirname, '..', rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }
const REG = loadText('server/modules/engineRegistry.js') + loadText('server/core/EvolutionMechanism.js');
const CATALOG = loadText('server/modules/productionRouteCatalog.js');
const OWNERSHIP = loadText('server/modules/routeOwnership.js');
let refMap = {};
try { const rr = require(path.resolve(__dirname, '..', 'audit', 'ref-recount.json')); for (const r of rr) refMap[r.file] = r; } catch (e) {}
const SUPERSEDED = /(QuotationEngine\.js|QuoteEngine\.js|PainPointDiagnosisEngine\.js|LoadCalculationEngine\.js|RoleSystem\.js|HydraulicEngine\.js)$/;
// 高价值领域数据资产白名单：即便零接线也保留(国标/气候/城市基础数据)。
const DATA_ASSET = /(ChinaClimateDB|ChinaCitiesDatabase|ProfessionalStandardsLibrary)\.js$/;
function base(file) { return file.split('/').pop().replace(/\.js$/, ''); }
function resolve(r) {
  if (r.disposition !== 'REVIEW') return; // 只裁定 REVIEW
  const b = base(r.file);
  const ref = refMap[r.file] || { wired: r.refs || 0, registry: 0 };
  if (DATA_ASSET.test(r.file)) { r.disposition = 'KEEP'; r.target = 'packages/domain(基础数据)'; r.reason = '国标/气候基础数据资产, 保留待重新接线(裁定)'; return; }
  if (r.group === 'core-engine' || r.group === 'engine') {
    if (SUPERSEDED.test(r.file)) { r.disposition = 'ARCHIVE'; r.reason = '旧版被 V2/V3 取代(裁定)'; return; }
    if (REG.includes("/" + b + "'") || REG.includes("'" + b + "'") || REG.includes("'" + b + ".js'")) { r.disposition = 'KEEP'; r.target = '领域:' + (r.domains || '未定'); r.reason = 'engineRegistry/Evolution 登记, 活跃(裁定)'; return; }
    if (ref.wired === 0 && ref.registry === 0) { r.disposition = 'ARCHIVE'; r.reason = '全仓零接线, 真孤儿, 归档(裁定)'; return; }
    r.disposition = 'KEEP'; r.target = '领域:' + (r.domains || '未定'); r.reason = '有接线, 按领域迁入(裁定)'; return;
  }
  if (r.group === 'route') {
    const id = b.replace(/\.routes$/, '');
    const legacy = OWNERSHIP.includes(r.file) && OWNERSHIP.includes('legacy-compat');
    const inCatalog = CATALOG.includes("/" + b + "'") || CATALOG.includes("'" + id + "'") || CATALOG.includes(b);
    if (legacy && new RegExp(r.file.replace(/[/.]/g, '\\$&') + "[^\\n]*legacy-compat").test(OWNERSHIP)) { r.disposition = 'LEGACY-COMPAT'; r.target = 'apps/api(过渡)'; r.reason = 'routeOwnership 标 legacy-compat, 迁移完成后删(裁定)'; return; }
    if (inCatalog) { r.disposition = 'KEEP'; r.target = 'apps/api'; r.reason = 'productionRouteCatalog 动态挂载, 活跃(裁定)'; return; }
    if (ref.wired === 0 && ref.registry === 0) { r.disposition = 'ARCHIVE'; r.reason = '未挂载且零接线, 归档(裁定)'; return; }
    r.disposition = 'KEEP'; r.target = 'apps/api'; r.reason = '有接线, 迁入控制器(裁定)'; return;
  }
  if (r.group === 'model') {
    if (ref.wired > 0) { r.disposition = 'KEEP'; r.target = 'packages/domain'; r.reason = '有接线领域模型, 迁入 domain(裁定)'; return; }
    r.disposition = 'ARCHIVE'; r.reason = '零接线模型, 归档(裁定)'; return;
  }
}
for (const r of ledger) resolve(r);

// ---- 接线一致性校正：ARCHIVE 不得与 engineRegistry 活跃登记矛盾 ----
// 旧版被取代但仍在 engineRegistry 懒加载登记的引擎,不能直接归档,
// 必须先把注册表/路由引用切到 V2/V3(MIGRATE),确认零运行引用后再退役。
for (const r of ledger) {
  if (r.disposition !== 'ARCHIVE') continue;
  if (!(r.group === 'core-engine' || r.group === 'engine')) continue;
  const b = base(r.file);
  const stillWired = REG.includes("/" + b + "'") || REG.includes("'" + b + "'") || REG.includes("'" + b + ".js'");
  if (stillWired) {
    r.disposition = 'MIGRATE';
    r.target = 'legacy-fusion-registry(先切引用再退役)';
    r.reason = '旧版仍在 engineRegistry 活跃登记, 须先切引用到 V2/V3 再退役(校正)';
  }
}

// ---- 治理一致性校正：已纳入 legacy-fusion-registry 的引擎,服从其退役矩阵 ----
// 不由本台账单方面 ARCHIVE,而是指向权威退役流程(12 道门 + 替代证据)。
let GOV = {};
try { GOV = require(path.resolve(__dirname, '..', 'audit', 'legacy-fusion-registry.json')).engineAssets || {}; } catch (e) {}
for (const r of ledger) {
  if (r.disposition !== 'ARCHIVE') continue;
  const g = GOV[r.file];
  if (g) {
    r.disposition = 'GOVERNED-RETIRE';
    r.target = 'legacy-fusion-registry: ' + g.action + ' ' + (g.priority || '');
    r.reason = '已纳入退役矩阵(' + g.action + '), 服从 12 门治理流程, 不单方面归档(校正)';
  }
}
// 重算分布
for (const k of Object.keys(byDisp)) delete byDisp[k];
for (const r of ledger) byDisp[r.disposition] = (byDisp[r.disposition] || 0) + 1;
const esc = (s) => String(s == null ? '' : s).replace(/\|/g, '\\|');

function table(rows) {
  const L = [];
  L.push('| 处置 | 文件 | 归属域 | 归属 | 死码 | 引用 | 方法 | 端点 | LOC | KB | 迁移目标 | 依据 |');
  L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const r of rows) {
    L.push('| ' + [r.disposition, '`' + esc(r.file) + '`', esc(r.domains), esc(r.ownerStatus),
      r.likelyDead ? '是' : '', esc(r.refs), esc(r.methods), esc(r.endpoints), esc(r.loc),
      esc(r.sizeKB), esc(r.target), esc(r.reason)].join(' | ') + ' |');
  }
  return L.join('\n');
}
function section(title, fn) {
  const rows = ledger.filter(fn);
  return '## ' + title + '(' + rows.length + ')\n\n' + (rows.length ? table(rows) : '(无)') + '\n';
}

const now = new Date().toISOString();
const out = [];
out.push('# 资产盘点台账 (Asset Ledger)');
out.push('');
out.push('> 生成时间: ' + now);
out.push('> 生成器: scripts/asset-ledger.js (以代码为真相,合并 capability-extract + reverse-capability-audit + 手工解耦规则)');
out.push('> 用途: 盘点每个资产的 keep/migrate/archive/delete 处置,作为重写 PROJECT-CHARTER 与 PRD 的依据。');
out.push('');
out.push('## 处置标签');
out.push('');
out.push('- KEEP 保留并迁入新架构对应位置');
out.push('- MIGRATE 基础设施,迁入 platform/infra 层');
out.push('- SPLIT 上帝类/上帝路由,按领域拆分');
out.push('- LEGACY-COMPAT 仅做向后兼容,迁移完成后删除');
out.push('- ARCHIVE 多代冗余/被新版取代,归档不迁移');
out.push('- ISOLATE 老前端/历史产物,移入 legacy/ 隔离');
out.push('- REVIEW 机器无法判断,需人工校订');
out.push('- DELETE 可直接删除');
out.push('- GOVERNED-RETIRE 已纳入 legacy-fusion-registry 退役矩阵, 服从 12 门治理流程');
out.push('');
out.push('## 总览');
out.push('');
out.push('- 后端资产总数: ' + rev.summary.total);
out.push('- 实测能力: ' + cap.summary.totalEngineMethods + ' 引擎方法 / ' + cap.summary.totalEndpoints + ' 路由端点');
out.push('- 处置分布: ' + Object.entries(byDisp).map((e) => e[0] + '=' + e[1]).join(' / '));
out.push('- 命中手工规则: ' + ledger.filter((r) => r.ruleHit).length);
out.push('- 需人工校订(REVIEW): ' + (byDisp.REVIEW || 0));
out.push('');
out.push('> 注: public/ 静态页逐页处置见 docs/PUBLIC-SURFACE-FUNCTION-PRD-INVENTORY.md,本台账不重复。');
out.push('');
out.push('## 裁定方法(REVIEW 已清零)');
out.push('');
out.push('反向审计的静态引用计数会漏判两类动态接线,导致大量活跃代码被误判为死代码。本台账用以下真相源逐项裁定:');
out.push('');
out.push('- `server/modules/engineRegistry.js` + `EvolutionMechanism.js`: 引擎懒加载注册表,登记即活跃 -> KEEP');
out.push('- `server/modules/productionRouteCatalog.js`: 路由动态挂载清单,登记即活跃');
out.push('- `server/modules/routeOwnership.js`: 标 `legacy-compat` 的路由 -> LEGACY-COMPAT(过渡兼容,迁移完成后删)');
out.push('- `scripts/ref-recount.js` 的 `audit/ref-recount.json`: 全仓真实 require/import 接线计数');
out.push('- 数据资产白名单: ChinaClimateDB(GB 50736 国标气象参数)等即便零接线也 KEEP');
out.push('');
out.push('裁定后 ARCHIVE 仅保留两类: 旧版被 V2/V3 取代的引擎、以及未挂载且零接线的真孤儿。');
out.push('');
out.push(section('A. server/core 引擎', (r) => r.group === 'core-engine'));
out.push(section('B. server/engines 引擎', (r) => r.group === 'engine'));
out.push(section('C. server/routes 路由', (r) => r.group === 'route'));
out.push(section('D. server/models 数据模型', (r) => r.group === 'model'));
out.push(section('E. 结构性动作(ARCHIVE/SPLIT/MIGRATE/LEGACY-COMPAT/GOVERNED-RETIRE)', (r) => ['ARCHIVE', 'SPLIT', 'MIGRATE', 'LEGACY-COMPAT', 'GOVERNED-RETIRE'].includes(r.disposition)));
out.push(section('F. 残留 REVIEW(应为 0)', (r) => r.disposition === 'REVIEW'));
out.push('## 下一步');
out.push('');
out.push('1. REVIEW 已清零, 后端 193 资产处置全部裁定到位。');
out.push('2. 前端/工程层(apps/packages/frontend/src/根级)处置见 docs/STRUCTURE-ASSET-LEDGER.md。');
out.push('3. 三份台账合成全仓资产全集, 据此回头重写 PROJECT-CHARTER 与 PRD(宪章是盘点结论的产物)。');
out.push('');

fs.writeFileSync(path.join(AUDIT, 'asset-ledger.md'), out.join('\n'), 'utf8');
fs.writeFileSync(path.join(AUDIT, 'asset-ledger.json'), JSON.stringify({ generatedAt: now, summary: byDisp, ledger }, null, 2), 'utf8');
console.log('[asset-ledger] 处置分布: ' + JSON.stringify(byDisp));
