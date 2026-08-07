import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { withRlsTransaction } from '../common/rls';
import { writeAudit } from '../common/audit';
import type { JwtPayload } from '../auth/auth.service';
import { PositioningHouseEntity } from './positioning.entity';

@Injectable()
export class PositioningService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}
  private scope(a: JwtPayload) { return { tenantId: a.tenantId, actorId: a.userId, role: a.role }; }

  // 品牌×品类 定位屋 upsert（草稿）。基座4：信任状建议带 evidence。
  async upsertHouse(actor: JwtPayload, dto: { brandCode?: string; category?: string; promise?: string; pillars?: any[]; proofPoints?: any[]; targetSegments?: any[]; differentiation?: any[] }) {
    if (!dto.brandCode || !dto.category) throw new BadRequestException('brandCode and category required');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(PositioningHouseEntity);
      const existing = await repo.findOne({ where: { tenantId: actor.tenantId, brandCode: dto.brandCode!, category: dto.category! } });
      const patch: any = {
        tenantId: actor.tenantId, brandCode: dto.brandCode!, category: dto.category!,
        promise: dto.promise ?? existing?.promise ?? null,
        pillars: dto.pillars ?? existing?.pillars ?? [],
        proofPoints: dto.proofPoints ?? existing?.proofPoints ?? [],
        targetSegments: dto.targetSegments ?? existing?.targetSegments ?? [],
        differentiation: dto.differentiation ?? existing?.differentiation ?? [],
        status: 'draft', updatedAt: new Date(),
      };
      if (existing) {
        await repo.update({ id: existing.id }, patch);
        await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'positioning.update', resourceType: 'positioning_house', resourceId: existing.id, afterState: { brandCode: dto.brandCode, category: dto.category } });
        return { id: existing.id, updated: true };
      }
      const saved = await repo.save(repo.create(patch as Partial<PositioningHouseEntity>) as PositioningHouseEntity);
      const evidenceMissing = (patch.proofPoints || []).filter((p: any) => !p?.evidence).length;
      await writeAudit(em, { tenantId: actor.tenantId, actorUserId: actor.userId, action: 'positioning.create', resourceType: 'positioning_house', resourceId: saved.id, afterState: { brandCode: dto.brandCode, category: dto.category } });
      return { id: saved.id, created: true, evidenceMissing };
    }, this.scope(actor));
  }

  async getHouse(actor: JwtPayload, brandCode: string, category: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const house = await em.getRepository(PositioningHouseEntity).findOne({ where: { tenantId: actor.tenantId, brandCode, category } });
      if (!house) throw new NotFoundException('positioning house not found');
      return { house };
    }, this.scope(actor));
  }

  async listHouses(actor: JwtPayload, brandCode?: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const where: Record<string, unknown> = { tenantId: actor.tenantId };
      if (brandCode) where.brandCode = brandCode;
      return { houses: await em.getRepository(PositioningHouseEntity).find({ where, order: { brandCode: 'ASC', category: 'ASC' } }) };
    }, this.scope(actor));
  }

  async setStatus(actor: JwtPayload, id: string, status: 'approved' | 'archived') {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(PositioningHouseEntity);
      const h = await repo.findOne({ where: { id, tenantId: actor.tenantId } });
      if (!h) throw new NotFoundException('positioning house not found');
      if (status === 'approved' && (!h.promise || !(h.pillars || []).length)) throw new BadRequestException('定位屋缺核心承诺/支柱，不能批准');
      await repo.update({ id }, { status, approver: actor.userId, updatedAt: new Date() });
      await writeAudit(em, {
        tenantId: actor.tenantId, actorUserId: actor.userId, action: `positioning.${status}`,
        resourceType: 'positioning_house', resourceId: id,
        beforeState: { status: h.status }, afterState: { status, brandCode: h.brandCode, category: h.category },
      });
      return { id, status };
    }, this.scope(actor));
  }
}
