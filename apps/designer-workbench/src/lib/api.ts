// designer-workbench API 客户端 —— 默认同源相对路径，由 next.config.js 的 rewrites
// 服务端转发到 NestJS(3300，前缀 /api/v2)。避免浏览器跨域 CORS 与 token 跨源泄露。
import { getToken } from '@rhautt/shared-auth';

const API = process.env.NEXT_PUBLIC_API_URL || '';

export async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? getToken() || localStorage.getItem('token') : null;
  // Fastify 会拒绝「无 body 但带 Content-Type: application/json」的请求，
  // 故仅在确有 body 时才带该头（review 等无 body 的 POST 不设）。
  const hasBody = opts.body != null;
  const res = await fetch(`${API}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || `请求失败 (${res.status})`);
  return json.data ?? json;
}

export const auth = {
  login: (phone: string, password: string) =>
    apiFetch('/api/v2/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  me: () => apiFetch('/api/v2/auth/me'),
};

// ── 七系统层（独立系统）与五恒维度层（舒适目标）—— 与后端 design.service 对齐 ──
export type SystemKey =
  'hotWater' | 'water' | 'heating' | 'airConditioning' | 'freshAir' | 'humidity' | 'control';

export interface CalcInput {
  area?: number;
  city?: string;
  buildingType?: string;
  systems?: SystemKey[];
  waterParams?: Record<string, unknown>;
  // 校验闸入参（noise / condensation / hydraulic / diversity 等，透传给 evaluateGate）
  [k: string]: unknown;
}

export interface GateCheck {
  key: string;
  label?: string;
  status: 'pass' | 'fail' | 'warn' | string;
  detail?: string;
}
export interface GateResult {
  pass: boolean | null;
  blocked?: boolean;
  requiresOverride?: boolean;
  checks: GateCheck[];
}
export interface ComfortDim {
  key: string;
  label: string;
  basis: string;
  status: string;
  ok: boolean | null;
}
export interface CalcResult {
  input: { area: number; city: string; buildingType: string };
  load: { coolingLoad?: number; heatingLoad?: number; method?: string; accuracy?: string } | null;
  systems: { key: SystemKey; label: string; selected: boolean; design?: unknown }[];
  comfortDimensions: ComfortDim[];
  gate: GateResult;
  releasable: boolean;
  requiresOverride?: boolean;
  disclaimer: string;
}

export interface DesignRelease {
  id: string;
  status: 'draft' | 'reviewed' | 'released';
  gatePass?: boolean | null;
  gateBlocked?: boolean;
  overrideRequired?: boolean;
  overrideSigned?: boolean;
  overrideReason?: string | null;
  disclaimerAccepted?: boolean;
  reviewedAt?: string | null;
  releasedAt?: string | null;
  calcSnapshot?: CalcResult;
}

export const design = {
  // 一键精算（不落库）：负荷 + 七系统 + 五恒维度 + 校验闸
  calc: (input: CalcInput): Promise<CalcResult> =>
    apiFetch('/api/v2/design/calc', { method: 'POST', body: JSON.stringify(input) }),
  // 签章状态机
  createRelease: (
    input: CalcInput & { projectId?: string; customerId?: string }
  ): Promise<{ id: string; status: string; gate: GateResult }> =>
    apiFetch('/api/v2/design/releases', { method: 'POST', body: JSON.stringify(input) }),
  getRelease: (id: string): Promise<DesignRelease> =>
    apiFetch(`/api/v2/design/releases/${encodeURIComponent(id)}`),
  review: (id: string) =>
    apiFetch(`/api/v2/design/releases/${encodeURIComponent(id)}/review`, { method: 'POST' }),
  override: (id: string, reason: string) =>
    apiFetch(`/api/v2/design/releases/${encodeURIComponent(id)}/override`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  release: (id: string, disclaimerAccepted: boolean) =>
    apiFetch(`/api/v2/design/releases/${encodeURIComponent(id)}/release`, {
      method: 'POST',
      body: JSON.stringify({ disclaimerAccepted }),
    }),
  listProjects: () => apiFetch('/api/v2/design/projects'),
  // P2 · 管线/风管自动寻路（A* 栅格 + 主干复用）
  autoRoute: (input: AutoRouteInputT): Promise<AutoRouteData> =>
    apiFetch('/api/v2/design/layout/auto-route', { method: 'POST', body: JSON.stringify(input) }),
  // P2 · CFD 气流组织 / 热舒适仿真（PMV/PPD）
  simulateCfd: (input: CfdInputT): Promise<CfdData> =>
    apiFetch('/api/v2/design/cfd/simulate', { method: 'POST', body: JSON.stringify(input) }),
};

// ── P2 · 自动寻路 ──────────────────────────────────────────────
export interface AutoRoutePoint {
  x: number;
  y: number;
  id?: string;
}
export interface AutoRouteObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface AutoRouteInputT {
  bounds: { width: number; height: number };
  source: { x: number; y: number };
  terminals: AutoRoutePoint[];
  obstacles?: AutoRouteObstacle[];
  gridStepMm?: number;
  turnPenalty?: number;
}
export interface AutoRoute {
  id: string;
  pathMm: Array<[number, number]>;
  lengthM: number;
  reachable: boolean;
}
export interface AutoRouteData {
  method: string;
  trust: string;
  gridStepMm: number;
  grid: { rows: number; cols: number };
  source: { x: number; y: number };
  routes: AutoRoute[];
  totalNetworkLengthM: number;
  sumBranchLengthM: number;
  savedByTrunkM: number;
  unreachable: string[];
  note?: string;
}

// ── P2 · CFD 仿真 ──────────────────────────────────────────────
export interface CfdInputT {
  roomDimensions: { length: number; width: number; height: number };
  season?: 'summer' | 'winter';
  resolutionM?: number;
  inlets?: Array<Record<string, unknown>>;
  outlets?: Array<Record<string, unknown>>;
  heatSources?: Array<Record<string, unknown>>;
}
export interface CfdRec {
  type: string;
  priority: string;
  issue: string;
  suggestion: string;
  impact: string;
}
export interface CfdData {
  method: string;
  trust: string;
  simulationId: string;
  season: string;
  meshInfo: Record<string, unknown>;
  comfort: {
    overall: { pmv: number; ppd: number; isComfortable: boolean };
    distribution: { cold: number; cool: number; comfortable: number; warm: number; hot: number };
    hotspotCount: number;
    draftCount: number;
    hotspots: Array<Record<string, number>>;
    drafts: Array<Record<string, number>>;
  };
  velocityDistribution?: unknown;
  temperatureDistribution?: unknown;
  pressureDrop?: unknown;
  quality?: unknown;
  recommendations: CfdRec[];
  note?: string;
}

// ── M12 · design↔Rysnova 单一真相源（tenantId 由后端从 JWT 取，不再前端传） ──
export type SyncState = 'in_sync' | 'stale' | 'proposed_change';

export interface SyncLink {
  syncId: string;
  artifactId: string | null;
  artifactVersion: string | null;
  designVersion: string;
  syncState: SyncState;
  changeProposal: Record<string, unknown> | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  updatedAt: string;
}

export interface SyncStatus {
  designId: string;
  sourceOfTruth: 'design';
  artifacts: number;
  states: Record<SyncState, number>;
  allInSync: boolean;
  links: SyncLink[];
}

export interface QuotationSummary {
  quoteId?: string;
  summary?: { subtotal: number; tax: number; total: number; currency: string };
}

export const quotation = {
  generate: (body: Record<string, unknown>): Promise<QuotationSummary> =>
    apiFetch('/api/v2/quotation/generate', { method: 'POST', body: JSON.stringify(body) }),
  persist: (body: Record<string, unknown>): Promise<{ id: string; quotationNo: string }> =>
    apiFetch('/api/v2/quotation', { method: 'POST', body: JSON.stringify(body) }),
  list: (query?: Record<string, string>): Promise<{ items?: any[] }> =>
    apiFetch('/api/v2/quotation?' + new URLSearchParams(query || {}).toString()),
  lock: (id: string): Promise<any> =>
    apiFetch(`/api/v2/quotation/${encodeURIComponent(id)}/lock`, { method: 'POST' }),
};

export const sync = {
  status: (designId: string): Promise<SyncStatus> =>
    apiFetch(`/api/v2/rysnova-bim/sync/status/${encodeURIComponent(designId)}`),
  // 登记 Rysnova 深化产物为某 design 版本的派生
  link: (body: {
    designId: string;
    designVersion: string;
    artifactId: string;
    artifactVersion?: string;
  }) => apiFetch('/api/v2/rysnova-bim/sync/link', { method: 'POST', body: JSON.stringify(body) }),
  // design 变更 → 该 design 全部派生产物置 stale
  designChanged: (designId: string, newVersion: string) =>
    apiFetch('/api/v2/rysnova-bim/sync/design-changed', {
      method: 'POST',
      body: JSON.stringify({ designId, newVersion }),
    }),
  // Rysnova 工程修正 → 变更建议回流 design
  proposeChange: (syncId: string, proposal: Record<string, unknown>) =>
    apiFetch('/api/v2/rysnova-bim/sync/propose-change', {
      method: 'POST',
      body: JSON.stringify({ syncId, proposal }),
    }),
  // design 审核确认变更 → 回到 in_sync
  confirm: (syncId: string, newDesignVersion: string) =>
    apiFetch('/api/v2/rysnova-bim/sync/confirm', {
      method: 'POST',
      body: JSON.stringify({ syncId, newDesignVersion }),
    }),
};

export interface ViewerDraftPayload {
  id?: string;
  projectId?: string | null;
  designProjectId?: string | null;
  bimProjectId?: string | null;
  customerId?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
  artifactId?: string | null;
  projectInputs: Record<string, unknown>;
  buildingInputs: Record<string, unknown>;
  systemInputs: Record<string, unknown>;
  generatedModel?: GeneratedHvacModel | Record<string, unknown>;
}

export interface ViewerDraft extends ViewerDraftPayload {
  id: string;
  version: number;
  status: 'draft' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type GeneratedHvacSystemKey =
  | 'envelope'
  | 'zone'
  | 'cooling'
  | 'heating'
  | 'freshAir'
  | 'water'
  | 'smartControl';
export type GeneratedHvacComponentType =
  | 'building-outline'
  | 'wall'
  | 'door'
  | 'window'
  | 'room-zone'
  | 'equipment'
  | 'pipe-route'
  | 'duct-route';

export interface LogicalRouteShape {
  kind: 'logical-route';
  coordinateSystem: {
    planeAxes: ['x', 'z'];
    elevationAxis: 'y';
    ySemantics: 'absolute-model-elevation-m';
  };
  points: Array<{ x: number; y: number; z: number }>;
  floors: Array<{
    floor: number;
    floorId: string;
    pointIndexes: number[];
    elevationMin: number;
    elevationMax: number;
  }>;
  crossFloorTransitions: Array<{
    kind: 'riser' | 'stair' | 'shaft' | 'sleeve';
    fromFloor: number;
    toFloor: number;
    startPointIndex: number | null;
    endPointIndex: number | null;
    sourceFloorId?: string;
    targetFloorId?: string;
    sourceElevation?: number;
    targetElevation?: number;
    x?: number;
    z?: number;
    installHeight?: number;
    createdAt?: string;
  }>;
  systemKey: GeneratedHvacSystemKey;
  routeType: 'pipe-route' | 'duct-route';
  size: Record<string, unknown>;
  material: string | null;
  insulation: Record<string, unknown> | null;
  bendRadius: Record<string, unknown> | null;
  endpointRefs: RouteEndpointRefs | Record<string, unknown>;
  visibility: 'visible' | 'hidden';
  locked: boolean;
  lockState: 'locked' | 'unlocked';
  bomMapping: Record<string, unknown>;
  summary: {
    pointCount: number;
    floorCount: number;
    transitionCount: number;
    totalLengthM: number;
  };
}

export type RouteEndpointKey = 'from' | 'to';
export type RouteEndpointRole = 'source' | 'target';
export type RouteEndpointAttachmentKind = 'connector' | 'anchor';
export type RouteEndpointConnectionStatus = 'connected' | 'disconnected' | 'stale';
export interface RouteEndpointRef {
  endpointKey: RouteEndpointKey;
  endpointRole: RouteEndpointRole;
  equipmentId: string;
  equipmentRole: RouteEndpointRole;
  attachmentKind: RouteEndpointAttachmentKind;
  attachmentId: string;
  status: RouteEndpointConnectionStatus;
  point: { x: number; y: number; z: number };
  systemKey: GeneratedHvacSystemKey;
  routeType: 'pipe-route' | 'duct-route';
  distanceM?: number;
  fallbackReason?: string;
  staleReason?: string;
}
export type RouteEndpointRefs = Partial<Record<RouteEndpointKey, RouteEndpointRef>>;

export interface GeneratedHvacComponent {
  id: string;
  draftId: string;
  modelId: string;
  modelSourceId: string | null;
  sourceTemplateId: string | null;
  type: GeneratedHvacComponentType;
  category: string;
  systemKey: GeneratedHvacSystemKey;
  modelVersion: number;
  version: number;
  name: string;
  displayName: string;
  geometry: Record<string, unknown>;
  route: LogicalRouteShape | null;
  dimensions: Record<string, unknown>;
  position: Record<string, unknown>;
  rotation: Record<string, unknown>;
  visibility: 'visible' | 'hidden';
  locked: boolean;
  floor: number;
  elevation: number | null;
  installHeight: number | null;
  businessMetadata: Record<string, unknown>;
  bomMetadata: Record<string, unknown>;
  status: 'active' | 'deleted';
}

export type GeneratedHvacComponentPayload = Partial<
  Pick<
    GeneratedHvacComponent,
    | 'id'
    | 'type'
    | 'category'
    | 'systemKey'
    | 'name'
    | 'displayName'
    | 'sourceTemplateId'
    | 'modelSourceId'
    | 'dimensions'
    | 'position'
    | 'rotation'
    | 'visibility'
    | 'locked'
    | 'floor'
    | 'elevation'
    | 'installHeight'
    | 'businessMetadata'
    | 'bomMetadata'
    | 'geometry'
    | 'route'
    | 'status'
  >
>;

export interface ViewerDraftRiserPayload {
  sourceFloor: number;
  targetFloor: number;
  point: { x: number; z: number; y?: number };
  sourceElevation?: number;
  targetElevation?: number;
}

export type ViewerComponentCatalogCategoryKey =
  | 'wall'
  | 'door'
  | 'window'
  | 'room-zone'
  | 'hvac-equipment'
  | 'pipe';

export interface ViewerComponentCatalogCategory {
  key: ViewerComponentCatalogCategoryKey;
  label: string;
  description: string;
  sortOrder: number;
}

export interface ViewerComponentCatalogTemplate {
  id: string;
  category: ViewerComponentCatalogCategoryKey;
  type: GeneratedHvacComponentType;
  label: string;
  description: string;
  systemKey: GeneratedHvacSystemKey;
  defaultDimensions: Record<string, number | string>;
  editableProperties: Array<{
    key: string;
    label: string;
    input: 'text' | 'number' | 'select' | 'boolean';
    unit?: string;
    defaultValue?: string | number | boolean;
    options?: Array<{ value: string; label: string }>;
  }>;
  bomMapping: {
    category: string;
    skuPrefix: string;
    quantityUnit: 'm' | 'm2' | 'm3' | 'set' | 'point' | 'zone';
    measurementKey: string;
    notes: string[];
  };
}

export interface ViewerComponentCatalog {
  source: 'seed-global-defaults';
  version: string;
  extensionPoint: string;
  categories: ViewerComponentCatalogCategory[];
  templates: ViewerComponentCatalogTemplate[];
}

export interface LegacyDesigner2dProject {
  name?: string;
  walls?: Array<{ id?: string; points?: number[] }>;
  devices?: Array<{ id?: string; type?: string; x?: number; y?: number; rotation?: number }>;
  pipes?: Array<{ id?: string; type?: string; points?: number[] }>;
  doors?: Array<{ id?: string; x?: number; y?: number; rotation?: number }>;
  windows?: Array<{ id?: string; x?: number; y?: number; rotation?: number }>;
  texts?: Array<{ id?: string; x?: number; y?: number; text?: string; size?: number }>;
}

export interface GeneratedHvacModel {
  id: string;
  sourceType: 'generated';
  modelType: 'parametric-hvac';
  modelVersion: number;
  draftId: string;
  projectId: string | null;
  generatedAt: string;
  layers: Array<{
    systemKey: 'cooling' | 'heating' | 'freshAir';
    label: string;
    componentIds: string[];
  }>;
  components: GeneratedHvacComponent[];
  componentSummary: {
    total: number;
    byType: Record<string, number>;
    bySystem: Record<string, number>;
    byStatus: Record<string, number>;
    bomMappableComponentIds: string[];
    routeSummary?: {
      routeCount: number;
      totalLengthM: number;
      crossFloorRouteCount: number;
      crossFloorTransitionCount: number;
    };
  };
  inputs: {
    project: Record<string, unknown>;
    building: Record<string, unknown>;
    systems: Record<string, unknown>;
  };
}

export const viewerComponentCatalog = {
  list: (): Promise<ViewerComponentCatalog> =>
    apiFetch('/api/v2/rysnova-bim/component-catalog'),
};

export const viewerDrafts = {
  get: (id: string): Promise<ViewerDraft> =>
    apiFetch(`/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(id)}`),
  save: (draft: ViewerDraftPayload): Promise<ViewerDraft> =>
    apiFetch(
      draft.id
        ? `/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(draft.id)}`
        : '/api/v2/rysnova-bim/viewer-drafts',
      { method: draft.id ? 'PUT' : 'POST', body: JSON.stringify(draft) }
    ),
  generateModel: (id: string): Promise<ViewerDraft> =>
    apiFetch(`/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(id)}/generated-model`, {
      method: 'POST',
    }),
  convertLegacyDesigner2d: (
    id: string,
    payload: { legacyProject: LegacyDesigner2dProject; sourceName?: string | null }
  ): Promise<ViewerDraft> =>
    apiFetch(
      `/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(id)}/legacy-designer-2d-conversion`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  createComponent: (id: string, component: GeneratedHvacComponentPayload): Promise<ViewerDraft> =>
    apiFetch(`/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(id)}/components`, {
      method: 'POST',
      body: JSON.stringify(component),
    }),
  updateComponent: (
    id: string,
    componentId: string,
    component: GeneratedHvacComponentPayload
  ): Promise<ViewerDraft> =>
    apiFetch(
      `/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(id)}/components/${encodeURIComponent(componentId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(component),
      }
    ),
  addRiser: (id: string, componentId: string, payload: ViewerDraftRiserPayload): Promise<ViewerDraft> =>
    apiFetch(
      `/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(id)}/components/${encodeURIComponent(componentId)}/riser`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  deleteComponent: (id: string, componentId: string): Promise<ViewerDraft> =>
    apiFetch(
      `/api/v2/rysnova-bim/viewer-drafts/${encodeURIComponent(id)}/components/${encodeURIComponent(componentId)}`,
      { method: 'DELETE' }
    ),
};

export type ViewerModelSourceType = 'generated' | 'local-upload' | 'artifact';
export type ViewerModelType = 'ifc' | 'glb' | 'generated' | 'unknown';
export type ViewerModelLoadStatus = 'loading' | 'ready' | 'error' | 'archived';
export type ViewerModelRecordStatus = 'active' | 'archived' | 'deleted';

export interface ViewerModelSourcePayload {
  id?: string;
  draftId?: string | null;
  projectId?: string | null;
  designProjectId?: string | null;
  bimProjectId?: string | null;
  customerId?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
  sourceType: ViewerModelSourceType;
  modelType?: ViewerModelType | null;
  name?: string | null;
  artifactId?: string | null;
  uploadReference?: Record<string, unknown> | null;
  loadStatus?: ViewerModelLoadStatus;
  recordStatus?: ViewerModelRecordStatus;
  loadError?: string | null;
  metadata?: Record<string, unknown> | null;
  componentSummary?: Record<string, unknown> | null;
}

export interface ViewerModelSource extends ViewerModelSourcePayload {
  id: string;
  tenantId: string;
  dealerId: string | null;
  storeId: string | null;
  sourceType: ViewerModelSourceType;
  modelType: ViewerModelType;
  loadStatus: ViewerModelLoadStatus;
  recordStatus: ViewerModelRecordStatus;
  version: number;
  archivedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const modelSources = {
  get: (id: string): Promise<ViewerModelSource> =>
    apiFetch(`/api/v2/rysnova-bim/model-sources/${encodeURIComponent(id)}`),
  list: (query?: {
    projectId?: string;
    draftId?: string;
    artifactId?: string;
    includeArchived?: boolean;
  }): Promise<{ items: ViewerModelSource[] }> =>
    apiFetch(
      `/api/v2/rysnova-bim/model-sources?${new URLSearchParams(
        Object.entries(query || {}).reduce(
          (acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== false) acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>
        )
      ).toString()}`
    ),
  save: (source: ViewerModelSourcePayload): Promise<ViewerModelSource> =>
    apiFetch(
      source.id
        ? `/api/v2/rysnova-bim/model-sources/${encodeURIComponent(source.id)}`
        : '/api/v2/rysnova-bim/model-sources',
      { method: source.id ? 'PUT' : 'POST', body: JSON.stringify(source) }
    ),
  duplicate: (id: string, name?: string): Promise<ViewerModelSource> =>
    apiFetch(`/api/v2/rysnova-bim/model-sources/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  rename: (id: string, name: string): Promise<ViewerModelSource> =>
    apiFetch(`/api/v2/rysnova-bim/model-sources/${encodeURIComponent(id)}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  archive: (id: string): Promise<ViewerModelSource> =>
    apiFetch(`/api/v2/rysnova-bim/model-sources/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
    }),
  delete: (id: string): Promise<ViewerModelSource> =>
    apiFetch(`/api/v2/rysnova-bim/model-sources/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

export interface ViewerSummaryPayload {
  id?: string;
  draftId?: string | null;
  draftVersion?: number | null;
  modelId?: string | null;
  modelVersion?: number | null;
  projectId?: string | null;
  designProjectId?: string | null;
  bimProjectId?: string | null;
  trustStatus: 'estimate' | 'verified';
  calculationSummary: Record<string, unknown>;
  equipmentSummary: Record<string, unknown>;
  pipeSummary: Record<string, unknown>;
  complianceSummary: Record<string, unknown>;
}

export interface ViewerSummary extends ViewerSummaryPayload {
  id: string;
  tenantId: string;
  dealerId: string | null;
  storeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const viewerSummaries = {
  get: (id: string): Promise<ViewerSummary> =>
    apiFetch(`/api/v2/rysnova-bim/viewer-summaries/${encodeURIComponent(id)}`),
  latest: (draftId: string): Promise<ViewerSummary | null> =>
    apiFetch(`/api/v2/rysnova-bim/viewer-summaries/latest?draftId=${encodeURIComponent(draftId)}`),
  save: (summary: ViewerSummaryPayload): Promise<ViewerSummary> =>
    apiFetch(
      summary.id
        ? `/api/v2/rysnova-bim/viewer-summaries/${encodeURIComponent(summary.id)}`
        : '/api/v2/rysnova-bim/viewer-summaries',
      { method: summary.id ? 'PUT' : 'POST', body: JSON.stringify(summary) }
    ),
};
