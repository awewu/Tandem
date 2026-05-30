'use client';

/**
 * StudentCard · 学员证 (Academy Hero)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 * 设计语言: MANIFESTO §20 + docs/CHARTER-UI-V1.md
 *   - Hero 走 .hero-ink (深底 ink-black + brand 径向光)
 *   - 标题 .text-title-2 (28px), Apple HIG 大留白
 *   - 阴影 .shadow-soft-lg (Apple soft, 非 Material)
 *   - 颜色: 不直用 raw Tailwind, 全部走 CSS var / TONE_TOKENS (stage 专属通道)
 *
 * 单分身一致性铁律 (MANIFESTO §13.2):
 *   切换主修 = 同一学员披不同专业外套, 不切实体.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Sparkles } from 'lucide-react';
import {
  SKILL_MODE_LIST,
  isSkillMode,
  type SkillMode,
} from '@/lib/persona/skill-modes';
import {
  getMockProficiencies,
  proficiencyToStars,
} from '@/lib/persona/maturity';
import { STAGE_META, daysInStage } from '@/lib/persona/stage-meta';
import type { Persona } from '@/lib/types/persona';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StudentCardProps {
  persona: Persona;
  studentName?: string;
  isDemo?: boolean;
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function StudentCard({
  persona,
  studentName = '我',
  isDemo,
}: StudentCardProps) {
  const router = useRouter();
  const params = useSearchParams();
  const modeParam = params.get('mode');
  const currentMode: SkillMode | null = isSkillMode(modeParam)
    ? modeParam
    : null;

  // C7 真扭转: 优先读 persona.modeProficiency (closure 累加), 没记录的主修 fallback mock
  const mockProf = getMockProficiencies();
  const realProf = persona.modeProficiency ?? {};
  const proficiencies = {
    design: realProf.design ?? mockProf.design,
    pm: realProf.pm ?? mockProf.pm,
    tech: realProf.tech ?? mockProf.tech,
    marketing: realProf.marketing ?? mockProf.marketing,
    strategy: realProf.strategy ?? mockProf.strategy,
  };
  const meta = STAGE_META[persona.stage];
  const days = daysInStage(persona.stageEnteredAt);
  const studentNo = `2026-${persona.id.slice(-6).toUpperCase()}`;
  const gpaPct = Math.max(2, Math.min(100, persona.bossCaptureScore));

  function switchMode(mode: SkillMode | null): void {
    const next = new URLSearchParams(params.toString());
    if (mode) next.set('mode', mode);
    else next.delete('mode');
    router.replace(`/persona${next.toString() ? `?${next}` : ''}`, {
      scroll: false,
    });
  }

  return (
    <section className="hero-ink p-6 sm:p-8">
      {/* ===== 顶部主信息行 ===== */}
      <header className="flex items-start gap-5">
        {/* Stage emoji 大块 (Hero accent) */}
        <div
          className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl text-4xl sm:text-5xl leading-none"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.16)',
          }}
        >
          {meta.emoji}
        </div>

        <div className="min-w-0 flex-1">
          {/* 名字 + demo 标 */}
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-title-2 inline-flex items-center gap-2 text-white">
              <Sparkles className="h-5 w-5" style={{ color: 'rgb(var(--brand-400))' }} />
              {studentName}的主分身
            </h1>
            {isDemo && (
              <span className="pill-on-dark">示范</span>
            )}
          </div>

          {/* Lv.X · 称谓 · 入学时长 */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span
              className="rounded-md px-2 py-0.5 font-mono text-footnote font-semibold tracking-wider"
              style={{
                background: 'rgb(var(--brand-500))',
                color: '#fff',
              }}
            >
              Lv.{meta.level}
            </span>
            <span className="text-headline text-white">{meta.title}</span>
            <span className="text-caption" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {meta.titleEn} · {meta.duration} · 已入学 {days} 天
            </span>
          </div>

          {/* blurb */}
          <p className="mt-2 text-body" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {meta.blurb}
          </p>
        </div>

        {/* 学籍号 (右上, 仅 sm+) */}
        <div className="hidden sm:flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-footnote" style={{ color: 'rgba(255,255,255,0.45)' }}>
            学籍号
          </span>
          <span className="font-mono text-caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
            #{studentNo}
          </span>
        </div>
      </header>

      {/* ===== 综合 GPA 进度条 ===== */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-caption" style={{ color: 'rgba(255,255,255,0.75)' }}>
            综合 GPA · 拿捏度
          </span>
          <span className="font-mono text-white">
            <span className="text-headline font-bold">
              {persona.bossCaptureScore}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>/100</span>
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${gpaPct}%`,
              background:
                'linear-gradient(90deg, rgb(var(--brand-500)) 0%, rgb(var(--brand-300)) 100%)',
              transition: 'width var(--duration-base) var(--ease-emphasis)',
            }}
          />
        </div>
      </div>

      {/* ===== 5 主修网格 ===== */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-headline text-white">📚 我的 5 个主修方向</h2>
          <p className="text-footnote" style={{ color: 'rgba(255,255,255,0.5)' }}>
            点击切换 · 单分身披外套
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <MajorChip
            active={currentMode === null}
            emoji="🤖"
            label="通用"
            score={null}
            onClick={() => switchMode(null)}
          />
          {SKILL_MODE_LIST.map((m) => (
            <MajorChip
              key={m.id}
              active={currentMode === m.id}
              emoji={m.emoji}
              label={m.label.replace('模式', '')}
              score={proficiencies[m.id]}
              onClick={() => switchMode(m.id)}
            />
          ))}
        </div>
      </div>

      {/* ===== 隐私微提示 ===== */}
      <p
        className="mt-5 flex items-center gap-1.5 text-footnote"
        style={{ color: 'rgba(255,255,255,0.5)' }}
      >
        <Lock className="h-3.5 w-3.5" />
        仅你可见 · Steward / 主管后台无权检索
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 主修 chip (深底版, surface-interactive 动效)
// ---------------------------------------------------------------------------

interface MajorChipProps {
  active: boolean;
  emoji: string;
  label: string;
  score: number | null | undefined;
  onClick: () => void;
}

function MajorChip({ active, emoji, label, score, onClick }: MajorChipProps) {
  const stars = typeof score === 'number' ? proficiencyToStars(score) : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-interactive flex flex-col items-center gap-1 rounded-xl p-2.5 text-caption"
      style={
        active
          ? {
              background: 'rgb(var(--brand-500))',
              color: '#fff',
              border: '1px solid rgb(var(--brand-400))',
              boxShadow: 'var(--shadow-glow-brand)',
            }
          : {
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.12)',
            }
      }
    >
      <span className="text-headline leading-none">{emoji}</span>
      <span className="font-medium leading-tight">{label}</span>
      {stars !== null ? (
        <span
          className="mt-0.5 font-mono text-[10px] leading-none"
          style={{ color: active ? '#FFD966' : 'rgb(var(--brand-300))' }}
        >
          {'★'.repeat(stars)}
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>
            {'☆'.repeat(5 - stars)}
          </span>
        </span>
      ) : (
        <span
          className="mt-0.5 text-[10px] leading-none"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          通识
        </span>
      )}
    </button>
  );
}
