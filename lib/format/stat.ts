/**
 * Stat 数字格式化纯函数 — 给 components/ui/stat.tsx 用, 同时单测可达.
 *
 * 设计原则:
 * - integer: 整数, 千分位, 默认 0 位小数
 * - decimal: 小数, 千分位, 默认 1 位小数
 * - percent: value 期望 0-1, 输出 "12.3" + 后缀 "%", delta 输出 "+2.0pp"
 * - currency: 千分位 + 默认前缀 ¥, delta 输出带 +/− 符号
 * - 所有负号统一用 U+2212 (−), 不用 ASCII -
 */

export type StatFormat = 'integer' | 'decimal' | 'percent' | 'currency';

export interface FormattedStat {
  num: string;
  suffix: string;
}

const MINUS = '\u2212';

export function formatStatValue(
  value: number,
  format: StatFormat,
  precision: number,
  unit?: string,
): FormattedStat {
  if (format === 'percent') {
    return { num: (value * 100).toFixed(precision), suffix: '%' };
  }
  if (format === 'currency') {
    const num = value.toLocaleString('zh-CN', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    });
    return { num, suffix: unit ?? '¥' };
  }
  if (format === 'integer') {
    return { num: Math.round(value).toLocaleString('zh-CN'), suffix: unit ?? '' };
  }
  return {
    num: value.toLocaleString('zh-CN', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    }),
    suffix: unit ?? '',
  };
}

export function formatStatDelta(delta: number, format: StatFormat, precision: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? MINUS : '';
  const abs = Math.abs(delta);
  if (format === 'percent') return `${sign}${(abs * 100).toFixed(precision)}pp`;
  if (format === 'integer') return `${sign}${Math.round(abs).toLocaleString('zh-CN')}`;
  return `${sign}${abs.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

/**
 * 给定 (delta, invertTrend) 返回 trend 方向与是否 "好"
 *  - invertTrend=true 表示 "降低是好" (如事故数)
 */
export function deltaSemantic(
  delta: number | null | undefined,
  invertTrend: boolean,
): { dir: 'flat' | 'up' | 'down'; good: boolean } {
  if (delta == null || delta === 0) return { dir: 'flat', good: false };
  const dir = delta > 0 ? 'up' : 'down';
  const good = invertTrend ? dir === 'down' : dir === 'up';
  return { dir, good };
}
