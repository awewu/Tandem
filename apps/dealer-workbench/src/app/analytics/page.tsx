'use client';
import { useEffect, useState } from 'react';
import { GMV_TREND, FUNNEL, CHANNELS, CITIES, PRODUCT_MIX, SEASON, analyticsSummary, loadLiveAnalytics, type MonthPoint, type FunnelStep } from '../../lib/analytics-data';
import { PageHeader } from '@rhautt/ui';

const fmt = (v: number) => `${(v / 10000).toFixed(0)}万`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function Card({ title, children, span }: { title: string; children: React.ReactNode; span?: number }) {
  return (
    <div className="card-elevated" style={{ padding: 18, gridColumn: span ? `span ${span}` : undefined }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-strong)', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}

function Bars({ data, color }: { data: Slice[]; color?: boolean }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div>
      {data.map(d => (
        <div key={d.label} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ color: 'var(--t-strong)' }}>{d.label}</span>
            <span style={{ color: 'var(--t-secondary)', fontWeight: 600 }}>{d.value}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.value / max) * 100}%`, background: color ? d.color : 'var(--brand)', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

type Slice = { label: string; value: number; color: string };

export default function AnalyticsPage() {
  const [gmvTrend, setGmvTrend] = useState<MonthPoint[]>(GMV_TREND);
  const [funnel,   setFunnel]   = useState<FunnelStep[]>(FUNNEL);
  const [cities,   setCities]   = useState<Slice[]>(CITIES);
  const [s,        setS]        = useState(analyticsSummary());

  useEffect(() => {
    loadLiveAnalytics().then(live => {
      if (!live) return;
      setGmvTrend(live.gmvTrend);
      setFunnel(live.funnel);
      setCities(live.cities);
      setS(live.summary);
    });
  }, []);

  const maxGmv    = Math.max(...gmvTrend.map(m => Math.max(m.gmv, m.target)));
  const maxSeason = Math.max(...SEASON.map(m => m.demand));

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}><div className="page-container">
      <PageHeader title="经营分析" subtitle="业务数据总览与趋势分析" />

      {/* KPI 行 */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          { label: '年度 GMV', value: fmt(s.ytdGmv), sub: `目标 ${fmt(s.ytdTarget)}` },
          { label: '目标完成率', value: pct(s.completion), sub: '累计达成' },
          { label: '成交订单', value: String(s.ytdOrders), sub: '年度累计' },
          { label: '客单价', value: fmt(s.avgOrder), sub: '平均合同额' },
          { label: '问诊→签约', value: pct(s.signRate), sub: '全链路转化' },
        ].map(k => (
          <div key={k.label} className="card-elevated" style={{ padding: '16px 20px', minWidth: 130 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--t-strong)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
            <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="g3" style={{ gap: 16 }}>
        {/* GMV 趋势 */}
        <Card title="月度 GMV 趋势（实际 vs 目标）" span={2}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
            {gmvTrend.map(m => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--t-secondary)', marginBottom: 4 }}>{fmt(m.gmv)}</div>
                <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: 110, justifyContent: 'center' }}>
                  <div style={{ width: 14, background: m.gmv >= m.target ? 'var(--success)' : 'var(--brand)', borderRadius: '3px 3px 0 0', height: `${(m.gmv / maxGmv) * 100}%` }} />
                  <div style={{ width: 14, background: '#d1d5db', borderRadius: '3px 3px 0 0', height: `${(m.target / maxGmv) * 100}%` }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--t-strong)', marginTop: 6 }}>{m.month}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--t-secondary)' }}>
            <span>● 实际 GMV</span><span style={{ color: 'var(--t-tertiary)' }}>● 月度目标</span>
          </div>
        </Card>

        {/* 转化漏斗 */}
        <Card title="销售转化漏斗">
          {funnel.map((f, i) => (
            <div key={f.stage} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: 'var(--t-strong)' }}>{f.stage}</span>
                <span style={{ color: 'var(--t-secondary)' }}>{f.count} · {pct(f.rate)}</span>
              </div>
              <div style={{ height: 18, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${f.rate * 100}%`, background: `hsl(${110 - i * 4}, ${46 - i * 3}%, ${40 + i * 5}%)`, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </Card>

        {/* 渠道来源 */}
        <Card title="客户来源渠道"><Bars data={CHANNELS} color /></Card>
        {/* 城市分布 */}
        <Card title="城市订单分布"><Bars data={cities} color /></Card>
        {/* 产品结构 */}
        <Card title="产品组合结构"><Bars data={PRODUCT_MIX} color /></Card>

        {/* 季节需求曲线 */}
        <Card title="季节需求曲线（备货预测）" span={3}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100 }}>
            {SEASON.map(m => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '60%', background: m.demand > 85 ? 'var(--brand)' : m.demand > 65 ? 'var(--warning)' : 'var(--info)', borderRadius: '3px 3px 0 0', height: `${(m.demand / maxSeason) * 80}px` }} />
                <div style={{ fontSize: 10, color: 'var(--t-secondary)', marginTop: 4 }}>{m.month}月</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t-secondary)', marginTop: 8 }}>🔴 制冷季(6-8月) / 🟠 采暖季(11-12月) 双高峰 — 提前 1-2 月备货</div>
        </Card>
      </div>
    </div></div>
  );
}
