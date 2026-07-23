// 售后服务数据层：服务工单 / 保修台账 / 保养提醒
export interface ServiceTicket {
  id: string; customer: string; city: string; system: string;
  type: '保修' | '维修' | '调试' | '保养'; issue: string;
  status: '待派工' | '处理中' | '已完成'; priority: 'high' | 'mid' | 'low';
  createdAt: string; assignedTo?: string;
}

export interface WarrantyRecord {
  id: string; customer: string; city: string; system: string;
  model: string; installedAt: string; warrantyYears: number;
  lastServiceAt?: string; nextServiceAt: string;
}

const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const TICKETS: ServiceTicket[] = [
  { id:'t1', customer:'曹志远', city:'宁波', system:'四系统', type:'调试', issue:'地暖分区控制器无响应', status:'处理中', priority:'high', createdAt:d(-2), assignedTo:'李工' },
  { id:'t2', customer:'黄金山', city:'上海', system:'五恒旗舰', type:'保修', issue:'新风机滤网报警', status:'待派工', priority:'mid', createdAt:d(-1) },
  { id:'t3', customer:'马俊辉', city:'杭州', system:'五恒旗舰', type:'保养', issue:'年度例行保养', status:'待派工', priority:'low', createdAt:d(0) },
  { id:'t4', customer:'林美霞', city:'上海', system:'地暖+新风', type:'维修', issue:'热泵噪音异常', status:'待派工', priority:'high', createdAt:d(0) },
  { id:'t5', customer:'徐晶晶', city:'苏州', system:'地暖+新风', type:'保养', issue:'开机季前保养检查', status:'已完成', priority:'low', createdAt:d(-8), assignedTo:'陈工' },
  { id:'t6', customer:'郑国强', city:'南京', system:'五恒系统', type:'调试', issue:'Econet联动规则配置', status:'已完成', priority:'mid', createdAt:d(-5), assignedTo:'张工' },
  { id:'t_liu_01', customer:'刘建国', city:'上海', system:'地暖+新风+热水', type:'保养', issue:'交付后首次全系统调试保养', status:'已完成', priority:'low', createdAt:d(-15), assignedTo:'李工' },
];

export const WARRANTIES: WarrantyRecord[] = [
  { id:'w1', customer:'曹志远', city:'宁波', system:'四系统', model:'RP-12kW-INV', installedAt:d(-365), warrantyYears:3, lastServiceAt:d(-8), nextServiceAt:d(357) },
  { id:'w2', customer:'马俊辉', city:'杭州', system:'五恒旗舰', model:'RP-16kW-INV', installedAt:d(-40), warrantyYears:5, nextServiceAt:d(325) },
  { id:'w3', customer:'杨帆', city:'上海', system:'地暖+新风', model:'FA-350-HR', installedAt:d(-52), warrantyYears:2, lastServiceAt:d(-52), nextServiceAt:d(313) },
  { id:'w4', customer:'林美霞', city:'上海', system:'地暖+新风', model:'RP-12kW-INV', installedAt:d(-18), warrantyYears:3, nextServiceAt:d(347) },
  { id:'w5', customer:'黄金山', city:'上海', system:'五恒旗舰', model:'RP-16kW-INV', installedAt:d(-5), warrantyYears:5, nextServiceAt:d(360) },
  { id:'w_liu', customer:'刘建国', city:'上海', system:'地暖+新风+热水', model:'RHP-8C', installedAt:d(0), warrantyYears:2, nextServiceAt:d(183) },
];

export function afterSalesSummary() {
  const open = TICKETS.filter(t => t.status !== '已完成').length;
  const urgent = TICKETS.filter(t => t.priority === 'high' && t.status !== '已完成').length;
  const dueService = WARRANTIES.filter(w => new Date(w.nextServiceAt).getTime() - Date.now() < 30 * 86400000).length;
  return { open, urgent, dueService, total: TICKETS.length };
}
