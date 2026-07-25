#!/usr/bin/env node
/**
 * PMS Demo 种子 · 生成 10 组完整工程项目数据 (演示全链路呈现)
 *
 * 每个项目含: 决策链干系人 + 规格指定矩阵 + 招投标标段(部分流转) + 提交物 + 归属商机.
 * 另建若干未归属商机线索, 供 360 页「关联线索」演示.
 *
 * 依赖运行中的 dev server (默认 http://localhost:3005) + ALLOW_DEMO_AUTH=1 (demo 内部 admin).
 * 幂等: 已存在以「示例·」开头的项目则跳过.
 *
 * 用法: node scripts/seed-pms-demo.mjs   (可选 PMS_BASE=http://localhost:3005)
 */

const BASE = process.env.PMS_BASE || 'http://localhost:3005';
const PREFIX = '示例·';

async function api(path, body, method = 'POST') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.error || JSON.stringify(json)}`);
  return json;
}
const get = (path) => api(path, undefined, 'GET');

// --- 10 组项目定义 (暖通 / 热水 / 空调 工程) ---
const PROJECTS = [
  {
    name: '成都天府新区人民医院暖通工程', type: 'new_construction', stage: 'design', region: '西南',
    designInstitute: '中建西南院', customer: '成都天府新区人民医院', value: 8600000,
    stakeholders: [
      { role: 'owner', name: '周建国', company: '天府新区人民医院', title: '基建处长', influence: 'high', isEconomicBuyer: true },
      { role: 'design_engineer', name: '李明华', company: '中建西南院', title: '暖通主任工程师', influence: 'high', isChampion: true },
      { role: 'general_contractor', name: '王强', company: '中建三局', title: '机电经理', influence: 'medium' },
    ],
    specs: [
      { family: '冷水机组', status: 'basis_of_design', model: 'RH-CWS-1200', competitor: '开利', value: 3200000, stage: 'design' },
      { family: '组合式空调箱', status: 'specified', model: 'RH-AHU-30', competitor: '', value: 1800000, stage: 'design' },
      { family: '风机盘管', status: 'alternate', model: 'RH-FCU', competitor: '麦克维尔', value: 900000, stage: 'design' },
    ],
    tender: null,
    submittals: [{ title: '暖通设计说明书 v1', docType: 'spec' }, { title: '冷热源机房平面图', docType: 'drawing' }],
    opps: [{ customer: '成都天府新区人民医院', amount: 3200000, stage: 'proposal' }],
  },
  {
    name: '重庆两江新区数据中心冷却系统', type: 'new_construction', stage: 'tender', region: '西南',
    designInstitute: '中冶赛迪', customer: '两江云计算', value: 12000000,
    stakeholders: [
      { role: 'owner', name: '陈涛', company: '两江云计算', title: '运维总监', influence: 'high', isEconomicBuyer: true },
      { role: 'design_engineer', name: '赵倩', company: '中冶赛迪', title: '电气暖通所长', influence: 'high', isChampion: true },
      { role: 'consultant', name: '孙伟', company: '赛宝顾问', title: '审图专家', influence: 'medium' },
      { role: 'installer', name: '刘洋', company: '重庆机电安装', title: '项目经理', influence: 'medium' },
    ],
    specs: [
      { family: '磁悬浮冷水机组', status: 'basis_of_design', model: 'RH-MAG-800', competitor: '约克', value: 6000000, stage: 'tender' },
      { family: '冷却塔', status: 'specified', model: 'RH-CT-500', competitor: '', value: 1500000, stage: 'tender' },
      { family: '精密空调', status: 'alternate', model: 'RH-CRAC', competitor: '维谛', value: 2400000, stage: 'tender' },
    ],
    tender: { name: '数据中心冷却系统总承包', budget: 12000000, bid: 11200000, toStatus: 'submitted' },
    submittals: [{ title: '技术标书 v1', docType: 'technical_proposal' }, { title: '商务标报价单', docType: 'commercial_bid' }],
    opps: [{ customer: '两江云计算', amount: 11200000, stage: 'bidding' }],
  },
  {
    name: '西安高新区国际学校热水系统', type: 'new_construction', stage: 'awarded', region: '西北',
    designInstitute: '西北综合勘察院', customer: '西安高新国际学校', value: 2400000,
    stakeholders: [
      { role: 'owner', name: '马丽', company: '西安高新国际学校', title: '总务主任', influence: 'high', isEconomicBuyer: true },
      { role: 'design_engineer', name: '张磊', company: '西北综合勘察院', title: '给排水工程师', influence: 'high', isChampion: true },
      { role: 'installer', name: '杨帆', company: '西安暖通安装', title: '负责人', influence: 'medium' },
    ],
    specs: [
      { family: '空气源热泵热水机组', status: 'specified', model: 'RH-HP-100', competitor: '格力', value: 1600000, stage: 'awarded' },
      { family: '承压保温水箱', status: 'basis_of_design', model: 'RH-TANK-20', competitor: '', value: 500000, stage: 'awarded' },
    ],
    tender: { name: '国际学校生活热水EPC', budget: 2400000, bid: 2280000, toStatus: 'won', rank: 1, winner: '瑞合瑞德' },
    submittals: [{ title: '中标通知书', docType: 'other' }, { title: '热水系统施工图', docType: 'drawing' }],
    opps: [{ customer: '西安高新国际学校', amount: 2280000, stage: 'contract' }],
  },
  {
    name: '昆明滇池会展酒店空调改造', type: 'renovation', stage: 'delivery', region: '西南',
    designInstitute: '云南设计院', customer: '滇池会展酒店', value: 5200000,
    stakeholders: [
      { role: 'owner', name: '钱进', company: '滇池会展酒店', title: '工程总监', influence: 'high', isEconomicBuyer: true, isChampion: true },
      { role: 'design_engineer', name: '周敏', company: '云南设计院', title: '暖通工程师', influence: 'medium' },
      { role: 'installer', name: '吴刚', company: '昆明机电', title: '项目经理', influence: 'high' },
    ],
    specs: [
      { family: '螺杆式冷水机组', status: 'specified', model: 'RH-SCW-600', competitor: '', value: 2800000, stage: 'awarded' },
      { family: '组合式空调箱', status: 'specified', model: 'RH-AHU-20', competitor: '', value: 1400000, stage: 'awarded' },
    ],
    tender: { name: '酒店中央空调改造', budget: 5200000, bid: 4900000, toStatus: 'won', rank: 1, winner: '瑞合瑞德' },
    submittals: [{ title: '施工组织设计', docType: 'technical_proposal' }, { title: '设备到货验收单', docType: 'other' }],
    opps: [{ customer: '滇池会展酒店', amount: 4900000, stage: 'delivery' }],
  },
  {
    name: '贵阳观山湖智慧产业园区热泵项目', type: 'new_construction', stage: 'lead', region: '西南',
    designInstitute: '', customer: '观山湖产业投资', value: 6800000,
    stakeholders: [
      { role: 'owner', name: '郑华', company: '观山湖产业投资', title: '招商部长', influence: 'high' },
      { role: 'distributor', name: '冯经理', company: '贵阳瑞合经销', title: '总经理', influence: 'medium', isChampion: true },
    ],
    specs: [
      { family: '地源热泵机组', status: 'not_specified', model: '', competitor: '克莱门特', value: 4000000, stage: 'design' },
    ],
    tender: null,
    submittals: [],
    opps: [{ customer: '观山湖产业投资', amount: 6800000, stage: 'following' }],
  },
  {
    name: '兰州新区综合体供暖工程', type: 'new_construction', stage: 'design', region: '西北',
    designInstitute: '甘肃省建筑设计院', customer: '兰州新区城投', value: 9500000,
    stakeholders: [
      { role: 'owner', name: '田军', company: '兰州新区城投', title: '项目负责人', influence: 'high', isEconomicBuyer: true },
      { role: 'architect', name: '何洁', company: '甘肃省建筑设计院', title: '主创建筑师', influence: 'medium' },
      { role: 'design_engineer', name: '许强', company: '甘肃省建筑设计院', title: '暖通负责人', influence: 'high', isChampion: true },
    ],
    specs: [
      { family: '燃气真空热水锅炉', status: 'basis_of_design', model: 'RH-VAC-2800', competitor: '威能', value: 3600000, stage: 'design' },
      { family: '板式换热机组', status: 'specified', model: 'RH-PHE', competitor: '', value: 1200000, stage: 'design' },
      { family: '风机盘管', status: 'not_specified', model: '', competitor: '大金', value: 800000, stage: 'design' },
    ],
    tender: null,
    submittals: [{ title: '供暖系统设计方案', docType: 'spec' }],
    opps: [{ customer: '兰州新区城投', amount: 3600000, stage: 'proposal' }],
  },
  {
    name: '长沙梅溪湖文体中心多联机项目', type: 'new_construction', stage: 'tender', region: '华中',
    designInstitute: '湖南建筑设计院', customer: '梅溪湖投资', value: 7200000,
    stakeholders: [
      { role: 'owner', name: '曾勇', company: '梅溪湖投资', title: '基建总监', influence: 'high', isEconomicBuyer: true },
      { role: 'design_engineer', name: '龙梅', company: '湖南建筑设计院', title: '暖通主任', influence: 'high' },
      { role: 'general_contractor', name: '袁斌', company: '湖南建工', title: '机电总工', influence: 'medium', isChampion: true },
    ],
    specs: [
      { family: '多联机VRF', status: 'alternate', model: 'RH-VRF-400', competitor: '大金', value: 4200000, stage: 'tender' },
      { family: '新风换气机组', status: 'specified', model: 'RH-ERV', competitor: '', value: 1500000, stage: 'tender' },
    ],
    tender: { name: '文体中心空调总包', budget: 7200000, bid: 6900000, toStatus: 'submitted' },
    submittals: [{ title: '多联机技术方案', docType: 'technical_proposal' }, { title: '资质证明文件', docType: 'qualification' }],
    opps: [{ customer: '梅溪湖投资', amount: 6900000, stage: 'bidding' }],
  },
  {
    name: '武汉光谷生物城洁净空调工程', type: 'expansion', stage: 'warranty', region: '华中',
    designInstitute: '中南建筑设计院', customer: '光谷生物城', value: 15800000,
    stakeholders: [
      { role: 'owner', name: '汪洋', company: '光谷生物城', title: '设备部经理', influence: 'high', isEconomicBuyer: true, isChampion: true },
      { role: 'design_engineer', name: '邓超', company: '中南建筑设计院', title: '洁净空调专家', influence: 'high' },
      { role: 'installer', name: '罗鹏', company: '武汉净化工程', title: '项目经理', influence: 'medium' },
    ],
    specs: [
      { family: '洁净空调机组', status: 'specified', model: 'RH-CAHU-50', competitor: '', value: 8000000, stage: 'awarded' },
      { family: '风冷热泵', status: 'specified', model: 'RH-ACHP-300', competitor: '', value: 3200000, stage: 'awarded' },
    ],
    tender: { name: '生物城洁净空调EPC', budget: 15800000, bid: 15200000, toStatus: 'won', rank: 1, winner: '瑞合瑞德' },
    submittals: [{ title: '竣工验收报告', docType: 'other' }, { title: '维保服务方案', docType: 'other' }],
    opps: [{ customer: '光谷生物城', amount: 15200000, stage: 'delivered' }],
  },
  {
    name: '南宁东盟商务区酒店群热水项目', type: 'new_construction', stage: 'closed', region: '华南',
    designInstitute: '广西建筑综合设计院', customer: '东盟商务区管委会', value: 4600000,
    stakeholders: [
      { role: 'owner', name: '黄海', company: '东盟商务区管委会', title: '工程科长', influence: 'high', isEconomicBuyer: true },
      { role: 'design_engineer', name: '韦娜', company: '广西建筑综合设计院', title: '给排水工程师', influence: 'high', isChampion: true },
      { role: 'installer', name: '梁俊', company: '南宁安装公司', title: '负责人', influence: 'medium' },
    ],
    specs: [
      { family: '空气源热泵热水机组', status: 'basis_of_design', model: 'RH-HP-200', competitor: '', value: 3000000, stage: 'awarded' },
      { family: '闭式承压水箱', status: 'specified', model: 'RH-TANK-30', competitor: '', value: 800000, stage: 'awarded' },
    ],
    tender: { name: '酒店群集中热水系统', budget: 4600000, bid: 4400000, toStatus: 'won', rank: 1, winner: '瑞合瑞德' },
    submittals: [{ title: '结算书', docType: 'other' }],
    opps: [{ customer: '东盟商务区管委会', amount: 4400000, stage: 'closed' }],
  },
  {
    name: '郑州航空港区厂房制冷工程', type: 'new_construction', stage: 'lost', region: '华中',
    designInstitute: '河南工业设计院', customer: '航空港智造', value: 6300000,
    stakeholders: [
      { role: 'owner', name: '范军', company: '航空港智造', title: '厂务经理', influence: 'high', isEconomicBuyer: true },
      { role: 'design_engineer', name: '苏婷', company: '河南工业设计院', title: '暖通工程师', influence: 'medium' },
    ],
    specs: [
      { family: '离心式冷水机组', status: 'substituted', model: 'RH-CEN-1000', competitor: '开利', value: 4000000, stage: 'tender' },
      { family: '冷却塔', status: 'lost', model: '', competitor: 'BAC', value: 1000000, stage: 'tender' },
    ],
    tender: { name: '厂房集中制冷总包', budget: 6300000, bid: 6100000, toStatus: 'lost' },
    submittals: [{ title: '投标文件', docType: 'commercial_bid' }],
    opps: [{ customer: '航空港智造', amount: 6100000, stage: 'lost' }],
  },
];

// 未归属商机线索 (供「关联线索」演示)
const UNASSIGNED_OPPS = [
  { customer: '绵阳科技城医院', projectName: '绵阳科技城医院暖通线索', amount: 2100000, stage: 'following' },
  { customer: '遵义医专附属医院', projectName: '遵义医专热水改造线索', amount: 1300000, stage: 'visit' },
  { customer: '柳州工业园', projectName: '柳州工业园制冷线索', amount: 3500000, stage: 'proposal' },
];

async function main() {
  console.log(`[seed-pms-demo] target=${BASE}`);

  // 幂等检查
  const existing = await get('/api/pms/projects?limit=200');
  const already = (existing.projects || []).filter((p) => (p.projectName || '').startsWith(PREFIX));
  if (already.length >= PROJECTS.length) {
    console.log(`[seed-pms-demo] 已存在 ${already.length} 个示例项目, 跳过 (幂等).`);
    return;
  }

  let createdProjects = 0;
  for (const def of PROJECTS) {
    try {
      const { project } = await api('/api/pms/projects', {
        projectName: `${PREFIX}${def.name}`,
        projectType: def.type,
        region: def.region,
        designInstitute: def.designInstitute || undefined,
        customerName: def.customer,
        estimatedValue: def.value,
        stage: def.stage,
      });
      const pid = project.id;
      createdProjects += 1;
      console.log(`  ✓ 项目 [${def.stage}] ${def.name} (${pid})`);

      for (const s of def.stakeholders) {
        await api(`/api/pms/projects/${pid}`, {
          action: 'add_stakeholder', role: s.role, name: s.name, company: s.company, title: s.title,
          influence: s.influence, isChampion: !!s.isChampion, isEconomicBuyer: !!s.isEconomicBuyer,
        }).catch((e) => console.warn(`    ! 干系人 ${s.name}: ${e.message}`));
      }

      for (const sp of def.specs) {
        await api(`/api/pms/projects/${pid}`, {
          action: 'add_spec', equipmentFamily: sp.family, ourBrandStatus: sp.status,
          ourProductModel: sp.model || undefined, competitorBrand: sp.competitor || undefined,
          estimatedValue: sp.value, specStage: sp.stage,
        }).catch((e) => console.warn(`    ! 规格 ${sp.family}: ${e.message}`));
      }

      if (def.tender) {
        try {
          const t = await api(`/api/pms/projects/${pid}/tenders`, {
            action: 'create', tenderName: def.tender.name, budgetAmount: def.tender.budget, bidAmount: def.tender.bid,
          });
          const tid = t.tender?.id;
          // 流转: preparing → submitted → (opened) → won/lost
          if (tid && def.tender.toStatus && def.tender.toStatus !== 'preparing') {
            const path = def.tender.toStatus === 'submitted'
              ? ['submitted']
              : def.tender.toStatus === 'won'
                ? ['submitted', 'opened', 'won']
                : def.tender.toStatus === 'lost'
                  ? ['submitted', 'opened', 'lost']
                  : ['submitted'];
            for (const st of path) {
              await api(`/api/pms/projects/${pid}/tenders`, {
                action: 'transition', tenderId: tid, toStatus: st,
                ...(st === 'won' ? { ourRank: def.tender.rank || 1, winnerName: def.tender.winner } : {}),
                ...(st === 'lost' ? { winnerName: def.tender.winner || '竞品', result: '技术分落后' } : {}),
              }).catch((e) => console.warn(`    ! 标段流转 ${st}: ${e.message}`));
            }
          }
        } catch (e) { console.warn(`    ! 标段: ${e.message}`); }
      }

      for (const sub of def.submittals) {
        await api(`/api/pms/projects/${pid}/submittals`, {
          action: 'create', title: sub.title, docType: sub.docType,
        }).catch((e) => console.warn(`    ! 提交物 ${sub.title}: ${e.message}`));
      }

      for (const o of def.opps) {
        await api(`/api/pms/projects/${pid}`, {
          action: 'create_opportunity', customerName: o.customer,
          projectName: `${def.name} 报价`, estimatedAmount: o.amount, stage: o.stage,
        }).catch((e) => console.warn(`    ! 商机 ${o.customer}: ${e.message}`));
      }
    } catch (e) {
      console.error(`  ✗ 项目 ${def.name} 失败: ${e.message}`);
    }
  }

  // 未归属线索
  let unassignedOk = 0;
  for (const o of UNASSIGNED_OPPS) {
    try {
      await api('/api/pms/opportunities', {
        dealerOrgId: 'default', customerName: o.customer, projectName: o.projectName,
        estimatedAmount: o.amount, stage: o.stage,
      });
      unassignedOk += 1;
    } catch (e) { console.warn(`  ! 未归属线索 ${o.customer}: ${e.message}`); }
  }

  console.log(`\n[seed-pms-demo] 完成: 项目 ${createdProjects}/${PROJECTS.length}, 未归属线索 ${unassignedOk}/${UNASSIGNED_OPPS.length}`);
  console.log(`打开 ${BASE}/pms/projects 查看.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
