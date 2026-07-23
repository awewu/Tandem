/**
 * 户型共享数据模型 — 2D CAD 编辑器与 3D BIM 查看器的唯一数据源
 * 单位：毫米（mm），CAD 行业标准。3D 渲染时按 1mm = 0.001 三维单位换算。
 */

export type Pt = { x: number; y: number };

export interface Wall {
  id: string;
  a: Pt;          // 起点 (mm)
  b: Pt;          // 终点 (mm)
  thickness: number; // 墙厚 (mm)，默认 200
  height: number;    // 墙高 (mm)，默认 2800
}

export interface Equipment {
  id: string;
  type: EquipType;
  x: number;      // 中心 X (mm)
  y: number;      // 中心 Y (mm)
  rotation: number; // 角度（度）
}

export interface RoomLabel {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface FloorPlan {
  walls: Wall[];
  equipment: Equipment[];
  rooms: RoomLabel[];
  doors?: Door[];        // 门（开洞 + 开启弧）
  windows?: Window[];    // 窗（双线玻璃）
  furniture?: Furniture[]; // 家具符号
  meta: { name: string; scale: number }; // scale = px per mm（2D 显示用）
}

export type EquipType =
  | 'heat_pump' | 'fresh_air' | 'floor_heat'
  | 'water_heater' | 'filter' | 'controller';

// 设备规格：尺寸(mm) + 3D 高度(mm) + 颜色 + 标签
export const EQUIP_SPEC: Record<EquipType, {
  label: string; w: number; d: number; h: number; color: string; icon: string;
}> = {
  heat_pump:    { label: '热泵主机',     w: 1000, d: 400, h: 800,  color: '#E4002B', icon: '🔄' },
  fresh_air:    { label: '新风机',       w: 800,  d: 500, h: 300,  color: '#2563eb', icon: '💨' },
  floor_heat:   { label: '分集水器',     w: 600,  d: 150, h: 500,  color: '#16a34a', icon: '🌡️' },
  water_heater: { label: '热水器',       w: 600,  d: 600, h: 1500, color: '#d97706', icon: '🚿' },
  filter:       { label: '净水机',       w: 400,  d: 400, h: 1000, color: '#7c3aed', icon: '💧' },
  controller:   { label: 'Econet控制器', w: 200,  d: 100, h: 200,  color: '#0891b2', icon: '📱' },
};

export function emptyPlan(): FloorPlan {
  return {
    // 默认给一个矩形外墙 + 一道隔墙，让用户一进来就有参照
    walls: rectWalls(0, 0, 8000, 6000, 200, 2800).concat(
      [{ id: 'w_div', a: { x: 5000, y: 0 }, b: { x: 5000, y: 6000 }, thickness: 150, height: 2800 }]
    ),
    equipment: [],
    rooms: [
      { id: 'r1', name: '客厅', x: 2500, y: 3000 },
      { id: 'r2', name: '卧室', x: 6500, y: 3000 },
    ],
    meta: { name: '未命名户型', scale: 0.08 },
  };
}

export function rectWalls(x: number, y: number, w: number, h: number, t: number, ht: number): Wall[] {
  const c = [
    { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
  ];
  return c.map((p, i) => ({
    id: `w_rect_${i}`,
    a: p,
    b: c[(i + 1) % 4],
    thickness: t,
    height: ht,
  }));
}

export function wallLengthMM(w: Wall): number {
  return Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
}

// 网格吸附（mm）
export function snapMM(v: number, grid = 100): number {
  return Math.round(v / grid) * grid;
}

// 正交吸附：把第二个点对齐到水平/垂直
export function orthoSnap(a: Pt, b: Pt): Pt {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  return dx >= dy ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
}

let _seq = 0;
export function uid(prefix = 'id'): string {
  _seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${_seq}`;
}

/**
 * 导出 DXF（AutoCAD R12 ASCII）— 墙体转 LINE，房间名转 TEXT。
 * DXF 的 Y 轴向上，屏幕坐标 Y 向下，导出时翻转 Y。
 */
export function toDXF(plan: FloorPlan): string {
  const L: string[] = [];
  const yMax = 6000;
  const fy = (y: number) => yMax - y; // 翻转 Y

  L.push('0', 'SECTION', '2', 'ENTITIES');

  for (const w of plan.walls) {
    L.push('0', 'LINE', '8', 'WALLS',
      '10', String(w.a.x), '20', String(fy(w.a.y)),
      '11', String(w.b.x), '21', String(fy(w.b.y)));
  }
  for (const r of plan.rooms) {
    L.push('0', 'TEXT', '8', 'ROOMS',
      '10', String(r.x), '20', String(fy(r.y)),
      '40', '300', '1', r.name);
  }
  for (const e of plan.equipment) {
    const s = EQUIP_SPEC[e.type];
    L.push('0', 'TEXT', '8', 'EQUIPMENT',
      '10', String(e.x), '20', String(fy(e.y)),
      '40', '200', '1', s.label);
  }

  L.push('0', 'ENDSEC', '0', 'EOF');
  return L.join('\n');
}

/* ═══════════════════════════════════════════════════════════════
   专业建筑制图扩展：门 / 窗 / 家具符号
   坐标单位 mm，与墙体共享。门窗依附在某段墙上（开洞）。
   ═══════════════════════════════════════════════════════════════ */

// 门：开洞 + 门扇 + 开启弧线。hinge 端点 + 开启方向角度（度）
export interface Door {
  id: string;
  x: number; y: number;   // 铰链点 (mm)
  width: number;          // 门洞宽 (mm)，默认 800
  angle: number;          // 墙体走向角度（度，0=水平向右）
  swing: 1 | -1;          // 开启方向（1=顺时针 / -1=逆时针）
}

// 窗：墙上开洞，双线玻璃表示
export interface Window {
  id: string;
  x: number; y: number;   // 起点 (mm)
  width: number;          // 窗宽 (mm)
  angle: number;          // 墙体走向角度（度）
}

export type FurnitureType =
  | 'bathtub' | 'toilet' | 'washbasin' | 'sink' | 'stove'
  | 'sofa' | 'bed_double' | 'bed_single' | 'wardrobe'
  | 'dining_table' | 'coffee_table' | 'tv_unit';

// 家具：建筑符号，尺寸(mm) + 中文标签
export interface Furniture {
  id: string;
  type: FurnitureType;
  x: number; y: number;   // 中心 (mm)
  rotation: number;       // 角度（度）
}

// 家具规格目录（宽 w × 深 d，mm）+ 中文标签
export const FURN_SPEC: Record<FurnitureType, { label: string; w: number; d: number }> = {
  bathtub:      { label: '浴缸',   w: 1700, d: 750 },
  toilet:       { label: '马桶',   w: 380,  d: 680 },
  washbasin:    { label: '洗手盆', w: 600,  d: 480 },
  sink:         { label: '水槽',   w: 800,  d: 500 },
  stove:        { label: '灶台',   w: 700,  d: 600 },
  sofa:         { label: '沙发',   w: 2200, d: 900 },
  bed_double:   { label: '双人床', w: 1800, d: 2000 },
  bed_single:   { label: '单人床', w: 1200, d: 2000 },
  wardrobe:     { label: '衣柜',   w: 2000, d: 600 },
  dining_table: { label: '餐桌',   w: 1400, d: 800 },
  coffee_table: { label: '茶几',   w: 1200, d: 600 },
  tv_unit:      { label: '电视柜', w: 1800, d: 400 },
};

/** 示例户型：三室两卫，11m × 8m，含门窗家具与暖通设备（演示专业出图） */
export function sampleApartment(): FloorPlan {
  const H = 2800, EXT = 240, INT = 120;
  const wall = (id: string, ax: number, ay: number, bx: number, by: number, t: number): Wall =>
    ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: t, height: H });
  const walls: Wall[] = [
    wall('ext_t', 0, 0, 11000, 0, EXT),
    wall('ext_r', 11000, 0, 11000, 8000, EXT),
    wall('ext_b', 11000, 8000, 0, 8000, EXT),
    wall('ext_l', 0, 8000, 0, 0, EXT),
    wall('v5000', 5000, 0, 5000, 8000, INT),
    wall('v8000', 8000, 4000, 8000, 8000, INT),
    wall('h4500', 0, 4500, 5000, 4500, INT),
    wall('h4000', 5000, 4000, 11000, 4000, INT),
    wall('v2500', 2500, 4500, 2500, 8000, INT),
  ];
  const doors: Door[] = [
    { id: 'd_entry',  x: 2000, y: 8000, width: 900, angle: 0,  swing:  1 }, // 入户门
    { id: 'd_living', x: 5000, y: 6000, width: 800, angle: 90, swing: -1 }, // 客厅←走廊
    { id: 'd_master', x: 5000, y: 1500, width: 900, angle: 90, swing:  1 }, // 主卧
    { id: 'd_bed2',   x: 8000, y: 6500, width: 800, angle: 90, swing: -1 }, // 次卧
    { id: 'd_bath1',  x: 2500, y: 5500, width: 700, angle: 0,  swing:  1 }, // 主卫
    { id: 'd_bath2',  x: 2500, y: 7500, width: 700, angle: 0,  swing:  1 }, // 公卫
  ];
  const windows: Window[] = [
    { id: 'w_s1', x: 1500, y: 8000, width: 1800, angle: 0 }, // 南立面 1
    { id: 'w_s2', x: 6000, y: 8000, width: 2400, angle: 0 }, // 客厅飘窗
    { id: 'w_e1', x: 11000, y: 800,  width: 1500, angle: 90 }, // 主卧东窗
    { id: 'w_e2', x: 11000, y: 5500, width: 1500, angle: 90 }, // 次卧东窗
    { id: 'w_n1', x: 3000, y: 0,    width: 1200, angle: 0 }, // 北向厨房窗
  ];
  const furniture: Furniture[] = [
    // 客厅 (5000–11000, 4000–8000)
    { id: 'f_sofa',  type: 'sofa',         x: 8000, y: 7400, rotation: 0 },
    { id: 'f_ctbl',  type: 'coffee_table',  x: 8000, y: 6600, rotation: 0 },
    { id: 'f_tv',    type: 'tv_unit',        x: 8000, y: 4200, rotation: 0 },
    { id: 'f_dtbl',  type: 'dining_table',   x: 6200, y: 5000, rotation: 0 },
    // 主卧 (5000–11000, 0–4000)
    { id: 'f_bed',   type: 'bed_double',     x: 9000, y: 2000, rotation: 0 },
    { id: 'f_ward',  type: 'wardrobe',        x: 6000, y: 600,  rotation: 0 },
    // 次卧 (8000–11000, 4000–8000 右上角)
    { id: 'f_bed2',  type: 'bed_single',     x: 9800, y: 5500, rotation: 0 },
    // 卫生间 (0–2500, 4500–8000)
    { id: 'f_bath',  type: 'bathtub',         x: 1200, y: 5400, rotation: 0 },
    { id: 'f_wc',    type: 'toilet',           x: 400,  y: 6500, rotation: 0 },
    { id: 'f_sink',  type: 'washbasin',        x: 1800, y: 7800, rotation: 0 },
    // 厨房 (0–2500, 0–4500)
    { id: 'f_stove', type: 'stove',            x: 800,  y: 200,  rotation: 0 },
    { id: 'f_ksink', type: 'sink',             x: 2100, y: 200,  rotation: 0 },
  ];
  const equipment: Equipment[] = [
    { id: 'eq_hp',  type: 'heat_pump',  x: 3000, y: 200,  rotation: 0 },
    { id: 'eq_fa',  type: 'fresh_air',  x: 7500, y: 200,  rotation: 0 },
    { id: 'eq_fh',  type: 'floor_heat', x: 3500, y: 5000, rotation: 0 },
  ];
  const rooms: RoomLabel[] = [
    { id: 'r_liv',  name: '客厅',   x: 8000, y: 6000 },
    { id: 'r_din',  name: '餐厅',   x: 6200, y: 5800 },
    { id: 'r_mst',  name: '主卧',   x: 8500, y: 2000 },
    { id: 'r_bed2', name: '次卧',   x: 9500, y: 6000 },
    { id: 'r_bath', name: '卫生间', x: 1200, y: 6500 },
    { id: 'r_kit',  name: '厨房',   x: 1200, y: 2000 },
    { id: 'r_hall', name: '走廊',   x: 3500, y: 6500 },
  ];
  return { walls, doors, windows, furniture, equipment, rooms, meta: { name: '示例三室两卫户型', scale: 0.07 } };
}
