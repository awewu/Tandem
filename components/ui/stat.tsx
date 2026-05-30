'use client';

/**
 * Stat / NumberCell — Stripe-class 数字精确展示
 *
 * 三件套合一: 大字数字 + 单位 + delta 箭头 + 可选 sparkline.
 *
 * 设计原则:
 * - 数字用 tabular-nums (等宽数字, Stripe / 财务报表必备)
 * - 单位用 font-feature-settings 'cv01' 风的小写字 (尺寸是数字的 0.55x)
 * - delta 箭头 + 颜色 = 自动从 trend 推 (positive=success, negative=danger, flat=ink-tertiary)
 * - sparkline 默认 60×16, SVG path 走 brand 色, fill 0
 * - 全部走 charter §1.2 typography token, 不用 raw text-{xs,sm,...}
 *
 * 用法:
 *   <Stat label="本月 KR 完成度" value={0.72} format="percent" delta={0.05} sparkline={[...]} />
 *   <Stat label="决议产出" value={42} unit="条" delta={-3} hint="vs 上周" />
 */

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatStatValue,
  formatStatDelta,
  deltaSemantic,
  type StatFormat,
} from '@/lib/format/stat';

export type { StatFormat };

interface StatProps {
  /** 主标签 (如 "本月 KR 完成度") */
  label: string;
  /** 数值 (percent 模式期望 0-1, 其他模式按字面量) */
  value: number | null | undefined;
  /** 数字格式 */
  format?: StatFormat;
  /** 单位 (integer/decimal 模式; percent 模式忽略, currency 模式默认 ¥) */
  unit?: string;
  /** 小数位数 (decimal/percent/currency 默认 1, integer 默认 0) */
  precision?: number;
  /** 变化量 (与 value 同单位; percent 模式期望 0-1) */
  delta?: number | null;
  /** 提示文字 (放 delta 后, 比如 "vs 上周") */
  hint?: string;
  /** Sparkline 数据点 (推荐 7-30 点) */
  sparkline?: number[];
  /** Sparkline 高度, 默认 16px */
  sparklineHeight?: number;
  /** 主数字字号: 'sm' (display 标题旁) / 'md' 默认 / 'lg' (Hero) */
  size?: 'sm' | 'md' | 'lg';
  /** 强制 trend 颜色方向覆盖 (某些指标降低是好, 如 "事故数") */
  invertTrend?: boolean;
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<StatProps['size']>, string> = {
  sm: 'text-title-3',     // ~20px
  md: 'text-title-2',     // ~24px
  lg: 'text-display',     // ~36px
};

const UNIT_SIZE_CLASS: Record<NonNullable<StatProps['size']>, string> = {
  sm: 'text-caption',
  md: 'text-footnote',
  lg: 'text-body',
};

function Sparkline({ data, height = 16, color = 'currentColor' }: { data: number[]; height?: number; color?: string }) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const w = 60;
    const h = height;
    return data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - ((v - min) / range) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [data, height]);

  if (!path) return null;
  return (
    <svg
      viewBox={`0 0 60 ${height}`}
      width={60}
      height={height}
      role="img"
      aria-label="趋势"
      className="overflow-visible"
    >
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Stat({
  label,
  value,
  format = 'decimal',
  unit,
  precision,
  delta,
  hint,
  sparkline,
  sparklineHeight = 16,
  size = 'md',
  invertTrend = false,
  className,
}: StatProps) {
  const effPrecision = precision ?? (format === 'integer' ? 0 : 1);

  // 空值优雅降级
  const isEmpty = value == null || Number.isNaN(value);
  const { num, suffix } = isEmpty
    ? { num: '—', suffix: '' }
    : formatStatValue(value as number, format, effPrecision, unit);

  const { dir: deltaDir, good: semanticGood } = deltaSemantic(delta, invertTrend);
  const deltaColor =
    deltaDir === 'flat'
      ? 'text-ink-tertiary'
      : semanticGood
      ? 'text-success'
      : 'text-danger';
  const DeltaIcon = deltaDir === 'flat' ? Minus : deltaDir === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="text-caption text-ink-tertiary">{label}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('font-semibold tabular-nums tracking-tight text-ink-primary', SIZE_CLASS[size])}>
          {num}
        </span>
        {suffix && (
          <span className={cn('font-medium text-ink-secondary', UNIT_SIZE_CLASS[size])}>{suffix}</span>
        )}
        {sparkline && sparkline.length >= 2 && (
          <span className={cn('ml-1.5 text-[rgb(var(--brand-500))]')}>
            <Sparkline data={sparkline} height={sparklineHeight} />
          </span>
        )}
      </div>
      {(delta != null || hint) && (
        <div className="flex items-center gap-1.5 text-caption">
          {delta != null && (
            <span className={cn('inline-flex items-center gap-0.5 font-medium tabular-nums', deltaColor)}>
              <DeltaIcon className="h-3 w-3" aria-hidden="true" />
              {formatStatDelta(delta, format, effPrecision)}
            </span>
          )}
          {hint && <span className="text-ink-tertiary">{hint}</span>}
        </div>
      )}
    </div>
  );
}

export default Stat;
