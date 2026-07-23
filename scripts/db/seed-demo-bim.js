#!/usr/bin/env node
/**
 * seed-demo-bim.js — 播种经销商工作台「项目交付」demo 数据到 rhautt_nexus.bim_projects。
 *
 * /api/v2/bim（BimService.list）按 JWT tenantId 过滤（dealer_admin dealerId=null → 返回全租户）。
 * 前端 apps/dealer-workbench/src/lib/projects-data.ts::bimToProject 映射：
 *   customer←customer_name  city←city  address←project.area  contractValue←costBreakdown.total
 *   paidValue←paid_value    stage←BIM_TO_PROJ[status]  system←system_families  installer←assigned_to
 *   milestones←acceptance_checklist[{item,done}]
 *
 * bim_projects 有 FORCE RLS（tenant_id=current_tenant_id()）→ 以超级用户 socket 连接绕过。
 * customer_id NOT NULL 但无 FK → 用随机 uuid。
 *
 * Usage: node scripts/db/seed-demo-bim.js
 */
const { randomUUID } = require('crypto');
const { Client } = require('pg');

// status: inherited→drawing→bom_confirmed→construction→acceptance→iot_delivered
const CHECK = (labels, done) => labels.map((item, i) => ({ item, done: i < done }));
const MS = ['合同确认', '现场复尺', '深化图纸', '材料到货', '主机安装', '管路施工', '系统调试', '客户验收'];

const PROJECTS = [
  { name:'刘建国', city:'上海', area:120, total:220000, paid:198000, status:'iot_delivered', fams:['地暖','新风','热水'],            installer:'李工施工队', done:8 },
  { name:'陈美玲', city:'杭州', area:300, total:580000, paid:406000, status:'construction',  fams:['热泵冷暖','地暖','新风','智控'], installer:'张工施工队', done:5 },
  { name:'王庆华', city:'成都', area:500, total:1280000, paid:384000, status:'drawing',      fams:['地源热泵','冷辐射','新风','智控'], installer:'王工施工队', done:3 },
  { name:'黄金山', city:'上海', area:260, total:520000, paid:156000, status:'inherited',     fams:['五恒旗舰'],                       installer:'待指派',    done:1 },
  { name:'马俊辉', city:'杭州', area:340, total:680000, paid:340000, status:'construction',  fams:['五恒旗舰'],                       installer:'王工施工队', done:6 },
  { name:'曹志远', city:'宁波', area:280, total:395000, paid:355500, status:'acceptance',    fams:['热泵','地暖','新风','净水'],     installer:'陈工施工队', done:7 },
  { name:'林美霞', city:'上海', area:180, total:245000, paid:122500, status:'bom_confirmed', fams:['地暖','新风'],                    installer:'张工施工队', done:4 },
  { name:'杨帆',   city:'上海', area:200, total:285000, paid:285000, status:'iot_delivered', fams:['地暖','新风','空调'],             installer:'李工施工队', done:8 },
];

async function run() {
  const client = new Client({ database: process.env.POSTGRES_DB || 'rhautt_nexus' }); // socket peer, superuser → 绕 RLS
  await client.connect();

  const { rows: [t] } = await client.query("SELECT id FROM rhautt_nexus.tenants WHERE code='DEFAULT'");
  if (!t) throw new Error('DEFAULT 租户不存在（先跑 seed-nestjs-auth.js）');
  const tenantId = t.id;

  let created = 0;
  for (const p of PROJECTS) {
    // 幂等：同租户同客户名不重复
    const { rows: ex } = await client.query(
      'SELECT id FROM rhautt_nexus.bim_projects WHERE tenant_id=$1 AND customer_name=$2', [tenantId, p.name]);
    if (ex.length) continue;
    await client.query(
      `INSERT INTO rhautt_nexus.bim_projects
         (id, tenant_id, customer_id, status, customer_name, city, project, bom, "costBreakdown",
          paid_value, system_families, acceptance_checklist, assigned_to, meta, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'[]'::jsonb,$8::jsonb,$9,$10,$11::jsonb,$12,'{}'::jsonb,NOW(),NOW())`,
      [randomUUID(), tenantId, randomUUID(), p.status, p.name, p.city,
       JSON.stringify({ area: p.area }), JSON.stringify({ total: p.total }),
       p.paid, p.fams.join(','), JSON.stringify(CHECK(MS, p.done)), p.installer]
    );
    created++;
  }
  const { rows: [{ count }] } = await client.query(
    'SELECT count(*)::int count FROM rhautt_nexus.bim_projects WHERE tenant_id=$1', [tenantId]);
  console.log(`✅ bim_projects: 新增 ${created}，租户 ${tenantId} 现有 ${count} 个项目`);
  await client.end();
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
