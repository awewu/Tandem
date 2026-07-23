import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import {
  ViewerModelLoadStatus,
  ViewerModelRecordStatus,
  ViewerModelSourceEntity,
  ViewerModelSourceType,
  ViewerModelType,
} from './viewer-model-source.entity';

export interface ViewerModelSourceInput {
  id?: string;
  draftId?: string | null;
  projectId?: string | null;
  designProjectId?: string | null;
  bimProjectId?: string | null;
  customerId?: string | null;
  opportunityId?: string | null;
  contractId?: string | null;
  sourceType?: ViewerModelSourceType;
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

const SOURCE_TYPES = new Set<ViewerModelSourceType>(['generated', 'local-upload', 'artifact']);
const MODEL_TYPES = new Set<ViewerModelType>(['ifc', 'glb', 'generated', 'unknown']);
const LOAD_STATUSES = new Set<ViewerModelLoadStatus>(['loading', 'ready', 'error', 'archived']);
const RECORD_STATUSES = new Set<ViewerModelRecordStatus>(['active', 'archived', 'deleted']);

@Injectable()
export class ViewerModelSourceService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('tenant context required');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }

  async save(user: JwtPayload, dto: ViewerModelSourceInput) {
    const tenantId = this.scope(user);
    const id = dto.id?.trim();
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ViewerModelSourceEntity);
        const existing = id
          ? await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) })
          : null;
        if (id && !existing) throw new NotFoundException('viewer model source not found');

        const sourceType = ensureSourceType(dto.sourceType ?? existing?.sourceType);
        const loadStatus = ensureLoadStatus(dto.loadStatus ?? existing?.loadStatus ?? 'loading');
        const existingRecordStatus = existing?.recordStatus ?? 'active';
        if (dto.recordStatus && dto.recordStatus !== existingRecordStatus) {
          throw new BadRequestException(
            'recordStatus changes must use archive/delete model source endpoints'
          );
        }
        const recordStatus = ensureRecordStatus(existingRecordStatus);
        const uploadReference =
          dto.uploadReference === undefined
            ? (existing?.uploadReference ?? {})
            : ensureObject(dto.uploadReference, 'uploadReference');
        const metadata =
          dto.metadata === undefined
            ? (existing?.metadata ?? {})
            : ensureObject(dto.metadata, 'metadata');
        const componentSummary =
          dto.componentSummary === undefined
            ? (existing?.componentSummary ?? {})
            : ensureObject(dto.componentSummary, 'componentSummary');
        const modelType = ensureModelType(
          dto.modelType ??
            existing?.modelType ??
            inferModelType({ ...dto, sourceType }, uploadReference, metadata)
        );

        if (sourceType === 'artifact' && !clean(dto.artifactId, existing?.artifactId ?? null)) {
          throw new BadRequestException('artifact model source requires artifactId');
        }
        if (sourceType === 'local-upload' && Object.keys(uploadReference).length === 0) {
          throw new BadRequestException('local-upload model source requires uploadReference');
        }

        const next =
          existing ??
          repo.create({
            tenantId,
            dealerId: user.dealerId ?? null,
            storeId: user.storeId ?? null,
            createdBy: user.userId ?? null,
            version: 0,
            loadStatus: 'loading',
            recordStatus: 'active',
            uploadReference: {},
            metadata: {},
            componentSummary: {},
          });
        if (existing?.recordStatus === 'deleted')
          throw new NotFoundException('viewer model source not found');
        next.updatedBy = user.userId ?? null;
        next.version = Number(next.version || 0) + 1;
        next.draftId = clean(dto.draftId, next.draftId);
        next.projectId = clean(dto.projectId, next.projectId);
        next.designProjectId = clean(dto.designProjectId, next.designProjectId);
        next.bimProjectId = clean(dto.bimProjectId, next.bimProjectId);
        next.customerId = clean(dto.customerId, next.customerId);
        next.opportunityId = clean(dto.opportunityId, next.opportunityId);
        next.contractId = clean(dto.contractId, next.contractId);
        next.sourceType = sourceType;
        next.modelType = modelType;
        next.name =
          clean(dto.name, next.name) ??
          inferName(sourceType, modelType, dto, uploadReference, metadata);
        next.artifactId = clean(dto.artifactId, next.artifactId);
        next.uploadReference = uploadReference;
        next.loadStatus = loadStatus;
        next.recordStatus = recordStatus;
        next.loadError = clean(dto.loadError, null);
        next.metadata = metadata;
        next.componentSummary = componentSummary;
        if (next.recordStatus !== 'archived') next.archivedAt = null;
        if (next.recordStatus !== 'deleted') next.deletedAt = null;
        return this.present(await repo.save(next));
      },
      this.rls(user)
    );
  }

  async get(user: JwtPayload, id: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const source = await em
          .getRepository(ViewerModelSourceEntity)
          .findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
        if (!source || source.recordStatus === 'deleted')
          throw new NotFoundException('viewer model source not found');
        return this.present(source);
      },
      this.rls(user)
    );
  }

  async list(
    user: JwtPayload,
    query: { projectId?: string; draftId?: string; artifactId?: string; includeArchived?: boolean }
  ) {
    const tenantId = this.scope(user);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const where: Record<string, unknown> = {
          tenantId,
          ...ownershipScope(user, { hasStore: true }),
        };
        if (query.projectId) where.projectId = query.projectId;
        if (query.draftId) where.draftId = query.draftId;
        if (query.artifactId) where.artifactId = query.artifactId;
        const rows = await em.getRepository(ViewerModelSourceEntity).find({
          where,
          order: { updatedAt: 'DESC' },
        });
        return {
          items: rows
            .filter((row) => row.recordStatus !== 'deleted')
            .filter(
              (row) =>
                row.recordStatus !== 'archived' || query.includeArchived || isAuditProtected(row)
            )
            .map((row) => this.present(row)),
        };
      },
      this.rls(user)
    );
  }

  async duplicate(user: JwtPayload, id: string, dto: { name?: string | null } = {}) {
    const tenantId = this.scope(user);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ViewerModelSourceEntity);
        const source = await repo.findOneBy({
          id,
          tenantId,
          ...ownershipScope(user, { hasStore: true }),
        });
        if (!source || source.recordStatus === 'deleted')
          throw new NotFoundException('viewer model source not found');
        const copy = repo.create({
          tenantId,
          dealerId: source.dealerId,
          storeId: source.storeId,
          createdBy: user.userId ?? null,
          updatedBy: user.userId ?? null,
          draftId: source.draftId,
          projectId: source.projectId,
          designProjectId: source.designProjectId,
          bimProjectId: source.bimProjectId,
          customerId: source.customerId,
          opportunityId: source.opportunityId,
          contractId: source.contractId,
          sourceType: source.sourceType,
          modelType: source.modelType,
          name: clean(dto.name, null) ?? `${source.name ?? 'Model'} Copy`,
          artifactId: source.artifactId,
          uploadReference: cloneObject(source.uploadReference),
          loadStatus: source.loadStatus === 'archived' ? 'ready' : source.loadStatus,
          recordStatus: 'active',
          loadError: null,
          metadata: { ...cloneObject(source.metadata), duplicatedFromId: source.id },
          componentSummary: cloneObject(source.componentSummary),
          version: 1,
          archivedAt: null,
          deletedAt: null,
        });
        return this.present(await repo.save(copy));
      },
      this.rls(user)
    );
  }

  async rename(user: JwtPayload, id: string, dto: { name?: string | null }) {
    const name = clean(dto.name, null);
    if (!name) throw new BadRequestException('name is required');
    const source = await this.requireEditable(user, id);
    source.name = name;
    source.updatedBy = user.userId ?? null;
    source.version = Number(source.version || 0) + 1;
    return this.persistEntity(user, source);
  }

  async archive(user: JwtPayload, id: string) {
    const source = await this.requireEditable(user, id);
    source.recordStatus = 'archived';
    source.loadStatus = 'archived';
    source.archivedAt = new Date();
    source.updatedBy = user.userId ?? null;
    source.version = Number(source.version || 0) + 1;
    return this.persistEntity(user, source);
  }

  async delete(user: JwtPayload, id: string) {
    const source = await this.requireEditable(user, id);
    if (isAuditProtected(source)) {
      throw new ForbiddenException('audit-linked model sources must be archived, not deleted');
    }
    source.recordStatus = 'deleted';
    source.deletedAt = new Date();
    source.updatedBy = user.userId ?? null;
    source.version = Number(source.version || 0) + 1;
    return this.persistEntity(user, source);
  }

  private present(source: ViewerModelSourceEntity) {
    return {
      id: source.id,
      tenantId: source.tenantId,
      dealerId: source.dealerId,
      storeId: source.storeId,
      draftId: source.draftId,
      projectId: source.projectId,
      designProjectId: source.designProjectId,
      bimProjectId: source.bimProjectId,
      customerId: source.customerId,
      opportunityId: source.opportunityId,
      contractId: source.contractId,
      sourceType: source.sourceType,
      modelType: source.modelType,
      name: source.name,
      artifactId: source.artifactId,
      uploadReference: source.uploadReference,
      loadStatus: source.loadStatus,
      recordStatus: source.recordStatus ?? 'active',
      loadError: source.loadError,
      metadata: source.metadata,
      componentSummary: source.componentSummary,
      version: source.version,
      archivedAt: source.archivedAt,
      deletedAt: source.deletedAt,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  private async requireEditable(user: JwtPayload, id: string) {
    const tenantId = this.scope(user);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const source = await em
          .getRepository(ViewerModelSourceEntity)
          .findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
        if (!source || source.recordStatus === 'deleted')
          throw new NotFoundException('viewer model source not found');
        return source;
      },
      this.rls(user)
    );
  }

  private async persistEntity(user: JwtPayload, source: ViewerModelSourceEntity) {
    return withRlsTransaction(
      this.ds,
      async (em) => {
        return this.present(await em.getRepository(ViewerModelSourceEntity).save(source));
      },
      this.rls(user)
    );
  }
}

function clean(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback ?? null;
  const next = String(value || '').trim();
  return next || null;
}

function ensureObject(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (value == null) return {};
  throw new BadRequestException(`${field} must be an object`);
}

function ensureSourceType(value: unknown): ViewerModelSourceType {
  if (SOURCE_TYPES.has(value as ViewerModelSourceType)) return value as ViewerModelSourceType;
  throw new BadRequestException('sourceType must be generated, local-upload or artifact');
}

function ensureModelType(value: unknown): ViewerModelType {
  if (MODEL_TYPES.has(value as ViewerModelType)) return value as ViewerModelType;
  throw new BadRequestException('modelType must be ifc, glb, generated or unknown');
}

function ensureLoadStatus(value: unknown): ViewerModelLoadStatus {
  if (LOAD_STATUSES.has(value as ViewerModelLoadStatus)) return value as ViewerModelLoadStatus;
  throw new BadRequestException('loadStatus must be loading, ready, error or archived');
}

function ensureRecordStatus(value: unknown): ViewerModelRecordStatus {
  if (RECORD_STATUSES.has(value as ViewerModelRecordStatus))
    return value as ViewerModelRecordStatus;
  throw new BadRequestException('recordStatus must be active, archived or deleted');
}

function inferModelType(
  dto: ViewerModelSourceInput,
  uploadReference: Record<string, unknown>,
  metadata: Record<string, unknown>
): ViewerModelType {
  if (dto.sourceType === 'generated') return 'generated';
  const name = String(
    metadata.originalName ??
      metadata.name ??
      uploadReference.originalName ??
      uploadReference.fileName ??
      dto.artifactId ??
      ''
  ).toLowerCase();
  const mime = String(metadata.mimeType ?? uploadReference.mimeType ?? '').toLowerCase();
  if (name.endsWith('.ifc') || mime.includes('ifc')) return 'ifc';
  if (name.endsWith('.glb') || name.endsWith('.gltf') || mime.includes('gltf')) return 'glb';
  return 'unknown';
}

function inferName(
  sourceType: ViewerModelSourceType,
  modelType: ViewerModelType,
  dto: ViewerModelSourceInput,
  uploadReference: Record<string, unknown>,
  metadata: Record<string, unknown>
): string {
  return String(
    dto.name ??
      metadata.name ??
      metadata.originalName ??
      uploadReference.fileName ??
      uploadReference.originalName ??
      dto.artifactId ??
      `${sourceType}-${modelType}-model`
  );
}

function cloneObject(value: Record<string, unknown> | null | undefined): Record<string, unknown> {
  return value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : {};
}

function isAuditProtected(source: ViewerModelSourceEntity): boolean {
  if (source.contractId) return true;
  const metadata = source.metadata ?? {};
  return Boolean(
    metadata.customerSignoffId ||
    metadata.signoffId ||
    metadata.contractDeliverableId ||
    metadata.auditTrailId ||
    metadata.auditHistoryId
  );
}
