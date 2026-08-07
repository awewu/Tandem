import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { MetricDailyRollupEntity, MetricChannelAttributionEntity } from './metrics.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([MetricDailyRollupEntity, MetricChannelAttributionEntity])]),
    AuthModule,
  ],
  controllers: [MetricsController],
  providers: [
    MetricsService,
    ...(TARGET_API_BOOT_SMOKE
      ? [bootSmokeRepositoryProvider(MetricDailyRollupEntity), bootSmokeRepositoryProvider(MetricChannelAttributionEntity)]
      : []),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class MetricsBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('metrics');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('metrics')
export class MetricsBoundaryController {
  constructor(private readonly s: MetricsBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
