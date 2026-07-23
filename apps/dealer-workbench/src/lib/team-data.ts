// 团队业绩数据层：销售排行 / 提成 / 目标达成 / 任务分配
export interface SalesRep {
  id: string;
  name: string;
  role: '金牌顾问' | '高级顾问' | '顾问';
  avatar: string;
  monthlySigned: number;   // 本月签约额
  monthlyTarget: number;   // 个人目标
  deals: number;           // 成交单数
  leads: number;           // 在手线索
  commissionRate: number;  // 提成比例
  certLevel: number;       // 产品认证等级 1-5
  followTasks: number;     // 待跟进任务
}

export const REPS: SalesRep[] = [
  { id:'s1', name:'李娜',   role:'金牌顾问', avatar:'李', monthlySigned:1280000, monthlyTarget:1000000, deals:5, leads:12, commissionRate:0.035, certLevel:5, followTasks:3 },
  { id:'s2', name:'王强',   role:'高级顾问', avatar:'王', monthlySigned:860000,  monthlyTarget:800000,  deals:3, leads:9,  commissionRate:0.030, certLevel:4, followTasks:5 },
  { id:'s3', name:'张敏',   role:'高级顾问', avatar:'张', monthlySigned:720000,  monthlyTarget:800000,  deals:3, leads:11, commissionRate:0.030, certLevel:4, followTasks:2 },
  { id:'s7', name:'张伟',   role:'高级顾问', avatar:'张', monthlySigned:800000,  monthlyTarget:800000,  deals:2, leads:8,  commissionRate:0.030, certLevel:4, followTasks:4 },
  { id:'s4', name:'刘洋',   role:'顾问',     avatar:'刘', monthlySigned:540000,  monthlyTarget:600000,  deals:2, leads:8,  commissionRate:0.025, certLevel:3, followTasks:6 },
  { id:'s5', name:'陈静',   role:'顾问',     avatar:'陈', monthlySigned:480000,  monthlyTarget:600000,  deals:2, leads:7,  commissionRate:0.025, certLevel:3, followTasks:4 },
  { id:'s6', name:'赵磊',   role:'顾问',     avatar:'赵', monthlySigned:310000,  monthlyTarget:500000,  deals:1, leads:6,  commissionRate:0.022, certLevel:2, followTasks:8 },
];

export function teamSummary() {
  const totalSigned = REPS.reduce((a, r) => a + r.monthlySigned, 0);
  const totalTarget = REPS.reduce((a, r) => a + r.monthlyTarget, 0);
  const totalDeals = REPS.reduce((a, r) => a + r.deals, 0);
  const totalCommission = REPS.reduce((a, r) => a + r.monthlySigned * r.commissionRate, 0);
  return {
    totalSigned, totalTarget,
    completion: totalSigned / totalTarget,
    totalDeals,
    totalCommission,
    headcount: REPS.length,
    avgDeal: Math.round(totalSigned / totalDeals),
  };
}
