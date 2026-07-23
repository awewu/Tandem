import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { DesignSyncEntity, DesignSyncState } from './design-sync.entity';
import { DesignProjectEntity } from '../design/design.entity';
import { withRlsTransaction } from '../common/rls';
import { OwnershipScopeUser } from '../common/scope';
import { validateBcfChangeProposal } from './bcf';

/**
 * M12 · 单一真相源同步服务（rysnovaBimSync）。
 * design 为真相源；Rysnova 产物派生并登记；变更走双向同步、禁止静默分叉。
 */
@Injectable()
export class DesignSyncService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  /**
   * 归属校验：design_rysnova_bim_sync 无 dealer 列，归属继承自父 design_project。
   * 仅当调用方带经销商范围时收敛（HQ/平台或内部系统调用 owner 为空 → 仅租户级，RLS 兜底）。
   * 设计不存在或不属于该经销商一律抛 404，不泄露存在性，防同租户跨经销商 IDOR。
   */
  private async assertDesignOwned(
    em: EntityManager, tenantId: string, designId: string, owner?: OwnershipScopeUser,
  ): Promise<void> {
    if (!owner?.dealerId) return;
    const design = await em.getRepository(DesignProjectEntity).findOne({ where: { tenantId, id: designId } });
    if (!design || design.dealerId !== owner.dealerId) {
      throw new NotFoundException('设计项目不存在');
    }
  }

  /** 把一个 Rysnova 深化产物登记为某 design 版本的派生（in_sync） */
  async linkArtifactToDesign(p: {
    tenantId: string; designId: string; designVersion: string;
    artifactId: string; artifactVersion?: string;
  }, owner?: OwnershipScopeUser): Promise<DesignSyncEntity> {
    if (!p.tenantId || !p.designId || !p.designVersion || !p.artifactId) {
      throw new BadRequestException('tenantId/designId/designVersion/artifactId 必填');
    }
    return withRlsTransaction(this.ds, async (em) => {
      await this.assertDesignOwned(em, p.tenantId, p.designId, owner);
      const links = em.getRepository(DesignSyncEntity);
      const link = links.create({
        tenantId: p.tenantId,
        designId: p.designId,
        designVersion: p.designVersion,
        artifactId: p.artifactId,
        artifactVersion: p.artifactVersion || 'v1',
        syncState: 'in_sync',
        changeProposal: null,
      });
      return links.save(link);
    }, { tenantId: p.tenantId });
  }

  /** design 变更 → 该 design 的全部派生产物置 stale（须重做深化） */
  async onDesignChanged(tenantId: string, designId: string, newVersion: string, owner?: OwnershipScopeUser) {
    return withRlsTransaction(this.ds, async (em) => {
      await this.assertDesignOwned(em, tenantId, designId, owner);
      const links = em.getRepository(DesignSyncEntity);
      const affected = await links.find({ where: { tenantId, designId } });
      for (const link of affected) {
        if (link.designVersion !== newVersion) {
          link.syncState = 'stale';
          link.designVersion = newVersion;
          await links.save(link);
        }
      }
      return { designId, newVersion, staled: affected.length };
    }, { tenantId });
  }

  /** Rysnova 工程修正 → 以变更建议回流 design（proposed_change），不直接改真相源 */
  async proposeChangeBackToDesign(tenantId: string, syncId: string, proposal: Record<string, unknown>, owner?: OwnershipScopeUser) {
    // 2.2：BCF 载荷校验（若声明 bcf-3.0-lite）
    if (proposal && (proposal as any).schema === 'bcf-3.0-lite') {
      const v = validateBcfChangeProposal(proposal);
      if (!v.ok) throw new BadRequestException(`BCF 载荷非法: ${v.errors.join('; ')}`);
    }
    return withRlsTransaction(this.ds, async (em) => {
      const links = em.getRepository(DesignSyncEntity);
      const link = await links.findOne({ where: { id: syncId, tenantId } });
      if (!link) throw new NotFoundException('同步记录不存在');
      await this.assertDesignOwned(em, tenantId, link.designId, owner);
      link.syncState = 'proposed_change';
      link.changeProposal = proposal || {};
      return links.save(link);
    }, { tenantId });
  }

  /** design 审核确认变更建议 → 接受后回到 in_sync（真相源已更新） */
  async confirmDesignUpdate(tenantId: string, syncId: string, reviewer: string, newDesignVersion: string, owner?: OwnershipScopeUser) {
    return withRlsTransaction(this.ds, async (em) => {
      const links = em.getRepository(DesignSyncEntity);
      const link = await links.findOne({ where: { id: syncId, tenantId } });
      if (!link) throw new NotFoundException('同步记录不存在');
      await this.assertDesignOwned(em, tenantId, link.designId, owner);
      if (link.syncState !== 'proposed_change') {
        throw new BadRequestException('仅 proposed_change 状态可确认');
      }
      link.syncState = 'in_sync';
      link.designVersion = newDesignVersion || link.designVersion;
      link.reviewedBy = reviewer || 'design-owner';
      link.reviewedAt = new Date();
      link.changeProposal = null;
      return links.save(link);
    }, { tenantId });
  }

  /** 查询某 design 的同步状态（含派生产物是否过期 + 逐产物明细） */
  async getSyncStatus(tenantId: string, designId: string, owner?: OwnershipScopeUser) {
    return withRlsTransaction(this.ds, async (em) => {
    await this.assertDesignOwned(em, tenantId, designId, owner);
    const links = await em.getRepository(DesignSyncEntity).find({
      where: { tenantId, designId },
      order: { updatedAt: 'DESC' },
    });
    const states = links.reduce((acc: Record<DesignSyncState, number>, l) => {
      acc[l.syncState] = (acc[l.syncState] || 0) + 1; return acc;
    }, { in_sync: 0, stale: 0, proposed_change: 0 });
    return {
      designId,
      sourceOfTruth: 'design',
      artifacts: links.length,
      states,
      allInSync: links.length > 0 && states.stale === 0 && states.proposed_change === 0,
      links: links.map((l) => ({
        syncId: l.id,
        artifactId: l.artifactId,
        artifactVersion: l.artifactVersion,
        designVersion: l.designVersion,
        syncState: l.syncState,
        changeProposal: l.changeProposal,
        reviewedBy: l.reviewedBy,
        reviewedAt: l.reviewedAt,
        updatedAt: l.updatedAt,
      })),
    };
    }, { tenantId });
  }
}
