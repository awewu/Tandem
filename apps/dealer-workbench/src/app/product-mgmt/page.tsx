'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Rocket, BadgeDollarSign } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { productMgmt } from '../../lib/api';
import { useListView, exportCsv } from '../../lib/useListView';
import ListToolbar from '../../components/ListToolbar';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
}

export default function ProductMgmtPage() {
  const { toast } = useToast();
  const launches = useSWR('pm:launches', () => productMgmt.listLaunches());
  const pricing = useSWR('pm:pricing', () => productMgmt.listPricing());
  const [launchName, setLaunchName] = useState('');
  const [pp, setPp] = useState({ sku: '', policyType: 'list', proposedPrice: '', costPrice: '' });

  async function createLaunch() { if (!launchName) { toast('请填写上市计划名称', 'error'); return; } try { await productMgmt.createLaunch({ name: launchName }); setLaunchName(''); toast('上市计划已创建', 'success'); launches.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }
  async function submitPricing() {
    try {
      const r = await productMgmt.submitPricing({ sku: pp.sku, policyType: pp.policyType, proposedPrice: Number(pp.proposedPrice), costPrice: Number(pp.costPrice) });
      toast(r.warning ? r.warning : '定价政策已提报（毛利闸通过）', r.warning ? 'info' : 'success'); pricing.mutate();
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function decide(id: string, decision: 'approved' | 'rejected') { try { await productMgmt.decidePricing(id, decision); toast(`政策已${decision === 'approved' ? '批准' : '驳回'}`, 'success'); pricing.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }

  const lRows: any[] = launches.data?.launches || [];
  const pRows: any[] = pricing.data?.policies || [];
  const pv = useListView(pRows, {
    pageSize: 15,
    searchFields: ['sku', 'policyType'],
    filters: [
      { key: 'status', label: '状态', options: [['submitted', '待审'], ['approved', '已批'], ['rejected', '已驳']].map(([value, label]) => ({ value, label })) },
      { key: 'policyType', label: '类型', options: [['list', '目录价'], ['promo', '促销价'], ['rebate', '返利']].map(([value, label]) => ({ value, label })) },
    ],
  });

  return (
    <div className="page-container">
      <PageHeader title="产品管理" subtitle="生命周期 · 新品上市 NPI · 卖点体系 · 定价审批（毛利闸·基座3）" />

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Rocket size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>新品上市计划 (NPI)</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="input" value={launchName} onChange={(e) => setLaunchName(e.target.value)} placeholder="上市计划名称" style={{ flex: 1 }} />
          <button className="btn btn-brand" onClick={createLaunch}>创建</button>
        </div>
        <AsyncBoundary status={statusOf(launches.isLoading, launches.error, lRows.length === 0)} errorMessage="上市计划加载失败（需 API + 数据库）" onRetry={() => launches.mutate()} emptyTitle="暂无上市计划" emptyDescription="创建 NPI 上市计划，管理卖点/物料/渠道/节奏清单。">
          <div style={{ display: 'grid', gap: 4 }}>
            {lRows.map((l) => <div key={l.id} className="t-sm" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)' }}><span style={{ color: 'var(--t-strong)' }}>{l.name}</span><span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{l.status}</span></div>)}
          </div>
        </AsyncBoundary>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><BadgeDollarSign size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>定价审批 · 毛利闸</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="input" value={pp.sku} onChange={(e) => setPp({ ...pp, sku: e.target.value })} placeholder="SKU" style={{ width: 130 }} />
          <select className="input" value={pp.policyType} onChange={(e) => setPp({ ...pp, policyType: e.target.value })}><option value="list">目录价</option><option value="promo">促销价</option><option value="rebate">返利</option></select>
          <input className="input" value={pp.proposedPrice} onChange={(e) => setPp({ ...pp, proposedPrice: e.target.value })} placeholder="拟定价" type="number" style={{ width: 110 }} />
          <input className="input" value={pp.costPrice} onChange={(e) => setPp({ ...pp, costPrice: e.target.value })} placeholder="成本" type="number" style={{ width: 110 }} />
          <button className="btn btn-brand" onClick={submitPricing}>提报</button>
        </div>
        <AsyncBoundary status={statusOf(pricing.isLoading, pricing.error, pRows.length === 0)} errorMessage="定价政策加载失败（需 API + 数据库）" onRetry={() => pricing.mutate()} emptyTitle="暂无定价政策" emptyDescription="提报定价将自动过毛利闸（低于阈值阻断批准）。">
          <ListToolbar q={pv.q} onSearch={pv.onSearch} searchPlaceholder="搜 SKU/类型" filters={[
            { key: 'status', label: '状态', options: [['submitted', '待审'], ['approved', '已批'], ['rejected', '已驳']].map(([value, label]) => ({ value, label })) },
            { key: 'policyType', label: '类型', options: [['list', '目录价'], ['promo', '促销价'], ['rebate', '返利']].map(([value, label]) => ({ value, label })) },
          ]} filterVals={pv.filterVals} onFilter={pv.setFilter} total={pv.total} page={pv.page} pageCount={pv.pageCount} onPage={pv.setPage}
            onExport={() => exportCsv(pv.filtered, [{ key: 'sku', label: 'SKU' }, { key: 'policyType', label: '类型' }, { key: 'proposedPrice', label: '拟定价' }, { key: 'status', label: '状态' }], 'pricing-policies')} />
          <div style={{ display: 'grid', gap: 4 }}>
            {pv.pageRows.map((p) => {
              const gate = (p.marginCalc || {}).gatePassed;
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <span className="t-sm">{p.sku || '-'} · {p.policyType} · ¥{p.proposedPrice} · 毛利 {((p.marginCalc?.marginRate || 0) * 100).toFixed(0)}% {gate ? '✅' : '⛔'}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{p.status}</span>
                    {p.status === 'submitted' && <>
                      <button className="btn btn-outline btn-sm" disabled={!gate} title={gate ? '' : '毛利闸未过'} onClick={() => decide(p.id, 'approved')}>批准</button>
                      <button className="btn btn-outline btn-sm" onClick={() => decide(p.id, 'rejected')}>驳回</button>
                    </>}
                  </span>
                </div>
              );
            })}
          </div>
        </AsyncBoundary>
      </div>
    </div>
  );
}
