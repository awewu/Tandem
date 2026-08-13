'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cpu, Layers, Loader2, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import { growthGeo } from '../lib/api';

/**
 * GEO 智能层面板：把本轮建成的 SOTA 能力对市场部可视化。
 * ① 研究支撑策略库（每条带论文实测增益）
 * ② 自进化权重（由实验 lift 反哺，正=提权）
 * ③ 受治理动作引擎（Foundry 式：人与 AI Agent 同一套治理闸）
 * 全部连真 API，无数据即如实空态。
 */

// 策略库画像直接来自后端 getStrategyWeights（geo-strategies.ts 单一真相源 + 实验 lift 学到的权重）
interface StrategyRow {
  key: string; label: string; evidence: string; kinds: string[];
  alwaysOn: boolean; base: number; learnedDelta: number; effective: number; experiments: number;
}
interface EvoSummary { scoredExperiments: number; learnedStrategies: number }

const ZONE_META: Record<string, { label: string; tone: string }> = {
  green: { label: '可自动', tone: 'var(--success)' },
  yellow: { label: 'AI代行需核准', tone: 'var(--warning)' },
  red: { label: '永不自动', tone: 'var(--danger)' },
};

interface ActionDef { id: string; label: string; objectType: string; zone: string }

export function GeoIntelligencePanel({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [summary, setSummary] = useState<EvoSummary>({ scoredExperiments: 0, learnedStrategies: 0 });
  const [actions, setActions] = useState<ActionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [w, a] = await Promise.all([growthGeo.strategyWeights(brandSlug), growthGeo.actions()]);
      const d = w?.data || w || {};
      setStrategies((d.strategies || []) as StrategyRow[]);
      setSummary((d.summary || { scoredExperiments: 0, learnedStrategies: 0 }) as EvoSummary);
      setActions((a?.actions || a?.data?.actions || []) as ActionDef[]);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [brandSlug]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">GEO 智能层 · AgenticGEO</p>
          <h2 className="workbench-section-header__title">研究策略库 · 自进化 · 受治理动作</h2>
          <p className="workbench-section-header__description">
            内容生成用研究实证有效的策略组合；实验 lift 反哺哪个策略更有效；AI 与人走同一套治理闸。
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>
      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}

      {/* ① 策略库 + 自进化权重 */}
      <div className="inset" style={{ display: 'grid', gap: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: 'var(--brand)' }} />
          <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>研究支撑策略库 · 自进化权重</strong>
          <span className="badge" style={{ marginLeft: 'auto', fontSize: 10, color: summary.scoredExperiments ? 'var(--success)' : 'var(--t-tertiary)', borderColor: summary.scoredExperiments ? 'var(--success)' : 'var(--border)' }}>
            {summary.scoredExperiments ? `已从 ${summary.scoredExperiments} 个已验证实验学习 · ${summary.learnedStrategies} 策略被调权` : '尚未学习（无已验证 lift 实验）'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 8 }}>
          {strategies.map((s) => {
            const d = s.learnedDelta;
            return (
              <div key={s.key} style={{ border: '1px solid var(--surface-3)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--t-strong)' }}>{s.label}</span>
                  {s.alwaysOn ? <span className="badge" style={{ fontSize: 10, color: 'var(--success)', borderColor: 'var(--success)' }}>保底</span> : null}
                  {d !== 0 ? (
                    <span className="badge" style={{ fontSize: 10, marginLeft: 'auto', color: d > 0 ? 'var(--success)' : 'var(--danger)' }}>
                      <TrendingUp size={10} /> {d > 0 ? '+' : ''}{d}
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>权重</span>
                  <span style={{ fontSize: 12, color: 'var(--t-tertiary)', textDecoration: d !== 0 ? 'line-through' : 'none' }}>{s.base}</span>
                  {d !== 0 ? <><span style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>→</span><strong style={{ fontSize: 14, color: 'var(--brand)' }}>{s.effective}</strong></> : null}
                  {s.experiments ? <span style={{ fontSize: 11, color: 'var(--t-tertiary)', marginLeft: 'auto' }}>{s.experiments} 实验</span> : null}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>{s.evidence}</span>
              </div>
            );
          })}
          {!strategies.length ? <p style={{ fontSize: 13, color: 'var(--t-tertiary)' }}>{loading ? '加载中…' : '无策略数据'}</p> : null}
        </div>
        <p style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>
          有效权重 = 基础权重 + 实验 lift 学到的增减。跑通闭环实验（基线→生成→关联→复投→lift）后自动学习,无数据不臆造。
        </p>
      </div>

      {/* ② 受治理动作引擎 */}
      <div className="inset" style={{ display: 'grid', gap: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} style={{ color: 'var(--brand)' }} />
          <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>受治理动作引擎（Foundry 式）</strong>
          <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>人与 AI Agent 走同一套治理闸</span>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {actions.map((a) => {
            const zm = ZONE_META[a.zone] || { label: a.zone, tone: 'var(--t-secondary)' };
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--surface-3)', borderRadius: 8, padding: '10px 12px' }}>
                <Cpu size={14} style={{ color: 'var(--t-tertiary)' }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--t-strong)' }}>{a.label}</span>
                <code style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>{a.id}</code>
                <span className="badge" style={{ marginLeft: 'auto', color: zm.tone, borderColor: zm.tone }}>{zm.label}</span>
              </div>
            );
          })}
          {!actions.length ? <p style={{ fontSize: 13, color: 'var(--t-tertiary)' }}>{loading ? '加载中…' : '无已注册动作'}</p> : null}
        </div>
      </div>
    </section>
  );
}
