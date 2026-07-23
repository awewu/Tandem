'use client';
import useSWR from 'swr';
import { apiFetch } from '../../lib/api';
import { REPS, teamSummary } from '../../lib/team-data';
import { PageHeader } from '@rhautt/ui';

const fmt = (v: number) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString()}`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const RANK_COLOR = ['var(--brand)', 'var(--warning)', 'var(--cyan)'];

export default function TeamPage() {
  const { data: pipeline } = useSWR('/api/v2/crm/pipeline', apiFetch);
  const items: any[] = pipeline?.items ?? [];

  // Group pipeline by owner → derive leaderboard
  const liveReps = items.length
    ? Object.values(items.reduce((acc: any, o: any) => {
        const k = o.ownerUserId || o.customerId || 'unknown';
        if (!acc[k]) acc[k] = {
          id: k, name: o.customer?.name?.slice(0, 3) + '顾问' || `顾问${k.slice(0,4)}`,
          avatar: '👤', role: '销售顾问',
          monthlySigned: 0, deals: 0, monthlyTarget: 500000,
          commissionRate: 0.03, certLevel: 1, followTasks: 0,
        };
        if (o.stage === 'signed') {
          acc[k].monthlySigned += Number(o.estimatedValue) || 0;
          acc[k].deals++;
        }
        if (!['signed', 'lost'].includes(o.stage)) acc[k].followTasks++;
        return acc;
      }, {})).filter((r: any) => r.deals > 0 || r.followTasks > 0)
    : null;

  const reps: any[] = liveReps?.length ? liveReps : REPS;
  const ranked = [...reps].sort((a: any, b: any) => b.monthlySigned - a.monthlySigned);

  const totalSigned = ranked.reduce((s: number, r: any) => s + r.monthlySigned, 0);
  const totalDeals  = ranked.reduce((s: number, r: any) => s + r.deals, 0);
  const s = liveReps?.length
    ? { totalSigned, totalTarget: totalSigned * 1.2, completion: 0.85, totalDeals, totalCommission: totalSigned * 0.03, headcount: ranked.length }
    : teamSummary();

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <PageHeader title="团队业绩管理" subtitle="销售团队本月签约与排行概览" />

        {/* KPI */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {[
            { label: '团队签约', value: fmt(s.totalSigned), sub: `目标 ${fmt(s.totalTarget)}`, semantic: null },
            { label: '目标完成', value: pct(s.completion), sub: '本月累计', semantic: s.completion >= 1 ? 'var(--success)' : 'var(--warning)' },
            { label: '成交单数', value: String(s.totalDeals), sub: '本月', semantic: null },
            { label: '应发提成', value: fmt(s.totalCommission), sub: '按签约计', semantic: null },
            { label: '团队人数', value: String(s.headcount), sub: '销售顾问', semantic: null },
          ].map(k => (
            <div key={k.label} className="card-elevated" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: k.semantic ?? 'var(--t-strong)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* 排行榜 */}
        <div className="card-elevated" style={{ padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, color: 'var(--t-strong)' }}>销售顾问排行榜 · 本月</div>
          {ranked.map((r, i) => {
            const prog = Math.min(1, r.monthlySigned / r.monthlyTarget);
            const commission = r.monthlySigned * r.commissionRate;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < ranked.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {/* 排名 */}
                <div style={{ width: 28, textAlign: 'center', fontWeight: 700, fontSize: 16, color: i < 3 ? RANK_COLOR[i] : 'var(--t-tertiary)' }}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </div>
                {/* 头像 */}
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--t-strong)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
                  {r.avatar}
                </div>
                {/* 姓名 + 角色 */}
                <div style={{ width: 110, flexShrink: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t-strong)' }}>{r.name}
                    <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--warning)' }}>{'★'.repeat(r.certLevel)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t-secondary)' }}>{r.role}</div>
                </div>
                {/* 进度条 */}
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: 'var(--brand)' }}>{fmt(r.monthlySigned)}</span>
                    <span style={{ color: 'var(--t-tertiary)' }}>{pct(prog)} / 目标 {fmt(r.monthlyTarget)}</span>
                  </div>
                  <div style={{ height: 7, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${prog * 100}%`, background: prog >= 1 ? '#16a34a' : 'var(--warning)', borderRadius: 4 }} />
                  </div>
                </div>
                {/* 指标 */}
                <div style={{ width: 70, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t-strong)' }}>{r.deals}</div>
                  <div style={{ fontSize: 10, color: 'var(--t-tertiary)' }}>成交单</div>
                </div>
                <div style={{ width: 80, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--purple)' }}>{fmt(commission)}</div>
                  <div style={{ fontSize: 10, color: 'var(--t-tertiary)' }}>提成 {pct(r.commissionRate)}</div>
                </div>
                <div style={{ width: 70, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: r.followTasks > 5 ? 'var(--danger)' : 'var(--success)' }}>{r.followTasks}</div>
                  <div style={{ fontSize: 10, color: 'var(--t-tertiary)' }}>待跟进</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
