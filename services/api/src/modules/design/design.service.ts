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

  // 见文件末尾 evaluateCalcGate：合规闸判定抽成纯函数，便于单测覆盖静默降级回归。
  async runCalc(user: JwtPayload, projectId: string, input: Record<string, unknown>) {
    // 内核为 CommonJS 纯函数包，不参与 tsc 编译，故用相对路径 require。
    // ⚠️ 历史缺陷（2026-08-04 修复）：原为 `../../../../` —— 从
    // services/api/src/modules/design 上溯 4 级只到 `services/`，解析为
    // services/packages/... 并不存在，**runCalc 第一行即抛错，整个选型计算端点长期返回 500**。
    // 需上溯 5 级到仓库根。编译产物 dist/services/api/... 层级一致，故同一路径两处都成立。
    const hvacKernels = require('../../../../../packages/domain/hvac-kernels');
    // catch 变量在 strict 下为 unknown：统一安全取错误消息
    const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

    // 声明式内核清单：新增/改名内核只改这里，保证「应算几项」有唯一真相。
    const KERNELS: Array<{ key: string; run: () => unknown }> = [
      { key: 'load', run: () => hvacKernels.loadCalculation.calculateLoad(input) },
      { key: 'heating', run: () => hvacKernels.heating.designHeatingSystem(input) },
      { key: 'hotWater', run: () => hvacKernels.hotWater.calculateResidentialHotWater(input) },
      { key: 'airConditioning', run: () => hvacKernels.airConditioning.designAirConditioning(input) },
      { key: 'freshAir', run: () => hvacKernels.freshAir.designFreshAir(input) },
      { key: 'hydraulic', run: () => hvacKernels.hydraulic.HydraulicEngine },
      { key: 'noise', run: () => hvacKernels.noise.evaluateRooms((input as any)?.rooms || []) },
      { key: 'water', run: () => new hvacKernels.water.WaterSystemEngine().generateDesign(input) },
    ];

    const systems: Record<string, unknown> = {};
    const failures: Record<string, string> = {};
    for (const k of KERNELS) {
      try {
        systems[k.key] = k.run();
      } catch (e) {
        failures[k.key] = msg(e);
        this.logger.warn(`${k.key} calc failed: ${msg(e)}`);
      }
    }

    // 合规闸 = 专业度红线。
    // 旧实现：`gatePass = !gateBlocked && Object.keys(systems).length > 0`
    //   → 8 个内核挂 7 个、只要 1 个算出来，方案照样盖上「合规」的章。
    // 对一个以「客户专业度」为核心价值的产品，这是最危险的静默降级：
    // 错误的方案带着合规标记流向经销商与客户，损伤的是品牌信任本身。
    // 现在：任一内核异常，或任一内核自报 gate.blocked，一律阻断；
    // 且必须「应算项 = 已算项」才允许 pass。失败明细随审计落库，可追溯到具体内核。
    const { gate, coverage } = evaluateCalcGate(systems, failures, KERNELS.length);
    const gateBlocked = gate.blocked;
    const gatePass = gate.pass;

    const calcSnapshot = {
      systems,
      failures,
      coverage,
      gate,
      input,
      calculatedAt: new Date().toISOString(),
    };

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

/**
 * 合规闸判定（纯函数，供单测覆盖）——「客户专业度」的红线。
 *
 * 历史缺陷：曾用 `pass = !blocked && computed > 0`，导致 8 个内核挂 7 个、
 * 只要 1 个算出来，方案仍被盖上「合规」章——错误方案带着合规标记流向经销商与客户，
 * 损伤的是品牌信任本身。
 *
 * 现行规则（三条同时满足才 pass）：
 *   1. 无内核抛错（failures 为空）
 *   2. 无内核自报 gate.blocked
 *   3. 应算项 === 已算项（覆盖完整）
 */
export function evaluateCalcGate(
  systems: Record<string, unknown>,
  failures: Record<string, string>,
  expected: number,
) {
  const failed = Object.keys(failures);
  const computed = Object.keys(systems).length;
  const kernelBlocked = Object.values(systems).some((s: any) => s?.gate?.blocked === true);
  const blocked = kernelBlocked || failed.length > 0 || computed !== expected;
  let reason: string | null = null;
  if (blocked) {
    if (failed.length) reason = `内核计算失败：${failed.join(', ')}`;
    else if (kernelBlocked) reason = '内核自报合规阻断';
    else reason = `计算覆盖不完整：应算 ${expected} 项，实算 ${computed} 项`;
  }
  return { gate: { blocked, pass: !blocked, reason }, coverage: { expected, computed, failed } };
}
