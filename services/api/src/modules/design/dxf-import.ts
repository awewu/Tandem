/**
 * DXF 图纸导入（开放格式，dxf-parser）。
 *
 * 读取 DXF → 按图层提取管线(LINE/POLYLINE)长度、设备块(INSERT)计数、圆(CIRCLE)，
 * 按图层名启发式归类为 水管/风管/其他，映射为设计可用的"构件汇总"。
 * Revit(.rvt)/AutoCAD(.dwg) 为闭源二进制，开放协同路径是导出 DXF/IFC 再导入。
 */

export type DxfElementClass = 'pipe' | 'duct' | 'equipment' | 'other';

export interface DxfImportResult {
  unit: string;
  layers: string[];
  byClass: Record<DxfElementClass, { count: number; totalLengthMm: number }>;
  equipmentBlocks: Array<{ name: string; count: number }>;
  segments: Array<{ layer: string; class: DxfElementClass; type: string; lengthMm: number }>;
  entityCount: number;
  note: string;
}

function classifyLayer(layer: string): DxfElementClass {
  const s = (layer || '').toLowerCase();
  if (/duct|风管|送风|排风|新风|hvac|air/.test(s)) return 'duct';
  if (/pipe|水管|给水|排水|采暖|冷媒|water|heat/.test(s)) return 'pipe';
  if (/equip|device|设备|机组|主机|block/.test(s)) return 'equipment';
  return 'other';
}

function dist(a: { x: number; y: number; z?: number }, b: { x: number; y: number; z?: number }): number {
  const dx = (a.x || 0) - (b.x || 0), dy = (a.y || 0) - (b.y || 0), dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * 解析 DXF 文本。unitToMm：DXF 图形单位→mm 的换算（默认 1，若图纸以 m 建模则传 1000）。
 */
export function parseDxf(text: string, unitToMm = 1): DxfImportResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DxfParser = require('dxf-parser');
  const parser = new DxfParser();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dxf: any;
  try { dxf = parser.parseSync(text); } catch (e) { throw new Error(`DXF 解析失败：${String((e as Error)?.message ?? e)}`); }
  if (!dxf) throw new Error('DXF 解析结果为空');

  const entities: any[] = Array.isArray(dxf.entities) ? dxf.entities : []; // eslint-disable-line @typescript-eslint/no-explicit-any
  const layerSet = new Set<string>();
  const byClass: DxfImportResult['byClass'] = {
    pipe: { count: 0, totalLengthMm: 0 }, duct: { count: 0, totalLengthMm: 0 },
    equipment: { count: 0, totalLengthMm: 0 }, other: { count: 0, totalLengthMm: 0 },
  };
  const blockCount = new Map<string, number>();
  const segments: DxfImportResult['segments'] = [];

  for (const ent of entities) {
    const layer = ent.layer || '0';
    layerSet.add(layer);
    const cls = classifyLayer(layer);
    const type = ent.type;

    let lengthMm = 0;
    if (type === 'LINE' && ent.vertices?.length >= 2) {
      lengthMm = dist(ent.vertices[0], ent.vertices[1]) * unitToMm;
    } else if ((type === 'LWPOLYLINE' || type === 'POLYLINE') && Array.isArray(ent.vertices)) {
      for (let i = 0; i < ent.vertices.length - 1; i++) lengthMm += dist(ent.vertices[i], ent.vertices[i + 1]) * unitToMm;
    } else if (type === 'CIRCLE' && ent.radius != null) {
      lengthMm = 2 * Math.PI * ent.radius * unitToMm; // 周长
    } else if (type === 'INSERT') {
      const name = ent.name || 'BLOCK';
      blockCount.set(name, (blockCount.get(name) || 0) + 1);
      byClass.equipment.count += 1;
      continue;
    }

    if (lengthMm > 0) {
      byClass[cls].count += 1;
      byClass[cls].totalLengthMm += lengthMm;
      segments.push({ layer, class: cls, type, lengthMm: Math.round(lengthMm * 100) / 100 });
    } else {
      byClass[cls].count += 1;
    }
  }

  // 汇总取整
  for (const k of Object.keys(byClass) as DxfElementClass[]) byClass[k].totalLengthMm = Math.round(byClass[k].totalLengthMm * 100) / 100;

  return {
    unit: unitToMm === 1 ? 'dxf-native' : `x${unitToMm}→mm`,
    layers: [...layerSet].sort(),
    byClass,
    equipmentBlocks: [...blockCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    segments,
    entityCount: entities.length,
    note: 'DXF 图层启发式归类（水管/风管/设备）；正式工程量以深化图与专业标注为准。',
  };
}
