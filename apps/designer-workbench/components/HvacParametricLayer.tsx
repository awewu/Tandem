'use client';

import { useState } from 'react';

export interface PipeSegment {
  id: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  diameterMm: number; // 外径
  wallThicknessMm: number; // 壁厚
  insulationThicknessMm: number; // 保温厚度
  material: string; // 例如 'PPR', 'PEX', 'Copper'
  hasHanger: boolean; // 是否带吊杆
  hangerSpacingMm: number; // 吊杆间距
}

export interface HvacParametricLayerProps {
  segments?: PipeSegment[];
  onChange?: (segments: PipeSegment[]) => void;
  readonly?: boolean;
}

export default function HvacParametricLayer({ segments: initial = [], onChange, readonly }: HvacParametricLayerProps) {
  const [segments, setSegments] = useState<PipeSegment[]>(initial);
  const [draft, setDraft] = useState<Partial<PipeSegment>>({
    diameterMm: 25,
    wallThicknessMm: 2.3,
    insulationThicknessMm: 10,
    material: 'PPR',
    hasHanger: true,
    hangerSpacingMm: 800,
  });

  const update = (next: PipeSegment[]) => {
    setSegments(next);
    onChange?.(next);
  };

  const addSegment = () => {
    const segment: PipeSegment = {
      id: `p-${Date.now()}`,
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 0, z: 0 },
      diameterMm: draft.diameterMm ?? 25,
      wallThicknessMm: draft.wallThicknessMm ?? 2.3,
      insulationThicknessMm: draft.insulationThicknessMm ?? 10,
      material: draft.material ?? 'PPR',
      hasHanger: draft.hasHanger ?? true,
      hangerSpacingMm: draft.hangerSpacingMm ?? 800,
    };
    update([...segments, segment]);
  };

  const removeLast = () => {
    update(segments.slice(0, -1));
  };

  const totalLength = () =>
    segments.reduce((sum, s) => {
      const dx = s.end.x - s.start.x;
      const dy = s.end.y - s.start.y;
      const dz = s.end.z - s.start.z;
      return sum + Math.sqrt(dx * dx + dy * dy + dz * dz);
    }, 0) / 1000; // mm -> m

  return (
    <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded">
      <div className="text-sm font-semibold">HVAC 参数化管线层 v1</div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label>
          外径 (mm)
          <input
            type="number"
            value={draft.diameterMm}
            onChange={(e) => setDraft({ ...draft, diameterMm: Number(e.target.value) })}
            className="w-full border rounded px-1"
            disabled={readonly}
          />
        </label>
        <label>
          壁厚 (mm)
          <input
            type="number"
            value={draft.wallThicknessMm}
            onChange={(e) => setDraft({ ...draft, wallThicknessMm: Number(e.target.value) })}
            className="w-full border rounded px-1"
            disabled={readonly}
          />
        </label>
        <label>
          保温厚 (mm)
          <input
            type="number"
            value={draft.insulationThicknessMm}
            onChange={(e) => setDraft({ ...draft, insulationThicknessMm: Number(e.target.value) })}
            className="w-full border rounded px-1"
            disabled={readonly}
          />
        </label>
        <label>
          材质
          <select
            value={draft.material}
            onChange={(e) => setDraft({ ...draft, material: e.target.value })}
            className="w-full border rounded px-1"
            disabled={readonly}
          >
            <option>PPR</option>
            <option>PEX</option>
            <option>Copper</option>
            <option>Steel</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={draft.hasHanger}
            onChange={(e) => setDraft({ ...draft, hasHanger: e.target.checked })}
            disabled={readonly}
          />
          吊杆
        </label>
        <label>
          吊杆间距 (mm)
          <input
            type="number"
            value={draft.hangerSpacingMm}
            onChange={(e) => setDraft({ ...draft, hangerSpacingMm: Number(e.target.value) })}
            className="w-full border rounded px-1"
            disabled={readonly}
          />
        </label>
      </div>
      <div className="flex gap-2">
        <button onClick={addSegment} className="px-2 py-1 text-sm border rounded hover:bg-gray-200" disabled={readonly}>
          添加管段
        </button>
        <button onClick={removeLast} className="px-2 py-1 text-sm border rounded hover:bg-gray-200" disabled={readonly}>
          撤销
        </button>
      </div>
      <div className="text-sm text-gray-700">
        管段数: {segments.length} | 总长度: {totalLength().toFixed(2)} m
      </div>
      <div className="text-xs text-gray-500">
        TODO: 与 FloorPlanCanvas 墙/楼板吸附、3D 可视化、自动计算管长/辅材
      </div>
    </div>
  );
}
