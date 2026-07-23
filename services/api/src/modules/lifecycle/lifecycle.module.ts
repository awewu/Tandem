import { TypeOrmModule } from '@nestjs/typeorm';
import { LifecycleLinkEntity } from './lifecycle.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([LifecycleLinkEntity])]),
    AuthModule,
    MdmModule
  ],
  controllers: [LifecycleController],
  providers: [
    LifecycleService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(LifecycleLinkEntity)] : [])
  ],
  exports: [LifecycleService],
})
export class LifecycleModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class LifecycleBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('lifecycle');
    // iotBoundary: 'lifecycle_handoff_only'
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('lifecycle')
export class LifecycleBoundaryController {
  constructor(private readonly s: LifecycleBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
