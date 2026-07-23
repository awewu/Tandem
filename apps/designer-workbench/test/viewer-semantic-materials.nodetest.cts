import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATED_SYSTEM_COLORS,
  VIEWER_SEMANTIC_MATERIAL_TOKENS,
  VIEWER_STATE_ACCENT_TOKENS,
  generatedComponentMaterialSpec,
  materialSnapshot,
} from '../src/app/viewer/viewer-semantic-materials';
import type { GeneratedHvacComponent } from '../src/lib/api';

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
    geometry: { kind: 'box', x: 0, y: 1, z: 0, width: 1, height: 1, depth: 1 },
    route: null,
    dimensions: { width: 1, height: 1, depth: 1 },
    position: { x: 0, y: 1, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    visibility: 'visible',
    locked: false,
    floor: 1,
    elevation: 1,
    installHeight: 1,
    businessMetadata: {},
    bomMetadata: {},
    status: 'active',
    ...patch,
  };
}

test('generated editable walls doors and windows use stable semantic visualization tokens', () => {
  const wall = generatedComponentMaterialSpec(component('wall-1', 'wall'));
  const door = generatedComponentMaterialSpec(component('door-1', 'door'));
  const window = materialSnapshot(component('window-1', 'window'));

  assert.equal(wall.color, VIEWER_SEMANTIC_MATERIAL_TOKENS.wall);
  assert.equal(wall.role, 'wall');
  assert.ok(wall.opacity >= 0.9);
  assert.equal(door.color, VIEWER_SEMANTIC_MATERIAL_TOKENS.doorPanel);
  assert.equal(door.role, 'door-panel');
  assert.ok(door.opacity >= 0.9);
  assert.equal(window.base.color, VIEWER_SEMANTIC_MATERIAL_TOKENS.windowGlazing);
  assert.equal(window.base.role, 'window-glazing');
  assert.equal(window.base.transparent, true);
  assert.ok(window.base.opacity > 0.3 && window.base.opacity < 0.65);
  assert.equal(window.frame?.color, VIEWER_SEMANTIC_MATERIAL_TOKENS.windowFrame);
  assert.equal(window.frame?.role, 'window-frame');
});

test('selection treatment preserves the base wall door and window material colors', () => {
  for (const type of ['wall', 'door', 'window'] as const) {
    const unselected = materialSnapshot(component(`${type}-1`, type));
    const selected = materialSnapshot(component(`${type}-1`, type), { selected: true });

    assert.equal(selected.base.color, unselected.base.color);
    assert.equal(selected.base.opacity, unselected.base.opacity);
    assert.equal(selected.treatment.accentColor, VIEWER_STATE_ACCENT_TOKENS.selected);
    assert.ok(selected.treatment.emissiveIntensity > 0);
  }
});

test('hover locked and invalid placement treatments are visually distinct from selection', () => {
  const locked = materialSnapshot(component('locked-door', 'door', { locked: true }));
  const hovered = materialSnapshot(component('hover-wall', 'wall'), { hovered: true });
  const invalid = materialSnapshot(component('invalid-window', 'window'), {
    selected: true,
    invalidPlacement: true,
  });

  assert.equal(locked.treatment.accentColor, VIEWER_STATE_ACCENT_TOKENS.locked);
  assert.equal(hovered.treatment.accentColor, VIEWER_STATE_ACCENT_TOKENS.hover);
  assert.equal(invalid.treatment.accentColor, VIEWER_STATE_ACCENT_TOKENS.invalidPlacement);
  assert.notEqual(locked.treatment.accentColor, hovered.treatment.accentColor);
  assert.notEqual(invalid.treatment.accentColor, VIEWER_STATE_ACCENT_TOKENS.selected);
});

test('floor isolation visibility save reload and regeneration do not alter semantic material choice', () => {
  const base = component('wall-v1-floor-1', 'wall', {
    floor: 1,
    visibility: 'visible',
    modelVersion: 1,
  });
  const hiddenSameFloor = component('wall-v1-floor-1', 'wall', {
    floor: 1,
    visibility: 'hidden',
    modelVersion: 1,
  });
  const regeneratedOtherFloor = component('wall-v8-floor-2', 'wall', {
    floor: 2,
    visibility: 'visible',
    modelVersion: 8,
  });

  assert.equal(materialSnapshot(base).base.color, VIEWER_SEMANTIC_MATERIAL_TOKENS.wall);
  assert.equal(materialSnapshot(hiddenSameFloor).base.color, materialSnapshot(base).base.color);
  assert.equal(
    materialSnapshot(regeneratedOtherFloor).base.color,
    materialSnapshot(base).base.color
  );
});

test('protected IFC and GLB source geometry keeps source material instead of semantic recolor', () => {
  const ifcWall = component('ifc-wall-proxy', 'wall', {
    modelSourceId: 'ifc-source-1',
    businessMetadata: {
      sourceType: 'artifact',
      modelType: 'ifc',
      sourceMaterialColor: '#123456',
      sourceOpacity: 0.73,
    },
  });
  const glbWindow = component('glb-window-proxy', 'window', {
    modelSourceId: 'glb-source-1',
    businessMetadata: { modelType: 'glb', materialColor: '0x334455' },
  });

  assert.equal(generatedComponentMaterialSpec(ifcWall).role, 'protected-source');
  assert.equal(generatedComponentMaterialSpec(ifcWall).color, 0x123456);
  assert.equal(generatedComponentMaterialSpec(ifcWall).opacity, 0.73);
  assert.equal(generatedComponentMaterialSpec(glbWindow).role, 'protected-source');
  assert.equal(generatedComponentMaterialSpec(glbWindow).color, 0x334455);
  assert.notEqual(
    generatedComponentMaterialSpec(glbWindow).color,
    VIEWER_SEMANTIC_MATERIAL_TOKENS.windowGlazing
  );
});

test('pipe and equipment system colors keep existing semantics', () => {
  for (const systemKey of ['cooling', 'heating', 'freshAir', 'water', 'smartControl'] as const) {
    const equipment = generatedComponentMaterialSpec(
      component(`${systemKey}-equipment`, 'equipment', { systemKey })
    );
    const pipe = generatedComponentMaterialSpec(
      component(`${systemKey}-pipe`, 'pipe-route', { systemKey })
    );

    assert.equal(equipment.color, GENERATED_SYSTEM_COLORS[systemKey]);
    assert.equal(pipe.color, GENERATED_SYSTEM_COLORS[systemKey]);
    assert.equal(equipment.role, 'equipment-or-system');
    assert.equal(pipe.role, 'equipment-or-system');
  }
});
