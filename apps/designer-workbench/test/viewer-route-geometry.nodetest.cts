import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  renderSavedRouteComponent,
  renderSavedRouteComponentForView,
  routeElbowLayout,
  routeRiserMarkers,
  routePolylinePoints,
  routeRenderMetrics,
  routeVisibleSegmentRefs,
} from '../src/app/viewer/viewer-route-geometry';
import type { GeneratedHvacComponent } from '../src/lib/api';

function component(
  id: string,
  type: 'pipe-route' | 'duct-route',
  patch: Partial<GeneratedHvacComponent>
): GeneratedHvacComponent {
  return {
    id,
    draftId: 'draft-1',
    modelId: 'model-1',
    modelSourceId: null,
    sourceTemplateId: null,
    type,
    category: 'route',
    systemKey: type === 'duct-route' ? 'freshAir' : 'cooling',
    modelVersion: 1,
    version: 1,
    name: id,
    displayName: id,
    geometry: {},
    route: null,
    dimensions: {},
    position: {},
    rotation: {},
    visibility: 'visible',
    locked: false,
    floor: 1,
    elevation: null,
    installHeight: null,
    businessMetadata: {},
    bomMetadata: {},
    status: 'active',
    ...patch,
  };
}

test('round saved pipe route renders as selectable solid mesh volume from diameterMm', () => {
  const pipe = component('pipe-main', 'pipe-route', {
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 3, y: 1, z: 0 },
        { x: 3, y: 1, z: 2 },
      ],
    },
  });

  const metrics = routeRenderMetrics(pipe);
  const object = renderSavedRouteComponent(pipe, false, 0x0ea5e9);

  assert.equal(metrics?.kind, 'round-pipe');
  assert.equal(metrics?.radiusM, 0.016);
  assert.equal(metrics?.segmentCount, 2);
  assert.equal(object?.userData.routeVisual, 'solid-route');
  assert.equal(object?.userData.routeRadiusM, 0.016);
  assert.equal(
    countObjects(object, (child) => child instanceof THREE.Line),
    0
  );
  assert.ok(countObjects(object, (child) => child instanceof THREE.Mesh) >= 5);
  assert.equal(firstMesh(object)?.userData.selectable, true);
});

test('bend radius resolves tangent circular elbows without mutating authoritative points', () => {
  const points = [
    { x: 0, y: 1, z: 0 },
    { x: 3, y: 1, z: 0 },
    { x: 3, y: 1, z: 3 },
    { x: 6, y: 1, z: 3 },
  ];
  const layout = routeElbowLayout(points, 0.5);

  assert.equal(layout.elbows.length, 2);
  assert.equal(layout.clamped, false);
  assert.equal(layout.lengthM, 8.57);
  assert.deepEqual(points[1], { x: 3, y: 1, z: 0 });
  assert.equal(round(layout.elbows[0].tangentIn.x), 2.5);
  assert.equal(round(layout.elbows[0].tangentIn.z), 0);
  assert.equal(round(layout.elbows[0].tangentOut.x), 3);
  assert.equal(round(layout.elbows[0].tangentOut.z), 0.5);
  assert.equal(round(layout.elbows[0].arcLengthM), 0.79);
});

test('bend radius clamps deterministically when adjacent segments cannot fit requested elbows', () => {
  const layout = routeElbowLayout(
    [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 1, z: 1 },
    ],
    2
  );
  const [first, second] = layout.elbows;

  assert.equal(layout.elbows.length, 2);
  assert.equal(layout.clamped, true);
  assert.ok(first.radiusM < 2);
  assert.ok(second.radiusM < 2);
  assert.ok(first.trimM + second.trimM <= 1);
  assert.equal(round(first.tangentOut.z), round(second.tangentIn.z));
});

test('bend geometry skips zero-length and near-collinear corners', () => {
  assert.equal(
    routeElbowLayout(
      [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: 2, y: 1, z: 0 },
      ],
      0.4
    ).elbows.length,
    0
  );
  assert.equal(
    routeElbowLayout(
      [
        { x: 0, y: 1, z: 0 },
        { x: 2, y: 1, z: 0 },
        { x: 4, y: 1, z: 0 },
      ],
      0.4
    ).elbows.length,
    0
  );
});

test('round and rectangular route rendering use accepted bend radius for visible elbow solids', () => {
  const pipe = component('pipe-elbows', 'pipe-route', {
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      diameterMm: 32,
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 3, y: 1, z: 0 },
        { x: 3, y: 1, z: 3 },
        { x: 6, y: 1, z: 3 },
      ],
    },
    route: {
      kind: 'logical-route',
      coordinateSystem: {
        planeAxes: ['x', 'z'],
        elevationAxis: 'y',
        ySemantics: 'absolute-model-elevation-m',
      },
      points: [],
      floors: [],
      crossFloorTransitions: [],
      systemKey: 'cooling',
      routeType: 'pipe-route',
      size: { diameterMm: 32 },
      material: null,
      insulation: null,
      bendRadius: { radiusM: 0.5 },
      endpointRefs: {},
      visibility: 'visible',
      locked: false,
      lockState: 'unlocked',
      bomMapping: {},
      summary: { pointCount: 4, floorCount: 1, transitionCount: 0, totalLengthM: 8.57 },
    },
  });
  const duct = component('duct-elbows', 'duct-route', {
    dimensions: { width: 0.4, height: 0.25 },
    geometry: {
      kind: 'polyline',
      width: 0.4,
      height: 0.25,
      points: pipe.geometry.points,
    },
    route: { ...(pipe.route as any), routeType: 'duct-route', size: { width: 0.4, height: 0.25 } },
  });

  const pipeObject = renderSavedRouteComponent(pipe, true, 0x0ea5e9);
  const ductObject = renderSavedRouteComponent(duct, false, 0x22c55e);

  assert.equal(routeRenderMetrics(pipe)?.bendRadiusM, 0.5);
  assert.equal(routeRenderMetrics(pipe)?.centerlineLengthM, 8.57);
  assert.equal(pipeObject?.userData.routeElbowCount, 2);
  assert.equal(pipeObject?.userData.routeCenterlineLengthM, 8.57);
  assert.ok(countObjects(pipeObject, (child) => child.userData.routeVisualRole === 'route-elbow') >= 2);
  assert.ok(countObjects(pipeObject, (child) => child.userData.selectionHelper === true) > 0);
  assert.equal(ductObject?.userData.routeElbowCount, 2);
  assert.ok(countObjects(ductObject, (child) => child.userData.routeVisualRole === 'route-elbow') > 2);
  assert.deepEqual(routePolylinePoints(pipe), pipe.geometry.points);
});

test('route render metrics preserve accepted bend radius units', () => {
  const meterRadius = component('pipe-radius-m', 'pipe-route', {
    dimensions: { diameterMm: 32 },
    geometry: {
      kind: 'polyline',
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 20, y: 1, z: 0 },
        { x: 20, y: 1, z: 20 },
      ],
    },
    route: { bendRadius: { radiusM: 12 } } as any,
  });
  const millimeterRadius = component('pipe-radius-mm', 'pipe-route', {
    dimensions: { diameterMm: 32 },
    geometry: meterRadius.geometry,
    route: { bendRadius: { radiusMm: 500 } } as any,
  });

  assert.equal(routeRenderMetrics(meterRadius)?.bendRadiusM, 12);
  assert.equal(routeRenderMetrics(millimeterRadius)?.bendRadiusM, 0.5);
});

test('single-floor route view derives local portions and complementary riser markers from one logical route', () => {
  const route = component('logical-two-floor-route', 'pipe-route', {
    dimensions: { diameterMm: 22 },
    floor: 2,
    elevation: 3.45,
    installHeight: 0.45,
    geometry: {
      kind: 'polyline',
      diameterMm: 22,
      points: [
        { x: -3, y: 3.45, z: 0 },
        { x: 0, y: 3.45, z: 0 },
        { x: 0, y: 0.95, z: 0 },
        { x: 3, y: 0.95, z: 0 },
      ],
    },
    route: {
      kind: 'logical-route',
      coordinateSystem: {
        planeAxes: ['x', 'z'],
        elevationAxis: 'y',
        ySemantics: 'absolute-model-elevation-m',
      },
      points: [
        { x: -3, y: 3.45, z: 0 },
        { x: 0, y: 3.45, z: 0 },
        { x: 0, y: 0.95, z: 0 },
        { x: 3, y: 0.95, z: 0 },
      ],
      floors: [
        {
          floor: 2,
          floorId: 'floor-2',
          pointIndexes: [0, 1],
          elevationMin: 3,
          elevationMax: 6,
        },
        {
          floor: 1,
          floorId: 'floor-1',
          pointIndexes: [2, 3],
          elevationMin: 0,
          elevationMax: 3,
        },
      ],
      crossFloorTransitions: [
        {
          kind: 'riser',
          fromFloor: 2,
          toFloor: 1,
          startPointIndex: 1,
          endPointIndex: 2,
          sourceFloorId: 'floor-2',
          targetFloorId: 'floor-1',
          sourceElevation: 3.45,
          targetElevation: 0.95,
          x: 0,
          z: 0,
          installHeight: 0.45,
        },
      ],
      systemKey: 'cooling',
      routeType: 'pipe-route',
      size: { diameterMm: 22 },
      material: 'copper',
      insulation: null,
      bendRadius: null,
      endpointRefs: {},
      visibility: 'visible',
      locked: false,
      lockState: 'unlocked',
      bomMapping: {},
      summary: {
        pointCount: 4,
        floorCount: 2,
        transitionCount: 1,
        totalLengthM: 8.5,
      },
    },
  });

  const secondFloor = { mode: 'single-floor' as const, floor: 2, floorHeight: 3 };
  const firstFloor = { mode: 'single-floor' as const, floor: 1, floorHeight: 3 };
  const allFloors = { mode: 'all-floors' as const, floor: 2, floorHeight: 3 };

  assert.deepEqual(
    routeVisibleSegmentRefs(route, secondFloor).map((segment) => segment.insertAfterIndex),
    [0]
  );
  assert.deepEqual(
    routeVisibleSegmentRefs(route, firstFloor).map((segment) => segment.insertAfterIndex),
    [2]
  );
  assert.deepEqual(routeRiserMarkers(route, secondFloor).map((marker) => marker.direction), [
    'riser-down',
  ]);
  assert.deepEqual(routeRiserMarkers(route, firstFloor).map((marker) => marker.direction), [
    'riser-up',
  ]);

  const secondFloorObject = renderSavedRouteComponentForView(route, false, 0x0ea5e9, secondFloor);
  const firstFloorObject = renderSavedRouteComponentForView(route, false, 0x0ea5e9, firstFloor);
  const allFloorObject = renderSavedRouteComponentForView(route, false, 0x0ea5e9, allFloors);

  assert.equal(secondFloorObject?.userData.routeVisual, 'floor-isolated-route');
  assert.equal(firstFloorObject?.userData.routeRiserMarkerCount, 1);
  assert.equal(allFloorObject?.userData.routeSegmentCount, 3);
  assert.equal(
    countObjects(secondFloorObject, (child) => child.userData.routeRiserMarker === 'riser-down'),
    3
  );
  assert.equal(
    countObjects(firstFloorObject, (child) => child.userData.routeRiserMarker === 'riser-up'),
    3
  );
});

test('rectangular duct route keeps saved width and height, including mm-valued fixtures', () => {
  const savedMeters = component('duct-meter', 'duct-route', {
    dimensions: { width: 0.4, height: 0.25 },
    geometry: {
      kind: 'polyline',
      width: 0.4,
      height: 0.25,
      points: [
        { x: 0, y: 2.4, z: 0 },
        { x: 2, y: 2.4, z: 2 },
      ],
    },
  });
  const savedMm = component('duct-mm', 'duct-route', {
    dimensions: { width: 320, height: 200 },
    geometry: {
      kind: 'polyline',
      width: 320,
      height: 200,
      points: [
        { x: 0, y: 2.4, z: 0 },
        { x: 2, y: 2.4, z: 2 },
      ],
    },
  });

  const meterMetrics = routeRenderMetrics(savedMeters);
  const mmMetrics = routeRenderMetrics(savedMm);

  assert.equal(meterMetrics?.kind, 'rectangular-duct');
  assert.equal(meterMetrics?.widthM, 0.4);
  assert.equal(meterMetrics?.heightM, 0.25);
  assert.equal(mmMetrics?.kind, 'rectangular-duct');
  assert.equal(mmMetrics?.widthM, 0.32);
  assert.equal(mmMetrics?.heightM, 0.2);
});

test('selected route overlay distinguishes selection without replacing system material color', () => {
  const pipe = component('selected-pipe', 'pipe-route', {
    dimensions: { diameterMm: 25 },
    geometry: {
      kind: 'polyline',
      diameterMm: 25,
      points: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
    },
  });
  const object = renderSavedRouteComponent(pipe, true, 0xef4444);
  const mesh = firstMesh(object);
  const material = mesh?.material as THREE.MeshStandardMaterial | undefined;

  assert.equal(material?.color.getHex(), 0xef4444);
  assert.ok(Number(material?.emissiveIntensity) > 0);
  assert.ok(countObjects(object, (child) => child.userData.selectionHelper === true) > 0);
  assert.deepEqual(routePolylinePoints(pipe), [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
  ]);
});

function firstMesh(object?: THREE.Object3D | null): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  object?.traverse((child) => {
    if (!found && child instanceof THREE.Mesh) found = child;
  });
  return found;
}

function countObjects(
  object: THREE.Object3D | null | undefined,
  predicate: (child: THREE.Object3D) => boolean
): number {
  let count = 0;
  object?.traverse((child) => {
    if (predicate(child)) count += 1;
  });
  return count;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
