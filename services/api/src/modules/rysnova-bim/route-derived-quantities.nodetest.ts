import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveRouteBomMapping,
  deriveRouteSummaryFromComponents,
  routeLengthFromAcceptedPoints,
} from './route-derived-quantities';

test('route length sums ordered 3D segments across horizontal diagonal and vertical axes', () => {
  const length = routeLengthFromAcceptedPoints([
    { x: 0, y: 0, z: 0 },
    { x: 3, y: 0, z: 4 },
    { x: 3, y: 4, z: 4 },
    { x: 6, y: 8, z: 4 },
  ]);

  assert.equal(length, 14);
});

test('vertical riser length includes Y-axis distance', () => {
  const length = routeLengthFromAcceptedPoints([
    { x: 2, y: 0.5, z: 1 },
    { x: 2, y: 6.5, z: 1 },
  ]);

  assert.equal(length, 6);
});

test('route length can derive trimmed straight plus circular elbow arc from accepted bend radius', () => {
  const length = routeLengthFromAcceptedPoints(
    [
      { x: 0, y: 1, z: 0 },
      { x: 3, y: 1, z: 0 },
      { x: 3, y: 1, z: 3 },
      { x: 6, y: 1, z: 3 },
    ],
    'geometry.points',
    { radiusM: 0.5 }
  );

  assert.equal(length, 8.57);
});

test('route length accepts legacy millimeter bend radius metadata as reusable meters', () => {
  const length = routeLengthFromAcceptedPoints(
    [
      { x: 0, y: 1, z: 0 },
      { x: 3, y: 1, z: 0 },
      { x: 3, y: 1, z: 3 },
    ],
    'geometry.points',
    { radiusMm: 500 }
  );

  assert.equal(length, 5.79);
});

test('route length clamps impossible adjacent bend radii without overshooting short segments', () => {
  const length = routeLengthFromAcceptedPoints(
    [
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 1, y: 1, z: 1 },
      { x: 2, y: 1, z: 1 },
    ],
    'geometry.points',
    { radiusM: 2 }
  );

  assert.equal(length, 2.57);
});

test('route derived summary maps pipe summary and BOM quantity from the same accepted length', () => {
  const summary = deriveRouteSummaryFromComponents([
    {
      id: 'pipe-main-01',
      type: 'pipe-route',
      systemKey: 'cooling',
      name: 'Cooling main',
      route: {
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 3, y: 1, z: 4 },
          { x: 3, y: 4, z: 4 },
        ],
        size: { diameterMm: 32 },
        material: 'copper',
        insulation: { thicknessMm: 25 },
        bendRadius: { radiusM: 0.5 },
        crossFloorTransitions: [{ kind: 'riser' }],
      },
      geometry: {
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 3, y: 1, z: 4 },
          { x: 3, y: 4, z: 4 },
        ],
      },
      bomMetadata: { unit: 'm', quantity: 999, estimatedLengthM: 999 },
      businessMetadata: { estimatedLengthM: 999 },
    },
  ]);

  assert.equal(summary.routeCount, 1);
  assert.equal(summary.totalLengthM, 7.79);
  assert.deepEqual(summary.linkedComponentIds, ['pipe-main-01']);
  assert.equal(summary.crossFloorRouteCount, 1);
  assert.equal(summary.crossFloorTransitionCount, 1);
  assert.equal(summary.routes[0].lengthM, 7.79);
  assert.equal(summary.routes[0].bomMetadata.quantity, 7.79);
  assert.equal(summary.routes[0].bomMetadata.estimatedLengthM, 7.79);
});

test('route BOM mapping ignores forged client quantity for route length takeoff', () => {
  const mapping = deriveRouteBomMapping(
    { unit: 'set', quantity: 999, measurementKey: 'quantity' },
    { quantity: 888 },
    { quantity: 777 },
    12.34
  );

  assert.equal(mapping.unit, 'set');
  assert.equal(mapping.measurementKey, 'estimatedLengthM');
  assert.equal(mapping.quantity, 12.34);
  assert.equal(mapping.totalLengthM, 12.34);
});

test('route derived summary prefers accepted geometry points over stale route points', () => {
  const summary = deriveRouteSummaryFromComponents([
    {
      id: 'pipe-geometry-accepted',
      type: 'pipe-route',
      systemKey: 'cooling',
      route: {
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 100, y: 1, z: 0 },
        ],
        size: { diameterMm: 32 },
      },
      geometry: {
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 3, y: 1, z: 4 },
        ],
      },
      bomMetadata: { unit: 'm', quantity: 100 },
      businessMetadata: { estimatedLengthM: 100 },
    },
  ]);

  assert.equal(summary.totalLengthM, 5);
  assert.equal(summary.routes[0].bomMetadata.quantity, 5);
});

test('route length rejects non-finite accepted coordinates', () => {
  assert.throws(
    () =>
      routeLengthFromAcceptedPoints([
        { x: 0, y: 1, z: 0 },
        { x: Number.POSITIVE_INFINITY, y: 1, z: 0 },
      ]),
    /geometry.points\[1\].x must be a number/
  );
});
