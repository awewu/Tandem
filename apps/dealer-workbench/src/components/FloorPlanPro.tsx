'use client';
/**
 * 专业建筑蓝图渲染器 — 参考标准建筑制图风格
 * 双线墙体 / 门弧 / 窗符号 / 家具线图 / 格纸底色 / 尺寸标注
 */
import { useMemo } from 'react';
import type { FloorPlan, Wall, Door, Window, Furniture, FurnitureType } from '../lib/floorplan';
import { EQUIP_SPEC, FURN_SPEC } from '../lib/floorplan';

/* ── 样式常数 ─────────────────────────────────── */
const C = {
  paper:   '#f4f1e8',   // 米色底纸
  grid:    '#c5c8d4',   // 浅蓝网格
  wall:    '#1a2a5e',   // 深蓝墙体填充
  stroke:  '#1a2a5e',   // 线条颜色
  room:    '#e8f0ff',   // 房间浅蓝填充
  equip:   '#E4002B',   // 设备颜色（瑞合红）
  dim:     '#555',      // 尺寸标注
  label:   '#1a2a5e',
};

/* ── 墙体四角坐标 ─────────────────────────────── */
function wallPoly(w: Wall) {
  const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const nx = -dy / len * w.thickness / 2;
  const ny =  dx / len * w.thickness / 2;
  // 四角（延伸端点避免接缝）
  return [
    { x: w.a.x - nx, y: w.a.y - ny },
    { x: w.b.x - nx, y: w.b.y - ny },
    { x: w.b.x + nx, y: w.b.y + ny },
    { x: w.a.x + nx, y: w.a.y + ny },
  ];
}

function polyStr(pts: { x: number; y: number }[]) {
  return pts.map(p => `${p.x},${p.y}`).join(' ');
}

/* ── 门符号（铰链 + 弧 + 门扇） ─────────────── */
function DoorSvg({ d }: { d: Door }) {
  const r = d.width;
  const a0 = d.angle * Math.PI / 180;
  const a1 = a0 + d.swing * Math.PI / 2;
  // 门扇线
  const ex = d.x + Math.cos(a1) * r;
  const ey = d.y + Math.sin(a1) * r;
  // 弧线大圆弧参数
  const sweep = d.swing === 1 ? 0 : 1;
  return (
    <g stroke={C.stroke} strokeWidth={15} fill="none">
      {/* 门洞空白 — 盖掉墙体 */}
      <line
        x1={d.x + Math.cos(a0) * 5} y1={d.y + Math.sin(a0) * 5}
        x2={d.x + Math.cos(a0) * (r - 5)} y2={d.y + Math.sin(a0) * (r - 5)}
        stroke={C.paper} strokeWidth={d.width > 800 ? 250 : 200} />
      {/* 门扇 */}
      <line x1={d.x} y1={d.y} x2={ex} y2={ey} />
      {/* 开启弧 */}
      <path d={`M ${d.x + Math.cos(a0) * r} ${d.y + Math.sin(a0) * r} A ${r} ${r} 0 0 ${sweep} ${ex} ${ey}`} />
    </g>
  );
}

/* ── 窗符号（双线玻璃） ─────────────────────── */
function WindowSvg({ w }: { w: Window }) {
  const a = w.angle * Math.PI / 180;
  const nx = -Math.sin(a) * 60, ny = Math.cos(a) * 60;
  const ex = w.x + Math.cos(a) * w.width, ey = w.y + Math.sin(a) * w.width;
  const pts = (off: number) =>
    `M ${w.x + nx * off} ${w.y + ny * off} L ${ex + nx * off} ${ey + ny * off}`;
  return (
    <g>
      {/* 开洞清白 */}
      <line x1={w.x} y1={w.y} x2={ex} y2={ey}
        stroke={C.paper} strokeWidth={220} />
      {/* 三条线：外墙皮 + 玻璃中线 + 内墙皮 */}
      {[-1, 0, 1].map(o => (
        <path key={o} d={pts(o)} stroke={C.stroke} strokeWidth={o === 0 ? 12 : 18} fill="none" />
      ))}
    </g>
  );
}

/* ── 家具符号 ─────────────────────────────────── */
function FurnSvg({ f }: { f: Furniture }) {
  const sp = FURN_SPEC[f.type as FurnitureType];
  if (!sp) return null;
  const { w, d } = sp;
  const t = `translate(${f.x},${f.y}) rotate(${f.rotation})`;
  const s = (w2: number, d2: number, rx = 0) =>
    <rect x={-w2/2} y={-d2/2} width={w2} height={d2} rx={rx}
      fill="none" stroke={C.stroke} strokeWidth={12} />;

  const body = (() => {
    switch (f.type) {
      case 'bathtub': return <>
        {s(w, d, 60)}
        <ellipse cx={0} cy={d/2-180} rx={250} ry={170} fill="none" stroke={C.stroke} strokeWidth={10}/>
        <circle cx={0} cy={d/2-360} r={40} fill={C.stroke}/>
      </>;
      case 'toilet': return <>
        <rect x={-w/2} y={-d/2} width={w} height={d*0.3} rx={20}
          fill="none" stroke={C.stroke} strokeWidth={12}/>
        <ellipse cx={0} cy={d*0.15} rx={w/2-20} ry={d*0.38}
          fill="none" stroke={C.stroke} strokeWidth={12}/>
      </>;
      case 'washbasin': return <>
        {s(w, d, 80)}
        <circle cx={0} cy={d*0.1} r={60} fill="none" stroke={C.stroke} strokeWidth={10}/>
      </>;
      case 'stove': return <>
        {s(w, d)}
        {[[-220,-160],[220,-160],[-220,160],[220,160]].map(([cx,cy],i) =>
          <circle key={i} cx={cx} cy={cy} r={90} fill="none" stroke={C.stroke} strokeWidth={12}/>)}
      </>;
      case 'sink': return <>
        {s(w, d)}
        <line x1={-w/2+60} y1={0} x2={w/2-60} y2={0} stroke={C.stroke} strokeWidth={10}/>
        {[-160,160].map(cx =>
          <circle key={cx} cx={cx} cy={0} r={70} fill="none" stroke={C.stroke} strokeWidth={10}/>)}
      </>;
      case 'sofa': return <>
        {s(w, d)}
        <rect x={-w/2+40} y={-d/2+40} width={w-80} height={d*0.55} rx={30}
          fill="none" stroke={C.stroke} strokeWidth={10}/>
        {/* 扶手 */}
        <rect x={-w/2+30} y={-d/2+40} width={120} height={d-80} rx={20}
          fill="none" stroke={C.stroke} strokeWidth={10}/>
        <rect x={w/2-150} y={-d/2+40} width={120} height={d-80} rx={20}
          fill="none" stroke={C.stroke} strokeWidth={10}/>
      </>;
      case 'bed_double': case 'bed_single': return <>
        {s(w, d)}
        <rect x={-w/2+30} y={-d/2+30} width={w-60} height={d*0.3} rx={20}
          fill="none" stroke={C.stroke} strokeWidth={10}/>
        {f.type === 'bed_double'
          ? <><circle cx={-w/4} cy={-d/2+100} r={80} fill="none" stroke={C.stroke} strokeWidth={8}/>
              <circle cx={ w/4} cy={-d/2+100} r={80} fill="none" stroke={C.stroke} strokeWidth={8}/></>
          : <circle cx={0} cy={-d/2+100} r={80} fill="none" stroke={C.stroke} strokeWidth={8}/>}
      </>;
      case 'wardrobe': return <>
        {s(w, d)}
        <line x1={0} y1={-d/2} x2={0} y2={d/2} stroke={C.stroke} strokeWidth={10}/>
        <circle cx={-w/4} cy={0} r={30} fill={C.stroke}/>
        <circle cx={ w/4} cy={0} r={30} fill={C.stroke}/>
      </>;
      case 'dining_table': return <>
        {s(w, d, 20)}
        {/* 椅子 */}
        {[[-400,0],[400,0],[0,-300],[0,300]].map(([cx,cy],i) =>
          <rect key={i} x={cx-120} y={cy-100} width={240} height={200} rx={20}
            fill="none" stroke={C.stroke} strokeWidth={10}/>)}
      </>;
      case 'coffee_table': return <>{s(w, d, 30)}</>;
      case 'tv_unit': return <>
        {s(w, d)}
        <rect x={-w/2+60} y={-d/2+60} width={w-120} height={d-120}
          fill="none" stroke={C.stroke} strokeWidth={8}/>
      </>;
      default: return <>{s(w, d)}</>;
    }
  })();

  return (
    <g transform={t}>
      {body}
      <text x={0} y={d/2+160} textAnchor="middle" fontSize={140}
        fontFamily="'PingFang SC',sans-serif" fill={C.dim}>{sp.label}</text>
    </g>
  );
}

/* ── 设备符号 ─────────────────────────────────── */
function EquipSvg({ e }: { e: import('../lib/floorplan').Equipment }) {
  const sp = EQUIP_SPEC[e.type];
  return (
    <g transform={`translate(${e.x},${e.y}) rotate(${e.rotation})`}>
      <rect x={-sp.w/2} y={-sp.d/2} width={sp.w} height={sp.d}
        fill={sp.color + '22'} stroke={sp.color} strokeWidth={18} rx={30}/>
      <text x={0} y={40} textAnchor="middle" fontSize={160}
        fontFamily="'PingFang SC',sans-serif" fill={sp.color} fontWeight={700}>{sp.label}</text>
    </g>
  );
}

/* ── 主组件 ───────────────────────────────────── */
interface Props { plan: FloorPlan; title?: string }

export default function FloorPlanPro({ plan, title }: Props) {
  const { walls, doors = [], windows = [], furniture = [], equipment, rooms, meta } = plan;

  // Bounding box (mm)
  const bounds = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const w of walls) {
      for (const p of [w.a, w.b]) {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
    }
    const pad = 600;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  }, [walls]);

  const GRID_MM = 500; // 网格间距 500mm

  return (
    <div style={{ width: '100%', background: C.paper, borderRadius: 10, overflow: 'hidden',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.12)', fontFamily: 'sans-serif' }}>
      {/* 标题栏 */}
      <div style={{ padding: '10px 20px', borderBottom: `2px solid ${C.stroke}`,
                    display: 'flex', alignItems: 'baseline', gap: 20 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: C.stroke, letterSpacing: 2 }}>
          {title || meta.name}
        </span>
        <span style={{ fontSize: 11, color: C.dim }}>
          单位：mm | 比例：1:{Math.round(1000 / meta.scale)} | © 瑞诺瓦AI舒适家
        </span>
      </div>

      <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
           style={{ width: '100%', display: 'block', background: C.paper }}>

        {/* 格纸底色 */}
        <defs>
          <pattern id="grid" x={0} y={0} width={GRID_MM} height={GRID_MM} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_MM} 0 L 0 0 0 ${GRID_MM}`} fill="none" stroke={C.grid} strokeWidth={6}/>
          </pattern>
        </defs>
        <rect x={bounds.x} y={bounds.y} width={bounds.w} height={bounds.h} fill="url(#grid)"/>

        {/* 墙体填充 */}
        {walls.map(w => {
          const pts = wallPoly(w);
          if (!pts) return null;
          return (
            <polygon key={w.id} points={polyStr(pts)}
              fill={C.wall} stroke={C.wall} strokeWidth={2} strokeLinejoin="miter"/>
          );
        })}

        {/* 窗符号（先画，保留开洞空白） */}
        {windows.map(w => <WindowSvg key={w.id} w={w}/>)}

        {/* 门符号 */}
        {doors.map(d => <DoorSvg key={d.id} d={d}/>)}

        {/* 家具 */}
        {furniture.map(f => <FurnSvg key={f.id} f={f}/>)}

        {/* 暖通设备 */}
        {equipment.map(e => <EquipSvg key={e.id} e={e}/>)}

        {/* 房间标签 */}
        {rooms.map(r => (
          <text key={r.id} x={r.x} y={r.y} textAnchor="middle"
            fontSize={220} fontWeight={700} fontFamily="'PingFang SC',sans-serif"
            fill={C.label} opacity={0.7}>{r.name}</text>
        ))}

        {/* 外轮廓描边（最上层） */}
        {walls.map(w => {
          const pts = wallPoly(w);
          if (!pts) return null;
          return <polygon key={`s${w.id}`} points={polyStr(pts)}
            fill="none" stroke={C.stroke} strokeWidth={8} strokeLinejoin="miter"/>;
        })}
      </svg>
    </div>
  );
}
