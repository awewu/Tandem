'use client';

/**
 * 养料仪表盘 (B2 数据透明)
 * 透明展示分身从哪些真实数据学习 + 一键暂停/恢复学习 (learningActive opt-out)
 * 数据源: GET /api/persona/[userId]/training-context (真实聚合)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Database, ArrowLeft, Loader2, AlertTriangle, CheckSquare, Target,
  BookOpen, ShieldOff, ShieldCheck, Gauge,
} from 'lucide-react';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';

interface TrainingContext {
  source: 'real' | 'empty';
  reason?: string;
  totals: { checkIns: number; ttis: number; memories: number };
  recentCheckIns: Array<{ id: string; krTitle: string; achievements: string | null; createdAt: string }>;
  recentTtis: Array<{ id: string; title: string }>;
  memoryReferences: Array<{ id: string; type: string; title: string }>;
  styleProfile: { decisionSpeed?: string; riskAppetite?: number; communicationStyle?: string } | null;
  stage: string | null;
  bossCaptureScore: number;
}

export default function DataSourcePage() {
  const userId = useCurrentUserId();
  const [ctx, setCtx] = useState<TrainingContext | null>(null);
  const [learningActive, setLearningActive] = useState<boolean | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetch(`/api/persona/${encodeURIComponent(userId)}/training-context`, { credentials: 'include', cache: 'no-store' }),
      fetch(`/api/persona/${encodeURIComponent(userId)}`, { credentials: 'include', cache: 'no-store' }),
    ])
      .then(async ([ctxRes, pRes]) => {
        if (ctxRes.ok) setCtx(await ctxRes.json());
        if (pRes.ok) {
          const j = await pRes.json();
          setLearningActive(j.persona?.learningActive ?? true);
        }
        setStatus('ok');
      })
      .catch(() => setStatus('error'));
  }, [userId]);

  async function toggleLearning() {
    if (!userId || learningActive === null) return;
    setToggling(true);
    const next = !learningActive;
    try {
      const res = await fetch(`/api/persona/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learningActive: next }),
      });
      if (res.ok) setLearningActive(next);
    } catch {
      /* fail-soft */
    } finally {
      setToggling(false);
    }
  }

  return (
    <main className="container mx-auto max-w-2xl px-4 py-6 space-y-5">
      <Link href="/persona" className="inline-flex items-center gap-1 text-caption text-ink-secondary hover:text-ink-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回分身主页
      </Link>

      <div className="hero-ink p-5 sm:p-7 space-y-1">
        <h1 className="text-title-3 font-bold text-white flex items-center gap-2">
          <Database className="h-5 w-5" style={{ color: 'rgb(var(--brand-300))' }} />
          养料仪表盘
        </h1>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
          透明展示分身从你哪些真实数据学习 · 随时可暂停
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16 text-ink-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载养料…
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-2xl border border-warning bg-warning/5 px-4 py-3 text-caption text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> 加载失败，请刷新重试
        </div>
      )}

      {status === 'ok' && (
        <>
          {/* opt-out 开关 */}
          {learningActive !== null && (
            <div className="surface-card flex items-center justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${learningActive ? 'bg-success/10 text-success' : 'bg-surface-2 text-ink-secondary'}`}>
                  {learningActive ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-caption font-medium text-ink-primary">
                    {learningActive ? '分身学习已开启' : '分身学习已暂停'}
                  </p>
                  <p className="text-footnote text-ink-tertiary">
                    {learningActive
                      ? '分身持续从你的真实工作数据学习你的风格'
                      : '已暂停 · 分身不再吸收新养料（数据可携权与遗忘权）'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={toggling}
                onClick={toggleLearning}
                className={`shrink-0 rounded-md px-4 py-1.5 text-caption font-medium transition disabled:opacity-50 ${
                  learningActive
                    ? 'border border-hairline text-ink-secondary hover:bg-surface-2'
                    : 'bg-brand-600 text-white hover:bg-brand-700'
                }`}
              >
                {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : learningActive ? '暂停学习' : '恢复学习'}
              </button>
            </div>
          )}

          {ctx?.source === 'empty' && (
            <div className="surface-card p-10 text-center space-y-2">
              <Database className="mx-auto h-10 w-10 text-ink-tertiary" />
              <p className="text-caption text-ink-secondary">养料尚不足</p>
              <p className="text-footnote text-ink-tertiary max-w-xs mx-auto">{ctx.reason ?? '建议先写日报或填 TTI，分身才有真实养料可学。'}</p>
            </div>
          )}

          {ctx && ctx.source === 'real' && (
            <>
              {/* 总览 */}
              <div className="surface-card p-4 space-y-3">
                <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-brand-500" /> 学习总览
                </h2>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-title-3 font-bold text-ink-primary font-mono">{ctx.totals.checkIns}</p>
                    <p className="text-footnote text-ink-tertiary">日报 check-in</p>
                  </div>
                  <div>
                    <p className="text-title-3 font-bold text-ink-primary font-mono">{ctx.totals.ttis}</p>
                    <p className="text-footnote text-ink-tertiary">TTI 填报</p>
                  </div>
                  <div>
                    <p className="text-title-3 font-bold text-ink-primary font-mono">{ctx.totals.memories}</p>
                    <p className="text-footnote text-ink-tertiary">个人 Memory</p>
                  </div>
                </div>
                {ctx.styleProfile && (
                  <div className="border-t border-hairline pt-2 text-footnote text-ink-tertiary space-y-0.5">
                    {ctx.styleProfile.decisionSpeed && <div>决策速度: <span className="font-mono text-ink-secondary">{ctx.styleProfile.decisionSpeed}</span></div>}
                    {typeof ctx.styleProfile.riskAppetite === 'number' && <div>风险偏好: <span className="font-mono text-ink-secondary">{ctx.styleProfile.riskAppetite.toFixed(2)}</span></div>}
                    {ctx.styleProfile.communicationStyle && <div>沟通风格: <span className="font-mono text-ink-secondary">{ctx.styleProfile.communicationStyle}</span></div>}
                  </div>
                )}
              </div>

              {/* check-ins */}
              {ctx.recentCheckIns.length > 0 && (
                <div className="surface-card p-4 space-y-2">
                  <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-2">
                    <CheckSquare className="h-4 w-4 text-success" /> 日报养料 ({ctx.recentCheckIns.length})
                  </h2>
                  <ul className="divide-y divide-hairline">
                    {ctx.recentCheckIns.map((c) => (
                      <li key={c.id} className="py-2 text-footnote">
                        <p className="font-medium text-ink-primary">{c.krTitle}</p>
                        {c.achievements && <p className="text-ink-tertiary line-clamp-1">{c.achievements}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* TTI */}
              {ctx.recentTtis.length > 0 && (
                <div className="surface-card p-4 space-y-2">
                  <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-2">
                    <Target className="h-4 w-4 text-brand-500" /> TTI 养料 ({ctx.recentTtis.length})
                  </h2>
                  <ul className="space-y-1 text-footnote text-ink-secondary">
                    {ctx.recentTtis.map((t) => <li key={t.id} className="truncate">· {t.title}</li>)}
                  </ul>
                </div>
              )}

              {/* Memory */}
              {ctx.memoryReferences.length > 0 && (
                <div className="surface-card p-4 space-y-2">
                  <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-brand-500" /> 个人 Memory 养料 ({ctx.memoryReferences.length})
                  </h2>
                  <ul className="space-y-1 text-footnote text-ink-secondary">
                    {ctx.memoryReferences.map((m) => (
                      <li key={m.id} className="truncate">
                        <span className="mr-1.5 rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-tertiary">{m.type}</span>
                        {m.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
