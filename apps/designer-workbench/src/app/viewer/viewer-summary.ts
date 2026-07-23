export type ProjectInputs = {
  name: string;
  city: string;
};

export type BuildingInputs = {
  area: number;
  floors: number;
  floorHeight: number;
  roomCount: number;
};

export type SystemInputs = {
  coolingSystem: string;
  heatingSystem: string;
};

export type SummaryTrustStatus = 'estimate' | 'verified';
export type ComplianceState = 'pending' | 'warning' | 'failed' | 'passed';

export interface ViewerEquipmentRow {
  id: string;
  systemKey: 'cooling' | 'heating' | 'freshAir' | 'water' | 'smartControl';
  name: string;
  quantity: number;
  unit: string;
  loadKw: number;
  trustStatus: SummaryTrustStatus;
  source: 'system-selection' | 'model-component';
  linkedComponentId?: string;
  linkedModelId?: string;
  linkedModelVersion?: number;
  componentVersion?: number;
  dimensions?: Record<string, unknown>;
  bomMetadata?: Record<string, unknown>;
  businessMetadata?: Record<string, unknown>;
}

export interface ViewerPipeRouteRow {
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
  bomMetadata?: Record<string, unknown>;
  businessMetadata?: Record<string, unknown>;
}

export interface ViewerDesignSummary {
  trustStatus: SummaryTrustStatus;
  calculationSummary: {
    status: SummaryTrustStatus;
    method: string;
    areaM2: number;
    floorCount: number;
    coolingLoadKw: number;
    heatingLoadKw: number;
  };
  equipmentSummary: {
    status: SummaryTrustStatus;
    rows: ViewerEquipmentRow[];
  };
  pipeSummary: {
    status: ComplianceState;
    source: 'model' | 'estimate' | 'pending';
    routeCount: number;
    totalLengthM: number;
    linkedComponentIds: string[];
    routes: ViewerPipeRouteRow[];
  };
  complianceSummary: {
    state: ComplianceState;
    checks: Array<{ key: string; label: string; state: ComplianceState; detail: string }>;
  };
  modelId: string | null;
  modelVersion: number | null;
}

interface GeneratedModelComponent {
  id?: string;
  type?: string;
  systemKey?: string;
  name?: string;
  modelId?: string;
  modelVersion?: number;
  version?: number;
  businessMetadata?: Record<string, unknown>;
  bomMetadata?: Record<string, unknown>;
  dimensions?: Record<string, unknown>;
  geometry?: Record<string, unknown>;
  route?: Record<string, unknown> | null;
  status?: string;
  displayName?: string;
  visibility?: string;
  locked?: boolean;
}

interface GeneratedModel {
  id?: string;
  modelVersion?: number;
  components?: GeneratedModelComponent[];
  trustStatus?: SummaryTrustStatus;
  calculationSummary?: { status?: SummaryTrustStatus; trustStatus?: SummaryTrustStatus };
}

export function buildViewerDesignSummary(input: {
  project: ProjectInputs;
  building: BuildingInputs;
  systems: SystemInputs;
  draftId?: string;
  generatedModel?: Record<string, unknown> | null;
}): ViewerDesignSummary {
  const model = asModel(input.generatedModel);
  const area = positive(input.building.area);
  const floors = Math.max(0, Math.round(positive(input.building.floors)));
  const floorHeight = positive(input.building.floorHeight);
  const coolingDensity = coolingLoadDensity(input.systems.coolingSystem);
  const heatingDensity = heatingLoadDensity(input.systems.heatingSystem);
  const envelopeFactor = floors > 1 ? 1 + Math.min(0.18, (floors - 1) * 0.04) : 1;
  const coolingLoadKw = roundKw((area * coolingDensity * envelopeFactor) / 1000);
  const heatingLoadKw = roundKw((area * heatingDensity * envelopeFactor) / 1000);
  const trustStatus =
    model?.trustStatus === 'verified' ||
    model?.calculationSummary?.status === 'verified' ||
    model?.calculationSummary?.trustStatus === 'verified'
      ? 'verified'
      : 'estimate';
  const equipmentRows = buildEquipmentRows(
    input.systems,
    coolingLoadKw,
    heatingLoadKw,
    trustStatus,
    model
  );
  const pipeSummary = buildPipeSummary(area, floors, equipmentRows, model);
  const checks = [
    {
      key: 'building-parameters',
      label: 'Building parameters',
      state:
        area > 0 && floors > 0 && floorHeight > 0
          ? ('passed' as ComplianceState)
          : ('failed' as ComplianceState),
      detail:
        area > 0 && floors > 0 && floorHeight > 0
          ? 'Area, floors and floor height are present.'
          : 'Area, floors and floor height are required.',
    },
    {
      key: 'calculation-trust',
      label: 'Calculation trust',
      state:
        trustStatus === 'verified' ? ('passed' as ComplianceState) : ('warning' as ComplianceState),
      detail:
        trustStatus === 'verified'
          ? 'Project-approved calculation data is attached.'
          : 'Loads are local estimates until approved calculation data is attached.',
    },
    {
      key: 'model-linkage',
      label: 'Model linkage',
      state: model?.components?.length
        ? ('passed' as ComplianceState)
        : input.draftId
          ? ('warning' as ComplianceState)
          : ('pending' as ComplianceState),
      detail: model?.components?.length
        ? 'Generated or loaded model components are linked.'
        : 'No generated or loaded model component summary is available yet.',
    },
  ];
  const complianceState = checks.some((check) => check.state === 'failed')
    ? 'failed'
    : checks.some((check) => check.state === 'pending')
      ? 'pending'
      : checks.some((check) => check.state === 'warning')
        ? 'warning'
        : 'passed';

  return {
    trustStatus,
    calculationSummary: {
      status: trustStatus,
      method:
        trustStatus === 'verified' ? 'approved-v2-calculation' : 'local-rule-of-thumb-estimate',
      areaM2: area,
      floorCount: floors,
      coolingLoadKw,
      heatingLoadKw,
    },
    equipmentSummary: { status: trustStatus, rows: equipmentRows },
    pipeSummary,
    complianceSummary: { state: complianceState, checks },
    modelId: model?.id ?? null,
    modelVersion: typeof model?.modelVersion === 'number' ? model.modelVersion : null,
  };
}

function buildEquipmentRows(
  systems: SystemInputs,
  coolingLoadKw: number,
  heatingLoadKw: number,
  trustStatus: SummaryTrustStatus,
  model: GeneratedModel | null
): ViewerEquipmentRow[] {
  const components = model?.components ?? [];
  const activeComponents = rollupComponents(components);
  const coolingComponent = findComponent(activeComponents, 'cooling', 'equipment');
  const freshAirComponent = findComponent(activeComponents, 'freshAir', 'equipment');
  const heatingComponent = findComponent(activeComponents, 'heating', 'equipment');
  const rows: ViewerEquipmentRow[] = [
    withComponentMetadata({
      id: 'cooling-primary',
      systemKey: 'cooling',
      name: systems.coolingSystem,
      quantity: 1,
      unit: 'set',
      loadKw: coolingLoadKw,
      trustStatus,
      source: 'system-selection',
      linkedComponentId: coolingComponent?.id,
    }, coolingComponent, model),
  ];
  if (systems.coolingSystem.toLowerCase().includes('fresh air')) {
    rows.push(withComponentMetadata({
      id: 'fresh-air-unit',
      systemKey: 'freshAir',
      name: 'Fresh air unit',
      quantity: 1,
      unit: 'set',
      loadKw: roundKw(coolingLoadKw * 0.18),
      trustStatus,
      source: 'system-selection',
      linkedComponentId: freshAirComponent?.id,
    }, freshAirComponent, model));
  }
  if (systems.heatingSystem !== 'No heating') {
    rows.push(withComponentMetadata({
      id: 'heating-primary',
      systemKey: 'heating',
      name: systems.heatingSystem,
      quantity: 1,
      unit: 'set',
      loadKw: heatingLoadKw,
      trustStatus,
      source: 'system-selection',
      linkedComponentId: heatingComponent?.id,
    }, heatingComponent, model));
  }
  const systemLinkedIds = new Set(rows.map((row) => row.linkedComponentId).filter(Boolean));
  for (const component of activeComponents) {
    if (component.type !== 'equipment' || !component.id) continue;
    if (systemLinkedIds.has(component.id) && isGeneratedPrimaryEquipment(component)) continue;
    rows.push(equipmentRowFromComponent(component, trustStatus, model));
  }
  return rows;
}

function buildPipeSummary(
  area: number,
  floors: number,
  equipmentRows: ViewerEquipmentRow[],
  model: GeneratedModel | null
): ViewerDesignSummary['pipeSummary'] {
  const pipeComponents = rollupComponents(model?.components ?? []).filter(
    (component) =>
      (component.type === 'pipe-route' || component.type === 'duct-route')
  );
  if (pipeComponents.length) {
    const routes = pipeComponents.map((component) => pipeRouteRowFromComponent(component, model));
    const totalLengthM = routes.reduce((sum, route) => sum + route.lengthM, 0);
    return {
      status: 'passed',
      source: 'model',
      routeCount: pipeComponents.length,
      totalLengthM: roundLength(totalLengthM),
      linkedComponentIds: pipeComponents
        .map((component) => component.id)
        .filter(Boolean) as string[],
      routes,
    };
  }
  if (!equipmentRows.length || area <= 0 || floors <= 0) {
    return {
      status: 'pending',
      source: 'pending',
      routeCount: 0,
      totalLengthM: 0,
      linkedComponentIds: [],
      routes: [],
    };
  }
  return {
    status: 'warning',
    source: 'estimate',
    routeCount: equipmentRows.length,
    totalLengthM: Math.round(Math.sqrt(area) * 2.2 * Math.max(1, floors) * equipmentRows.length),
    linkedComponentIds: [],
    routes: [],
  };
}

export function selectViewerSummaryModel(
  ...models: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> | null {
  return models.find((model) => asModel(model)) ?? null;
}

function asModel(value: Record<string, unknown> | null | undefined): GeneratedModel | null {
  if (!value || typeof value !== 'object' || !Object.keys(value).length) return null;
  return value as GeneratedModel;
}

function findComponent(
  components: GeneratedModelComponent[],
  systemKey: string,
  type: string
): GeneratedModelComponent | undefined {
  return components.find(
    (component) => component.systemKey === systemKey && component.type === type
  );
}

function equipmentRowFromComponent(
  component: GeneratedModelComponent,
  trustStatus: SummaryTrustStatus,
  model: GeneratedModel | null
): ViewerEquipmentRow {
  const bomMetadata = component.bomMetadata ?? {};
  const businessMetadata = component.businessMetadata ?? {};
  return withComponentMetadata({
    id: `component-${component.id}`,
    systemKey: equipmentSystemKey(component.systemKey),
    name: componentDisplayName(component),
    quantity: positiveWithFallback(bomMetadata.quantity ?? businessMetadata.quantity, 1),
    unit: textValue(bomMetadata.unit ?? businessMetadata.unit, 'set'),
    loadKw: roundKw(positiveWithFallback(
      businessMetadata.capacityKw ??
        businessMetadata.loadKw ??
        bomMetadata.loadKw ??
        component.dimensions?.loadKw,
      0
    )),
    trustStatus: summaryTrustStatus(bomMetadata.trustStatus ?? businessMetadata.trustStatus, trustStatus),
    source: 'model-component',
    linkedComponentId: component.id,
  }, component, model);
}

function pipeRouteRowFromComponent(
  component: GeneratedModelComponent,
  model: GeneratedModel | null
): ViewerPipeRouteRow {
  const geometry = component.geometry ?? {};
  const dimensions = component.dimensions ?? {};
  const businessMetadata = component.businessMetadata ?? {};
  const bomMetadata = component.bomMetadata ?? {};
  const lengthM = routeLengthM(component);
  const acceptedBomMetadata = {
    ...bomMetadata,
    measurementKey: 'estimatedLengthM',
    unit: textValue(bomMetadata.unit ?? businessMetadata.unit, 'm'),
    quantity: lengthM,
    estimatedLengthM: lengthM,
  };
  return {
    id: `route-${component.id}`,
    systemKey: String(component.systemKey ?? ''),
    name: componentDisplayName(component),
    type: String(component.type ?? 'pipe-route'),
    lengthM,
    diameterMm: positiveNumberOrUndefined(dimensions.diameterMm ?? geometry.diameterMm),
    widthMm: positiveNumberOrUndefined(dimensions.width ?? geometry.width),
    heightMm: positiveNumberOrUndefined(dimensions.height ?? geometry.height),
    material: textValue(businessMetadata.material ?? bomMetadata.material, ''),
    insulationMm: positiveNumberOrUndefined(
      businessMetadata.insulationMm ?? bomMetadata.insulationMm ?? dimensions.insulationMm
    ),
    linkedComponentId: component.id,
    linkedModelId: component.modelId ?? model?.id,
    linkedModelVersion:
      typeof component.modelVersion === 'number'
        ? component.modelVersion
        : typeof model?.modelVersion === 'number'
          ? model.modelVersion
          : undefined,
    componentVersion: typeof component.version === 'number' ? component.version : undefined,
    bomMetadata: acceptedBomMetadata,
    businessMetadata,
  };
}

function withComponentMetadata(
  row: ViewerEquipmentRow,
  component: GeneratedModelComponent | undefined,
  model: GeneratedModel | null
): ViewerEquipmentRow {
  if (!component) return row;
  return {
    ...row,
    linkedComponentId: component.id ?? row.linkedComponentId,
    linkedModelId: component.modelId ?? model?.id,
    linkedModelVersion:
      typeof component.modelVersion === 'number'
        ? component.modelVersion
        : typeof model?.modelVersion === 'number'
          ? model.modelVersion
          : undefined,
    componentVersion: typeof component.version === 'number' ? component.version : undefined,
    dimensions: component.dimensions ?? {},
    bomMetadata: component.bomMetadata ?? {},
    businessMetadata: component.businessMetadata ?? {},
  };
}

function rollupComponents(components: GeneratedModelComponent[]): GeneratedModelComponent[] {
  // Hidden only affects viewer display, and locked only blocks editing; both remain commercial.
  return components.filter(
    (component) =>
      component.status !== 'deleted' &&
      component.businessMetadata?.excluded !== true &&
      component.bomMetadata?.excluded !== true
  );
}

function equipmentSystemKey(value: unknown): ViewerEquipmentRow['systemKey'] {
  if (
    value === 'cooling' ||
    value === 'heating' ||
    value === 'freshAir' ||
    value === 'water' ||
    value === 'smartControl'
  ) {
    return value;
  }
  return 'freshAir';
}

function isGeneratedPrimaryEquipment(component: GeneratedModelComponent): boolean {
  return /^hvac-v\d+-(cooling|heating|freshAir)-equipment$/.test(String(component.id ?? ''));
}

function summaryTrustStatus(value: unknown, fallback: SummaryTrustStatus): SummaryTrustStatus {
  return value === 'verified' || value === 'estimate' ? value : fallback;
}

function textValue(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function componentDisplayName(component: GeneratedModelComponent): string {
  return textValue(
    component.displayName ?? component.name,
    `${component.systemKey ?? 'HVAC'} ${component.type ?? 'component'}`
  );
}

function routeLengthM(component: GeneratedModelComponent): number {
  const fromGeometry = routeLengthFromGeometry(component.geometry?.points);
  if (fromGeometry > 0) return fromGeometry;
  const fromRoute = routeLengthFromGeometry(component.route?.points);
  if (fromRoute > 0) return fromRoute;
  const routeSummary = recordValue(recordValue(component.route).summary);
  const length = Number(
    routeSummary.totalLengthM ??
      component.bomMetadata?.estimatedLengthM ??
      component.dimensions?.estimatedLengthM ??
      component.businessMetadata?.estimatedLengthM
  );
  return Number.isFinite(length) && length > 0 ? roundLength(length) : 0;
}

function routeLengthFromGeometry(points: unknown): number {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = pointFrom(points[index - 1]);
    const b = pointFrom(points[index]);
    total += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return roundLength(total);
}

function pointFrom(value: unknown): { x: number; y: number; z: number } {
  const point = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    x: numberWithFallback(point.x, 0),
    y: numberWithFallback(point.y, 0),
    z: numberWithFallback(point.z, 0),
  };
}

function numberWithFallback(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function positiveNumberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function positiveWithFallback(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function coolingLoadDensity(system: string): number {
  if (system.includes('Chilled water')) return 115;
  if (system.includes('Air source heat pump')) return 125;
  if (system.includes('Ducted split')) return 130;
  return 135;
}

function heatingLoadDensity(system: string): number {
  if (system === 'No heating') return 0;
  if (system.includes('Radiant')) return 85;
  if (system.includes('Air source heat pump')) return 90;
  if (system.includes('Radiators')) return 95;
  return 88;
}

function positive(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function roundKw(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundLength(value: number): number {
  return Math.round(value * 100) / 100;
}
