'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Layers, Loader2, Play, RefreshCw, Rocket, SkipForward, XCircle } from 'lucide-react';
import { growthGeo } from '../lib/api';

/**
 * 场景库 + 启动序列面板：GEO 选题的**上游来源**与新品牌/品类的**冷启动**入口。
 *
 * 为什么需要：选题此前无可追溯来源（拍脑袋出题）→ 精密引擎打在没瞄准的靶上。
 * 场景 = 品类 × 角色 × 痛点 × 房型 × 气候区；换品类只换填充词。
 *
 * 治理与诚实：
 *  - 启动序列是 green（只建选题 + 只读探测），可直接执行；内容生成属 yellow 不在此触发。
 *  - 未知品类不编造痛点：后端拒绝，此处如实展示错误并提示补词表。
 *  - 先"试算"（dryRun）看规划再落库，避免误建一堆场景。
 *  - 步骤状态 ok/failed/skipped 原样呈现，基线探测失败不隐藏。
 */

interface ScenarioRow {
  id: string; category: string; audience: string; painPoint: string;
  houseType: string | null; climateZone: string | null; intent: string;
  brandSlug: string | null; enabled: boolean;
}
interface BootStep { step: string; status: 'ok' | 'failed' | 'skipped'; detail?: unknown; error?: string }
interface BootResult {
  brandSlug: string; category: string; dryRun?: boolean;
  steps: BootStep[];
  nextActions?: Array<{ actionId: string; zone: string; note: string }>;
  note?: string;
}

const AUDIENCE_LABEL: Record<string, string> = {
  owner: '业主', decorator: '装修公司', designer: '设计师', installer: '安装工',
};
const INTENT_LABEL: Record<string, { label: string; tone: string }> = {
  info: { label: '信息型', tone: 'var(--t-tertiary)' },
  compare: { label: '对比型', tone: 'var(--warning)' },
  decide: { label: '决策型', tone: 'var(--danger)' },
};
const STEP_LABEL: Record<string, string> = {
  'seed-scenarios': '播种场景 + 派生选题',
  'baseline-probe': '基线探测（只读）',
};
const STATUS_META: Record<string, { icon: React.ReactNode; tone: string; label: string }> = {
  ok: { icon: <CheckCircle2 size={14} />, tone: 'var(--success)', label: '完成' },
  failed: { icon: <XCircle size={14} />, tone: 'var(--danger)', label: '失败' },
  skipped: { icon: <SkipForward size={14} />, tone: 'var(--t-tertiary)', label: '跳过' },
};

export function ScenarioLibraryPanel({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ category: '', painPoints: '', maxScenarios: 12 });
  const [running, setRunning] = useState<null | 'dry' | 'seed' | 'boot'>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [result, setResult] = useState<BootResult | null>(null);
  const [seedSummary, setSeedSummary] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await growthGeo.scenarios({ brandSlug });
      const d = r?.data ?? r;
      setScenarios((d?.scenarios ?? d ?? []) as ScenarioRow[]);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [brandSlug]);
  useEffect(() => { load(); }, [load]);

  const payload = () => ({
    brandSlug,
    category: form.category.trim(),
    painPoints: form.painPoints.split(/[,，、\s]+/).map((s) => s.trim()).filter(Boolean),
    maxScenarios: Number(form.maxScenarios) || 12,
  });

  async function run(mode: 'dry' | 'seed' | 'boot') {
    if (!form.category.trim()) { setRunError('请填写品类'); return; }
    setRunning(mode); setRunError(null); setResult(null); setSeedSummary(null);
    try {
      const p = payload();
      if (mode === 'boot') {
        // 启动序列（green）：播种→派生选题→基线探测。基线依赖外部 AI 网关，失败会如实上报。
        const r = await growthGeo.bootstrap({ ...p, runBaseline: true });
        setResult((r?.data ?? r) as BootResult);
      } else {
        const r = await growthGeo.seedScenarios({ ...p, dryRun: mode === 'dry' });
        const d = (r?.data ?? r) as any;
        setSeedSummary(mode === 'dry'
          ? `试算：将建 ${d.scenariosPlanned} 个场景、派生 ${d.topicsPlanned} 个选题（未落库）`
          : `已落库：新建 ${d.scenariosCreated} 个场景、存入 ${d.questionsSaved} 个选题（重复项已跳过）`);
      }
      if (mode !== 'dry') await load();
    } catch (e) {
      setRunError(e instanceof Error ? e.message : '执行失败');
    } finally { setRunning(null); }
  }

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">战略分析 · 场景库</p>
          <h2 className="workbench-section-header__title">场景即 prompt · 新品类冷启动</h2>
          <p className="workbench-section-header__description">
            消费者不问「变频参数」，而问「北方老房没地暖怎么改」。场景 = 品类 × 角色 × 痛点 × 房型 × 气候区，选题由此派生、来源可追溯。
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>

      {/* 播种 / 启动序列 */}
      <div className="inset" style={{ display: 'grid', gap: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Rocket size={16} style={{ color: 'var(--brand)' }} />
          <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>播种 / 启动序列</strong>
          <span className="badge" style={{ fontSize: 10, color: 'var(--success)', borderColor: 'var(--success)', marginLeft: 'auto' }}>
            green · 可自动
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="input" style={{ width: 150 }} placeholder="品类（如 热泵）"
            value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <input className="input" style={{ flex: 1, minWidth: 220 }} placeholder="痛点（逗号分隔；内置品类可留空）"
            value={form.painPoints} onChange={(e) => setForm({ ...form, painPoints: e.target.value })} />
          <input className="input" style={{ width: 90 }} type="number" min={1} max={50} placeholder="上限"
            value={form.maxScenarios} onChange={(e) => setForm({ ...form, maxScenarios: Number(e.target.value) })} />
          <button className="btn btn-outline btn-sm" onClick={() => run('dry')} disabled={!!running}>
            {running === 'dry' ? <Loader2 size={14} className="animate-spin" /> : null}试算
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => run('seed')} disabled={!!running}>
            {running === 'seed' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}仅播种
          </button>
          <button className="btn btn-brand btn-sm" onClick={() => run('boot')} disabled={!!running}>
            {running === 'boot' ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}启动序列
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>
          未收录品类<strong>不会编造痛点</strong>，须自行提供真实用户痛点；启动序列 = 播种 → 派生选题 → 基线探测（只读），
          「缺口→生成内容」属 yellow，需人工核准，不在此触发。
        </p>

        {runError ? <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{runError}</div> : null}
        {seedSummary ? <div style={{ color: 'var(--success)', fontSize: 12.5 }}>{seedSummary}</div> : null}

        {/* 启动序列步骤状态：原样呈现，失败不隐藏 */}
        {result ? (
          <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
            {result.steps.map((s) => {
              const m = STATUS_META[s.status] || STATUS_META.skipped;
              return (
                <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <span style={{ color: m.tone, display: 'flex' }}>{m.icon}</span>
                  <span style={{ color: 'var(--t-strong)' }}>{STEP_LABEL[s.step] || s.step}</span>
                  <span style={{ color: m.tone, fontSize: 11 }}>{m.label}</span>
                  {s.error ? <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>{s.error}</span> : null}
                </div>
              );
            })}
            {result.nextActions?.length ? (
              <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border)', display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)' }}>后续待办</span>
                {result.nextActions.map((a) => (
                  <div key={a.actionId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                    <code style={{ fontSize: 10.5, color: 'var(--t-tertiary)' }}>{a.actionId}</code>
                    <span className="badge" style={{ fontSize: 10, color: a.zone === 'green' ? 'var(--success)' : 'var(--warning)' }}>
                      {a.zone === 'green' ? '可自动' : 'AI代行需核准'}
                    </span>
                    <span style={{ color: 'var(--t-tertiary)' }}>{a.note}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* 场景清单 */}
      <div className="inset" style={{ display: 'grid', gap: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: 'var(--brand)' }} />
          <strong style={{ fontSize: 14, color: 'var(--t-strong)' }}>场景清单</strong>
          <span style={{ fontSize: 11.5, color: 'var(--t-tertiary)', marginLeft: 'auto' }}>{scenarios.length} 个</span>
        </div>
        {error ? <div style={{ color: 'var(--danger)', fontSize: 12.5 }}>{error}</div> : null}
        <div style={{ display: 'grid', gap: 4 }}>
          {scenarios.slice(0, 40).map((s) => {
            const im = INTENT_LABEL[s.intent] || INTENT_LABEL.compare;
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--t-strong)', minWidth: 80 }}>{s.category}</span>
                <span style={{ color: 'var(--t-secondary)' }}>{s.painPoint}</span>
                <span style={{ color: 'var(--t-tertiary)', fontSize: 11 }}>
                  {[AUDIENCE_LABEL[s.audience] || s.audience, s.houseType, s.climateZone].filter(Boolean).join(' · ')}
                </span>
                <span className="badge" style={{ marginLeft: 'auto', fontSize: 10, color: im.tone, borderColor: im.tone }}>{im.label}</span>
              </div>
            );
          })}
          {!scenarios.length && !loading
            ? <p style={{ fontSize: 12.5, color: 'var(--t-tertiary)' }}>暂无场景 —— 用上方播种器为品类生成初始场景与选题</p>
            : null}
          {scenarios.length > 40
            ? <p style={{ fontSize: 11, color: 'var(--t-tertiary)' }}>仅显示前 40 个（共 {scenarios.length} 个）</p>
            : null}
        </div>
      </div>
    </section>
  );
}
