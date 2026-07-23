import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  componentSelectablePolicy,
  markBusinessSelectable,
  markSelectionHelper,
  nearestSelectableComponent,
  nearestSelectableRoot,
  selectableComponentFromObject,
} from '../src/app/viewer/selectable-object-policy';
import type { GeneratedHvacComponent } from '../src/lib/api';

type MockObject = {
  userData: Record<string, unknown>;
  parent?: MockObject | null;
  visible?: boolean;
};

function component(
  id: string,
  type: GeneratedHvacComponent['type'],
  patch: Partial<GeneratedHvacComponent> = {}
): GeneratedHvacComponent {
  return {
    id,
    draftId: 'draft-1',
    modelId: 'model-1',
    modelSourceId: null,
    sourceTemplateId: null,
    type,
    category: type,
    systemKey: type === 'room-zone' ? 'zone' : 'envelope',
    modelVersion: 1,
    version: 1,
    name: id,
    displayName: id,
    geometry: {},
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

function object(parent?: MockObject | null): MockObject {
  return { userData: {}, parent: parent ?? null, visible: true };
}

test('helper hits are skipped even when they are closer than a real business component', () => {
  const wall = component('wall-1', 'wall');
  const wallRoot = markBusinessSelectable(object(), wall);
  const wallMesh = markBusinessSelectable(object(wallRoot), wall);
  const transparentFrame = markSelectionHelper(object(wallRoot), 'transparent-frame');

  assert.equal(selectableComponentFromObject(transparentFrame), null);
  assert.equal(
    nearestSelectableComponent([
      { object: transparentFrame, distance: 1 },
      { object: wallMesh, distance: 2 },
    ])?.id,
    'wall-1'
  );
  assert.equal(
    nearestSelectableRoot([
      { object: transparentFrame, distance: 1 },
      { object: wallMesh, distance: 2 },
    ]),
    wallMesh
  );
});

test('real wall door window room equipment pipe and duct components are selectable', () => {
  for (const type of [
    'wall',
    'door',
    'window',
    'room-zone',
    'equipment',
    'pipe-route',
    'duct-route',
  ] as const) {
    assert.equal(componentSelectablePolicy(component(`${type}-1`, type)).selectable, true);
  }
});

test('outer boundary hidden and locked components cannot enter selection or dragging', () => {
  assert.equal(componentSelectablePolicy(component('boundary-1', 'building-outline')).selectable, false);
  assert.equal(
    componentSelectablePolicy(
      component('hidden-wall', 'wall', { businessMetadata: { hidden: true } })
    ).selectable,
    false
  );
  assert.equal(
    componentSelectablePolicy(
      component('locked-equipment', 'equipment', { businessMetadata: { locked: true } })
    ).selectable,
    false
  );
  assert.equal(
    componentSelectablePolicy(component('deleted-pipe', 'pipe-route', { status: 'deleted' }))
      .selectable,
    false
  );
  assert.equal(
    componentSelectablePolicy(
      component('ifc-source-equipment', 'equipment', {
        modelSourceId: 'ifc-source-1',
        businessMetadata: { sourceType: 'artifact', modelType: 'ifc' },
      })
    ).selectable,
    false
  );
});

test('invisible object ancestry prevents hidden helper or hidden mesh selection', () => {
  const wall = component('wall-hidden-parent', 'wall');
  const root = markBusinessSelectable({ ...object(), visible: false }, wall);
  const mesh = markBusinessSelectable(object(root), wall);

  assert.equal(selectableComponentFromObject(mesh), null);
  assert.equal(nearestSelectableComponent([{ object: mesh, distance: 1 }]), null);
});
