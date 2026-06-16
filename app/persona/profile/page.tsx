'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ArrowLeft, Loader2, Brain, BarChart2, Zap } from 'lucide-react';
import type { Persona } from '@/lib/types/persona';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import { STAGE_META } from '@/lib/persona/stage-meta';

const COMM_LABEL: Record<string, string> = {
  analytical: '分析型',
  direct: '直接型',
  collaborative: '协作型',
  visionary: '愿景型',
};
const SPEED_LABEL: Record<string, string> = {
  fast: '快速决策',
  medium: '均衡考量',
  slow: '深思熟虑',
};

export default function ProfilePage() {
  const userId = useCurrentUserId();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/persona/${encodeURIComponent(userId)}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((j) => { setPersona(j.persona ?? null); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, [userId]);

  const stageMeta = persona ? STAGE_META[persona.stage] : null;

  return (
    <main className="container mx-auto max-w-2xl px-4 py-6 space-y-5">
      <Link href="/persona" className="inline-flex items-center gap-1 text-caption text-ink-secondary hover:text-ink-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> 返回分身主页
      </Link>

      <div className="hero-ink p-5 sm:p-7 space-y-1">
        <h1 className="text-title-3 font-bold text-white flex items-center gap-2">
          <Users className="h-5 w-5" style={{ color: 'rgb(var(--brand-300))' }} />
          个人档案
        </h1>
        <p className="text-caption" style={{ color: 'rgba(255,255,255,0.65)' }}>
          我是谁 · 标签 / 风格 / 偏好
        </p>
      </div>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-16 text-ink-secondary">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> 加载档案…
        </div>
      )}

      {status === 'error' && (
        <div className="surface-card p-6 text-center text-ink-secondary text-caption">
          加载失败，请刷新重试
        </div>
      )}

      {status === 'ok' && persona && (
        <>
          {/* 段位 */}
          <div className="surface-card p-4 flex items-center gap-4">
            <span className="text-display">{stageMeta?.emoji ?? '🥚'}</span>
            <div>
              <p className="text-caption font-semibold text-ink-primary">{stageMeta?.title ?? persona.stage}</p>
              <p className="text-footnote text-ink-tertiary">
                入段 {new Date(persona.stageEnteredAt).toLocaleDateString('zh-CN')} ·
                拿捏分 <span className="font-mono font-semibold text-brand-500">{persona.bossCaptureScore}</span>
              </p>
            </div>
          </div>

          {/* 工作风格 */}
          {persona.styleProfile && (
            <div className="surface-card p-4 space-y-3">
              <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-2">
                <Brain className="h-4 w-4 text-brand-500" /> 工作风格
              </h2>
              <div className="grid grid-cols-2 gap-3 text-footnote">
                <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
                  <p className="text-ink-tertiary">沟通风格</p>
                  <p className="font-medium text-ink-primary mt-0.5">
                    {COMM_LABEL[persona.styleProfile.communicationStyle] ?? persona.styleProfile.communicationStyle}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
                  <p className="text-ink-tertiary">决策节奏</p>
                  <p className="font-medium text-ink-primary mt-0.5">
                    {SPEED_LABEL[persona.styleProfile.decisionSpeed] ?? persona.styleProfile.decisionSpeed}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
                  <p className="text-ink-tertiary">风险偏好</p>
                  <p className="font-medium text-ink-primary mt-0.5">
                    {Math.round(persona.styleProfile.riskAppetite * 100)}%
                  </p>
                </div>
                <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
                  <p className="text-ink-tertiary">AI 自主度</p>
                  <p className="font-medium text-ink-primary mt-0.5">
                    {persona.delegationLevel}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 决策统计 */}
          <div className="surface-card p-4 space-y-3">
            <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-brand-500" /> 决策统计
            </h2>
            <div className="grid grid-cols-3 gap-3 text-center text-footnote">
              <div>
                <p className="text-title-3 font-bold text-ink-primary font-mono">{persona.decisionHistory.totalDecisions}</p>
                <p className="text-ink-tertiary">总决策</p>
              </div>
              <div>
                <p className="text-title-3 font-bold text-ink-primary font-mono">{persona.decisionHistory.aiAssisted}</p>
                <p className="text-ink-tertiary">AI 辅助</p>
              </div>
              <div>
                <p className="text-title-3 font-bold text-ink-primary font-mono">{Math.round(persona.decisionHistory.vetoRate * 100)}%</p>
                <p className="text-ink-tertiary">否决率</p>
              </div>
            </div>
          </div>

          {/* 成长方向 */}
          {persona.growthAreas.length > 0 && (
            <div className="surface-card p-4 space-y-3">
              <h2 className="text-caption font-semibold text-ink-primary flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-500" /> 成长方向
              </h2>
              <ul className="space-y-2">
                {persona.growthAreas.map((g) => (
                  <li key={g.id} className="flex items-start gap-2 text-footnote">
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                    <div>
                      <span className="font-medium text-ink-primary">{g.category}</span>
                      <span className="text-ink-tertiary"> — {g.description}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  );
}
