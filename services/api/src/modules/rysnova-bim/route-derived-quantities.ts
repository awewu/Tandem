import { BadRequestException } from '@nestjs/common';

export interface RouteDerivedComponentLike {
  id?: unknown;
  type?: unknown;
  systemKey?: unknown;
  name?: unknown;
  displayName?: unknown;
  status?: unknown;
  route?: unknown;
  geometry?: unknown;
  dimensions?: unknown;
  bomMetadata?: unknown;
  businessMetadata?: unknown;
  modelId?: unknown;
  modelVersion?: unknown;
  version?: unknown;
}

export interface RouteDerivedRow {
  id: string;
  systemKey: string;
  name: string;
  type: string;
  lengthM: number;
  diameterMm?: number;
  widthMm?: number;
  heightMm?: number;
  material?: string;
  insulationMm?: number;
  linkedComponentId?: string;
  linkedModelId?: string;
  linkedModelVersion?: number;
  componentVersion?: number;
  bomMetadata: Record<string, unknown>;
  businessMetadata: Record<string, unknown>;
}

export interface RouteDerivedSummary {
  status: 'passed' | 'pending';
  source: 'model' | 'pending';
  routeCount: number;
  totalLengthM: number;
  linkedComponentIds: string[];
  routes: RouteDerivedRow[];
  crossFloorRouteCount: number;
  crossFloorTransitionCount: number;
}

export function routeLengthFromAcceptedPoints(
  points: unknown,
  field = 'geometry.points',
  bendRadius?: unknown
): number | undefined {
  if (!Array.isArray(points) || points.length < 2) return undefined;
  const routePoints = points.map((point, index) => routePoint(point, `${field}[${index}]`));
  let total = 0;
  for (let index = 1; index < routePoints.length; index += 1) {
    const a = routePoints[index - 1];
    const b = routePoints[index];
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  const requestedRadiusM = routeBendRadiusM(bendRadius);
  if (requestedRadiusM) total = elbowLength(routePoints, requestedRadiusM, total);
  return roundRouteLength(total);
}

export function deriveRouteBomMapping(
  value: unknown,
  bomMetadata: Record<string, unknown>,
  businessMetadata: Record<string, unknown>,
  totalLengthM: number
): Record<string, unknown> {
  const source = objectOrEmpty(value, 'route.bomMapping');
  const unit = cleanText(source.unit ?? bomMetadata.unit ?? businessMetadata.unit) ?? 'm';
  return withoutUndefined({
    bomMappable: source.bomMappable ?? bomMetadata.bomMappable ?? businessMetadata.bomMappable,
    bomCategory: source.bomCategory ?? bomMetadata.bomCategory ?? businessMetadata.bomCategory,
    bomSkuHint: source.bomSkuHint ?? bomMetadata.bomSkuHint ?? businessMetadata.bomSkuHint,
    measurementKey: 'estimatedLengthM',
    unit,
    quantity: totalLengthM,
    totalLengthM,
  });
}

export function bomMetadataFromDerivedRoute(
  route: { bomMapping: Record<string, unknown>; summary: { totalLengthM: number } },
  bomMetadata: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...bomMetadata,
    ...route.bomMapping,
    estimatedLengthM: route.summary.totalLengthM,
    quantity: route.summary.totalLengthM,
  };
}

export function deriveRouteComponentRow(
  component: RouteDerivedComponentLike,
  model?: { id?: unknown; modelVersion?: unknown } | null
): RouteDerivedRow | null {
  if (component.status === 'deleted') return null;
  if (component.type !== 'pipe-route' && component.type !== 'duct-route') return null;
  const businessMetadata = objectOrEmpty(component.businessMetadata, 'businessMetadata');
  const bomMetadata = objectOrEmpty(component.bomMetadata, 'bomMetadata');
  if (businessMetadata.excluded === true || bomMetadata.excluded === true) return null;
  const route = objectOrNull(component.route);
  const geometry = objectOrEmpty(component.geometry, 'geometry');
  const dimensions = objectOrEmpty(component.dimensions, 'dimensions');
  const points = Array.isArray(geometry.points) ? geometry.points : route?.points;
  const lengthM = routeLengthFromAcceptedPoints(
    points,
    Array.isArray(geometry.points) ? 'geometry.points' : 'route.points',
    route?.bendRadius ?? businessMetadata.bendRadiusM
  );
  if (lengthM === undefined) return null;
  const componentId = cleanText(component.id) ?? 'unknown-route';
  const acceptedBomMetadata = {
    ...bomMetadata,
    measurementKey: 'estimatedLengthM',
    unit: cleanText(bomMetadata.unit ?? businessMetadata.unit) ?? 'm',
    quantity: lengthM,
    estimatedLengthM: lengthM,
  };
  return {
    id: `route-${componentId}`,
    systemKey: cleanText(component.systemKey) ?? '',
    name: cleanText(component.displayName ?? component.name) ?? `${component.systemKey ?? 'route'}`,
    type: cleanText(component.type) ?? 'pipe-route',
    lengthM,
    diameterMm: positiveNumberOrUndefined(
      routeSize(route).diameterMm ?? dimensions.diameterMm ?? geometry.diameterMm
    ),
    widthMm: positiveNumberOrUndefined(
      routeSize(route).width ?? dimensions.width ?? geometry.width
    ),
    heightMm: positiveNumberOrUndefined(
      routeSize(route).height ?? dimensions.height ?? geometry.height
    ),
    material:
      cleanText(route?.material ?? businessMetadata.material ?? bomMetadata.material) ?? undefined,
    insulationMm: positiveNumberOrUndefined(
      routeInsulation(route).thicknessMm ??
        businessMetadata.insulationMm ??
        bomMetadata.insulationMm ??
        dimensions.insulationMm
    ),
    linkedComponentId: componentId,
    linkedModelId: cleanText(component.modelId ?? model?.id) ?? undefined,
    linkedModelVersion: finiteNumber(component.modelVersion ?? model?.modelVersion),
    componentVersion: finiteNumber(component.version),
    bomMetadata: acceptedBomMetadata,
    businessMetadata,
  };
}

export function deriveRouteSummaryFromComponents(
  components: RouteDerivedComponentLike[],
  model?: { id?: unknown; modelVersion?: unknown } | null
): RouteDerivedSummary {
  const routes = components
    .map((component) => deriveRouteComponentRow(component, model))
    .filter((row): row is RouteDerivedRow => Boolean(row));
  const linkedComponentIds = routes
    .map((route) => route.linkedComponentId)
    .filter((id): id is string => Boolean(id));
  let crossFloorRouteCount = 0;
  let crossFloorTransitionCount = 0;
  for (const component of components) {
    if (component.status === 'deleted') continue;
    if (component.type !== 'pipe-route' && component.type !== 'duct-route') continue;
    const route = objectOrNull(component.route);
    const transitions = Array.isArray(route?.crossFloorTransitions)
      ? route.crossFloorTransitions
      : [];
    crossFloorTransitionCount += transitions.length;
    if (transitions.length > 0) crossFloorRouteCount += 1;
  }
  const totalLengthM = routes.reduce((sum, route) => sum + route.lengthM, 0);
  return {
    status: routes.length ? 'passed' : 'pending',
    source: routes.length ? 'model' : 'pending',
    routeCount: routes.length,
    totalLengthM: roundRouteLength(totalLengthM) ?? 0,
    linkedComponentIds,
    routes,
    crossFloorRouteCount,
    crossFloorTransitionCount,
  };
}

function routePoint(value: unknown, field: string): { x: number; y: number; z: number } {
  const source = objectOrEmpty(value, field);
  return {
    x: finiteCoordinate(source.x, `${field}.x`),
    y: finiteCoordinate(source.y, `${field}.y`),
    z: finiteCoordinate(source.z, `${field}.z`),
  };
}

function elbowLength(
  points: Array<{ x: number; y: number; z: number }>,
  requestedRadiusM: number,
  baseLength: number
): number {
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

function elbowTrimCandidates(
  points: Array<{ x: number; y: number; z: number }>,
  requestedRadiusM: number
): TrimCandidate[] {
  const candidates: TrimCandidate[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const inLength = distance(previous, corner);
    const outLength = distance(corner, next);
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

function constrainTrimCandidates(
  points: Array<{ x: number; y: number; z: number }>,
  candidates: TrimCandidate[]
) {
  const byCorner = new Map(candidates.map((candidate) => [candidate.cornerIndex, candidate]));
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
      const left = byCorner.get(segmentIndex);
      const right = byCorner.get(segmentIndex + 1);
      const sum = (left?.trimM ?? 0) + (right?.trimM ?? 0);
      const cap = Math.max(0, distance(points[segmentIndex], points[segmentIndex + 1]) - 0.001);
      if (sum <= cap || sum <= 0.001) continue;
      const factor = cap / sum;
      if (left) left.trimM *= factor;
      if (right) right.trimM *= factor;
      changed = true;
    }
    if (!changed) return;
  }
}

function routeBendRadiusM(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const source = objectOrNull(value);
  const radius = source ? source.radiusM ?? source.m ?? source.value : value;
  const n = Number(radius);
  if (Number.isFinite(n) && n > 0) return n;
  const radiusMm = source ? Number(source.radiusMm ?? source.mm) : Number.NaN;
  return Number.isFinite(radiusMm) && radiusMm > 0 ? radiusMm / 1000 : undefined;
}

function distance(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function unitVector(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  length: number
): { x: number; y: number; z: number } {
  return {
    x: (to.x - from.x) / length,
    y: (to.y - from.y) / length,
    z: (to.z - from.z) / length,
  };
}

function dot(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }
): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finiteCoordinate(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BadRequestException(`${field} must be a number`);
  return n;
}

function routeSize(route: Record<string, unknown> | null): Record<string, unknown> {
  return objectOrEmpty(route?.size, 'route.size');
}

function routeInsulation(route: Record<string, unknown> | null): Record<string, unknown> {
  return objectOrEmpty(route?.insulation, 'route.insulation');
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function objectOrEmpty(value: unknown, field: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (value == null) return {};
  throw new BadRequestException(`${field} must be an object`);
}

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function finiteNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function positiveNumberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function roundRouteLength(value: number): number {
  return Number(value.toFixed(2));
}

function withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
