'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, FileText, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import { growthCopy } from '../lib/api';

/**
 * AI 成本 ROI 视图（P1-2 · 总部关心"GEO/内容投入产出"）。
 * 连真数据：growthCopy.list 的 tokensCost（每次 AI 调用真实落账）。
 * 展示：累计 AI token 成本、产出内容数、单条成本。无成本记录显示空态。
 */

interface Copy { id: string; channel: string; status: string; model: string | null; tokensCost: string; createdAt: string }

export function AiCostPanel() {
  const [items, setItems] = useState<Copy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await growthCopy.list();
      setItems(((r?.items || r || []) as Copy[]));
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stat = useMemo(() => {
    const withCost = items.filter((c) => Number(c.tokensCost) > 0);
    const totalTokens = items.reduce((s, c) => s + Number(c.tokensCost || 0), 0);
    const published = items.filter((c) => c.status === 'published').length;
    const avg = withCost.length ? Math.round(totalTokens / withCost.length) : 0;
    return { totalTokens, produced: items.length, published, avg, withCost: withCost.length };
  }, [items]);

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">AI 成本 · ROI</p>
          <h2 className="workbench-section-header__title">内容生成投入产出</h2>
          <p className="workbench-section-header__description">每次 AI 调用真实 token 成本落账，聚合成投入产出。数据来自内容资产，无编造。</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>
      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}
      <div className="g4" style={{ gap: 12 }}>
        <Stat icon={Coins} label="累计 AI token" value={stat.totalTokens.toLocaleString('zh-CN')} hint={`${stat.withCost} 次有成本记录`} />
        <Stat icon={FileText} label="产出内容" value={String(stat.produced)} hint={`${stat.published} 已发布`} />
        <Stat icon={TrendingUp} label="单条平均成本" value={stat.avg ? stat.avg.toLocaleString('zh-CN') + ' tok' : '—'} hint="token/条" />
        <Stat icon={Coins} label="发布转化" value={stat.produced ? Math.round((stat.published / stat.produced) * 100) + '%' : '—'} hint="产出→发布" />
      </div>
      {!stat.withCost ? <p style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>暂无成本记录：生成 GEO 内容后此处显示真实 token 投入。</p> : null}
    </section>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) {
  return (
    <article className="inset" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="t-label">{label}</span>
        <Icon size={15} style={{ color: 'var(--brand)' }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 11, color: 'var(--t-tertiary)' }}>{hint}</div>
    </article>
  );
}
