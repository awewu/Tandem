// 品牌协同数据层：季度目标 / 活动 / 培训认证 / 数据同步
export interface BrandTarget {
  period: string; target: number; achieved: number; rebateRate: number;
}

export interface Campaign {
  id: string; title: string; type: '促销' | '培训' | '展会' | '返点'; status: '进行中' | '即将开始' | '已结束';
  startAt: string; endAt: string; incentive: string; joined: boolean;
}

export interface Training {
  id: string; title: string; level: number; required: boolean;
  completedBy: number; totalReps: number; deadline: string;
}

const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const BRAND_TARGETS: BrandTarget[] = [
  { period: 'Q1 2026', target: 6000000, achieved: 6150000, rebateRate: 0.035 },
  { period: 'Q2 2026', target: 9000000, achieved: 7230000, rebateRate: 0.030 },
];

export const CAMPAIGNS: Campaign[] = [
  { id:'c1', title:'夏季制冷专项返点', type:'返点', status:'进行中', startAt:d(-15), endAt:d(46), incentive:'签约五恒系统额外 3% 返点', joined:true },
  { id:'c2', title:'Econet 全屋智控推广月', type:'促销', status:'进行中', startAt:d(-8), endAt:d(22), incentive:'智控主机每台补贴 ¥500', joined:true },
  { id:'c3', title:'经销商产品认证培训', type:'培训', status:'即将开始', startAt:d(7), endAt:d(8), incentive:'晋升认证等级，解锁更高折扣', joined:false },
  { id:'c4', title:'2026 华东展商机交流会', type:'展会', status:'即将开始', startAt:d(21), endAt:d(22), incentive:'线索资源分配优先', joined:false },
  { id:'c5', title:'Q1 超额完成奖励兑现', type:'返点', status:'已结束', startAt:d(-90), endAt:d(-45), incentive:'¥21,525 已入账', joined:true },
];

export const TRAININGS: Training[] = [
  { id:'tr1', title:'热泵变频原理与售后处置', level:3, required:true, completedBy:4, totalReps:6, deadline:d(14) },
  { id:'tr2', title:'Econet 系统联调认证（必修）', level:4, required:true, completedBy:2, totalReps:6, deadline:d(7) },
  { id:'tr3', title:'五恒系统方案设计实战', level:4, required:false, completedBy:3, totalReps:6, deadline:d(30) },
  { id:'tr4', title:'新品 FA-500 产品知识', level:2, required:true, completedBy:5, totalReps:6, deadline:d(5) },
];

export function brandSummary() {
  const q2 = BRAND_TARGETS[1];
  const ytdRebate = BRAND_TARGETS.reduce((a, t) => a + Math.min(t.achieved, t.target) * t.rebateRate, 0);
  const completedTrainings = TRAININGS.filter(t => t.completedBy === t.totalReps).length;
  const activeJoined = CAMPAIGNS.filter(c => c.joined && c.status === '进行中').length;
  return {
    q2Progress: q2.achieved / q2.target,
    q2Target: q2.target, q2Achieved: q2.achieved,
    ytdRebate, completedTrainings,
    totalTrainings: TRAININGS.length,
    activeJoined,
  };
}
