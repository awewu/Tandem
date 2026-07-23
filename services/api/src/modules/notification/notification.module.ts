import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationEntity } from './notification.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([NotificationEntity])]),
    AuthModule
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(NotificationEntity)] : [])
  ],
  exports: [NotificationService],
})
export class NotificationModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class NotificationBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('notification');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('notification')
export class NotificationBoundaryController {
  constructor(private readonly s: NotificationBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
