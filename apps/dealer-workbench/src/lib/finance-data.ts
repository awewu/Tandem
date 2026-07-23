// 财务与供应链数据层：应收账款账龄 / 回款 / 向品牌采购
export interface Receivable {
  id: string;
  customer: string;
  contractValue: number;
  received: number;
  invoiceNo: string;
  signedAt: string;       // 签约日
  dueAt: string;          // 应收到期日
}

const d = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const RECEIVABLES: Receivable[] = [
  { id:'r-c1', customer:'刘建国', contractValue:220000, received:198000, invoiceNo:'INV-2406-C01', signedAt:d(-45), dueAt:d(5) },
  { id:'r-c2', customer:'陈美玲', contractValue:580000, received:406000, invoiceNo:'INV-2406-C02', signedAt:d(-28), dueAt:d(32) },
  { id:'r-c3', customer:'王庆华', contractValue:1280000, received:384000, invoiceNo:'INV-2406-C03', signedAt:d(-12), dueAt:d(78) },
  { id:'r1', customer:'黄金山', contractValue:520000, received:156000, invoiceNo:'INV-2406-001', signedAt:d(-5),  dueAt:d(25) },
  { id:'r2', customer:'徐晶晶', contractValue:310000, received:93000,  invoiceNo:'INV-2406-002', signedAt:d(-12), dueAt:d(18) },
  { id:'r3', customer:'马俊辉', contractValue:680000, received:340000, invoiceNo:'INV-2405-018', signedAt:d(-28), dueAt:d(2) },
  { id:'r4', customer:'林美霞', contractValue:245000, received:122500, invoiceNo:'INV-2405-015', signedAt:d(-18), dueAt:d(-3) },
  { id:'r5', customer:'曹志远', contractValue:395000, received:355500, invoiceNo:'INV-2404-009', signedAt:d(-40), dueAt:d(-12) },
  { id:'r6', customer:'郑国强', contractValue:430000, received:129000, invoiceNo:'INV-2406-005', signedAt:d(-9),  dueAt:d(30) },
];

// 账龄分桶
export function ageBucket(r: Receivable): { label: string; color: string; key: string } {
  const outstanding = r.contractValue - r.received;
  if (outstanding <= 0) return { label: '已结清', color: '#16a34a', key: 'clear' };
  const overdueDays = Math.round((Date.now() - new Date(r.dueAt).getTime()) / 86400000);
  if (overdueDays > 30) return { label: '逾期>30天', color: '#dc2626', key: 'over30' };
  if (overdueDays > 0)  return { label: '逾期<30天', color: '#d97706', key: 'over0' };
  return { label: '未到期', color: '#2563eb', key: 'current' };
}

export interface PurchaseOrder {
  id: string;
  poNo: string;
  items: string;
  amount: number;
  status: '待发货' | '运输中' | '已入库';
  eta: string;
}

export const PURCHASE_ORDERS: PurchaseOrder[] = [
  { id:'po1', poNo:'PO-2406-011', items:'瑞美热泵16kW ×2 / 新风500 ×2', amount:92400, status:'运输中', eta:d(3) },
  { id:'po2', poNo:'PO-2406-008', items:'Econet中枢 ×5 / 温控器 ×24', amount:48160, status:'待发货', eta:d(7) },
  { id:'po3', poNo:'PO-2405-022', items:'分集水器 ×8 / RO净水 ×3', amount:52080, status:'已入库', eta:d(-4) },
  { id:'po4', poNo:'PO-2406-015', items:'地源热泵20kW ×1', amount:54600, status:'待发货', eta:d(12) },
];

export function financeSummary() {
  const totalContract = RECEIVABLES.reduce((a, r) => a + r.contractValue, 0);
  const totalReceived = RECEIVABLES.reduce((a, r) => a + r.received, 0);
  const outstanding = totalContract - totalReceived;
  const overdue = RECEIVABLES.filter(r => {
    const b = ageBucket(r);
    return b.key === 'over0' || b.key === 'over30';
  }).reduce((a, r) => a + (r.contractValue - r.received), 0);
  const poTotal = PURCHASE_ORDERS.reduce((a, p) => a + p.amount, 0);
  return {
    totalContract, totalReceived, outstanding,
    collectRate: totalContract ? totalReceived / totalContract : 0,
    overdue,
    poInTransit: PURCHASE_ORDERS.filter(p => p.status !== '已入库').length,
    poTotal,
  };
}
