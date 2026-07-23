'use client';
/**
 * 方案可视化 — 统一面板（建筑图纸 / 气流仿真 / 地暖热图 / 管路液压）
 * 四个视角共享同一份 FloorPlan 数据，标签页切换
 */
import { useState, lazy, Suspense, useMemo } from 'react';
import { sampleApartment } from '../lib/floorplan';
import type { FloorPlan, EquipType, Wall, Door, Window as FPWindow } from '../lib/floorplan';

const FloorPlanPro   = lazy(() => import('./FloorPlanPro'));
const AirflowSim     = lazy(() => import('./AirflowSim'));
const FloorHeatViz   = lazy(() => import('./FloorHeatViz'));
const PipeNetworkViz = lazy(() => import('./PipeNetworkViz'));

const GRID = 40;
const M = (px: number) => px * 25;

type Room   = { id: string; label: string; x: number; y: number; w: number; h: number };
type Device = { id: string; type: string; label: string; icon: string; color: string; x: number; y: number; w: number; h: number };
type DoorItem   = { id: string; x: number; y: number; width: number; angle: number; swing: 1 | -1 };
type WindowItem = { id: string; x: number; y: number; width: number; angle: number };

interface Props { rooms: Room[]; devices: Device[]; doors: DoorItem[]; windows: WindowItem[] }

const TABS = [
  { id: 'blueprint', label: '📐 建筑图纸', color: '#16a34a' },
  { id: 'airflow',   label: '▶ 气流仿真',  color: '#16407a' },
  { id: 'heat',      label: '🌡 地暖热图',  color: '#dc2626' },
  { id: 'pipe',      label: '🔧 管路液压',  color: '#d97706' },
] as const;

type TabId = typeof TABS[number]['id'];

const Spinner = ({ h = 360 }: { h?: number }) => (
  <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#697386', background: '#f7f9fc', borderRadius: 8 }}>
    计算中...
  </div>
);

export default function SolutionViewer({ rooms, devices, doors, windows }: Props) {
  const [tab, setTab] = useState<TabId>('blueprint');

  const plan: FloorPlan = useMemo(() => {
    if (!rooms.length) return sampleApartment();
    let i = 0;
    const walls: Wall[] = rooms.flatMap(r => {
      const [x0, y0, x1, y1] = [M(r.x), M(r.y), M(r.x + r.w), M(r.y + r.h)];
      return [
        { id: `w${i++}`, a: { x: x0, y: y0 }, b: { x: x1, y: y0 }, thickness: 200, height: 2800 },
        { id: `w${i++}`, a: { x: x1, y: y0 }, b: { x: x1, y: y1 }, thickness: 200, height: 2800 },
        { id: `w${i++}`, a: { x: x1, y: y1 }, b: { x: x0, y: y1 }, thickness: 200, height: 2800 },
        { id: `w${i++}`, a: { x: x0, y: y1 }, b: { x: x0, y: y0 }, thickness: 200, height: 2800 },
      ];
    });
    return {
      walls,
      equipment: devices.map(d => ({ id: d.id, type: d.type as EquipType, x: M(d.x + d.w * GRID / 2), y: M(d.y + d.h * GRID / 2), rotation: 0 })),
      rooms: rooms.map(r => ({ id: r.id, name: r.label, x: M(r.x + r.w / 2), y: M(r.y + r.h / 2) })),
      doors: doors.map(d => ({ ...d, x: M(d.x), y: M(d.y) } as Door)),
      windows: windows.map(w => ({ ...w, x: M(w.x), y: M(w.y) } as FPWindow)),
      meta: { name: '设计方案', scale: 0.07 },
    };
  }, [rooms, devices, doors, windows]);

  const firstRoom = rooms[0];

  const activeColor = TABS.find(t => t.id === tab)?.color ?? '#1a1f36';

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-2)', background: '#f7f9fc' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '12px 0', fontSize: 13, fontWeight: tab === t.id ? 700 : 400,
              border: 'none', cursor: 'pointer', background: 'none',
              color: tab === t.id ? t.color : '#697386',
              borderBottom: tab === t.id ? `2.5px solid ${t.color}` : '2.5px solid transparent',
              transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ padding: 20 }}>
        <Suspense fallback={<Spinner />}>
          {tab === 'blueprint' && <FloorPlanPro plan={plan} />}
          {tab === 'airflow'   && <AirflowSim   rooms={rooms.map(r => ({ ...r, label: r.label }))} devices={devices} />}
          {tab === 'heat'      && firstRoom && (
            <FloorHeatViz
              roomW={firstRoom.w / GRID * 1000}
              roomD={firstRoom.h / GRID * 1000}
              title={`${firstRoom.label} 地暖热分布`} />
          )}
          {tab === 'heat' && !firstRoom && <div style={{ padding: 32, color: '#697386', textAlign: 'center' }}>请先添加房间</div>}
          {tab === 'pipe' && <PipeNetworkViz rooms={rooms} devices={devices} />}
        </Suspense>
      </div>
    </div>
  );
}
