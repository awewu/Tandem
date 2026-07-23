import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { parseIfcElementGeometry } from './ifc-geometry';

/**
 * Sprint 5.1 · Revit 插件云端能力统一契约
 *
 * 为 Revit 插件提供碰撞检测、IFC 导出、工程量统计（BOQ）等云端能力。
 * clash/boq 已接入真实几何算法（AABB 相交/间距、包围盒量算）；IFC 导出仍待引擎。
 * IFC 真实几何：clashFromIfc / clearanceAnalysis 用 web-ifc 解析真实网格 AABB（取代客户端包围盒）。
 */

type ElementType = 'pipe' | 'duct' | 'equipment' | 'structural';

export interface ClashElement {
  id: string;
  type: ElementType;
  boundingBox: { min: number[]; max: number[] };
}

export interface ClashInput {
  projectId: string;
  elements: ClashElement[];
  /** 软碰撞净距阈值(mm)，默认 50mm（间距在此内视为软碰撞/间隙不足） */
  clearanceMm?: number;
}

export interface ClashResult {
  hardCollisions: number;
  softCollisions: number;
  collisions: Array<{
    elementA: string;
    elementB: string;
    type: 'hard' | 'soft';
    distanceMm: number;
    position: { x: number; y: number; z: number };
  }>;
  elapsedMs: number;
}

export interface IfcExportInput {
  projectId: string;
  format: 'IFC2X3' | 'IFC4';
}

export interface IfcExportResult {
  downloadUrl: string;
  format: string;
  sizeBytes: number;
  generatedAt: string;
}

export interface BoqInput {
  projectId: string;
  /** 优先：来自 Revit/BIM 的几何构件（按包围盒量算长度/计数） */
  elements?: ClashElement[];
  /** 次选：面积 + 选定系统（按系统系数量算） */
  area?: number;
  systems?: string[];
}

export interface BoqResult {
  method: 'geometry' | 'coefficient' | 'empty';
  items: Array<{
    category: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  note?: string;
}

@Injectable()
export class CloudCapabilityService {
  private readonly logger = new Logger(CloudCapabilityService.name);

  /**
   * 真实碰撞检测：对构件包围盒(AABB)做两两相交/净距计算。
   * 硬碰撞=包围盒相交（净距=0）；软碰撞=净距 >0 且 ≤ clearanceMm（间隙不足）。
   * O(n²) 直算，适用于插件单次提交的构件规模；超大规模再引 BVH/空间索引优化。
   */
  async clashDetection(input: ClashInput): Promise<ClashResult> {
    const t0 = Date.now();
    const els = Array.isArray(input.elements) ? input.elements : [];
    const clearance = Number(input.clearanceMm) > 0 ? Number(input.clearanceMm) : 50;
    this.logger.log(`[clash] project=${input.projectId} elements=${els.length} clearance=${clearance}mm`);

    const valid = els.filter(
      (e) => e?.boundingBox && Array.isArray(e.boundingBox.min) && Array.isArray(e.boundingBox.max)
        && e.boundingBox.min.length >= 3 && e.boundingBox.max.length >= 3,
    );
    const collisions: ClashResult['collisions'] = [];
    let hard = 0;
    let soft = 0;

    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const a = valid[i].boundingBox;
        const b = valid[j].boundingBox;
        // 逐轴间隙：>0 表示该轴分离，=0 表示该轴重叠
        let sq = 0;
        let separated = false;
        for (let ax = 0; ax < 3; ax++) {
          const gap = Math.max(a.min[ax] - b.max[ax], b.min[ax] - a.max[ax], 0);
          if (gap > 0) { separated = true; sq += gap * gap; }
        }
        const distanceMm = separated ? Math.round(Math.sqrt(sq) * 100) / 100 : 0;
        if (distanceMm > clearance) continue; // 净距足够，非碰撞
        const type: 'hard' | 'soft' = distanceMm === 0 ? 'hard' : 'soft';
        {
          if (type === 'hard') hard++; else soft++;
          const cx = (Math.max(a.min[0], b.min[0]) + Math.min(a.max[0], b.max[0])) / 2;
          const cy = (Math.max(a.min[1], b.min[1]) + Math.min(a.max[1], b.max[1])) / 2;
          const cz = (Math.max(a.min[2], b.min[2]) + Math.min(a.max[2], b.max[2])) / 2;
          collisions.push({
            elementA: valid[i].id, elementB: valid[j].id, type, distanceMm,
            position: { x: Math.round(cx), y: Math.round(cy), z: Math.round(cz) },
          });
        }
      }
    }

    return { hardCollisions: hard, softCollisions: soft, collisions, elapsedMs: Date.now() - t0 };
  }

  async exportIfc(input: IfcExportInput): Promise<IfcExportResult> {
    this.logger.log(`[ifc] project=${input.projectId} format=${input.format}`);
    // TODO: 调用 ThatOpen/IFC 生成引擎
    return {
      downloadUrl: `/api/rysnova-bim/cloud/ifc/${input.projectId}.ifc`,
      format: input.format,
      sizeBytes: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  // 系统辅材面积系数（与 design BOM 口径一致）：管路 m/㎡。
  private static readonly PIPE_PER_AREA: Record<string, { label: string; coef: number }> = {
    hotWater: { label: '热水管路', coef: 0.42 },
    water: { label: '净水管路', coef: 0.18 },
    heating: { label: '采暖管路', coef: 0.72 },
    airConditioning: { label: '制冷管路', coef: 0.48 },
    freshAir: { label: '新风风管', coef: 0.55 },
    humidity: { label: '除湿风管', coef: 0.30 },
    control: { label: '控制线路', coef: 0.08 },
  };

  /**
   * 真实工程量统计（BOQ）：
   *  - 优先 geometry：从构件包围盒量算——管/风管取包围盒最长边求和(→m)，设备计数(→台)；
   *  - 次选 coefficient：按面积×系统系数量算管路长度；
   *  - 都无 → empty（诚实空，不臆造）。
   */
  async billOfQuantities(input: BoqInput): Promise<BoqResult> {
    const els = Array.isArray(input.elements) ? input.elements : [];
    this.logger.log(`[boq] project=${input.projectId} elements=${els.length} area=${input.area ?? '-'}`);

    if (els.length) {
      const lenByType: Record<string, number> = {};
      const countByType: Record<string, number> = {};
      for (const e of els) {
        const bb = e?.boundingBox;
        if (bb && Array.isArray(bb.min) && Array.isArray(bb.max) && bb.min.length >= 3) {
          if (e.type === 'pipe' || e.type === 'duct') {
            const dims = [bb.max[0] - bb.min[0], bb.max[1] - bb.min[1], bb.max[2] - bb.min[2]].map((d) => Math.abs(d));
            lenByType[e.type] = (lenByType[e.type] || 0) + Math.max(...dims) / 1000; // mm→m
          } else {
            countByType[e.type] = (countByType[e.type] || 0) + 1;
          }
        } else {
          countByType[e.type] = (countByType[e.type] || 0) + 1;
        }
      }
      const items: BoqResult['items'] = [];
      if (lenByType.pipe) items.push({ category: 'pipe', name: '水管', quantity: Math.round(lenByType.pipe * 100) / 100, unit: 'm' });
      if (lenByType.duct) items.push({ category: 'duct', name: '风管', quantity: Math.round(lenByType.duct * 100) / 100, unit: 'm' });
      if (countByType.equipment) items.push({ category: 'equipment', name: '设备', quantity: countByType.equipment, unit: '台' });
      if (countByType.structural) items.push({ category: 'structural', name: '结构构件', quantity: countByType.structural, unit: '件' });
      return { method: 'geometry', items, note: '按 BIM 构件包围盒量算（管线取最长边，设备计数）' };
    }

    const area = Number(input.area) || 0;
    const systems = Array.isArray(input.systems) ? input.systems : [];
    if (area > 0 && systems.length) {
      const items: BoqResult['items'] = systems
        .map((s) => CloudCapabilityService.PIPE_PER_AREA[s])
        .filter(Boolean)
        .map((cfg) => ({ category: 'pipe', name: cfg.label, quantity: Math.round(area * cfg.coef * 100) / 100, unit: 'm' }));
      return { method: 'coefficient', items, note: '按面积×系统系数量算（工程估算，正式量以深化图为准）' };
    }

    return { method: 'empty', items: [], note: '未提供 elements(几何) 或 area+systems，无法量算' };
  }

  /** ifcBase64 → 真实网格 AABB（mm）；web-ifc 输出 Y-up。 */
  private async ifcToElements(ifcBase64: string, unitToMm: number) {
    if (!ifcBase64 || typeof ifcBase64 !== 'string') throw new BadRequestException('需提供 ifcBase64');
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(Buffer.from(ifcBase64, 'base64')); } catch { throw new BadRequestException('ifcBase64 解码失败'); }
    if (!bytes.length) throw new BadRequestException('IFC 内容为空');
    const { elements } = await parseIfcElementGeometry(bytes);
    return elements.map((e) => ({
      id: e.name || `#${e.expressID}`,
      ifcType: e.ifcType,
      triangleCount: e.triangleCount,
      boundingBoxMm: {
        min: e.boundingBox.min.map((v) => Math.round(v * unitToMm * 100) / 100) as number[],
        max: e.boundingBox.max.map((v) => Math.round(v * unitToMm * 100) / 100) as number[],
      },
    }));
  }

  private classify(ifcType: string, name: string | null): ElementType {
    const s = `${ifcType} ${name ?? ''}`.toLowerCase();
    if (/duct|风管|风/.test(s)) return 'duct';
    if (/pipe|水管|管/.test(s)) return 'pipe';
    if (/slab|floor|beam|column|wall|楼板|梁|柱|墙|板/.test(s)) return 'structural';
    return 'equipment';
  }

  /**
   * IFC 真实几何碰撞：解析 IFC → 每构件真实网格 AABB(mm) → 复用 AABB 相交/净距检测。
   * 取代客户端上报包围盒的近似。unitToMm 默认 1000（IFC 通常以米为单位）。
   */
  async clashFromIfc(input: { projectId?: string; ifcBase64: string; clearanceMm?: number; unitToMm?: number }): Promise<ClashResult & { source: string; elementCount: number }> {
    const unitToMm = Number(input.unitToMm) > 0 ? Number(input.unitToMm) : 1000;
    const parsed = await this.ifcToElements(input.ifcBase64, unitToMm);
    const elements: ClashElement[] = parsed.map((e) => ({
      id: e.id, type: this.classify(e.ifcType, e.id), boundingBox: e.boundingBoxMm,
    }));
    this.logger.log(`[clash-ifc] project=${input.projectId ?? '-'} elements=${elements.length}`);
    const res = await this.clashDetection({ projectId: input.projectId ?? 'ifc', elements, clearanceMm: input.clearanceMm });
    return { ...res, source: 'ifc-geometry', elementCount: elements.length };
  }

  /**
   * 净高分析：楼板顶面(结构件顶) 与 上方 MEP 构件底 之间的净空。
   * web-ifc 输出 Y-up → 垂直轴取 Y(index 1)。低于 minHeadroomMm 记为不达标。
   */
  async clearanceAnalysis(input: { projectId?: string; ifcBase64: string; minHeadroomMm?: number; unitToMm?: number }) {
    const unitToMm = Number(input.unitToMm) > 0 ? Number(input.unitToMm) : 1000;
    const minHeadroom = Number(input.minHeadroomMm) > 0 ? Number(input.minHeadroomMm) : 2400; // 默认 2.4m
    const parsed = await this.ifcToElements(input.ifcBase64, unitToMm);
    const UP = 1; // Y 轴为垂直方向

    const floors = parsed.filter((e) => this.classify(e.ifcType, e.id) === 'structural');
    const mep = parsed.filter((e) => ['duct', 'pipe'].includes(this.classify(e.ifcType, e.id)));
    if (!floors.length) {
      return { success: true, implemented: true, data: { method: 'ifc-clearance', minHeadroomMm: minHeadroom, note: '未识别到楼板/结构件，无法定基准面', floorTopMm: null, items: [] } };
    }
    // 基准楼板顶面：结构件的最高顶面（取最大 max[UP]）
    const floorTopMm = Math.max(...floors.map((f) => f.boundingBoxMm.max[UP]));

    const items = mep.map((m) => {
      const bottom = m.boundingBoxMm.min[UP];
      const clearanceMm = Math.round((bottom - floorTopMm) * 100) / 100;
      return {
        element: m.id, ifcType: m.ifcType,
        bottomMm: bottom, clearanceMm,
        ok: clearanceMm >= minHeadroom,
        deficitMm: clearanceMm >= minHeadroom ? 0 : Math.round((minHeadroom - clearanceMm) * 100) / 100,
      };
    }).sort((a, b) => a.clearanceMm - b.clearanceMm);

    const violations = items.filter((i) => !i.ok);
    this.logger.log(`[clearance-ifc] project=${input.projectId ?? '-'} floors=${floors.length} mep=${mep.length} violations=${violations.length}`);
    return {
      success: true,
      implemented: true,
      data: {
        method: 'ifc-clearance',
        minHeadroomMm: minHeadroom,
        floorTopMm,
        mepCount: mep.length,
        violationCount: violations.length,
        items,
        note: '净高=MEP构件底-楼板顶(Y轴)；低于阈值记为不达标。示意级，正式以深化图为准。',
      },
    };
  }
}
