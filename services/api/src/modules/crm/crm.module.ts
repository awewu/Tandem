import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { CrmController } from './crm.controller';
import { CustomerEntity, InteractionEntity, OpportunityEntity } from './crm.entity';
import { CrmService } from './crm.service';
import { AuditLogEntity } from '../governance/governance.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([CustomerEntity, OpportunityEntity, InteractionEntity, AuditLogEntity])]),
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
        bootSmokeRepositoryProvider(AuditLogEntity)
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
