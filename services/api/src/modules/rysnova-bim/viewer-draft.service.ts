import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import { ViewerDesignDraftEntity } from './viewer-draft.entity';
import {
  convertLegacyDesigner2dToGeneratedModel,
  LegacyDesigner2dProject,
  normalizeLegacyDesigner2dProject,
} from './legacy-designer-2d-converter';
import {
  bomMetadataFromDerivedRoute,
  deriveRouteBomMapping,
  deriveRouteSummaryFromComponents,
  routeLengthFromAcceptedPoints,
} from './route-derived-quantities';

const MAX_FLOOR = 99;
const MAX_ELEVATION_M = 200;
const MAX_INSTALL_HEIGHT_M = 50;

export interface LogicalRoutePoint3 {
  x: number;
  y: number;
  z: number;
}

export interface LogicalRouteFloorParticipation {
  floor: number;
  floorId: string;
  pointIndexes: number[];
  elevationMin: number;
  elevationMax: number;
}

export interface LogicalRouteCrossFloorTransition {
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
  point?: LogicalRoutePoint3;
  systemKey?: string | null;
  routeType?: string | null;
  distanceM?: number;
  fallbackReason?: string | null;
  staleReason?: string | null;
}

export interface LogicalRouteShape {
  kind: 'logical-route';
  coordinateSystem: {
    planeAxes: ['x', 'z'];
    elevationAxis: 'y';
    ySemantics: 'absolute-model-elevation-m';
  };
  points: LogicalRoutePoint3[];
  floors: LogicalRouteFloorParticipation[];
  crossFloorTransitions: LogicalRouteCrossFloorTransition[];
  systemKey: GeneratedHvacSystemKey;
  routeType: 'pipe-route' | 'duct-route';
  size: Record<string, unknown>;
  material: string | null;
  insulation: Record<string, unknown> | null;
  bendRadius: Record<string, unknown> | null;
  endpointRefs: Record<string, unknown>;
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

export interface ViewerDraftInput {
  id?: string;
  projectId?: string | null;
  designProjectId?: string | null;
  bimProjectId?: string | null;
  customerId?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
  artifactId?: string | null;
  status?: 'draft' | 'archived';
  projectInputs?: Record<string, unknown>;
  buildingInputs?: Record<string, unknown>;
  systemInputs?: Record<string, unknown>;
  generatedModel?: Record<string, unknown>;
}

export interface ViewerDraftComponentInput {
  id?: string;
  type?: GeneratedHvacComponent['type'];
  category?: string;
  systemKey?: GeneratedHvacComponent['systemKey'];
  name?: string;
  displayName?: string;
  sourceTemplateId?: string | null;
  modelSourceId?: string | null;
  dimensions?: Record<string, unknown>;
  position?: Record<string, unknown>;
  rotation?: Record<string, unknown>;
  visibility?: GeneratedHvacComponent['visibility'];
  locked?: boolean;
  lockState?: 'locked' | 'unlocked';
  floor?: number | null;
  elevation?: number | null;
  installHeight?: number | null;
  businessMetadata?: Record<string, unknown>;
  bomMetadata?: Record<string, unknown>;
  geometry?: Record<string, unknown>;
  route?: Record<string, unknown> | LogicalRouteShape | null;
  status?: GeneratedHvacComponent['status'];
}

export interface ViewerDraftRiserInput {
  sourceFloor?: number;
  targetFloor?: number;
  point?: {
    x?: number;
    y?: number;
    z?: number;
  };
  sourceElevation?: number;
  targetElevation?: number;
}

export interface ViewerLegacyDesigner2dConversionInput {
  legacyProject?: LegacyDesigner2dProject;
  project?: LegacyDesigner2dProject;
  sourceName?: string | null;
}

export type GeneratedHvacComponentType =
  | 'building-outline'
  | 'wall'
  | 'door'
  | 'window'
  | 'room-zone'
  | 'equipment'
  | 'pipe-route'
  | 'duct-route';

export type GeneratedHvacSystemKey =
  | 'envelope'
  | 'zone'
  | 'cooling'
  | 'heating'
  | 'freshAir'
  | 'water'
  | 'smartControl';

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
  route?: LogicalRouteShape | null;
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

@Injectable()
export class ViewerDraftService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('tenant context required');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }

  async save(user: JwtPayload, dto: ViewerDraftInput) {
    const tenantId = this.scope(user);
    const id = dto.id?.trim();
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ViewerDesignDraftEntity);
      const existing = id
        ? await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) })
        : null;
      if (id && !existing) throw new NotFoundException('viewer draft not found');

      const next = existing ?? repo.create({
        tenantId,
        dealerId: user.dealerId ?? null,
        storeId: user.storeId ?? null,
        createdBy: user.userId ?? null,
        version: 0,
        status: 'draft',
      });
      const previousFloorSignature = floorLevelSignature(next);
      next.updatedBy = user.userId ?? null;
      next.version = Number(next.version || 0) + 1;
      next.status = dto.status ?? next.status ?? 'draft';
      next.projectId = clean(dto.projectId, next.projectId);
      next.designProjectId = clean(dto.designProjectId, next.designProjectId);
      next.bimProjectId = clean(dto.bimProjectId, next.bimProjectId);
      next.customerId = clean(dto.customerId, next.customerId);
      next.opportunityId = clean(dto.opportunityId, next.opportunityId);
      next.contractId = clean(dto.contractId, next.contractId);
      next.artifactId = clean(dto.artifactId, next.artifactId);
      next.projectInputs = dto.projectInputs === undefined ? next.projectInputs ?? {} : ensureObject(dto.projectInputs, 'projectInputs');
      next.buildingInputs = dto.buildingInputs === undefined ? next.buildingInputs ?? {} : ensureObject(dto.buildingInputs, 'buildingInputs');
      next.systemInputs = dto.systemInputs === undefined ? next.systemInputs ?? {} : ensureObject(dto.systemInputs, 'systemInputs');
      next.generatedModel = dto.generatedModel === undefined ? next.generatedModel ?? {} : ensureObject(dto.generatedModel, 'generatedModel');
      if (existing && dto.buildingInputs !== undefined && previousFloorSignature !== floorLevelSignature(next)) {
        next.generatedModel = markRoutesForFloorLevelReview(next.generatedModel, 'building-floor-level-data-changed');
      }
      return this.present(await repo.save(next));
    }, this.rls(user));
  }

  async generateModel(user: JwtPayload, id: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ViewerDesignDraftEntity);
      const draft = await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!draft) throw new NotFoundException('viewer draft not found');

      const nextVersion = Number(draft.version || 0) + 1;
      draft.generatedModel = generateParametricHvacModel(draft, nextVersion) as unknown as Record<string, unknown>;
      draft.version = nextVersion;
      draft.updatedBy = user.userId ?? null;
      return this.present(await repo.save(draft));
    }, this.rls(user));
  }

  async convertLegacyDesigner2d(
    user: JwtPayload,
    id: string,
    input: ViewerLegacyDesigner2dConversionInput,
  ) {
    const tenantId = this.scope(user);
    const source = normalizeLegacyDesigner2dProject(input?.legacyProject ?? input?.project ?? input);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ViewerDesignDraftEntity);
      const draft = await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!draft) throw new NotFoundException('viewer draft not found');

      const nextVersion = Number(draft.version || 0) + 1;
      const model = convertLegacyDesigner2dToGeneratedModel(
        {
          draftId: draft.id,
          projectId: draft.projectId,
          modelVersion: nextVersion,
          projectInputs: ensurePlain(draft.projectInputs),
          buildingInputs: ensurePlain(draft.buildingInputs),
          systemInputs: ensurePlain(draft.systemInputs),
        },
        source
      );
      model.id = `${draft.id}-legacy-designer-2d-v${nextVersion}`;
      for (const item of model.components) stampComponentContext(item, draft, model, nextVersion);
      model.layers = buildLayers(model.components);
      model.componentSummary = summarize(model.components);

      draft.projectInputs = {
        ...ensurePlain(draft.projectInputs),
        ...(source.name ? { name: source.name } : {}),
        legacyDesigner2dSource: {
          sourceName: clean(input?.sourceName, null),
          convertedAt: model.generatedAt,
          wallCount: source.walls?.length ?? 0,
          deviceCount: source.devices?.length ?? 0,
          pipeCount: source.pipes?.length ?? 0,
          doorCount: source.doors?.length ?? 0,
          windowCount: source.windows?.length ?? 0,
          textCount: source.texts?.length ?? 0,
        },
      };
      draft.generatedModel = model as unknown as Record<string, unknown>;
      draft.version = nextVersion;
      draft.updatedBy = user.userId ?? null;
      return this.present(await repo.save(draft));
    }, this.rls(user));
  }

  async createComponent(user: JwtPayload, id: string, input: ViewerDraftComponentInput) {
    return this.editGeneratedModel(user, id, (draft, model, nextVersion) => {
      const component = normalizeComponentInput(input, draft, model, nextVersion, model.components.length);
      if (model.components.some((item) => item.id === component.id)) {
        throw new BadRequestException('component id already exists');
      }
      model.components.push(component);
      return draft;
    });
  }

  async updateComponent(user: JwtPayload, id: string, componentId: string, input: ViewerDraftComponentInput) {
    return this.editGeneratedModel(user, id, (draft, model, nextVersion) => {
      const index = model.components.findIndex((item) => item.id === componentId);
      if (index < 0) throw new NotFoundException('viewer component not found');
      const current = model.components[index];
      assertMutableRoute(current, 'update route');
      const next = normalizeComponentInput(
        {
          id: current.id,
          type: input.type ?? current.type,
          category: input.category ?? current.category,
          systemKey: input.systemKey ?? current.systemKey,
          name: input.name ?? current.name,
          displayName: input.displayName ?? current.displayName ?? current.name,
          sourceTemplateId: input.sourceTemplateId ?? current.sourceTemplateId,
          modelSourceId: input.modelSourceId ?? current.modelSourceId,
          dimensions: input.dimensions ?? current.dimensions,
          position: input.position ?? current.position,
          rotation: input.rotation ?? current.rotation,
          visibility: input.visibility ?? current.visibility,
          locked: input.lockState !== undefined ? input.locked : input.locked ?? current.locked,
          lockState: input.lockState,
          floor: input.floor ?? current.floor,
          elevation: input.elevation ?? current.elevation,
          installHeight: input.installHeight ?? current.installHeight,
          businessMetadata: input.businessMetadata ?? current.businessMetadata,
          bomMetadata: input.bomMetadata ?? current.bomMetadata,
          geometry: input.geometry ?? current.geometry,
          route: input.route === undefined ? current.route ?? null : input.route,
          status: input.status ?? current.status,
        },
        draft,
        model,
        nextVersion,
        index,
      );
      model.components[index] = next;
      if (current.type === 'equipment' && next.type === 'equipment') {
        reconcileEquipmentRouteConnections(model, current, next);
      }
      return draft;
    });
  }

  async addRiser(user: JwtPayload, id: string, componentId: string, input: ViewerDraftRiserInput) {
    return this.editGeneratedModel(user, id, (draft, model, nextVersion) => {
      const index = model.components.findIndex((item) => item.id === componentId);
      if (index < 0) throw new NotFoundException('viewer component not found');
      const current = model.components[index];
      if (current.locked) throw new BadRequestException('locked route cannot add riser');
      if (current.type !== 'pipe-route' && current.type !== 'duct-route') {
        throw new BadRequestException('riser can only be added to route components');
      }
      const point = ensureObject(input.point, 'riser.point');
      const x = coordinateNumber(point.x, 'riser.point.x');
      if (point.y !== undefined) verticalCoordinate(point.y, 'riser.point.y');
      const z = coordinateNumber(point.z, 'riser.point.z');
      const sourceFloor = normalizeExistingFloor(
        input.sourceFloor ?? current.floor ?? current.businessMetadata?.floor,
        'riser.sourceFloor',
        draft
      );
      const targetFloor = normalizeExistingFloor(input.targetFloor, 'riser.targetFloor', draft);
      if (sourceFloor === targetFloor) {
        throw new BadRequestException('riser target floor must be different from source floor');
      }

      const installHeight = routeInstallHeight(current, draft, sourceFloor);
      const sourceRef = floorRef(sourceFloor, draft);
      const targetRef = floorRef(targetFloor, draft);
      const sourceElevation = roundMeters(sourceRef.level + installHeight);
      const targetElevation = roundMeters(targetRef.level + installHeight);
      assertDerivedElevation(input.sourceElevation, sourceElevation, 'riser.sourceElevation');
      assertDerivedElevation(input.targetElevation, targetElevation, 'riser.targetElevation');
      if (Math.abs(sourceElevation - targetElevation) <= 0.001) {
        throw new BadRequestException('riser segment must change y between floors');
      }

      const geometry = ensureObject(current.geometry, 'geometry');
      if (geometry.kind !== 'polyline' || !Array.isArray(geometry.points) || geometry.points.length < 2) {
        throw new BadRequestException('riser can only be added to a persisted route polyline');
      }
      const previousPoints = geometry.points.map((point, pointIndex) => normalizeRoutePoint(point, pointIndex));
      const points = appendRiserPoints(previousPoints, {
        source: { x, y: sourceElevation, z },
        target: { x, y: targetElevation, z },
      });
      const startPointIndex = points.length - 2;
      const endPointIndex = points.length - 1;
      const routeSource = ensurePlain(current.route) as LogicalRouteShape & Record<string, unknown>;
      const transition: LogicalRouteCrossFloorTransition = {
        kind: 'riser',
        fromFloor: sourceFloor,
        toFloor: targetFloor,
        startPointIndex,
        endPointIndex,
        sourceFloorId: sourceRef.floorId,
        targetFloorId: targetRef.floorId,
        sourceElevation,
        targetElevation,
        x,
        z,
        installHeight,
        createdAt: new Date().toISOString(),
      };
      const routeFloors = uniqueNumbers([
        ...floorNumbersFromRoute(routeSource),
        ...floorNumbersForPoints(points, draft),
        sourceFloor,
        targetFloor,
      ]).map((floor) => routeFloorFromNumber(floor, draft, points));
      const nextGeometry = { ...geometry, points };
      const nextRoute = {
        projectId: draft.projectId ?? routeSource.projectId,
        floors: routeFloors,
        crossFloorTransitions: [
          ...ensureRouteTransitions(routeSource.crossFloorTransitions ?? routeSource.transitions),
          transition,
        ],
        size: routeSource.size,
        material: routeSource.material ?? current.businessMetadata?.material,
        insulation: routeSource.insulation,
        bendRadius: routeSource.bendRadius ?? current.businessMetadata?.bendRadiusM,
        endpointRefs: routeSource.endpointRefs ?? routeSource.endpoints,
        bomMapping: routeSource.bomMapping ?? current.bomMetadata,
      };
      model.components[index] = normalizeComponentInput(
        {
          ...current,
          floor: targetFloor,
          elevation: targetElevation,
          installHeight,
          position: { ...(current.position ?? {}), x, y: targetElevation, z },
          geometry: nextGeometry,
          route: nextRoute,
          businessMetadata: {
            ...(current.businessMetadata ?? {}),
            floor: targetFloor,
            elevation: targetElevation,
            installHeight,
            lastRiserTransition: transition,
            routeContinuationFloor: targetFloor,
            routeContinuationElevation: targetElevation,
            floorLevelSignature: floorLevelSignature(draft),
          },
        },
        draft,
        model,
        nextVersion,
        index
      );
      return draft;
    });
  }

  async deleteComponent(user: JwtPayload, id: string, componentId: string) {
    return this.editGeneratedModel(user, id, (draft, model) => {
      const current = model.components.find((item) => item.id === componentId);
      if (!current) throw new NotFoundException('viewer component not found');
      assertMutableRoute(current, 'delete route');
      const next = model.components.filter((item) => item.id !== componentId);
      model.components = next;
      return draft;
    });
  }

  async get(user: JwtPayload, id: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const draft = await em.getRepository(ViewerDesignDraftEntity)
        .findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!draft) throw new NotFoundException('viewer draft not found');
      return this.present(draft);
    }, this.rls(user));
  }

  private async editGeneratedModel(
    user: JwtPayload,
    id: string,
    edit: (draft: ViewerDesignDraftEntity, model: GeneratedHvacModel, nextVersion: number) => ViewerDesignDraftEntity,
  ) {
    const tenantId = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ViewerDesignDraftEntity);
      const draft = await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!draft) throw new NotFoundException('viewer draft not found');
      const model = ensureGeneratedModel(draft.generatedModel);
      const nextVersion = Number(draft.version || 0) + 1;
      const edited = edit(draft, model, nextVersion);
      model.modelVersion = nextVersion;
      model.id = `${draft.id}-generated-hvac-v${nextVersion}`;
      model.generatedAt = new Date().toISOString();
      for (const item of model.components) stampComponentContext(item, draft, model, nextVersion);
      reconcilePersistedRouteEndpointRefs(model);
      model.layers = buildLayers(model.components);
      model.componentSummary = summarize(model.components);
      edited.generatedModel = model as unknown as Record<string, unknown>;
      edited.version = nextVersion;
      edited.updatedBy = user.userId ?? null;
      return this.present(await repo.save(edited));
    }, this.rls(user));
  }

  private present(draft: ViewerDesignDraftEntity) {
    const generatedModel = hydrateGeneratedModelForPresentation(draft);
    return {
      id: draft.id,
      tenantId: draft.tenantId,
      dealerId: draft.dealerId,
      storeId: draft.storeId,
      projectId: draft.projectId,
      designProjectId: draft.designProjectId,
      bimProjectId: draft.bimProjectId,
      customerId: draft.customerId,
      opportunityId: draft.opportunityId,
      contractId: draft.contractId,
      artifactId: draft.artifactId,
      version: draft.version,
      status: draft.status,
      projectInputs: draft.projectInputs,
      buildingInputs: draft.buildingInputs,
      systemInputs: draft.systemInputs,
      generatedModel,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    };
  }
}

function generateParametricHvacModel(draft: ViewerDesignDraftEntity, modelVersion: number): GeneratedHvacModel {
  const project = ensurePlain(draft.projectInputs);
  const building = ensurePlain(draft.buildingInputs);
  const systems = ensurePlain(draft.systemInputs);
  const area = positiveNumber(building.area, 180);
  const floors = Math.max(1, Math.round(positiveNumber(building.floors, 1)));
  const floorHeight = positiveNumber(building.floorHeight, 3);
  const roomCount = Math.max(1, Math.round(positiveNumber(building.roomCount, 6)));
  const width = Math.max(10, Math.round(Math.sqrt(area) * 1.2));
  const depth = Math.max(8, Math.round(area / width));
  const height = Math.max(2.6, floors * floorHeight);
  const prefix = `hvac-v${modelVersion}`;
  const components: GeneratedHvacComponent[] = [];

  components.push(component(prefix, 'building', 'building-outline', 'envelope', modelVersion, 'Building outline', {
    bomMappable: false,
    areaM2: area,
    floors,
  }, {
    kind: 'box',
    x: 0,
    y: height / 2,
    z: 0,
    width,
    height,
    depth,
  }));

  const cols = Math.ceil(Math.sqrt(roomCount));
  const rows = Math.ceil(roomCount / cols);
  const roomWidth = width / cols;
  const roomDepth = depth / rows;
  for (let index = 0; index < roomCount; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = -width / 2 + roomWidth * col + roomWidth / 2;
    const z = -depth / 2 + roomDepth * row + roomDepth / 2;
    components.push(component(prefix, `zone-${pad(index + 1)}`, 'room-zone', 'zone', modelVersion, `Zone ${index + 1}`, {
      bomMappable: false,
      zoneId: `zone-${pad(index + 1)}`,
      areaM2: Math.round(area / roomCount),
    }, {
      kind: 'box',
      x,
      y: 0.06,
      z,
      width: Math.max(1.5, roomWidth - 0.25),
      height: 0.12,
      depth: Math.max(1.5, roomDepth - 0.25),
    }));
  }

  const equipment = [
    { systemKey: 'cooling' as const, name: String(systems.coolingSystem || 'Cooling system'), x: -width / 2 - 1.4, z: -depth / 2 + 1.5, sku: 'COOLING-GEN' },
    { systemKey: 'heating' as const, name: String(systems.heatingSystem || 'Heating system'), x: width / 2 + 1.4, z: -depth / 2 + 1.5, sku: 'HEATING-GEN' },
    { systemKey: 'freshAir' as const, name: 'Fresh air unit', x: 0, z: depth / 2 + 1.4, sku: 'FRESH-AIR-GEN' },
  ];

  for (const item of equipment) {
    const idPart = `${item.systemKey}-equipment`;
    components.push(component(prefix, idPart, 'equipment', item.systemKey, modelVersion, item.name, {
      bomMappable: true,
      bomCategory: 'equipment',
      bomSkuHint: item.sku,
      systemLabel: item.name,
      projectId: draft.projectId,
      contractId: draft.contractId,
      opportunityId: draft.opportunityId,
    }, {
      kind: 'box',
      x: item.x,
      y: 0.45,
      z: item.z,
      width: 1.1,
      height: 0.9,
      depth: 1.1,
    }));

    components.push(component(prefix, `${item.systemKey}-pipe`, 'pipe-route', item.systemKey, modelVersion, `${item.name} route`, {
      bomMappable: true,
      bomCategory: 'pipe-route',
      bomSkuHint: `${item.sku}-PIPE`,
      estimatedLengthM: Math.round((width + depth) * 1.15),
      projectId: draft.projectId,
      contractId: draft.contractId,
      opportunityId: draft.opportunityId,
    }, {
      kind: 'polyline',
      diameterMm: item.systemKey === 'freshAir' ? 180 : 32,
      points: [
        { x: item.x, y: 0.95, z: item.z },
        { x: 0, y: 0.95, z: 0 },
        { x: width / 2 - 1.2, y: 0.95, z: depth / 2 - 1.2 },
      ],
    }));
  }

  const model: GeneratedHvacModel = {
    id: `${draft.id}-generated-hvac-v${modelVersion}`,
    sourceType: 'generated',
    modelType: 'parametric-hvac',
    modelVersion,
    draftId: draft.id,
    projectId: draft.projectId,
    generatedAt: new Date().toISOString(),
    layers: buildLayers(components),
    components,
    componentSummary: summarize(components),
    inputs: { project, building, systems },
  };
  for (const item of model.components) stampComponentContext(item, draft, model, modelVersion);
  model.componentSummary = summarize(model.components);
  return model;
}

function buildLayers(components: GeneratedHvacComponent[]): GeneratedHvacModel['layers'] {
  return (['cooling', 'heating', 'freshAir'] as const).map((systemKey) => ({
    systemKey,
    label: systemKey === 'freshAir' ? 'Fresh air' : systemKey[0].toUpperCase() + systemKey.slice(1),
    componentIds: components.filter((item) => item.systemKey === systemKey).map((item) => item.id),
  }));
}

function component(
  prefix: string,
  key: string,
  type: GeneratedHvacComponent['type'],
  systemKey: GeneratedHvacComponent['systemKey'],
  modelVersion: number,
  name: string,
  businessMetadata: Record<string, unknown>,
  geometry: Record<string, unknown>,
): GeneratedHvacComponent {
  const dimensions = dimensionsFromGeometry(type, geometry, {});
  const position = positionFromGeometry(geometry, {});
  const elevation = elevationFromPosition(position);
  return {
    id: `${prefix}-${key}`,
    draftId: '',
    modelId: '',
    modelSourceId: null,
    sourceTemplateId: null,
    type,
    category: categoryForType(type),
    systemKey,
    modelVersion,
    version: modelVersion,
    name,
    displayName: name,
    geometry,
    route: null,
    dimensions,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    visibility: 'visible',
    locked: false,
    floor: 1,
    elevation,
    installHeight: elevation,
    businessMetadata,
    bomMetadata: bomMetadataFromBusiness(businessMetadata),
    status: 'active',
  };
}

function summarize(components: GeneratedHvacComponent[]): GeneratedHvacModel['componentSummary'] {
  const byType: Record<string, number> = {};
  const bySystem: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const bomMappableComponentIds: string[] = [];
  for (const item of components) {
    const status = item.status ?? 'active';
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (status !== 'active') continue;
    if (item.businessMetadata?.excluded === true || item.bomMetadata?.excluded === true) continue;
    byType[item.type] = (byType[item.type] || 0) + 1;
    bySystem[item.systemKey] = (bySystem[item.systemKey] || 0) + 1;
    if (item.bomMetadata?.bomMappable || item.businessMetadata.bomMappable) {
      bomMappableComponentIds.push(item.id);
    }
  }
  const routeSummary = deriveRouteSummaryFromComponents(components);
  return {
    total: Object.values(byType).reduce((sum, count) => sum + count, 0),
    byType,
    bySystem,
    byStatus,
    bomMappableComponentIds,
    routeSummary: {
      routeCount: routeSummary.routeCount,
      totalLengthM: routeSummary.totalLengthM,
      crossFloorRouteCount: routeSummary.crossFloorRouteCount,
      crossFloorTransitionCount: routeSummary.crossFloorTransitionCount,
    },
  };
}

function ensureGeneratedModel(value: unknown): GeneratedHvacModel {
  const model = value as GeneratedHvacModel | null | undefined;
  if (!model || model.modelType !== 'parametric-hvac' || !Array.isArray(model.components)) {
    throw new BadRequestException('generated model is required before component editing');
  }
  return {
    ...model,
    layers: Array.isArray(model.layers) ? model.layers : [],
    components: model.components,
    componentSummary: model.componentSummary ?? summarize(model.components),
    inputs: model.inputs ?? { project: {}, building: {}, systems: {} },
  };
}

function hydrateGeneratedModelForPresentation(draft: ViewerDesignDraftEntity): Record<string, unknown> {
  const source = cloneJsonRecord(draft.generatedModel ?? {});
  const model = source as unknown as GeneratedHvacModel | null | undefined;
  if (!model || model.modelType !== 'parametric-hvac' || !Array.isArray(model.components)) {
    return source;
  }
  const hydrated = ensureGeneratedModel(source);
  const modelVersion = Number(hydrated.modelVersion || draft.version || 0);
  for (const item of hydrated.components) stampComponentContext(item, draft, hydrated, modelVersion);
  reconcilePersistedRouteEndpointRefs(hydrated);
  hydrated.layers = buildLayers(hydrated.components);
  hydrated.componentSummary = summarize(hydrated.components);
  return hydrated as unknown as Record<string, unknown>;
}

function cloneJsonRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function normalizeComponentInput(
  input: ViewerDraftComponentInput,
  draft: ViewerDesignDraftEntity,
  model: GeneratedHvacModel,
  modelVersion: number,
  index: number,
): GeneratedHvacComponent {
  const type = normalizeComponentType(input.type);
  const systemKey = normalizeSystemKey(input.systemKey);
  const geometry = ensureObject(input.geometry, 'geometry');
  const position = positionFromGeometry(geometry, ensureObject(input.position, 'position'));
  const rotation = normalizeRotation(input.rotation);
  const displayName = normalizeDisplayName(input.displayName, input.name);
  const visibility = normalizeVisibility(input.visibility);
  const locked = normalizeLocked(input.locked, input.lockState);
  const businessMetadata = ensureObject(input.businessMetadata, 'businessMetadata');
  const floor = normalizeFloor(input.floor ?? businessMetadata.floor ?? businessMetadata.floorIndex);
  const elevation = normalizeElevation(input.elevation, position);
  const installHeight = normalizeInstallHeight(input.installHeight ?? businessMetadata.installHeight, elevation);
  const normalizedPosition = withHeightAxis(position, elevation);
  const normalizedGeometry = normalizeGeometry(type, withGeometryHeightAxis(geometry, elevation));
  const dimensions = dimensionsFromGeometry(type, normalizedGeometry, ensureObject(input.dimensions, 'dimensions'));
  const bomMetadata = {
    ...bomMetadataFromBusiness(businessMetadata),
    ...ensureObject(input.bomMetadata, 'bomMetadata'),
  };
  const route = normalizeLogicalRoute(
    type,
    input.route,
    draft,
    normalizedGeometry,
    dimensions,
    businessMetadata,
    bomMetadata,
    systemKey,
    floor,
    visibility,
    locked
  );
  const routeTotalLengthM = route ? route.summary.totalLengthM : undefined;
  const acceptedDimensions = route
    ? { ...dimensions, estimatedLengthM: routeTotalLengthM }
    : dimensions;
  const acceptedBomMetadata = route ? bomMetadataFromDerivedRoute(route, bomMetadata) : bomMetadata;
  const normalizedBusinessMetadata = {
    ...businessMetadata,
    floor,
    elevation,
    installHeight,
    ...(route
      ? {
          routeSummary: route.summary,
          acceptedLengthM: routeTotalLengthM,
          estimatedLengthM: routeTotalLengthM,
        }
      : {}),
  };
  validateGeometry(type, normalizedGeometry, dimensions);
  return {
    id: cleanComponentId(input.id) ?? `manual-${systemKey}-${type}-${pad(index + 1)}`,
    draftId: draft.id,
    modelId: model.id,
    modelSourceId: cleanNullableText(input.modelSourceId),
    sourceTemplateId: cleanNullableText(input.sourceTemplateId),
    type,
    category: cleanText(input.category) ?? categoryForType(type),
    systemKey,
    modelVersion,
    version: modelVersion,
    name: cleanText(input.name) ?? displayName ?? `${systemKey} ${type}`,
    displayName: displayName ?? cleanText(input.name) ?? `${systemKey} ${type}`,
    geometry: normalizedGeometry,
    route,
    dimensions: acceptedDimensions,
    position: normalizedPosition,
    rotation,
    visibility,
    locked,
    floor,
    elevation,
    installHeight,
    businessMetadata: normalizedBusinessMetadata,
    bomMetadata: acceptedBomMetadata,
    status: normalizeComponentStatus(input.status),
  };
}

function normalizeComponentType(type: unknown): GeneratedHvacComponent['type'] {
  if (
    type === 'building-outline' ||
    type === 'wall' ||
    type === 'door' ||
    type === 'window' ||
    type === 'room-zone' ||
    type === 'equipment' ||
    type === 'pipe-route' ||
    type === 'duct-route'
  ) {
    return type;
  }
  throw new BadRequestException(
    'component type must be building-outline, wall, door, window, room-zone, equipment, pipe-route or duct-route'
  );
}

function normalizeSystemKey(systemKey: unknown): GeneratedHvacComponent['systemKey'] {
  if (
    systemKey === 'envelope' ||
    systemKey === 'zone' ||
    systemKey === 'cooling' ||
    systemKey === 'heating' ||
    systemKey === 'freshAir' ||
    systemKey === 'water' ||
    systemKey === 'smartControl'
  ) {
    return systemKey;
  }
  throw new BadRequestException('component systemKey is invalid');
}

function normalizeGeometry(
  type: GeneratedHvacComponent['type'],
  geometry: Record<string, unknown>
): Record<string, unknown> {
  if (type !== 'pipe-route' && type !== 'duct-route') return geometry;
  if (geometry.kind !== 'polyline' || !Array.isArray(geometry.points)) return geometry;
  return {
    ...geometry,
    points: geometry.points.map((point, index) => normalizeRoutePoint(point, index)),
  };
}

function normalizeRoutePoint(point: unknown, index: number): LogicalRoutePoint3 {
  const p = ensureObject(point, `geometry.points[${index}]`);
  return {
    x: coordinateNumber(p.x, `geometry.points[${index}].x`),
    y: verticalCoordinate(p.y, `geometry.points[${index}].y`),
    z: coordinateNumber(p.z, `geometry.points[${index}].z`),
  };
}

function validateGeometry(
  type: GeneratedHvacComponent['type'],
  geometry: Record<string, unknown>,
  dimensions: Record<string, unknown>,
) {
  if (type === 'pipe-route' || type === 'duct-route') {
    if (geometry.kind !== 'polyline' || !Array.isArray(geometry.points) || geometry.points.length < 2) {
      throw new BadRequestException('route geometry must be a polyline with at least two points');
    }
    for (const point of geometry.points) {
      const p = ensureObject(point, 'geometry.points');
      coordinateNumber(p.x, 'geometry point x');
      verticalCoordinate(p.y, 'geometry point y');
      coordinateNumber(p.z, 'geometry point z');
    }
    if (geometry.diameterMm !== undefined) positiveDimension(geometry.diameterMm, 'geometry.diameterMm');
    if (geometry.width !== undefined) positiveDimension(geometry.width, 'geometry.width');
    if (geometry.height !== undefined) positiveDimension(geometry.height, 'geometry.height');
    if (
      dimensions.diameterMm === undefined &&
      (dimensions.width === undefined || dimensions.height === undefined)
    ) {
      throw new BadRequestException('route dimensions require diameterMm or width/height');
    }
    if (dimensions.diameterMm !== undefined) positiveDimension(dimensions.diameterMm, 'dimensions.diameterMm');
    if (dimensions.width !== undefined) positiveDimension(dimensions.width, 'dimensions.width');
    if (dimensions.height !== undefined) positiveDimension(dimensions.height, 'dimensions.height');
    return;
  }
  if (geometry.kind !== 'box') throw new BadRequestException('box geometry is required');
  for (const field of ['width', 'height', 'depth']) positiveDimension(dimensions[field], `dimensions.${field}`);
}

function positiveCoordinate(value: unknown, field: string) {
  coordinateNumber(value, field);
}

function coordinateNumber(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BadRequestException(`${field} must be a number`);
  return n;
}

function stampComponentContext(
  component: GeneratedHvacComponent,
  draft: ViewerDesignDraftEntity,
  model: GeneratedHvacModel,
  modelVersion: number,
) {
  component.draftId = draft.id;
  component.modelId = model.id;
  component.modelSourceId = component.modelSourceId ?? null;
  component.sourceTemplateId = component.sourceTemplateId ?? null;
  component.category = component.category ?? categoryForType(component.type);
  component.modelVersion = modelVersion;
  component.version = modelVersion;
  component.name = cleanText(component.name) ?? component.displayName ?? `${component.systemKey} ${component.type}`;
  component.displayName =
    normalizeDisplayName(component.displayName, component.name) ?? component.name;
  component.geometry = normalizeGeometry(component.type, component.geometry ?? {});
  component.dimensions = dimensionsFromGeometry(component.type, component.geometry ?? {}, component.dimensions ?? {});
  component.position = positionFromGeometry(component.geometry ?? {}, component.position ?? {});
  component.floor = normalizeFloor(
    component.floor ?? component.businessMetadata?.floor ?? component.businessMetadata?.floorIndex
  );
  component.elevation = normalizeElevation(component.elevation, component.position);
  component.installHeight = normalizeInstallHeight(
    component.installHeight ?? component.businessMetadata?.installHeight,
    component.elevation
  );
  component.position = withHeightAxis(component.position, component.elevation);
  component.geometry = normalizeGeometry(
    component.type,
    withGeometryHeightAxis(component.geometry ?? {}, component.elevation)
  );
  component.dimensions = dimensionsFromGeometry(component.type, component.geometry ?? {}, component.dimensions ?? {});
  component.rotation = normalizeRotation(component.rotation);
  component.visibility = normalizeVisibility(component.visibility);
  component.locked = normalizeLocked(component.locked);
  component.businessMetadata = ensureObject(component.businessMetadata, 'businessMetadata');
  component.route = normalizeLogicalRoute(
    component.type,
    component.route ?? null,
    draft,
    component.geometry,
    component.dimensions,
    component.businessMetadata,
    component.bomMetadata,
    component.systemKey,
    component.floor,
    component.visibility,
    component.locked,
    false
  );
  if (component.route) {
    component.dimensions = {
      ...(component.dimensions ?? {}),
      estimatedLengthM: component.route.summary.totalLengthM,
    };
    component.businessMetadata.routeSummary = component.route.summary;
    component.businessMetadata.acceptedLengthM = component.route.summary.totalLengthM;
    component.businessMetadata.estimatedLengthM = component.route.summary.totalLengthM;
  }
  component.businessMetadata.floor = component.floor;
  component.businessMetadata.elevation = component.elevation;
  component.businessMetadata.installHeight = component.installHeight;
  component.bomMetadata = {
    ...bomMetadataFromBusiness(component.businessMetadata),
    ...ensureObject(component.bomMetadata, 'bomMetadata'),
  };
  if (component.route) component.bomMetadata = bomMetadataFromDerivedRoute(component.route, component.bomMetadata);
  component.status = normalizeComponentStatus(component.status);
}

function reconcileEquipmentRouteConnections(
  model: GeneratedHvacModel,
  current: GeneratedHvacComponent,
  next: GeneratedHvacComponent
) {
  if (pointDistance(componentAnchor(current), componentAnchor(next)) <= 0.001) return;

  for (const route of model.components) {
    if ((route.type !== 'pipe-route' && route.type !== 'duct-route') || route.status === 'deleted' || !route.route) {
      continue;
    }
    const routeSource = ensurePlain(route.route) as unknown as LogicalRouteShape;
    const refs = normalizeRouteEndpointRefs(routeSource.endpointRefs ?? route.businessMetadata?.endpointRefs);
    let refsChanged = false;
    let geometryChanged = false;
    const geometry = ensurePlain(route.geometry);
    const routePoints =
      geometry.kind === 'polyline' && Array.isArray(geometry.points) && geometry.points.length >= 2
        ? geometry.points.map((point, index) => normalizeRoutePoint(point, index))
        : null;
    const routeLocked = route.locked || routeSource.locked === true || routeSource.lockState === 'locked';
    const protectedRoute = isProtectedImportedComponent(route);

    for (const endpointKey of ['from', 'to'] as RouteEndpointKey[]) {
      const ref = refs[endpointKey];
      if (!ref || ref.equipmentId !== next.id || ref.status !== 'connected') continue;
      const attachmentPoint = routeEndpointAttachmentPoint(next, route, ref);
      if (!attachmentPoint) {
        refs[endpointKey] = markRouteEndpointStale(ref, 'connected-equipment-attachment-not-found');
        refsChanged = true;
        continue;
      }
      if (routeLocked) {
        refs[endpointKey] = markRouteEndpointStale(ref, 'connected-route-locked-during-equipment-move');
        refsChanged = true;
        continue;
      }
      if (protectedRoute) {
        refs[endpointKey] = markRouteEndpointStale(ref, 'protected-imported-route');
        refsChanged = true;
        continue;
      }
      if (!routePoints) {
        refs[endpointKey] = markRouteEndpointStale(ref, 'connected-route-geometry-not-editable');
        refsChanged = true;
        continue;
      }
      routePoints[endpointKey === 'from' ? 0 : routePoints.length - 1] = attachmentPoint;
      refs[endpointKey] = withoutUndefined({
        ...ref,
        point: attachmentPoint,
        status: 'connected',
        staleReason: undefined,
      }) as unknown as RouteEndpointRef;
      refsChanged = true;
      geometryChanged = true;
    }

    if (!refsChanged) continue;
    if (geometryChanged && routePoints) {
      route.geometry = {
        ...geometry,
        points: routePoints,
      };
    }
    route.route = {
      ...routeSource,
      ...(geometryChanged && routePoints ? { points: routePoints } : {}),
      endpointRefs: refs,
    } as LogicalRouteShape;
    route.businessMetadata = {
      ...ensurePlain(route.businessMetadata),
      endpointRefs: refs,
    };
  }
}

function reconcilePersistedRouteEndpointRefs(model: GeneratedHvacModel) {
  const equipmentById = new Map(
    model.components
      .filter((component) => component.type === 'equipment' && component.status !== 'deleted')
      .map((component) => [component.id, component])
  );

  for (const route of model.components) {
    if ((route.type !== 'pipe-route' && route.type !== 'duct-route') || route.status === 'deleted' || !route.route) {
      continue;
    }
    const routeSource = ensurePlain(route.route) as unknown as LogicalRouteShape;
    const refs = normalizeRouteEndpointRefs(routeSource.endpointRefs ?? route.businessMetadata?.endpointRefs);
    let refsChanged = false;

    for (const endpointKey of ['from', 'to'] as RouteEndpointKey[]) {
      const ref = refs[endpointKey];
      if (!ref || ref.status !== 'connected') continue;
      const equipment = equipmentById.get(ref.equipmentId);
      if (!equipment) {
        refs[endpointKey] = markRouteEndpointStale(ref, 'connected-equipment-not-found');
        refsChanged = true;
        continue;
      }
      const attachmentPoint = routeEndpointAttachmentPoint(equipment, route, ref);
      if (!attachmentPoint) {
        refs[endpointKey] = markRouteEndpointStale(ref, 'connected-equipment-attachment-not-found');
        refsChanged = true;
        continue;
      }
      refs[endpointKey] = withoutUndefined({
        ...ref,
        point: ref.point ?? attachmentPoint,
        status: 'connected',
        staleReason: undefined,
      }) as unknown as RouteEndpointRef;
      refsChanged = true;
    }

    if (!refsChanged) continue;
    route.route = {
      ...routeSource,
      endpointRefs: refs,
    } as LogicalRouteShape;
    route.businessMetadata = {
      ...ensurePlain(route.businessMetadata),
      endpointRefs: refs,
    };
  }
}

function routeEndpointAttachmentPoint(
  equipment: GeneratedHvacComponent,
  route: GeneratedHvacComponent,
  ref: RouteEndpointRef
): LogicalRoutePoint3 | null {
  if (ref.attachmentKind === 'anchor') return componentAnchor(equipment);
  return equipmentConnectorPoint(equipment, {
    attachmentId: ref.attachmentId,
    systemKey: (ref.systemKey ?? route.systemKey) as GeneratedHvacSystemKey,
    routeType: (ref.routeType ?? route.type) as 'pipe-route' | 'duct-route',
  });
}

function componentAnchor(component: GeneratedHvacComponent): LogicalRoutePoint3 {
  const geometry = ensurePlain(component.geometry);
  const position = ensurePlain(component.position);
  if (
    (component.type === 'pipe-route' || component.type === 'duct-route') &&
    Array.isArray(geometry.points) &&
    geometry.points[0]
  ) {
    return normalizeRoutePoint(geometry.points[0], 0);
  }
  return {
    x: roundMeters(numberOr(geometry.x ?? position.x, 0)),
    y: roundMeters(
      numberOr(component.elevation ?? geometry.y ?? position.y, numberOr(geometry.y ?? position.y, 0))
    ),
    z: roundMeters(numberOr(geometry.z ?? position.z, 0)),
  };
}

function equipmentConnectorPoint(
  equipment: GeneratedHvacComponent,
  input: {
    attachmentId: string;
    systemKey: GeneratedHvacSystemKey;
    routeType: 'pipe-route' | 'duct-route';
  }
): LogicalRoutePoint3 | null {
  const anchor = componentAnchor(equipment);
  const sources = [
    equipment.businessMetadata?.connectors,
    equipment.businessMetadata?.connectorMetadata,
    equipment.businessMetadata?.connectionPoints,
    equipment.businessMetadata?.ports,
    equipment.dimensions?.connectors,
    equipment.bomMetadata?.connectors,
  ];
  for (const { id, source } of sources.flatMap((source) => connectorEntries(source))) {
    if (id !== input.attachmentId) continue;
    if (!connectorCompatible(source, equipment, input.systemKey, input.routeType)) return null;
    return connectorPoint(source, anchor);
  }
  return null;
}

function connectorEntries(value: unknown): Array<{ id: string; source: Record<string, unknown> }> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => {
      const source = plainObject(entry);
      if (!source) return [];
      const id = cleanId(source.id ?? source.key ?? source.portKey ?? source.name) ?? `connector-${index + 1}`;
      return [{ id, source }];
    });
  }
  const source = plainObject(value);
  if (!source) return [];
  return Object.entries(source).flatMap(([key, entry]) => {
    const connector = plainObject(entry);
    if (!connector) return [];
    return [{ id: cleanId(connector.id ?? connector.key ?? key) ?? key, source: connector }];
  });
}

function connectorCompatible(
  connector: Record<string, unknown>,
  component: GeneratedHvacComponent,
  systemKey: GeneratedHvacSystemKey,
  routeType: 'pipe-route' | 'duct-route'
): boolean {
  const systems = stringSet(
    connector.systemKeys ?? connector.systems ?? connector.systemKey ?? connector.system
  );
  if (systems.size && !systems.has(systemKey)) return false;
  if (!systems.size && component.systemKey !== systemKey) return false;
  const routeTypes = stringSet(
    connector.routeTypes ?? connector.routeType ?? connector.componentTypes ?? connector.componentType
  );
  return routeTypes.size === 0 || routeTypes.has(routeType);
}

function connectorPoint(
  connector: Record<string, unknown>,
  anchor: LogicalRoutePoint3
): LogicalRoutePoint3 | null {
  const relative =
    plainObject(connector.offset) ??
    plainObject(connector.relativePoint) ??
    plainObject(connector.localPoint) ??
    plainObject(connector.localPosition);
  if (relative) return offsetPoint(anchor, relative);
  if (
    connector.dx !== undefined ||
    connector.dy !== undefined ||
    connector.dz !== undefined ||
    connector.offsetX !== undefined ||
    connector.offsetY !== undefined ||
    connector.offsetZ !== undefined
  ) {
    return offsetPoint(anchor, {
      x: connector.dx ?? connector.offsetX,
      y: connector.dy ?? connector.offsetY,
      z: connector.dz ?? connector.offsetZ,
    });
  }
  const point =
    plainObject(connector.point) ??
    plainObject(connector.position) ??
    (connector.x !== undefined || connector.y !== undefined || connector.z !== undefined ? connector : null);
  if (!point) return null;
  const x = optionalFiniteNumber(point.x);
  const z = optionalFiniteNumber(point.z);
  if (x === undefined || z === undefined) return null;
  return {
    x: roundMeters(x),
    y: roundMeters(optionalFiniteNumber(point.y) ?? anchor.y),
    z: roundMeters(z),
  };
}

function offsetPoint(anchor: LogicalRoutePoint3, offset: Record<string, unknown>): LogicalRoutePoint3 | null {
  const x = optionalFiniteNumber(offset.x);
  const z = optionalFiniteNumber(offset.z);
  if (x === undefined || z === undefined) return null;
  return {
    x: roundMeters(anchor.x + x),
    y: roundMeters(anchor.y + (optionalFiniteNumber(offset.y) ?? 0)),
    z: roundMeters(anchor.z + z),
  };
}

function markRouteEndpointStale(ref: RouteEndpointRef, staleReason: string): RouteEndpointRef {
  return withoutUndefined({
    ...ref,
    status: 'stale',
    staleReason,
  }) as unknown as RouteEndpointRef;
}

function isProtectedImportedComponent(component: GeneratedHvacComponent): boolean {
  const metadata = {
    ...ensurePlain(component.businessMetadata),
    ...ensurePlain(component.bomMetadata),
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

function assertMutableRoute(component: GeneratedHvacComponent, action: string) {
  if (component.type !== 'pipe-route' && component.type !== 'duct-route') return;
  if (component.locked || component.route?.locked === true || component.route?.lockState === 'locked') {
    throw new BadRequestException(`locked route cannot ${action}`);
  }
  if (isProtectedImportedComponent(component)) {
    throw new BadRequestException(`protected route cannot ${action}`);
  }
}

function pointDistance(a: LogicalRoutePoint3, b: LogicalRoutePoint3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function stringSet(value: unknown): Set<string> {
  const values = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
  return new Set(values.map((item) => String(item).trim()).filter(Boolean));
}

function cleanId(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function categoryForType(type: GeneratedHvacComponent['type']): string {
  if (type === 'building-outline') return 'building-envelope';
  if (type === 'wall' || type === 'door' || type === 'window') return 'envelope';
  if (type === 'room-zone') return 'room-zone';
  if (type === 'equipment') return 'equipment';
  return 'route';
}

function dimensionsFromGeometry(
  type: GeneratedHvacComponent['type'],
  geometry: Record<string, unknown>,
  dimensions: Record<string, unknown>,
): Record<string, unknown> {
  if (type === 'pipe-route' || type === 'duct-route') {
    const acceptedLength = routeLengthFromAcceptedPoints(geometry.points);
    const next: Record<string, unknown> = {
      ...dimensions,
      diameterMm: dimensions.diameterMm ?? geometry.diameterMm,
      width: dimensions.width ?? geometry.width,
      height: dimensions.height ?? geometry.height,
      estimatedLengthM: acceptedLength,
    };
    for (const key of ['diameterMm', 'width', 'height', 'estimatedLengthM']) {
      if (next[key] !== undefined) positiveDimension(next[key], `dimensions.${key}`);
    }
    return withoutUndefined(next);
  }
  const next: Record<string, unknown> = {
    ...dimensions,
    width: dimensions.width ?? geometry.width,
    height: dimensions.height ?? geometry.height,
    depth: dimensions.depth ?? geometry.depth,
  };
  return withoutUndefined(next);
}

function positionFromGeometry(
  geometry: Record<string, unknown>,
  position: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    x: position.x ?? geometry.x ?? 0,
    y: position.y ?? geometry.y ?? 0,
    z: position.z ?? geometry.z ?? 0,
  };
  for (const field of ['x', 'y', 'z']) positiveCoordinate(next[field], field);
  verticalCoordinate(next.y, 'position.y');
  return next;
}

function normalizeRotation(value: unknown): Record<string, unknown> {
  const source = ensureObject(value, 'rotation');
  const next: Record<string, unknown> = { x: source.x ?? 0, y: source.y ?? 0, z: source.z ?? 0 };
  for (const field of ['x', 'y', 'z']) {
    const n = Number(next[field]);
    if (!Number.isFinite(n) || n < -360 || n > 360) {
      throw new BadRequestException(`rotation ${field} must be between -360 and 360`);
    }
    next[field] = n;
  }
  return next;
}

function normalizeDisplayName(value: unknown, fallback: unknown): string | null {
  if (value === undefined || value === null) return cleanText(fallback);
  const text = String(value).trim();
  if (!text) throw new BadRequestException('component displayName must be a non-empty string');
  if (text.length > 120) throw new BadRequestException('component displayName is too long');
  return text;
}

function normalizeVisibility(value: unknown): GeneratedHvacComponent['visibility'] {
  if (value === undefined || value === null || value === 'visible') return 'visible';
  if (value === 'hidden') return 'hidden';
  throw new BadRequestException('component visibility must be visible or hidden');
}

function normalizeLocked(value: unknown, lockState?: unknown): boolean {
  if (lockState !== undefined && lockState !== null) {
    if (lockState === 'locked') {
      if (value !== undefined && value !== null && value !== true) {
        throw new BadRequestException('component lockState conflicts with locked');
      }
      return true;
    }
    if (lockState === 'unlocked') {
      if (value !== undefined && value !== null && value !== false) {
        throw new BadRequestException('component lockState conflicts with locked');
      }
      return false;
    }
    throw new BadRequestException('component lockState must be locked or unlocked');
  }
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  throw new BadRequestException('component locked must be boolean');
}

function normalizeElevation(value: unknown, position: Record<string, unknown>): number | null {
  if (value == null) return elevationFromPosition(position);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BadRequestException('elevation must be a number');
  validateElevation(n, 'elevation');
  return n;
}

function elevationFromPosition(position: Record<string, unknown>): number | null {
  const y = Number(position.y);
  if (!Number.isFinite(y)) return null;
  validateElevation(y, 'position.y');
  return y;
}

function normalizeFloor(value: unknown): number {
  if (value == null) return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_FLOOR) {
    throw new BadRequestException(`floor must be an integer between 1 and ${MAX_FLOOR}`);
  }
  return n;
}

function normalizeInstallHeight(value: unknown, elevation: number | null): number | null {
  if (value == null) {
    return elevation == null ? null : roundMeters(elevation);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_INSTALL_HEIGHT_M) {
    throw new BadRequestException(`installHeight must be between 0 and ${MAX_INSTALL_HEIGHT_M} meters`);
  }
  return roundMeters(n);
}

function withHeightAxis(
  position: Record<string, unknown>,
  elevation: number | null,
): Record<string, unknown> {
  if (elevation == null) return position;
  return { ...position, y: elevation };
}

function withGeometryHeightAxis(
  geometry: Record<string, unknown>,
  elevation: number | null,
): Record<string, unknown> {
  if (elevation == null || geometry.kind !== 'box') return geometry;
  return { ...geometry, y: elevation };
}

function verticalCoordinate(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new BadRequestException(`${field} must be a number`);
  validateElevation(n, field);
  return n;
}

function validateElevation(value: number, field: string) {
  if (value < 0 || value > MAX_ELEVATION_M) {
    throw new BadRequestException(`${field} must be between 0 and ${MAX_ELEVATION_M} meters`);
  }
}

function roundMeters(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizeComponentStatus(value: unknown): GeneratedHvacComponent['status'] {
  if (value === undefined || value === null || value === 'active') return 'active';
  if (value === 'deleted') return 'deleted';
  throw new BadRequestException('component status must be active or deleted');
}

function normalizeLogicalRoute(
  type: GeneratedHvacComponent['type'],
  value: unknown,
  draft: ViewerDesignDraftEntity,
  geometry: Record<string, unknown>,
  dimensions: Record<string, unknown>,
  businessMetadata: Record<string, unknown>,
  bomMetadata: Record<string, unknown>,
  systemKey: GeneratedHvacSystemKey,
  componentFloor: number,
  visibility: 'visible' | 'hidden',
  locked: boolean,
  requireExplicitFloors = true
): LogicalRouteShape | null {
  if (type !== 'pipe-route' && type !== 'duct-route') {
    if (value !== undefined && value !== null) {
      throw new BadRequestException('logical route is only valid for route components');
    }
    return null;
  }
  if (geometry.kind !== 'polyline' || !Array.isArray(geometry.points) || geometry.points.length < 2) {
    return null;
  }
  const explicitRoute = value !== undefined && value !== null;
  const source = explicitRoute ? ensureObject(value, 'route') : {};
  const routeProjectId = cleanNullableText(source.projectId ?? businessMetadata.projectId);
  if (routeProjectId && draft.projectId && routeProjectId !== draft.projectId) {
    throw new BadRequestException('route projectId must match viewer draft projectId');
  }

  const points = geometry.points.map((point, index) => normalizeRoutePoint(point, index));
  if (
    !explicitRoute &&
    dimensions.diameterMm === undefined &&
    (dimensions.width === undefined || dimensions.height === undefined)
  ) {
    return null;
  }
  const floors = normalizeRouteFloors(
    source.floors ?? source.floorParticipation,
    draft,
    componentFloor,
    points,
    explicitRoute && requireExplicitFloors
  );
  const crossFloorTransitions = normalizeCrossFloorTransitions(
    source.crossFloorTransitions ?? source.transitions,
    draft,
    floors,
    points.length
  );
  const size = normalizeRouteSize(source.size, type, dimensions);
  const material = cleanText(source.material ?? businessMetadata.material);
  const insulation = normalizeRouteInsulation(source.insulation, dimensions, businessMetadata);
  const bendRadius = normalizeRouteBendRadius(source.bendRadius ?? source.bendRadiusM ?? businessMetadata.bendRadiusM);
  const totalLengthM = routeLengthFromAcceptedPoints(points, 'geometry.points', bendRadius) ?? 0;
  const endpointRefs = normalizeRouteEndpointRefs(source.endpointRefs ?? source.endpoints ?? businessMetadata.endpointRefs);
  const bomMapping = deriveRouteBomMapping(
    source.bomMapping,
    bomMetadata,
    businessMetadata,
    totalLengthM
  );

  return {
    kind: 'logical-route',
    coordinateSystem: {
      planeAxes: ['x', 'z'],
      elevationAxis: 'y',
      ySemantics: 'absolute-model-elevation-m',
    },
    points,
    floors,
    crossFloorTransitions,
    systemKey,
    routeType: type,
    size,
    material,
    insulation,
    bendRadius,
    endpointRefs,
    visibility,
    locked,
    lockState: locked ? 'locked' : 'unlocked',
    bomMapping,
    summary: {
      pointCount: points.length,
      floorCount: floors.length,
      transitionCount: crossFloorTransitions.length,
      totalLengthM,
    },
  };
}

function normalizeRouteFloors(
  value: unknown,
  draft: ViewerDesignDraftEntity,
  componentFloor: number,
  points: LogicalRoutePoint3[],
  required: boolean
): LogicalRouteFloorParticipation[] {
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException('route floors are required');
    return [routeFloorFromNumber(componentFloor, draft, points)];
  }
  if (!Array.isArray(value) || value.length < 1) throw new BadRequestException('route floors are required');
  const seen = new Set<number>();
  return value.map((entry, index) => {
    const floor =
      typeof entry === 'number' || typeof entry === 'string'
        ? normalizeExistingFloor(entry, `route.floors[${index}]`, draft)
        : normalizeExistingFloor(
            ensureObject(entry, `route.floors[${index}]`).floor ??
              ensureObject(entry, `route.floors[${index}]`).floorIndex,
            `route.floors[${index}].floor`,
            draft
          );
    if (seen.has(floor)) throw new BadRequestException('route floors must not contain duplicates');
    seen.add(floor);
    if (typeof entry === 'number' || typeof entry === 'string') return routeFloorFromNumber(floor, draft, points);
    const source = ensureObject(entry, `route.floors[${index}]`);
    const pointIndexes = normalizePointIndexes(source.pointIndexes, points.length, `route.floors[${index}].pointIndexes`);
    const bounds = floorElevationRange(floor, draft);
    return {
      floor,
      floorId: cleanText(source.floorId) ?? `floor-${floor}`,
      pointIndexes: pointIndexes.length ? pointIndexes : pointIndexesForFloor(points, bounds),
      elevationMin: numberOr(source.elevationMin, bounds.min),
      elevationMax: numberOr(source.elevationMax, bounds.max),
    };
  });
}

function routeFloorFromNumber(
  floor: number,
  draft: ViewerDesignDraftEntity,
  points: LogicalRoutePoint3[]
): LogicalRouteFloorParticipation {
  const ref = floorRef(floor, draft);
  const bounds = floorElevationRange(floor, draft);
  return {
    floor,
    floorId: ref.floorId,
    pointIndexes: pointIndexesForFloor(points, bounds),
    elevationMin: bounds.min,
    elevationMax: bounds.max,
  };
}

function normalizeCrossFloorTransitions(
  value: unknown,
  draft: ViewerDesignDraftEntity,
  floors: LogicalRouteFloorParticipation[],
  pointCount: number
): LogicalRouteCrossFloorTransition[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequestException('route crossFloorTransitions must be an array');
  const floorSet = new Set(floors.map((floor) => floor.floor));
  return value.map((entry, index) => {
    const source = ensureObject(entry, `route.crossFloorTransitions[${index}]`);
    const fromFloor = normalizeExistingFloor(
      source.fromFloor ?? source.from,
      `route.crossFloorTransitions[${index}].fromFloor`,
      draft
    );
    const toFloor = normalizeExistingFloor(
      source.toFloor ?? source.to,
      `route.crossFloorTransitions[${index}].toFloor`,
      draft
    );
    if (fromFloor === toFloor) {
      throw new BadRequestException('cross-floor transition must connect different floors');
    }
    if (!floorSet.has(fromFloor) || !floorSet.has(toFloor)) {
      throw new BadRequestException('cross-floor transition floors must be included in route floors');
    }
    return {
      kind: normalizeTransitionKind(source.kind),
      fromFloor,
      toFloor,
      startPointIndex: normalizeOptionalPointIndex(source.startPointIndex, pointCount, `route.crossFloorTransitions[${index}].startPointIndex`),
      endPointIndex: normalizeOptionalPointIndex(source.endPointIndex, pointCount, `route.crossFloorTransitions[${index}].endPointIndex`),
      ...withoutUndefined({
        sourceFloorId: cleanText(source.sourceFloorId) ?? undefined,
        targetFloorId: cleanText(source.targetFloorId) ?? undefined,
        sourceElevation: normalizeOptionalElevation(source.sourceElevation, `route.crossFloorTransitions[${index}].sourceElevation`),
        targetElevation: normalizeOptionalElevation(source.targetElevation, `route.crossFloorTransitions[${index}].targetElevation`),
        x: normalizeOptionalCoordinate(source.x, `route.crossFloorTransitions[${index}].x`),
        z: normalizeOptionalCoordinate(source.z, `route.crossFloorTransitions[${index}].z`),
        installHeight: normalizeOptionalInstallHeight(source.installHeight, `route.crossFloorTransitions[${index}].installHeight`),
        createdAt: cleanText(source.createdAt) ?? undefined,
      }),
    };
  });
}

function normalizeRouteSize(
  value: unknown,
  type: 'pipe-route' | 'duct-route',
  dimensions: Record<string, unknown>
): Record<string, unknown> {
  const source = ensureObject(value, 'route.size');
  const diameterMm = source.diameterMm ?? dimensions.diameterMm;
  const width = source.width ?? source.widthMm ?? dimensions.width;
  const height = source.height ?? source.heightMm ?? dimensions.height;
  if (type === 'pipe-route') {
    positiveDimension(diameterMm, 'route.size.diameterMm');
    return { shape: 'round', diameterMm: Number(diameterMm) };
  }
  positiveDimension(width, 'route.size.width');
  positiveDimension(height, 'route.size.height');
  return { shape: 'rectangular', width: Number(width), height: Number(height) };
}

function normalizeRouteInsulation(
  value: unknown,
  dimensions: Record<string, unknown>,
  businessMetadata: Record<string, unknown>
): Record<string, unknown> | null {
  const source = ensureObject(value, 'route.insulation');
  const thicknessMm = source.thicknessMm ?? source.insulationMm ?? dimensions.insulationMm ?? businessMetadata.insulationMm;
  if (thicknessMm === undefined || thicknessMm === null) return null;
  positiveDimension(thicknessMm, 'route.insulation.thicknessMm');
  return {
    thicknessMm: Number(thicknessMm),
    material: cleanText(source.material ?? businessMetadata.insulationMaterial),
  };
}

function normalizeRouteBendRadius(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const source = ensureObject(value, 'route.bendRadius');
    const radiusM = source.radiusM ?? source.m ?? source.value;
    if (radiusM !== undefined && radiusM !== null) {
      positiveDimension(radiusM, 'route.bendRadius.radiusM');
      return { radiusM: Number(radiusM) };
    }
    const radiusMm = source.radiusMm ?? source.mm;
    positiveDimension(radiusMm, 'route.bendRadius.radiusMm');
    return { radiusM: Number(radiusMm) / 1000 };
  }
  positiveDimension(value, 'route.bendRadius.radiusM');
  return { radiusM: Number(value) };
}

function normalizeRouteEndpointRefs(value: unknown): Partial<Record<RouteEndpointKey, RouteEndpointRef>> {
  const source = ensureObject(value, 'route.endpointRefs');
  return withoutUndefined({
    from:
      source.from === undefined
        ? undefined
        : normalizeRouteEndpointRef('from', source.from, 'route.endpointRefs.from'),
    to:
      source.to === undefined
        ? undefined
        : normalizeRouteEndpointRef('to', source.to, 'route.endpointRefs.to'),
  }) as Partial<Record<RouteEndpointKey, RouteEndpointRef>>;
}

function normalizeRouteEndpointRef(
  endpointKey: RouteEndpointKey,
  value: unknown,
  field: string
): RouteEndpointRef {
  const source = ensureObject(value, field);
  const endpointRole = endpointKey === 'from' ? 'source' : 'target';
  const equipmentId = cleanText(source.equipmentId ?? source.refId ?? source.componentId);
  if (!equipmentId) throw new BadRequestException(`${field}.equipmentId is required`);
  const attachmentKind = normalizeEndpointAttachmentKind(
    source.attachmentKind ?? source.refKind ?? (source.portKey ? 'connector' : 'anchor'),
    `${field}.attachmentKind`
  );
  const attachmentId = cleanText(
    source.attachmentId ?? source.connectorId ?? source.anchorId ?? source.portKey
  ) ?? (attachmentKind === 'anchor' ? 'equipment-anchor:center' : null);
  if (!attachmentId) throw new BadRequestException(`${field}.attachmentId is required`);
  const status = normalizeEndpointStatus(source.status, `${field}.status`);
  const systemKey = cleanText(source.systemKey);
  const routeType = cleanText(source.routeType);
  return withoutUndefined({
    ...source,
    endpointKey,
    endpointRole,
    equipmentId,
    equipmentRole: normalizeEndpointRole(source.equipmentRole, endpointRole, `${field}.equipmentRole`),
    attachmentKind,
    attachmentId,
    status,
    point:
      source.point === undefined || source.point === null
        ? undefined
        : normalizeRoutePoint(source.point, endpointKey === 'from' ? 0 : 1),
    systemKey: systemKey ? (systemKey as GeneratedHvacSystemKey) : undefined,
    routeType:
      routeType === 'pipe-route' || routeType === 'duct-route'
        ? (routeType as 'pipe-route' | 'duct-route')
        : undefined,
    distanceM: optionalFiniteNumber(source.distanceM),
    fallbackReason: cleanText(source.fallbackReason),
    staleReason: cleanText(source.staleReason),
  }) as unknown as RouteEndpointRef;
}

function normalizeEndpointAttachmentKind(value: unknown, field: string): RouteEndpointAttachmentKind {
  if (value === 'connector' || value === 'anchor') return value;
  throw new BadRequestException(`${field} must be connector or anchor`);
}

function normalizeEndpointStatus(value: unknown, field: string): RouteEndpointConnectionStatus {
  if (value === undefined || value === null || value === 'connected') return 'connected';
  if (value === 'disconnected' || value === 'stale') return value;
  throw new BadRequestException(`${field} must be connected, disconnected or stale`);
}

function normalizeEndpointRole(
  value: unknown,
  fallback: RouteEndpointRole,
  field: string
): RouteEndpointRole {
  if (value === undefined || value === null) return fallback;
  if (value === 'source' || value === 'target') return value;
  throw new BadRequestException(`${field} must be source or target`);
}

function bomMetadataFromBusiness(value: Record<string, unknown>): Record<string, unknown> {
  return withoutUndefined({
    bomMappable: value.bomMappable,
    bomCategory: value.bomCategory,
    bomSkuHint: value.bomSkuHint,
    quantity: value.quantity,
    unit: value.unit,
  });
}

function normalizeExistingFloor(value: unknown, field: string, draft: ViewerDesignDraftEntity): number {
  const n = Number(value);
  const floorCount = draftFloorCount(draft);
  if (!Number.isInteger(n) || n < 1 || n > floorCount) {
    throw new BadRequestException(`${field} must reference an existing floor`);
  }
  return n;
}

function draftFloorCount(draft: ViewerDesignDraftEntity): number {
  const building = ensurePlain(draft.buildingInputs);
  const floors = Number(building.floors);
  if (!Number.isFinite(floors) || floors < 1) return 1;
  return Math.min(MAX_FLOOR, Math.max(1, Math.round(floors)));
}

function floorElevationRange(floor: number, draft: ViewerDesignDraftEntity): { min: number; max: number } {
  const building = ensurePlain(draft.buildingInputs);
  const floorHeight = positiveNumber(building.floorHeight, 3);
  const min = floorRef(floor, draft).level;
  const max = floorRef(floor + 1, draft, false)?.level ?? roundMeters(min + floorHeight);
  return { min, max };
}

function floorRef(
  floor: number,
  draft: ViewerDesignDraftEntity,
  requireExisting = true
): { floor: number; floorId: string; level: number } {
  if (requireExisting) normalizeExistingFloor(floor, 'floor', draft);
  const building = ensurePlain(draft.buildingInputs);
  const explicit = floorRefFromCollection(building.floorLevels, floor) ?? floorRefFromCollection(building.levels, floor);
  if (explicit) return explicit;
  const floorHeight = positiveNumber(building.floorHeight, 3);
  return {
    floor,
    floorId: `floor-${floor}`,
    level: roundMeters((floor - 1) * floorHeight),
  };
}

function floorRefFromCollection(value: unknown, floor: number): { floor: number; floorId: string; level: number } | null {
  if (!Array.isArray(value)) return null;
  const entry = value.find((item) => {
    const source = ensurePlain(item);
    return Number(source.floor ?? source.floorIndex ?? source.levelIndex) === floor;
  });
  if (!entry) return null;
  const source = ensurePlain(entry);
  const level = Number(source.level ?? source.elevation ?? source.baseElevation ?? source.y);
  if (!Number.isFinite(level)) return null;
  return {
    floor,
    floorId: cleanText(source.floorId ?? source.id ?? source.ref) ?? `floor-${floor}`,
    level: roundMeters(level),
  };
}

function floorLevelSignature(draft: Pick<ViewerDesignDraftEntity, 'buildingInputs'>): string {
  const building = ensurePlain(draft.buildingInputs);
  return JSON.stringify({
    floors: building.floors,
    floorHeight: building.floorHeight,
    floorLevels: building.floorLevels,
    levels: building.levels,
  });
}

function markRoutesForFloorLevelReview(value: unknown, reason: string): Record<string, unknown> {
  const model = ensurePlain(value);
  const components = Array.isArray(model.components) ? model.components : [];
  if (!components.length) return model;
  return {
    ...model,
    components: components.map((item) => {
      const component = ensurePlain(item);
      const type = component.type;
      if (type !== 'pipe-route' && type !== 'duct-route') return item;
      const businessMetadata = ensurePlain(component.businessMetadata);
      return {
        ...component,
        businessMetadata: {
          ...businessMetadata,
          floorLevelReviewStatus: 'stale',
          floorLevelReviewReason: reason,
          floorLevelStaleAt: new Date().toISOString(),
        },
      };
    }),
  };
}

function routeInstallHeight(
  component: GeneratedHvacComponent,
  draft: ViewerDesignDraftEntity,
  sourceFloor: number
): number {
  const explicit = Number(component.installHeight ?? component.businessMetadata?.installHeight);
  if (Number.isFinite(explicit) && explicit >= 0) return roundMeters(explicit);
  const points = Array.isArray(component.geometry?.points) ? component.geometry.points : [];
  const first = points.map((point, index) => normalizeRoutePoint(point, index)).find((point) => {
    const bounds = floorElevationRange(sourceFloor, draft);
    return point.y >= bounds.min && point.y <= bounds.max;
  });
  const sourceLevel = floorRef(sourceFloor, draft).level;
  return roundMeters(Math.max(0, (first?.y ?? sourceLevel) - sourceLevel));
}

function assertDerivedElevation(value: unknown, derived: number, field: string) {
  if (value === undefined || value === null) return;
  const n = verticalCoordinate(value, field);
  if (Math.abs(n - derived) > 0.001) {
    throw new BadRequestException(`${field} must match derived floor level plus route install height`);
  }
}

function appendRiserPoints(
  points: LogicalRoutePoint3[],
  riser: { source: LogicalRoutePoint3; target: LogicalRoutePoint3 }
): LogicalRoutePoint3[] {
  const next = [...points];
  if (!sameRoutePoint(next[next.length - 1], riser.source)) next.push(riser.source);
  if (!sameRoutePoint(next[next.length - 1], riser.target)) next.push(riser.target);
  return next;
}

function sameRoutePoint(a: LogicalRoutePoint3 | undefined, b: LogicalRoutePoint3): boolean {
  if (!a) return false;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= 0.001;
}

function floorNumbersFromRoute(route: Record<string, unknown>): number[] {
  const source = route.floors ?? route.floorParticipation;
  if (!Array.isArray(source)) return [];
  return source
    .map((entry) =>
      typeof entry === 'number' || typeof entry === 'string'
        ? Number(entry)
        : Number(ensurePlain(entry).floor ?? ensurePlain(entry).floorIndex)
    )
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

function floorNumbersForPoints(points: LogicalRoutePoint3[], draft: ViewerDesignDraftEntity): number[] {
  const floorCount = draftFloorCount(draft);
  const floors = new Set<number>();
  for (let floor = 1; floor <= floorCount; floor += 1) {
    const bounds = floorElevationRange(floor, draft);
    if (points.some((point) => point.y >= bounds.min && point.y <= bounds.max)) floors.add(floor);
  }
  return [...floors];
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
}

function ensureRouteTransitions(value: unknown): LogicalRouteCrossFloorTransition[] {
  return Array.isArray(value) ? value as LogicalRouteCrossFloorTransition[] : [];
}

function pointIndexesForFloor(
  points: LogicalRoutePoint3[],
  bounds: { min: number; max: number }
): number[] {
  const indexes: number[] = [];
  points.forEach((point, index) => {
    if (point.y >= bounds.min && point.y <= bounds.max) indexes.push(index);
  });
  return indexes;
}

function normalizePointIndexes(value: unknown, pointCount: number, field: string): number[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequestException(`${field} must be an array`);
  return value.map((entry, index) => {
    const n = Number(entry);
    if (!Number.isInteger(n) || n < 0 || n >= pointCount) {
      throw new BadRequestException(`${field}[${index}] must reference an existing point`);
    }
    return n;
  });
}

function normalizeOptionalPointIndex(value: unknown, pointCount: number, field: string): number | null {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n >= pointCount) {
    throw new BadRequestException(`${field} must reference an existing point`);
  }
  return n;
}

function normalizeOptionalElevation(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return verticalCoordinate(value, field);
}

function normalizeOptionalCoordinate(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return coordinateNumber(value, field);
}

function normalizeOptionalInstallHeight(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_INSTALL_HEIGHT_M) {
    throw new BadRequestException(`${field} must be between 0 and ${MAX_INSTALL_HEIGHT_M} meters`);
  }
  return roundMeters(n);
}

function normalizeTransitionKind(value: unknown): LogicalRouteCrossFloorTransition['kind'] {
  if (value === undefined || value === null || value === 'riser') return 'riser';
  if (value === 'stair' || value === 'shaft' || value === 'sleeve') return value;
  throw new BadRequestException('route crossFloorTransitions kind must be riser, stair, shaft or sleeve');
}

function numberOr(value: unknown, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function optionalFiniteNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function positiveDimension(value: unknown, field: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new BadRequestException(`${field} must be a positive number`);
  }
}

function withoutUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function cleanComponentId(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,127}$/.test(text)) {
    throw new BadRequestException('component id is invalid');
  }
  return text;
}

function cleanText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function cleanNullableText(value: unknown): string | null {
  if (value == null) return null;
  return cleanText(value);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function ensurePlain(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function plainObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function clean(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback ?? null;
  const next = String(value || '').trim();
  return next || null;
}

function ensureObject(value: unknown, field: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (value == null) return {};
  throw new BadRequestException(`${field} must be an object`);
}
