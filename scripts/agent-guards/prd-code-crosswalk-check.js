#!/usr/bin/env node
/**
 * PRD <-> Code Bidirectional Crosswalk Check  (遗憾1)
 * 检测当前 PRD 模块是否有对应代码落地，输出三档覆盖率并写 evidence JSON。
 * Run: node scripts/agent-guards/prd-code-crosswalk-check.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const r = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(r(p));

// 当前 PRD 模块 x 代码锚点（file | grep）
const MODULES = [
  { id:'M01', section:'4.1', label:'瑞诺瓦 AI 问诊',
    anchors:[{t:'file',v:'public/pain-diagnosis.html'},{t:'file',v:'server/routes/ai-diagnosis.js'}] },
  { id:'M03', section:'4.2', label:'客户项目门户',
    anchors:[{t:'file',v:'public/customer-view.html'},{t:'file',v:'server/routes/customers.js'}] },
  { id:'M05', section:'4.2', label:'业务控制台/多租户后台',
    anchors:[{t:'file',v:'public/business-console.html'},{t:'file',v:'server/routes/admin.js'}] },
  { id:'M06', section:'4.3', label:'六大舒适系统计算引擎',
    anchors:[{t:'grep',dir:'server',pat:'Engine\\.(js|ts)$',mode:'filename'}] },
  { id:'M07', section:'4.5', label:'三层产品目录',
    anchors:[{t:'file',v:'server/routes/products.js'},{t:'grep',dir:'server/models',pat:'Product',mode:'content'}] },
  { id:'M08', section:'4.6', label:'渠道转化/裂变情报',
    anchors:[{t:'grep',dir:'server',pat:'fission|referral|channel_id',mode:'content'}] },
  { id:'M09', section:'4.7', label:'经销商联合品牌身份(DAM)',
    anchors:[{t:'grep',dir:'server',pat:'tenantBrand|tenant_brand|DAM',mode:'content'}] },
  { id:'M10', section:'4.8', label:'CRM 线索归属',
    anchors:[{t:'file',v:'server/routes/crm.js'},{t:'grep',dir:'server',pat:'Opportunity|lead_owner',mode:'content'}] },
  { id:'M11', section:'4.9', label:'财务闭环/报价快照',
    anchors:[{t:'grep',dirs:['server','services/api'],pat:'price_snapshot|quotation_lock',mode:'content'}] },
  { id:'M13', section:'4.11', label:'IoT/数字孪生 mock',
    anchors:[{t:'grep',dir:'server',pat:'IoTPlatform|DigitalTwin|installedAsset|mqtt',mode:'content'}] },
  { id:'M14', section:'5.3', label:'中国合规(等保/PIPL)',
    anchors:[{t:'grep',dirs:['server','services/api'],pat:'consent|pipl|dataRetention|encryptPII',mode:'content'}] },
  { id:'M15', section:'5.4', label:'跨板块数据总线/MDM',
    anchors:[{t:'grep',dirs:['server','services/api'],pat:'MDM|masterData|global_product_id|eventBus|event_bus',mode:'content'}] },
];

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const full = path.join(dir, n);
    if (fs.statSync(full).isDirectory()) out.push(...walkDir(full));
    else out.push(full);
  }
  return out;
}

function checkAnchor(a) {
  if (a.t === 'file') return exists(a.v) ? 'found' : 'missing';
  // 支持单 dir 或多 dir（同时扫 legacy server 与 NestJS 目标 services/api）
  const dirs = (a.dirs || [a.dir]).map(r);
  const files = dirs.flatMap(d => walkDir(d)).filter(f => /\.(js|ts|json)$/.test(f));
  if (a.mode === 'filename') {
    const re = new RegExp(a.pat);
    return files.some(f => re.test(path.basename(f))) ? 'found' : 'missing';
  }
  // content grep
  const re = new RegExp(a.pat, 'i');
  const hit = files.some(f => { try { return re.test(fs.readFileSync(f,'utf8')); } catch { return false; } });
  return hit ? 'found' : 'missing';
}

const rows = MODULES.map(m => {
  const anchors = m.anchors.map(a => ({ ...a, status: checkAnchor(a) }));
  const all = anchors.every(a => a.status === 'found');
  const any = anchors.some(a => a.status === 'found');
  return { ...m, anchors, coverage: all ? 'full' : any ? 'partial' : 'none' };
});

const full = rows.filter(r => r.coverage==='full').length;
const partial = rows.filter(r => r.coverage==='partial').length;
const none = rows.filter(r => r.coverage==='none').length;

fs.mkdirSync(r('evidence/crosswalk'), { recursive:true });
fs.writeFileSync(r('evidence/crosswalk/prd-code-crosswalk-report.json'),
  JSON.stringify({ generated: new Date().toISOString(), summary:{full,partial,none}, modules:rows }, null, 2));

console.log('\n=== PRD <-> Code Crosswalk ===');
console.log(`Total ${rows.length} | Full ${full} | Partial ${partial} | None ${none}\n`);
for (const m of rows) {
  const icon = m.coverage==='full'?'OK':m.coverage==='partial'?'WARN':'MISS';
  console.log(`[${icon}] ${m.id} ${m.label} (§${m.section})`);
  for (const a of m.anchors) {
    if (a.status==='missing') {
      const desc = a.t==='file' ? a.v : `grep:${a.pat} in ${a.dir}`;
      console.log(`      missing: ${desc}`);
    }
  }
}
console.log('\nevidence/crosswalk/prd-code-crosswalk-report.json written');
process.exit(none > 0 ? 1 : 0);
