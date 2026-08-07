'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, PenTool, RefreshCw } from 'lucide-react';
import { growthCopy } from '../lib/api';

/**
 * 文案 Copilot 资产列表（真数据版，替换原硬编码假 COPY_TASKS）。
 * 连 /api/v2/growth/copy，展示真实生成的文案草稿/审核状态/所用 GEO 策略。
 */

interface CopyAsset {
  id: string; channel: string; source: string; brandSlug: string | null;
  question: string | null; draft: string | null; status: string;
  model: string | null; strategyKeys: string[]; createdAt: string;
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  draft: { label: '待审核', tone: 'var(--warning)' },
  approved: { label: '已核准', tone: 'var(--success)' },
  published: { label: '已发布', tone: 'var(--brand)' },
  rejected: { label: '已驳回', tone: 'var(--danger)' },
};
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—');

export function CopyAssetsPanel() {
  const [items, setItems] = useState<CopyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await growthCopy.list();
      setItems(((r?.items || r || []) as CopyAsset[]));
    } catch (e) { setError(e instanceof Error ? e.message : '加载文案失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">文案 Copilot</p>
          <h2 className="workbench-section-header__title">已生成文案资产</h2>
          <p className="workbench-section-header__description">真实生成的官网/投放/私域文案草稿，含审核状态与所用 GEO 策略。可进入审核流转。</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>

      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map((c) => {
          const sm = STATUS_META[c.status] || { label: c.status, tone: 'var(--t-secondary)' };
          return (
            <article key={c.id} className="inset" style={{ display: 'grid', gap: 8, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>{c.question || c.channel}</strong>
                <span className="badge" style={{ color: sm.tone, borderColor: sm.tone, whiteSpace: 'nowrap' }}>{sm.label}</span>
              </div>
              {c.draft ? <p style={{ fontSize: 13, color: 'var(--t-secondary)', lineHeight: 1.6, maxHeight: 60, overflow: 'hidden' }}>{c.draft.slice(0, 160)}</p> : null}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="badge">{c.channel}</span>
                {c.brandSlug ? <span className="badge">{c.brandSlug}</span> : null}
                {(c.strategyKeys || []).map((k) => <span key={k} className="badge" style={{ fontSize: 11, color: 'var(--brand)' }}>{k}</span>)}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-tertiary)' }}>{c.model || ''} · {fmtDate(c.createdAt)}</span>
              </div>
            </article>
          );
        })}
        {!items.length ? (
          <div className="inset" style={{ textAlign: 'center', padding: 28, color: 'var(--t-tertiary)' }}>
            <PenTool size={24} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13 }}>{loading ? '加载中…' : '暂无文案资产。在 GEO 面板对缺口问题"生成建议"即可产出文案。'}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
