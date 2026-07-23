'use client';
import { useRef, useState, useCallback, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Text, Circle, Group } from 'react-konva';
import type Konva from 'konva';
import {
  emptyPlan, snapMM, orthoSnap, uid, toDXF,
  EQUIP_SPEC, wallLengthMM,
  type FloorPlan, type Wall, type Equipment, type EquipType, type Pt,
} from '../lib/floorplan';

const SCALE = 0.25;          // px per mm  (1m = 250px at 1:4)
const GRID = 100;            // snap grid mm
const mm2px = (mm: number) => mm * SCALE;
const px2mm = (px: number) => px / SCALE;
const fmtM = (mm: number) => `${(mm / 1000).toFixed(2)}m`;

type Tool = 'select' | 'wall' | 'equip';

const EQUIP_KEYS = Object.keys(EQUIP_SPEC) as EquipType[];

export default function Editor2D({
  initialPlan,
  onChange,
}: {
  initialPlan?: FloorPlan;
  onChange?: (p: FloorPlan) => void;
}) {
  const [plan, setPlan] = useState<FloorPlan>(initialPlan ?? emptyPlan());
  const [tool, setTool] = useState<Tool>('wall');
  const [selectedEquip, setSelectedEquip] = useState<EquipType>('heat_pump');
  const [drawing, setDrawing] = useState<Pt | null>(null);
  const [cursor, setCursor] = useState<Pt>({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const W = 1200, H = 800;

  const update = useCallback((p: FloorPlan) => {
    setPlan(p);
    onChange?.(p);
  }, [onChange]);

  // Grid dots
  const dots: { x: number; y: number }[] = [];
  for (let x = 0; x <= W; x += mm2px(GRID)) {
    for (let y = 0; y <= H; y += mm2px(GRID)) {
      dots.push({ x, y });
    }
  }

  function stageXY(e: Konva.KonvaEventObject<MouseEvent>): Pt {
    const pos = stageRef.current!.getPointerPosition()!;
    return { x: snapMM(px2mm(pos.x), GRID), y: snapMM(px2mm(pos.y), GRID) };
  }

  function onMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const pos = stageRef.current!.getPointerPosition()!;
    const snapped = { x: snapMM(px2mm(pos.x), GRID), y: snapMM(px2mm(pos.y), GRID) };
    setCursor(snapped);
  }

  function onStageClick(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target !== stageRef.current && e.target.getParent() === stageRef.current) return;
    const pt = stageXY(e);

    if (tool === 'wall') {
      if (!drawing) {
        setDrawing(pt);
      } else {
        const b = orthoSnap(drawing, pt);
        const wall: Wall = { id: uid('w'), a: drawing, b, thickness: 200, height: 2800 };
        update({ ...plan, walls: [...plan.walls, wall] });
        setDrawing(b);
      }
    } else if (tool === 'equip') {
      const spec = EQUIP_SPEC[selectedEquip];
      const eq: Equipment = {
        id: uid('e'), type: selectedEquip,
        x: pt.x - spec.w / 2, y: pt.y - spec.d / 2, rotation: 0,
      };
      update({ ...plan, equipment: [...plan.equipment, eq] });
    }
  }

  function onRightClick() {
    setDrawing(null);
  }

  function exportDXF() {
    const blob = new Blob([toDXF(plan)], { type: 'application/dxf' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${plan.meta.name || 'floorplan'}.dxf`; a.click();
  }

  function deleteSelected() {
    if (!selected) return;
    update({
      ...plan,
      walls: plan.walls.filter(w => w.id !== selected),
      equipment: plan.equipment.filter(e => e.id !== selected),
    });
    setSelected(null);
  }

  const previewEnd = drawing ? orthoSnap(drawing, cursor) : null;

  const cursorStyle = tool === 'wall' ? 'crosshair' : tool === 'equip' ? 'copy' : 'default';

  return (
    <div style={{ display: 'flex', height: '100%', background: '#f7f9fc' }}>
      {/* Left toolbar */}
      <div style={{ width: 140, background: '#1a1f36', display: 'flex', flexDirection: 'column', gap: 2, padding: 10 }}>
        <div style={{ color: '#9aa5be', fontSize: 10, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>工具</div>
        {([['select', '↖ 选择', 'S'], ['wall', '⊓ 画墙', 'W'], ['equip', '⊕ 设备', 'E']] as [Tool, string, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTool(t)} style={{
            background: tool === t ? '#4E9A3D' : '#2d3561', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 10px', fontSize: 12, cursor: 'pointer', textAlign: 'left',
          }}>{label}</button>
        ))}

        {tool === 'equip' && (
          <>
            <div style={{ color: '#9aa5be', fontSize: 10, marginTop: 12, marginBottom: 4, textTransform: 'uppercase' }}>设备</div>
            {EQUIP_KEYS.map(k => (
              <button key={k} onClick={() => setSelectedEquip(k)} style={{
                background: selectedEquip === k ? '#4E9A3D' : '#2d3561', color: '#fff', border: 'none',
                borderRadius: 4, padding: '5px 8px', fontSize: 11, cursor: 'pointer', textAlign: 'left',
              }}>{EQUIP_SPEC[k].icon} {EQUIP_SPEC[k].label}</button>
            ))}
          </>
        )}

        <div style={{ flex: 1 }} />
        {selected && (
          <button onClick={deleteSelected} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, padding: '7px', fontSize: 12, cursor: 'pointer' }}>
            🗑 删除
          </button>
        )}
        <button onClick={exportDXF} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px', fontSize: 12, cursor: 'pointer' }}>
          ↓ DXF
        </button>
        <button onClick={() => { setDrawing(null); update(emptyPlan()); setSelected(null); }}
          style={{ background: '#374151', color: '#fff', border: 'none', borderRadius: 6, padding: '7px', fontSize: 11, cursor: 'pointer' }}>
          清空
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Stage ref={stageRef} width={W} height={H} style={{ cursor: cursorStyle, background: '#fff' }}
          onMouseMove={onMouseMove} onClick={onStageClick} onContextMenu={e => { e.evt.preventDefault(); onRightClick(); }}>
          <Layer>
            {/* Grid */}
            {dots.map((d, i) => (
              <Circle key={i} x={d.x} y={d.y} radius={1} fill="#d1d5db" listening={false} />
            ))}

            {/* Walls */}
            {plan.walls.map(w => {
              const sel = selected === w.id;
              return (
                <Group key={w.id} onClick={tool === 'select' ? () => setSelected(w.id) : undefined}>
                  <Line
                    points={[mm2px(w.a.x), mm2px(w.a.y), mm2px(w.b.x), mm2px(w.b.y)]}
                    stroke={sel ? '#4E9A3D' : '#1a1f36'} strokeWidth={mm2px(w.thickness)} lineCap="square"
                  />
                  <Text
                    x={(mm2px(w.a.x) + mm2px(w.b.x)) / 2}
                    y={(mm2px(w.a.y) + mm2px(w.b.y)) / 2 - 8}
                    text={fmtM(wallLengthMM(w))}
                    fontSize={10} fill={sel ? '#4E9A3D' : '#6b7280'} listening={false}
                  />
                </Group>
              );
            })}

            {/* Wall preview while drawing */}
            {drawing && previewEnd && (
              <Line
                points={[mm2px(drawing.x), mm2px(drawing.y), mm2px(previewEnd.x), mm2px(previewEnd.y)]}
                stroke="#4E9A3D" strokeWidth={mm2px(200)} lineCap="square" opacity={0.5} listening={false}
                dash={[10, 6]}
              />
            )}
            {drawing && previewEnd && (
              <Text
                x={(mm2px(drawing.x) + mm2px(previewEnd.x)) / 2}
                y={(mm2px(drawing.y) + mm2px(previewEnd.y)) / 2 - 16}
                text={fmtM(Math.sqrt((previewEnd.x - drawing.x) ** 2 + (previewEnd.y - drawing.y) ** 2))}
                fontSize={12} fill="#4E9A3D" fontStyle="bold" listening={false}
              />
            )}

            {/* Equipment */}
            {plan.equipment.map(eq => {
              const sp = EQUIP_SPEC[eq.type];
              const sel = selected === eq.id;
              return (
                <Group key={eq.id} x={mm2px(eq.x)} y={mm2px(eq.y)} rotation={eq.rotation}
                  onClick={tool === 'select' ? () => setSelected(eq.id) : undefined}
                  draggable={tool === 'select'}
                  onDragEnd={tool === 'select' ? (e) => {
                    const nx = snapMM(px2mm(e.target.x()), GRID);
                    const ny = snapMM(px2mm(e.target.y()), GRID);
                    update({ ...plan, equipment: plan.equipment.map(x => x.id === eq.id ? { ...x, x: nx, y: ny } : x) });
                  } : undefined}>
                  <Rect
                    width={mm2px(sp.w)} height={mm2px(sp.d)}
                    fill={sp.color + '33'} stroke={sel ? '#4E9A3D' : sp.color}
                    strokeWidth={sel ? 2 : 1.5} cornerRadius={3}
                  />
                  <Text x={mm2px(sp.w) / 2} y={mm2px(sp.d) / 2 - 10}
                    text={sp.icon} fontSize={16} align="center" offsetX={8} listening={false} />
                  <Text x={mm2px(sp.w) / 2} y={mm2px(sp.d) / 2 + 8}
                    text={sp.label} fontSize={9} fill={sp.color} align="center" offsetX={mm2px(sp.w) / 2} width={mm2px(sp.w)} listening={false} />
                </Group>
              );
            })}

            {/* Cursor crosshair (wall mode) */}
            {tool === 'wall' && (
              <>
                <Circle x={mm2px(cursor.x)} y={mm2px(cursor.y)} radius={4} fill="#4E9A3D" listening={false} />
                <Text x={mm2px(cursor.x) + 8} y={mm2px(cursor.y) - 8}
                  text={`${(cursor.x / 1000).toFixed(2)}, ${(cursor.y / 1000).toFixed(2)}`}
                  fontSize={10} fill="#697386" listening={false} />
              </>
            )}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
