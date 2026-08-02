import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  DesignProjectEntity,
  FloorPlanEntity,
  DesignReleaseEntity,
  DesignRysnovaBimSyncEntity,
  AiDesignAuditEntity,
} from './design.entity';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { JwtPayload } from '../auth/auth.service';

@Injectable()
export class DesignService {
  private readonly logger = new Logger('Design');

  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listProjects(user: JwtPayload, query?: { status?: string; search?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const qb = repo.createQueryBuilder('p').where('p.tenant_id = :tid', { tid: user.tenantId });
      if (query?.status && query.status !== 'all') {
        qb.andWhere('p.status = :status', { status: query.status });
      }
      if (query?.search) {
        qb.andWhere('(p.name ILIKE :q OR p.meta::text ILIKE :q)', { q: `%${query.search}%` });
      }
      qb.orderBy('p.updatedAt', 'DESC').limit(100);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async getProject(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const proj = await em.getRepository(DesignProjectEntity).findOne({ where: { id: projectId } });
      if (!proj) throw new NotFoundException('design project not found');
      return proj;
    }, this.scopeOf(user));
  }

  async createProject(user: JwtPayload, body: { name: string; customerId?: string; opportunityId?: string; meta?: Record<string, unknown> }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const project = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        customerId: body.customerId ?? null,
        opportunityId: body.opportunityId ?? null,
        name: body.name,
        status: 'draft',
        meta: body.meta ?? {},
      });
      return repo.save(project);
    }, this.scopeOf(user));
  }

  async updateProject(user: JwtPayload, projectId: string, patch: Partial<DesignProjectEntity>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const existing = await repo.findOne({ where: { id: projectId } });
      if (!existing) throw new NotFoundException('design project not found');
      Object.assign(existing, patch);
      return repo.save(existing);
    }, this.scopeOf(user));
  }

  async deleteProject(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const existing = await repo.findOne({ where: { id: projectId } });
      if (!existing) throw new NotFoundException('design project not found');
      await repo.remove(existing);
      return { id: projectId, deleted: true };
    }, this.scopeOf(user));
  }

  async runCalc(user: JwtPayload, projectId: string, input: Record<string, unknown>) {
    const hvacKernels = require('../../../../packages/domain/hvac-kernels');
    const systems: Record<string, unknown> = {};

    try {
      systems['load'] = hvacKernels.loadCalculation.calculateLoad(input);
    } catch (e) { this.logger.warn(`load calc failed: ${e.message}`); }
    try {
      systems['heating'] = hvacKernels.heating.designHeatingSystem(input);
    } catch (e) { this.logger.warn(`heating calc failed: ${e.message}`); }
    try {
      systems['hotWater'] = hvacKernels.hotWater.calculateResidentialHotWater(input);
    } catch (e) { this.logger.warn(`hotWater calc failed: ${e.message}`); }
    try {
      systems['airConditioning'] = hvacKernels.airConditioning.designAirConditioning(input);
    } catch (e) { this.logger.warn(`AC calc failed: ${e.message}`); }
    try {
      systems['freshAir'] = hvacKernels.freshAir.designFreshAir(input);
    } catch (e) { this.logger.warn(`freshAir calc failed: ${e.message}`); }
    try {
      systems['hydraulic'] = hvacKernels.hydraulic.HydraulicEngine;
    } catch (e) { this.logger.warn(`hydraulic calc failed: ${e.message}`); }
    try {
      systems['noise'] = hvacKernels.noise.evaluateRooms(input?.rooms || []);
    } catch (e) { this.logger.warn(`noise calc failed: ${e.message}`); }
    try {
      systems['water'] = new hvacKernels.water.WaterSystemEngine().generateDesign(input);
    } catch (e) { this.logger.warn(`water calc failed: ${e.message}`); }

    const gateBlocked = Object.values(systems).some((s: any) => s?.gate?.blocked === true);
    const gatePass = !gateBlocked && Object.keys(systems).length > 0;

    const calcSnapshot = { systems, gate: { blocked: gateBlocked, pass: gatePass }, input, calculatedAt: new Date().toISOString() };

    await withRlsTransaction(this.ds, async (em) => {
      await em.getRepository(AiDesignAuditEntity).save({
        tenantId: user.tenantId,
        projectId,
        userId: user.userId ?? null,
        userRole: user.role ?? null,
        actionType: 'calc',
        input,
        output: calcSnapshot,
        trustState: gatePass ? 'pass' : 'blocked',
        kernelVersion: 'hvac-kernels-v1',
        gateStatus: gatePass ? 'pass' : 'blocked',
      });
    }, this.scopeOf(user));

    return calcSnapshot;
  }

  async getLatestPlan(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const plan = await em.getRepository(FloorPlanEntity).findOne({
        where: { projectId },
        order: { updatedAt: 'DESC' },
      });
      return plan;
    }, this.scopeOf(user));
  }

  async saveFloorPlan(user: JwtPayload, projectId: string, body: Partial<FloorPlanEntity>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(FloorPlanEntity);
      const existing = await repo.findOne({ where: { projectId }, order: { updatedAt: 'DESC' } });
      if (existing) {
        Object.assign(existing, body);
        return repo.save(existing);
      }
      const plan = repo.create({
        tenantId: user.tenantId,
        projectId,
        version: 'v1',
        walls: body.walls ?? {},
        equipment: body.equipment ?? {},
        rooms: body.rooms ?? {},
        doors: body.doors ?? null,
        windows: body.windows ?? null,
        furniture: body.furniture ?? null,
        pipes: body.pipes ?? null,
        devices: body.devices ?? null,
        cadImageUrl: body.cadImageUrl ?? null,
        meta: body.meta ?? {},
      });
      return repo.save(plan);
    }, this.scopeOf(user));
  }

  async listReleases(user: JwtPayload, projectId?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignReleaseEntity);
      const qb = repo.createQueryBuilder('r').where('r.tenant_id = :tid', { tid: user.tenantId });
      if (projectId) qb.andWhere('r.project_id = :pid', { pid: projectId });
      qb.orderBy('r.updatedAt', 'DESC').limit(50);
      return qb.getMany();
    }, this.scopeOf(user));
  }

  async createRelease(user: JwtPayload, body: { projectId: string; calcSnapshot: Record<string, unknown>; gatePass?: boolean; gateBlocked?: boolean; disclaimerAccepted?: boolean }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignReleaseEntity);
      const release = repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        projectId: body.projectId,
        status: 'draft',
        calcSnapshot: body.calcSnapshot,
        gatePass: body.gatePass ?? null,
        gateBlocked: body.gateBlocked ?? false,
        disclaimerAccepted: body.disclaimerAccepted ?? false,
      });
      return repo.save(release);
    }, this.scopeOf(user));
  }

  async signRelease(user: JwtPayload, releaseId: string, action: 'review' | 'release' | 'override', body?: { reason?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignReleaseEntity);
      const release = await repo.findOne({ where: { id: releaseId } });
      if (!release) throw new NotFoundException('release not found');
      if (action === 'review') {
        release.status = 'reviewed';
        release.reviewedBy = user.userId;
        release.reviewedAt = new Date();
      } else if (action === 'release') {
        release.status = 'released';
        release.releasedBy = user.userId;
        release.releasedAt = new Date();
      } else if (action === 'override') {
        release.overrideSigned = true;
        release.overrideBy = user.userId;
        release.overrideSignedAt = new Date();
        release.overrideReason = body?.reason ?? null;
        release.status = 'released';
        release.releasedBy = user.userId;
        release.releasedAt = new Date();
      }
      return repo.save(release);
    }, this.scopeOf(user));
  }

  async getSyncStatus(user: JwtPayload, designId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const sync = await em.getRepository(DesignRysnovaBimSyncEntity).findOne({
        where: { designId },
        order: { updatedAt: 'DESC' },
      });
      return sync;
    }, this.scopeOf(user));
  }

  async proposeChange(user: JwtPayload, designId: string, body: { designVersion: string; changeProposal: Record<string, unknown> }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignRysnovaBimSyncEntity);
      const sync = repo.create({
        tenantId: user.tenantId,
        designId,
        designVersion: body.designVersion,
        syncState: 'proposed_change',
        changeProposal: body.changeProposal,
      });
      return repo.save(sync);
    }, this.scopeOf(user));
  }

  async confirmSync(user: JwtPayload, syncId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignRysnovaBimSyncEntity);
      const sync = await repo.findOne({ where: { id: syncId } });
      if (!sync) throw new NotFoundException('sync record not found');
      sync.syncState = 'in_sync';
      sync.reviewedBy = user.userId;
      sync.reviewedAt = new Date();
      return repo.save(sync);
    }, this.scopeOf(user));
  }

  private scopeOf(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId };
  }
}
