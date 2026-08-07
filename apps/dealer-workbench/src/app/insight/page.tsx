'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Radio, BarChart3, Newspaper } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { insight } from '../../lib/api';

const CATEGORIES = [
  { code: 'central-hot-water', name: '中央热水' },
  { code: 'wall-hung-boiler', name: '壁挂炉' },
  { code: 'water-cooled-ac', name: '水机空调' },
];
function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
}

export default function InsightPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState('central-hot-water');
  const [f, setF] = useState({ competitor: '', dimension: 'ai_sov', metric: 'AI声量', value: '' });

  const sov = useSWR(`insight:sov:${category}`, () => insight.sov(category));
  const records = useSWR(`insight:rec:${category}`, () => insight.listByCategory(category));
  const signals = useSWR(`insight:sig:${category}`, () => insight.listSignals({ category }));

  async function record() {
    if (!f.competitor) { toast('请填写竞品品牌', 'error'); return; }
    try {
      await insight.recordCompetitor({ category, competitor: f.competitor, dimension: f.dimension, metric: f.metric, value: Number(f.value) || undefined, source: 'manual' });
      setF({ ...f, competitor: '', value: '' }); toast('已录入', 'success'); sov.mutate(); records.mutate();
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  const sovRows: any[] = sov.data?.shareOfVoice || [];
  const recRows: any[] = records.data?.records || [];
  const sigRows: any[] = signals.data?.signals || [];

  return (
    <div className="page-container">
      <PageHeader title="市场洞察 · 竞品情报" subtitle="按品类跟踪竞品与 AI 声量份额(SoV) —— 看清中央热水/壁挂炉/水机空调竞争格局，剑指行业冠军" />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {CATEGORIES.map((c) => <button key={c.code} className={category === c.code ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setCategory(c.code)}>{c.name}</button>)}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><BarChart3 size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>AI 声量份额（SoV）</span></div>
        <AsyncBoundary status={statusOf(sov.isLoading, sov.error, sovRows.length === 0)} errorMessage="SoV 加载失败（需 API + 数据库）" onRetry={() => sov.mutate()} emptyTitle="暂无 SoV 数据" emptyDescription="录入 dimension=ai_sov 的竞品声量值后，这里显示份额对比。">
          <div style={{ display: 'grid', gap: 10 }}>
            {sovRows.map((s) => (
              <div key={s.competitor}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }} className="t-sm"><span>{s.competitor}</span><span className="t-num">{(s.share * 100).toFixed(1)}%</span></div>
                <div style={{ background: 'var(--surface-3)', borderRadius: 4, height: 8, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ width: `${s.share * 100}%`, background: 'var(--brand)', height: '100%' }} />
                </div>
              </div>
            ))}
          </div>
        </AsyncBoundary>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Radio size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>录入竞品情报</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="input" value={f.competitor} onChange={(e) => setF({ ...f, competitor: e.target.value })} placeholder="竞品品牌" style={{ width: 140 }} />
          <select className="input" value={f.dimension} onChange={(e) => setF({ ...f, dimension: e.target.value })}>
            <option value="ai_sov">AI声量</option><option value="product">产品</option><option value="price">价格</option><option value="channel">渠道</option><option value="marketing">营销</option>
          </select>
          <input className="input" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })} placeholder="指标" style={{ width: 130 }} />
          <input className="input" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} placeholder="值" type="number" style={{ width: 100 }} />
          <button className="btn btn-brand" onClick={record}>录入</button>
        </div>
        <AsyncBoundary status={statusOf(records.isLoading, records.error, recRows.length === 0)} errorMessage="情报加载失败（需 API + 数据库）" onRetry={() => records.mutate()} emptyTitle="暂无竞品情报" emptyDescription="录入竞品的产品/价格/渠道/营销/AI声量维度指标。">
          <div style={{ display: 'grid', gap: 4 }}>
            {recRows.slice(0, 14).map((r) => (
              <div key={r.id} className="t-xs" style={{ color: 'var(--t-secondary)', padding: '4px 0', borderTop: '1px solid var(--border)' }}>{r.competitor} · {r.dimension} · {r.metric} = {r.value ?? r.valueText ?? '-'}</div>
            ))}
          </div>
        </AsyncBoundary>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Newspaper size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>市场/行业信号</span></div>
        <AsyncBoundary status={statusOf(signals.isLoading, signals.error, sigRows.length === 0)} errorMessage="信号加载失败（需 API + 数据库）" onRetry={() => signals.mutate()} emptyTitle="暂无信号" emptyDescription="宏观/行业/趋势/AI认知 信号将在此汇总。">
          <div style={{ display: 'grid', gap: 4 }}>
            {sigRows.slice(0, 12).map((s) => (
              <div key={s.id} className="t-sm" style={{ padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                <span className="t-xs" style={{ color: s.severity === 'alert' ? 'var(--brand)' : 'var(--t-tertiary)' }}>[{s.signalType}]</span> {s.title}
              </div>
            ))}
          </div>
        </AsyncBoundary>
      </div>
    </div>
  );
}
