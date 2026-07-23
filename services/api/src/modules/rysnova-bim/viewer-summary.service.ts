import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../auth/auth.service';
import { ownershipScope } from '../common/scope';
import { TenantScope } from '../common/tenant-context';
import { withRlsTransaction } from '../common/rls';
import { ViewerDesignDraftEntity } from './viewer-draft.entity';
import { ViewerDesignSummaryEntity, ViewerSummaryTrustStatus } from './viewer-summary.entity';
import { deriveRouteSummaryFromComponents } from './route-derived-quantities';

export interface ViewerSummaryInput {
  id?: string;
  draftId?: string | null;
  draftVersion?: number | null;
  modelId?: string | null;
  modelVersion?: number | null;
  projectId?: string | null;
  designProjectId?: string | null;
  bimProjectId?: string | null;
  trustStatus?: ViewerSummaryTrustStatus;
  calculationSummary?: Record<string, unknown>;
  equipmentSummary?: Record<string, unknown>;
  pipeSummary?: Record<string, unknown>;
  complianceSummary?: Record<string, unknown>;
}

@Injectable()
export class ViewerSummaryService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('tenant context required');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }

  async save(user: JwtPayload, dto: ViewerSummaryInput) {
    const tenantId = this.scope(user);
    const id = clean(dto.id, null);
    const draftId = clean(dto.draftId, null);
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const repo = em.getRepository(ViewerDesignSummaryEntity);
        const existing = id
          ? await repo.findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) })
          : null;
        if (id && !existing) throw new NotFoundException('viewer summary not found');

        const draft = draftId
          ? await em
              .getRepository(ViewerDesignDraftEntity)
              .findOneBy({ id: draftId, tenantId, ...ownershipScope(user, { hasStore: true }) })
          : null;
        if (draftId && !draft) throw new NotFoundException('viewer draft not found');

        const next =
          existing ??
          repo.create({
            tenantId,
            dealerId: user.dealerId ?? null,
            storeId: user.storeId ?? null,
            createdBy: user.userId ?? null,
          });
        next.updatedBy = user.userId ?? null;
        next.draftId = draftId ?? next.draftId ?? null;
        next.draftVersion =
          numberOrNull(dto.draftVersion) ?? draft?.version ?? next.draftVersion ?? null;
        next.modelId = clean(dto.modelId, next.modelId);
        next.modelVersion = numberOrNull(dto.modelVersion) ?? next.modelVersion ?? null;
        next.projectId = clean(dto.projectId, draft?.projectId ?? next.projectId);
        next.designProjectId = clean(
          dto.designProjectId,
          draft?.designProjectId ?? next.designProjectId
        );
        next.bimProjectId = clean(dto.bimProjectId, draft?.bimProjectId ?? next.bimProjectId);
        next.trustStatus = normalizeTrust(dto.trustStatus ?? next.trustStatus);
        next.calculationSummary =
          dto.calculationSummary === undefined
            ? (next.calculationSummary ?? {})
            : validateCalculationSummary(
                ensureObject(dto.calculationSummary, 'calculationSummary'),
                next.trustStatus
              );
        next.equipmentSummary =
          dto.equipmentSummary === undefined
            ? (next.equipmentSummary ?? {})
            : validateEquipmentSummary(ensureObject(dto.equipmentSummary, 'equipmentSummary'));
        next.pipeSummary =
          routePipeSummaryFromDraft(draft) ??
          (dto.pipeSummary === undefined
            ? (next.pipeSummary ?? {})
            : validatePipeSummary(ensureObject(dto.pipeSummary, 'pipeSummary')));
        next.complianceSummary =
          dto.complianceSummary === undefined
            ? (next.complianceSummary ?? {})
            : validateComplianceSummary(ensureObject(dto.complianceSummary, 'complianceSummary'));
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
        const summary = await em
          .getRepository(ViewerDesignSummaryEntity)
          .findOneBy({ id, tenantId, ...ownershipScope(user, { hasStore: true }) });
        if (!summary) throw new NotFoundException('viewer summary not found');
        return this.present(summary);
      },
      this.rls(user)
    );
  }

  async latest(user: JwtPayload, draftId: string) {
    const tenantId = this.scope(user);
    const cleanDraftId = clean(draftId, null);
    if (!cleanDraftId) throw new BadRequestException('draftId is required');
    return withRlsTransaction(
      this.ds,
      async (em) => {
        const rows = await em.getRepository(ViewerDesignSummaryEntity).find({
          where: { tenantId, draftId: cleanDraftId, ...ownershipScope(user, { hasStore: true }) },
          order: { updatedAt: 'DESC' },
        });
        return rows[0] ? this.present(rows[0]) : null;
      },
      this.rls(user)
    );
  }

  private present(summary: ViewerDesignSummaryEntity) {
    return {
      id: summary.id,
      tenantId: summary.tenantId,
      dealerId: summary.dealerId,
      storeId: summary.storeId,
      draftId: summary.draftId,
      draftVersion: summary.draftVersion,
      modelId: summary.modelId,
      modelVersion: summary.modelVersion,
      projectId: summary.projectId,
      designProjectId: summary.designProjectId,
      bimProjectId: summary.bimProjectId,
      trustStatus: summary.trustStatus,
      calculationSummary: summary.calculationSummary ?? {},
      equipmentSummary: summary.equipmentSummary ?? {},
      pipeSummary: summary.pipeSummary ?? {},
      complianceSummary: summary.complianceSummary ?? {},
      createdAt: summary.createdAt,
      updatedAt: summary.updatedAt,
    };
  }
}

function normalizeTrust(value: unknown): ViewerSummaryTrustStatus {
  return value === 'verified' ? 'verified' : 'estimate';
}

function validateCalculationSummary(
  summary: Record<string, unknown>,
  trustStatus: ViewerSummaryTrustStatus
): Record<string, unknown> {
  if (
    summary.status !== undefined &&
    strictTrust(summary.status, 'calculationSummary.status') !== trustStatus
  ) {
    throw new BadRequestException('calculationSummary.status must match trustStatus');
  }
  if (
    summary.trustStatus !== undefined &&
    strictTrust(summary.trustStatus, 'calculationSummary.trustStatus') !== trustStatus
  ) {
    throw new BadRequestException('calculationSummary.trustStatus must match trustStatus');
  }
  nonNegativeNumber(summary.coolingLoadKw, 'calculationSummary.coolingLoadKw');
  nonNegativeNumber(summary.heatingLoadKw, 'calculationSummary.heatingLoadKw');
  positiveOptionalNumber(summary.areaM2, 'calculationSummary.areaM2');
  positiveOptionalNumber(summary.floorCount, 'calculationSummary.floorCount');
  return summary;
}

function validateEquipmentSummary(summary: Record<string, unknown>): Record<string, unknown> {
  if (summary.status !== undefined) strictTrust(summary.status, 'equipmentSummary.status');
  const rows = summary.rows;
  if (rows !== undefined && !Array.isArray(rows)) {
    throw new BadRequestException('equipmentSummary.rows must be an array');
  }
  for (const row of Array.isArray(rows) ? rows : []) {
    const item = ensureObject(row, 'equipmentSummary.rows[]');
    if (item.id !== undefined) nonEmptyText(item.id, 'equipmentSummary.rows[].id');
    if (item.systemKey !== undefined)
      nonEmptyText(item.systemKey, 'equipmentSummary.rows[].systemKey');
    if (item.linkedComponentId !== undefined) {
      nonEmptyText(item.linkedComponentId, 'equipmentSummary.rows[].linkedComponentId');
    }
    positiveOptionalNumber(item.quantity, 'equipmentSummary.rows[].quantity');
    nonNegativeNumber(item.loadKw, 'equipmentSummary.rows[].loadKw');
  }
  return summary;
}

function routePipeSummaryFromDraft(
  draft: ViewerDesignDraftEntity | null
): Record<string, unknown> | null {
  const model = ensureObjectOrNull(draft?.generatedModel);
  const components = Array.isArray(model?.components) ? model.components : null;
  if (!components) return null;
  const derived = deriveRouteSummaryFromComponents(components, model);
  return {
    status: derived.status,
    source: derived.source,
    routeCount: derived.routeCount,
    totalLengthM: derived.totalLengthM,
    linkedComponentIds: derived.linkedComponentIds,
    routes: derived.routes,
    crossFloorRouteCount: derived.crossFloorRouteCount,
    crossFloorTransitionCount: derived.crossFloorTransitionCount,
  };
}

function validatePipeSummary(summary: Record<string, unknown>): Record<string, unknown> {
  if (summary.status !== undefined) normalizeComplianceState(summary.status, 'pipeSummary.status');
  if (
    summary.source !== undefined &&
    summary.source !== 'model' &&
    summary.source !== 'estimate' &&
    summary.source !== 'pending'
  ) {
    throw new BadRequestException('pipeSummary.source must be model, estimate or pending');
  }
  nonNegativeNumber(summary.routeCount, 'pipeSummary.routeCount');
  nonNegativeNumber(summary.totalLengthM, 'pipeSummary.totalLengthM');
  if (summary.linkedComponentIds !== undefined && !Array.isArray(summary.linkedComponentIds)) {
    throw new BadRequestException('pipeSummary.linkedComponentIds must be an array');
  }
  for (const id of Array.isArray(summary.linkedComponentIds) ? summary.linkedComponentIds : []) {
    nonEmptyText(id, 'pipeSummary.linkedComponentIds[]');
  }
  return summary;
}

function validateComplianceSummary(summary: Record<string, unknown>): Record<string, unknown> {
  if (summary.state !== undefined)
    normalizeComplianceState(summary.state, 'complianceSummary.state');
  const checks = summary.checks;
  if (checks !== undefined && !Array.isArray(checks)) {
    throw new BadRequestException('complianceSummary.checks must be an array');
  }
  for (const check of Array.isArray(checks) ? checks : []) {
    const item = ensureObject(check, 'complianceSummary.checks[]');
    if (item.key !== undefined) nonEmptyText(item.key, 'complianceSummary.checks[].key');
    if (item.state !== undefined) {
      normalizeComplianceState(item.state, 'complianceSummary.checks[].state');
    }
  }
  return summary;
}

function normalizeComplianceState(value: unknown, field: string): string {
  if (value === 'pending' || value === 'warning' || value === 'failed' || value === 'passed') {
    return value;
  }
  throw new BadRequestException(`${field} must be pending, warning, failed or passed`);
}

function strictTrust(value: unknown, field: string): ViewerSummaryTrustStatus {
  if (value === 'estimate' || value === 'verified') return value;
  throw new BadRequestException(`${field} must be estimate or verified`);
}

function nonNegativeNumber(value: unknown, field: string) {
  if (value === undefined || value === null) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new BadRequestException(`${field} must be a non-negative number`);
  }
}

function positiveOptionalNumber(value: unknown, field: string) {
  if (value === undefined || value === null) return;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new BadRequestException(`${field} must be a positive number`);
  }
}

function nonEmptyText(value: unknown, field: string) {
  if (!String(value || '').trim()) {
    throw new BadRequestException(`${field} must be a non-empty string`);
  }
}

function ensureObjectOrNull(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  return null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function clean(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) return fallback ?? null;
  const next = String(value || '').trim();
  return next || null;
}

function ensureObject(value: unknown, field: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return value as Record<string, unknown>;
  if (value == null) return {};
  throw new BadRequestException(`${field} must be an object`);
}
