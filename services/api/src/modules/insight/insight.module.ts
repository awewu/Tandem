import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { InsightController } from './insight.controller';
import { InsightService } from './insight.service';
import { InsightCompetitorEntity, InsightSignalEntity } from './insight.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([InsightCompetitorEntity, InsightSignalEntity])]),
    AuthModule,
  ],
  controllers: [InsightController],
  providers: [
    InsightService,
    ...(TARGET_API_BOOT_SMOKE
      ? [bootSmokeRepositoryProvider(InsightCompetitorEntity), bootSmokeRepositoryProvider(InsightSignalEntity)]
      : []),
  ],
  exports: [InsightService],
})
export class InsightModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class InsightBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('insight');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('insight')
export class InsightBoundaryController {
  constructor(private readonly s: InsightBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
