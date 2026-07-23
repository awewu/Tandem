import { getToken } from '@rhautt/shared-auth';
// 经营分析数据层：GMV趋势 / 转化漏斗 / 渠道 / 城市分布 / 季节预测
export interface MonthPoint { month: string; gmv: number; target: number; orders: number }
export interface FunnelStep { stage: string; count: number; rate: number }
export interface Slice { label: string; value: number; color: string }

export const GMV_TREND: MonthPoint[] = [
  { month: '1月', gmv: 1850000, target: 2000000, orders: 6 },
  { month: '2月', gmv: 1420000, target: 2000000, orders: 5 },
  { month: '3月', gmv: 2380000, target: 2500000, orders: 8 },
  { month: '4月', gmv: 3140000, target: 2500000, orders: 11 },
  { month: '5月', gmv: 3730000, target: 3000000, orders: 12 },
  { month: '6月', gmv: 4760000, target: 3000000, orders: 13 },
];

export const FUNNEL: FunnelStep[] = [
  { stage: 'AI问诊',   count: 320, rate: 1.00 },
  { stage: '电话确认', count: 198, rate: 0.62 },
  { stage: '上门勘测', count: 124, rate: 0.39 },
  { stage: '方案设计', count: 86,  rate: 0.27 },
  { stage: '报价确认', count: 58,  rate: 0.18 },
  { stage: '合同签订', count: 41,  rate: 0.13 },
];

export const CHANNELS: Slice[] = [
  { label: '瑞诺瓦AI问诊', value: 42, color: '#E4002B' },
  { label: '老客户转介绍', value: 28, color: '#16a34a' },
  { label: '线下展厅',     value: 18, color: '#2563eb' },
  { label: '官网/线上',    value: 12, color: '#d97706' },
];

export const CITIES: Slice[] = [
  { label: '上海', value: 35, color: '#E4002B' },
  { label: '杭州', value: 22, color: '#2563eb' },
  { label: '成都', value: 20, color: '#16a34a' },
  { label: '苏州', value: 13, color: '#d97706' },
  { label: '南京', value: 10, color: '#7c3aed' },
];

export const PRODUCT_MIX: Slice[] = [
  { label: '地源热泵',   value: 40, color: '#E4002B' },
  { label: '地暖热泵',   value: 28, color: '#2563eb' },
  { label: '新风系统',   value: 20, color: '#16a34a' },
  { label: 'Econet控制', value: 12, color: '#9ca3af' },
];

// 季节趋势：制冷季(夏)/采暖季(冬)双峰 — 对库存备货有价值
export const SEASON: { month: string; demand: number }[] = [
  { month: '1', demand: 75 }, { month: '2', demand: 55 }, { month: '3', demand: 48 },
  { month: '4', demand: 52 }, { month: '5', demand: 70 }, { month: '6', demand: 92 },
  { month: '7', demand: 100 }, { month: '8', demand: 95 }, { month: '9', demand: 62 },
  { month: '10', demand: 58 }, { month: '11', demand: 82 }, { month: '12', demand: 88 },
];

export function analyticsSummary() {
  const ytdGmv = GMV_TREND.reduce((a, m) => a + m.gmv, 0);
  const ytdTarget = GMV_TREND.reduce((a, m) => a + m.target, 0);
  const ytdOrders = GMV_TREND.reduce((a, m) => a + m.orders, 0);
  return {
    ytdGmv, ytdTarget,
    completion: ytdGmv / ytdTarget,
    ytdOrders,
    avgOrder: Math.round(ytdGmv / ytdOrders),
    signRate: FUNNEL[FUNNEL.length - 1].rate,
  };
}

/** 尝试从 CRM pipeline 构建真实分析数据，失败则返回 null（用 demo） */
export async function loadLiveAnalytics(): Promise<{
  gmvTrend: MonthPoint[]; funnel: FunnelStep[];
  cities: Slice[]; summary: ReturnType<typeof analyticsSummary>;
} | null> {
  try {
    const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    if (!token) return null;
    const API = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${API}/api/v2/crm/pipeline`, { credentials: 'include', headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const json = await res.json();
    const opps: any[] = json.data?.items ?? json.items ?? json.data ?? json;
    if (!Array.isArray(opps) || opps.length === 0) return null;

    // 漏斗 — 按阶段计数
    const stageOrder = ['lead','qualified','surveyed','quoted','signed','lost'];
    const stageCn: Record<string, string> = { lead:'AI问诊', qualified:'电话确认', surveyed:'上门勘测', quoted:'方案报价', signed:'合同签订', lost:'已丢单' };
    const stageCounts: Record<string, number> = {};
    for (const o of opps) stageCounts[o.stage] = (stageCounts[o.stage] || 0) + 1;
    const total = opps.length;
    const funnel: FunnelStep[] = stageOrder
      .filter(s => s !== 'lost')
      .map(s => ({ stage: stageCn[s] || s, count: stageCounts[s] || 0, rate: (stageCounts[s] || 0) / total }));

    // GMV 趋势 — signed 商机按月分组
    const signed = opps.filter(o => o.stage === 'signed');
    const byMonth: Record<string, { gmv: number; orders: number }> = {};
    for (const o of signed) {
      const m = new Date(o.createdAt || Date.now()).toLocaleDateString('zh-CN', { month: 'long' }).replace('月', '月');
      if (!byMonth[m]) byMonth[m] = { gmv: 0, orders: 0 };
      byMonth[m].gmv += Number(o.estimatedValue) || 0;
      byMonth[m].orders += 1;
    }
    const gmvTrend: MonthPoint[] = Object.entries(byMonth).slice(-6).map(([month, v]) => ({
      month, gmv: v.gmv, target: v.gmv * 1.1, orders: v.orders,
    }));

    // 城市分布
    const cityCount: Record<string, number> = {};
    for (const o of opps) {
      const city = o.customer?.city || '未知';
      cityCount[city] = (cityCount[city] || 0) + 1;
    }
    const cityColors = ['#C8102E','#2563eb','#16a34a','#d97706','#7c3aed'];
    const cities: Slice[] = Object.entries(cityCount)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([label, count], i) => ({ label, value: Math.round(count / total * 100), color: cityColors[i] || '#9ca3af' }));

    const ytdGmv = signed.reduce((s, o) => s + (Number(o.estimatedValue) || 0), 0);
    const ytdTarget = ytdGmv * 1.1;
    const ytdOrders = signed.length;
    return {
      gmvTrend: gmvTrend.length ? gmvTrend : GMV_TREND,
      funnel: funnel.some(f => f.count > 0) ? funnel : FUNNEL,
      cities: cities.length ? cities : CITIES,
      summary: { ytdGmv, ytdTarget, completion: ytdGmv / ytdTarget, ytdOrders,
        avgOrder: ytdOrders ? Math.round(ytdGmv / ytdOrders) : 0,
        signRate: total ? (stageCounts['signed'] || 0) / total : 0 },
    };
  } catch { return null; }
}
