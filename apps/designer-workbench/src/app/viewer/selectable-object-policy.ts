import type { GeneratedHvacComponent } from '../../lib/api';

export type SelectableSceneObject = {
  userData: Record<string, unknown>;
  parent?: SelectableSceneObject | null;
  visible?: boolean;
};

export type SelectableHit<T extends SelectableSceneObject = SelectableSceneObject> = {
  object: T;
  distance?: number;
};

export type SelectablePolicy = {
  selectable: boolean;
  locked: boolean;
  hidden: boolean;
  helper: boolean;
  reason: string;
};

const SELECTABLE_COMPONENT_TYPES = new Set([
  'wall',
  'door',
  'window',
  'room-zone',
  'equipment',
  'pipe-route',
  'duct-route',
]);

export function componentSelectablePolicy(component: GeneratedHvacComponent): SelectablePolicy {
  const metadata = {
    ...(component.businessMetadata ?? {}),
    ...(component.bomMetadata ?? {}),
  };
  const helper = component.type === 'building-outline' || metadata.visualOnly === true;
  const sourceProtected =
    Boolean(component.modelSourceId) ||
    metadata.sourceType === 'artifact' ||
    metadata.modelType === 'ifc' ||
    metadata.modelType === 'glb';
  const hidden =
    component.status === 'deleted' ||
    component.visibility === 'hidden' ||
    metadata.hidden === true ||
    metadata.visible === false ||
    metadata.selectableHidden === true;
  const locked =
    component.locked === true ||
    sourceProtected ||
    metadata.locked === true ||
    metadata.selectionLocked === true ||
    metadata.editLocked === true ||
    metadata.draggable === false;
  const selectable = SELECTABLE_COMPONENT_TYPES.has(component.type) && !helper && !hidden && !locked;

  return {
    selectable,
    locked,
    hidden,
    helper,
    reason: selectable
      ? 'business-component'
      : helper
        ? 'helper-or-boundary'
        : hidden
          ? 'hidden'
          : locked
            ? 'locked'
            : 'unsupported-component-type',
  };
}

export function markBusinessSelectable<T extends SelectableSceneObject>(
  object: T,
  component: GeneratedHvacComponent
): T {
  const policy = componentSelectablePolicy(component);
  object.userData.component = component;
  object.userData.selectable = policy.selectable;
  object.userData.selectionLocked = policy.locked;
  object.userData.selectionHidden = policy.hidden;
  object.userData.selectionHelper = policy.helper;
  object.userData.selectionReason = policy.reason;
  return object;
}

export function markSelectionHelper<T extends SelectableSceneObject>(object: T, reason = 'helper'): T {
  object.userData.selectable = false;
  object.userData.selectionLocked = true;
  object.userData.selectionHidden = false;
  object.userData.selectionHelper = true;
  object.userData.selectionReason = reason;
  return object;
}

export function selectableComponentFromObject(
  object?: SelectableSceneObject
): GeneratedHvacComponent | null {
  let current = object;
  while (current) {
    if (current.visible === false) return null;
    if (
      current.userData.selectionHelper === true ||
      current.userData.selectable === false ||
      current.userData.selectionLocked === true ||
      current.userData.selectionHidden === true
    ) {
      return null;
    }
    if (current.userData.selectable === true && current.userData.component) {
      const component = current.userData.component as GeneratedHvacComponent;
      if (!componentSelectablePolicy(component).selectable) return null;
      return sameComponentAncestorBlocked(current, component) ? null : component;
    }
    current = current.parent ?? undefined;
  }
  return null;
}

export function selectableRootFromObject<T extends SelectableSceneObject>(object?: T): T | null {
  let current: SelectableSceneObject | undefined = object;
  while (current) {
    if (current.visible === false) return null;
    if (
      current.userData.selectionHelper === true ||
      current.userData.selectable === false ||
      current.userData.selectionLocked === true ||
      current.userData.selectionHidden === true
    ) {
      return null;
    }
    if (current.userData.selectable === true && current.userData.component) {
      const component = current.userData.component as GeneratedHvacComponent;
      return sameComponentAncestorBlocked(current, component) ? null : (current as T);
    }
    current = current.parent ?? undefined;
  }
  return null;
}

function sameComponentAncestorBlocked(
  object: SelectableSceneObject,
  component: GeneratedHvacComponent
): boolean {
  let current = object.parent;
  while (current && current.userData.component === component) {
    if (
      current.visible === false ||
      current.userData.selectionHelper === true ||
      current.userData.selectable === false ||
      current.userData.selectionLocked === true ||
      current.userData.selectionHidden === true
    ) {
      return true;
    }
    current = current.parent ?? undefined;
  }
  return false;
}

export function nearestSelectableComponent(
  hits: SelectableHit[]
): GeneratedHvacComponent | null {
  const sorted = [...hits].sort((a, b) => Number(a.distance ?? 0) - Number(b.distance ?? 0));
  for (const hit of sorted) {
    const component = selectableComponentFromObject(hit.object);
    if (component) return component;
  }
  return null;
}

export function nearestSelectableRoot<T extends SelectableSceneObject>(
  hits: SelectableHit<T>[]
): T | null {
  const sorted = [...hits].sort((a, b) => Number(a.distance ?? 0) - Number(b.distance ?? 0));
  for (const hit of sorted) {
    const root = selectableRootFromObject(hit.object);
    if (root) return root;
  }
  return null;
}
