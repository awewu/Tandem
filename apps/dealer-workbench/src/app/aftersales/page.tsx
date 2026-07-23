'use client';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { apiFetch, aftersales } from '../../lib/api';
import { TICKETS, WARRANTIES, afterSalesSummary, type ServiceTicket } from '../../lib/aftersales-data';
import { PageHeader } from '@rhautt/ui';

const P = { high: { label: '紧急', color: 'var(--danger)', bg: 'var(--danger-bg)' }, mid: { label: '普通', color: 'var(--warning)', bg: 'var(--warning-bg)' }, low: { label: '常规', color: 'var(--success)', bg: 'var(--success-bg)' } };
const S = { '待派工': { color: 'var(--warning)', bg: 'var(--warning-bg)' }, '处理中': { color: 'var(--info)', bg: 'var(--info-bg)' }, '已完成': { color: 'var(--success)', bg: 'var(--success-bg)' } };

const STAFF = ['张工', '李工', '王工', '刘工', '陈工'];

export default function AftersalesPage() {
  const { data: raw } = useSWR('/api/v2/bim?status=iot_delivered', apiFetch);
  const delivered: any[] = raw ? (Array.isArray(raw) ? raw : raw.items ?? []) : [];
  const warranties = delivered.length
    ? delivered.map((p: any) => ({
        id: p.id,
        customer: p.customerName || p.quotationNo || p.id.slice(0, 8),
        city: p.city || '—',
        system: (p.systemFamilies || []).join('、') || '—',
        model: (p.bom as any[])?.[0]?.name || '主机',
        warrantyYears: 2,
        nextServiceAt: p.acceptedAt
          ? new Date(new Date(p.acceptedAt).getTime() + 180 * 86400000).toISOString().slice(0, 10)
          : new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      }))
    : WARRANTIES;

  const s = afterSalesSummary();
  const [tickets, setTickets] = useState<ServiceTicket[]>(TICKETS);

  // 尝试从售后系统 API 加载，无配置时静默回退到 mock
  useEffect(() => {
    aftersales.listTickets().then((data: any) => {
      if (data?.items?.length) setTickets(data.items);
    }).catch(() => {});
  }, []);

  const dispatch = async (id: string, assignedTo: string) => {
    setTickets(ts => ts.map(t => t.id === id ? { ...t, assignedTo, status: '处理中' as any } : t));
    aftersales.dispatch(id, assignedTo).catch(() => {});
  };
  const complete = async (id: string) => {
    setTickets(ts => ts.map(t => t.id === id ? { ...t, status: '已完成' as any } : t));
    aftersales.updateStatus(id, '已完成').catch(() => {});
  };

  const open = tickets.filter(t => t.status !== '已完成');
  const done = tickets.filter(t => t.status === '已完成');

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <PageHeader title="售后服务" subtitle="工单管理与设备保修台账" />

        {/* KPI */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: '待处理工单', value: String(s.open), danger: s.open > 3 },
            { label: '紧急工单',   value: String(s.urgent), danger: s.urgent > 0 },
            { label: '近30天到期保养', value: String(s.dueService), danger: false },
            { label: '设备在保',  value: String(warranties.length), danger: false },
          ].map(k => (
            <div key={k.label} className="card-elevated" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.danger ? 'var(--danger)' : 'var(--t-strong)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div className="g2" style={{ gap: 16 }}>
          {/* 服务工单 */}
          <div className="card-elevated" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>服务工单</div>
            {[...open, ...done].map(t => (
              <TicketRow key={t.id} t={t} onDispatch={dispatch} onComplete={complete} />
            ))}
          </div>

          {/* 保修台账 */}
          <div className="card-elevated" style={{ padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>设备保修台账</div>
            {warranties.map((w: any) => {
              const daysLeft = Math.round((new Date(w.nextServiceAt).getTime() - Date.now()) / 86400000);
              return (
                <div key={w.id} style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{w.customer}</span>
                    <span style={{ fontSize: 11, color: 'var(--t-secondary)' }}>{w.warrantyYears}年保修</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t-secondary)', marginBottom: 3 }}>{w.city} · {w.system} · {w.model}</div>
                  <div style={{ fontSize: 11, color: daysLeft < 30 ? 'var(--warning)' : 'var(--t-tertiary)' }}>
                    {daysLeft < 30 ? `⚠️ 保养到期：${w.nextServiceAt.slice(5)}` : `下次保养：${w.nextServiceAt.slice(5)}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketRow({ t, onDispatch, onComplete }: {
  t: ServiceTicket;
  onDispatch: (id: string, staff: string) => void;
  onComplete: (id: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const p = P[t.priority]; const sc = S[t.status];
  return (
    <div style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{t.customer}
          <span style={{ fontSize: 11, color: 'var(--t-secondary)', fontWeight: 400, marginLeft: 6 }}>{t.city}</span>
        </span>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{ fontSize: 10, background: p.bg, color: p.color, padding: '1px 6px', borderRadius: 999 }}>{p.label}</span>
          <span style={{ fontSize: 10, background: sc.bg, color: sc.color, padding: '1px 6px', borderRadius: 999 }}>{t.status}</span>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--t-strong)', marginBottom: 4 }}>{t.type} · {t.issue}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--t-tertiary)', flex: 1 }}>
          {t.assignedTo ? `👷 ${t.assignedTo}` : '未派工'} · {t.createdAt.slice(5)}
        </span>
        {t.status === '待派工' && !picking && (
          <button onClick={() => setPicking(true)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-2)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--t-primary)' }}>
            派工
          </button>
        )}
        {t.status === '待派工' && picking && (
          <select autoFocus onChange={e => { onDispatch(t.id, e.target.value); setPicking(false); }}
            style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-2)', background: 'var(--surface-1)', cursor: 'pointer' }}>
            <option value="">选派工人</option>
            {STAFF.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {t.status === '处理中' && (
          <button onClick={() => onComplete(t.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: 'none', background: 'var(--success)', color: '#fff', cursor: 'pointer' }}>
            完成
          </button>
        )}
      </div>
    </div>
  );
}
