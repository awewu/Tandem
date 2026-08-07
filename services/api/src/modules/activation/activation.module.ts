import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { ActivationActivityEntity, ActivationParticipationEntity } from './activation.entity';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([ActivationActivityEntity, ActivationParticipationEntity])]),
    AuthModule,
  ],
  controllers: [ActivationController],
  providers: [
    ActivationService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(ActivationActivityEntity), bootSmokeRepositoryProvider(ActivationParticipationEntity)] : []),
  ],
  exports: [ActivationService],
})
export class ActivationModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class ActivationBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('activation');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('activation')
export class ActivationBoundaryController {
  constructor(private readonly s: ActivationBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
