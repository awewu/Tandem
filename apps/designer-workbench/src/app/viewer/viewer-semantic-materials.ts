import type { GeneratedHvacComponent } from '../../lib/api';

export const GENERATED_SYSTEM_COLORS: Record<GeneratedHvacComponent['systemKey'], number> = {
  envelope: 0x475569,
  zone: 0x64748b,
  cooling: 0x0ea5e9,
  heating: 0xef4444,
  freshAir: 0x22c55e,
  water: 0x0891b2,
  smartControl: 0x8b5cf6,
};

export const VIEWER_SEMANTIC_MATERIAL_TOKENS = {
  wall: 0x94a3b8,
  doorPanel: 0xb7791f,
  windowGlazing: 0x38bdf8,
  windowFrame: 0xe5e7eb,
  openingFrame: 0xf8fafc,
} as const;

export const VIEWER_STATE_ACCENT_TOKENS = {
  selected: 0xfacc15,
  hover: 0x38bdf8,
  locked: 0x64748b,
  invalidPlacement: 0xef4444,
} as const;

export type ViewerMaterialRole =
  | 'wall'
  | 'door-panel'
  | 'window-glazing'
  | 'window-frame'
  | 'opening-frame'
  | 'equipment-or-system'
  | 'building-outline'
  | 'room-zone'
  | 'protected-source';

export type ViewerMaterialSpec = {
  role: ViewerMaterialRole;
  color: number;
  opacity: number;
  transparent: boolean;
  roughness: number;
  metalness: number;
  semanticToken?: keyof typeof VIEWER_SEMANTIC_MATERIAL_TOKENS;
};

export type ViewerComponentVisualState = {
  selected?: boolean;
  hovered?: boolean;
  locked?: boolean;
  invalidPlacement?: boolean;
};

export type ViewerStateTreatment = {
  accentColor: number | null;
  haloOpacity: number;
  emissiveColor: number;
  emissiveIntensity: number;
  outlineScale: number;
};

export function generatedComponentMaterialSpec(
  component: Pick<
    GeneratedHvacComponent,
    'type' | 'systemKey' | 'modelSourceId' | 'businessMetadata' | 'bomMetadata'
  >
): ViewerMaterialSpec {
  if (isProtectedImportedComponent(component)) {
    return {
      role: 'protected-source',
      color: sourceMaterialColor(component) ?? systemColor(component.systemKey),
      opacity: sourceOpacity(component) ?? 0.92,
      transparent: sourceOpacity(component) !== undefined ? sourceOpacity(component)! < 1 : false,
      roughness: 0.55,
      metalness: 0.04,
    };
  }

  if (component.type === 'wall') {
    return {
      role: 'wall',
      color: VIEWER_SEMANTIC_MATERIAL_TOKENS.wall,
      opacity: 0.94,
      transparent: true,
      roughness: 0.72,
      metalness: 0.02,
      semanticToken: 'wall',
    };
  }

  if (component.type === 'door') {
    return {
      role: 'door-panel',
      color: VIEWER_SEMANTIC_MATERIAL_TOKENS.doorPanel,
      opacity: 0.96,
      transparent: true,
      roughness: 0.58,
      metalness: 0.04,
      semanticToken: 'doorPanel',
    };
  }

  if (component.type === 'window') {
    return {
      role: 'window-glazing',
      color: VIEWER_SEMANTIC_MATERIAL_TOKENS.windowGlazing,
      opacity: 0.42,
      transparent: true,
      roughness: 0.18,
      metalness: 0.02,
      semanticToken: 'windowGlazing',
    };
  }

  if (component.type === 'building-outline') {
    return {
      role: 'building-outline',
      color: systemColor(component.systemKey),
      opacity: 0.08,
      transparent: true,
      roughness: 0.75,
      metalness: 0,
    };
  }

  if (component.type === 'room-zone') {
    return {
      role: 'room-zone',
      color: systemColor(component.systemKey),
      opacity: 0.28,
      transparent: true,
      roughness: 0.68,
      metalness: 0,
    };
  }

  return {
    role: 'equipment-or-system',
    color: systemColor(component.systemKey),
    opacity: 0.92,
    transparent: false,
    roughness: 0.5,
    metalness: 0.08,
  };
}

export function frameMaterialSpec(
  component: Pick<GeneratedHvacComponent, 'type'>
): ViewerMaterialSpec {
  return {
    role: component.type === 'window' ? 'window-frame' : 'opening-frame',
    color:
      component.type === 'window'
        ? VIEWER_SEMANTIC_MATERIAL_TOKENS.windowFrame
        : VIEWER_SEMANTIC_MATERIAL_TOKENS.openingFrame,
    opacity: component.type === 'window' ? 0.96 : 0.92,
    transparent: true,
    roughness: 0.48,
    metalness: 0.02,
    semanticToken: component.type === 'window' ? 'windowFrame' : 'openingFrame',
  };
}

export function componentStateTreatment(state: ViewerComponentVisualState): ViewerStateTreatment {
  const accentColor = state.invalidPlacement
    ? VIEWER_STATE_ACCENT_TOKENS.invalidPlacement
    : state.selected
      ? VIEWER_STATE_ACCENT_TOKENS.selected
      : state.hovered
        ? VIEWER_STATE_ACCENT_TOKENS.hover
        : state.locked
          ? VIEWER_STATE_ACCENT_TOKENS.locked
          : null;
  return {
    accentColor,
    haloOpacity: state.invalidPlacement ? 0.2 : state.selected ? 0.16 : state.hovered ? 0.1 : 0,
    emissiveColor: accentColor ?? 0x000000,
    emissiveIntensity: state.invalidPlacement
      ? 0.38
      : state.selected
        ? 0.24
        : state.hovered
          ? 0.16
          : state.locked
            ? 0.1
            : 0,
    outlineScale: state.invalidPlacement ? 1.08 : state.selected ? 1.05 : 1.03,
  };
}

export function materialSnapshot(
  component: Pick<
    GeneratedHvacComponent,
    | 'type'
    | 'systemKey'
    | 'modelSourceId'
    | 'businessMetadata'
    | 'bomMetadata'
    | 'visibility'
    | 'locked'
  >,
  state: ViewerComponentVisualState = {}
) {
  return {
    base: generatedComponentMaterialSpec(component),
    frame:
      component.type === 'door' || component.type === 'window'
        ? frameMaterialSpec(component)
        : null,
    treatment: componentStateTreatment({ ...state, locked: state.locked ?? component.locked }),
  };
}

export function isProtectedImportedComponent(
  component: Pick<GeneratedHvacComponent, 'modelSourceId' | 'businessMetadata' | 'bomMetadata'>
): boolean {
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
    return true;
  }
  return Boolean(
    component.modelSourceId &&
    (metadata.imported === true ||
      metadata.sourceType === 'local-upload' ||
      metadata.sourceType === 'artifact' ||
      metadata.modelType === 'ifc' ||
      metadata.modelType === 'glb')
  );
}

function systemColor(systemKey: GeneratedHvacComponent['systemKey']): number {
  return GENERATED_SYSTEM_COLORS[systemKey] ?? GENERATED_SYSTEM_COLORS.envelope;
}

function sourceMaterialColor(
  component: Pick<GeneratedHvacComponent, 'businessMetadata' | 'bomMetadata'>
): number | null {
  const metadata = {
    ...(component.businessMetadata ?? {}),
    ...(component.bomMetadata ?? {}),
  };
  return (
    hexColor(metadata.sourceMaterialColor) ??
    hexColor(metadata.materialColor) ??
    hexColor(metadata.baseColor) ??
    hexColor(metadata.color) ??
    hexColor((metadata.sourceMaterial as Record<string, unknown> | undefined)?.color) ??
    null
  );
}

function sourceOpacity(
  component: Pick<GeneratedHvacComponent, 'businessMetadata' | 'bomMetadata'>
): number | undefined {
  const metadata = {
    ...(component.businessMetadata ?? {}),
    ...(component.bomMetadata ?? {}),
  };
  const value = Number(metadata.sourceOpacity ?? metadata.opacity);
  if (!Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(1, value));
}

function hexColor(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const match = text.match(/^#?([0-9a-fA-F]{6})$/) ?? text.match(/^0x([0-9a-fA-F]{6})$/);
  return match ? Number.parseInt(match[1], 16) : null;
}
