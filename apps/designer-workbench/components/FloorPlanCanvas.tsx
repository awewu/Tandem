'use client';

import { useState, useCallback, useRef } from 'react';

export interface Wall {
  id: string;
  points: number[]; // [x1, y1, x2, y2] in cm
  thickness: number; // cm
}

export interface Room {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

export interface Pipe {
  id: string;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  diameterMm: number;
  wallThicknessMm: number;
  insulationThicknessMm: number;
  material: string;
  hasHanger: boolean;
  hangerSpacingMm: number;
}

export interface PlacedDevice {
  id: string;
  systemType: string;
  name: string;
  x: number;
  y: number;
  assetRef?: string;
}

export interface FloorPlanData {
  walls: Wall[];
  rooms: Room[];
  pipes?: Pipe[];
  devices?: PlacedDevice[];
  cadImageUrl?: string;
}

export interface FloorPlanCanvasProps {
  initialData?: FloorPlanData;
  onChange?: (data: FloorPlanData) => void;
  onPipeChange?: (pipes: Pipe[]) => void;
  onDeviceChange?: (devices: PlacedDevice[]) => void;
  readonly?: boolean;
  snapToWalls?: boolean;
}

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1200;

export default function FloorPlanCanvas({
  initialData,
  onChange,
  onPipeChange,
  onDeviceChange,
  readonly,
  snapToWalls = true,
}: FloorPlanCanvasProps) {
  const [data, setData] = useState<FloorPlanData>(initialData ?? { walls: [], rooms: [], pipes: [], devices: [] });
  const [cadImage, setCadImage] = useState<string | null>(initialData?.cadImageUrl ?? null);
  const [mode, setMode] = useState<'select' | 'wall' | 'room' | 'pipe' | 'device'>('select');
  const [drawing, setDrawing] = useState<number[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftPipe, setDraftPipe] = useState<{ diameterMm: number; material: string }>({ diameterMm: 25, material: 'PPR' });
  const [draftDevice, setDraftDevice] = useState<{ systemType: string; name: string; assetRef: string }>({
    systemType: 'freshAir',
    name: '新风机',
    assetRef: '',
  });

  const snapPoint = (x: number, y: number): number[] => {
    if (!snapToWalls || data.walls.length === 0) return [x, y];
    const threshold = 15; // cm
    let best: { x: number; y: number; dist: number } | null = null;
    for (const wall of data.walls) {
      const [x1, y1, x2, y2] = wall.points;
      // Project (x,y) onto wall segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const dist = Math.hypot(px - x, py - y);
      if (dist < threshold && (!best || dist < best.dist)) {
        best = { x: px, y: py, dist };
      }
    }
    return best ? [best.x, best.y] : [x, y];
  };

  const update = useCallback(
    (next: FloorPlanData) => {
      setData(next);
      onChange?.(next);
    },
    [onChange],
  );

  const handleCadUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCadImage(url);
    update({ ...data, cadImageUrl: url });
  };

  const getCanvasPoint = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (readonly) return;
    const pos = getCanvasPoint(e);
    if (mode === 'device') {
      const device: PlacedDevice = {
        id: `dev-${Date.now()}`,
        systemType: draftDevice.systemType,
        name: draftDevice.name,
        x: pos.x,
        y: pos.y,
        assetRef: draftDevice.assetRef || undefined,
      };
      const devices = [...(data.devices ?? []), device];
      update({ ...data, devices });
      onDeviceChange?.(devices);
      return;
    }
    if (mode !== 'wall' && mode !== 'pipe') return;
    const x = pos.x;
    const y = pos.y;
    const [sx, sy] = snapToWalls && mode === 'pipe' ? snapPoint(x, y) : [x, y];
    setDrawing([sx, sy, sx, sy]);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawing) return;
    const pos = getCanvasPoint(e);
    const x = pos.x;
    const y = pos.y;
    const [ex, ey] = snapToWalls && mode === 'pipe' ? snapPoint(x, y) : [x, y];
    setDrawing([drawing[0], drawing[1], ex, ey]);
  };

  const handleMouseUp = () => {
    if (!drawing) return;
    const [x1, y1, x2, y2] = drawing;
    if (Math.hypot(x2 - x1, y2 - y1) < 5) {
      setDrawing(null);
      return;
    }
    if (mode === 'wall') {
      const wall: Wall = {
        id: `w-${Date.now()}`,
        points: [x1, y1, x2, y2],
        thickness: 20,
      };
      update({ ...data, walls: [...data.walls, wall] });
    } else if (mode === 'pipe') {
      const pipe: Pipe = {
        id: `p-${Date.now()}`,
        start: { x: x1, y: y1, z: 0 },
        end: { x: x2, y: y2, z: 0 },
        diameterMm: draftPipe.diameterMm,
        wallThicknessMm: 2.3,
        insulationThicknessMm: 10,
        material: draftPipe.material,
        hasHanger: true,
        hangerSpacingMm: 800,
      };
      const pipes = [...(data.pipes ?? []), pipe];
      update({ ...data, pipes });
      onPipeChange?.(pipes);
    }
    setDrawing(null);
  };

  const addRoom = () => {
    const room: Room = {
      id: `r-${Date.now()}`,
      x: 100,
      y: 100,
      width: 300,
      height: 400,
      name: '房间',
    };
    update({ ...data, rooms: [...data.rooms, room] });
  };

  const removeSelected = () => {
    if (!selectedId) return;
    update({
      ...data,
      walls: data.walls.filter((w) => w.id !== selectedId),
      rooms: data.rooms.filter((r) => r.id !== selectedId),
      devices: (data.devices ?? []).filter((d) => d.id !== selectedId),
    });
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full w-full gap-2">
      <div className="flex items-center gap-2 p-2 bg-gray-100 rounded flex-wrap">
        {(['select', 'wall', 'room', 'pipe', 'device'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-2 py-1 text-sm border rounded ${mode === m ? 'bg-blue-600 text-white' : 'hover:bg-gray-200'}`}
          >
            {m === 'select' ? '选择' : m === 'wall' ? '画墙' : m === 'room' ? '房间' : m === 'pipe' ? '布管' : '设备'}
          </button>
        ))}
        {mode === 'pipe' && (
          <>
            <input
              type="number"
              value={draftPipe.diameterMm}
              onChange={(e) => setDraftPipe({ ...draftPipe, diameterMm: Number(e.target.value) })}
              className="w-16 border rounded px-1 text-sm"
              placeholder="mm"
            />
            <select
              value={draftPipe.material}
              onChange={(e) => setDraftPipe({ ...draftPipe, material: e.target.value })}
              className="border rounded px-1 text-sm"
            >
              <option>PPR</option>
              <option>PEX</option>
              <option>Copper</option>
              <option>Steel</option>
            </select>
          </>
        )}
        {mode === 'device' && (
          <>
            <select
              value={draftDevice.systemType}
              onChange={(e) => setDraftDevice({ ...draftDevice, systemType: e.target.value })}
              className="border rounded px-1 text-sm"
            >
              <option value="freshAir">新风</option>
              <option value="heating">采暖</option>
              <option value="ac">空调</option>
              <option value="water">水电</option>
              <option value="electric">强电</option>
            </select>
            <input
              type="text"
              value={draftDevice.name}
              onChange={(e) => setDraftDevice({ ...draftDevice, name: e.target.value })}
              className="w-20 border rounded px-1 text-sm"
              placeholder="设备名"
            />
            <input
              type="text"
              value={draftDevice.assetRef}
              onChange={(e) => setDraftDevice({ ...draftDevice, assetRef: e.target.value })}
              className="w-32 border rounded px-1 text-sm"
              placeholder="assetRef"
            />
          </>
        )}
        <button onClick={addRoom} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          添加房间
        </button>
        <button onClick={removeSelected} className="px-2 py-1 text-sm border rounded hover:bg-gray-200">
          删除选中
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-1 text-sm border rounded hover:bg-gray-200"
        >
          上传 CAD 底图
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleCadUpload}
        />
        <span className="text-sm text-gray-700 ml-2">墙: {data.walls.length} 房间: {data.rooms.length}</span>
      </div>
      <div className="flex-1 border rounded bg-white min-h-[400px] overflow-hidden">
        <svg
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="h-full w-full cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#fff" />
            {/* CAD 底图 */}
            {cadImage && <image href={cadImage} x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} opacity={0.4} />}
            {/* 房间 */}
            {data.rooms.map((room) => (
              <rect
                key={room.id}
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={selectedId === room.id ? '#bfdbfe' : '#e0f2fe'}
                stroke="#3b82f6"
                strokeWidth={2}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(room.id);
                }}
              />
            ))}
            {/* 墙体 */}
            {data.walls.map((wall) => {
              const [x1, y1, x2, y2] = wall.points;
              return (
                <line
                  key={wall.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={selectedId === wall.id ? '#ef4444' : '#1f2937'}
                  strokeWidth={wall.thickness}
                  strokeLinecap="round"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(wall.id);
                  }}
                />
              );
            })}
            {/* 已布管线 */}
            {(data.pipes ?? []).map((pipe) => (
              <line
                key={pipe.id}
                x1={pipe.start.x}
                y1={pipe.start.y}
                x2={pipe.end.x}
                y2={pipe.end.y}
                stroke="#8b5cf6"
                strokeWidth={pipe.diameterMm / 4}
                strokeLinecap="round"
              />
            ))}
            {/* 已放设备 */}
            {(data.devices ?? []).map((dev) => (
              <circle
                key={dev.id}
                cx={dev.x}
                cy={dev.y}
                r={20}
                fill="#facc15"
                stroke="#b45309"
                strokeWidth={3}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(dev.id);
                }}
              />
            ))}
            {/* 绘制中墙/管 */}
            {drawing && (
              <line
                x1={drawing[0]}
                y1={drawing[1]}
                x2={drawing[2]}
                y2={drawing[3]}
                stroke={mode === 'pipe' ? '#8b5cf6' : '#f59e0b'}
                strokeWidth={mode === 'pipe' ? draftPipe.diameterMm / 4 : 20}
                strokeDasharray="10 10"
                strokeLinecap="round"
              />
            )}
            {/* 端点标记 */}
            {data.walls.map((wall) => (
              <circle
                key={`${wall.id}-end1`}
                cx={wall.points[2]}
                cy={wall.points[3]}
                r={15}
                fill="#10b981"
              />
            ))}
        </svg>
      </div>
    </div>
  );
}
