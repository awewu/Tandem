import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { GlobalProductEntity, SourceTier, DataTrustLevel } from './master-data.entity';
import { EventBusService } from './event-bus.service';

export interface RegisterMasterDto {
  tenantId?: string | null;
  sourceTier: SourceTier;
  brandSlug?: string | null;
  sku: string;
  name: string;
  dataTrustLevel?: DataTrustLevel;
  canonicalParams?: Record<string, unknown>;
}

/**
 * M15 · 主数据服务（masterData / MDM）。
 * 单写收口：按 sourceTier 决定唯一写入方；产出/更新发 product.master.updated 事件，
 * 板块二订阅以更新只读副本（最终一致）。
 */
@Injectable()
export class MdmService {
  constructor(
    @InjectRepository(GlobalProductEntity) private readonly products: Repository<GlobalProductEntity>,
    private readonly bus: EventBusService,
  ) {}

  private makeGlobalId(tier: SourceTier, brand: string | null, sku: string): string {
    const basis = `${tier}:${brand || 'na'}:${sku}`;
    return 'gp_' + crypto.createHash('sha1').update(basis).digest('hex').slice(0, 20);
  }

  async registerGlobalProduct(dto: RegisterMasterDto): Promise<GlobalProductEntity> {
    if (!dto.sourceTier || !dto.sku || !dto.name) {
      throw new BadRequestException('sourceTier/sku/name 必填');
    }
    if (dto.sourceTier === 'tenant-private' && !dto.tenantId) {
      throw new BadRequestException('tenant-private 必须带 tenantId');
    }
    const globalProductId = this.makeGlobalId(dto.sourceTier, dto.brandSlug || null, dto.sku);
    const existing = await this.products.findOne({ where: { globalProductId } });
    const entity = this.products.create({
      ...(existing || {}),
      globalProductId,
      tenantId: dto.sourceTier === 'tenant-private' ? (dto.tenantId ?? null) : null,
      sourceTier: dto.sourceTier,
      brandSlug: dto.brandSlug ?? null,
      sku: dto.sku,
      name: dto.name,
      dataTrustLevel: dto.dataTrustLevel || (existing?.dataTrustLevel ?? 'unverified'),
      canonicalParams: dto.canonicalParams || existing?.canonicalParams || {},
      sourceVersion: (existing?.sourceVersion || 0) + 1,
      syncedAt: new Date(),
    });
    const saved = await this.products.save(entity);
    await this.bus.publish({
      tenantId: saved.tenantId,
      eventType: 'product.master.updated',
      aggregateType: 'global_product',
      aggregateId: saved.globalProductId,
      payload: { globalProductId: saved.globalProductId, sourceTier: saved.sourceTier, version: saved.sourceVersion },
    });
    return saved;
  }

  /** 跨板块只读解析：其它板块用 global_product_id 取主数据副本 */
  async resolveGlobalProductId(globalProductId: string) {
    return this.products.findOne({ where: { globalProductId } });
  }

  async listByTier(sourceTier: SourceTier) {
    return this.products.find({ where: { sourceTier } });
  }
}
