import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './governance.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([AuditLogEntity])]),
    AuthModule
  ],
  controllers: [GovernanceController],
  providers: [
    GovernanceService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(AuditLogEntity)] : [])
  ],
})
export class GovernanceModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class GovernanceBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('governance');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('governance')
export class GovernanceBoundaryController {
  constructor(private readonly s: GovernanceBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
