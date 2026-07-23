import { BadRequestException } from '@nestjs/common';
import type {
  GeneratedHvacComponent,
  GeneratedHvacModel,
  GeneratedHvacSystemKey,
} from './viewer-draft.service';

export interface LegacyDesigner2dProject {
  name?: string;
  walls?: Array<{ id?: string; points?: number[] }>;
  devices?: Array<{ id?: string; type?: string; x?: number; y?: number; rotation?: number }>;
  pipes?: Array<{ id?: string; type?: string; points?: number[] }>;
  doors?: Array<{ id?: string; x?: number; y?: number; rotation?: number }>;
  windows?: Array<{ id?: string; x?: number; y?: number; rotation?: number }>;
  texts?: Array<{ id?: string; x?: number; y?: number; text?: string; size?: number }>;
}

export interface LegacyDesigner2dConversionContext {
  draftId: string;
  projectId: string | null;
  modelVersion: number;
  projectInputs: Record<string, unknown>;
  buildingInputs: Record<string, unknown>;
  systemInputs: Record<string, unknown>;
}

const GRID = 50;
const WALL_HEIGHT_M = 3;
const WALL_THICKNESS_M = 0.24;

const DEVICE_CATALOG: Record<
  string,
  {
    name: string;
    widthM: number;
    depthM: number;
    heightM: number;
    systemKey: GeneratedHvacSystemKey;
    sku: string;
    unitPrice: number;
  }
> = {
  'heat-pump': {
    name: '空气源热泵',
    widthM: 1.1,
    depthM: 0.45,
    heightM: 1.35,
    systemKey: 'cooling',
    sku: 'LEGACY-HEAT-PUMP',
    unitPrice: 28000,
  },
  boiler: {
    name: '燃气壁挂炉',
    widthM: 0.42,
    depthM: 0.32,
    heightM: 0.75,
    systemKey: 'heating',
    sku: 'LEGACY-BOILER',
    unitPrice: 16000,
  },
  fcu: {
    name: '风机盘管 FCU',
    widthM: 1.1,
    depthM: 0.44,
    heightM: 0.24,
    systemKey: 'cooling',
    sku: 'LEGACY-FCU',
    unitPrice: 1800,
  },
  radiator: {
    name: '散热器',
    widthM: 0.8,
    depthM: 0.12,
    heightM: 0.6,
    systemKey: 'heating',
    sku: 'LEGACY-RADIATOR',
    unitPrice: 800,
  },
  underfloor: {
    name: '地暖盘管区',
    widthM: 2,
    depthM: 1.6,
    heightM: 0.08,
    systemKey: 'heating',
    sku: 'LEGACY-UFH-ZONE',
    unitPrice: 2800,
  },
  ahu: {
    name: '新风主机',
    widthM: 1.3,
    depthM: 0.7,
    heightM: 0.55,
    systemKey: 'freshAir',
    sku: 'LEGACY-AHU',
    unitPrice: 12000,
  },
  'air-vent': {
    name: '风口',
    widthM: 0.36,
    depthM: 0.12,
    heightM: 0.12,
    systemKey: 'freshAir',
    sku: 'LEGACY-VENT',
    unitPrice: 220,
  },
  thermostat: {
    name: '智能温控器',
    widthM: 0.1,
    depthM: 0.02,
    heightM: 0.1,
    systemKey: 'smartControl',
    sku: 'LEGACY-THERMOSTAT',
    unitPrice: 680,
  },
  manifold: {
    name: '分集水器',
    widthM: 0.64,
    depthM: 0.16,
    heightM: 0.36,
    systemKey: 'heating',
    sku: 'LEGACY-MANIFOLD',
    unitPrice: 2200,
  },
};

const PIPE_CATALOG: Record<
  string,
  {
    name: string;
    systemKey: GeneratedHvacSystemKey;
    routeType: 'pipe-route' | 'duct-route';
    diameterMm?: number;
    width?: number;
    height?: number;
    sku: string;
    unitPrice: number;
  }
> = {
  'water-supply': {
    name: '冷热水管 PPR DN25',
    systemKey: 'water',
    routeType: 'pipe-route',
    diameterMm: 25,
    sku: 'LEGACY-PPR-DN25',
    unitPrice: 85,
  },
  'water-return': {
    name: '回水管 PPR DN25',
    systemKey: 'water',
    routeType: 'pipe-route',
    diameterMm: 25,
    sku: 'LEGACY-PPR-RETURN-DN25',
    unitPrice: 85,
  },
  refrig: {
    name: '冷媒管对·铜',
    systemKey: 'cooling',
    routeType: 'pipe-route',
    diameterMm: 19.05,
    sku: 'LEGACY-REFRIG-COPPER',
    unitPrice: 180,
  },
  'air-duct': {
    name: '风管 200x100',
    systemKey: 'freshAir',
    routeType: 'duct-route',
    width: 0.2,
    height: 0.1,
    sku: 'LEGACY-AIR-DUCT-200X100',
    unitPrice: 220,
  },
  'underfloor-loop': {
    name: '地暖管 PE-RT 16',
    systemKey: 'heating',
    routeType: 'pipe-route',
    diameterMm: 16,
    sku: 'LEGACY-UFH-PIPE-16',
    unitPrice: 28,
  },
  condensate: {
    name: '冷凝水管 PVC',
    systemKey: 'water',
    routeType: 'pipe-route',
    diameterMm: 25,
    sku: 'LEGACY-CONDENSATE-PVC',
    unitPrice: 18,
  },
};

export function normalizeLegacyDesigner2dProject(value: unknown): LegacyDesigner2dProject {
  const source = asObject(value, 'legacyDesigner2d');
  return {
    name: text(source.name),
    walls: array(source.walls).map((item) => {
      const row = asObject(item, 'walls[]');
      return { id: text(row.id), points: numericArray(row.points) };
    }),
    devices: array(source.devices).map((item) => {
      const row = asObject(item, 'devices[]');
      return {
        id: text(row.id),
        type: text(row.type),
        x: number(row.x),
        y: number(row.y),
        rotation: number(row.rotation),
      };
    }),
    pipes: array(source.pipes).map((item) => {
      const row = asObject(item, 'pipes[]');
      return { id: text(row.id), type: text(row.type), points: numericArray(row.points) };
    }),
    doors: array(source.doors).map((item) => pointObject(item, 'doors[]')),
    windows: array(source.windows).map((item) => pointObject(item, 'windows[]')),
    texts: array(source.texts).map((item) => {
      const row = asObject(item, 'texts[]');
      return {
        id: text(row.id),
        x: number(row.x),
        y: number(row.y),
        text: text(row.text),
        size: number(row.size),
      };
    }),
  };
}

export function convertLegacyDesigner2dToGeneratedModel(
  context: LegacyDesigner2dConversionContext,
  legacy: LegacyDesigner2dProject
): GeneratedHvacModel {
  const bounds = legacyBounds(legacy);
  const components: GeneratedHvacComponent[] = [];
  const prefix = `legacy-2d-v${context.modelVersion}`;
  const wallSegments: Array<{ id: string; start: Point3; end: Point3 }> = [];

  for (const wall of legacy.walls ?? []) {
    forEachSegment(wall.points, (startPx, endPx, index) => {
      const start = toPoint3(startPx, bounds, 0);
      const end = toPoint3(endPx, bounds, 0);
      const length = distance(start, end);
      if (length <= 0.05) return;
      const angle = Math.atan2(end.z - start.z, end.x - start.x);
      const id = safeId(`${prefix}-wall-${wall.id || index + 1}-${index + 1}`);
      wallSegments.push({ id, start, end });
      components.push(
        boxComponent({
          id,
          type: 'wall',
          category: 'envelope-wall',
          systemKey: 'envelope',
          modelVersion: context.modelVersion,
          name: 'Legacy 2D wall',
          x: (start.x + end.x) / 2,
          y: WALL_HEIGHT_M / 2,
          z: (start.z + end.z) / 2,
          width: round(length),
          height: WALL_HEIGHT_M,
          depth: WALL_THICKNESS_M,
          rotationY: roundDeg(-angle),
          sourceTemplateId: 'legacy-designer-wall-240',
          businessMetadata: {
            legacyDesigner2d: true,
            legacyId: wall.id ?? null,
            legacyKind: 'wall',
            wallType: 'legacy-240mm',
          },
          bomMetadata: {
            bomMappable: true,
            bomCategory: 'wall',
            quantity: round(length),
            unit: 'm',
          },
        })
      );
    });
  }

  for (const door of legacy.doors ?? []) {
    const point = toPoint3({ x: door.x, y: door.y }, bounds, 0);
    const hostWallId = nearestWall(point, wallSegments);
    components.push(
      boxComponent({
        id: safeId(`${prefix}-door-${door.id || components.length + 1}`),
        type: 'door',
        category: 'opening',
        systemKey: 'envelope',
        modelVersion: context.modelVersion,
        name: 'Legacy 2D door',
        x: point.x,
        y: 1.05,
        z: point.z,
        width: 0.9,
        height: 2.1,
        depth: 0.08,
        rotationY: normalizeLegacyRotation(door.rotation),
        sourceTemplateId: 'legacy-designer-door-900',
        businessMetadata: {
          legacyDesigner2d: true,
          legacyId: door.id ?? null,
          legacyKind: 'door',
          hostWallId,
        },
        bomMetadata: {
          bomMappable: true,
          bomCategory: 'opening',
          quantity: 1,
          unit: 'set',
        },
      })
    );
  }

  for (const window of legacy.windows ?? []) {
    const point = toPoint3({ x: window.x, y: window.y }, bounds, 0);
    const hostWallId = nearestWall(point, wallSegments);
    components.push(
      boxComponent({
        id: safeId(`${prefix}-window-${window.id || components.length + 1}`),
        type: 'window',
        category: 'opening',
        systemKey: 'envelope',
        modelVersion: context.modelVersion,
        name: 'Legacy 2D window',
        x: point.x,
        y: 1.5,
        z: point.z,
        width: 1.5,
        height: 1.2,
        depth: 0.06,
        rotationY: normalizeLegacyRotation(window.rotation),
        sourceTemplateId: 'legacy-designer-window-1500',
        businessMetadata: {
          legacyDesigner2d: true,
          legacyId: window.id ?? null,
          legacyKind: 'window',
          hostWallId,
          sillHeightM: 0.9,
        },
        bomMetadata: {
          bomMappable: true,
          bomCategory: 'opening',
          quantity: 1,
          unit: 'set',
        },
      })
    );
  }

  for (const textItem of legacy.texts ?? []) {
    if (!textItem.text) continue;
    const point = toPoint3({ x: textItem.x, y: textItem.y }, bounds, 0);
    components.push(
      boxComponent({
        id: safeId(`${prefix}-zone-${textItem.id || components.length + 1}`),
        type: 'room-zone',
        category: 'room-zone',
        systemKey: 'zone',
        modelVersion: context.modelVersion,
        name: textItem.text,
        x: point.x,
        y: 0.06,
        z: point.z,
        width: 3.2,
        height: 0.12,
        depth: 2.8,
        rotationY: 0,
        sourceTemplateId: 'legacy-designer-room-label',
        businessMetadata: {
          legacyDesigner2d: true,
          legacyId: textItem.id ?? null,
          legacyKind: 'text-room-zone',
          areaM2: 8.96,
        },
        bomMetadata: { bomMappable: false },
      })
    );
  }

  for (const device of legacy.devices ?? []) {
    const catalog = DEVICE_CATALOG[device.type ?? ''] ?? fallbackDevice(device.type);
    const point = toPoint3({ x: device.x, y: device.y }, bounds, 0);
    components.push(
      boxComponent({
        id: safeId(`${prefix}-equipment-${device.id || components.length + 1}`),
        type: 'equipment',
        category: 'hvac-equipment',
        systemKey: catalog.systemKey,
        modelVersion: context.modelVersion,
        name: catalog.name,
        x: point.x,
        y: catalog.heightM / 2,
        z: point.z,
        width: catalog.widthM,
        height: catalog.heightM,
        depth: catalog.depthM,
        rotationY: normalizeLegacyRotation(device.rotation),
        sourceTemplateId: `legacy-designer-device-${device.type || 'unknown'}`,
        businessMetadata: {
          legacyDesigner2d: true,
          legacyId: device.id ?? null,
          legacyKind: 'device',
          legacyType: device.type ?? null,
          bomSkuHint: catalog.sku,
          unitPrice: catalog.unitPrice,
        },
        bomMetadata: {
          bomMappable: true,
          bomCategory: 'equipment',
          bomSkuHint: catalog.sku,
          quantity: 1,
          unit: 'set',
        },
      })
    );
  }

  for (const pipe of legacy.pipes ?? []) {
    const catalog = PIPE_CATALOG[pipe.type ?? ''] ?? fallbackPipe(pipe.type);
    const points = pointPairs(pipe.points).map((point) =>
      toPoint3(point, bounds, catalog.routeType === 'duct-route' ? 2.4 : 0.95)
    );
    if (points.length < 2) continue;
    const lengthM = round(routeLength(points));
    components.push(
      routeComponent({
        id: safeId(`${prefix}-route-${pipe.id || components.length + 1}`),
        type: catalog.routeType,
        category: catalog.routeType === 'duct-route' ? 'duct-route' : 'pipe-route',
        systemKey: catalog.systemKey,
        modelVersion: context.modelVersion,
        name: catalog.name,
        points,
        sourceTemplateId: `legacy-designer-pipe-${pipe.type || 'unknown'}`,
        diameterMm: catalog.diameterMm,
        width: catalog.width,
        height: catalog.height,
        businessMetadata: {
          legacyDesigner2d: true,
          legacyId: pipe.id ?? null,
          legacyKind: 'pipe',
          legacyType: pipe.type ?? null,
          estimatedLengthM: lengthM,
          bomSkuHint: catalog.sku,
          unitPrice: catalog.unitPrice,
        },
        bomMetadata: {
          bomMappable: true,
          bomCategory: catalog.routeType,
          bomSkuHint: catalog.sku,
          quantity: lengthM,
          unit: 'm',
          estimatedLengthM: lengthM,
        },
      })
    );
  }

  if (!components.length) {
    throw new BadRequestException('legacy 2D drawing has no convertible components');
  }

  return {
    id: `${context.draftId}-legacy-2d-v${context.modelVersion}`,
    sourceType: 'generated',
    modelType: 'parametric-hvac',
    modelVersion: context.modelVersion,
    draftId: context.draftId,
    projectId: context.projectId,
    generatedAt: new Date().toISOString(),
    layers: [],
    components,
    componentSummary: {
      total: components.length,
      byType: {},
      bySystem: {},
      byStatus: {},
      bomMappableComponentIds: [],
    },
    inputs: {
      project: {
        ...context.projectInputs,
        name: legacy.name ?? context.projectInputs.name,
        source: 'legacy-designer-2d',
      },
      building: context.buildingInputs,
      systems: context.systemInputs,
    },
  };
}

type Point2 = { x?: number; y?: number };
type Point3 = { x: number; y: number; z: number };

function boxComponent(input: {
  id: string;
  type: GeneratedHvacComponent['type'];
  category: string;
  systemKey: GeneratedHvacSystemKey;
  modelVersion: number;
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotationY: number;
  sourceTemplateId: string;
  businessMetadata: Record<string, unknown>;
  bomMetadata: Record<string, unknown>;
}): GeneratedHvacComponent {
  return componentBase(input, {
    kind: 'box',
    x: round(input.x),
    y: round(input.y),
    z: round(input.z),
    width: round(input.width),
    height: round(input.height),
    depth: round(input.depth),
  });
}

function routeComponent(input: {
  id: string;
  type: 'pipe-route' | 'duct-route';
  category: string;
  systemKey: GeneratedHvacSystemKey;
  modelVersion: number;
  name: string;
  points: Point3[];
  sourceTemplateId: string;
  diameterMm?: number;
  width?: number;
  height?: number;
  businessMetadata: Record<string, unknown>;
  bomMetadata: Record<string, unknown>;
}): GeneratedHvacComponent {
  return componentBase(
    {
      ...input,
      x: input.points[0]?.x ?? 0,
      y: input.points[0]?.y ?? 0,
      z: input.points[0]?.z ?? 0,
      width: input.width ?? input.diameterMm ?? 1,
      height: input.height ?? input.diameterMm ?? 1,
      depth: routeLength(input.points),
      rotationY: 0,
    },
    {
      kind: 'polyline',
      ...(input.diameterMm ? { diameterMm: input.diameterMm } : {}),
      ...(input.width ? { width: input.width } : {}),
      ...(input.height ? { height: input.height } : {}),
      points: input.points,
    }
  );
}

function componentBase(
  input: {
    id: string;
    type: GeneratedHvacComponent['type'];
    category: string;
    systemKey: GeneratedHvacSystemKey;
    modelVersion: number;
    name: string;
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    depth: number;
    rotationY: number;
    sourceTemplateId: string;
    businessMetadata: Record<string, unknown>;
    bomMetadata: Record<string, unknown>;
  },
  geometry: Record<string, unknown>
): GeneratedHvacComponent {
  return {
    id: input.id,
    draftId: '',
    modelId: '',
    modelSourceId: null,
    sourceTemplateId: input.sourceTemplateId,
    type: input.type,
    category: input.category,
    systemKey: input.systemKey,
    modelVersion: input.modelVersion,
    version: input.modelVersion,
    name: input.name,
    displayName: input.name,
    geometry,
    dimensions: withoutUndefined({
      width: round(input.width),
      height: round(input.height),
      depth: round(input.depth),
      estimatedLengthM: input.type === 'pipe-route' || input.type === 'duct-route' ? round(input.depth) : undefined,
    }),
    position: { x: round(input.x), y: round(input.y), z: round(input.z) },
    rotation: { x: 0, y: input.rotationY, z: 0 },
    visibility: 'visible',
    locked: false,
    floor: 1,
    elevation: round(input.y),
    installHeight: round(input.y),
    businessMetadata: input.businessMetadata,
    bomMetadata: input.bomMetadata,
    status: 'active',
  };
}

function legacyBounds(legacy: LegacyDesigner2dProject) {
  const points: Point2[] = [];
  for (const wall of legacy.walls ?? []) points.push(...pointPairs(wall.points));
  for (const pipe of legacy.pipes ?? []) points.push(...pointPairs(pipe.points));
  for (const item of [...(legacy.devices ?? []), ...(legacy.doors ?? []), ...(legacy.windows ?? []), ...(legacy.texts ?? [])]) {
    points.push({ x: item.x, y: item.y });
  }
  const xs = points.map((point) => Number(point.x)).filter(Number.isFinite);
  const ys = points.map((point) => Number(point.y)).filter(Number.isFinite);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : GRID * 10;
  const minY = ys.length ? Math.min(...ys) : 0;
  const maxY = ys.length ? Math.max(...ys) : GRID * 8;
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

function toPoint3(point: Point2, bounds: { centerX: number; centerY: number }, y: number): Point3 {
  return {
    x: round((number(point.x) - bounds.centerX) / GRID),
    y,
    z: round((number(point.y) - bounds.centerY) / GRID),
  };
}

function forEachSegment(
  points: number[] | undefined,
  cb: (start: Point2, end: Point2, index: number) => void
) {
  const pairs = pointPairs(points);
  for (let index = 1; index < pairs.length; index += 1) cb(pairs[index - 1], pairs[index], index - 1);
}

function pointPairs(points: number[] | undefined): Point2[] {
  const values = numericArray(points);
  const pairs: Point2[] = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    pairs.push({ x: values[index], y: values[index + 1] });
  }
  return pairs;
}

function nearestWall(point: Point3, walls: Array<{ id: string; start: Point3; end: Point3 }>) {
  let best: { id: string; distance: number } | null = null;
  for (const wall of walls) {
    const d = distanceToSegment(point, wall.start, wall.end);
    if (!best || d < best.distance) best = { id: wall.id, distance: d };
  }
  return best && best.distance <= 0.8 ? best.id : null;
}

function distanceToSegment(point: Point3, start: Point3, end: Point3) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const len2 = dx * dx + dz * dz;
  if (len2 === 0) return distance(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / len2));
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz));
}

function routeLength(points: Point3[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index - 1], points[index]);
  }
  return round(total);
}

function distance(a: Point3, b: Point3) {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function fallbackDevice(type?: string) {
  return {
    name: type ? `Legacy device ${type}` : 'Legacy 2D equipment',
    widthM: 0.8,
    depthM: 0.5,
    heightM: 0.5,
    systemKey: inferSystemKey(type ?? ''),
    sku: `LEGACY-DEVICE-${safeId(type || 'UNKNOWN').toUpperCase()}`,
    unitPrice: 0,
  };
}

function fallbackPipe(type?: string) {
  const isDuct = /duct|风管/i.test(type ?? '');
  return {
    name: type ? `Legacy route ${type}` : 'Legacy 2D route',
    systemKey: inferSystemKey(type ?? ''),
    routeType: isDuct ? 'duct-route' as const : 'pipe-route' as const,
    diameterMm: isDuct ? undefined : 25,
    width: isDuct ? 0.2 : undefined,
    height: isDuct ? 0.1 : undefined,
    sku: `LEGACY-ROUTE-${safeId(type || 'UNKNOWN').toUpperCase()}`,
    unitPrice: 0,
  };
}

function inferSystemKey(textValue: string): GeneratedHvacSystemKey {
  if (/floor|radiator|boiler|heat|采暖|地暖/i.test(textValue)) return 'heating';
  if (/fresh|duct|vent|ahu|新风|风管|风口/i.test(textValue)) return 'freshAir';
  if (/water|condensate|水|冷凝/i.test(textValue)) return 'water';
  if (/thermostat|control|温控|智能/i.test(textValue)) return 'smartControl';
  return 'cooling';
}

function normalizeLegacyRotation(value: unknown) {
  const n = number(value);
  return Math.max(-360, Math.min(360, -n));
}

function pointObject(item: unknown, field: string) {
  const row = asObject(item, field);
  return { id: text(row.id), x: number(row.x), y: number(row.y), rotation: number(row.rotation) };
}

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (value == null) return {};
  throw new BadRequestException(`${field} must be an object`);
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function numericArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => number(item)).filter((item) => Number.isFinite(item))
    : [];
}

function text(value: unknown): string | undefined {
  const next = value == null ? '' : String(value).trim();
  return next || undefined;
}

function number(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeId(value: string) {
  const next = String(value || 'legacy')
    .trim()
    .replace(/[^a-zA-Z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return next || 'legacy';
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function roundDeg(value: number) {
  return Math.round((value * 180) / Math.PI);
}

function withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
