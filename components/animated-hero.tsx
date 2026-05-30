'use client';

/**
 * AnimatedHero — homepage 首屏动态英雄区
 *
 * 三层结构 (Rheem × Tandem 风):
 *   1. 标题层    · "事半功倍 · 拿捏老板." 双关 slogan + 微光底纹动画
 *   2. 双引擎层  · SVG 同心圆环 + 流动光点 (事半 / 拿捏 双轨)
 *   3. 播报层    · 公司大事记 ticker (5s 自动轮播 + fade-slide)
 *   4. 实时层    · 议事 / KR / 日报 / 共识时长 4 个脉冲数据条
 *
 * 不写入 SSR (use client). 数据通过 props 注入, 由 HomePage 传递,
 * 这样可以读到 /api/dashboard 已有的 stats, 不需要额外 fetch.
 */

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone,
  Sparkles,
  Target,
  Clock3,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';

interface BroadcastItem {
  id: string;
  category: '大事记' | '公告' | '政策' | '福利';
  title: string;
  href: string;
  /** Tailwind text color for the category chip */
  chipClass: string;
}

/**
 * V1 fallback — 与 /intranet HERO_SLIDES 保持文案一致.
 * 后续接 /api/intranet/hero 后从 props 注入即可.
 */
const DEFAULT_BROADCASTS: BroadcastItem[] = [
  {
    id: 'h1',
    category: '大事记',
    title: 'Tandem 议事室上线 100 天 — 平均共识时长 19.2 分钟',
    href: '/intranet/posts/h1',
    chipClass: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'h2',
    category: '公告',
    title: '2026 年度公司 O · 让 70% 的决议在 17 分钟内达成共识',
    href: '/intranet/posts/h2',
    chipClass: 'bg-brand-50 text-[rgb(var(--brand-700))]',
  },
  {
    id: 'h3',
    category: '福利',
    title: '春季体检报名开放 · 8 家定点医院, 配偶可享同等权益',
    href: '/intranet/posts/h3',
    chipClass: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'h4',
    category: '政策',
    title: 'AI 使用红线 v2.1 · 涉客户数据需经 Steward 批准',
    href: '/intranet/posts/h4',
    chipClass: 'bg-rose-100 text-rose-800',
  },
];

export interface AnimatedHeroProps {
  greeting: string;
  dateStr: string;
  weekday: string;
  /**
   * Live counters fed in from HomePage's /api/dashboard payload.
   * Pass `null` while loading so the component shows "—" placeholders.
   */
  liveStats: {
    activeConvergence: number | null;  // 进行中议事
    krOnTrack: number | null;          // KR 在轨数 (e.g. 12/15)
    krTotal: number | null;
    pendingReports: number | null;     // 待写日报
    avgConsensusMin: number | null;    // 平均共识时长 min
  };
  broadcasts?: BroadcastItem[];
  /**
   * Compact half-width layout: single column, no right-side DualEngineGlyph,
   * stats strip becomes 2-column. Used when Hero sits next to Launchpad.
   */
  compact?: boolean;
}

/**
 * Slogan rotation — kinetic "double-pun" cycle.
 * Every 4s the title swaps among 3 brand-aligned variants, each rendered
 * with the same red/black accent split. Fade-in via `animate-hero-ticker-in`.
 */
const SLOGAN_VARIANTS: Array<Array<{ text: string; accent: boolean }>> = [
  [
    { text: '事半', accent: true },
    { text: '功倍', accent: false },
    { text: '拿捏', accent: true },
    { text: '老板', accent: false },
  ],
  [
    { text: '一拍', accent: true },
    { text: '即合', accent: false },
    { text: '17min', accent: true },
    { text: '共识', accent: false },
  ],
  [
    { text: '牛马', accent: true },
    { text: '搭子', accent: false },
    { text: '拿捏', accent: true },
    { text: '未来', accent: false },
  ],
];

export function AnimatedHero({
  greeting,
  dateStr,
  weekday,
  liveStats,
  broadcasts = DEFAULT_BROADCASTS,
  compact = false,
}: AnimatedHeroProps) {
  // -------- Broadcast ticker (5s rotation) --------
  const [tickerIdx, setTickerIdx] = useState(0);
  useEffect(() => {
    if (broadcasts.length <= 1) return;
    const id = setInterval(() => {
      setTickerIdx((i) => (i + 1) % broadcasts.length);
    }, 5000);
    return () => clearInterval(id);
  }, [broadcasts.length]);
  const current = broadcasts[tickerIdx];

  // -------- Slogan rotation (4s, slightly offset from ticker so they're not in sync) --------
  const [sloganIdx, setSloganIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setSloganIdx((i) => (i + 1) % SLOGAN_VARIANTS.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);
  const slogan = SLOGAN_VARIANTS[sloganIdx];

  const krLabel = useMemo(() => {
    if (liveStats.krTotal == null || liveStats.krOnTrack == null) return '—';
    return `${liveStats.krOnTrack}/${liveStats.krTotal}`;
  }, [liveStats.krOnTrack, liveStats.krTotal]);

  return (
    <header className="animate-fade-in-up relative overflow-hidden rounded-2xl border border-border bg-[rgb(var(--surface-1))] shadow-soft-sm">
      {/* Ambient gradient + shimmer behind the slogan */}
      <div className="pointer-events-none absolute inset-0">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-[rgb(var(--brand-50))] via-transparent to-amber-50/40"
        />
        <div
          aria-hidden
          className="absolute inset-y-0 -left-1/4 w-1/2 animate-hero-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent blur-2xl"
        />
      </div>

      <div
        className={
          compact
            ? 'relative px-6 py-7 md:px-8 md:py-8'
            : 'relative grid gap-6 px-6 py-8 md:grid-cols-[1fr_auto] md:items-center md:px-10 md:py-10'
        }
      >
        {/* ───── Left: greeting + slogan + ticker ───── */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-caption text-ink-tertiary">
            <span>
              {dateStr} · {weekday} · {greeting}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 animate-hero-pulse-ring" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
          </div>

          {/* Slogan — rotating kinetic title (3 variants × 4s) */}
          <h1
            className="rheem-display mt-3 leading-[0.95]"
            aria-label="Tandem · 拿捏"
          >
            <span
              key={sloganIdx}
              className={
                'animate-hero-ticker-in block tracking-[-0.04em] ' +
                (compact
                  ? 'text-[clamp(28px,4.4vw,52px)]'
                  : 'text-[clamp(36px,6vw,72px)]')
              }
            >
              <span className="rheem-display-accent">{slogan[0].text}</span>
              <span className="text-[rgb(var(--rheem-ink-black))]">{slogan[1].text}</span>
              <span className="mx-2 align-middle text-[0.4em] font-bold text-[rgb(var(--brand-500))]">
                ·
              </span>
              <span className="rheem-display-accent">{slogan[2].text}</span>
              <span className="text-[rgb(var(--rheem-ink-black))]">{slogan[3].text}</span>
              <span className="text-[rgb(var(--brand-500))]">.</span>
            </span>
          </h1>

          <p className="mt-2.5 max-w-xl text-body text-ink-secondary">
            牛马搭子 · AI 智能工作台 ——{' '}
            <span className="font-semibold text-[rgb(var(--brand-700))]">17 分钟</span>{' '}
            达成共识, 让 OKR、议事、日报、1on1 全部进入{' '}
            <span className="font-semibold text-[rgb(var(--rheem-ink-black))]">事半功倍</span>{' '}
            的协作闭环.
          </p>

          {/* ───── Broadcast ticker ───── */}
          <Link
            href={current.href}
            className="group mt-5 flex items-center gap-3 rounded-xl border border-border bg-white/70 px-4 py-3 backdrop-blur-sm hover:border-[rgb(var(--brand-300))] hover:bg-white surface-interactive shadow-soft-sm"
            aria-label={`公司播报 · ${current.title}`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--brand-500))] text-white">
              <Megaphone className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-footnote text-ink-tertiary">
                <span>公司播报</span>
                <span className="text-ink-tertiary/60">·</span>
                <span>{tickerIdx + 1} / {broadcasts.length}</span>
              </div>
              {/* keyed div forces a remount each rotation → re-fires fade-in */}
              <div
                key={current.id}
                className="animate-hero-ticker-in flex items-center gap-2 mt-0.5"
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${current.chipClass}`}
                >
                  {current.category}
                </span>
                <p className="truncate text-caption font-medium text-ink-primary group-hover:text-[rgb(var(--brand-700))]">
                  {current.title}
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-tertiary group-hover:translate-x-0.5 group-hover:text-[rgb(var(--brand-600))] transition-transform" />
          </Link>

          {/* Pip indicators — show position in rotation, click to jump */}
          {broadcasts.length > 1 && (
            <div className="mt-2 flex items-center gap-1.5">
              {broadcasts.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`跳到播报 ${i + 1}`}
                  onClick={() => setTickerIdx(i)}
                  className={
                    'h-1 rounded-full transition-all ' +
                    (i === tickerIdx
                      ? 'w-6 bg-[rgb(var(--brand-500))]'
                      : 'w-1.5 bg-ink-tertiary/30 hover:bg-ink-tertiary/60')
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* ───── Right: animated dual-engine SVG (only when wide) ───── */}
        {!compact && (
          <div className="hidden md:block shrink-0">
            <DualEngineGlyph />
          </div>
        )}
      </div>

      {/* ───── Live pulse stats strip (compact: 2 col always) ───── */}
      <div
        className={
          'relative grid divide-x divide-border border-t border-border bg-[rgb(var(--surface-2))] ' +
          (compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4')
        }
      >
        <PulseStat
          icon={Sparkles}
          label="议事进行中"
          value={liveStats.activeConvergence}
          tone="brand"
          href="/convergence"
        />
        <PulseStat
          icon={Target}
          label="KR 在轨"
          value={krLabel === '—' ? null : krLabel}
          tone="success"
          href="/okr/cascade"
        />
        <PulseStat
          icon={ClipboardCheck}
          label="待写日报"
          value={liveStats.pendingReports}
          tone="warning"
          href="/report"
        />
        <PulseStat
          icon={Clock3}
          label="平均共识"
          value={
            liveStats.avgConsensusMin != null
              ? `${liveStats.avgConsensusMin}min`
              : null
          }
          tone="info"
          href="/convergence"
        />
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 双引擎可视化 — 两组同心圆环, 内圈 (事半 · 红) 顺时针 + 外圈 (拿捏 · 黑) 逆时针,
 * 每条轨道上 3 个发光点跟随旋转.  纯 SVG + CSS 动画, 无 JS 计时.
 */
function DualEngineGlyph() {
  return (
    <div className="relative h-[180px] w-[180px]" aria-hidden>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="hero-glow-red" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--brand-500))" stopOpacity="0.35" />
            <stop offset="70%" stopColor="rgb(var(--brand-500))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-glow-ink" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--rheem-ink-black))" stopOpacity="0.3" />
            <stop offset="70%" stopColor="rgb(var(--rheem-ink-black))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft glow background */}
        <circle cx="100" cy="100" r="90" fill="url(#hero-glow-red)" />

        {/* Outer ring · 拿捏 · ink black, counter-clockwise */}
        <g className="animate-hero-orbit-rev">
          <circle
            cx="100"
            cy="100"
            r="78"
            fill="none"
            stroke="rgb(var(--rheem-ink-black))"
            strokeOpacity="0.18"
            strokeWidth="1.5"
            strokeDasharray="2 4"
          />
          <circle cx="178" cy="100" r="4" fill="rgb(var(--rheem-ink-black))" />
          <circle cx="61" cy="167.5" r="3" fill="rgb(var(--rheem-ink-black))" fillOpacity="0.7" />
          <circle cx="61" cy="32.5" r="2.5" fill="rgb(var(--rheem-ink-black))" fillOpacity="0.5" />
        </g>

        {/* Inner ring · 事半 · brand red, clockwise */}
        <g className="animate-hero-orbit">
          <circle
            cx="100"
            cy="100"
            r="54"
            fill="none"
            stroke="rgb(var(--brand-500))"
            strokeOpacity="0.5"
            strokeWidth="1.75"
          />
          <circle cx="154" cy="100" r="5" fill="rgb(var(--brand-500))" />
          <circle cx="73" cy="146.8" r="3.5" fill="rgb(var(--brand-500))" fillOpacity="0.75" />
          <circle cx="73" cy="53.2" r="3" fill="rgb(var(--brand-500))" fillOpacity="0.55" />
        </g>

        {/* Center · static red dot with breathing pulse rings */}
        <g>
          <circle
            cx="100"
            cy="100"
            r="14"
            fill="rgb(var(--brand-500))"
            fillOpacity="0.18"
            className="animate-pulse-soft"
          />
          <circle cx="100" cy="100" r="7" fill="rgb(var(--brand-500))" />
        </g>
      </svg>

      {/* Center label overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold tracking-widest text-[rgb(var(--rheem-ink-black))] shadow-soft-sm backdrop-blur-sm">
          TANDEM
        </div>
      </div>
    </div>
  );
}

interface PulseStatProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string | null;
  tone: 'brand' | 'success' | 'warning' | 'info';
  href: string;
}

function PulseStat({ icon: Icon, label, value, tone, href }: PulseStatProps) {
  const dotClass = {
    brand: 'bg-[rgb(var(--brand-500))]',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    info: 'bg-sky-500',
  }[tone];

  const iconClass = {
    brand: 'text-[rgb(var(--brand-600))]',
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    info: 'text-sky-600',
  }[tone];

  const display = value == null ? '—' : value;

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-5 py-3.5 hover:bg-[rgb(var(--surface-1))] transition-colors duration-fast"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full rounded-full ${dotClass} opacity-70 animate-hero-pulse-ring`}
        />
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`} />
      </span>
      <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-callout font-bold text-ink-primary tabular-nums">
            {display}
          </span>
          <span className="text-footnote text-ink-tertiary truncate">{label}</span>
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-ink-tertiary/60 opacity-0 group-hover:opacity-100 group-hover:text-[rgb(var(--brand-600))] transition-opacity" />
    </Link>
  );
}
