'use client';
import { type Analytics, WON_STAGES, STAGE_MAP } from '../lib/crm-data';

const fmt = (v: number) => `${(v / 10000).toFixed(0)}万`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export default function CrmAnalytics({ a, target }: { a: Analytics; target?: number }) {
  const mt = target ?? a.monthlyTarget;
  const prog = Math.min(1, a.signedGmv / mt);
  const maxCount = Math.max(1, ...a.funnel.map(f => f.count));

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>

      {/* KPI 卡片 */}
      {[
        { label: '已签约 GMV',    value: fmt(a.signedGmv),             sub: `目标 ${fmt(mt)}`, color: '#16a34a' },
        { label: '加权预测',       value: fmt(a.weightedForecast),      sub: '全漏斗加权',       color: '#2563eb' },
        { label: '签约转化率',    value: pct(a.conversionRate),        sub: '首次跟进→签约',    color: '#7c3aed' },
        { label: '逾期跟进',      value: String(a.overdueCount),       sub: '需立即处理',       color: a.overdueCount > 0 ? '#dc2626' : '#16a34a' },
      ].map(k => (
        <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '14px 18px',
          borderLeft: `4px solid ${k.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: 140 }}>
          <div style={{ fontSize: 11, color: '#697386', marginBottom: 4 }}>{k.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{k.sub}</div>
        </div>
      ))}

      {/* 月度目标进度 */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: 220, flex: '1 1 220px' }}>
        <div style={{ fontSize: 11, color: '#697386', marginBottom: 6 }}>月度目标完成</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: '#1a1f36' }}>{pct(prog)}</span>
          <span style={{ fontSize: 12, color: '#697386' }}>{fmt(a.signedGmv)} / {fmt(mt)}</span>
        </div>
        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${prog * 100}%`, borderRadius: 4,
            background: prog >= 1 ? '#16a34a' : prog >= 0.7 ? '#f59e0b' : 'var(--danger)',
            transition: 'width .4s' }} />
        </div>
      </div>

      {/* 漏斗阶段计数 */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', flex: '2 1 320px' }}>
        <div style={{ fontSize: 11, color: '#697386', marginBottom: 8 }}>各阶段分布</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 50 }}>
          {a.funnel.map(f => (
            <div key={f.stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: f.color }}>{f.count || '—'}</span>
              <div style={{ width: '100%', background: f.color, borderRadius: '3px 3px 0 0', opacity: f.count ? 1 : 0.15,
                height: `${Math.max(4, (f.count / maxCount) * 36)}px`, transition: 'height .3s' }} />
              <span style={{ fontSize: 9, color: '#9ca3af', whiteSpace: 'nowrap',
                transform: 'rotate(-30deg)', transformOrigin: 'top left', marginTop: 4 }}>
                {STAGE_MAP[f.stage].label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 产品结构 */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '14px 18px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minWidth: 180 }}>
        <div style={{ fontSize: 11, color: '#697386', marginBottom: 8 }}>产品组合结构</div>
        {a.productMix.slice(0, 4).map((p, i) => (
          <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
            <span style={{ color: ['#E4002B','#2563eb','#16a34a','#d97706'][i] }}>● {p.label}</span>
            <span style={{ fontWeight: 600 }}>{p.count}单</span>
          </div>
        ))}
      </div>

    </div>
  );
}
