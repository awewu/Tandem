import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TenantController } from './tenant.controller';
import { DealerEntity, StoreEntity, TenantEntity } from './tenant.entity';
import { TenantService } from './tenant.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { MdmModule } from '../mdm/mdm.module';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([TenantEntity, DealerEntity, StoreEntity])]),
    AuthModule,
    MdmModule
  ],
  controllers: [TenantController],
  providers: [
    TenantService,
    ...(TARGET_API_BOOT_SMOKE
      ? [
        bootSmokeRepositoryProvider(TenantEntity),
        bootSmokeRepositoryProvider(DealerEntity),
        bootSmokeRepositoryProvider(StoreEntity)
      ]
      : [])
  ],
  exports: [TenantService],
})
export class TenantModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class TenantBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('tenant');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('tenant')
export class TenantBoundaryController {
  constructor(private readonly s: TenantBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
