'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertOctagon, Loader2, RefreshCw, Shield, Swords, Target, TrendingDown } from 'lucide-react';
import { growthGeo } from '../lib/api';

/**
 * AI 视角 SWOT 面板：把「主观自评 SWOT」变成**可测的 SWOT**。
 * 四格全部由真实探测数据派生，每格都能点开看到具体问题与被引率：
 *  S = AI 认可并引用我方的问题
 *  W = AI 说得出竞品却说不出我方（可测的真实弱点）+ AI 错误描述我方（幻觉=紧急弱点）
 *  O = 我方与竞品均未占位的空白（先发可能独占）
 *  T = 我方缺席时被引的竞品
 *
 * 诚实呈现：窗口内无真实探测 → 空态并说明需先跑探测，不生成"看起来像 SWOT"的话术。
 */

interface SwotItem {
  question: string; category: string | null; engines: string[];
  probes: number; citedRate: number; avgAivs: number;
  competitors: string[]; reason?: string;
}
interface ThreatItem { competitor: string; hits: number; sampleQuestions: string[] }
interface Hallucination { question: string; engine: string; reasons: string[] }
interface SwotData {
  window: { days: number; since: string; probes: number; questions: number };
  scope: { brandSlug: string | null; category: string | null };
  strengths: SwotItem[];
  weaknesses: SwotItem[];
  hallucinations: Hallucination[];
  opportunities: SwotItem[];
  threats: ThreatItem[];
  note: string;
}

const WINDOWS = [30, 90, 180];

function QuadrantHeader({ icon, title, hint, count, tone }: {
  icon: React.ReactNode; title: string; hint: string; count: number; tone: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      {icon}
      <strong style={{ fontSize: 13.5, color: 'var(--t-strong)' }}>{title}</strong>
      <span className="badge" style={{ fontSize: 10, color: tone, borderColor: tone }}>{count}</span>
      <span style={{ fontSize: 11, color: 'var(--t-tertiary)', marginLeft: 'auto', textAlign: 'right' }}>{hint}</span>
    </div>
  );
}

function ItemRow({ item, showCited }: { item: SwotItem; showCited?: boolean }) {
  return (
    <div style={{ padding: '6px 0', borderTop: '1px solid var(--border)', display: 'grid', gap: 2 }}>
      <span style={{ fontSize: 12.5, color: 'var(--t-strong)' }}>{item.question}</span>
      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--t-tertiary)', flexWrap: 'wrap' }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{item.probes} 次探测</span>
        {showCited ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>被引率 {item.citedRate}%</span> : null}
        {item.avgAivs ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>AIVS {item.avgAivs}</span> : null}
        {item.competitors.length ? <span>竞品：{item.competitors.slice(0, 3).join('、')}</span> : null}
        {item.engines.length ? <span>{item.engines.join('/')}</span> : null}
      </div>
    </div>
  );
}

export function AiSwotPanel({ brandSlug = 'rheem', category }: { brandSlug?: string; category?: string }) {
  const [data, setData] = useState<SwotData | null>(null);
  const [windowDays, setWindowDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await growthGeo.swot({ brandSlug, category, windowDays });
      setData((r?.data ?? r) as SwotData);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [brandSlug, category, windowDays]);
  useEffect(() => { load(); }, [load]);

  const hasProbes = !!data?.window.probes;

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">战略分析 · AI 视角 SWOT</p>
          <h2 className="workbench-section-header__title">可测的 SWOT（非主观自评）</h2>
          <p className="workbench-section-header__description">
            优势=AI 真引用了我方；劣势=AI 说得出竞品却说不出我方；机会=无人占位的空白；威胁=我方缺席时被引的竞品。
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {WINDOWS.map((d) => (
            <button key={d} className={windowDays === d ? 'btn btn-brand btn-sm' : 'btn btn-outline btn-sm'} onClick={() => setWindowDays(d)}>
              {d}天
            </button>
          ))}
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      </div>
      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}

      {data ? (
        <div className="inset" style={{ padding: '10px 14px', display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ color: 'var(--t-tertiary)' }}>
            窗口 <strong style={{ color: 'var(--t-strong)' }}>{data.window.days}</strong> 天
          </span>
          <span style={{ color: 'var(--t-tertiary)' }}>
            真实探测 <strong style={{ color: hasProbes ? 'var(--t-strong)' : 'var(--warning)' }}>{data.window.probes}</strong> 次
          </span>
          <span style={{ color: 'var(--t-tertiary)' }}>
            覆盖问题 <strong style={{ color: 'var(--t-strong)' }}>{data.window.questions}</strong> 个
          </span>
          <span style={{ color: 'var(--t-tertiary)', marginLeft: 'auto' }}>
            {data.scope.brandSlug || '全品牌'}{data.scope.category ? ` · ${data.scope.category}` : ''}
          </span>
        </div>
      ) : null}

      {/* 无探测数据：如实空态，指出前置动作 */}
      {data && !hasProbes ? (
        <div className="inset" style={{ padding: 16, display: 'grid', gap: 6 }}>
          <strong style={{ fontSize: 13, color: 'var(--t-strong)' }}>窗口内无真实探测数据 → SWOT 为空态</strong>
          <span style={{ fontSize: 12.5, color: 'var(--t-tertiary)' }}>{data.note}</span>
        </div>
      ) : null}

      {data && hasProbes ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 12 }}>
          {/* S */}
          <div className="inset" style={{ padding: 14 }}>
            <QuadrantHeader
              icon={<Shield size={15} style={{ color: 'var(--success)' }} />}
              title="优势 S · AI 引用我方" hint="按被引率×AIVS 排序"
              count={data.strengths.length} tone="var(--success)"
            />
            {data.strengths.length
              ? data.strengths.map((i) => <ItemRow key={i.question} item={i} showCited />)
              : <p style={{ fontSize: 12.5, color: 'var(--t-tertiary)' }}>窗口内 AI 未引用我方 —— 这本身就是最强的行动信号</p>}
          </div>

          {/* W */}
          <div className="inset" style={{ padding: 14 }}>
            <QuadrantHeader
              icon={<TrendingDown size={15} style={{ color: 'var(--danger)' }} />}
              title="劣势 W · 说得出竞品说不出我方" hint="可测的真实弱点"
              count={data.weaknesses.length} tone="var(--danger)"
            />
            {data.weaknesses.length
              ? data.weaknesses.map((i) => <ItemRow key={i.question} item={i} />)
              : <p style={{ fontSize: 12.5, color: 'var(--t-tertiary)' }}>无「竞品被引而我方缺席」的问题</p>}

            {data.hallucinations.length ? (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <AlertOctagon size={14} style={{ color: 'var(--danger)' }} />
                  <strong style={{ fontSize: 12.5, color: 'var(--danger)' }}>AI 错误描述我方（紧急）</strong>
                </div>
                {data.hallucinations.map((h, idx) => (
                  <div key={`${h.question}-${h.engine}-${idx}`} style={{ padding: '5px 0', display: 'grid', gap: 2 }}>
                    <span style={{ fontSize: 12, color: 'var(--t-strong)' }}>{h.question}</span>
                    <span style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>[{h.engine}] {h.reasons.join('；')}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* O */}
          <div className="inset" style={{ padding: 14 }}>
            <QuadrantHeader
              icon={<Target size={15} style={{ color: 'var(--brand)' }} />}
              title="机会 O · 无人占位的空白" hint="先发即可能独占"
              count={data.opportunities.length} tone="var(--brand)"
            />
            {data.opportunities.length
              ? data.opportunities.map((i) => <ItemRow key={i.question} item={i} />)
              : <p style={{ fontSize: 12.5, color: 'var(--t-tertiary)' }}>无空白问题（每个问题都已有人被引）</p>}
          </div>

          {/* T */}
          <div className="inset" style={{ padding: 14 }}>
            <QuadrantHeader
              icon={<Swords size={15} style={{ color: 'var(--warning)' }} />}
              title="威胁 T · 我方缺席时被引的竞品" hint="按频次排序"
              count={data.threats.length} tone="var(--warning)"
            />
            {data.threats.length ? data.threats.map((t) => (
              <div key={t.competitor} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', display: 'grid', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <strong style={{ fontSize: 12.5, color: 'var(--t-strong)' }}>{t.competitor}</strong>
                  <span style={{ fontSize: 11, color: 'var(--t-tertiary)', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                    {t.hits} 次抢位
                  </span>
                </div>
                {t.sampleQuestions.map((q) => (
                  <span key={q} style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>· {q}</span>
                ))}
              </div>
            )) : <p style={{ fontSize: 12.5, color: 'var(--t-tertiary)' }}>无竞品在我方缺席时被引</p>}
          </div>
        </div>
      ) : null}

      {data?.note && hasProbes ? (
        <p style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>{data.note}</p>
      ) : null}
      {loading && !data ? <p style={{ fontSize: 13, color: 'var(--t-tertiary)' }}>加载中…</p> : null}
    </section>
  );
}
