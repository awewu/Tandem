import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearViewerCommandHistory,
  createViewerCommandHistory,
  markViewerHistoryClean,
  recordViewerCommand,
  redoViewerCommand,
  snapshotViewerEditableState,
  undoViewerCommand,
  viewerHistoryCanRedo,
  viewerHistoryCanUndo,
  viewerHistoryIsDirty,
  viewerHistoryShortcutFromEvent,
} from '../src/app/viewer/viewer-command-history';
import type { GeneratedHvacComponent, GeneratedHvacModel } from '../src/lib/api';

test('viewer command history keeps at least 50 completed actions and clears redo on a new action', () => {
  let history = createViewerCommandHistory(snapshotViewerEditableState(modelWith([])));

  for (let index = 0; index < 55; index += 1) {
    history = recordViewerCommand(history, {
      kind: 'component-move',
      label: `move ${index}`,
      before: snapshotViewerEditableState(modelWith([equipment('ahu', index, 0)])),
      after: snapshotViewerEditableState(modelWith([equipment('ahu', index + 1, 0)])),
    });
  }

  assert.equal(history.undoStack.length, 50);
  assert.equal(viewerHistoryCanUndo(history), true);

  const undone = undoViewerCommand(history);
  assert.ok(undone);
  assert.equal(viewerHistoryCanRedo(undone.history), true);

  const branched = recordViewerCommand(undone.history, {
    kind: 'component-move',
    label: 'branch move',
    before: undone.snapshot,
    after: snapshotViewerEditableState(modelWith([equipment('ahu', 99, 0)])),
  });

  assert.equal(viewerHistoryCanRedo(branched), false);
});

test('route create undo removes it and redo restores the same identity, geometry and properties', () => {
  let history = createViewerCommandHistory();
  const before = snapshotViewerEditableState(modelWith([]));
  const route = pipeRoute('route-1', [
    { x: 0, y: 0.95, z: 0 },
    { x: 3, y: 0.95, z: 2 },
  ]);
  const after = snapshotViewerEditableState(modelWith([route]));

  history = recordViewerCommand(history, {
    kind: 'route-create',
    label: 'Create route',
    before,
    after,
  });

  const undone = undoViewerCommand(history);
  assert.ok(undone);
  assert.deepEqual(undone.snapshot.generatedModel?.components, []);

  const redone = redoViewerCommand(undone.history);
  assert.ok(redone);
  const restored = redone.snapshot.generatedModel?.components[0];
  assert.equal(restored?.id, 'route-1');
  assert.deepEqual(restored?.geometry.points, route.geometry.points);
  assert.equal(restored?.dimensions.diameterMm, 32);
  assert.equal(restored?.elevation, 0.95);
  assert.deepEqual(restored?.route?.bendRadius, { radiusMm: 120 });
});

test('component delete undo restores the same identity and route endpoint connections', () => {
  const ahu = equipment('ahu-1', 0, 0);
  const route = pipeRoute('route-1', [
    { x: 0, y: 0.95, z: 0 },
    { x: 3, y: 0.95, z: 0 },
  ]);
  const before = snapshotViewerEditableState(modelWith([ahu, route]));
  const after = snapshotViewerEditableState(modelWith([route]));

  const history = recordViewerCommand(createViewerCommandHistory(), {
    kind: 'component-delete',
    label: 'Delete component',
    before,
    after,
  });

  const undone = undoViewerCommand(history);
  assert.ok(undone);
  const restoredAhu = undone.snapshot.generatedModel?.components.find((item) => item.id === 'ahu-1');
  const restoredRoute = undone.snapshot.generatedModel?.components.find((item) => item.id === 'route-1');
  assert.equal(restoredAhu?.id, 'ahu-1');
  assert.equal(restoredRoute?.route?.endpointRefs.from.equipmentId, 'ahu-1');
});

test('save checkpoint marks current state clean without clearing undo history', () => {
  let history = createViewerCommandHistory();
  history = recordViewerCommand(history, {
    kind: 'property-change',
    label: 'Diameter',
    before: snapshotViewerEditableState(modelWith([pipeRoute('route-1', [])])),
    after: snapshotViewerEditableState(modelWith([pipeRoute('route-1', [], 40)])),
  });

  history = markViewerHistoryClean(history);

  assert.equal(viewerHistoryIsDirty(history), false);
  assert.equal(viewerHistoryCanUndo(history), true);

  const undone = undoViewerCommand(history);
  assert.ok(undone);
  assert.equal(viewerHistoryIsDirty(undone.history), true);
});

test('reload clears session history after unsaved policy has accepted the switch', () => {
  const dirty = recordViewerCommand(createViewerCommandHistory(), {
    kind: 'component-create',
    label: 'Create component',
    before: snapshotViewerEditableState(modelWith([])),
    after: snapshotViewerEditableState(modelWith([equipment('ahu-1', 0, 0)])),
  });

  const reloaded = clearViewerCommandHistory(dirty, snapshotViewerEditableState(modelWith([])));

  assert.equal(viewerHistoryCanUndo(reloaded), false);
  assert.equal(viewerHistoryCanRedo(reloaded), false);
  assert.equal(viewerHistoryIsDirty(reloaded), false);
});

test('shortcuts support standard undo and redo while ignoring IME and text fields', () => {
  assert.equal(
    viewerHistoryShortcutFromEvent(keyEvent({ key: 'z', ctrlKey: true })),
    'undo'
  );
  assert.equal(
    viewerHistoryShortcutFromEvent(keyEvent({ key: 'z', metaKey: true, shiftKey: true })),
    'redo'
  );
  assert.equal(
    viewerHistoryShortcutFromEvent(keyEvent({ key: 'y', ctrlKey: true })),
    'redo'
  );
  assert.equal(
    viewerHistoryShortcutFromEvent(keyEvent({ key: 'z', ctrlKey: true, isComposing: true })),
    null
  );

  const previousHTMLElement = (globalThis as any).HTMLElement;
  class FakeHTMLElement {
    tagName = 'INPUT';
    isContentEditable = false;
  }
  (globalThis as any).HTMLElement = FakeHTMLElement;
  try {
    assert.equal(
      viewerHistoryShortcutFromEvent(
        keyEvent({ key: 'z', ctrlKey: true, target: new FakeHTMLElement() as any })
      ),
      null
    );
  } finally {
    (globalThis as any).HTMLElement = previousHTMLElement;
  }
});

test('transaction kind reserves branch and junction history extension points', () => {
  const history = recordViewerCommand(createViewerCommandHistory(), {
    kind: 'transaction',
    transactionKind: 'branch-create',
    label: 'Create branch',
    before: snapshotViewerEditableState(modelWith([pipeRoute('route-1', [])])),
    after: snapshotViewerEditableState(modelWith([pipeRoute('route-1', []), pipeRoute('branch-1', [])])),
  });

  assert.equal(history.undoStack[0].kind, 'transaction');
  assert.equal(history.undoStack[0].transactionKind, 'branch-create');
});

function keyEvent(
  patch: Partial<
    Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'> & {
      target: EventTarget | null;
    }
  >
) {
  return {
    key: patch.key ?? '',
    ctrlKey: patch.ctrlKey ?? false,
    metaKey: patch.metaKey ?? false,
    shiftKey: patch.shiftKey ?? false,
    isComposing: patch.isComposing ?? false,
    target: patch.target ?? null,
  };
}

function modelWith(components: GeneratedHvacComponent[]): GeneratedHvacModel {
  return {
    id: 'model-1',
    sourceType: 'generated',
    modelType: 'parametric-hvac',
    modelVersion: 1,
    draftId: 'draft-1',
    projectId: 'project-1',
    generatedAt: '2026-07-21T00:00:00.000Z',
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
      project: {},
      building: {},
      systems: {},
    },
  };
}

function equipment(id: string, x: number, z: number): GeneratedHvacComponent {
  return component(id, 'equipment', {
    category: 'hvac-equipment',
    systemKey: 'cooling',
    position: { x, y: 0.4, z },
    geometry: { kind: 'box', x, y: 0.4, z, width: 1, height: 0.8, depth: 1 },
    dimensions: { width: 1, height: 0.8, depth: 1 },
    elevation: 0.4,
  });
}

function pipeRoute(
  id: string,
  points: Array<{ x: number; y: number; z: number }>,
  diameterMm = 32
): GeneratedHvacComponent {
  const routePoints = points.length
    ? points
    : [
        { x: 0, y: 0.95, z: 0 },
        { x: 1, y: 0.95, z: 0 },
      ];
  return component(id, 'pipe-route', {
    category: 'route',
    systemKey: 'cooling',
    position: routePoints[0],
    geometry: { kind: 'polyline', diameterMm, points: routePoints },
    dimensions: { diameterMm },
    elevation: routePoints[0].y,
    route: {
      kind: 'logical-route',
      coordinateSystem: {
        planeAxes: ['x', 'z'],
        elevationAxis: 'y',
        ySemantics: 'absolute-model-elevation-m',
      },
      points: routePoints,
      floors: [],
      crossFloorTransitions: [],
      systemKey: 'cooling',
      routeType: 'pipe-route',
      size: { diameterMm },
      material: 'copper',
      insulation: null,
      bendRadius: { radiusMm: 120 },
      endpointRefs: {
        from: {
          endpointKey: 'from',
          endpointRole: 'source',
          equipmentId: 'ahu-1',
          equipmentRole: 'source',
          attachmentKind: 'anchor',
          attachmentId: 'ahu-1:center',
          status: 'connected',
          point: routePoints[0],
          systemKey: 'cooling',
          routeType: 'pipe-route',
        },
      },
      visibility: 'visible',
      locked: false,
      lockState: 'unlocked',
      bomMapping: {},
      summary: {
        pointCount: routePoints.length,
        floorCount: 1,
        transitionCount: 0,
        totalLengthM: 1,
      },
    },
  });
}

function component(
  id: string,
  type: GeneratedHvacComponent['type'],
  patch: Partial<GeneratedHvacComponent>
): GeneratedHvacComponent {
  return {
    id,
    draftId: 'draft-1',
    modelId: 'model-1',
    modelSourceId: null,
    sourceTemplateId: null,
    type,
    category: 'manual',
    systemKey: 'cooling',
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
