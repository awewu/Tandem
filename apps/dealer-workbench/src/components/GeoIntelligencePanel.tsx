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

// 策略库为前端静态展示（与后端 geo-strategies.ts 同源；增益数字来自论文，非编造）
const STRATEGIES = [
  { key: 'statistics', label: '统计数据添加', gain: '位置调整词数 +41%', always: true },
  { key: 'cite-sources', label: '引用可信来源', gain: '两项可见度 +30%', always: true },
  { key: 'anchor-chunks', label: '锚句分块(100–150词)', gain: 'RAG 引用率 4.7×', always: true },
  { key: 'quotation', label: '引文添加', gain: '主观展示 +28%', always: false },
  { key: 'fluency', label: '流畅性优化', gain: '与统计组合 +35.8%', always: false },
  { key: 'definition-opening', label: '定义式开头', gain: '提升被检索为答案', always: false },
  { key: 'authority-tone', label: '权威语气 E-E-A-T', gain: 'AI 偏好权威内容', always: false },
];

const ZONE_META: Record<string, { label: string; tone: string }> = {
  green: { label: '可自动', tone: 'var(--success)' },
  yellow: { label: 'AI代行需核准', tone: 'var(--warning)' },
  red: { label: '永不自动', tone: 'var(--danger)' },
};

interface ActionDef { id: string; label: string; objectType: string; zone: string }

export function GeoIntelligencePanel({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [actions, setActions] = useState<ActionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [w, a] = await Promise.all([growthGeo.strategyWeights(brandSlug), growthGeo.actions()]);
      setWeights((w?.weights || w?.data?.weights || {}) as Record<string, number>);
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
          <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>研究支撑策略库</strong>
          <span style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>保底必选 = 默认注入的高增益手法</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8 }}>
          {STRATEGIES.map((s) => {
            const w = weights[s.key];
            return (
              <div key={s.key} style={{ border: '1px solid var(--surface-3)', borderRadius: 8, padding: '10px 12px', display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--t-strong)' }}>{s.label}</span>
                  {s.always ? <span className="badge" style={{ fontSize: 10, color: 'var(--success)', borderColor: 'var(--success)' }}>保底</span> : null}
                  {w !== undefined ? (
                    <span className="badge" style={{ fontSize: 10, marginLeft: 'auto', color: w > 0 ? 'var(--success)' : w < 0 ? 'var(--danger)' : 'var(--t-secondary)' }}>
                      <TrendingUp size={10} /> {w > 0 ? '+' : ''}{w}
                    </span>
                  ) : null}
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>{s.gain}</span>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: 'var(--t-tertiary)' }}>
          {Object.keys(weights).length
            ? '权重标记 = 自进化学到的提权/降权（由已验证实验 lift 反哺）。'
            : '自进化权重当前为空：还没有已验证 lift 的实验。跑通闭环实验后自动学习（无数据不臆造）。'}
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
