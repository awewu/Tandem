import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { CrmController } from './crm.controller';
import { CustomerEntity, InteractionEntity, OpportunityEntity } from './crm.entity';
import { CrmService } from './crm.service';
import { AuditLogEntity } from '../governance/governance.entity';
// 项目主线锚点(lifecycle_links)：建线索即开项目，是 lead→…→交付 的 CORE 级共享锚点。
// crm 自注册该实体，使其不依赖 delivery 模块被加载（delivery 属客户赋能，可从营销中台卸载）。
import { LifecycleLinkEntity } from '../delivery/delivery.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([CustomerEntity, OpportunityEntity, InteractionEntity, AuditLogEntity, LifecycleLinkEntity])]),
    AuthModule,
    MdmModule,
  ],
  controllers: [CrmController],
  providers: [
    CrmService,
    ...(TARGET_API_BOOT_SMOKE
      ? [
        bootSmokeRepositoryProvider(CustomerEntity),
        bootSmokeRepositoryProvider(OpportunityEntity),
        bootSmokeRepositoryProvider(InteractionEntity),
        bootSmokeRepositoryProvider(AuditLogEntity),
        bootSmokeRepositoryProvider(LifecycleLinkEntity)
      ]
      : [])
  ],
  exports: [CrmService],
})
export class CrmModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class CrmBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('crm');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('crm')
export class CrmBoundaryController {
  constructor(private readonly s: CrmBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
