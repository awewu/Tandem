'use client';

/**
 * BrandLogo — switchable logo component.
 *
 * Resolves an SVG file from `/public/brand/{variant}-{theme}.svg` based on
 * props. Falls back to a minimal "T" tile when the requested asset is absent
 * (so the app keeps rendering before brand assets are dropped in).
 *
 * Drop SVGs into `public/brand/` (see public/brand/README.md for the matrix).
 *
 * Props:
 *   - variant: 'mark' | 'wordmark' | 'lockup'
 *   - theme:   'auto' | 'light' | 'dark' | 'brand'   (auto = follow .dark class)
 *   - size:    css length applied to width/height (mark) or height (wordmark/lockup)
 *
 * Theme switching: pass `theme="auto"` to track the current color scheme;
 * other values force a specific palette (useful when the surface bg is fixed,
 * e.g. AppRail is always charcoal regardless of light/dark mode).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export type LogoVariant = 'mark' | 'wordmark' | 'lockup';
export type LogoTheme = 'auto' | 'light' | 'dark' | 'brand';

export interface BrandLogoProps {
  variant?: LogoVariant;
  theme?: LogoTheme;
  /** CSS size — applied as height; width auto for wordmark/lockup. */
  size?: number | string;
  className?: string;
  /** Visually-hidden label for screen readers. */
  alt?: string;
}

/**
 * Probe `/brand/{file}` once and cache the result so we don't HEAD on every
 * render. A missing asset (404) flips fallback to the placeholder tile.
 *
 * resolvedCache: per-path 200/404 result.
 * winnerCache:   per-(variant,palette) the first hit URL, so subsequent mounts
 *                render the resolved <img> synchronously without T flash.
 */
const resolvedCache = new Map<string, boolean>();
const winnerCache = new Map<string, string | null>();

async function probeAsset(path: string): Promise<boolean> {
  if (resolvedCache.has(path)) return resolvedCache.get(path)!;
  try {
    const r = await fetch(path, { method: 'HEAD' });
    const ok = r.ok;
    resolvedCache.set(path, ok);
    return ok;
  } catch {
    resolvedCache.set(path, false);
    return false;
  }
}

function resolveTheme(theme: LogoTheme): 'light' | 'dark' | 'brand' {
  if (theme !== 'auto') return theme;
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function buildCandidates(variant: LogoVariant, palette: 'light' | 'dark' | 'brand'): string[] {
  // Variant/theme-specific files take priority; fall back to /brand/logo.{svg,png}
  // so users can drop one file and have it apply everywhere.
  return [
    `/brand/${variant}-${palette}.svg`,
    `/brand/${variant}-${palette}.png`,
    `/brand/${variant}-brand.svg`,
    `/brand/${variant}-brand.png`,
    `/brand/logo.svg`,
    `/brand/logo.png`,
  ];
}

export function BrandLogo({
  variant = 'mark',
  theme = 'auto',
  size = variant === 'mark' ? 36 : 28,
  className,
  alt = 'Tandem',
}: BrandLogoProps) {
  // Read winner cache synchronously on first render so subsequent mounts skip
  // the placeholder flash entirely.
  const initialKey =
    typeof document !== 'undefined' ? `${variant}:${resolveTheme(theme)}` : null;
  const initialWinner =
    initialKey && winnerCache.has(initialKey) ? winnerCache.get(initialKey)! : undefined;

  const [resolvedSrc, setResolvedSrc] = useState<string | null>(initialWinner ?? null);
  const [loadAttempted, setLoadAttempted] = useState(initialWinner !== undefined);

  useEffect(() => {
    const palette = resolveTheme(theme);
    const cacheKey = `${variant}:${palette}`;

    // Cache hit → render synchronously, no probe needed.
    if (winnerCache.has(cacheKey)) {
      setResolvedSrc(winnerCache.get(cacheKey)!);
      setLoadAttempted(true);
      return;
    }

    let cancelled = false;
    const candidates = buildCandidates(variant, palette);
    // Probe all candidates in parallel for speed; pick first hit by priority.
    (async () => {
      const results = await Promise.all(candidates.map(probeAsset));
      if (cancelled) return;
      const winnerIdx = results.findIndex((ok) => ok);
      const winner = winnerIdx >= 0 ? candidates[winnerIdx] : null;
      winnerCache.set(cacheKey, winner);
      setResolvedSrc(winner);
      setLoadAttempted(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [variant, theme]);

  // While probing on first render, render the placeholder synchronously so
  // there's no layout shift / flash.
  if (!loadAttempted || !resolvedSrc) {
    return <PlaceholderTile variant={variant} size={size} className={className} alt={alt} />;
  }

  const dim = typeof size === 'number' ? `${size}px` : size;
  return (
    // Using <img> on purpose: SVGs sit in /public, no Next/Image optimization
    // needed and we want the file to be swappable without a redeploy.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedSrc}
      alt={alt}
      className={cn('block select-none', className)}
      style={
        variant === 'mark'
          ? { width: dim, height: dim }
          : { height: dim, width: 'auto' }
      }
      draggable={false}
    />
  );
}

// ──────────── Placeholder ────────────

function PlaceholderTile({
  variant,
  size,
  className,
  alt,
}: {
  variant: LogoVariant;
  size: number | string;
  className?: string;
  alt: string;
}) {
  const dim = typeof size === 'number' ? `${size}px` : size;
  if (variant === 'mark') {
    return (
      <span
        role="img"
        aria-label={alt}
        className={cn(
          'flex items-center justify-center rounded-md bg-[rgb(var(--brand-500))] font-bold tracking-tight text-white',
          className,
        )}
        style={{ width: dim, height: dim, fontSize: `calc(${dim} * 0.42)` }}
      >
        T
      </span>
    );
  }
  // wordmark / lockup placeholder: red wordmark in display font
  return (
    <span
      role="img"
      aria-label={alt}
      className={cn(
        'inline-flex items-center font-display font-extrabold tracking-tight text-[rgb(var(--brand-500))]',
        className,
      )}
      style={{ fontSize: dim, lineHeight: 1 }}
    >
      Tandem
      <span className="ml-0.5 text-[rgb(var(--brand-500))]">.</span>
    </span>
  );
}
