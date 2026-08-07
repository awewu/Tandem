'use client';

import useSWR from 'swr';
import { Filter, Gauge, Route, Search, TrendingUp, ShieldCheck, Users } from 'lucide-react';
import { PageHeader, AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { cockpit } from '../../lib/api';

type ChannelSlice = { channel: string; label: string; count: number };
type NorthStar = {
  period: string; highIntentLeads: number; geoReach: number;
  geoAttributedLeads: number; geoAttributionRate: number | null;
  geoAttributedChannels: string[]; channelBreakdown: ChannelSlice[]; attributedLeads: number;
  activeProfitableDealers: number; networkGmv: number; dealers: number;
};
type DealerRow = { dealerId: string; active: boolean; gmv: number; profit: number; profitSource: string; closeRate: number; deals: number };
type BrandHealth = { period: string; aiVisibility: number; citedRate: number; sov: number; positiveSentiment: number; probes: number; note?: string };
type FunnelStage = { stage: string; label: string; count: number };
type AarrrFunnel = { period: string; stages: FunnelStage[] };
type GeoLoop = { probes: number; cited: number; gaps: number; citedRate: number; content: { drafts: number; approved: number; published: number; total: number } };
type LeadRouting = { total: number; routed: number; unrouted: number; routingRate: number; unroutedSamples: { province: string | null; city: string | null; category: string | null; reason: string }[] };

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

const yuan = (n: number) => `¥${(n || 0).toLocaleString('zh-CN')}`;

export default function CockpitPage() {
  const ns = useSWR<NorthStar>('cockpit:north-star', () => cockpit.northStar());
  const ds = useSWR<DealerRow[]>('cockpit:dealer-success', () => cockpit.dealerSuccess());
  const bh = useSWR<BrandHealth>('cockpit:brand-health', () => cockpit.brandHealth());
  const fn = useSWR<AarrrFunnel>('cockpit:aarrr', () => cockpit.aarrrFunnel());
  const gl = useSWR<GeoLoop>('cockpit:geo-loop', () => cockpit.geoLoop());
  const lr = useSWR<LeadRouting>('cockpit:lead-routing', () => cockpit.leadRouting());
  const gmvTrend = useSWR<{ metricKey: string; series: { date: string; value: number }[] }>('cockpit:trend:gmv', () => cockpit.trends('network_gmv', 30));

  return (
    <>
      <PageHeader title="GTM AI驾驶舱" subtitle="北极星（当期）= GEO→高意向线索数 · 副指标 = 活跃盈利经销商/网络 GMV · 品牌健康度为 A 引擎领先指标" />

      {/* 北极星 KPI */}
      <AsyncBoundary
        status={statusOf(ns.isLoading, ns.error, false)}
        errorMessage="北极星加载失败" onRetry={() => ns.mutate()}
      >
        {/* 主指标：GEO→高意向线索数（宪章锁定的当期北极星，真实按渠道归因） */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
          <Kpi icon={<Search size={16} />} label="⭐ GEO 高意向线索 · 北极星" value={String(ns.data?.geoAttributedLeads ?? 0)}
               hint={ns.data?.geoAttributionRate == null
                 ? `周期 ${ns.data?.period ?? '-'} · GEO 渠道线索计数`
                 : `占高意向线索 ${ns.data.geoAttributionRate}% · GEO 渠道：${(ns.data?.geoAttributedChannels ?? []).join('/')}`} />
          <Kpi icon={<Users size={16} />} label="高意向线索总数" value={String(ns.data?.highIntentLeads ?? 0)}
               hint={`已归因 ${ns.data?.attributedLeads ?? 0} · 漏斗 lead 真实计数`} />
          <Kpi icon={<Route size={16} />} label="GEO 触达数 · 领先" value={String(ns.data?.geoReach ?? 0)} hint="AI 回答被引触达（漏斗 reach）" />
        </div>
        {/* 高意向线索获客渠道拆分（口径透明：GEO 集 = geo/ai-diagnosis） */}
        {(ns.data?.channelBreakdown?.length ?? 0) > 0 && (
          <div className="card" style={{ padding: '12px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span className="t-xs" style={{ color: 'var(--t-secondary, #6B7280)', whiteSpace: 'nowrap' }}>线索获客渠道</span>
            {ns.data!.channelBreakdown.map((c) => {
              const isGeo = (ns.data?.geoAttributedChannels ?? []).includes(c.channel);
              return (
                <span key={c.channel} className="t-xs" style={{
                  padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
                  background: isGeo ? 'rgba(228,0,43,0.08)' : 'var(--surface-2, #F3F4F6)',
                  color: isGeo ? '#E4002B' : 'var(--t-secondary, #6B7280)',
                  fontWeight: isGeo ? 700 : 500,
                }}>{c.label} {c.count}{isGeo ? ' · GEO' : ''}</span>
              );
            })}
          </div>
        )}
        {/* 副指标：经销商侧 + 领先指标 */}
        <div className="g3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          <Kpi icon={<Users size={16} />} label="活跃盈利经销商 · 副" value={String(ns.data?.activeProfitableDealers ?? 0)} hint={`共 ${ns.data?.dealers ?? 0} 家在册`} />
          <Kpi icon={<TrendingUp size={16} />} label="网络月度 GMV · 副" value={yuan(ns.data?.networkGmv ?? 0)} hint={`周期 ${ns.data?.period ?? '-'}`} />
          <Kpi icon={<Gauge size={16} />} label="AI 被引率 · 领先指标" value={`${bh.data?.citedRate ?? 0}%`} hint={`SoV ${bh.data?.sov ?? 0}% · 正声量 ${bh.data?.positiveSentiment ?? 0}% · ${bh.data?.probes ?? 0} 探测`} />
        </div>
      </AsyncBoundary>

      {/* 北极星趋势（日快照） */}
      {(gmvTrend.data?.series?.length ?? 0) > 1 && (
        <div className="card" style={{ padding: '12px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="t-xs" style={{ color: 'var(--t-secondary, #6B7280)', whiteSpace: 'nowrap' }}>网络 GMV · 近 {gmvTrend.data!.series.length} 日</span>
          <Sparkline points={gmvTrend.data!.series.map((s) => s.value)} />
          <span className="t-num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{yuan(gmvTrend.data!.series[gmvTrend.data!.series.length - 1]?.value ?? 0)}</span>
        </div>
      )}

      {/* AARRR 增长漏斗 */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Filter size={16} />
          <span className="t-lg" style={{ fontWeight: 600 }}>AARRR 增长漏斗</span>
          <span className="t-xs" style={{ opacity: 0.6, marginLeft: 'auto' }}>周期 {fn.data?.period ?? '-'}</span>
        </div>
        <AsyncBoundary
          status={statusOf(fn.isLoading, fn.error, (fn.data?.stages?.reduce((s, x) => s + x.count, 0) ?? 0) === 0)}
          errorMessage="漏斗数据加载失败" onRetry={() => fn.mutate()}
          emptyTitle="暂无漏斗数据"
          emptyDescription="线索(lead.created)/方案(opportunity.signed)/签约(crm.deal.signed)/转介绍事件将自动归集。"
        >
          <FunnelBars stages={fn.data?.stages ?? []} />
        </AsyncBoundary>
      </div>

      {/* GEO 内容闭环（A 造需求） */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Search size={16} />
          <span className="t-lg" style={{ fontWeight: 600 }}>GEO 内容闭环</span>
          <span className="t-xs" style={{ opacity: 0.6, marginLeft: 'auto' }}>缺口 → 生成 → 审核 → 发布 → 复测</span>
        </div>
        <AsyncBoundary
          status={statusOf(gl.isLoading, gl.error, false)}
          errorMessage="GEO 闭环数据加载失败" onRetry={() => gl.mutate()}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <LoopStat label="被引率" value={`${gl.data?.citedRate ?? 0}%`} hint={`${gl.data?.cited ?? 0}/${gl.data?.probes ?? 0} 探测`} />
            <LoopStat label="可见度缺口" value={String(gl.data?.gaps ?? 0)} hint="未被引问题" accent />
            <LoopStat label="内容草稿" value={String(gl.data?.content?.drafts ?? 0)} hint="待审核" />
            <LoopStat label="已审核" value={String(gl.data?.content?.approved ?? 0)} hint="待发布" />
            <LoopStat label="已发布" value={String(gl.data?.content?.published ?? 0)} hint="喂 AI 复测" />
          </div>
        </AsyncBoundary>
      </div>

      {/* 线索分配（B 转化 · 派单引擎） */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Route size={16} />
          <span className="t-lg" style={{ fontWeight: 600 }}>线索分配</span>
          <span className="t-xs" style={{ opacity: 0.6, marginLeft: 'auto' }}>地域 + 品类 + 合同等级 − 负载 打分派单</span>
        </div>
        <AsyncBoundary
          status={statusOf(lr.isLoading, lr.error, false)}
          errorMessage="线索分配数据加载失败" onRetry={() => lr.mutate()}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: (lr.data?.unroutedSamples?.length ?? 0) ? 14 : 0 }}>
            <LoopStat label="分配成功率" value={`${lr.data?.routingRate ?? 0}%`} hint={`${lr.data?.routed ?? 0}/${lr.data?.total ?? 0} 已派`} />
            <LoopStat label="已分配" value={String(lr.data?.routed ?? 0)} hint="命中经销商" />
            <LoopStat label="未能分配" value={String(lr.data?.unrouted ?? 0)} hint="无经销商可服务" accent />
          </div>
          {(lr.data?.unroutedSamples?.length ?? 0) > 0 && (
            <div>
              <div className="t-xs" style={{ color: 'var(--t-secondary, #6B7280)', marginBottom: 6 }}>未覆盖地域/品类（拓商信号）</div>
              {(lr.data?.unroutedSamples ?? []).map((s, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--t-secondary, #6B7280)', padding: '4px 0', borderBottom: '1px solid var(--border, #E5E7EB)' }}>
                  {[s.province, s.city, s.category].filter(Boolean).join(' · ') || '—'}　<span style={{ opacity: 0.7 }}>{s.reason}</span>
                </div>
              ))}
            </div>
          )}
        </AsyncBoundary>
      </div>

      {/* 经销商成功度明细 */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldCheck size={16} />
          <span className="t-lg" style={{ fontWeight: 600 }}>经销商成功度</span>
        </div>
        <AsyncBoundary
          status={statusOf(ds.isLoading, ds.error, (ds.data?.length ?? 0) === 0)}
          errorMessage="经销商数据加载失败" onRetry={() => ds.mutate()}
          emptyTitle="暂无经销商成交数据"
          emptyDescription="成交(crm.deal.signed)后自动归集；也可在测试环境触发重算。"
        >
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr><th>经销商</th><th>状态</th><th>GMV</th><th>利润(口径)</th><th>成交率</th><th>单数</th></tr>
            </thead>
            <tbody>
              {(ds.data ?? []).map((r) => (
                <tr key={r.dealerId}>
                  <td>{r.dealerId}</td>
                  <td><span className={`badge ${r.active ? 'badge-green' : 'badge-grey'}`}>{r.active ? '活跃' : '沉默'}</span></td>
                  <td className="t-num">{yuan(r.gmv)}</td>
                  <td className="t-num">{yuan(r.profit)} <span className="t-xs" style={{ opacity: 0.6 }}>{r.profitSource === 'actual' ? '实核' : '估算'}</span></td>
                  <td className="t-num">{(r.closeRate * 100).toFixed(1)}%</td>
                  <td className="t-num">{r.deals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AsyncBoundary>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="inset" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--t-secondary, #6B7280)', fontSize: 13 }}>
        {icon}<span>{label}</span>
      </div>
      <div className="t-num" style={{ fontSize: 28, fontWeight: 800, marginTop: 8, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--t-secondary, #6B7280)', marginTop: 4 }}>{hint}</div>
    </div>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const w = 240, h = 32, pad = 2;
  const max = Math.max(...points, 1), min = Math.min(...points, 0);
  const span = max - min || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const path = points
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1)}`)
    .join(' ');
  return (
    <svg width={w} height={h} style={{ flex: 1, overflow: 'visible' }} aria-hidden>
      <polyline points={path} fill="none" stroke="var(--brand, #C8102E)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LoopStat({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 8, background: 'var(--surface-2, #F3F4F6)', border: '1px solid var(--border, #E5E7EB)' }}>
      <div style={{ fontSize: 12, color: 'var(--t-secondary, #6B7280)' }}>{label}</div>
      <div className="t-num" style={{ fontSize: 22, fontWeight: 800, marginTop: 4, color: accent ? 'var(--brand, #C8102E)' : 'inherit' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--t-tertiary, #9CA3AF)', marginTop: 2 }}>{hint}</div>
    </div>
  );
}

function FunnelBars({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv = prev && prev > 0 ? `${Math.round((s.count / prev) * 100)}%` : null;
        return (
          <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 56, flexShrink: 0, fontSize: 13, color: 'var(--t-secondary, #6B7280)' }}>{s.label}</span>
            <div style={{ flex: 1, height: 22, borderRadius: 4, background: 'var(--surface-2, #F3F4F6)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((s.count / max) * 100)}%`, minWidth: s.count > 0 ? 2 : 0, height: '100%', background: 'var(--brand, #C8102E)', borderRadius: 4, transition: 'width .3s' }} />
            </div>
            <span className="t-num" style={{ width: 48, textAlign: 'right', fontWeight: 600 }}>{s.count}</span>
            <span className="t-xs" style={{ width: 52, textAlign: 'right', color: 'var(--t-tertiary, #9CA3AF)' }}>{conv ?? '—'}</span>
          </div>
        );
      })}
    </div>
  );
}
