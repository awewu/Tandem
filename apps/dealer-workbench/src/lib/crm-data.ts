// CRM 数据层：8阶段配置 / 类型 / 演示数据 / 数据服务 / 经营分析
import { crm } from './api';

// HVAC 经销商专属销售漏斗 8 阶段（canonical key → 中文阶段名）
export const STAGES = [
  { key: 'lead',      label: 'AI问诊',   color: '#94a3b8', hint: '新线索待确认' },
  { key: 'contacted', label: '电话确认', color: '#0891b2', hint: '72h内回访' },
  { key: 'survey',    label: '上门勘测', color: '#2563eb', hint: '预约现场测量' },
  { key: 'design',    label: '方案设计', color: '#7c3aed', hint: '出图与配置' },
  { key: 'quoted',    label: '报价确认', color: '#d97706', hint: '报价已发送' },
  { key: 'won',       label: '合同签订', color: '#16a34a', hint: '已签约' },
  { key: 'delivery',  label: '施工交付', color: '#0d9488', hint: '安装调试中' },
  { key: 'review',    label: '验收回访', color: '#1a1f36', hint: '已交付待回访' },
] as const;

export type StageKey = typeof STAGES[number]['key'];
export const STAGE_KEYS = STAGES.map(s => s.key) as StageKey[];
export const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.key, s])) as Record<StageKey, typeof STAGES[number]>;
export const WON_STAGES: StageKey[] = ['won', 'delivery', 'review']; // 计入已签约 GMV

export interface CustomerSummary {
  name: string;
  city?: string | null;
  source?: string;
  tags?: string[];
  profile?: Record<string, any>;
  lastInteractionAt?: string | null;
}

export interface PipelineOpp {
  id: string;
  customerId: string;
  stage: StageKey;
  estimatedValue: number;
  probability: number;
  nextActionAt?: string | null;
  lostReason?: string | null;
  updatedAt?: string;
  createdAt?: string;
  customer: CustomerSummary | null;
}

const day = 86400000;
const rel = (d: number) => new Date(Date.now() + d * day).toISOString();

// __DEMO_DATA__
export const DEMO_OPPS: PipelineOpp[] = [
  { id:'d17',customerId:'c17',stage:'won',     estimatedValue:220000,  probability:1.00, nextActionAt:rel(0),  createdAt:rel(-30), updatedAt:rel(-1),  customer:{name:'刘建国',city:'上海',source:'rysnova_diagnosis',profile:{area:120,systems:['hot_water','floor_heat','fresh_air'],painPoints:['冬季室温最低6℃','三孩家庭'],installer:'李工',bom:[{item:'瑞美RHP-8C热泵',qty:1,price:38000},{item:'分集水器',qty:1,price:4200},{item:'新风ERV-150',qty:1,price:12800},{item:'热水机WH-150',qty:1,price:8600},{item:'Econet温控器',qty:4,price:4800},{item:'配管配件',qty:1,price:8400},{item:'人工安装',qty:1,price:18000}],payment:{deposit:110000,completion:88000,warranty:22000},iotDelivered:true},tags:['地暖+新风','IoT已交付','已签约']} },
  { id:'d18',customerId:'c18',stage:'delivery',estimatedValue:580000,  probability:1.00, nextActionAt:rel(20), createdAt:rel(-45), updatedAt:rel(-2),  customer:{name:'陈美玲',city:'杭州',source:'rysnova_diagnosis',profile:{area:300,systems:['hot_water','heating','air','fresh_air','smart_control','ro_water'],painPoints:['梅雨季湿度大','冬冷夏热','别墅层高3.2m'],installer:'张工',bom:[{item:'热泵RHP-16DC',qty:1,price:72000},{item:'冷辐射吊顶',qty:5,price:34000},{item:'分集水器DN25',qty:1,price:8600},{item:'新风ERV-300',qty:1,price:28000},{item:'RO净水RF-600',qty:1,price:9800},{item:'Econet中枢',qty:1,price:6800},{item:'Econet温控',qty:8,price:9600},{item:'配管配件',qty:1,price:22000},{item:'人工安装',qty:1,price:36000}],payment:{deposit:232000,progress:174000,completion:116000,tail:58000}},tags:['五恒系统','大户型','施工中','已签约']} },
  { id:'d19',customerId:'c19',stage:'design',  estimatedValue:1280000, probability:1.00, nextActionAt:rel(14), createdAt:rel(-20), updatedAt:rel(-1),  customer:{name:'王庆华',city:'成都',source:'rysnova_diagnosis',profile:{area:500,systems:['hot_water','heating','air','fresh_air','smart_control','ro_water','pool'],painPoints:['成都盆地冬冷夏热','恒温恒湿全年舒适'],installer:'王工',bom:[{item:'地源热泵GSHP-20',qty:1,price:118000},{item:'打井费用',qty:1,price:28000},{item:'冷辐射吊顶',qty:8,price:54400},{item:'分集水器DN32',qty:2,price:12400},{item:'新风ERV-500',qty:2,price:70000},{item:'直饮RO',qty:1,price:18600},{item:'Econet中枢',qty:2,price:13600},{item:'Econet温控',qty:12,price:14400},{item:'传感器',qty:8,price:6400},{item:'泳池热水机',qty:1,price:32000},{item:'配管配件',qty:1,price:48000},{item:'人工安装',qty:1,price:68000}],payment:{intention:50000,deposit:334000,progress:512000,completion:256000,tail:128000}},tags:['地源热泵','五恒旗舰','豪宅','出图中','已签约']} },
  { id:'d1', customerId:'c1', stage:'lead',      estimatedValue:280000, probability:0.10, nextActionAt:rel(1),  createdAt:rel(-2),  updatedAt:rel(-2),  customer:{name:'张建国',city:'上海',source:'rysnova_diagnosis',profile:{area:180,systems:['hot_water','air','fresh_air'],painPoints:['热水不够','夏天热']},tags:['五恒系统']} },
  { id:'d2', customerId:'c2', stage:'lead',      estimatedValue:420000, probability:0.10, nextActionAt:rel(0),  createdAt:rel(-1),  updatedAt:rel(-1),  customer:{name:'陈小燕',city:'杭州',source:'rysnova_diagnosis',profile:{area:220,systems:['heating','air','fresh_air','smart_control'],painPoints:['冬天冷','空气差']},tags:['五恒系统','大户型']} },
  { id:'d3', customerId:'c3', stage:'contacted', estimatedValue:195000, probability:0.25, nextActionAt:rel(3),  createdAt:rel(-5),  updatedAt:rel(-1),  customer:{name:'王磊',city:'南京',source:'展厅',profile:{area:130,systems:['hot_water','floor_heat'],painPoints:['地暖不热']},tags:['地暖+热水']} },
  { id:'d4', customerId:'c4', stage:'contacted', estimatedValue:550000, probability:0.30, nextActionAt:rel(2),  createdAt:rel(-4),  updatedAt:rel(-2),  customer:{name:'李媛媛',city:'上海',source:'转介绍',profile:{area:310,systems:['hot_water','heating','air','fresh_air','smart_control'],painPoints:['全系舒适']},tags:['五恒旗舰','大户型']} },
  { id:'d5', customerId:'c5', stage:'survey',    estimatedValue:320000, probability:0.40, nextActionAt:rel(4),  createdAt:rel(-8),  updatedAt:rel(-1),  customer:{name:'刘志伟',city:'苏州',source:'rysnova_diagnosis',profile:{area:195,systems:['heating','air','fresh_air']},tags:['地暖+新风']} },
  { id:'d6', customerId:'c6', stage:'survey',    estimatedValue:280000, probability:0.40, nextActionAt:rel(5),  createdAt:rel(-7),  updatedAt:rel(-3),  customer:{name:'赵欣',city:'上海',source:'官网',profile:{area:165,systems:['hot_water','air']},tags:['热水+空调']} },
  { id:'d7', customerId:'c7', stage:'design',    estimatedValue:480000, probability:0.55, nextActionAt:rel(6),  createdAt:rel(-14), updatedAt:rel(-2),  customer:{name:'周浩然',city:'杭州',source:'转介绍',profile:{area:260,systems:['hot_water','heating','air','fresh_air','smart_control']},tags:['五恒系统']} },
  { id:'d8', customerId:'c8', stage:'design',    estimatedValue:220000, probability:0.55, nextActionAt:rel(7),  createdAt:rel(-10), updatedAt:rel(-4),  customer:{name:'吴晓青',city:'宁波',source:'展厅',profile:{area:140,systems:['hot_water','floor_heat','fresh_air']},tags:['地暖+净水']} },
  { id:'d9', customerId:'c9', stage:'quoted',    estimatedValue:380000, probability:0.65, nextActionAt:rel(2),  createdAt:rel(-18), updatedAt:rel(-1),  customer:{name:'孙建华',city:'上海',source:'rysnova_diagnosis',profile:{area:210,systems:['hot_water','heating','air','smart_control']},tags:['四系统','aiReport']} },
  { id:'d10',customerId:'c10',stage:'quoted',    estimatedValue:160000, probability:0.70, nextActionAt:rel(-1), createdAt:rel(-12), updatedAt:rel(-2),  customer:{name:'郑丽华',city:'南京',source:'展厅',profile:{area:120,systems:['hot_water','air']},tags:['热水+空调']} },
  { id:'d11',customerId:'c11',stage:'won',        estimatedValue:520000, probability:1.00, nextActionAt:rel(10), createdAt:rel(-25), updatedAt:rel(-5),  customer:{name:'黄金山',city:'上海',source:'转介绍',profile:{area:290,systems:['hot_water','heating','air','fresh_air','smart_control']},tags:['五恒旗舰','已签约']} },
  { id:'d12',customerId:'c12',stage:'won',        estimatedValue:310000, probability:1.00, nextActionAt:rel(8),  createdAt:rel(-20), updatedAt:rel(-8),  customer:{name:'徐晶晶',city:'苏州',source:'rysnova_diagnosis',profile:{area:180,systems:['heating','air','fresh_air']},tags:['地暖+新风+空调','已签约']} },
  { id:'d13',customerId:'c13',stage:'delivery',   estimatedValue:680000, probability:1.00, nextActionAt:rel(15), createdAt:rel(-40), updatedAt:rel(-3),  customer:{name:'马俊辉',city:'杭州',source:'展厅',profile:{area:380,systems:['hot_water','heating','air','fresh_air','smart_control']},tags:['五恒旗舰','施工中']} },
  { id:'d14',customerId:'c14',stage:'delivery',   estimatedValue:245000, probability:1.00, nextActionAt:rel(12), createdAt:rel(-35), updatedAt:rel(-6),  customer:{name:'林美霞',city:'上海',source:'转介绍',profile:{area:155,systems:['hot_water','floor_heat','fresh_air']},tags:['地暖+新风']} },
  { id:'d15',customerId:'c15',stage:'review',     estimatedValue:395000, probability:1.00, nextActionAt:rel(-3), createdAt:rel(-55), updatedAt:rel(-10), customer:{name:'曹志远',city:'宁波',source:'rysnova_diagnosis',profile:{area:225,systems:['hot_water','heating','air','smart_control']},tags:['待回访','aiReport']} },
  { id:'d16',customerId:'c16',stage:'review',     estimatedValue:285000, probability:1.00, nextActionAt:rel(-5), createdAt:rel(-50), updatedAt:rel(-12), customer:{name:'杨帆',city:'上海',source:'官网',profile:{area:165,systems:['heating','air','fresh_air']},tags:['待回访']} },
];

// ── 经营分析 ────────────────────────────────────────────────────────────────────
export interface Analytics {
  funnel: { stage: StageKey; label: string; count: number; value: number; color: string }[];
  signedGmv: number;       // won+delivery+review 签约总额
  weightedForecast: number;// Σ(estimatedValue × probability)
  conversionRate: number;  // won以上 / 全部
  overdueCount: number;    // nextActionAt 已过期
  monthlyTarget: number;   // 当月目标 GMV（演示值）
  productMix: { label: string; count: number; value: number }[];
}

export function calcAnalytics(opps: PipelineOpp[], monthlyTarget = 3000000): Analytics {
  const now = Date.now();
  const funnel = STAGES.map(s => ({
    stage: s.key, label: s.label, color: s.color,
    count: opps.filter(o => o.stage === s.key).length,
    value: opps.filter(o => o.stage === s.key).reduce((a, o) => a + o.estimatedValue, 0),
  }));
  const won   = opps.filter(o => WON_STAGES.includes(o.stage));
  const total = opps.filter(o => o.stage !== 'lead');
  const products: Record<string, {count:number;value:number}> = {};
  for (const o of opps) {
    const sys: string[] = (o.customer?.profile?.systems as string[]) || [];
    const label = sys.includes('heating') && sys.includes('air') && sys.includes('hot_water') ? '五恒系统'
                : sys.includes('heating') && sys.includes('fresh_air') ? '地暖+新风'
                : sys.includes('hot_water') && sys.includes('air') ? '热水+空调'
                : '其他组合';
    products[label] = { count: (products[label]?.count||0)+1, value: (products[label]?.value||0)+o.estimatedValue };
  }
  return {
    funnel,
    signedGmv: won.reduce((a,o) => a+o.estimatedValue, 0),
    weightedForecast: opps.reduce((a,o) => a+o.estimatedValue*o.probability, 0),
    conversionRate: total.length ? won.length/total.length : 0,
    overdueCount: opps.filter(o => o.nextActionAt && new Date(o.nextActionAt).getTime() < now).length,
    monthlyTarget,
    productMix: Object.entries(products).map(([label,v]) => ({label,...v})).sort((a,b)=>b.value-a.value),
  };
}

// ── 数据服务：API 优先，失败降级演示数据 ──────────────────────────────────────────
export async function loadPipeline(): Promise<{ opps: PipelineOpp[]; demo: boolean }> {
  try {
    const res = await crm.pipeline() as { items: PipelineOpp[] };
    if (res.items?.length) return { opps: res.items as PipelineOpp[], demo: false };
  } catch {}
  return { opps: DEMO_OPPS, demo: true };
}

