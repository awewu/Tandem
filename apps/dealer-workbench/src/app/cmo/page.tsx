'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Gauge, ShieldCheck, Filter, Store, Network, Search, Boxes, Swords, Coins, Target, AlertTriangle } from 'lucide-react';
import { PageHeader, AsyncBoundary, type AsyncStatus } from '@rhautt/ui';
import { cockpit } from '../../lib/api';

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

export default function CmoCockpitPage() {
  const [bu, setBu] = useState<{ buType?: string; buId?: string }>({});
  const scopes = readScopes();
  const buScopes = useMemo(() => scopes.filter((s) => s.scopeType === 'business_unit'), [scopes]);
  const key = `cmo:${bu.buType || 'group'}:${bu.buId || ''}`;
  const { data, error, isLoading, mutate } = useSWR<CmoDashboard>(key, () => cockpit.cmo(bu));

  return (
    <>
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
                ) : (
                  <pre className="t-num" style={{ color: 'var(--t-secondary)', fontSize: 11, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 168, overflow: 'auto', flex: 1 }}>
                    {panel?.data ? JSON.stringify(panel.data, null, 2).slice(0, 900) : '（暂无数据）'}
                  </pre>
                )}
                {panel?.source && <div className="t-xs" style={{ marginTop: 8, color: 'var(--t-tertiary)', opacity: 0.7 }}>源：{panel.source}</div>}
              </div>
            );
          })}
        </div>
      </AsyncBoundary>
    </>
  );
}
