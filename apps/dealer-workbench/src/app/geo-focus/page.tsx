'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Flame, Target, Crosshair } from 'lucide-react';
import { PageHeader, AsyncBoundary, useToast, type AsyncStatus } from '@rhautt/ui';
import { agenticGeo, geoFocus } from '../../lib/api';

const CATEGORIES = [
  { code: 'central-hot-water', name: '中央热水' },
  { code: 'wall-hung-boiler', name: '壁挂炉' },
  { code: 'water-cooled-ac', name: '水机空调' },
];
const STAGES: Array<[string, string]> = [['reach', '触达(被提及)'], ['cited', '被引用'], ['recommended', '被推荐'], ['lead', '线索']];
const RATE_KEY = ['', 'citeRate', 'recommendRate', 'leadRate'];

function statusOf(isLoading: boolean, error: unknown, empty: boolean): AsyncStatus {
  if (isLoading) return 'loading'; if (error) return 'error'; if (empty) return 'empty'; return 'ok';
}

export default function GeoFocusPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState('central-hot-water');
  const [plays, setPlays] = useState<any[]>([]);
  const [igniting, setIgniting] = useState(false);
  const [nt, setNt] = useState({ query: '', segment: '', engine: '', priorityScore: '' });

  const funnel = useSWR(`geo:funnel:${category}`, () => geoFocus.cognitionFunnel(category));
  const targets = useSWR(`geo:targets:${category}`, () => geoFocus.listTargets(category));

  async function addTarget() {
    if (!nt.query) { toast('请填写目标 AI 查询', 'error'); return; }
    try {
      await geoFocus.upsertTarget({ category, query: nt.query, segment: nt.segment || undefined, engine: nt.engine || undefined, priorityScore: Number(nt.priorityScore) || 0 });
      setNt({ query: '', segment: '', engine: '', priorityScore: '' }); toast('选点已录入', 'success'); targets.mutate();
    } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function ignite() {
    setIgniting(true);
    try { const r = await agenticGeo.ignite(category, undefined, 5); setPlays(r.plays || []); toast(r.note || `已就位 ${r.selected} 个选点`, 'success'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setIgniting(false); }
  }

  const tRows: any[] = targets.data?.targets || [];

  return (
    <>
      <PageHeader
        title="GEO 进化 · 选点 / 认知资产 / 引爆"
        subtitle="借鉴分众智投「选点·千楼千面·可归因·引爆」：把 AI 答案里的品牌存在做成可选点、可累积、可爆破的护城河资产"
        actions={<button className="btn btn-brand" disabled={igniting} onClick={ignite}><Flame size={15} />{igniting ? '引爆生成中…' : '品类引爆'}</button>}
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {CATEGORIES.map((c) => (
          <button key={c.code} className={category === c.code ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'} onClick={() => { setCategory(c.code); setPlays([]); }}>{c.name}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Crosshair size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>认知资产漏斗（AI-AIPL）</span>
        </div>
        <AsyncBoundary status={statusOf(funnel.isLoading, funnel.error, false)} errorMessage="认知资产加载失败（需 API + 数据库）" onRetry={() => funnel.mutate()}>
          <div style={{ display: 'flex', gap: 10 }}>
            {STAGES.map(([k, label], i) => {
              const v = (funnel.data?.funnel as any)?.[k] ?? 0;
              const rate = i > 0 ? (funnel.data?.rates as any)?.[RATE_KEY[i]] : null;
              return (
                <div key={k} style={{ flex: 1, textAlign: 'center' }}>
                  <div className="inset" style={{ padding: '14px 4px' }}>
                    <div className="t-num" style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)' }}>{v}</div>
                    <div className="t-xs" style={{ color: 'var(--t-tertiary)' }}>{label}</div>
                  </div>
                  {rate != null && <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 4 }}>↳ 转化 {(rate * 100).toFixed(0)}%</div>}
                </div>
              );
            })}
          </div>
        </AsyncBoundary>
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Target size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>选点（潜客浓度×价值 优先级）</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input className="input" value={nt.query} onChange={(e) => setNt({ ...nt, query: e.target.value })} placeholder="目标 AI 查询（如 中央热水哪个品牌好）" style={{ flex: 1, minWidth: 220 }} />
          <input className="input" value={nt.segment} onChange={(e) => setNt({ ...nt, segment: e.target.value })} placeholder="人群段" style={{ width: 110 }} />
          <input className="input" value={nt.engine} onChange={(e) => setNt({ ...nt, engine: e.target.value })} placeholder="引擎" style={{ width: 100 }} />
          <input className="input" value={nt.priorityScore} onChange={(e) => setNt({ ...nt, priorityScore: e.target.value })} placeholder="优先级" type="number" style={{ width: 90 }} />
          <button className="btn btn-brand" onClick={addTarget}>录入</button>
        </div>
        <AsyncBoundary status={statusOf(targets.isLoading, targets.error, tRows.length === 0)} errorMessage="选点加载失败（需 API + 数据库）" onRetry={() => targets.mutate()} emptyTitle="暂无选点" emptyDescription="录入高潜 AI 查询后，引爆将优先打透高优先级选点。">
          <div style={{ display: 'grid', gap: 6 }}>
            {tRows.map((t) => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <span className="t-sm">{t.query} <span className="t-xs" style={{ color: 'var(--t-tertiary)' }}>· {t.segment || '通用'} / {t.engine || '全部'}</span></span>
                <span className="t-xs" style={{ color: 'var(--brand)', fontWeight: 600 }}>优先级 {Number(t.priorityScore).toFixed(0)} · {t.status}</span>
              </div>
            ))}
          </div>
        </AsyncBoundary>
      </div>

      {plays.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Flame size={16} style={{ color: 'var(--brand)' }} /><span className="t-lg" style={{ fontWeight: 600 }}>引爆 · 千问千面草稿（{plays.length}）</span>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {plays.map((p) => (
              <div key={p.targetId} className="inset">
                <div className="t-sm" style={{ color: 'var(--t-strong)', fontWeight: 600 }}>{p.query} <span className="t-xs" style={{ color: 'var(--t-tertiary)', fontWeight: 400 }}>· 策略 {(p.strategies || []).join('/')}</span></div>
                <pre className="t-xs" style={{ color: 'var(--t-secondary)', whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', margin: '6px 0 0' }}>{p.draft?.text?.slice(0, 500)}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
