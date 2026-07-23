import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsEventEntity } from './analytics.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([AnalyticsEventEntity])]),
    AuthModule
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(AnalyticsEventEntity)] : [])
  ],
})
export class AnalyticsModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class AnalyticsBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('analytics');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('analytics')
export class AnalyticsBoundaryController {
  constructor(private readonly s: AnalyticsBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
