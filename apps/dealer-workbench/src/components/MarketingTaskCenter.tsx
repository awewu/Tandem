'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ClipboardList, FlaskConical, Loader2, PenTool, RefreshCw, Search, Send } from 'lucide-react';
import { growthGeo, growthCopy } from '../lib/api';

/**
 * 品牌运营任务中枢（P0 · 把散落的 GEO 缺口→生成→审核→发布串成待办看板）。
 * 解决："功能都在但串不起来，运营要自己记哪个缺口补了没"。
 * 全部连真数据：probe-batches(缺口) · copy(草稿/审核/发布) · experiments(闭环验证)。
 */

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—');

interface Batch { id: string; brandSlug: string; citedRate: number; totalProbes: number; status: string; createdAt: string }
interface Copy { id: string; channel: string; question: string | null; status: string; brandSlug: string | null; createdAt: string }
interface Experiment { id: string; question: string; status: string; lift: number | null }

export function MarketingTaskCenter({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [b, c, e] = await Promise.all([
        growthGeo.probeBatches({ brandSlug }),
        growthCopy.list(),
        growthGeo.experiments({ brandSlug }),
      ]);
      setBatches(((b?.items || b?.data?.items || []) as Batch[]));
      setCopies(((c?.items || c || []) as Copy[]));
      setExperiments(((e?.items || e || []) as Experiment[]));
    } catch (err) { setError(err instanceof Error ? err.message : '加载任务失败'); }
    finally { setLoading(false); }
  }, [brandSlug]);
  useEffect(() => { load(); }, [load]);

  // 待办聚合：低可见度批次=待补缺口；draft=待审核；published=已发布；verifying=实验中
  const tasks = useMemo(() => {
    const gaps = batches.filter((b) => b.status === 'succeeded' && b.citedRate < 50).length;
    const toReview = copies.filter((c) => c.status === 'draft').length;
    const published = copies.filter((c) => c.status === 'published').length;
    const verifying = experiments.filter((e) => e.status === 'verifying' || e.status === 'content-linked').length;
    return { gaps, toReview, published, verifying };
  }, [batches, copies, experiments]);

  const draftList = copies.filter((c) => c.status === 'draft').slice(0, 8);

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">品牌运营 · 任务中枢</p>
          <h2 className="workbench-section-header__title">缺口 → 生成 → 审核 → 发布</h2>
          <p className="workbench-section-header__description">把 GEO 缺口、待审内容、发布与实验聚成一个待办看板。数据实时来自各模块，点标签跳转处理。</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>
      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}

      {/* 四阶段待办流 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <FlowCard icon={Search} label="① 待补缺口" value={tasks.gaps} tone="var(--danger)" href="/growth/geo" hint="出现率<50%的探测" />
        <FlowCard icon={PenTool} label="② 待审内容" value={tasks.toReview} tone="var(--warning)" href="/growth/copywriter" hint="draft 状态文案" />
        <FlowCard icon={FlaskConical} label="③ 实验验证中" value={tasks.verifying} tone="var(--brand)" href="/growth/geo" hint="复投中/待复投" />
        <FlowCard icon={Send} label="④ 已发布" value={tasks.published} tone="var(--success)" href="/growth/wechat-drafts" hint="已上线内容" />
      </div>

      {/* 待审内容清单（最需要运营动作的） */}
      <div className="inset" style={{ display: 'grid', gap: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={16} style={{ color: 'var(--brand)' }} />
          <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>待我审核（{draftList.length}）</strong>
          <a href="/growth/copywriter" className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }}>去审核</a>
        </div>
        {draftList.length ? (
          <div className="table-shell">
            <table className="table">
              <thead><tr><th>内容</th><th>渠道</th><th>品牌</th><th>生成</th></tr></thead>
              <tbody>
                {draftList.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.question || c.channel}</td>
                    <td><span className="badge">{c.channel}</span></td>
                    <td>{c.brandSlug || '—'}</td>
                    <td>{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13 }}>
            <CheckCircle2 size={15} />暂无待审内容，审核队列已清空。
          </div>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--t-tertiary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <AlertCircle size={12} />闭环：GEO 探测发现缺口 → 生成内容(带策略) → 此处审核 → 发布 → 闭环实验验证 lift。
      </p>
    </section>
  );
}

function FlowCard({ icon: Icon, label, value, tone, href, hint }: { icon: any; label: string; value: number; tone: string; href: string; hint: string }) {
  return (
    <a href={href} className="inset" style={{ padding: 14, display: 'grid', gap: 6, textDecoration: 'none', borderTop: `3px solid ${tone}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="t-label" style={{ color: 'var(--t-secondary)' }}>{label}</span>
        <Icon size={15} style={{ color: tone }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: tone, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <span style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>{hint}</span>
    </a>
  );
}
