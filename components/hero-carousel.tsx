'use client';

/**
 * HeroCarousel — full-bleed rotating banner with prev/next + dots.
 *
 * Originally inlined in `/intranet`. Promoted to a shared component so the
 * homepage can drop in the same affordance next to the Launchpad column.
 *
 * Slides are pure props — caller provides title / eyebrow / gradient / href.
 * Default 4 brand-aligned slides exported as `DEFAULT_HOME_SLIDES`.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlide {
  id: string;
  category: 'milestone' | 'announcement' | 'welfare' | 'policy';
  eyebrow: string;
  title: string;
  /** Tailwind gradient classes, e.g. 'from-brand-600 via-brand-500 to-amber-400' */
  bgGradient: string;
  href: string;
}

export interface HeroCarouselProps {
  slides: HeroSlide[];
  /** Auto-advance interval (ms). 0 disables auto-advance. */
  intervalMs?: number;
  /** Slide height. Defaults to a responsive 280–320px. */
  heightClass?: string;
  className?: string;
}

export function HeroCarousel({
  slides,
  intervalMs = 6000,
  heightClass = 'h-[280px] sm:h-[320px]',
  className = '',
}: HeroCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = slides.length;

  useEffect(() => {
    if (paused || intervalMs <= 0 || n <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), intervalMs);
    return () => clearInterval(t);
  }, [paused, intervalMs, n]);

  if (n === 0) return null;
  const slide = slides[idx];

  return (
    <section
      className={`relative rounded-2xl overflow-hidden shadow-soft-md ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <Link href={slide.href} className="block group">
        <div
          className={`relative ${heightClass} bg-gradient-to-br ${slide.bgGradient}`}
        >
          {/* subtle dot pattern */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-15 bg-[radial-gradient(circle_at_20%_20%,white_1px,transparent_1px)] [background-size:24px_24px]"
          />
          {/* gradient overlay for legibility */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 via-black/20 to-transparent"
          />

          <div className="relative h-full flex flex-col justify-end p-6 sm:p-8 text-white">
            <span className="text-footnote uppercase tracking-wider opacity-90">
              {slide.eyebrow}
            </span>
            <h2 className="mt-1.5 text-title-2 sm:text-title-1 font-bold leading-tight max-w-2xl group-hover:translate-x-0.5 transition-transform duration-fast">
              {slide.title}
            </h2>
            <span className="mt-3 inline-flex items-center gap-1 text-caption opacity-90">
              查看详情 <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </Link>

      {/* prev / next */}
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + n) % n)}
            className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 hover:bg-black/45 text-white flex items-center justify-center transition-colors"
            aria-label="上一条"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % n)}
            className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/30 hover:bg-black/45 text-white flex items-center justify-center transition-colors"
            aria-label="下一条"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* dots */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {slides.map((s, i) =>
              i === idx ? (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  className="h-1.5 w-6 rounded-full bg-white transition-all"
                  aria-label={`第 ${i + 1} 条`}
                  aria-current="true"
                />
              ) : (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIdx(i)}
                  className="h-1.5 w-1.5 rounded-full bg-white/50 hover:bg-white/80 transition-all"
                  aria-label={`第 ${i + 1} 条`}
                />
              ),
            )}
          </div>
        </>
      )}
    </section>
  );
}
