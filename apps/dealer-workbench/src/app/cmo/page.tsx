'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Gauge, ShieldCheck, Filter, Store, Network, Search, Boxes, Swords, Coins, Target, AlertTriangle, GitBranch, RefreshCw } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { cockpit, metrics } from '../../lib/api';

const MODEL_LABEL: Record<string, string> = { linear: '线性', position: '位置(U型)', time_decay: '时间衰减' };
const thisPeriod = () => new Date().toISOString().slice(0, 7);

type Scope = { role: string; scopeType: string; scopeDimension: string | null; scopeRef: string | null };
type Panel = { source?: string; data?: unknown; status?: string; note?: string };
type CmoDashboard = { bu: { type: string; id: string | null }; panels: Record<string, Panel>; honesty: string };

const PANELS: Array<{ key: string; label: string; icon: React.ReactNode }> = [
  { key: 'northStar', label: '北极星 · GEO 高意向线索', icon: <Search size={15} /> },
  { key: 'brandEquity', label: '品牌资产健康', icon: <ShieldCheck size={15} /> },
  { key: 'demandFunnel', label: '需求漏斗 (AARRR)', icon: <Filter size={15} /> },
  { key: 'channelDealer', label: '经销商成功度', icon: <Store size={15} /> },
  { key: 'channelHealth', label: '渠道网络健康', icon: <Network size={15} /> },
  { key: 'geoLoop', label: 'GEO 闭环', icon: <Search size={15} /> },
  { key: 'productPortfolio', label: '产品组合健康', icon: <Boxes size={15} /> },
  { key: 'competitive', label: '竞争态势 (按品类)', icon: <Swords size={15} /> },
  { key: 'mroi', label: '营销经济性 MROI', icon: <Coins size={15} /> },
  { key: 'teamOkr', label: '团队与 OKR', icon: <Target size={15} /> },
  { key: 'riskAlerts', label: '风险与合规告警', icon: <AlertTriangle size={15} /> },
];

function readScopes(): Scope[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('user') || '{}').scopes || []; } catch { return []; }
}
function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (empty) return 'empty';
  return 'ok';
}

const yuan = (n: unknown) => `¥${(Number(n) || 0).toLocaleString('zh-CN')}`;
const pct = (n: unknown) => `${(Number(n) || 0)}%`;

// 把各面板的数据抽成"关键指标卡"（消除原始 JSON 展示）。
function panelStats(key: string, data: any): Array<{ label: string; value: string | number; accent?: boolean }> {
  const d = data || {};
  switch (key) {
    case 'northStar': return [
      { label: '⭐ GEO 高意向线索', value: d.geoAttributedLeads ?? 0, accent: true },
      { label: '高意向线索', value: d.highIntentLeads ?? 0 },
      { label: 'GEO 触达', value: d.geoReach ?? 0 },
    ];
    case 'brandEquity': return [
      { label: 'AI 被引率', value: pct(d.citedRate) }, { label: 'SoV', value: pct(d.sov) }, { label: '正声量', value: pct(d.positiveSentiment) },
    ];
    case 'demandFunnel': return (d.stages || []).map((s: any) => ({ label: s.label || s.stage, value: s.count ?? 0 }));
    case 'channelDealer': return [{ label: '经销商', value: Array.isArray(d) ? d.length : (d.dealers ?? 0) }, { label: '活跃盈利', value: Array.isArray(d) ? d.filter((x: any) => x.active && x.profit > 0).length : 0 }];
    case 'channelHealth': return [
      { label: '经销商', value: d.partners ?? 0 }, { label: '活跃', value: d.active ?? 0 }, { label: '活跃盈利', value: d.activeProfitable ?? 0 }, { label: '网络GMV', value: yuan(d.networkGmv) },
    ];
    case 'geoLoop': return [
      { label: '被引率', value: pct(d.citedRate) }, { label: '可见度缺口', value: d.gaps ?? 0, accent: true }, { label: '已发布', value: d.content?.published ?? 0 },
    ];
    case 'productPortfolio': { const s = d.byStage || {}; return [
      { label: '引入', value: s.intro ?? 0 }, { label: '成长', value: s.growth ?? 0 }, { label: '成熟', value: s.mature ?? 0 }, { label: '退市', value: s.eol ?? 0 }, { label: '在途上市', value: d.activeLaunches ?? 0 },
    ]; }
    case 'competitive': return (d.shareOfVoice || []).slice(0, 4).map((s: any) => ({ label: s.competitor, value: `${(Number(s.share) * 100).toFixed(0)}%` }));
    case 'mroi': return [
      { label: 'MROI', value: d.mroi != null ? `${Number(d.mroi).toFixed(2)}×` : '—', accent: true }, { label: '花费', value: yuan(d.spend) }, { label: '归因收入', value: yuan(d.attributedRevenue) },
    ];
    case 'teamOkr': return (d.byLevel || []).map((b: any) => ({ label: b.level, value: `${(Number(b.avgProgress) * 100).toFixed(0)}%` }));
    case 'riskAlerts': return [
      { label: '定价毛利闸告警', value: d.pricingMarginGateFail ?? 0, accent: (d.pricingMarginGateFail ?? 0) > 0 },
      { label: '返利毛利闸告警', value: d.rebateMarginGateFail ?? 0, accent: (d.rebateMarginGateFail ?? 0) > 0 },
      { label: '内容审核积压', value: d.contentReviewBacklog ?? 0 },
    ];
    default: return [];
  }
}

export default function CmoCockpitPage() {
  const [bu, setBu] = useState<{ buType?: string; buId?: string }>({});
  const scopes = readScopes();
  const buScopes = useMemo(() => scopes.filter((s) => s.scopeType === 'business_unit'), [scopes]);
  const key = `cmo:${bu.buType || 'group'}:${bu.buId || ''}`;
  const { data, error, isLoading, mutate } = useSWR<CmoDashboard>(key, () => cockpit.cmo(bu));

  const { toast } = useToast();
  const [model, setModel] = useState('position');
  const [period] = useState(thisPeriod());
  const [refreshing, setRefreshing] = useState(false);
  const attr = useSWR(`metrics:attr:${period}:${model}`, () => metrics.attribution(period, model));
  async function refreshMetrics() {
    setRefreshing(true);
    try { await metrics.refresh(period, model); await attr.mutate(); toast('读模型已刷新（含多触点归因）', 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setRefreshing(false); }
  }
  const attrChannels: any[] = attr.data?.channels || [];

  return (
    <div className="page-container">
      <PageHeader
        title="CMO 营销管理驾驶舱"
        subtitle="经营层总舵 · 九屏聚合 · 按事业部切片 —— 一套真实度量源，不造虚荣数（基座4）"
        actions={
          <select
            className="input"
            value={bu.buType ? `${bu.buType}:${bu.buId}` : 'group'}
            onChange={(e) => {
              if (e.target.value === 'group') { setBu({}); return; }
              const [buType, buId] = e.target.value.split(':');
              setBu({ buType, buId });
            }}
          >
            <option value="group">集团（全品牌/全品类）</option>
            {buScopes.map((s) => (
              <option key={`${s.scopeDimension}:${s.scopeRef}`} value={`${s.scopeDimension}:${s.scopeRef}`}>
                事业部 · {s.scopeDimension === 'brand' ? '品牌' : '品类'} {s.scopeRef}
              </option>
            ))}
          </select>
        }
      />

      <AsyncBoundary
        status={statusOf(isLoading, error, false)}
        errorMessage="驾驶舱数据加载失败（需 API + 数据库）" onRetry={() => mutate()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Gauge size={15} style={{ color: 'var(--t-tertiary)' }} />
          <span className="t-xs" style={{ color: 'var(--t-secondary)' }}>
            当前范围：{data?.bu?.type === 'group' || !data?.bu ? '集团' : `事业部 ${data.bu.type}:${data.bu.id}`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {PANELS.map(({ key: k, label, icon }) => {
            const panel = data?.panels?.[k];
            const todo = panel?.status === 'todo';
            return (
              <div key={k} className="card" style={{ padding: 18, minHeight: 132, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {icon}
                  <span className="t-sm" style={{ fontWeight: 600, color: 'var(--t-strong)' }}>{label}</span>
                  <span className="t-xs" style={{
                    marginLeft: 'auto', padding: '1px 8px', borderRadius: 999,
                    background: todo ? 'var(--surface-2)' : 'rgba(16,185,129,0.10)',
                    color: todo ? 'var(--t-tertiary)' : 'var(--semantic-success, #10b981)', fontWeight: 600,
                  }}>{todo ? '待建' : '已接'}</span>
                </div>
                {todo ? (
                  <p className="t-xs" style={{ color: 'var(--t-tertiary)', margin: 0 }}>{panel?.note}</p>
                ) : (() => {
                  const stats = panelStats(k, panel?.data);
                  if (!stats.length) return <p className="t-xs" style={{ color: 'var(--t-tertiary)', margin: 0 }}>（暂无数据）</p>;
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, flex: 1, alignContent: 'flex-start' }}>
                      {stats.map((s, i) => (
                        <div key={i} style={{ minWidth: 72 }}>
                          <div className="t-num" style={{ fontSize: 20, fontWeight: 700, color: s.accent ? 'var(--brand)' : 'var(--t-strong)', lineHeight: 1.2 }}>{s.value}</div>
                          <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {panel?.source && <div className="t-xs" style={{ marginTop: 8, color: 'var(--t-tertiary)', opacity: 0.7 }}>源：{panel.source}</div>}
              </div>
            );
          })}
        </div>
      </AsyncBoundary>

      {/* 多触点归因（度量中台读模型：RLS 读模型 + 线性/位置/时间衰减，替代直查 OLTP） */}
      <div className="card" style={{ padding: 18, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <GitBranch size={16} style={{ color: 'var(--brand)' }} />
          <span className="t-lg" style={{ fontWeight: 700 }}>多触点归因 · {period}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['linear', 'position', 'time_decay'] as const).map((m) => (
              <button key={m} className={model === m ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setModel(m)}>{MODEL_LABEL[m]}</button>
            ))}
            <button className="btn btn-outline btn-sm" disabled={refreshing} onClick={refreshMetrics}><RefreshCw size={13} />{refreshing ? '刷新中…' : '重算读模型'}</button>
          </div>
        </div>
        <AsyncBoundary status={statusOf(attr.isLoading, attr.error, attrChannels.length === 0)} errorMessage="归因加载失败（需 API + 数据库）" onRetry={() => attr.mutate()} emptyTitle="暂无归因数据" emptyDescription="点「重算读模型」从漏斗旅程重建；有已签约旅程后显示各渠道信用份额。">
          <div style={{ display: 'grid', gap: 10 }}>
            {attrChannels.map((c) => (
              <div key={c.channel}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="t-sm">
                  <span>{c.channel} <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>· {c.touches} 触点</span></span>
                  <span className="t-num" style={{ color: 'var(--brand)' }}>{(c.share * 100).toFixed(1)}% · {c.creditedConversions.toFixed(2)} 信用</span>
                </div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 4, height: 8, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ width: `${Math.min(c.share * 100, 100)}%`, background: 'var(--brand)', height: '100%' }} />
                </div>
              </div>
            ))}
          </div>
        </AsyncBoundary>
        <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 10, opacity: 0.8 }}>源：metric_channel_attribution（RLS 读模型）· 信用按 {MODEL_LABEL[model]} 模型跨触点分配,和=转化数</div>
      </div>
    </div>
  );
}
