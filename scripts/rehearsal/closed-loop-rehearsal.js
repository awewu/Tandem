#!/usr/bin/env node
/**
 * Rhautt Nexus · 闭环角色预演（样本案例 + 各功能角色跑通查找问题）
 * 用法：node scripts/rehearsal/closed-loop-rehearsal.js
 * 机制：以一个真实样本案例驱动闭环主线，逐步核对实现工件（NestJS 控制器路由 +
 *       服务方法 + 实体/迁移）是否齐备 → 标记 RUNNABLE / PROBLEM，输出按角色的预演报告。
 * 说明：这是“可跑通就绪预演”（静态执行路径核对）；真实 HTTP 跑通另需 PG staging + 运行时 boot。
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const API = path.join(ROOT, 'services/api/src/modules');

function read(p) { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return ''; } }
function exists(p) { return fs.existsSync(path.join(ROOT, p)); }

// ── 样本案例 ────────────────────────────────────────────────────────────
const SAMPLE = {
  consumer: { name: '王先生', city: '上海市浦东新区', house: '别墅 320㎡ · 改造', budget: '30-50万',
              needs: ['中央热水', '中央采暖', '新风(DOAS)'] },
  tenant: 'tenant-demo-suzhou', dealer: '蓝蜗牛', store: '浦东体验店',
};

// ── 闭环步骤 × 角色 × 实现工件 ───────────────────────────────────────────
// check: { route?: [file, pattern], method?: [file, name], entity?: file, migration?: [file, token] }
const STEPS = [
  { step: 'S1 知情同意', role: '业主', mod: 'M14',
    route: ['compliance/compliance.controller.ts', "@Post\\('consent'\\)"],
    method: ['compliance/compliance.service.ts', 'recordConsent'],
    migration: ['../../database/postgres/migrations/002_compliance_mdm_designsync.sql', 'pipl_consents'] },
  { step: 'S2 AI 问诊采集', role: '业主', mod: 'M01',
    route: ['diagnosis/diagnosis.controller.ts', '@Post|@Controller'],
    method: ['diagnosis/diagnosis.service.ts', '.'] },
  { step: 'S3 线索归属/派单', role: '销售', mod: 'M10/M01',
    route: ['crm/crm.controller.ts', '@Controller'],
    method: ['crm/crm.service.ts', 'lead|owner|assign'] },
  { step: 'S4 五系统计算/方案/BOM', role: '设计师', mod: 'M06',
    route: ['design/design.controller.ts', '@Controller'],
    method: ['design/design.service.ts', '.'] },
  { step: 'S5 BIM 深化 + 真相源登记', role: '技术支持', mod: 'M12/M02',
    route: ['rysnova-bim/design-sync.controller.ts', "@Post\\('link'\\)"],
    method: ['rysnova-bim/design-sync.service.ts', 'linkArtifactToDesign'],
    migration: ['../../database/postgres/migrations/002_compliance_mdm_designsync.sql', 'design_rysnova-bim_sync'] },
  { step: 'S6 报价 + 价格快照锁定', role: '销售', mod: 'M11',
    route: ['quote/quote.controller.ts', "lock"],
    method: ['quote/quote.service.ts', 'lockQuotation'],
    migration: ['../../database/postgres/migrations/003_quotation_price_snapshot.sql', 'price_snapshot'] },
  { step: 'S7 电子合同/签约', role: '销售/财务', mod: 'D2(开口项)',
    route: ['quote/quote.controller.ts', 'contract|sign|esign'],
    method: ['quote/quote.service.ts', 'contract|sign'] },
  { step: 'S8 施工/验收留证', role: '施工经理', mod: 'D3(开口项)',
    route: ['delivery/delivery.controller.ts', 'accept|signoff|photo|milestone'],
    method: ['delivery/delivery.service.ts', 'accept|signoff|milestone'] },
  { step: 'S9 IoT 生命周期交接', role: '生命周期', mod: 'M13',
    route: ['lifecycle/lifecycle.controller.ts', '@Controller'],
    method: ['lifecycle/lifecycle.service.ts', 'handoff|asset|register'] },
  { step: 'S10 主数据注册 + 事件总线', role: '底座', mod: 'M15',
    route: ['mdm/mdm.controller.ts', "@Post\\('products'\\)"],
    method: ['mdm/mdm.service.ts', 'registerGlobalProduct'],
    migration: ['../../database/postgres/migrations/002_compliance_mdm_designsync.sql', 'mdm_global_products'] },
  { step: 'S11 总部汇总分析', role: '总部', mod: 'analytics',
    route: ['analytics/analytics.controller.ts', '@Controller'],
    method: ['analytics/analytics.service.ts', '.'] },
];

function checkArtifact(kind, spec) {
  if (kind === 'migration') {
    const [file, token] = spec;
    const src = read(path.join('services/api/src/modules', file).replace('services/api/src/modules/../../', ''));
    // migration path is relative to API dir; resolve from ROOT
    const mig = read(file.replace('../../', ''));
    return { ok: new RegExp(token).test(mig), label: `${file.split('/').pop()}:${token}` };
  }
  const [file, pat] = spec;
  const src = read(path.join('services/api/src/modules', file));
  const fileOk = exists(path.join('services/api/src/modules', file));
  const patOk = fileOk && new RegExp(pat, 'i').test(src);
  return { ok: patOk, label: `${file}::${pat}` };
}

const problems = [];
const rows = [];
for (const s of STEPS) {
  const checks = [];
  if (s.route)     checks.push(['route', checkArtifact('route', s.route)]);
  if (s.method)    checks.push(['method', checkArtifact('method', s.method)]);
  if (s.migration) checks.push(['migration', checkArtifact('migration', s.migration)]);
  const allOk = checks.every(([, r]) => r.ok);
  const status = allOk ? 'RUNNABLE' : (checks.some(([, r]) => r.ok) ? 'PARTIAL' : 'PROBLEM');
  rows.push({ ...s, status, checks });
  if (!allOk) {
    const missing = checks.filter(([, r]) => !r.ok).map(([k, r]) => `${k}(${r.label})`);
    problems.push(`[${s.step} · ${s.role} · ${s.mod}] ${status} → 缺: ${missing.join(', ')}`);
  }
}

console.log('\n=== Rhautt Nexus 闭环角色预演 ===');
console.log(`样本案例：${SAMPLE.consumer.name} · ${SAMPLE.consumer.city} · ${SAMPLE.consumer.house} · ${SAMPLE.consumer.needs.join('+')}`);
console.log(`经销商：${SAMPLE.dealer}（${SAMPLE.store}） 租户：${SAMPLE.tenant}\n`);
const ICON = { RUNNABLE: 'OK  ', PARTIAL: 'WARN', PROBLEM: 'MISS' };
for (const r of rows) console.log(`[${ICON[r.status]}] ${r.step.padEnd(22)} 角色:${r.role.padEnd(10)} (${r.mod})`);

console.log('\n--- 查找到的问题 ---');
if (problems.length === 0) console.log('（无：全闭环可跑通就绪）');
else problems.forEach(p => console.log('• ' + p));

const summary = {
  runnable: rows.filter(r => r.status === 'RUNNABLE').length,
  partial:  rows.filter(r => r.status === 'PARTIAL').length,
  problem:  rows.filter(r => r.status === 'PROBLEM').length,
};
console.log(`\n小结：RUNNABLE ${summary.runnable} / PARTIAL ${summary.partial} / PROBLEM ${summary.problem}（共 ${rows.length} 步）`);
fs.mkdirSync(path.join(ROOT, 'evidence/rehearsal'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'evidence/rehearsal/closed-loop-rehearsal.json'),
  JSON.stringify({ generated: new Date().toISOString(), sample: SAMPLE, summary, rows, problems }, null, 2));
console.log('evidence/rehearsal/closed-loop-rehearsal.json written');
