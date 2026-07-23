import * as THREE from 'three';
import type { GeneratedHvacComponent } from '../../lib/api';
import { markBusinessSelectable, markSelectionHelper } from './selectable-object-policy';
import { normalizeRouteEndpointRefs } from './viewer-component-placement';

export type RoutePoint = { x: number; y: number; z: number };
export type RouteFloorViewMode = 'all-floors' | 'single-floor';
export type RouteFloorView = {
  mode: RouteFloorViewMode;
  floor: number;
  floorHeight: number;
};
export type RouteVisiblePointRef = { index: number; point: RoutePoint };
export type RouteVisibleSegmentRef = {
  insertAfterIndex: number;
  start: RoutePoint;
  end: RoutePoint;
};
export type RouteRiserMarker = {
  id: string;
  direction: 'riser-up' | 'riser-down';
  floor: number;
  point: RoutePoint;
  otherFloor: number;
  transitionIndex: number;
};

export type RouteRenderMetrics =
  | {
      kind: 'round-pipe';
      pointCount: number;
      segmentCount: number;
      radiusM: number;
      diameterMm: number;
      bendRadiusM?: number;
      centerlineLengthM: number;
      bendRadiusClamped: boolean;
    }
  | {
      kind: 'rectangular-duct';
      pointCount: number;
      segmentCount: number;
      widthM: number;
      heightM: number;
      bendRadiusM?: number;
      centerlineLengthM: number;
      bendRadiusClamped: boolean;
    };

const PIPE_RADIAL_SEGMENTS = 24;
const ROUTE_AXIS = new THREE.Vector3(0, 1, 0);
const DUCT_AXIS = new THREE.Vector3(0, 0, 1);
const ROUTE_EPSILON = 0.001;
const COLLINEAR_TURN_EPSILON = THREE.MathUtils.degToRad(1);

export type RouteElbowGeometry = {
  cornerIndex: number;
  corner: RoutePoint;
  tangentIn: RoutePoint;
  tangentOut: RoutePoint;
  center: RoutePoint;
  radiusM: number;
  requestedRadiusM: number;
  trimM: number;
  arcAngleRad: number;
  arcLengthM: number;
  clamped: boolean;
};

export type RouteElbowLayout = {
  elbows: RouteElbowGeometry[];
  lengthM: number;
  clamped: boolean;
};

export function renderSavedRouteComponent(
  component: GeneratedHvacComponent,
  selected: boolean,
  color: number
): THREE.Object3D | null {
  const points = routePolylinePoints(component);
  if (points.length < 2) return null;

  const metrics = routeRenderMetrics(component);
  if (!metrics || metrics.segmentCount < 1) return null;

  const group = markBusinessSelectable(new THREE.Group(), component);
  group.userData.routeVisual = 'solid-route';
  group.userData.routeVisualKind = metrics.kind;
  group.userData.routeSegmentCount = metrics.segmentCount;
  group.userData.routePointCount = metrics.pointCount;
  group.userData.routeEndpointRefs = normalizeRouteEndpointRefs(component.route?.endpointRefs);
  group.userData.routeConnectionStatus = routeConnectionStatus(component);
  if (metrics.kind === 'round-pipe') {
    group.userData.routeRadiusM = metrics.radiusM;
  } else {
    group.userData.routeWidthM = metrics.widthM;
    group.userData.routeHeightM = metrics.heightM;
  }
  if (metrics.bendRadiusM !== undefined) group.userData.routeBendRadiusM = metrics.bendRadiusM;
  group.userData.routeCenterlineLengthM = metrics.centerlineLengthM;
  group.userData.routeBendRadiusClamped = metrics.bendRadiusClamped;
  group.userData.routeElbowCount = routeElbowLayout(points, metrics.bendRadiusM).elbows.length;

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.48,
    metalness: 0.08,
    emissive: selected ? new THREE.Color(0x4a3500) : new THREE.Color(0x000000),
    emissiveIntensity: selected ? 0.28 : 0,
  });
  addRouteSolids(group, component, points, metrics, material, false);

  if (selected) {
    const selectionMaterial = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.28,
      roughness: 0.35,
      metalness: 0,
      depthWrite: false,
    });
    addRouteSolids(group, component, points, scaledMetrics(metrics), selectionMaterial, true);
  }

  return group;
}

export function renderSavedRouteComponentForView(
  component: GeneratedHvacComponent,
  selected: boolean,
  color: number,
  floorView?: RouteFloorView
): THREE.Object3D | null {
  if (!isSingleFloorView(floorView)) return renderSavedRouteComponent(component, selected, color);

  const segments = routeVisibleSegmentRefs(component, floorView);
  const markers = routeRiserMarkers(component, floorView);
  if (!segments.length && !markers.length) return null;

  const group = markBusinessSelectable(new THREE.Group(), component);
  group.userData.routeVisual = 'floor-isolated-route';
  group.userData.routeFloorViewMode = floorView.mode;
  group.userData.routeFloor = floorView.floor;
  group.userData.routeVisibleSegmentCount = segments.length;
  group.userData.routeRiserMarkerCount = markers.length;

  for (const segment of segments) {
    const segmentObject = renderSavedRouteComponent(
      routeComponentWithPoints(component, [segment.start, segment.end]),
      selected,
      color
    );
    if (segmentObject) group.add(segmentObject);
  }

  for (const marker of markers) {
    group.add(riserMarkerObject(component, marker, selected, color));
  }

  return group;
}

function routeConnectionStatus(component: GeneratedHvacComponent): string {
  const refs = normalizeRouteEndpointRefs(component.route?.endpointRefs);
  if (refs.from?.status === 'stale' || refs.to?.status === 'stale') return 'stale';
  if (refs.from?.status === 'connected' || refs.to?.status === 'connected') return 'connected';
  return 'none';
}

export function routeRenderMetrics(component: GeneratedHvacComponent): RouteRenderMetrics | null {
  const points = routePolylinePoints(component);
  const segmentCount = countRenderableSegments(points);
  if (points.length < 2 || segmentCount < 1) return null;

  const geometry = component.geometry ?? {};
  const dimensions = component.dimensions ?? {};
  const bendRadiusM = routeBendRadiusM(component);
  const elbowLayout = routeElbowLayout(points, bendRadiusM);

  if (component.type === 'duct-route') {
    return {
      kind: 'rectangular-duct',
      pointCount: points.length,
      segmentCount,
      widthM: routeSizeM(dimensions.width ?? geometry.width, 0.32) ?? 0.32,
      heightM: routeSizeM(dimensions.height ?? geometry.height, 0.2) ?? 0.2,
      bendRadiusM,
      centerlineLengthM: elbowLayout.lengthM,
      bendRadiusClamped: elbowLayout.clamped,
    };
  }

  const diameterMm = positiveNumber(dimensions.diameterMm ?? geometry.diameterMm, 32);
  return {
    kind: 'round-pipe',
    pointCount: points.length,
    segmentCount,
    radiusM: diameterMm / 2000,
    diameterMm,
    bendRadiusM,
    centerlineLengthM: elbowLayout.lengthM,
    bendRadiusClamped: elbowLayout.clamped,
  };
}

export function routePolylinePoints(component: GeneratedHvacComponent): RoutePoint[] {
  const points = Array.isArray(component.geometry?.points) ? component.geometry.points : [];
  return points.map((point: any) => ({
    x: numberValue(point?.x, 0),
    y: numberValue(point?.y, 0.95),
    z: numberValue(point?.z, 0),
  }));
}

export function routeVisiblePointRefs(
  component: GeneratedHvacComponent,
  floorView?: RouteFloorView
): RouteVisiblePointRef[] {
  const points = routePolylinePoints(component);
  if (!isSingleFloorView(floorView)) {
    return points.map((point, index) => ({ index, point }));
  }

  const refs = new Map<number, RoutePoint>();
  for (const segment of routeVisibleSegmentRefs(component, floorView)) {
    refs.set(segment.insertAfterIndex, segment.start);
    refs.set(segment.insertAfterIndex + 1, segment.end);
  }
  return [...refs.entries()]
    .sort(([left], [right]) => left - right)
    .map(([index, point]) => ({ index, point }));
}

export function routeVisibleSegmentRefs(
  component: GeneratedHvacComponent,
  floorView?: RouteFloorView
): RouteVisibleSegmentRef[] {
  const points = routePolylinePoints(component);
  if (!isSingleFloorView(floorView)) {
    return points.slice(0, -1).map((point, index) => ({
      insertAfterIndex: index,
      start: point,
      end: points[index + 1],
    }));
  }

  const floorByPoint = routePointFloorMap(component, floorView);
  const segments: RouteVisibleSegmentRef[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const startFloor = floorByPoint.get(index);
    const endFloor = floorByPoint.get(index + 1);
    if (startFloor !== floorView.floor || endFloor !== floorView.floor) continue;
    if (vectorFromPoint(points[index]).distanceTo(vectorFromPoint(points[index + 1])) <= 0.001) {
      continue;
    }
    segments.push({
      insertAfterIndex: index,
      start: points[index],
      end: points[index + 1],
    });
  }
  return segments;
}

export function routeRiserMarkers(
  component: GeneratedHvacComponent,
  floorView?: RouteFloorView
): RouteRiserMarker[] {
  if (!isSingleFloorView(floorView)) return [];
  const points = routePolylinePoints(component);
  const explicit = Array.isArray(component.route?.crossFloorTransitions)
    ? component.route.crossFloorTransitions
    : [];
  const markers = explicit.flatMap((transition: any, transitionIndex: number) =>
    markerFromTransition(component, points, floorView, transition, transitionIndex)
  );
  if (markers.length) return markers;
  return inferredRiserMarkers(component, points, floorView);
}

export function routeHasFloorVisibility(
  component: GeneratedHvacComponent,
  floorView?: RouteFloorView
): boolean {
  if (!isSingleFloorView(floorView)) return true;
  return (
    routeVisibleSegmentRefs(component, floorView).length > 0 ||
    routeRiserMarkers(component, floorView).length > 0
  );
}

function addRouteSolids(
  group: THREE.Group,
  component: GeneratedHvacComponent,
  points: RoutePoint[],
  metrics: RouteRenderMetrics,
  material: THREE.Material,
  selectionHelper: boolean
) {
  const elbowLayout = routeElbowLayout(points, metrics.bendRadiusM);
  const elbowByCorner = new Map(elbowLayout.elbows.map((elbow) => [elbow.cornerIndex, elbow]));
  for (let index = 1; index < points.length; index += 1) {
    const start = vectorFromPoint(elbowByCorner.get(index - 1)?.tangentOut ?? points[index - 1]);
    const end = vectorFromPoint(elbowByCorner.get(index)?.tangentIn ?? points[index]);
    const mesh =
      metrics.kind === 'round-pipe'
        ? pipeSegment(start, end, metrics.radiusM, material)
        : ductSegment(start, end, metrics.widthM, metrics.heightM, material);
    if (!mesh) continue;
    addRouteMesh(group, mesh, component, selectionHelper, 'route-segment');
  }

  for (const elbow of elbowLayout.elbows) {
    if (metrics.kind === 'round-pipe') {
      const mesh = pipeElbow(elbow, metrics.radiusM, material);
      if (mesh) addRouteMesh(group, mesh, component, selectionHelper, 'route-elbow');
    } else {
      for (const mesh of ductElbow(elbow, metrics.widthM, metrics.heightM, material)) {
        addRouteMesh(group, mesh, component, selectionHelper, 'route-elbow');
      }
    }
  }

  for (let index = 0; index < points.length; index += 1) {
    if (elbowByCorner.has(index)) continue;
    const point = vectorFromPoint(points[index]);
    const mesh =
      metrics.kind === 'round-pipe'
        ? pipeJoint(point, metrics.radiusM, material)
        : ductJoint(point, points, index, metrics.widthM, metrics.heightM, material);
    addRouteMesh(group, mesh, component, selectionHelper, 'route-elbow');
  }
}

function pipeSegment(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material
): THREE.Mesh | null {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.001) return null;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, PIPE_RADIAL_SEGMENTS, 1, true),
    material
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(ROUTE_AXIS, direction.normalize());
  return mesh;
}

function pipeElbow(
  elbow: RouteElbowGeometry,
  radius: number,
  material: THREE.Material
): THREE.Mesh | null {
  const curve = circularArcCurve(elbow);
  if (!curve) return null;
  const tubularSegments = Math.max(8, Math.ceil(elbow.arcAngleRad / (Math.PI / 24)));
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, PIPE_RADIAL_SEGMENTS, false),
    material
  );
}

function pipeJoint(point: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, PIPE_RADIAL_SEGMENTS, 12), material);
  mesh.position.copy(point);
  return mesh;
}

function ductSegment(
  start: THREE.Vector3,
  end: THREE.Vector3,
  width: number,
  height: number,
  material: THREE.Material
): THREE.Mesh | null {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.001) return null;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(DUCT_AXIS, direction.normalize());
  return mesh;
}

function ductElbow(
  elbow: RouteElbowGeometry,
  width: number,
  height: number,
  material: THREE.Material
): THREE.Mesh[] {
  const curve = circularArcCurve(elbow);
  if (!curve) return [];
  const steps = Math.max(8, Math.ceil(elbow.arcAngleRad / (Math.PI / 20)));
  const points = curve.getPoints(steps);
  const meshes: THREE.Mesh[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const mesh = ductSegment(points[index - 1], points[index], width, height, material);
    if (mesh) meshes.push(mesh);
  }
  return meshes;
}

function ductJoint(
  point: THREE.Vector3,
  points: RoutePoint[],
  index: number,
  width: number,
  height: number,
  material: THREE.Material
): THREE.Mesh {
  const depth = Math.max(width, height) * 1.35;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.copy(point);
  const tangent = jointTangent(points, index);
  if (tangent) mesh.quaternion.setFromUnitVectors(DUCT_AXIS, tangent);
  return mesh;
}

function addRouteMesh(
  group: THREE.Group,
  mesh: THREE.Mesh,
  component: GeneratedHvacComponent,
  selectionHelper: boolean,
  role: string
) {
  mesh.userData.routeVisualRole = role;
  if (selectionHelper) markSelectionHelper(mesh, 'selected-route-volume');
  else markBusinessSelectable(mesh, component);
  group.add(mesh);
}

function jointTangent(points: RoutePoint[], index: number): THREE.Vector3 | null {
  const previous =
    index > 0 ? vectorFromPoint(points[index]).sub(vectorFromPoint(points[index - 1])) : null;
  const next =
    index < points.length - 1
      ? vectorFromPoint(points[index + 1]).sub(vectorFromPoint(points[index]))
      : null;
  const tangent = new THREE.Vector3();
  if (previous && previous.length() > 0.001) tangent.add(previous.normalize());
  if (next && next.length() > 0.001) tangent.add(next.normalize());
  if (tangent.length() <= 0.001) return null;
  return tangent.normalize();
}

class CircularArcCurve3 extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly center: THREE.Vector3,
    private readonly startRadius: THREE.Vector3,
    private readonly axis: THREE.Vector3,
    private readonly arcAngleRad: number
  ) {
    super();
  }

  getPoint(t: number): THREE.Vector3 {
    return this.center
      .clone()
      .add(this.startRadius.clone().applyAxisAngle(this.axis, this.arcAngleRad * t));
  }
}

function circularArcCurve(elbow: RouteElbowGeometry): CircularArcCurve3 | null {
  const center = vectorFromPoint(elbow.center);
  const startRadius = vectorFromPoint(elbow.tangentIn).sub(center);
  const endRadius = vectorFromPoint(elbow.tangentOut).sub(center);
  const axis = startRadius.clone().cross(endRadius);
  if (axis.length() <= ROUTE_EPSILON) return null;
  return new CircularArcCurve3(center, startRadius, axis.normalize(), elbow.arcAngleRad);
}

export function routeElbowLayout(points: RoutePoint[], requestedRadiusM?: number): RouteElbowLayout {
  const vectors = points.map(vectorFromPoint);
  const baseLength = polylineLength(vectors);
  if (!positiveFinite(requestedRadiusM) || vectors.length < 3) {
    return { elbows: [], lengthM: roundRouteLength(baseLength), clamped: false };
  }

  const candidates = elbowCandidates(vectors, requestedRadiusM);
  if (!candidates.length) {
    return { elbows: [], lengthM: roundRouteLength(baseLength), clamped: false };
  }

  constrainElbowTrims(candidates, vectors);

  const elbows = candidates.flatMap((candidate): RouteElbowGeometry[] => {
    if (candidate.trimM <= ROUTE_EPSILON) return [];
    const radiusM = candidate.trimM * candidate.tanHalf;
    if (!positiveFinite(radiusM)) return [];
    const tangentIn = candidate.corner
      .clone()
      .add(candidate.toPrev.clone().multiplyScalar(candidate.trimM));
    const tangentOut = candidate.corner
      .clone()
      .add(candidate.toNext.clone().multiplyScalar(candidate.trimM));
    const bisector = candidate.toPrev.clone().add(candidate.toNext);
    if (bisector.length() <= ROUTE_EPSILON) return [];
    const center = candidate.corner
      .clone()
      .add(bisector.normalize().multiplyScalar(radiusM / Math.sin(candidate.thetaRad / 2)));
    const startRadius = tangentIn.clone().sub(center);
    const endRadius = tangentOut.clone().sub(center);
    const arcAngleRad = startRadius.angleTo(endRadius);
    if (!positiveFinite(arcAngleRad) || arcAngleRad <= ROUTE_EPSILON) return [];
    const clamped = radiusM < requestedRadiusM - ROUTE_EPSILON;
    return [
      {
        cornerIndex: candidate.cornerIndex,
        corner: pointFromVector(candidate.corner),
        tangentIn: pointFromVector(tangentIn),
        tangentOut: pointFromVector(tangentOut),
        center: pointFromVector(center),
        radiusM,
        requestedRadiusM,
        trimM: candidate.trimM,
        arcAngleRad,
        arcLengthM: radiusM * arcAngleRad,
        clamped,
      },
    ];
  });

  const length = elbows.reduce(
    (sum, elbow) => sum - elbow.trimM * 2 + elbow.arcLengthM,
    baseLength
  );
  return {
    elbows,
    lengthM: roundRouteLength(length),
    clamped: elbows.some((elbow) => elbow.clamped),
  };
}

type ElbowCandidate = {
  cornerIndex: number;
  corner: THREE.Vector3;
  toPrev: THREE.Vector3;
  toNext: THREE.Vector3;
  thetaRad: number;
  tanHalf: number;
  trimM: number;
};

function elbowCandidates(vectors: THREE.Vector3[], requestedRadiusM: number): ElbowCandidate[] {
  const candidates: ElbowCandidate[] = [];
  for (let index = 1; index < vectors.length - 1; index += 1) {
    const previous = vectors[index - 1];
    const corner = vectors[index];
    const next = vectors[index + 1];
    if (
      previous.distanceTo(corner) <= ROUTE_EPSILON ||
      next.distanceTo(corner) <= ROUTE_EPSILON
    ) {
      continue;
    }
    const toPrev = previous.clone().sub(corner).normalize();
    const toNext = next.clone().sub(corner).normalize();
    const thetaRad = Math.acos(THREE.MathUtils.clamp(toPrev.dot(toNext), -1, 1));
    const turnAngleRad = Math.PI - thetaRad;
    const tanHalf = Math.tan(thetaRad / 2);
    if (
      thetaRad <= ROUTE_EPSILON ||
      turnAngleRad <= COLLINEAR_TURN_EPSILON ||
      !positiveFinite(tanHalf)
    ) {
      continue;
    }
    candidates.push({
      cornerIndex: index,
      corner,
      toPrev,
      toNext,
      thetaRad,
      tanHalf,
      trimM: requestedRadiusM / tanHalf,
    });
  }
  return candidates;
}

function constrainElbowTrims(candidates: ElbowCandidate[], vectors: THREE.Vector3[]) {
  const byCorner = new Map(candidates.map((candidate) => [candidate.cornerIndex, candidate]));
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (let segmentIndex = 0; segmentIndex < vectors.length - 1; segmentIndex += 1) {
      const left = byCorner.get(segmentIndex);
      const right = byCorner.get(segmentIndex + 1);
      const sum = (left?.trimM ?? 0) + (right?.trimM ?? 0);
      const cap = Math.max(
        0,
        vectors[segmentIndex].distanceTo(vectors[segmentIndex + 1]) - ROUTE_EPSILON
      );
      if (sum <= cap || sum <= ROUTE_EPSILON) continue;
      const factor = cap / sum;
      if (left) left.trimM *= factor;
      if (right) right.trimM *= factor;
      changed = true;
    }
    if (!changed) return;
  }
}

function polylineLength(vectors: THREE.Vector3[]): number {
  let total = 0;
  for (let index = 1; index < vectors.length; index += 1) {
    total += vectors[index].distanceTo(vectors[index - 1]);
  }
  return total;
}

function scaledMetrics(metrics: RouteRenderMetrics): RouteRenderMetrics {
  if (metrics.kind === 'round-pipe') {
    return {
      ...metrics,
      radiusM: metrics.radiusM * 1.55,
    };
  }
  return {
    ...metrics,
    widthM: metrics.widthM * 1.08,
    heightM: metrics.heightM * 1.08,
  };
}

function countRenderableSegments(points: RoutePoint[]): number {
  let count = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (vectorFromPoint(points[index]).distanceTo(vectorFromPoint(points[index - 1])) > 0.001) {
      count += 1;
    }
  }
  return count;
}

function routeSizeM(value: unknown, fallback: number | undefined): number | undefined {
  const n = Number(value);
  const source = Number.isFinite(n) && n > 0 ? n : fallback;
  if (source === undefined) return undefined;
  return source > 8 ? source / 1000 : source;
}

function routeBendRadiusM(component: GeneratedHvacComponent): number | undefined {
  const routeBend = component.route?.bendRadius as Record<string, unknown> | null | undefined;
  const acceptedRadiusM = positiveNumberOrUndefined(
    routeBend?.radiusM ?? routeBend?.m ?? routeBend?.value
  );
  if (acceptedRadiusM !== undefined) return acceptedRadiusM;
  const acceptedRadiusMm = positiveNumberOrUndefined(routeBend?.radiusMm ?? routeBend?.mm);
  if (acceptedRadiusMm !== undefined) return acceptedRadiusMm / 1000;
  const legacyRadiusM = positiveNumberOrUndefined(component.businessMetadata?.bendRadiusM);
  if (legacyRadiusM !== undefined) return legacyRadiusM;
  const legacyRadiusMm = positiveNumberOrUndefined(
    component.businessMetadata?.bendRadiusMm ?? component.businessMetadata?.bendRadius
  );
  return legacyRadiusMm === undefined ? undefined : legacyRadiusMm / 1000;
}

function pointFromVector(vector: THREE.Vector3): RoutePoint {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function vectorFromPoint(point: RoutePoint): THREE.Vector3 {
  return new THREE.Vector3(point.x, point.y, point.z);
}

function positiveFinite(value: unknown): value is number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function roundRouteLength(value: number): number {
  return Math.round(value * 100) / 100;
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function positiveNumberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function isSingleFloorView(floorView?: RouteFloorView): floorView is RouteFloorView {
  return floorView?.mode === 'single-floor' && Number.isFinite(floorView.floor);
}

function routeComponentWithPoints(
  component: GeneratedHvacComponent,
  points: RoutePoint[]
): GeneratedHvacComponent {
  return {
    ...component,
    geometry: {
      ...(component.geometry ?? {}),
      points,
    },
  };
}

function routePointFloorMap(
  component: GeneratedHvacComponent,
  floorView: RouteFloorView
): Map<number, number> {
  const points = routePolylinePoints(component);
  const floorByPoint = new Map<number, number>();
  const routeFloors = Array.isArray(component.route?.floors) ? component.route.floors : [];
  for (const entry of routeFloors as any[]) {
    const floor = positiveInteger(entry?.floor, 0);
    if (!floor || !Array.isArray(entry?.pointIndexes)) continue;
    for (const pointIndex of entry.pointIndexes) {
      const index = positiveInteger(pointIndex, -1);
      if (index >= 0 && !floorByPoint.has(index)) floorByPoint.set(index, floor);
    }
  }
  points.forEach((point, index) => {
    if (!floorByPoint.has(index)) {
      floorByPoint.set(index, floorFromElevation(point.y, floorView.floorHeight));
    }
  });
  return floorByPoint;
}

function floorFromElevation(elevation: number, floorHeight: number): number {
  const height = positiveNumber(floorHeight, 3);
  return Math.max(1, Math.floor(Math.max(0, elevation) / height) + 1);
}

function markerFromTransition(
  component: GeneratedHvacComponent,
  points: RoutePoint[],
  floorView: RouteFloorView,
  transition: any,
  transitionIndex: number
): RouteRiserMarker[] {
  if (transition?.kind && transition.kind !== 'riser') return [];
  const fromFloor = positiveInteger(transition?.fromFloor, 0);
  const toFloor = positiveInteger(transition?.toFloor, 0);
  if (!fromFloor || !toFloor || fromFloor === toFloor) return [];
  const activeIsSource = floorView.floor === fromFloor;
  const activeIsTarget = floorView.floor === toFloor;
  if (!activeIsSource && !activeIsTarget) return [];
  const pointIndex = activeIsSource
    ? integerOrNull(transition?.startPointIndex)
    : integerOrNull(transition?.endPointIndex);
  const point =
    pointIndex !== null && points[pointIndex]
      ? points[pointIndex]
      : transitionPointFromMetadata(transition, activeIsSource, floorView);
  const otherFloor = activeIsSource ? toFloor : fromFloor;
  return [
    {
      id: `${component.id}:riser:${transitionIndex}:${floorView.floor}`,
      direction: otherFloor > floorView.floor ? 'riser-up' : 'riser-down',
      floor: floorView.floor,
      point,
      otherFloor,
      transitionIndex,
    },
  ];
}

function transitionPointFromMetadata(
  transition: any,
  sourceSide: boolean,
  floorView: RouteFloorView
): RoutePoint {
  const installHeight = numberValue(transition?.installHeight, 0.95);
  return {
    x: numberValue(transition?.x, 0),
    y: numberValue(
      sourceSide ? transition?.sourceElevation : transition?.targetElevation,
      (floorView.floor - 1) * positiveNumber(floorView.floorHeight, 3) + installHeight
    ),
    z: numberValue(transition?.z, 0),
  };
}

function inferredRiserMarkers(
  component: GeneratedHvacComponent,
  points: RoutePoint[],
  floorView: RouteFloorView
): RouteRiserMarker[] {
  const floorByPoint = routePointFloorMap(component, floorView);
  const markers: RouteRiserMarker[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const startFloor = floorByPoint.get(index);
    const endFloor = floorByPoint.get(index + 1);
    if (!startFloor || !endFloor || startFloor === endFloor) continue;
    if (Math.abs(start.x - end.x) > 0.05 || Math.abs(start.z - end.z) > 0.05) continue;
    const activeIsStart = floorView.floor === startFloor;
    const activeIsEnd = floorView.floor === endFloor;
    if (!activeIsStart && !activeIsEnd) continue;
    const otherFloor = activeIsStart ? endFloor : startFloor;
    markers.push({
      id: `${component.id}:riser-inferred:${index}:${floorView.floor}`,
      direction: otherFloor > floorView.floor ? 'riser-up' : 'riser-down',
      floor: floorView.floor,
      point: activeIsStart ? start : end,
      otherFloor,
      transitionIndex: index,
    });
  }
  return markers;
}

function riserMarkerObject(
  component: GeneratedHvacComponent,
  marker: RouteRiserMarker,
  selected: boolean,
  routeColor: number
): THREE.Object3D {
  const group = markBusinessSelectable(new THREE.Group(), component);
  group.userData.routeVisualRole = 'riser-marker';
  group.userData.routeRiserMarker = marker.direction;
  group.userData.routeRiserOtherFloor = marker.otherFloor;
  group.userData.routeRiserMarkerId = marker.id;

  const directionSign = marker.direction === 'riser-up' ? 1 : -1;
  const markerColor =
    marker.direction === 'riser-up' ? 0x16a34a : marker.direction === 'riser-down' ? 0xf97316 : routeColor;
  const material = new THREE.MeshStandardMaterial({
    color: selected ? 0xfacc15 : markerColor,
    emissive: new THREE.Color(selected ? 0x4a3500 : 0x101010),
    emissiveIntensity: selected ? 0.32 : 0.12,
    roughness: 0.4,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 24), material);
  cone.position.set(marker.point.x, marker.point.y + directionSign * 1.1, marker.point.z);
  if (marker.direction === 'riser-down') cone.rotation.x = Math.PI;
  markBusinessSelectable(cone, component);
  cone.userData.routeVisualRole = 'riser-marker-arrow';
  cone.userData.routeRiserMarker = marker.direction;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.035, 8, 32),
    new THREE.MeshStandardMaterial({
      color: selected ? 0xfacc15 : routeColor,
      roughness: 0.45,
      metalness: 0,
    })
  );
  ring.position.set(marker.point.x, marker.point.y + directionSign * 0.75, marker.point.z);
  ring.rotation.x = Math.PI / 2;
  markBusinessSelectable(ring, component);
  ring.userData.routeVisualRole = 'riser-marker-ring';
  ring.userData.routeRiserMarker = marker.direction;

  group.add(ring, cone);
  return group;
}

function positiveInteger(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function integerOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
