import { getToken } from '@rhautt/shared-auth';
// 项目交付数据层：6阶段施工流程 + 里程碑 + 演示数据
export const PROJ_STAGES = [
  { key: 'survey',     label: '现场勘测', color: '#2563eb' },
  { key: 'design',     label: '深化设计', color: '#7c3aed' },
  { key: 'material',   label: '材料下单', color: '#d97706' },
  { key: 'install',    label: '施工安装', color: '#0891b2' },
  { key: 'commission', label: '调试验机', color: '#16a34a' },
  { key: 'acceptance', label: '竣工验收', color: '#1a1f36' },
] as const;

export type ProjStage = typeof PROJ_STAGES[number]['key'];
export const PROJ_STAGE_KEYS = PROJ_STAGES.map(s => s.key) as ProjStage[];
export const PROJ_STAGE_MAP = Object.fromEntries(PROJ_STAGES.map(s => [s.key, s])) as Record<ProjStage, typeof PROJ_STAGES[number]>;

export interface Milestone { label: string; done: boolean }
export interface Project {
  id: string;
  customer: string;
  city: string;
  address: string;
  contractValue: number;   // 合同金额
  paidValue: number;       // 已回款
  stage: ProjStage;
  system: string;          // 系统类型
  installer: string;       // 施工队
  startedAt: string;
  expectedAt: string;      // 预计完工
  milestones: Milestone[];
}

const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const MS = (done: number): Milestone[] => {
  const labels = ['合同确认', '现场复尺', '深化图纸', '材料到货', '主机安装', '管路施工', '系统调试', '客户验收'];
  return labels.map((label, i) => ({ label, done: i < done }));
};

export const DEMO_PROJECTS: Project[] = [
  { id:'p9',  customer:'刘建国', city:'上海', address:'120㎡ 城市三居室', contractValue:220000, paidValue:198000, stage:'acceptance', system:'地暖+新风+热水',              installer:'李工施工队', startedAt:d(-65), expectedAt:d(-3),  milestones:MS(8) },
  { id:'p10', customer:'陈美玲', city:'杭州', address:'300㎡ 联排别墅',   contractValue:580000, paidValue:406000, stage:'install',    system:'热泵冷暖+地暖+新风+Econet', installer:'张工施工队', startedAt:d(-30), expectedAt:d(25),  milestones:MS(5) },
  { id:'p11', customer:'王庆华', city:'成都', address:'500㎡ 独栋豪宅',   contractValue:1280000, paidValue:384000, stage:'design',    system:'地源热泵+冷辐射+新风+全屋Econet', installer:'王工施工队', startedAt:d(-10), expectedAt:d(80), milestones:MS(3) },
  { id:'p1', customer:'黄金山', city:'上海', address:'浦东新区汤臣一品', contractValue:520000, paidValue:156000, stage:'survey',     system:'五恒旗舰', installer:'张工施工队', startedAt:d(-5),  expectedAt:d(45), milestones:MS(2) },
  { id:'p2', customer:'徐晶晶', city:'苏州', address:'工业园区天鹅湖', contractValue:310000, paidValue:93000,  stage:'design',     system:'地暖+新风+空调', installer:'李工施工队', startedAt:d(-12), expectedAt:d(38), milestones:MS(3) },
  { id:'p3', customer:'马俊辉', city:'杭州', address:'西湖区元福里', contractValue:680000, paidValue:340000, stage:'install',    system:'五恒旗舰', installer:'王工施工队', startedAt:d(-28), expectedAt:d(20), milestones:MS(6) },
  { id:'p4', customer:'林美霞', city:'上海', address:'徐汇区滨江一号', contractValue:245000, paidValue:122500, stage:'material',   system:'地暖+新风', installer:'张工施工队', startedAt:d(-18), expectedAt:d(30), milestones:MS(4) },
  { id:'p5', customer:'曹志远', city:'宁波', address:'鄞州区东部新城', contractValue:395000, paidValue:355500, stage:'commission', system:'四系统', installer:'陈工施工队', startedAt:d(-40), expectedAt:d(8),  milestones:MS(7) },
  { id:'p6', customer:'杨帆',   city:'上海', address:'静安区张园', contractValue:285000, paidValue:285000, stage:'acceptance', system:'地暖+新风+空调', installer:'李工施工队', startedAt:d(-52), expectedAt:d(-2), milestones:MS(8) },
  { id:'p7', customer:'郑国强', city:'南京', address:'建邺区江心洲', contractValue:430000, paidValue:129000, stage:'design',     system:'五恒系统', installer:'王工施工队', startedAt:d(-9),  expectedAt:d(42), milestones:MS(3) },
  { id:'p8', customer:'孙丽',   city:'杭州', address:'拱墅区运河上', contractValue:198000, paidValue:99000,  stage:'install',    system:'热水+空调', installer:'陈工施工队', startedAt:d(-22), expectedAt:d(15), milestones:MS(5) },
];

export interface ProjStats {
  active: number; totalContract: number; totalPaid: number; collectRate: number;
  overdue: number; stageCount: { stage: ProjStage; label: string; color: string; count: number }[];
}

// BIM stage → Proj stage 映射
const BIM_TO_PROJ: Record<string, ProjStage> = {
  inherited: 'survey', drawing: 'design', bom_confirmed: 'material',
  construction: 'install', acceptance: 'commission', iot_delivered: 'acceptance',
};

function bimToProject(p: Record<string, any>): Project {
  const checklist: { done: boolean; item: string }[] = p.acceptanceChecklist || [];
  const milestones: Milestone[] = checklist.length
    ? checklist.map(c => ({ label: c.item, done: c.done }))
    : MS(0);
  const total = p.costBreakdown?.total || 0;
  return {
    id: p.id,
    customer: p.customerName || p.quotationNo || p.id.slice(0, 8),
    city: p.city || '—',
    address: p.project?.area ? `${p.project.area}㎡` : '—',
    contractValue: total,
    paidValue: Number(p.paidValue ?? p.paid_value ?? 0),
    stage: BIM_TO_PROJ[p.status] || 'survey',
    // systemFamilies 为 simple-array（API 返数组）；兼容历史字符串形态
    system: (Array.isArray(p.systemFamilies) ? p.systemFamilies : String(p.systemFamilies || '').split(',').filter(Boolean)).join('、') || '—',
    installer: p.assignedTo || '待指派',
    startedAt: p.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    expectedAt: d(60),
    milestones,
  };
}

export async function loadProjects(): Promise<{ projects: Project[]; demo: boolean }> {
  try {
    const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    if (!token) return { projects: DEMO_PROJECTS, demo: true };
    const API = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${API}/api/v2/bim`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('api error');
    const json = await res.json();
    const items: any[] = json.data?.items ?? json.items ?? json.data ?? json;
    if (!Array.isArray(items) || items.length === 0) return { projects: DEMO_PROJECTS, demo: true };
    return { projects: items.map(bimToProject), demo: false };
  } catch {
    return { projects: DEMO_PROJECTS, demo: true };
  }
}

export function calcProjStats(ps: Project[]) {
  const today = new Date().toISOString().slice(0, 10);
  const totalContract = ps.reduce((a, p) => a + p.contractValue, 0);
  const totalPaid = ps.reduce((a, p) => a + p.paidValue, 0);
  return {
    active: ps.filter(p => p.stage !== 'acceptance').length,
    totalContract, totalPaid,
    collectRate: totalContract ? totalPaid / totalContract : 0,
    overdue: ps.filter(p => p.expectedAt < today && p.stage !== 'acceptance').length,
    stageCount: PROJ_STAGES.map(s => ({ stage: s.key, label: s.label, color: s.color, count: ps.filter(p => p.stage === s.key).length })),
  };
}
