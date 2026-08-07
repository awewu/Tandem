'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, RadioTower, RefreshCw } from 'lucide-react';
import { growthOpinion } from '../lib/api';

/**
 * 舆情雷达（真数据版，替换原硬编码假 SENTIMENT）。
 * 连 /api/v2/growth/opinion/mentions + /alerts，展示真实声量/情绪/风险。
 * 无数据时如实显示空态，不再编造"92% 正向"。
 */

interface Mention {
  id: string; source: string; content: string; url: string | null;
  sentiment: 'positive' | 'negative' | 'neutral'; intent: string | null;
  severity: string | null; entities: string[]; capturedAt: string; createdAt: string;
}
interface Alert { id: string; severity?: string; status?: string; title?: string; content?: string; createdAt?: string }

const SENTIMENT_META: Record<string, { label: string; tone: string; bg: string }> = {
  positive: { label: '正向', tone: 'var(--success)', bg: 'var(--success-bg,#F0FDF4)' },
  neutral: { label: '中性', tone: 'var(--t-secondary)', bg: 'var(--surface-2)' },
  negative: { label: '负向', tone: 'var(--danger)', bg: 'var(--danger-bg,#FEF2F2)' },
};
const SOURCE_LABEL: Record<string, string> = {
  zhihu: '知乎', xiaohongshu: '小红书', douyin: '抖音', weibo: '微博', wechat: '公众号', tieba: '贴吧', search: '搜索问答',
};
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—');

export function SentimentRadarPanel() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [m, a] = await Promise.all([growthOpinion.mentions(), growthOpinion.alerts()]);
      setMentions(((m?.items || m || []) as Mention[]));
      setAlerts(((a?.items || a || []) as Alert[]));
    } catch (e) { setError(e instanceof Error ? e.message : '加载舆情失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const total = mentions.length;
    const pos = mentions.filter((m) => m.sentiment === 'positive').length;
    const neg = mentions.filter((m) => m.sentiment === 'negative').length;
    const neu = total - pos - neg;
    const goodRate = total ? Math.round(((pos + neu) / total) * 100) : 0;
    return { total, pos, neg, neu, goodRate };
  }, [mentions]);

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">舆情雷达</p>
          <h2 className="workbench-section-header__title">公开渠道声量 · 情绪 · 风险</h2>
          <p className="workbench-section-header__description">真实抓取的公开渠道提及，情绪与风险线索汇总。数据来自后端舆情库，无数据即显示空态。</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>

      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}

      <div className="g4" style={{ gap: 12 }}>
        <Stat label="总提及" value={String(stats.total)} icon={RadioTower} />
        <Stat label="正向及中性" value={stats.total ? stats.goodRate + '%' : '—'} tone={stats.goodRate >= 80 ? 'var(--success)' : undefined} />
        <Stat label="负向声量" value={String(stats.neg)} tone={stats.neg ? 'var(--danger)' : undefined} />
        <Stat label="风险告警" value={String(alerts.length)} icon={AlertTriangle} tone={alerts.length ? 'var(--warning)' : undefined} />
      </div>

      <div className="table-shell">
        <table className="table">
          <thead><tr><th>渠道</th><th>内容</th><th>意图</th><th>情绪</th><th>级别</th><th>时间</th></tr></thead>
          <tbody>
            {mentions.map((m) => {
              const sm = SENTIMENT_META[m.sentiment] || SENTIMENT_META.neutral;
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 700 }}>{SOURCE_LABEL[m.source] || m.source}</td>
                  <td style={{ maxWidth: 320 }}>{m.content}</td>
                  <td>{m.intent || '-'}</td>
                  <td><span className="badge" style={{ color: sm.tone, borderColor: sm.tone, background: sm.bg }}>{sm.label}</span></td>
                  <td><span className="badge">{m.severity || '-'}</span></td>
                  <td>{fmtDate(m.capturedAt || m.createdAt)}</td>
                </tr>
              );
            })}
            {!mentions.length ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--t-tertiary)' }}>
                {loading ? '加载中…' : '暂无舆情记录（后端舆情库为空，接入采集源后自动填充）'}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon?: any; tone?: string }) {
  return (
    <article className="inset" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="t-label">{label}</span>
        {Icon ? <Icon size={15} style={{ color: tone || 'var(--brand)' }} /> : null}
      </div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: tone || 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </article>
  );
}
