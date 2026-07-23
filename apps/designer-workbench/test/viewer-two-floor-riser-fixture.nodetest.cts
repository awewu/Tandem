import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const fixturePath = path.join(
  __dirname,
  '..',
  'fixtures',
  'viewer-two-floor-riser.fixture.json'
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const components = fixture.model.components as Array<{
  id: string;
  type: string;
  floor: number;
  locked: boolean;
  geometry: { kind?: string; points?: Array<{ x: number; y: number; z: number }> };
  route?: {
    floors?: Array<{ floor: number; pointIndexes: number[] }>;
    crossFloorTransitions?: Array<{
      kind: string;
      fromFloor: number;
      toFloor: number;
      startPointIndex: number | null;
      endPointIndex: number | null;
    }>;
  };
}>;
const byId = new Map(components.map((component) => [component.id, component]));

test('two-floor riser fixture preserves the acceptance path ordering', () => {
  assert.deepEqual(fixture.acceptancePath, [
    'equipment-2f-indoor',
    'pipe-2f-horizontal',
    'pipe-vertical-riser',
    'pipe-1f-horizontal',
    'equipment-1f-utility',
  ]);

  assert.equal(byId.get('equipment-2f-indoor')?.type, 'equipment');
  assert.equal(byId.get('equipment-2f-indoor')?.floor, 2);
  assert.equal(byId.get('pipe-2f-horizontal')?.type, 'pipe-route');
  assert.equal(byId.get('pipe-2f-horizontal')?.floor, 2);
  assert.equal(byId.get('pipe-1f-horizontal')?.type, 'pipe-route');
  assert.equal(byId.get('pipe-1f-horizontal')?.floor, 1);
  assert.equal(byId.get('equipment-1f-utility')?.type, 'equipment');
  assert.equal(byId.get('equipment-1f-utility')?.floor, 1);
});

test('two-floor riser fixture includes a vertical pipe segment visible from elevation views', () => {
  const riser = byId.get(fixture.expectedVerticalSegment.componentId);
  const points = riser?.geometry.points ?? [];
  assert.equal(riser?.type, 'pipe-route');
  assert.equal(points.length, 2);

  const [top, bottom] = points;
  assert.equal(top.x, bottom.x);
  assert.equal(top.z, bottom.z);
  assert.ok(
    Math.abs(top.y - bottom.y) >= fixture.expectedVerticalSegment.minDeltaM,
    'vertical riser must span between first and second floor elevations'
  );
});

test('two-floor riser fixture includes a single logical route for floor isolation markers', () => {
  const logical = byId.get('pipe-logical-two-floor-route');
  const transitions = logical?.route?.crossFloorTransitions ?? [];

  assert.equal(logical?.type, 'pipe-route');
  assert.equal(logical?.route?.floors?.length, 2);
  assert.deepEqual(
    logical?.route?.floors?.map((floor) => [floor.floor, floor.pointIndexes]),
    [
      [2, [0, 1, 2]],
      [1, [3, 4, 5]],
    ]
  );
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].kind, 'riser');
  assert.equal(transitions[0].fromFloor, 2);
  assert.equal(transitions[0].toFloor, 1);
  assert.equal(transitions[0].startPointIndex, 2);
  assert.equal(transitions[0].endPointIndex, 3);
});

test('two-floor riser fixture keeps protected locked component coverage', () => {
  assert.ok(
    components.some((component) => component.locked),
    'fixture should retain at least one locked component for regression smoke coverage'
  );
  assert.ok(
    fixture.model.componentSummary.bomMappableComponentIds.includes('pipe-vertical-riser'),
    'vertical riser should remain BOM mappable'
  );
});
