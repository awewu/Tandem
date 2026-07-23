import type {
  GeneratedHvacComponent,
  GeneratedHvacComponentPayload,
  GeneratedHvacModel,
  ViewerComponentCatalogTemplate,
} from '../../lib/api';

export type PlacementPoint = { x: number; y: number; z: number };
export type CatalogTemplateDefaultOverrides = Record<string, string | number | boolean>;
export type PlacementInstallClass = 'indoor' | 'outdoor';
export type PlacementConstraintState = 'ready' | 'degraded';
export type RouteDraftPoint = PlacementPoint;
export type RouteEndpointKey = 'from' | 'to';
export type RouteEndpointRole = 'source' | 'target';
export type RouteEndpointAttachmentKind = 'connector' | 'anchor';
export type RouteEndpointConnectionStatus = 'connected' | 'disconnected' | 'stale';
export type RouteEndpointRef = {
  endpointKey: RouteEndpointKey;
  endpointRole: RouteEndpointRole;
  equipmentId: string;
  equipmentRole: RouteEndpointRole;
  attachmentKind: RouteEndpointAttachmentKind;
  attachmentId: string;
  status: RouteEndpointConnectionStatus;
  point: PlacementPoint;
  systemKey: GeneratedHvacComponent['systemKey'];
  routeType: 'pipe-route' | 'duct-route';
  distanceM?: number;
  fallbackReason?: string;
  staleReason?: string;
};
export type RouteEndpointRefs = Partial<Record<RouteEndpointKey, RouteEndpointRef>>;
export type RouteEndpointSnapCandidate = RouteEndpointRef & {
  distanceM: number;
  label: string;
};
export type RouteDraftPlacement = {
  floor?: unknown;
  floorHeight?: unknown;
  visibility?: 'visible' | 'hidden';
  locked?: boolean;
};
export type RouteDraftShapeInput = RouteDraftPlacement & {
  points: RouteDraftPoint[];
  systemKey: GeneratedHvacComponent['systemKey'];
  routeType: 'pipe-route' | 'duct-route';
  size: Record<string, unknown>;
  material?: unknown;
  insulation?: Record<string, unknown> | null;
  bendRadius?: Record<string, unknown> | null;
  endpointRefs?: RouteEndpointRefs | Record<string, unknown>;
  bomMapping?: Record<string, unknown>;
};
export type ManualRiserDraftInput = {
  points: RouteDraftPoint[];
  sourceFloor: number;
  targetFloor: number;
  point: { x: number; z: number };
  installHeight: number;
  floorHeight?: unknown;
};
export type PlacementFootprintBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
export type PlacementConstraintResult = {
  point: PlacementPoint;
  valid: boolean;
  state: PlacementConstraintState;
  installClass: PlacementInstallClass;
  marginM: number;
  bounds: PlacementFootprintBounds;
};
export type TemplateDropTransferData = {
  id: string;
  type?: string;
  systemKey?: string;
  floor?: number;
  elevation?: number;
  installHeight?: number;
};

export function parseTemplateDropId(value: string): string {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value) as { id?: unknown };
    return typeof parsed.id === 'string' ? parsed.id : value;
  } catch {
    return value;
  }
}

export function parseTemplateDropData(value: string): TemplateDropTransferData {
  if (!value) return { id: '' };
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      id: typeof parsed.id === 'string' ? parsed.id : value,
      type: typeof parsed.type === 'string' ? parsed.type : undefined,
      systemKey: typeof parsed.systemKey === 'string' ? parsed.systemKey : undefined,
      floor: optionalNumber(parsed.floor),
      elevation: optionalNumber(parsed.elevation),
      installHeight: optionalNumber(parsed.installHeight),
    };
  } catch {
    return { id: value };
  }
}

export function placementElevationFrom(input: {
  floor?: unknown;
  elevation?: unknown;
  installHeight?: unknown;
  floorHeight?: unknown;
  fallbackElevation?: unknown;
}): number {
  const explicitElevation = optionalNumber(input.elevation);
  if (explicitElevation !== undefined) return roundCoord(Math.max(0, explicitElevation));
  const installHeight = optionalNumber(input.installHeight);
  if (installHeight !== undefined) {
    const floor = integerRange(input.floor, 1, 99, 1);
    return roundCoord((floor - 1) * positive(input.floorHeight, 3) + Math.max(0, installHeight));
  }
  return roundCoord(Math.max(0, numberValue(input.fallbackElevation, 0)));
}

export function placementPointerOffset(anchor: PlacementPoint, pointer: PlacementPoint): PlacementPoint {
  return {
    x: roundCoord(anchor.x - pointer.x),
    y: roundCoord(anchor.y - pointer.y),
    z: roundCoord(anchor.z - pointer.z),
  };
}

export function applyPlacementPointerOffset(
  pointer: PlacementPoint,
  offset: PlacementPoint
): PlacementPoint {
  return {
    x: roundCoord(pointer.x + offset.x),
    y: roundCoord(pointer.y + offset.y),
    z: roundCoord(pointer.z + offset.z),
  };
}

export function appendOrthogonalRouteDraftPoint(
  points: RouteDraftPoint[],
  nextPoint: RouteDraftPoint
): RouteDraftPoint[] {
  const next = asPoint(nextPoint);
  if (points.length === 0) return [next];
  const normalized = points.map(asPoint);
  const last = normalized[normalized.length - 1];
  if (sameRoutePoint(last, next)) return normalized;
  const additions: RouteDraftPoint[] = [];
  const dx = Math.abs(next.x - last.x);
  const dz = Math.abs(next.z - last.z);
  if (dx > 0.001 && dz > 0.001) {
    additions.push(
      dx >= dz ? { x: next.x, y: last.y, z: last.z } : { x: last.x, y: last.y, z: next.z }
    );
  }
  additions.push({ x: next.x, y: last.y, z: next.z });
  return appendRoutePoints(normalized, additions);
}

export function routeDraftCanFinish(points: RouteDraftPoint[]): boolean {
  return routeLength(compactRoutePoints(points)) !== undefined;
}

export function findRouteEndpointSnapCandidate(input: {
  model: GeneratedHvacModel;
  point: PlacementPoint;
  systemKey: GeneratedHvacComponent['systemKey'];
  routeType: 'pipe-route' | 'duct-route';
  endpointKey: RouteEndpointKey;
  maxDistanceM?: unknown;
}): RouteEndpointSnapCandidate | null {
  const maxDistanceM = positive(input.maxDistanceM, 0.75);
  let best: RouteEndpointSnapCandidate | null = null;
  for (const component of input.model.components) {
    if (!isConnectableEquipment(component)) continue;
    for (const candidate of equipmentEndpointCandidates(component, input)) {
      const distanceM = distanceBetween(input.point, candidate.point);
      if (distanceM > maxDistanceM) continue;
      const next = { ...candidate, distanceM: roundCoord(distanceM) };
      if (!best || next.distanceM < best.distanceM) best = next;
    }
  }
  return best;
}

export function routeEndpointRefsWithCandidate(
  current: RouteEndpointRefs | Record<string, unknown> | undefined,
  endpointKey: RouteEndpointKey,
  candidate: RouteEndpointSnapCandidate | null
): RouteEndpointRefs {
  const refs = normalizeRouteEndpointRefs(current);
  if (candidate) {
    refs[endpointKey] = {
      ...candidate,
      status: 'connected',
      distanceM: candidate.distanceM,
    };
    return refs;
  }
  const previous = refs[endpointKey];
  if (previous) {
    refs[endpointKey] = {
      ...previous,
      status: 'disconnected',
      staleReason: 'route-endpoint-moved-without-compatible-equipment',
    };
  }
  return refs;
}

export function normalizeRouteEndpointRefs(
  value: RouteEndpointRefs | Record<string, unknown> | undefined
): RouteEndpointRefs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return {
    ...(isEndpointRef((value as Record<string, unknown>).from)
      ? { from: (value as Record<string, RouteEndpointRef>).from }
      : {}),
    ...(isEndpointRef((value as Record<string, unknown>).to)
      ? { to: (value as Record<string, RouteEndpointRef>).to }
      : {}),
  };
}

export function moveRoutePoint(
  points: RouteDraftPoint[],
  pointIndex: number,
  point: RouteDraftPoint
): RouteDraftPoint[] {
  const normalized = points.map(asPoint);
  if (pointIndex < 0 || pointIndex >= normalized.length) return compactRoutePoints(normalized);
  const current = normalized[pointIndex];
  normalized[pointIndex] = {
    x: roundCoord(point.x),
    y: current.y,
    z: roundCoord(point.z),
  };
  return compactRoutePoints(normalized);
}

export function insertRoutePointOnSegment(
  points: RouteDraftPoint[],
  insertAfterIndex: number,
  point: RouteDraftPoint
): RouteDraftPoint[] {
  const normalized = points.map(asPoint);
  if (insertAfterIndex < 0 || insertAfterIndex >= normalized.length - 1) {
    return compactRoutePoints(normalized);
  }
  const start = normalized[insertAfterIndex];
  const next = {
    x: roundCoord(point.x),
    y: start.y,
    z: roundCoord(point.z),
  };
  return compactRoutePoints([
    ...normalized.slice(0, insertAfterIndex + 1),
    next,
    ...normalized.slice(insertAfterIndex + 1),
  ]);
}

export function deleteIntermediateRoutePoint(
  points: RouteDraftPoint[],
  pointIndex: number
): RouteDraftPoint[] | null {
  const normalized = points.map(asPoint);
  if (pointIndex <= 0 || pointIndex >= normalized.length - 1) return null;
  const next = compactRoutePoints([
    ...normalized.slice(0, pointIndex),
    ...normalized.slice(pointIndex + 1),
  ]);
  return routeDraftCanFinish(next) ? next : null;
}

export function buildLogicalRouteShapeFromDraft(input: RouteDraftShapeInput) {
  const points = compactRoutePoints(input.points);
  const floorHeight = positive(input.floorHeight, 3);
  const fallbackFloor = integerRange(input.floor, 1, 99, floorFromElevation(points[0]?.y ?? 0, floorHeight));
  const floors = routeFloorParticipation(points, floorHeight, fallbackFloor);
  const bendRadius = normalizeBendRadius(input.bendRadius);
  const totalLengthM = routeLength(points, bendRadius) ?? 0;
  return {
    kind: 'logical-route' as const,
    coordinateSystem: {
      planeAxes: ['x', 'z'] as ['x', 'z'],
      elevationAxis: 'y' as const,
      ySemantics: 'absolute-model-elevation-m' as const,
    },
    points,
    floors,
    crossFloorTransitions: [],
    systemKey: input.systemKey,
    routeType: input.routeType,
    size: input.size,
    material:
      input.material === undefined || input.material === null || input.material === ''
        ? null
        : String(input.material),
    insulation: input.insulation ?? null,
    bendRadius,
    endpointRefs: input.endpointRefs ?? {},
    visibility: input.visibility ?? 'visible',
    locked: input.locked ?? false,
    lockState: (input.locked ? 'locked' : 'unlocked') as 'locked' | 'unlocked',
    bomMapping: {
      ...(input.bomMapping ?? {}),
      quantity: totalLengthM,
      totalLengthM,
    },
    summary: {
      pointCount: points.length,
      floorCount: floors.length,
      transitionCount: 0,
      totalLengthM,
    },
  };
}

export function appendManualRiserToRouteDraft(input: ManualRiserDraftInput): RouteDraftPoint[] {
  const floorHeight = positive(input.floorHeight, 3);
  const source = {
    x: roundCoord(input.point.x),
    y: roundCoord((input.sourceFloor - 1) * floorHeight + Math.max(0, input.installHeight)),
    z: roundCoord(input.point.z),
  };
  const target = {
    x: source.x,
    y: roundCoord((input.targetFloor - 1) * floorHeight + Math.max(0, input.installHeight)),
    z: source.z,
  };
  if (input.sourceFloor === input.targetFloor) return compactRoutePoints(input.points);
  return appendRoutePoints(compactRoutePoints(input.points), [source, target]);
}

export function installHeightFromElevation(input: {
  floor?: unknown;
  elevation?: unknown;
  floorHeight?: unknown;
  fallback?: unknown;
}): number {
  const floor = integerRange(input.floor, 1, 99, 1);
  const elevation = numberValue(input.elevation, numberValue(input.fallback, 0));
  const floorHeight = positive(input.floorHeight, 3);
  return roundCoord(Math.max(0, elevation - (floor - 1) * floorHeight));
}

export function componentPlacementAnchor(component: GeneratedHvacComponent): PlacementPoint {
  const geometry = component.geometry ?? {};
  const position = component.position ?? {};
  if (
    (component.type === 'pipe-route' || component.type === 'duct-route') &&
    Array.isArray(geometry.points) &&
    geometry.points[0]
  ) {
    return asPoint(geometry.points[0]);
  }
  return {
    x: numberValue(geometry.x ?? position.x, 0),
    y: numberValue(
      component.elevation ?? geometry.y ?? position.y,
      numberValue(geometry.y ?? position.y, 0)
    ),
    z: numberValue(geometry.z ?? position.z, 0),
  };
}

export function constrainPlacementPoint(input: {
  model: GeneratedHvacModel;
  point: PlacementPoint;
  component?: GeneratedHvacComponent;
  template?: ViewerComponentCatalogTemplate;
  defaultOverrides?: CatalogTemplateDefaultOverrides;
  floor?: unknown;
  outsidePlacementMarginM?: unknown;
}): PlacementConstraintResult {
  const installClass = input.component
    ? componentInstallClass(input.component)
    : templateInstallClass(input.template, input.defaultOverrides);
  const marginM =
    installClass === 'outdoor' ? normalizedOutsidePlacementMargin(input.outsidePlacementMarginM) : 0;
  const footprint = buildingFootprintBounds(input.model, input.floor);
  const bounds = expandBounds(footprint.bounds, marginM);
  const point = {
    x: clampCoord(input.point.x, bounds.minX, bounds.maxX),
    y: roundCoord(input.point.y),
    z: clampCoord(input.point.z, bounds.minZ, bounds.maxZ),
  };
  return {
    point,
    valid: point.x === roundCoord(input.point.x) && point.z === roundCoord(input.point.z),
    state: footprint.state,
    installClass,
    marginM,
    bounds,
  };
}

export function normalizedOutsidePlacementMargin(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? roundCoord(n) : 2;
}

export function componentPayloadFromCatalogTemplate(
  template: ViewerComponentCatalogTemplate,
  point: PlacementPoint,
  routePoints?: PlacementPoint[],
  defaultOverrides: CatalogTemplateDefaultOverrides = {},
  floorHeight = 3
): GeneratedHvacComponentPayload {
  const displayName = displayNameFromOverrides(template, defaultOverrides);
  const effectiveTemplate = templateWithDefaultOverrides(template, defaultOverrides);
  const vertical = verticalPlacementFromOverrides(defaultOverrides, floorHeight);
  const geometry = geometryFromTemplate(effectiveTemplate, point, routePoints, vertical.elevation);
  const dimensions = dimensionsFromTemplate(effectiveTemplate, geometry);
  const quantity = bomQuantity(effectiveTemplate, dimensions);
  const position = positionFromGeometry(geometry);
  return {
    type: effectiveTemplate.type,
    category: effectiveTemplate.category,
    systemKey: effectiveTemplate.systemKey,
    name: displayName,
    displayName,
    sourceTemplateId: template.id,
    dimensions,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    visibility: 'visible',
    locked: false,
    floor: vertical.floor,
    elevation: position.y,
    installHeight: vertical.installHeight ?? position.y,
    businessMetadata: {
      ...effectiveTemplate.defaultDimensions,
      bomMappable: true,
      bomCategory: effectiveTemplate.bomMapping.category,
      bomSkuHint: effectiveTemplate.bomMapping.skuPrefix,
      measurementKey: effectiveTemplate.bomMapping.measurementKey,
      placedBy: 'viewer-drag-to-place',
      placementSource: '3d-viewport-drop',
      floor: vertical.floor,
      elevation: position.y,
      installHeight: vertical.installHeight ?? position.y,
      templateDefaultOverrides: defaultOverrides,
    },
    bomMetadata: {
      bomMappable: true,
      bomCategory: effectiveTemplate.bomMapping.category,
      bomSkuHint: effectiveTemplate.bomMapping.skuPrefix,
      quantity,
      unit: effectiveTemplate.bomMapping.quantityUnit,
      measurementKey: effectiveTemplate.bomMapping.measurementKey,
    },
    geometry,
  };
}

function templateWithDefaultOverrides(
  template: ViewerComponentCatalogTemplate,
  overrides: CatalogTemplateDefaultOverrides
): ViewerComponentCatalogTemplate {
  const { displayName: _displayName, systemKey, ...dimensionOverrides } = overrides;
  const defaultDimensions: ViewerComponentCatalogTemplate['defaultDimensions'] = {
    ...template.defaultDimensions,
  };
  for (const [key, value] of Object.entries(dimensionOverrides)) {
    if (typeof value === 'string' || typeof value === 'number') {
      defaultDimensions[key] = value;
    }
  }
  return {
    ...template,
    systemKey:
      typeof systemKey === 'string'
        ? (systemKey as ViewerComponentCatalogTemplate['systemKey'])
        : template.systemKey,
    defaultDimensions,
  };
}

function displayNameFromOverrides(
  template: ViewerComponentCatalogTemplate,
  overrides: CatalogTemplateDefaultOverrides
): string {
  return typeof overrides.displayName === 'string' && overrides.displayName.trim()
    ? overrides.displayName.trim()
    : template.label;
}

function geometryFromTemplate(
  template: ViewerComponentCatalogTemplate,
  point: PlacementPoint,
  routePoints?: PlacementPoint[],
  elevation?: number
): Record<string, unknown> {
  if (template.type === 'pipe-route' || template.type === 'duct-route') {
    const lengthM = positive(template.defaultDimensions.estimatedLengthM, 4);
    const y = elevation ?? (point.y > 0 ? point.y : 0.95);
    const points =
      routePoints && routePoints.length >= 2
        ? routePoints
        : [
            { x: point.x, y, z: point.z },
            { x: roundCoord(point.x + lengthM), y, z: point.z },
          ];
    if (template.type === 'duct-route') {
      return {
        kind: 'polyline',
        width: positive(template.defaultDimensions.widthMm, 320),
        height: positive(template.defaultDimensions.heightMm, 200),
        points,
      };
    }
    return {
      kind: 'polyline',
      diameterMm: positive(template.defaultDimensions.diameterMm, 25),
      points,
    };
  }

  const width = boxWidth(template);
  const height = boxHeight(template);
  const depth = boxDepth(template);
  return {
    kind: 'box',
    x: point.x,
    y: elevation ?? roundCoord(height / 2),
    z: point.z,
    width,
    height,
    depth,
  };
}

function verticalPlacementFromOverrides(
  overrides: CatalogTemplateDefaultOverrides,
  floorHeight: number
): { floor: number; elevation?: number; installHeight?: number } {
  const floor = integerRange(overrides.floor, 1, 99, 1);
  const installHeight =
    overrides.installHeight === undefined
      ? undefined
      : positiveOrZero(overrides.installHeight, 0);
  const explicitElevation =
    overrides.elevation === undefined ? undefined : positiveOrZero(overrides.elevation, 0);
  const elevation =
    explicitElevation ??
    (installHeight === undefined
      ? undefined
      : roundCoord((floor - 1) * positive(floorHeight, 3) + installHeight));
  return { floor, elevation, installHeight };
}

function integerRange(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) return fallback;
  return n;
}

function positiveOrZero(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function dimensionsFromTemplate(
  template: ViewerComponentCatalogTemplate,
  geometry: Record<string, unknown>
): Record<string, unknown> {
  const dimensions: Record<string, unknown> = { ...template.defaultDimensions };
  if (template.type === 'pipe-route' || template.type === 'duct-route') {
    const points = Array.isArray(geometry.points) ? geometry.points : [];
    dimensions.estimatedLengthM = routeLength(points) ?? template.defaultDimensions.estimatedLengthM;
    if (geometry.diameterMm !== undefined) dimensions.diameterMm = geometry.diameterMm;
    if (geometry.width !== undefined) dimensions.width = geometry.width;
    if (geometry.height !== undefined) dimensions.height = geometry.height;
    return dimensions;
  }
  dimensions.width = geometry.width;
  dimensions.height = geometry.height;
  dimensions.depth = geometry.depth;
  return dimensions;
}

function positionFromGeometry(geometry: Record<string, unknown>): PlacementPoint {
  return {
    x: numberValue(geometry.x, 0),
    y: numberValue(geometry.y, 0),
    z: numberValue(geometry.z, 0),
  };
}

function bomQuantity(
  template: ViewerComponentCatalogTemplate,
  dimensions: Record<string, unknown>
): number {
  if (template.bomMapping.quantityUnit === 'm2') {
    return roundCoord(positive(dimensions.width, 1) * positive(dimensions.height, 1));
  }
  if (template.bomMapping.quantityUnit === 'm') {
    return positive(dimensions.estimatedLengthM, positive(template.defaultDimensions.estimatedLengthM, 1));
  }
  if (template.bomMapping.quantityUnit === 'zone') {
    return positive(template.defaultDimensions.areaM2, 1);
  }
  return positive(dimensions[template.bomMapping.measurementKey], 1);
}

function boxWidth(template: ViewerComponentCatalogTemplate): number {
  return positive(
    template.defaultDimensions.lengthM ??
      template.defaultDimensions.widthM ??
      Math.sqrt(positive(template.defaultDimensions.areaM2, 1)),
    1
  );
}

function boxHeight(template: ViewerComponentCatalogTemplate): number {
  if (template.type === 'room-zone') return 0.12;
  return positive(template.defaultDimensions.heightM, 1);
}

function boxDepth(template: ViewerComponentCatalogTemplate): number {
  if (template.defaultDimensions.depthM !== undefined) {
    return positive(template.defaultDimensions.depthM, 0.2);
  }
  if (template.defaultDimensions.thicknessMm !== undefined) {
    return roundCoord(positive(template.defaultDimensions.thicknessMm, 200) / 1000);
  }
  if (template.type === 'room-zone') {
    const area = positive(template.defaultDimensions.areaM2, 1);
    return roundCoord(area / boxWidth(template));
  }
  return 0.2;
}

function routeLength(points: unknown[], bendRadius?: unknown): number | undefined {
  if (points.length < 2) return undefined;
  const routePoints = points.map(asPoint);
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = routePoints[index - 1];
    const b = routePoints[index];
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  const requestedRadiusM = bendRadiusM(bendRadius);
  if (requestedRadiusM) {
    total = elbowLength(routePoints, requestedRadiusM, total);
  }
  return roundCoord(total);
}

function elbowLength(points: RouteDraftPoint[], requestedRadiusM: number, baseLength: number): number {
  const candidates = elbowTrimCandidates(points, requestedRadiusM);
  if (!candidates.length) return baseLength;
  constrainTrimCandidates(points, candidates);
  return candidates.reduce((sum, candidate) => {
    if (candidate.trimM <= 0.001) return sum;
    const radiusM = candidate.trimM * candidate.tanHalf;
    const arcAngleRad = Math.PI - candidate.thetaRad;
    if (!Number.isFinite(radiusM) || radiusM <= 0 || arcAngleRad <= 0.001) return sum;
    return sum - candidate.trimM * 2 + radiusM * arcAngleRad;
  }, baseLength);
}

type TrimCandidate = {
  cornerIndex: number;
  thetaRad: number;
  tanHalf: number;
  trimM: number;
};

function elbowTrimCandidates(points: RouteDraftPoint[], requestedRadiusM: number): TrimCandidate[] {
  const candidates: TrimCandidate[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const inLength = distanceBetween(previous, corner);
    const outLength = distanceBetween(corner, next);
    if (inLength <= 0.001 || outLength <= 0.001) continue;
    const toPrev = unitVector(corner, previous, inLength);
    const toNext = unitVector(corner, next, outLength);
    const thetaRad = Math.acos(clamp(dot(toPrev, toNext), -1, 1));
    const tanHalf = Math.tan(thetaRad / 2);
    if (
      thetaRad <= 0.001 ||
      Math.PI - thetaRad <= Math.PI / 180 ||
      !Number.isFinite(tanHalf) ||
      tanHalf <= 0
    ) {
      continue;
    }
    candidates.push({ cornerIndex: index, thetaRad, tanHalf, trimM: requestedRadiusM / tanHalf });
  }
  return candidates;
}

function constrainTrimCandidates(points: RouteDraftPoint[], candidates: TrimCandidate[]) {
  const byCorner = new Map(candidates.map((candidate) => [candidate.cornerIndex, candidate]));
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
      const left = byCorner.get(segmentIndex);
      const right = byCorner.get(segmentIndex + 1);
      const sum = (left?.trimM ?? 0) + (right?.trimM ?? 0);
      const cap = Math.max(0, distanceBetween(points[segmentIndex], points[segmentIndex + 1]) - 0.001);
      if (sum <= cap || sum <= 0.001) continue;
      const factor = cap / sum;
      if (left) left.trimM *= factor;
      if (right) right.trimM *= factor;
      changed = true;
    }
    if (!changed) return;
  }
}

function bendRadiusM(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const source = plainObject(value);
  const radius = source ? source.radiusM ?? source.m ?? source.value : value;
  const n = Number(radius);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normalizeBendRadius(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  const source = plainObject(value);
  if (source) {
    const radiusM = bendRadiusM(source);
    if (radiusM !== undefined) return { radiusM };
    const radiusMm = Number(source.radiusMm ?? source.mm);
    return Number.isFinite(radiusMm) && radiusMm > 0 ? { radiusM: radiusMm / 1000 } : null;
  }
  const radiusM = bendRadiusM(value);
  return radiusM === undefined ? null : { radiusM };
}

function unitVector(
  from: RouteDraftPoint,
  to: RouteDraftPoint,
  length: number
): RouteDraftPoint {
  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length,
    z: (to.z - from.z) / length,
  };
}

function dot(a: RouteDraftPoint, b: RouteDraftPoint): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function equipmentEndpointCandidates(
  component: GeneratedHvacComponent,
  input: {
    systemKey: GeneratedHvacComponent['systemKey'];
    routeType: 'pipe-route' | 'duct-route';
    endpointKey: RouteEndpointKey;
  }
): RouteEndpointSnapCandidate[] {
  const connectors = equipmentConnectors(component, input);
  if (connectors.length) return connectors;
  if (component.systemKey !== input.systemKey) return [];
  const anchor = componentPlacementAnchor(component);
  return [
    routeEndpointCandidate({
      component,
      endpointKey: input.endpointKey,
      attachmentKind: 'anchor',
      attachmentId: 'equipment-anchor:center',
      point: anchor,
      systemKey: input.systemKey,
      routeType: input.routeType,
      fallbackReason: 'equipment has no connector metadata; using persisted equipment anchor',
    }),
  ];
}

function equipmentConnectors(
  component: GeneratedHvacComponent,
  input: {
    systemKey: GeneratedHvacComponent['systemKey'];
    routeType: 'pipe-route' | 'duct-route';
    endpointKey: RouteEndpointKey;
  }
): RouteEndpointSnapCandidate[] {
  const anchor = componentPlacementAnchor(component);
  const sources = [
    component.businessMetadata?.connectors,
    component.businessMetadata?.connectorMetadata,
    component.businessMetadata?.connectionPoints,
    component.businessMetadata?.ports,
    component.dimensions?.connectors,
    component.bomMetadata?.connectors,
  ];
  const connectors = sources.flatMap((source) => connectorEntries(source));
  return connectors.flatMap(({ id, source }) => {
    if (!connectorCompatible(source, component, input.systemKey, input.routeType)) return [];
    const point = connectorPoint(source, anchor);
    if (!point) return [];
    return [
      routeEndpointCandidate({
        component,
        endpointKey: input.endpointKey,
        attachmentKind: 'connector',
        attachmentId: id,
        point,
        systemKey: input.systemKey,
        routeType: input.routeType,
      }),
    ];
  });
}

function connectorEntries(value: unknown): Array<{ id: string; source: Record<string, unknown> }> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      const source = plainObject(entry);
      if (!source) return [];
      const id = cleanId(source.id ?? source.key ?? source.portKey ?? source.name) ?? `connector-${index + 1}`;
      return [{ id, source }];
    });
  }
  const source = plainObject(value);
  if (!source) return [];
  return Object.entries(source).flatMap(([key, entry]) => {
    const connector = plainObject(entry);
    if (!connector) return [];
    return [{ id: cleanId(connector.id ?? connector.key ?? key) ?? key, source: connector }];
  });
}

function connectorCompatible(
  connector: Record<string, unknown>,
  component: GeneratedHvacComponent,
  systemKey: GeneratedHvacComponent['systemKey'],
  routeType: 'pipe-route' | 'duct-route'
): boolean {
  const systems = stringSet(
    connector.systemKeys ?? connector.systems ?? connector.systemKey ?? connector.system
  );
  if (systems.size && !systems.has(systemKey)) return false;
  if (!systems.size && component.systemKey !== systemKey) return false;
  const routeTypes = stringSet(
    connector.routeTypes ?? connector.routeType ?? connector.componentTypes ?? connector.componentType
  );
  return routeTypes.size === 0 || routeTypes.has(routeType);
}

function connectorPoint(
  connector: Record<string, unknown>,
  anchor: PlacementPoint
): PlacementPoint | null {
  const relative =
    plainObject(connector.offset) ??
    plainObject(connector.relativePoint) ??
    plainObject(connector.localPoint) ??
    plainObject(connector.localPosition);
  if (relative) return offsetPoint(anchor, relative);
  if (
    connector.dx !== undefined ||
    connector.dy !== undefined ||
    connector.dz !== undefined ||
    connector.offsetX !== undefined ||
    connector.offsetY !== undefined ||
    connector.offsetZ !== undefined
  ) {
    return offsetPoint(anchor, {
      x: connector.dx ?? connector.offsetX,
      y: connector.dy ?? connector.offsetY,
      z: connector.dz ?? connector.offsetZ,
    });
  }
  const point =
    plainObject(connector.point) ??
    plainObject(connector.position) ??
    (connector.x !== undefined || connector.y !== undefined || connector.z !== undefined
      ? connector
      : null);
  if (!point) return null;
  const x = optionalNumber(point.x);
  const z = optionalNumber(point.z);
  if (x === undefined || z === undefined) return null;
  return {
    x: roundCoord(x),
    y: roundCoord(optionalNumber(point.y) ?? anchor.y),
    z: roundCoord(z),
  };
}

function offsetPoint(anchor: PlacementPoint, offset: Record<string, unknown>): PlacementPoint | null {
  const x = optionalNumber(offset.x);
  const z = optionalNumber(offset.z);
  if (x === undefined || z === undefined) return null;
  return {
    x: roundCoord(anchor.x + x),
    y: roundCoord(anchor.y + (optionalNumber(offset.y) ?? 0)),
    z: roundCoord(anchor.z + z),
  };
}

function routeEndpointCandidate(input: {
  component: GeneratedHvacComponent;
  endpointKey: RouteEndpointKey;
  attachmentKind: RouteEndpointAttachmentKind;
  attachmentId: string;
  point: PlacementPoint;
  systemKey: GeneratedHvacComponent['systemKey'];
  routeType: 'pipe-route' | 'duct-route';
  fallbackReason?: string;
}): RouteEndpointSnapCandidate {
  const endpointRole = input.endpointKey === 'from' ? 'source' : 'target';
  return {
    endpointKey: input.endpointKey,
    endpointRole,
    equipmentId: input.component.id,
    equipmentRole: endpointRole,
    attachmentKind: input.attachmentKind,
    attachmentId: input.attachmentId,
    status: 'connected',
    point: input.point,
    systemKey: input.systemKey,
    routeType: input.routeType,
    distanceM: 0,
    label: `${input.component.displayName || input.component.name || input.component.id}/${input.attachmentId}`,
    fallbackReason: input.fallbackReason,
  };
}

function isConnectableEquipment(component: GeneratedHvacComponent): boolean {
  if (component.status === 'deleted' || component.visibility === 'hidden') return false;
  if (component.type !== 'equipment' || component.locked) return false;
  const metadata = {
    ...(component.businessMetadata ?? {}),
    ...(component.bomMetadata ?? {}),
  };
  if (
    metadata.protected === true ||
    metadata.protectedGeometry === true ||
    metadata.importedGeometry === true ||
    metadata.editLocked === true ||
    metadata.connectionLocked === true
  ) {
    return false;
  }
  if (
    component.modelSourceId &&
    (metadata.imported === true ||
      metadata.sourceType === 'local-upload' ||
      metadata.sourceType === 'artifact' ||
      metadata.modelType === 'ifc' ||
      metadata.modelType === 'glb')
  ) {
    return false;
  }
  return true;
}

function isEndpointRef(value: unknown): value is RouteEndpointRef {
  const source = plainObject(value);
  return Boolean(source?.equipmentId && source?.attachmentKind && source?.attachmentId && source?.status);
}

function distanceBetween(a: PlacementPoint, b: PlacementPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function stringSet(value: unknown): Set<string> {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return new Set(values.map((item) => String(item).trim()).filter(Boolean));
}

function cleanId(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function plainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function compactRoutePoints(points: RouteDraftPoint[]): RouteDraftPoint[] {
  return appendRoutePoints([], points.map(asPoint));
}

function appendRoutePoints(points: RouteDraftPoint[], additions: RouteDraftPoint[]): RouteDraftPoint[] {
  const next = [...points];
  for (const point of additions) {
    const normalized = asPoint(point);
    const last = next[next.length - 1];
    if (!last || !sameRoutePoint(last, normalized)) next.push(normalized);
  }
  return next;
}

function sameRoutePoint(a: RouteDraftPoint, b: RouteDraftPoint): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 0.001;
}

function routeFloorParticipation(
  points: RouteDraftPoint[],
  floorHeight: number,
  fallbackFloor: number
) {
  const byFloor = new Map<number, number[]>();
  points.forEach((point, index) => {
    const floor = floorFromElevation(point.y, floorHeight) || fallbackFloor;
    byFloor.set(floor, [...(byFloor.get(floor) ?? []), index]);
  });
  if (!byFloor.size) byFloor.set(fallbackFloor, []);
  return [...byFloor.entries()].map(([floor, pointIndexes]) => {
    const min = roundCoord((floor - 1) * floorHeight);
    const max = roundCoord(floor * floorHeight);
    return {
      floor,
      floorId: `floor-${floor}`,
      pointIndexes,
      elevationMin: min,
      elevationMax: max,
    };
  });
}

function floorFromElevation(elevation: number, floorHeight: number): number {
  if (!Number.isFinite(elevation) || floorHeight <= 0) return 1;
  return Math.max(1, Math.floor(Math.max(0, elevation) / floorHeight) + 1);
}

function asPoint(value: unknown): PlacementPoint {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    x: numberValue(source.x, 0),
    y: numberValue(source.y, 0),
    z: numberValue(source.z, 0),
  };
}

function positive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function roundCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

function componentInstallClass(component: GeneratedHvacComponent): PlacementInstallClass {
  if (component.type !== 'equipment') return 'indoor';
  return installClassFromMetadata({
    ...(component.dimensions ?? {}),
    ...(component.bomMetadata ?? {}),
    ...(component.businessMetadata ?? {}),
  });
}

function templateInstallClass(
  template?: ViewerComponentCatalogTemplate,
  overrides: CatalogTemplateDefaultOverrides = {}
): PlacementInstallClass {
  if (!template || template.type !== 'equipment') return 'indoor';
  return installClassFromMetadata({ ...template.defaultDimensions, ...overrides });
}

function installClassFromMetadata(metadata: Record<string, unknown>): PlacementInstallClass {
  for (const key of [
    'installClass',
    'installationClass',
    'installLocation',
    'installationLocation',
    'placementClass',
    'placementLocation',
    'mountingLocation',
    'outdoor',
  ]) {
    const value = metadata[key];
    if (value === true) return 'outdoor';
    const text = String(value ?? '').trim().toLowerCase();
    if (
      text === 'outdoor' ||
      text === 'outside' ||
      text === 'external' ||
      text === 'roof' ||
      text === 'balcony' ||
      text === 'terrace' ||
      text === 'yard' ||
      text.includes('outdoor') ||
      text.includes('outside') ||
      text.includes('室外') ||
      text.includes('户外') ||
      text.includes('屋面') ||
      text.includes('阳台')
    ) {
      return 'outdoor';
    }
  }
  return 'indoor';
}

function buildingFootprintBounds(
  model: GeneratedHvacModel,
  floor: unknown
): { bounds: PlacementFootprintBounds; state: PlacementConstraintState } {
  const floorNumber = integerRange(floor, 1, 99, 1);
  const outlines = model.components.filter(
    (component) => component.status !== 'deleted' && component.type === 'building-outline'
  );
  const exact = outlines.find((component) => componentFloor(component) === floorNumber);
  const anyOutline = exact ?? outlines.find((component) => footprintBoundsFromComponent(component));
  const readyBounds = anyOutline ? footprintBoundsFromComponent(anyOutline) : null;
  if (readyBounds) return { bounds: readyBounds, state: 'ready' };
  return { bounds: fallbackGeneratedBuildingBounds(model), state: 'degraded' };
}

function componentFloor(component: GeneratedHvacComponent): number {
  return integerRange(component.floor ?? component.businessMetadata?.floor, 1, 99, 1);
}

function footprintBoundsFromComponent(
  component: GeneratedHvacComponent
): PlacementFootprintBounds | null {
  const geometry = component.geometry ?? {};
  if (geometry.kind === 'box') {
    const x = optionalNumber(geometry.x);
    const z = optionalNumber(geometry.z);
    const width = optionalNumber(geometry.width);
    const depth = optionalNumber(geometry.depth);
    if (
      x === undefined ||
      z === undefined ||
      width === undefined ||
      depth === undefined ||
      width <= 0 ||
      depth <= 0
    ) {
      return null;
    }
    return {
      minX: roundCoord(x - width / 2),
      maxX: roundCoord(x + width / 2),
      minZ: roundCoord(z - depth / 2),
      maxZ: roundCoord(z + depth / 2),
    };
  }
  if (Array.isArray(geometry.points)) {
    const points = geometry.points.map(asPoint);
    const xs = points.map((point) => point.x).filter((value) => Number.isFinite(value));
    const zs = points.map((point) => point.z).filter((value) => Number.isFinite(value));
    if (!xs.length || !zs.length) return null;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    if (minX === maxX || minZ === maxZ) return null;
    return {
      minX: roundCoord(minX),
      maxX: roundCoord(maxX),
      minZ: roundCoord(minZ),
      maxZ: roundCoord(maxZ),
    };
  }
  return null;
}

function fallbackGeneratedBuildingBounds(model: GeneratedHvacModel): PlacementFootprintBounds {
  const building = model.inputs?.building ?? {};
  const area = positive(building.area, 180);
  const width = Math.max(10, Math.round(Math.sqrt(area) * 1.2));
  const depth = Math.max(8, Math.round(area / width));
  return {
    minX: roundCoord(-width / 2),
    maxX: roundCoord(width / 2),
    minZ: roundCoord(-depth / 2),
    maxZ: roundCoord(depth / 2),
  };
}

function expandBounds(
  bounds: PlacementFootprintBounds,
  marginM: number
): PlacementFootprintBounds {
  return {
    minX: roundCoord(bounds.minX - marginM),
    maxX: roundCoord(bounds.maxX + marginM),
    minZ: roundCoord(bounds.minZ - marginM),
    maxZ: roundCoord(bounds.maxZ + marginM),
  };
}

function clampCoord(value: number, min: number, max: number): number {
  return roundCoord(Math.min(max, Math.max(min, value)));
}
