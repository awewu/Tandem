'use client';

import { useOKRStore } from '@/lib/store';
import { objectiveTrend, krTrend, trendToSVGPath, type TrendPoint } from '@/lib/okr/trend';

interface ObjectiveTrendProps {
  scope: 'objective';
  objectiveId: string;
  width?: number;
  height?: number;
}
interface KRTrendProps {
  scope: 'kr';
  krId: string;
  width?: number;
  height?: number;
}

type Props = ObjectiveTrendProps | KRTrendProps;

const CONF_COLOR = ['#dc2626', '#ca8a04', '#16a34a']; // off / at-risk / on-track

export function OKRTrendChart(props: Props) {
  const { width = 320, height = 120 } = props;
  const allKRs = useOKRStore((s) => s.keyResults);
  const checkIns = useOKRStore((s) => s.checkIns);

  let points: TrendPoint[] = [];
  if (props.scope === 'objective') {
    const obj = useOKRStore.getState().objectives.find((o) => o.id === props.objectiveId);
    if (obj) points = objectiveTrend(obj, allKRs, checkIns);
  } else {
    const kr = allKRs.find((k) => k.id === props.krId);
    if (kr) points = krTrend(kr, checkIns);
  }

  if (points.length < 2) {
    return (
      <div
        className="border border-dashed rounded flex items-center justify-center text-footnote text-muted-foreground"
        style={{ width, height }}
      >
        {points.length === 0 ? '尚无 Check-in' : '至少需 2 次 Check-in 才能画趋势'}
      </div>
    );
  }

  const pad = 24;
  const innerW = width - pad * 2;
  const innerH = height - pad - 8;

  const progressPath = trendToSVGPath(points, innerW, innerH, 'progress');

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* 背景网格：50% / 70% 参考线 */}
      <line x1={pad} y1={pad + innerH * 0.5} x2={pad + innerW} y2={pad + innerH * 0.5} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.2} />
      <line x1={pad} y1={pad + innerH * 0.3} x2={pad + innerW} y2={pad + innerH * 0.3} stroke="#16a34a" strokeWidth={0.5} strokeDasharray="2 2" opacity={0.5} />
      <text x={pad + innerW + 2} y={pad + innerH * 0.3 + 3} fontSize={9} fill="#16a34a" opacity={0.8}>70</text>
      <text x={pad - 6} y={pad + 4} fontSize={9} fill="currentColor" textAnchor="end" opacity={0.5}>100</text>
      <text x={pad - 6} y={pad + innerH + 4} fontSize={9} fill="currentColor" textAnchor="end" opacity={0.5}>0</text>

      <g transform={`translate(${pad}, ${pad})`}>
        {/* 进度折线 */}
        <path d={progressPath} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        {/* 数据点（按信心着色） */}
        {points.map((p, i) => {
          const tMin = points[0].t;
          const tRange = Math.max(1, points[points.length - 1].t - tMin);
          const x = ((p.t - tMin) / tRange) * innerW;
          const y = innerH - (p.progress / 100) * innerH;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3.5} fill={CONF_COLOR[p.confidence]} stroke="white" strokeWidth={1} />
              <title>
                {new Date(p.t).toLocaleDateString('zh-CN')} · 进度 {p.progress}% · 信心 {p.confidenceLabel}
              </title>
            </g>
          );
        })}
      </g>

      {/* 时间轴标注：第一个和最后一个点 */}
      <text x={pad} y={height - 1} fontSize={9} fill="currentColor" opacity={0.5}>
        {new Date(points[0].t).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
      </text>
      <text x={pad + innerW} y={height - 1} fontSize={9} fill="currentColor" opacity={0.5} textAnchor="end">
        {new Date(points[points.length - 1].t).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
      </text>
    </svg>
  );
}
