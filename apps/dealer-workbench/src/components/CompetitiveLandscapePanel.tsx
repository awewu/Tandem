'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, Crosshair, Loader2, PieChart, RefreshCw } from 'lucide-react';
import { insight } from '../lib/api';

/**
 * 竞争格局面板：把「份额一张条形图」升级为**格局形态 + 趋势 + 威胁排序**。
 * 数据源只有 GEO 探测自动入账的 ai_sov 时序（手工台账无时间序列，做不出动量）。
 *
 * 诚实呈现（守基座4）：
 *  - basis='none' 时如实显示"无数据"与原因，不画空图假装有格局。
 *  - 样本不足的动量显示"样本不足"而非百分点数字。
 *  - universeIncludesSelf=false 时**必须警示**份额只是"竞品之间的份额"，不可当全量读。
 */

interface SovRow { competitor: string; isSelf: boolean; value: number; share: number }
interface MomentumRow {
  competitor: string; currentHits: number; previousHits: number;
  shareDeltaPp: number | null;
  verdict: 'rising' | 'falling' | 'flat' | 'insufficient-data';
  reason: string;
}
interface ThreatRow {
  competitor: string; score: number;
  factors: { share: number; momentum: number; leader: number };
  reason: string;
}
interface Landscape {
  category: string; windowDays: number; basis: 'geo-probe' | 'none';
  universeIncludesSelf: boolean;
  note?: string;
  concentration: { hhi: number; band: string; players: number; effectivePlayers: number } | null;
  shareOfVoice: SovRow[];
  momentum: MomentumRow[];
  threats: ThreatRow[];
  leaderGap: { leader: string | null; leaderShare: number; selfShare: number | null; gapPp: number | null; selfIsLeader: boolean } | null;
}

const BAND_META: Record<string, { label: string; tone: string; hint: string }> = {
  'highly-concentrated': { label: '高集中', tone: 'var(--danger)', hint: '寡头格局：头部话语权强，打法应聚焦细分场景侧翼切入' },
  'moderately-concentrated': { label: '中度集中', tone: 'var(--warning)', hint: '格局未定：份额仍可争夺，先占高价值场景' },
  unconcentrated: { label: '分散', tone: 'var(--success)', hint: '分散格局：谁先系统化占位谁受益' },
};

const VERDICT_META: Record<string, { label: string; tone: string }> = {
  rising: { label: '上升', tone: 'var(--danger)' },
  falling: { label: '下降', tone: 'var(--success)' },
  flat: { label: '持平', tone: 'var(--t-tertiary)' },
  'insufficient-data': { label: '样本不足', tone: 'var(--t-tertiary)' },
};

export function CompetitiveLandscapePanel({ category, windowDays = 30 }: { category: string; windowDays?: number }) {
  const [data, setData] = useState<Landscape | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await insight.landscape(category, windowDays);
      setData((r?.data ?? r) as Landscape);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [category, windowDays]);
  useEffect(() => { load(); }, [load]);

  const momentumOf = (competitor: string) => data?.momentum.find((m) => m.competitor === competitor);
  const band = data?.concentration ? BAND_META[data.concentration.band] : null;

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">竞品情报 · 竞争格局</p>
          <h2 className="workbench-section-header__title">集中度 · 动量 · 头部差距 · 威胁排序</h2>
          <p className="workbench-section-header__description">
            份额 30% 是在涨还是在跌、品类是寡头还是分散，决定完全不同的打法。数据源：GEO 探测自动入账的 AI 声量时序。
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>
      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}

      {/* 无数据：如实说明原因，不画空图 */}
      {data && data.basis === 'none' ? (
        <div className="inset" style={{ padding: 16, display: 'grid', gap: 6 }}>
          <strong style={{ fontSize: 13, color: 'var(--t-strong)' }}>该品类暂无 AI 声量时序数据</strong>
          <span style={{ fontSize: 12.5, color: 'var(--t-tertiary)' }}>{data.note}</span>
        </div>
      ) : null}

      {data && data.basis === 'geo-probe' ? (
        <>
          {/* 口径警示：我方不在样本内时，份额不可当全量份额读 */}
          {!data.universeIncludesSelf ? (
            <div className="inset" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderLeft: '3px solid var(--warning)' }}>
              <AlertTriangle size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--t-secondary)' }}>
                本窗口内我方未被 AI 引用，下列份额是<strong>竞品之间的份额</strong>，不可当作全量份额；「与头部差距」因此无法计算。
              </span>
            </div>
          ) : null}

          {/* ① 格局形态 + 头部差距 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
            <div className="inset" style={{ padding: 14, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <PieChart size={14} style={{ color: 'var(--brand)' }} />
                <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>集中度 HHI</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <strong style={{ fontSize: 22, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{data.concentration?.hhi}</strong>
                {band ? <span className="badge" style={{ fontSize: 10, color: band.tone, borderColor: band.tone }}>{band.label}</span> : null}
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>
                有效竞争者 {data.concentration?.effectivePlayers} 家（共 {data.concentration?.players} 家在榜）
              </span>
              {band ? <span style={{ fontSize: 11.5, color: 'var(--t-secondary)' }}>{band.hint}</span> : null}
            </div>

            <div className="inset" style={{ padding: 14, display: 'grid', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Crosshair size={14} style={{ color: 'var(--brand)' }} />
                <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>与头部差距</span>
              </div>
              {data.leaderGap?.gapPp === null || data.leaderGap === null ? (
                <>
                  <strong style={{ fontSize: 15, color: 'var(--t-tertiary)' }}>无我方口径</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>
                    当前头部：{data.leaderGap?.leader ?? '-'}（{((data.leaderGap?.leaderShare ?? 0) * 100).toFixed(1)}%）
                  </span>
                </>
              ) : data.leaderGap.selfIsLeader ? (
                <>
                  <strong style={{ fontSize: 22, color: 'var(--success)' }}>我方领先</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>我方份额 {((data.leaderGap.selfShare ?? 0) * 100).toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <strong style={{ fontSize: 22, color: 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>{data.leaderGap.gapPp}</strong>
                    <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>pp 落后</span>
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>
                    头部 {data.leaderGap.leader}（{(data.leaderGap.leaderShare * 100).toFixed(1)}%） vs 我方 {((data.leaderGap.selfShare ?? 0) * 100).toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </div>

          {/* ② 份额 + 动量（同一行看存量与趋势） */}
          <div className="inset" style={{ display: 'grid', gap: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} style={{ color: 'var(--brand)' }} />
              <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>AI 声量份额与动量</strong>
              <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)', marginLeft: 'auto' }}>
                近 {data.windowDays} 天 vs 前 {data.windowDays} 天
              </span>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {data.shareOfVoice.map((s) => {
                const m = momentumOf(s.competitor);
                const vm = m ? VERDICT_META[m.verdict] : null;
                return (
                  <div key={s.competitor}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: s.isSelf ? 700 : 500, color: s.isSelf ? 'var(--brand)' : 'var(--t-strong)' }}>
                        {s.competitor}{s.isSelf ? '（我方）' : ''}
                      </span>
                      {vm ? (
                        <span style={{ fontSize: 11, color: vm.tone }} title={m!.reason}>
                          {vm.label}
                          {m!.shareDeltaPp !== null ? ` ${m!.shareDeltaPp > 0 ? '+' : ''}${m!.shareDeltaPp}pp` : ''}
                        </span>
                      ) : null}
                      <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', color: 'var(--t-secondary)' }}>
                        {(s.share * 100).toFixed(1)}%
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--t-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{s.value} 次</span>
                    </div>
                    <div style={{ background: 'var(--surface-3)', borderRadius: 4, height: 8, overflow: 'hidden', marginTop: 4 }}>
                      <div style={{ width: `${s.share * 100}%`, background: s.isSelf ? 'var(--brand)' : 'var(--t-tertiary)', height: '100%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ③ 威胁排序：可解释因子全展开，防黑箱 */}
          <div className="inset" style={{ display: 'grid', gap: 10, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: 'var(--brand)' }} />
              <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>威胁排序</strong>
              <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>份额存量(≤60) + 动量增量(≤30) + 头部加成(10)</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {data.threats.map((t) => (
                <div key={t.competitor} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--surface-3)', borderRadius: 8, padding: '10px 12px' }}>
                  <strong style={{ fontSize: 13, color: 'var(--t-strong)', minWidth: 90 }}>{t.competitor}</strong>
                  <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>{t.reason}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
                    {t.factors.share}+{t.factors.momentum}+{t.factors.leader}
                  </span>
                  <strong style={{ fontSize: 18, color: t.score >= 50 ? 'var(--danger)' : 'var(--t-secondary)', fontVariantNumeric: 'tabular-nums' }}>{t.score}</strong>
                </div>
              ))}
              {!data.threats.length ? <p style={{ fontSize: 13, color: 'var(--t-tertiary)' }}>窗口内无竞品被引</p> : null}
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>
              威胁评分是<strong>可解释启发式</strong>而非统计模型；因子已全量展开供复核。
              「只大不涨」的老牌靠存量分、「小而猛涨」的新秀靠动量分，两类都不会被漏看。
            </p>
          </div>
        </>
      ) : null}

      {loading && !data ? <p style={{ fontSize: 13, color: 'var(--t-tertiary)' }}>加载中…</p> : null}
    </section>
  );
}
