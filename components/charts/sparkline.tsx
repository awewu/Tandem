/**
 * 轻量 SVG sparkline (无 recharts 依赖)
 *
 * 用法:
 *   <Sparkline points={[1,3,2,5,4,7]} width={160} height={32} />
 *   <Sparkline points={[…]} target={100} />  显示目标基准线
 */

'use client';

import { useMemo } from 'react';

interface SparklineProps {
  points: number[];
  width?: number;
  height?: number;
  /** 0-1 颜色调控: > 80% 健康 / 60-80 警戒 / < 60 风险. 不给则用默认蓝. */
  health?: 'green' | 'amber' | 'red';
  /** 目标基准线 (在数据 max-min 区间内绘制虚线) */
  target?: number;
  /** 鼠标 hover 显示完整数值 */
  showLastDot?: boolean;
  className?: string;
}

const COLOR_MAP: Record<string, { stroke: string; fill: string; dot: string }> = {
  green: { stroke: 'stroke-emerald-500', fill: 'fill-emerald-500/10', dot: 'fill-emerald-500' },
  amber: { stroke: 'stroke-amber-500', fill: 'fill-amber-500/10', dot: 'fill-amber-500' },
  red: { stroke: 'stroke-rose-500', fill: 'fill-rose-500/10', dot: 'fill-rose-500' },
  default: { stroke: 'stroke-sky-500', fill: 'fill-sky-500/10', dot: 'fill-sky-500' },
};

export function Sparkline({
  points,
  width = 120,
  height = 32,
  health,
  target,
  showLastDot = true,
  className,
}: SparklineProps) {
  const colors = COLOR_MAP[health ?? 'default'];

  const { path, area, lastX, lastY, targetY } = useMemo(() => {
    if (points.length === 0) {
      return { path: '', area: '', lastX: 0, lastY: 0, targetY: null as number | null };
    }
    const min = Math.min(...points, target ?? Infinity);
    const max = Math.max(...points, target ?? -Infinity);
    const range = max - min || 1;
    const padX = 2;
    const padY = 4;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const step = points.length > 1 ? innerW / (points.length - 1) : 0;
    const coords = points.map((v, i) => {
      const x = padX + step * i;
      const y = padY + innerH - ((v - min) / range) * innerH;
      return [x, y] as const;
    });
    const path = coords
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ');
    const area =
      coords.length > 0
        ? `${path} L${coords[coords.length - 1][0].toFixed(1)},${(padY + innerH).toFixed(
            1,
          )} L${coords[0][0].toFixed(1)},${(padY + innerH).toFixed(1)} Z`
        : '';
    const [lastX, lastY] = coords[coords.length - 1];
    const targetY =
      target !== undefined ? padY + innerH - ((target - min) / range) * innerH : null;
    return { path, area, lastX, lastY, targetY };
  }, [points, width, height, target]);

  if (points.length === 0) {
    return (
      <div
        className={`text-[10px] text-muted-foreground italic ${className ?? ''}`}
        style={{ width, height }}
      >
        无数据
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`sparkline ${points.length} points`}
    >
      <path d={area} className={colors.fill} stroke="none" />
      <path d={path} className={colors.stroke} fill="none" strokeWidth={1.5} />
      {targetY !== null && (
        <line
          x1={2}
          x2={width - 2}
          y1={targetY}
          y2={targetY}
          className="stroke-zinc-400"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      )}
      {showLastDot && (
        <circle cx={lastX} cy={lastY} r={2.5} className={colors.dot} stroke="white" strokeWidth={1} />
      )}
    </svg>
  );
}
