'use client';

/**
 * ArchiveTab · 实习日志
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md § 5.1
 * 设计语言: MANIFESTO §20 + docs/CHARTER-UI-V1.md
 *   - surface-card 包内容卡 (Notion-density)
 *   - text-title-3 / text-headline 节奏
 *   - Stage 配色仅在 timeline 节点用 TONE_TOKENS (SSOT 通道)
 */

import { Sparkles, TrendingUp, Shield, AlertCircle } from 'lucide-react';
import { STAGE_LIST, STAGE_META, TONE_TOKENS } from '@/lib/persona/stage-meta';
import type { Persona } from '@/lib/types/persona';

export interface ArchiveTabProps {
  persona: Persona;
}

export function ArchiveTab({ persona }: ArchiveTabProps) {
  const stageIdx = STAGE_LIST.findIndex((s) => s.stage === persona.stage);
  const currentMeta = STAGE_META[persona.stage];
  const currentTone = TONE_TOKENS[currentMeta.tone];

  return (
    <div className="space-y-4">
      {/* ===== 进阶轨迹 timeline ===== */}
      <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-headline text-primary">
            🎯 进阶轨迹 · 新手 → 拿手
          </h2>
          <span className="font-mono text-footnote text-tertiary">
            Lv.{currentMeta.level}/5
          </span>
        </header>

        {/* timeline 5 节点 */}
        <div
          role="list"
          aria-label="进阶轨迹"
          className="relative grid grid-cols-5 gap-1"
        >
          {/* 进度连线 (底色) */}
          <div
            className="pointer-events-none absolute left-[10%] right-[10%] top-5 h-0.5"
            style={{ background: 'rgb(var(--border-subtle))' }}
          />
          {/* 进度连线 (已完成) */}
          <div
            className={`pointer-events-none absolute left-[10%] top-5 h-0.5 ${currentTone.progressFill}`}
            style={{
              width: `${(stageIdx / 4) * 80}%`,
              transition: 'width var(--duration-base) var(--ease-emphasis)',
            }}
          />
          {STAGE_LIST.map((s, i) => {
            const reached = i <= stageIdx;
            const tone = TONE_TOKENS[s.tone];
            const isCurrent = i === stageIdx;
            return (
              <div
                key={s.stage}
                role="listitem"
                className="relative flex flex-col items-center gap-1.5"
                title={`${s.title} · ${s.duration}`}
              >
                <div
                  className={[
                    'relative z-10 flex h-10 w-10 items-center justify-center rounded-full text-headline ring-2',
                    reached
                      ? tone.nodeBg
                      : '',
                    isCurrent ? 'ring-4' : '',
                  ].join(' ')}
                  style={
                    reached
                      ? undefined
                      : {
                          background: 'rgb(var(--surface-1))',
                          color: 'rgb(var(--text-tertiary))',
                          boxShadow: '0 0 0 2px rgb(var(--border-subtle))',
                        }
                  }
                >
                  {s.emoji}
                </div>
                <p
                  className="text-center text-footnote font-semibold leading-tight"
                  style={{
                    color: reached
                      ? 'rgb(var(--text-primary))'
                      : 'rgb(var(--text-tertiary))',
                  }}
                >
                  {s.title}
                </p>
                <p
                  className="text-center font-mono text-[10px] leading-none"
                  style={{
                    color: reached
                      ? 'rgb(var(--text-secondary))'
                      : 'rgb(var(--text-tertiary))',
                  }}
                >
                  Lv.{s.level}
                </p>
              </div>
            );
          })}
        </div>

        {/* 当前阶段说明 (用 TONE_TOKENS, SSOT 通道允许) */}
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-caption ${currentTone.border} ${currentTone.bgSoft} ${currentTone.text}`}
        >
          <span className="font-semibold">当前: {currentMeta.title}</span>
          <span className="ml-1 opacity-80">— {currentMeta.blurb}</span>
        </div>
      </section>

      {/* 实习决议统计 */}
      <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
        <h2 className="mb-4 text-headline text-primary">
          📊 实习日志统计
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="累计决议"
            value={persona.decisionHistory.totalDecisions}
            icon={TrendingUp}
          />
          <Stat
            label="AI 协助"
            value={persona.decisionHistory.aiAssisted}
            icon={Sparkles}
          />
          <Stat
            label="否决率"
            value={`${(persona.decisionHistory.vetoRate * 100).toFixed(1)}%`}
            icon={Shield}
            alert={persona.decisionHistory.vetoRate > 0.2}
          />
        </div>
      </section>

      {/* 培养重点 */}
      {persona.growthAreas.length > 0 && (
        <section className="surface-card p-5 sm:p-6 shadow-soft-sm">
          <h2 className="mb-4 text-headline text-primary">
            🎯 培养重点 (IDP)
          </h2>
          <ul className="space-y-2">
            {persona.growthAreas.map((g) => (
              <li
                key={g.id}
                className="surface-card-soft flex items-start gap-2 p-3 text-body"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ color: 'rgb(var(--semantic-warning))' }}
                />
                <div>
                  <div className="font-medium text-primary">{g.category}</div>
                  <div className="text-caption text-secondary">
                    {g.description}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: string | number;
  icon: typeof Sparkles;
  alert?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={
        alert
          ? {
              borderColor: 'rgb(var(--semantic-warning) / 0.4)',
              background: 'rgb(var(--semantic-warning) / 0.08)',
            }
          : {
              borderColor: 'rgb(var(--border-subtle))',
              background: 'rgb(var(--surface-2))',
            }
      }
    >
      <div className="flex items-center gap-1.5 text-footnote text-tertiary">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-mono text-title-3 font-semibold text-primary">
        {value}
      </div>
    </div>
  );
}
