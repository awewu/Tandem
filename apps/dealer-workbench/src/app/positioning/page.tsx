'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Landmark } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { positioning } from '../../lib/api';

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
}

export default function PositioningPage() {
  const { toast } = useToast();
  const houses = useSWR('positioning:houses', () => positioning.listHouses());
  const [f, setF] = useState({ brandCode: 'rheem', category: 'central-hot-water', promise: '', pillars: '', proof: '' });

  async function save() {
    if (!f.brandCode || !f.category) { toast('品牌与品类必填', 'error'); return; }
    try {
      const pillars = f.pillars.split('\n').filter(Boolean).map((t) => ({ title: t.trim() }));
      const proofPoints = f.proof.split('\n').filter(Boolean).map((line) => { const [claim, evidence] = line.split('|'); return { claim: claim?.trim(), evidence: evidence?.trim() }; });
      const r = await positioning.upsertHouse({ brandCode: f.brandCode, category: f.category, promise: f.promise, pillars, proofPoints });
      toast(r.evidenceMissing ? `已保存（${r.evidenceMissing} 条信任状缺事实依据，基座4建议补 evidence）` : '定位屋已保存', r.evidenceMissing ? 'info' : 'success');
      houses.mutate();
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function approve(id: string) { try { await positioning.setStatus(id, 'approved'); toast('已批准', 'success'); houses.mutate(); } catch (e) { toast((e as Error).message, 'error'); } }

  const rows: any[] = houses.data?.houses || [];

  return (
    <div className="page-container">
      <PageHeader title="品牌定位 · Messaging House" subtitle="每个 品牌×品类 的定位话术弹药：核心承诺 / 价值支柱 / 信任状(事实依据) / 竞品差异 —— 喂 AgenticGEO 与内容，决定“凭什么被 AI 首选”" />

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Landmark size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>编辑定位屋</span></div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input className="input" value={f.brandCode} onChange={(e) => setF({ ...f, brandCode: e.target.value })} placeholder="品牌 rheem" style={{ width: 140 }} />
          <input className="input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="品类 central-hot-water" style={{ flex: 1 }} />
        </div>
        <input className="input" value={f.promise} onChange={(e) => setF({ ...f, promise: e.target.value })} placeholder="核心承诺（一句话定位）" style={{ width: '100%', marginBottom: 8 }} />
        <textarea className="textarea" value={f.pillars} onChange={(e) => setF({ ...f, pillars: e.target.value })} placeholder="价值支柱（每行一条）" style={{ minHeight: 64, marginBottom: 8 }} />
        <textarea className="textarea" value={f.proof} onChange={(e) => setF({ ...f, proof: e.target.value })} placeholder="信任状（每行：主张|事实依据，如 出水恒温±0.5℃|国标GB xxxx）" style={{ minHeight: 64, marginBottom: 12 }} />
        <button className="btn btn-brand" onClick={save}>保存草稿</button>
      </div>

      <AsyncBoundary status={statusOf(houses.isLoading, houses.error, rows.length === 0)} errorMessage="定位屋加载失败（需 API + 数据库）" onRetry={() => houses.mutate()} emptyTitle="暂无定位屋" emptyDescription="为品牌×品类建立定位屋后，AgenticGEO 与内容工厂将据此生成话术。">
        <div style={{ display: 'grid', gap: 16 }}>
          {rows.map((hh) => (
            <div key={hh.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="t-sm" style={{ fontWeight: 700, color: 'var(--t-strong)' }}>{hh.brandCode} · {hh.category}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{hh.status}</span>
                  {hh.status === 'draft' && <button className="btn btn-outline btn-sm" onClick={() => approve(hh.id)}>批准</button>}
                </span>
              </div>
              {hh.promise && <p className="t-sm" style={{ color: 'var(--t-secondary)', margin: '8px 0' }}>{hh.promise}</p>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(hh.pillars || []).map((p: any, i: number) => <span key={i} className="t-xs" style={{ background: 'var(--surface-2)', color: 'var(--brand-700, var(--brand))', borderRadius: 6, padding: '2px 8px' }}>{p.title}</span>)}
              </div>
              {(hh.proofPoints || []).length > 0 && (
                <ul className="t-xs" style={{ color: 'var(--t-tertiary)', margin: '10px 0 0', paddingLeft: 18 }}>
                  {(hh.proofPoints || []).map((p: any, i: number) => <li key={i}>{p.claim}{p.evidence ? ` — 依据：${p.evidence}` : ' ⚠️缺依据'}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </AsyncBoundary>
    </div>
  );
}
