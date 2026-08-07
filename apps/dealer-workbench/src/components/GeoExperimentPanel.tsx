'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { growthGeo } from '../lib/api';

/**
 * GEO 第 7 层 · 闭环实验面板
 * 探测(基线) → 缺口 → 补内容 → 复投 → 验证 lift。
 * 视觉重心 = lift：before→after 对比 + 结论色带，一眼看出"这内容让 AI 出现率涨没涨"。
 *
 * 设计：严格复用工作台设计系统（card-elevated / workbench-section-header / inset /
 * badge / btn / CSS 变量），不引入第二套视觉。
 */

type ExperimentStatus =
  | 'baseline' | 'content-linked' | 'verifying'
  | 'improved' | 'no-change' | 'regressed' | 'killed';

interface Experiment {
  id: string;
  brandSlug: string;
  question: string;
  hypothesis?: string | null;
  killCriteria?: string | null;
  status: ExperimentStatus;
  baselineCitedRate?: number | null;
  verifyCitedRate?: number | null;
  lift?: number | null;
  conclusion?: string | null;
  contentPublishedAt?: string | null;
  createdAt: string;
}

interface GeoQuestion { id: string; question: string; stage?: string }

const STATUS_META: Record<ExperimentStatus, { label: string; tone: string; bg: string }> = {
  baseline: { label: '基线已测', tone: 'var(--t-secondary)', bg: 'var(--surface-2)' },
  'content-linked': { label: '内容已补', tone: 'var(--warning)', bg: 'var(--warning-bg, #FFF7ED)' },
  verifying: { label: '复投中', tone: 'var(--brand)', bg: 'var(--brand-50)' },
  improved: { label: '已验证 · 有效', tone: 'var(--success)', bg: 'var(--success-bg, #F0FDF4)' },
  'no-change': { label: '已验证 · 无变化', tone: 'var(--t-secondary)', bg: 'var(--surface-2)' },
  regressed: { label: '已验证 · 下降', tone: 'var(--danger)', bg: 'var(--danger-bg, #FEF2F2)' },
  killed: { label: '已终止', tone: 'var(--t-tertiary)', bg: 'var(--surface-3)' },
};

const pct = (v?: number | null) => (v === null || v === undefined ? '—' : `${Math.round(v)}%`);
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—');

export function GeoExperimentPanel({ brandSlug = 'rheem' }: { brandSlug?: string }) {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [questions, setQuestions] = useState<GeoQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ questionId: '', hypothesis: '', killCriteria: '复投后 lift ≤ 0 则换内容策略' });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, qRes] = await Promise.all([
        growthGeo.experiments({ brandSlug }),
        growthGeo.questionSet({ brandSlug }),
      ]);
      setExperiments((expRes?.items || expRes || []) as Experiment[]);
      setQuestions(((qRes?.questions || []) as GeoQuestion[]).filter((q) => q.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载实验失败');
    } finally {
      setLoading(false);
    }
  }, [brandSlug]);

  useEffect(() => { load(); }, [load]);

  // 有 verifying / baseline(批次未完成) 时轮询回填 lift
  const hasPending = useMemo(
    () => experiments.some((e) => e.status === 'verifying' || (e.status === 'baseline' && e.baselineCitedRate === null)),
    [experiments],
  );
  useEffect(() => {
    if (!hasPending) return undefined;
    const t = setInterval(async () => {
      const pend = experiments.filter((e) => e.status === 'verifying' || (e.status === 'baseline' && e.baselineCitedRate === null));
      let changed = false;
      for (const e of pend) {
        try {
          const fresh = (await growthGeo.experiment(e.id)) as any;
          const fe = (fresh?.experiment || fresh) as Experiment;
          if (fe && (fe.status !== e.status || fe.lift !== e.lift || fe.baselineCitedRate !== e.baselineCitedRate)) changed = true;
        } catch { /* 忽略单次轮询错误 */ }
      }
      if (changed) load();
    }, 6000);
    return () => clearInterval(t);
  }, [hasPending, experiments, load]);

  const startExperiment = async () => {
    if (!form.questionId) { setError('请选择一个监测问题'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const q = questions.find((x) => x.id === form.questionId);
      await growthGeo.startExperiment({
        brandSlug,
        questionId: form.questionId,
        question: q?.question,
        hypothesis: form.hypothesis || undefined,
        killCriteria: form.killCriteria || undefined,
      });
      setNotice('实验已开启，基线探测进行中…');
      setShowForm(false);
      setForm({ questionId: '', hypothesis: '', killCriteria: '复投后 lift ≤ 0 则换内容策略' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '开启实验失败');
    } finally {
      setSubmitting(false);
    }
  };

  const linkContent = async (id: string) => {
    setBusyId(id);
    try {
      await growthGeo.linkExperimentContent(id, {});
      setNotice('已标记内容发布，可进行复投验证');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : '关联内容失败'); }
    finally { setBusyId(null); }
  };

  const verify = async (id: string) => {
    setBusyId(id);
    try {
      await growthGeo.verifyExperiment(id, {});
      setNotice('复投探测已排队，稍后自动回填 lift');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : '复投失败'); }
    finally { setBusyId(null); }
  };

  const summary = useMemo(() => {
    const total = experiments.length;
    const improved = experiments.filter((e) => e.status === 'improved').length;
    const verified = experiments.filter((e) => ['improved', 'no-change', 'regressed'].includes(e.status)).length;
    const avgLift = verified
      ? Math.round(experiments.filter((e) => e.lift !== null && e.lift !== undefined).reduce((s, e) => s + (e.lift || 0), 0) / Math.max(1, experiments.filter((e) => e.lift !== null && e.lift !== undefined).length))
      : 0;
    return { total, improved, verified, avgLift };
  }, [experiments]);

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">GEO 闭环实验 · 第 7 层</p>
          <h2 className="workbench-section-header__title">内容有没有用，用 lift 说话</h2>
          <p className="workbench-section-header__description">
            补内容前测一次基线，发布后复投再测一次，出现率之差（lift）即证明品牌建设是否有效。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" type="button" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
          </button>
          <button className="btn btn-brand btn-sm" type="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? <X size={14} /> : <Plus size={14} />}{showForm ? '取消' : '开启实验'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="inset" style={{ color: 'var(--danger)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
          <X size={16} />{error}
        </div>
      ) : null}
      {notice ? <div className="inset" style={{ color: 'var(--success)', fontSize: 13 }}>{notice}</div> : null}

      {/* 概览指标 */}
      <div className="g4" style={{ gap: 12 }}>
        <MiniStat icon={FlaskConical} label="实验总数" value={String(summary.total)} />
        <MiniStat icon={CheckCircle2} label="已验证" value={String(summary.verified)} />
        <MiniStat icon={TrendingUp} label="有效实验" value={String(summary.improved)} tone={summary.improved ? 'var(--success)' : undefined} />
        <MiniStat icon={Target} label="平均 lift" value={summary.avgLift > 0 ? `+${summary.avgLift}%` : `${summary.avgLift}%`} tone={summary.avgLift > 0 ? 'var(--success)' : summary.avgLift < 0 ? 'var(--danger)' : undefined} />
      </div>

      {/* 开启实验表单 */}
      {showForm ? (
        <div className="inset" style={{ display: 'grid', gap: 12, padding: 16 }}>
          <div style={{ display: 'grid', gap: 6 }}>
            <label className="t-label">监测问题</label>
            <div style={{ position: 'relative' }}>
              <select
                value={form.questionId}
                onChange={(e) => setForm((f) => ({ ...f, questionId: e.target.value }))}
                style={selectStyle}
              >
                <option value="">选择一个问题…</option>
                {questions.map((q) => <option key={q.id} value={q.id}>{q.question}</option>)}
              </select>
              <ChevronDown size={15} style={{ position: 'absolute', right: 12, top: 12, pointerEvents: 'none', color: 'var(--t-tertiary)' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label className="t-label">假设（补什么内容 → 期望提升）</label>
            <input
              value={form.hypothesis}
              onChange={(e) => setForm((f) => ({ ...f, hypothesis: e.target.value }))}
              placeholder="例：补一篇选型技术页，让 AI 推荐时提到我们"
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <label className="t-label">杀死准则（预注册，避免自我安慰）</label>
            <input
              value={form.killCriteria}
              onChange={(e) => setForm((f) => ({ ...f, killCriteria: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <button className="btn btn-brand btn-sm" type="button" onClick={startExperiment} disabled={submitting || !form.questionId}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}开启并跑基线探测
            </button>
          </div>
        </div>
      ) : null}

      {/* 实验卡片列表 */}
      <div style={{ display: 'grid', gap: 12 }}>
        {experiments.map((exp) => (
          <ExperimentCard
            key={exp.id}
            exp={exp}
            busy={busyId === exp.id}
            onLink={() => linkContent(exp.id)}
            onVerify={() => verify(exp.id)}
          />
        ))}
        {!experiments.length ? (
          <div className="inset" style={{ textAlign: 'center', padding: 32, color: 'var(--t-tertiary)' }}>
            {loading ? <Loader2 size={20} className="animate-spin" /> : (
              <>
                <FlaskConical size={28} style={{ color: 'var(--t-tertiary)', marginBottom: 8 }} />
                <p style={{ fontSize: 14 }}>还没有实验。选一个 AI 不推荐我们的问题，开启第一个闭环实验。</p>
              </>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ExperimentCard({ exp, busy, onLink, onVerify }: {
  exp: Experiment; busy: boolean; onLink: () => void; onVerify: () => void;
}) {
  const meta = STATUS_META[exp.status];
  const lift = exp.lift;
  const hasLift = lift !== null && lift !== undefined;
  const liftTone = !hasLift ? 'var(--t-tertiary)' : lift > 0 ? 'var(--success)' : lift < 0 ? 'var(--danger)' : 'var(--t-secondary)';
  const LiftIcon = !hasLift ? Minus : lift > 0 ? TrendingUp : lift < 0 ? TrendingDown : Minus;

  return (
    <article
      className="inset"
      style={{ padding: 0, overflow: 'hidden', display: 'grid', gridTemplateColumns: '4px 1fr', borderRadius: 'var(--r-lg, 12px)' }}
    >
      {/* 状态色带 */}
      <div style={{ background: meta.tone, opacity: 0.85 }} />
      <div style={{ padding: 16, display: 'grid', gap: 14 }}>
        {/* 头部 */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--t-strong)', lineHeight: 1.4 }}>{exp.question}</p>
            {exp.hypothesis ? <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--t-tertiary)' }}>假设：{exp.hypothesis}</p> : null}
          </div>
          <span className="badge" style={{ color: meta.tone, borderColor: meta.tone, background: meta.bg, whiteSpace: 'nowrap' }}>{meta.label}</span>
        </div>

        {/* before → lift → after 视觉对比 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 10, alignItems: 'center' }}>
          <RatePill label="基线" value={pct(exp.baselineCitedRate)} sub={fmtDate(exp.createdAt)} />
          <ArrowRight size={16} style={{ color: 'var(--t-tertiary)', justifySelf: 'center' }} />
          <div style={{ textAlign: 'center', padding: '8px 4px', background: hasLift ? meta.bg : 'transparent', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: liftTone }}>
              <LiftIcon size={18} />
              <span style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                {hasLift ? `${lift > 0 ? '+' : ''}${lift}` : '—'}
              </span>
              {hasLift ? <span style={{ fontSize: 13, color: liftTone, alignSelf: 'flex-end', marginBottom: 2 }}>pt</span> : null}
            </div>
            <div className="t-label" style={{ marginTop: 2 }}>lift</div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--t-tertiary)', justifySelf: 'center' }} />
          <RatePill label="复投" value={pct(exp.verifyCitedRate)} sub={exp.contentPublishedAt ? `补内容 ${fmtDate(exp.contentPublishedAt)}` : '待补内容'} />
        </div>

        {/* 结论 */}
        {exp.conclusion ? (
          <p style={{ fontSize: 13, color: 'var(--t-secondary)', padding: '8px 12px', background: meta.bg, borderRadius: 8, lineHeight: 1.6 }}>
            {exp.conclusion}
          </p>
        ) : null}

        {/* 下一步操作 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {exp.status === 'baseline' ? (
            <button className="btn btn-brand btn-sm" type="button" onClick={onLink} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}已补内容 · 标记发布
            </button>
          ) : null}
          {exp.status === 'content-linked' ? (
            <button className="btn btn-brand btn-sm" type="button" onClick={onVerify} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}复投验证
            </button>
          ) : null}
          {exp.status === 'verifying' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--brand)' }}>
              <Loader2 size={14} className="animate-spin" />复投探测进行中，稍后自动回填 lift
            </span>
          ) : null}
          {exp.killCriteria ? (
            <span style={{ fontSize: 12, color: 'var(--t-tertiary)', marginLeft: 'auto' }}>杀死准则：{exp.killCriteria}</span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RatePill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="t-label">{label}出现率</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--t-tertiary)', marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <article className="inset" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="t-label">{label}</span>
        <Icon size={15} style={{ color: tone || 'var(--brand)' }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 800, color: tone || 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </article>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--surface-3)',
  background: 'var(--surface-1)', color: 'var(--t-strong)', fontSize: 14, outline: 'none',
};
const selectStyle: React.CSSProperties = { ...inputStyle, appearance: 'none', paddingRight: 34, cursor: 'pointer' };
