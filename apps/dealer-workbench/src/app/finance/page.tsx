'use client';
import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { apiFetch, bim } from '../../lib/api';
import { RECEIVABLES, PURCHASE_ORDERS, ageBucket, financeSummary } from '../../lib/finance-data';
import { AlertTriangle, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';

const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString()}`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const PO_COLOR = { '待发货': 'var(--warning)', '运输中': 'var(--info)', '已入库': 'var(--success)' };

export default function FinancePage() {
  const { data: raw } = useSWR('/api/v2/bim', apiFetch);
  const bimItems: any[] = raw ? (Array.isArray(raw) ? raw : raw.items ?? []) : [];
  // 本地回款覆盖：id → 已收金额（调用 bim.updatePaid 后乐观更新）
  const [paidOverride, setPaidOverride] = useState<Record<string, number>>({});

  const receivables = bimItems.length
    ? bimItems.map((p: any) => ({
        id: p.id,
        customer: p.customerName || p.quotationNo || p.id.slice(0, 8),
        invoiceNo: p.quotationNo || p.id.slice(0, 8),
        contractValue: Number(p.costBreakdown?.total) || 0,
        received: paidOverride[p.id] ?? Number(p.paidValue) ?? 0,
        signedAt: p.createdAt?.slice(0, 10) || '',
        dueAt: p.createdAt
          ? new Date(new Date(p.createdAt).getTime() + 90 * 86400000).toISOString().slice(0, 10)
          : '',
      })).filter((r: any) => r.contractValue > 0)
    : RECEIVABLES;

  const totalContract = receivables.reduce((s: number, r: any) => s + r.contractValue, 0);
  const totalReceived = receivables.reduce((s: number, r: any) => s + r.received, 0);
  const s = bimItems.length
    ? { totalContract, totalReceived, outstanding: totalContract - totalReceived,
        collectRate: totalContract ? totalReceived / totalContract : 0,
        overdue: 0, poInTransit: 0, poTotal: 0 }
    : financeSummary();

  // ── 经营风险计算 ──
  const outstanding = receivables.map((r: any) => ({ ...r, out: r.contractValue - r.received }))
    .filter((r: any) => r.out > 0).sort((a: any, b: any) => b.out - a.out);
  const totalOut = outstanding.reduce((a: number, r: any) => a + r.out, 0);
  const top1Pct  = totalOut ? outstanding[0]?.out / totalOut : 0;
  const top3Pct  = totalOut ? outstanding.slice(0, 3).reduce((a: number, r: any) => a + r.out, 0) / totalOut : 0;
  const overdueItems = receivables.filter((r: any) => {
    const b = ageBucket(r); return b.key === 'over0' || b.key === 'over30';
  });
  const overdueTotalOut = overdueItems.reduce((a: number, r: any) => a + (r.contractValue - r.received), 0);
  const ageBuckets = [
    { label: '未到期',    key: 'current', color: 'var(--info)' },
    { label: '逾期<30天', key: 'over0',   color: 'var(--warning)' },
    { label: '逾期>30天', key: 'over30',  color: 'var(--danger)' },
    { label: '已结清',    key: 'clear',   color: 'var(--success)' },
  ].map(b => ({ ...b, count: receivables.filter((r: any) => ageBucket(r).key === b.key).length,
    amount: receivables.filter((r: any) => ageBucket(r).key === b.key)
      .reduce((a: number, r: any) => a + (r.contractValue - r.received), 0) }));

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <PageHeader title="财务与经营风险" subtitle="应收风险监控 · 客户集中度 · 采购依赖" />

        {/* ── 经营风险卡 ── */}
        <div className="g4" style={{ gap: 12, marginBottom: 20 }}>
          <div className="card-elevated" style={{ padding: '16px 20px', borderTop: `3px solid ${top1Pct > 0.4 ? 'var(--danger)' : 'var(--warning)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <ShieldAlert size={13} style={{ color: top1Pct > 0.4 ? 'var(--danger)' : 'var(--warning)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>单客集中度</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: top1Pct > 0.4 ? 'var(--danger)' : 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{pct(top1Pct)}</div>
            <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginTop: 2 }}>最大单客占应收比 {top1Pct > 0.4 ? '⚠️ 偏高' : '正常'}</div>
          </div>

          <div className="card-elevated" style={{ padding: '16px 20px', borderTop: `3px solid ${top3Pct > 0.7 ? 'var(--danger)' : 'var(--warning)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendingDown size={13} style={{ color: top3Pct > 0.7 ? 'var(--danger)' : 'var(--warning)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>TOP3 集中度</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: top3Pct > 0.7 ? 'var(--danger)' : 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{pct(top3Pct)}</div>
            <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginTop: 2 }}>前3客户占应收比</div>
          </div>

          <div className="card-elevated" style={{ padding: '16px 20px', borderTop: `3px solid ${overdueItems.length > 0 ? 'var(--danger)' : 'var(--success)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={13} style={{ color: overdueItems.length > 0 ? 'var(--danger)' : 'var(--success)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>逾期应收</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: overdueItems.length > 0 ? 'var(--danger)' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>{fmt(overdueTotalOut)}</div>
            <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginTop: 2 }}>{overdueItems.length} 笔逾期未清</div>
          </div>

          <div className="card-elevated" style={{ padding: '16px 20px', borderTop: '3px solid var(--info)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Clock size={13} style={{ color: 'var(--info)' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>在途采购</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{s.poInTransit}<span style={{ fontSize: 16, fontWeight: 500, color: 'var(--t-secondary)', marginLeft: 2 }}>单</span></div>
            <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginTop: 2 }}>总额 {fmt(s.poTotal)}</div>
          </div>
        </div>

        <div className="g2" style={{ gap: 16, marginBottom: 16 }}>
          {/* 账龄分布 */}
          <div className="card-elevated" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--t-primary)' }}>应收账龄分布</div>
            {ageBuckets.map(b => (
              <div key={b.key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: b.color }}>{b.label}</span>
                  <span style={{ color: 'var(--t-secondary)' }}>{b.count} 笔 · {fmt(b.amount)}</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: totalOut ? `${b.amount / totalOut * 100}%` : '0%', background: b.color, borderRadius: 3, transition: 'width 600ms' }} />
                </div>
              </div>
            ))}
          </div>

          {/* 采购订单 */}
          <div className="card-elevated" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: 'var(--t-primary)' }}>向 Rhautt 采购订单</div>
            <div style={{ fontSize: 12, color: 'var(--t-secondary)', marginBottom: 14 }}>采购总额 {fmt(s.poTotal)}</div>
            {PURCHASE_ORDERS.map(p => (
              <div key={p.id} style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{p.poNo}</span>
                  <span style={{ fontSize: 11, background: `${PO_COLOR[p.status]}1a`, color: PO_COLOR[p.status], padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{p.status}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--t-secondary)', marginBottom: 3 }}>{p.items}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmt(p.amount)}</span>
                  <span style={{ color: 'var(--t-tertiary)' }}>预计 {p.eta.slice(5)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 应收账款明细 */}
        <div className="card-elevated" style={{ padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--t-primary)' }}>应收账款明细</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: 'var(--t-secondary)', fontSize: 11, textAlign: 'left' }}>
                {['客户', '合同额', '已收', '应收余额', '账龄', '风险'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', fontWeight: 600, letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receivables.map((r: any) => {
                const b = ageBucket(r);
                const out = r.contractValue - r.received;
                const riskPct = totalOut ? out / totalOut : 0;
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 600 }}>{r.customer}</div>
                      <div style={{ fontSize: 10, color: 'var(--t-tertiary)' }}>{r.invoiceNo}</div>
                    </td>
                    <td style={{ padding: '10px' }}>{fmt(r.contractValue)}</td>
                    <td style={{ padding: '10px' }}>
                      <PaidCell id={r.id} value={r.received} max={r.contractValue}
                        onSave={v => { setPaidOverride(m => ({ ...m, [r.id]: v })); bim.updatePaid(r.id, v).catch(() => {}); mutate('/api/v2/bim'); }} />
                    </td>
                    <td style={{ padding: '10px', fontWeight: 700, color: out > 0 ? 'var(--warning)' : 'var(--success)' }}>{fmt(out)}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: 11, background: `${b.color}1a`, color: b.color, padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>{b.label}</span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 48, height: 4, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${riskPct * 100}%`, background: riskPct > 0.3 ? 'var(--danger)' : 'var(--warning)', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>{pct(riskPct)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PaidCell({ id, value, max, onSave }: { id: string; value: number; max: number; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString()}`;
  if (!editing) return (
    <button onClick={() => { setInput(String(value)); setEditing(true); }}
      style={{ fontSize: 13, color: '#16a34a', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline dotted' }}>
      {fmt(value)}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <input autoFocus value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { onSave(Number(input) || 0); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
        style={{ width: 80, fontSize: 12, padding: '2px 6px', border: '1px solid var(--info)', borderRadius: 4, outline: 'none' }} />
      <button onClick={() => { onSave(Number(input) || 0); setEditing(false); }}
        style={{ fontSize: 11, padding: '2px 6px', background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>✓</button>
    </div>
  );
}
