import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PositioningController } from './positioning.controller';
import { PositioningService } from './positioning.service';
import { PositioningHouseEntity } from './positioning.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([PositioningHouseEntity])]),
    AuthModule,
  ],
  controllers: [PositioningController],
  providers: [
    PositioningService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(PositioningHouseEntity)] : []),
  ],
  exports: [PositioningService],
})
export class PositioningModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class PositioningBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('positioning');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('positioning')
export class PositioningBoundaryController {
  constructor(private readonly s: PositioningBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
