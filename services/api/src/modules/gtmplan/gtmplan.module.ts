import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { GtmplanController } from './gtmplan.controller';
import { GtmplanService } from './gtmplan.service';
import { GtmCampaignEntity, GtmOkrEntity } from './gtmplan.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([GtmCampaignEntity, GtmOkrEntity])]),
    AuthModule,
  ],
  controllers: [GtmplanController],
  providers: [
    GtmplanService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(GtmCampaignEntity), bootSmokeRepositoryProvider(GtmOkrEntity)] : []),
  ],
  exports: [GtmplanService],
})
export class GtmplanModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class GtmplanBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('gtmplan');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('gtmplan')
export class GtmplanBoundaryController {
  constructor(private readonly s: GtmplanBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
