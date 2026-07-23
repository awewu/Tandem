'use client';

import type { FloorPlanData } from './FloorPlanCanvas';

export interface DrawingSheetProps {
  title?: string;
  projectId?: string;
  floorPlan?: FloorPlanData;
  scale?: number;
}

export default function DrawingSheet({
  title = 'HVAC 平面图',
  projectId = '未指定',
  floorPlan,
  scale = 1,
}: DrawingSheetProps) {
  const width = 297 * scale; // A4 landscape mm -> px
  const height = 210 * scale;
  const margin = 10 * scale;
  const titleBlockHeight = 24 * scale;

  const wallCount = floorPlan?.walls?.length ?? 0;
  const roomCount = floorPlan?.rooms?.length ?? 0;

  return (
    <svg width={width} height={height} className="border bg-white shadow">
      {/* 图框 */}
      <rect x={margin} y={margin} width={width - margin * 2} height={height - margin * 2} fill="none" stroke="#000" strokeWidth={1} />
      {/* 标题栏 */}
      <rect x={width - margin - 120 * scale} y={height - margin - titleBlockHeight} width={120 * scale} height={titleBlockHeight} fill="none" stroke="#000" strokeWidth={1} />
      <text x={width - margin - 116 * scale} y={height - margin - titleBlockHeight + 8 * scale} fontSize={4 * scale} fill="#000">
        {title}
      </text>
      <text x={width - margin - 116 * scale} y={height - margin - titleBlockHeight + 16 * scale} fontSize={3 * scale} fill="#000">
        项目: {projectId}
      </text>
      {/* 尺寸链占位 */}
      <line x1={margin + 20 * scale} y1={margin + 10 * scale} x2={margin + 80 * scale} y2={margin + 10 * scale} stroke="#000" strokeWidth={0.5} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
      <text x={margin + 46 * scale} y={margin + 8 * scale} fontSize={3 * scale} fill="#000" textAnchor="middle">
        尺寸链 6000mm
      </text>
      {/* 统计 */}
      <text x={margin + 4 * scale} y={height - margin - 4 * scale} fontSize={3 * scale} fill="#000">
        墙: {wallCount} 房间: {roomCount} 比例: 1:100
      </text>
      <defs>
        <marker id="arrow" markerWidth={4} markerHeight={4} refX={2} refY={2} orient="auto">
          <path d="M0,0 L4,2 L0,4 z" fill="#000" />
        </marker>
      </defs>
    </svg>
  );
}
