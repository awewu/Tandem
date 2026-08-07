import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { CdpController } from './cdp.controller';
import { CdpService } from './cdp.service';
import { CdpProfileEntity, CdpSegmentEntity, CdpConsentEntity } from './cdp.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([CdpProfileEntity, CdpSegmentEntity, CdpConsentEntity])]),
    AuthModule,
    MdmModule,
  ],
  controllers: [CdpController],
  providers: [
    CdpService,
    ...(TARGET_API_BOOT_SMOKE
      ? [
        bootSmokeRepositoryProvider(CdpProfileEntity),
        bootSmokeRepositoryProvider(CdpSegmentEntity),
        bootSmokeRepositoryProvider(CdpConsentEntity),
      ]
      : []),
  ],
  exports: [CdpService],
})
export class CdpModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class CdpBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('cdp');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('cdp')
export class CdpBoundaryController {
  constructor(private readonly s: CdpBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
