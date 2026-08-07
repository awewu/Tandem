'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Coins, Target } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { gtmplan } from '../../lib/api';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
}
const yuan = (n: number) => `¥${(Number(n) || 0).toLocaleString('zh-CN')}`;

export default function GtmPage() {
  const { toast } = useToast();
  const mroi = useSWR('gtm:mroi', () => gtmplan.mroi());
  const campaigns = useSWR('gtm:campaigns', () => gtmplan.listCampaigns());
  const okrs = useSWR('gtm:okrs', () => gtmplan.listOkrs());
  const okrSum = useSWR('gtm:okrsum', () => gtmplan.okrSummary());
  const [nc, setNc] = useState({ name: '', budget: '', period: '' });
  const [no, setNo] = useState({ level: 'group', objective: '', progress: '' });

  async function addCampaign() { if (!nc.name) { toast('请填写战役名称', 'error'); return; } try { await gtmplan.createCampaign({ name: nc.name, budget: Number(nc.budget) || 0, period: nc.period }); setNc({ name: '', budget: '', period: '' }); toast('战役已创建', 'success'); campaigns.mutate(); mroi.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }
  async function addOkr() { if (!no.objective) { toast('请填写目标', 'error'); return; } try { await gtmplan.upsertOkr({ level: no.level, objective: no.objective, progress: Number(no.progress) || 0 }); setNo({ level: 'group', objective: '', progress: '' }); toast('OKR 已创建', 'success'); okrs.mutate(); okrSum.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }

  const m = mroi.data;
  const cRows: any[] = campaigns.data?.campaigns || [];
  const oRows: any[] = okrs.data?.okrs || [];
  const sum = okrSum.data?.byLevel || [];

  return (
    <>
      <PageHeader title="战役 · 预算 MROI · OKR" subtitle="营销战役预算/花费/归因收入 → MROI；集团→事业部→职能 三级 OKR" />

      <AsyncBoundary status={statusOf(mroi.isLoading, mroi.error, false)} errorMessage="MROI 加载失败（需 API + 数据库）" onRetry={() => mroi.mutate()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
          {[['战役数', m?.campaigns ?? 0], ['预算', yuan(m?.budget ?? 0)], ['花费', yuan(m?.spend ?? 0)], ['归因收入', yuan(m?.attributedRevenue ?? 0)], ['MROI', m?.mroi != null ? `${m.mroi.toFixed(2)}×` : '—']].map(([k, v], i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div className="t-num" style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand)' }}>{v as any}</div>
              <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 4 }}>{k as string}</div>
            </div>
          ))}
        </div>
      </AsyncBoundary>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Coins size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>战役 / 预算</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input className="input" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="战役名称" style={{ flex: 1 }} />
          <input className="input" value={nc.budget} onChange={(e) => setNc({ ...nc, budget: e.target.value })} placeholder="预算" type="number" style={{ width: 110 }} />
          <input className="input" value={nc.period} onChange={(e) => setNc({ ...nc, period: e.target.value })} placeholder="周期" style={{ width: 110 }} />
          <button className="btn btn-brand" onClick={addCampaign}>新建</button>
        </div>
        <AsyncBoundary status={statusOf(campaigns.isLoading, campaigns.error, cRows.length === 0)} errorMessage="战役加载失败（需 API + 数据库）" onRetry={() => campaigns.mutate()} emptyTitle="暂无战役" emptyDescription="创建战役后可记录花费与归因收入，自动汇总 MROI。">
          <div style={{ display: 'grid', gap: 4 }}>
            {cRows.map((c) => <div key={c.id} className="t-sm" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid var(--border)' }}><span>{c.name} · {c.period || '-'}</span><span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>预算{yuan(c.budget)} · 花{yuan(c.spend)} · 收入{yuan(c.attributedRevenue)}</span></div>)}
          </div>
        </AsyncBoundary>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Target size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>OKR（三级）</span>
          {sum.length > 0 && <span className="t-xs" style={{ marginLeft: 'auto', color: 'var(--t-tertiary)' }}>{sum.map((b: any) => `${b.level} ${(b.avgProgress * 100).toFixed(0)}%`).join(' · ')}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <select className="input" value={no.level} onChange={(e) => setNo({ ...no, level: e.target.value })}><option value="group">集团</option><option value="business_unit">事业部</option><option value="function">职能</option></select>
          <input className="input" value={no.objective} onChange={(e) => setNo({ ...no, objective: e.target.value })} placeholder="目标 Objective" style={{ flex: 1 }} />
          <input className="input" value={no.progress} onChange={(e) => setNo({ ...no, progress: e.target.value })} placeholder="进度0-1" type="number" step="0.1" style={{ width: 100 }} />
          <button className="btn btn-brand" onClick={addOkr}>新建</button>
        </div>
        <AsyncBoundary status={statusOf(okrs.isLoading, okrs.error, oRows.length === 0)} errorMessage="OKR 加载失败（需 API + 数据库）" onRetry={() => okrs.mutate()} emptyTitle="暂无 OKR" emptyDescription="建立集团→事业部→职能三级目标，进度自动汇总到驾驶舱。">
          <div style={{ display: 'grid', gap: 8 }}>
            {oRows.map((o) => (
              <div key={o.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="t-sm"><span>[{o.level}] {o.objective}</span><span className="t-num" style={{ color: 'var(--brand)' }}>{(o.progress * 100).toFixed(0)}%</span></div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 4, height: 6, marginTop: 4 }}><div style={{ width: `${Math.min(o.progress * 100, 100)}%`, background: 'var(--brand)', height: '100%', borderRadius: 4 }} /></div>
              </div>
            ))}
          </div>
        </AsyncBoundary>
      </div>
    </>
  );
}
